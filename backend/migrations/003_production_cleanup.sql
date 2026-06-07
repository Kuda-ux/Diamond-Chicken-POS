-- Migration 003: Production cleanup
-- Goals:
--   1. Deactivate (NOT delete) the demo accounts seeded during development so:
--      - they can no longer log in
--      - their PINs are freed up
--      - but historic orders referencing them remain intact
--   2. Update the restaurant settings to the live Bulawayo address.
--
-- Safe to run multiple times (idempotent).

BEGIN;

-- 1. Deactivate demo users.
--    Identified by the email or name we seeded with. Never touches accounts the
--    real admin has created (those have different names / emails).
UPDATE users
SET is_active = false,
    pin = NULL,         -- free up the PIN slot
    pin_hash = NULL     -- in case schema changes later
WHERE (
    email IN (
      'manager@diamondchicken.co.zw'
    )
    OR name IN (
      'Manager',
      'Tendai Moyo',
      'Rudo Chikwanda',
      'Chef Blessing'
    )
  )
  AND role <> 'admin';   -- never deactivate the admin

-- Some older deployments may not have a pin_hash column; guard the column update.
-- (pgSQL doesn't have IF COLUMN EXISTS in DML, so we just leave pin = NULL above
-- which is always present.)

-- 2. Force restaurant settings to the live address (UPSERT).
INSERT INTO settings (key, value)
VALUES
  ('restaurant_name', 'Diamond Chicken'),
  ('address',         'Naiks Corner, Herbert Chitepo Street, Bulawayo'),
  ('phone',           '+263 771 234 567'),
  ('currency',        'USD'),
  ('tax_rate',        '0.15')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

COMMIT;
