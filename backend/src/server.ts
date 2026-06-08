import sql from './db/client';
import * as bcrypt from 'bcrypt';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { env } from './utils/env';
import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';
import { runMigrations } from './db/migrate';
import { getReceiptHtml } from './controllers/receiptsController';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: [env.FRONTEND_URL, 'http://localhost:5173'],
    credentials: true,
  },
});

app.use(helmet());
app.use(cors({
  origin: [env.FRONTEND_URL, 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many requests from this IP, please try again later',
});

app.use('/api/auth', authLimiter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public HTML receipt (for WhatsApp sharing — no auth, UUID-gated)
app.get('/receipts/:id', getReceiptHtml);

app.use('/api', routes);

app.use(errorHandler);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join:kitchen', () => {
    socket.join('kitchen');
    console.log('Socket joined kitchen room');
  });

  socket.on('join:cashiers', () => {
    socket.join('cashiers');
    console.log('Socket joined cashiers room');
  });

  socket.on('join:managers', () => {
    socket.join('managers');
    console.log('Socket joined managers room');
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

export { io };

async function ensureKitchenPins() {
  try {
    const rows = await sql`SELECT id, name FROM users WHERE role = 'kitchen' AND pin IS NULL`;
    if (rows.length === 0) return;
    const hash = await bcrypt.hash('9999', 10);
    await sql`UPDATE users SET pin = ${hash} WHERE role = 'kitchen' AND pin IS NULL`;
    console.log(`🔑 Set default PIN (9999) for ${rows.length} kitchen user(s):`, rows.map((r: any) => r.name).join(', '));
  } catch (e) {
    console.error('Failed to ensure kitchen PINs:', e);
  }
}

async function startServer() {
  try {
    if (env.NODE_ENV === 'production') {
      console.log('Running migrations...');
      try {
        await runMigrations();
      } catch (migrationError) {
        console.error('⚠️ Migration failed (server will still start):', migrationError);
        // Don't crash the server if migration fails - log and continue
      }
    }

    await ensureKitchenPins();

    const PORT = parseInt(env.PORT);
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${env.NODE_ENV}`);
      console.log(`🔗 Frontend URL: ${env.FRONTEND_URL}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
