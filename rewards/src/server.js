require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const { Pool } = require('@neondatabase/serverless');

const PORT = parseInt(process.env.PORT || '3100', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me-32chars-minimum!!';
const BASE_URL = (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------------------------------------------------------------------------
// Schema (idempotent — safe on every boot)
// ---------------------------------------------------------------------------
const SCHEMA = `
CREATE TABLE IF NOT EXISTS staff_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(150) UNIQUE,
  password_hash VARCHAR(255),
  pin_hash VARCHAR(255),
  role VARCHAR(20) NOT NULL DEFAULT 'staff' CHECK (role IN ('admin','staff')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(80) NOT NULL UNIQUE,
  title VARCHAR(160) NOT NULL,
  reward VARCHAR(200) NOT NULL,
  description TEXT,
  max_vouchers INT NOT NULL CHECK (max_vouchers > 0),
  claimed_count INT NOT NULL DEFAULT 0,
  claim_starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claim_ends_at TIMESTAMPTZ NOT NULL,
  pickup_ends_at TIMESTAMPTZ,
  branch_scope VARCHAR(200) NOT NULL DEFAULT 'All Diamond Chicken branches',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL UNIQUE,
  phone VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','redeemed')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_at TIMESTAMPTZ,
  redeemed_by UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  redeem_branch VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vouchers_campaign ON vouchers(campaign_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
CREATE INDEX IF NOT EXISTS idx_vouchers_phone_campaign ON vouchers(campaign_id, phone);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vouchers_one_per_phone
  ON vouchers(campaign_id, phone) WHERE status = 'issued';
`;

async function ensureSchema() {
  const client = await pool.connect();
  try {
    await client.query(SCHEMA);
    // Backfill slug for any pre-existing rows without one (defensive)
    await client.query(`UPDATE campaigns SET slug = 'campaign-' || substr(id::text,1,8) WHERE slug IS NULL OR slug = ''`);
  } finally {
    client.release();
  }
}

async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@diamondchicken.co.zw';
  const password = process.env.ADMIN_PASSWORD || 'Rewards@1234';
  const existing = await pool.query('SELECT id FROM staff_users WHERE email = $1', [email]);
  if (existing.rows.length === 0) {
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      `INSERT INTO staff_users (name, email, password_hash, role) VALUES ($1,$2,$3,'admin')`,
      ['Diamond Chicken Admin', email, hash]
    );
    console.log(`🔑 Seeded rewards admin: ${email}`);
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
function signToken(u) {
  return jwt.sign({ uid: u.id, role: u.role, name: u.name }, JWT_SECRET, { expiresIn: '24h' });
}
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
const adminOnly = (req, res, next) =>
  req.user?.role === 'admin' ? next() : res.status(403).json({ error: 'Admin only' });

function normalizePhone(p) {
  return String(p || '').replace(/[\s()\-]/g, '');
}

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'DC-';
  const bytes = crypto.randomBytes(7);
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return s;
}

function slugify(s) {
  return String(s || 'campaign')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) + '-' + crypto.randomBytes(3).toString('hex');
}

const ok = (res, data, message) => res.json({ success: true, data, message });
const fail = (res, msg, code = 400) => res.status(code).json({ success: false, error: msg });

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------
app.get('/', (req, res) => res.redirect('/admin'));
app.get('/c/:slug', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'claim.html')));
app.get('/staff', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'staff.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, pin } = req.body || {};
    let rows;
    if (pin) {
      rows = (await pool.query('SELECT * FROM staff_users WHERE is_active = TRUE')).rows;
      for (const u of rows) {
        if (u.pin_hash && (await bcrypt.compare(String(pin), u.pin_hash))) {
          return ok(res, { token: signToken(u), user: { id: u.id, name: u.name, role: u.role } });
        }
      }
      return fail(res, 'Invalid PIN', 401);
    }
    if (email && password) {
      const { rows: r } = await pool.query('SELECT * FROM staff_users WHERE email = $1 AND is_active = TRUE', [email]);
      if (r[0] && r[0].password_hash && (await bcrypt.compare(password, r[0].password_hash))) {
        const u = r[0];
        return ok(res, { token: signToken(u), user: { id: u.id, name: u.name, role: u.role } });
      }
      return fail(res, 'Invalid email or password', 401);
    }
    return fail(res, 'Provide email+password or pin', 400);
  } catch (e) {
    console.error(e);
    fail(res, 'Login failed', 500);
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT id, name, email, role FROM staff_users WHERE id = $1', [req.user.uid]);
  ok(res, rows[0] || null);
});

// ---------------------------------------------------------------------------
// Campaigns — admin
// ---------------------------------------------------------------------------
app.get('/api/campaigns', auth, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT c.*, c.claimed_count AS "claimedCount",
      (SELECT COUNT(*)::int FROM vouchers v WHERE v.campaign_id = c.id AND v.status='issued') AS "issuedCount",
      (SELECT COUNT(*)::int FROM vouchers v WHERE v.campaign_id = c.id AND v.status='redeemed') AS "redeemedCount"
    FROM campaigns c ORDER BY c.created_at DESC`);
  ok(res, rows);
});

app.post('/api/campaigns', auth, adminOnly, async (req, res) => {
  try {
    const { title, reward, description, maxVouchers, claimStartsAt, claimEndsAt, pickupEndsAt, branchScope } = req.body || {};
    if (!title || !reward || !maxVouchers || !claimEndsAt) return fail(res, 'title, reward, maxVouchers and claimEndsAt are required');
    const max = parseInt(maxVouchers, 10);
    if (!Number.isFinite(max) || max < 1) return fail(res, 'maxVouchers must be a positive number');
    const slug = slugify(title);
    const { rows } = await pool.query(
      `INSERT INTO campaigns (slug, title, reward, description, max_vouchers, claim_starts_at, claim_ends_at, pickup_ends_at, branch_scope, created_by)
       VALUES ($1,$2,$3,$4,$5, COALESCE($6::timestamptz, now()), $7::timestamptz, $8::timestamptz, $9, $10) RETURNING *`,
      [slug, title, reward, description || null, max,
       claimStartsAt || null, claimEndsAt, pickupEndsAt || null,
       branchScope || 'All Diamond Chicken branches', req.user.uid]
    );
    ok(res, rows[0], 'Campaign created');
  } catch (e) {
    console.error(e);
    fail(res, 'Failed to create campaign', 500);
  }
});

app.patch('/api/campaigns/:id', auth, adminOnly, async (req, res) => {
  const allowed = ['title','reward','description','max_vouchers','claim_starts_at','claim_ends_at','pickup_ends_at','branch_scope','is_active'];
  const sets = [];
  const vals = [];
  const map = { maxVouchers: 'max_vouchers', claimStartsAt: 'claim_starts_at', claimEndsAt: 'claim_ends_at', pickupEndsAt: 'pickup_ends_at', branchScope: 'branch_scope', isActive: 'is_active', is_active: 'is_active' };
  for (const [k, v] of Object.entries(req.body || {})) {
    const col = map[k] || k;
    if (!allowed.includes(col)) continue;
    vals.push(v);
    sets.push(`${col} = $${vals.length}`);
  }
  if (sets.length === 0) return fail(res, 'Nothing to update');
  vals.push(req.params.id);
  const { rows } = await pool.query(`UPDATE campaigns SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
  rows.length ? ok(res, rows[0], 'Campaign updated') : fail(res, 'Campaign not found', 404);
});

app.delete('/api/campaigns/:id', auth, adminOnly, async (req, res) => {
  const { rows } = await pool.query('DELETE FROM campaigns WHERE id = $1 RETURNING id, title', [req.params.id]);
  rows.length ? ok(res, rows[0], 'Campaign deleted') : fail(res, 'Campaign not found', 404);
});

app.get('/api/campaigns/:id/vouchers', auth, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT v.code, v.phone, v.status, v.issued_at AS "issuedAt", v.redeemed_at AS "redeemedAt", v.redeem_branch AS "redeemBranch", u.name AS "redeemedBy"
    FROM vouchers v LEFT JOIN staff_users u ON v.redeemed_by = u.id
    WHERE v.campaign_id = $1 ORDER BY v.issued_at DESC LIMIT 500`, [req.params.id]);
  ok(res, rows);
});

app.get('/api/campaigns/:id/qr.png', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT slug FROM campaigns WHERE id = $1', [req.params.id]);
  if (!rows.length) return fail(res, 'Campaign not found', 404);
  const url = `${BASE_URL}/c/${rows[0].slug}`;
  const png = await QRCode.toBuffer(url, { width: 512, margin: 2 });
  res.type('png').send(png);
});

// ---------------------------------------------------------------------------
// Public campaign + claim (no auth — the QR landing)
// ---------------------------------------------------------------------------
app.get('/api/campaigns/public/:slug', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT title, reward, description, max_vouchers AS "maxVouchers", claimed_count AS "claimedCount",
            claim_starts_at AS "claimStartsAt", claim_ends_at AS "claimEndsAt",
            pickup_ends_at AS "pickupEndsAt", branch_scope AS "branchScope", is_active AS "isActive"
     FROM campaigns WHERE slug = $1`, [req.params.slug]);
  if (!rows.length) return fail(res, 'Promotion not found', 404);
  const c = rows[0];
  const now = Date.now();
  const claimOpen = c.isActive && new Date(c.claimStartsAt) <= now && now <= new Date(c.claimEndsAt);
  ok(res, {
    ...c,
    remaining: Math.max(0, c.maxVouchers - c.claimedCount),
    claimOpen,
    fullyClaimed: c.claimedCount >= c.maxVouchers,
    claimEnded: now > new Date(c.claimEndsAt),
  });
});

app.post('/api/campaigns/:slug/claim', async (req, res) => {
  const slug = req.params.slug;
  const phone = normalizePhone(req.body?.phone);
  if (!/^\+?[0-9]{8,15}$/.test(phone)) return fail(res, 'Enter a valid mobile number (8–15 digits)');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: camps } = await client.query('SELECT * FROM campaigns WHERE slug = $1 FOR UPDATE', [slug]);
    const c = camps[0];
    if (!c) { await client.query('ROLLBACK'); return fail(res, 'Promotion not found', 404); }
    const now = Date.now();
    if (!c.is_active) { await client.query('ROLLBACK'); return fail(res, 'This promotion is currently paused.'); }
    if (now < new Date(c.claim_starts_at).getTime()) { await client.query('ROLLBACK'); return fail(res, 'This promotion has not started yet.'); }
    if (now > new Date(c.claim_ends_at).getTime()) { await client.query('ROLLBACK'); return fail(res, 'The claim period for this promotion has ended.'); }
    if (c.claimed_count >= c.max_vouchers) { await client.query('ROLLBACK'); return fail(res, 'All rewards have been claimed. Please look out for our next promotion.'); }

    // One voucher per phone per campaign — return the existing one if present
    const { rows: existing } = await client.query(
      `SELECT code FROM vouchers WHERE campaign_id = $1 AND phone = $2 AND status = 'issued'`, [c.id, phone]);
    if (existing.length) {
      await client.query('COMMIT');
      return ok(res, { code: existing[0].code, reward: c.reward, pickupEndsAt: c.pickup_ends_at, existing: true }, 'You already have a voucher for this promotion');
    }

    let code;
    for (let i = 0; i < 8; i++) {
      code = makeCode();
      const ins = await client.query(
        `INSERT INTO vouchers (campaign_id, code, phone) VALUES ($1,$2,$3) ON CONFLICT (code) DO NOTHING RETURNING id`,
        [c.id, code, phone]);
      if (ins.rows.length) break;
      if (i === 7) throw new Error('Could not allocate voucher code');
    }
    await client.query('UPDATE campaigns SET claimed_count = claimed_count + 1 WHERE id = $1', [c.id]);
    await client.query('COMMIT');
    ok(res, { code, reward: c.reward, pickupEndsAt: c.pickup_ends_at }, 'Reward claimed!');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Claim error:', e);
    fail(res, 'Claim failed — please try again', 500);
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// Voucher lookup + redeem (staff auth)
// ---------------------------------------------------------------------------
app.get('/api/vouchers/lookup', auth, async (req, res) => {
  const code = String(req.query.code || '').trim().toUpperCase();
  if (!code) return fail(res, 'code is required');
  const { rows } = await pool.query(`
    SELECT v.code, v.phone, v.status, v.issued_at AS "issuedAt", v.redeemed_at AS "redeemedAt", v.redeem_branch AS "redeemBranch",
           c.title AS "campaignTitle", c.reward, c.pickup_ends_at AS "pickupEndsAt", c.branch_scope AS "branchScope"
    FROM vouchers v JOIN campaigns c ON v.campaign_id = c.id
    WHERE v.code = $1`, [code]);
  if (!rows.length) return fail(res, 'Voucher not found', 404);
  const v = rows[0];
  const pickupValid = !v.pickupEndsAt || Date.now() <= new Date(v.pickupEndsAt).getTime();
  ok(res, { ...v, redeemable: v.status === 'issued' && pickupValid, pickupExpired: !pickupValid });
});

app.post('/api/vouchers/redeem', auth, async (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  const branch = String(req.body?.branch || '').slice(0, 120) || null;
  if (!code) return fail(res, 'code is required');

  const { rows } = await pool.query(`
    UPDATE vouchers SET status = 'redeemed', redeemed_at = now(), redeemed_by = $2, redeem_branch = $3
    WHERE code = $1 AND status = 'issued'
    RETURNING code`, [code, req.user.uid, branch]);
  if (rows.length) return ok(res, rows[0], 'Voucher redeemed');

  const check = await pool.query(`SELECT status FROM vouchers WHERE code = $1`, [code]);
  if (!check.rows.length) return fail(res, 'Voucher not found', 404);
  fail(res, 'Voucher has already been redeemed', 409);
});

// ---------------------------------------------------------------------------
// Staff management (admin)
// ---------------------------------------------------------------------------
app.get('/api/staff', auth, adminOnly, async (req, res) => {
  const { rows } = await pool.query('SELECT id, name, email, role, is_active AS "isActive", created_at AS "createdAt" FROM staff_users ORDER BY created_at');
  ok(res, rows);
});

app.post('/api/staff', auth, adminOnly, async (req, res) => {
  try {
    const { name, email, password, pin, role } = req.body || {};
    if (!name || !role || !['admin', 'staff'].includes(role)) return fail(res, 'name and role (admin|staff) required');
    const passwordHash = password ? await bcrypt.hash(password, 12) : null;
    const pinHash = pin ? await bcrypt.hash(String(pin), 10) : null;
    const { rows } = await pool.query(
      `INSERT INTO staff_users (name, email, password_hash, pin_hash, role) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, role`,
      [name, email || null, passwordHash, pinHash, role]);
    ok(res, rows[0], 'Staff member created');
  } catch (e) {
    if (e.code === '23505') return fail(res, 'Email already in use', 409);
    console.error(e);
    fail(res, 'Failed to create staff member', 500);
  }
});

app.patch('/api/staff/:id', auth, adminOnly, async (req, res) => {
  const { name, role, isActive, password, pin } = req.body || {};
  const sets = [];
  const vals = [];
  const push = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
  if (name !== undefined) push('name', name);
  if (role !== undefined) push('role', role);
  if (isActive !== undefined) push('is_active', !!isActive);
  if (password) push('password_hash', await bcrypt.hash(password, 12));
  if (pin) push('pin_hash', await bcrypt.hash(String(pin), 10));
  if (!sets.length) return fail(res, 'Nothing to update');
  vals.push(req.params.id);
  const { rows } = await pool.query(`UPDATE staff_users SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING id, name, email, role, is_active`, vals);
  rows.length ? ok(res, rows[0], 'Updated') : fail(res, 'Not found', 404);
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function start() {
  await ensureSchema();
  await ensureAdmin();
  app.listen(PORT, () => {
    console.log(`🎁 Diamond Rewards running on port ${PORT}`);
    console.log(`🔗 Claim pages: ${BASE_URL}/c/<campaign-slug>`);
    console.log(`👨‍💼 Staff portal: ${BASE_URL}/staff`);
    console.log(`📊 Admin portal:  ${BASE_URL}/admin`);
  });
}
start().catch((e) => { console.error('Failed to start:', e); process.exit(1); });
