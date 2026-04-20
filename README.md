# 💎 Diamond Chicken POS System

A complete, production-grade, full-stack Point of Sale (POS) system for Diamond Chicken fast food restaurant in Zimbabwe. Built with modern technologies and designed for real-world deployment.

![Tech Stack](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)

## 🌟 Features

### Core Functionality
- **🔐 Multi-Role Authentication**: Email/password for staff, PIN for cashiers
- **🛒 Real-time POS**: Fast, intuitive cashier interface with cart management
- **👨‍🍳 Kitchen Display**: Live order tracking for kitchen staff
- **📊 Manager Dashboard**: Analytics, reports, and business insights
- **💰 Multiple Payment Methods**: Cash, EcoCash, InnBucks, ZIPIT, Card (Paynow)
- **🖨️ Receipt Printing**: ESC/POS thermal printer support via Web Serial API
- **📱 Real-time Updates**: Socket.IO for instant order status synchronization
- **💵 Zimbabwe-Specific**: USD pricing, local payment methods, ZIMRA compliance

### Technical Highlights
- **TypeScript Strict Mode**: Type-safe throughout
- **Decimal.js**: Precise monetary calculations (no floating-point errors)
- **React Query**: Optimized data fetching and caching
- **Zustand**: Lightweight state management
- **Neon PostgreSQL**: Serverless database with connection pooling
- **Beautiful UI**: Premium dark theme with glassmorphism effects

## 📁 Project Structure

```
diamond-chicken-pos/
├── backend/                 # Node.js + Express API
│   ├── src/
│   │   ├── controllers/     # Request handlers
│   │   ├── routes/          # API routes
│   │   ├── middleware/      # Auth, error handling
│   │   ├── models/          # Data models
│   │   ├── services/        # Business logic (payments, etc.)
│   │   ├── db/              # Database client, migrations, seeds
│   │   ├── utils/           # Helper functions
│   │   └── server.ts        # Express + Socket.IO server
│   ├── migrations/          # SQL migration files
│   ├── Procfile             # Railway deployment config
│   └── package.json
├── frontend/                # React + Vite SPA
│   ├── src/
│   │   ├── pages/           # Route components
│   │   ├── components/      # Reusable UI components
│   │   ├── stores/          # Zustand state stores
│   │   ├── services/        # API client, Socket.IO
│   │   ├── hooks/           # Custom React hooks
│   │   └── main.tsx         # App entry point
│   ├── vercel.json          # Vercel deployment config
│   └── package.json
├── shared/                  # Shared TypeScript types
│   └── src/types/
├── docker-compose.yml       # Local PostgreSQL (dev only)
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** 20+ and npm
- **PostgreSQL** (local) or **Neon** account (production)
- **Git**

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/diamond-chicken-pos.git
cd diamond-chicken-pos
```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` with your configuration:
```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/diamond_chicken_pos
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
JWT_EXPIRES_IN=8h
RESTAURANT_NAME=Diamond Chicken
TAX_RATE=0.15
FRONTEND_URL=http://localhost:5173
```

### 3. Database Setup

**Option A: Local PostgreSQL (Development)**
```bash
# Start PostgreSQL with Docker
docker-compose up -d

# Run migrations
npm run migrate

# Seed database
npm run seed
```

**Option B: Neon (Production)**
1. Create account at [neon.tech](https://neon.tech)
2. Create new project: `diamond-chicken-pos`
3. Copy connection string to `DATABASE_URL` in `.env`
4. Run migrations: `npm run migrate`
5. Seed database: `npm run seed`

### 4. Start Backend
```bash
npm run dev
```
Backend runs on `http://localhost:3001`

### 5. Frontend Setup
```bash
cd ../frontend
npm install
```

Create `.env.local`:
```env
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

### 6. Start Frontend
```bash
npm run dev
```
Frontend runs on `http://localhost:5173`

## 🔑 Default Credentials

After seeding, use these credentials:

### Staff Login (Email + Password)
- **Admin**: `admin@diamondchicken.co.zw` / `Admin@1234`
- **Manager**: `manager@diamondchicken.co.zw` / `Manager@1234`

### Cashier Login (PIN)
- **Tendai Moyo**: PIN `1234`
- **Rudo Chikwanda**: PIN `5678`

## 🌐 Deployment

### Deploy to Production

#### 1. Neon Database
1. Go to [neon.tech](https://neon.tech) → Create Project
2. Copy connection string
3. Set as `DATABASE_URL` in Railway/Vercel

#### 2. Backend → Railway
1. Go to [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Select repository → Set root directory: `backend`
4. Add environment variables:
   ```
   NODE_ENV=production
   DATABASE_URL=<your-neon-connection-string>
   JWT_SECRET=<generate-strong-secret>
   JWT_EXPIRES_IN=8h
   PAYNOW_INTEGRATION_ID=<your-paynow-id>
   PAYNOW_INTEGRATION_KEY=<your-paynow-key>
   PAYNOW_RETURN_URL=https://your-frontend.vercel.app/payment/return
   PAYNOW_RESULT_URL=https://your-backend.railway.app/api/payments/webhook
   RESTAURANT_NAME=Diamond Chicken
   TAX_RATE=0.15
   FRONTEND_URL=https://your-frontend.vercel.app
   ```
5. Deploy → Copy Railway URL

#### 3. Frontend → Vercel
1. Go to [vercel.com](https://vercel.com)
2. New Project → Import from GitHub
3. Framework: Vite
4. Root Directory: `frontend`
5. Add environment variables:
   ```
   VITE_API_URL=https://your-backend.railway.app/api
   VITE_SOCKET_URL=https://your-backend.railway.app
   ```
6. Deploy → Copy Vercel URL

#### 4. Update Backend FRONTEND_URL
Go back to Railway → Update `FRONTEND_URL` to your Vercel URL → Redeploy

#### 5. Run Migrations
In Railway dashboard → Open shell:
```bash
npm run migrate
npm run seed
```

## 📡 API Documentation

### Authentication
```
POST   /api/auth/login              # Email + password login
POST   /api/auth/pin-login          # PIN login (cashiers)
POST   /api/auth/logout             # Logout
GET    /api/auth/me                 # Get current user
```

### Categories
```
GET    /api/categories              # List all categories
POST   /api/categories              # Create category (manager+)
PUT    /api/categories/:id          # Update category (manager+)
DELETE /api/categories/:id          # Delete category (admin)
PUT    /api/categories/reorder      # Reorder categories (manager+)
```

### Menu
```
GET    /api/menu                    # List all menu items
GET    /api/menu/:id                # Get menu item
POST   /api/menu                    # Create menu item (manager+)
PUT    /api/menu/:id                # Update menu item (manager+)
PUT    /api/menu/:id/toggle         # Toggle availability (manager+)
DELETE /api/menu/:id                # Delete menu item (admin)
```

### Orders
```
GET    /api/orders                  # List orders (with filters)
POST   /api/orders                  # Create order
GET    /api/orders/:id              # Get order details
PUT    /api/orders/:id/status       # Update order status
PUT    /api/orders/:id/cancel       # Cancel order
GET    /api/orders/today/summary    # Today's summary
```

### Payments
```
POST   /api/payments/cash           # Process cash payment
POST   /api/payments/ecocash        # Process EcoCash payment
POST   /api/payments/innbucks       # Process InnBucks payment
POST   /api/payments/zipit          # Process ZIPIT payment
POST   /api/payments/card           # Process card payment
GET    /api/payments/:orderId/status # Get payment status
POST   /api/payments/confirm        # Manually confirm payment (manager+)
```

## 🔌 Socket.IO Events

### Server → Client
```javascript
'order:new'           // New order created → kitchen
'order:status'        // Order status changed → cashiers
'order:ready'         // Order ready for pickup → cashiers
'order:cancelled'     // Order cancelled → all
'inventory:low'       // Low stock alert → managers
'payment:confirmed'   // Payment confirmed → cashiers
```

### Client → Server
```javascript
'join:kitchen'        // Join kitchen room
'join:cashiers'       // Join cashiers room
'join:managers'       // Join managers room
```

## 🖨️ Receipt Printing

The system supports ESC/POS thermal printers via Web Serial API (Chrome/Edge only).

### Setup
1. Connect USB thermal printer (e.g., Epson TM-T20III)
2. In POS screen → Click printer icon
3. Select printer from browser dialog
4. Print test receipt to verify

### Supported Printers
- Epson TM-T20III
- Epson TM-T82
- Any ESC/POS compatible thermal printer

## 💳 Payment Integration

### Paynow (Zimbabwe)
1. Register at [paynow.co.zw](https://www.paynow.co.zw)
2. Get Integration ID and Integration Key
3. Set in environment variables
4. Configure webhook URL: `https://your-backend.railway.app/api/payments/webhook`

### Testing Payments
- **Cash**: Always works
- **EcoCash**: Use sandbox phone numbers in development
- **InnBucks**: QR code generated (manual confirmation in dev)
- **ZIPIT**: Reference generated (manual confirmation)
- **Card**: Redirects to Paynow (use test cards in sandbox)

## 🛠️ Development

### Run Tests
```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

### Type Check
```bash
npm run type-check
```

### Lint
```bash
npm run lint
```

### Build
```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
```

## 📊 Database Schema

Key tables:
- **users**: Staff accounts and cashiers
- **categories**: Menu categories
- **menu_items**: Food and drink items
- **inventory**: Stock levels
- **orders**: Customer orders
- **order_items**: Order line items
- **receipts**: Printed receipts
- **shifts**: Cashier shifts
- **daily_reports**: End-of-day reports
- **settings**: System configuration

## 🔒 Security

- JWT authentication with 8-hour expiry
- Bcrypt password hashing (12 rounds)
- Bcrypt PIN hashing (10 rounds)
- Rate limiting on auth endpoints (10 req/min)
- CORS configured for frontend origin only
- Helmet.js security headers
- SQL injection protection (parameterized queries)
- XSS protection

## 🌍 Zimbabwe-Specific Features

- **USD Currency**: All prices in US Dollars
- **15% VAT**: Automatic tax calculation
- **Local Payments**: EcoCash, InnBucks, ZIPIT integration
- **ZIMRA Compliance**: Z-report generation
- **Local Menu**: Zimbabwean fast food items (sadza, Mazoe, etc.)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📝 License

This project is proprietary software for Diamond Chicken. All rights reserved.

## 📞 Support

For support, email support@diamondchicken.co.zw or contact the development team.

---

**Built with ❤️ for Diamond Chicken, Zimbabwe**

🍗 Serving Quality, Every Order
