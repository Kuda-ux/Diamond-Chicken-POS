# Diamond Chicken POS — Owner & Staff Guide

**Welcome!** This guide explains exactly how your new Point-of-Sale (POS) system works, how you (the owner/admin) manage it, and how each member of your team uses it day-to-day.

> **Live System:** https://diamond-chicken-pos.vercel.app
> **Works on:** Any computer, tablet or phone with a web browser (Chrome, Edge, Safari recommended).

---

## 1. What this system does

Diamond Chicken POS replaces paper, calculators and guesswork with one clean digital system that handles:

- **Taking orders** at the till
- **Sending orders to the kitchen** instantly (no shouting!)
- **Tracking stock** automatically — when something is sold, it's deducted from the count
- **Logging weekly stock deliveries** so you always know what came in and what's left
- **Processing payments** in Cash, EcoCash, OneMoney, Bank Card or Bank Transfer
- **Printing receipts** for customers (ZIMRA-compliant)
- **Cashier shifts** — opening cash float and closing with a Z-Report at end of day
- **Live sales dashboard** so you see today's revenue, top items and low-stock warnings in real time
- **Managing your staff** — you decide who can log in and what they can do

Everything updates **live**: a sale on the till instantly drops stock, instantly shows on the kitchen screen, and instantly shows on your dashboard — no refresh needed.

---

## 2. The four user roles

Each person logs in with their own account. The system shows them only what they need.

| Role | Logs in with | What they can do |
|------|-------------|-----------------|
| **Admin** (you, the owner) | Email + Password | Full access to everything: dashboard, sales, inventory, staff, settings |
| **Manager** | Email + Password | Same as admin except can't manage staff or delete data |
| **Cashier** | 4-digit PIN | Take orders, take payments, print receipts, open/close their shift |
| **Kitchen** | 4-digit PIN | See incoming orders, mark them as preparing / ready / served |

**Why PIN for cashiers and kitchen?** It's faster at the till — they punch 4 digits and they're in. Email/password is reserved for office staff with admin/manager rights.

---

## 3. Default login credentials

> ⚠️ **Please change all of these on day one.** See section 9 to learn how to manage staff and update PINs/passwords.

| Role | Login |
|------|-------|
| **Admin (Owner)** | Email: `admin@diamondchicken.co.zw` &nbsp;•&nbsp; Password: `Admin@1234` |
| **Manager** | Email: `manager@diamondchicken.co.zw` &nbsp;•&nbsp; Password: `Manager@1234` |
| **Cashier — Tendai Moyo** | PIN: `1234` |
| **Cashier — Rudo Chikwanda** | PIN: `5678` |
| **Kitchen — Chef Blessing** | PIN: `9999` |

---

## 4. Logging in

1. Open your browser and go to **https://diamond-chicken-pos.vercel.app**
2. You'll see two tabs:
   - **Staff** — for Admin / Manager. Type email and password, click **Sign in**.
   - **PIN** — for Cashier / Kitchen. Type the 4-digit PIN; once the 4th digit is entered the system signs them in automatically.
3. The system remembers the login on that device. To switch user, click **Logout** at the top right.

> **Tip:** Save the website to your home screen on a tablet — it then opens like an app.

---

## 5. The Owner's Dashboard (Admin / Manager view)

When you log in, you land on the dashboard. This is your "control room".

**At the top you see four cards:**
- 💰 **Today's Revenue** — total money taken today
- 🛒 **Orders Today** — how many orders were placed
- 📈 **Average Order Value** — revenue ÷ orders
- ⚠️ **Low-Stock Items** — how many items are running low

**Below that:**
- **Hourly Revenue chart** — see the busy hours of your day at a glance
- **Payment Methods chart** — donut showing Cash vs EcoCash vs OneMoney vs Card vs Bank
- **Live Order Feed** — every order as it comes in, with table or counter, total and status
- **Low-Stock Alerts panel** — items below their threshold; click to go straight to inventory

**Top-right buttons:**
- **Inventory** — manage stock and receive deliveries
- **Users** — manage your staff (admin only)
- **Logout**

Everything refreshes automatically. Leave it open on a screen in the office and you always know what's happening.

---

## 6. Cashier workflow (taking orders)

This is what your front-of-house team does every day.

### 6.1 Opening a shift (start of day)
1. Cashier punches their PIN.
2. The system pops up: **"Open Shift"** — they enter the cash float in the drawer (e.g. $20).
3. They click **Open Shift** and the till is ready.

### 6.2 Taking an order
1. Cashier sees the menu sorted by category (Chicken, Burgers, Sides, Drinks, etc.).
2. They tap menu items to add to the cart on the right.
3. **Out-of-stock items are greyed out** and **low-stock items show a yellow badge** — staff know immediately what's available.
4. They can change quantities with `+` / `−` buttons or tap the trash icon to remove.
5. Optional: enter a **Table Number** or **Customer Name** for table service / takeaway labelling.
6. They click **Pay** when the customer is ready.

### 6.3 Processing payment
A modal opens with five payment options:

| Method | What happens |
|--------|-------------|
| **💵 Cash** | Cashier types amount tendered → system calculates change automatically |
| **📱 EcoCash** | Cashier asks for customer phone → reference number is logged |
| **📱 OneMoney** | Same as EcoCash |
| **💳 Card** | Cashier swipes on the card machine, then enters the auth/reference code |
| **🏦 Bank Transfer** | Cashier confirms transfer received and enters the reference |

7. After payment, the system shows a **Success screen** with the receipt.
8. Cashier clicks **🖨 Print Receipt** (browser print dialog) or **📲 Share via WhatsApp** to send the receipt as text.
9. **The order is automatically sent to the kitchen** — no extra step needed.

### 6.4 Closing the shift (end of day)
1. Cashier clicks **Close Shift** at the top.
2. They count the cash drawer and enter the closing amount.
3. The system generates a **Z-Report** showing:
   - Opening float, expected cash, actual cash, **variance**
   - Total sales by payment method
   - Total transactions, VAT collected
4. Print it for the daily till book.

---

## 7. Kitchen workflow

The kitchen has a dedicated big-screen view (perfect for a tablet on the wall).

1. Kitchen staff member punches their PIN.
2. They land on a board with three columns: **🔥 Pending**, **👨‍🍳 Preparing**, **✅ Ready**.
3. **Every new order pops up live** with a sound alert — no refresh needed.
4. Each order card shows:
   - Order number, table/customer name
   - List of items with quantities
   - **A timer** showing how long it's been waiting (turns red when overdue)
5. Buttons on each card:
   - **Start Preparing** → moves to middle column
   - **Mark as Ready** → moves to right column AND alerts the cashier
6. When the customer collects/the food is served, it's swept off the board.

This means the cook never has to ask "what's next?" and you never have a forgotten ticket.

---

## 8. Inventory management

Click **Inventory** from your dashboard. There are two tabs:

### 8.1 Current Stock tab
- Lists every menu item with its **on-hand quantity** and **low-stock threshold**.
- Items below threshold show in **red**; out-of-stock in **dark red**.
- **Search bar** to find items quickly.
- **Restock** button next to each item lets you adjust the count in one step (e.g. "I just unpacked 30 more drinks").

### 8.2 Receipt History tab — **NEW: weekly stock workflow**

This is how you log a **delivery / weekly stock-up**:

1. Click **📦 Receive Stock** at the top right.
2. Fill in the form:
   - **Date received** (defaults to today)
   - **Supplier** (e.g. "Irvine's Chicken Wholesale")
   - **Notes** (optional, e.g. "Friday weekly delivery")
3. **Add lines** for each item received:
   - Search the item, type the **quantity received**, optionally the **unit cost**
   - Click **Add another item** for each line
4. Click **Save Receipt**.

✅ Inventory is **automatically incremented** for every line.
✅ A permanent audit row is saved showing date, supplier, who logged it, what was received and at what cost.

**As cashiers ring up sales, stock subtracts automatically.** So if you received 50 chickens on Monday and sold 32 by Friday, the system shows 18 left — and warns you when you're below your threshold.

The Receipt History list shows every batch ever received, filterable by date or supplier. Mistakes can be reversed by an admin (this also subtracts the stock back out so numbers stay correct).

---

## 9. Managing staff (Admin only)

Click **Users** from your dashboard. This is your **employee directory** for the system.

### 9.1 What you'll see
A table of every user with:
- Name, role (with colour-coded pill), email/PIN, status (active/inactive), date joined
- Search bar, role filter, "show inactive" toggle

### 9.2 Adding a new staff member
1. Click **➕ Add User**.
2. Choose the **role**: Admin, Manager, Cashier or Kitchen.
3. Enter their **name**.
4. The form **adapts to the role**:
   - **Admin / Manager** → asks for email + password
   - **Cashier / Kitchen** → asks for a 4-digit PIN
5. Click **Create User**. They can log in immediately.

> The system **prevents PIN clashes** — if you try to assign a PIN already used by someone else, you'll get a clear error.

### 9.3 Editing a staff member
- Click ✏️ next to their name.
- You can change name, email, password, PIN or role.
- Leave password/PIN blank to keep the existing one — only fill it to **reset** it.

### 9.4 Removing access
- Click 🗑 to **deactivate** (soft-delete). They can no longer log in but their history is preserved.
- Click ↻ to **reactivate** later if they come back.

### 9.5 Built-in safety
The system protects you from common mistakes:
- ❌ You cannot deactivate or demote your **own** account (so you never lock yourself out).
- ❌ The system always keeps **at least one active admin** — it will refuse the last admin removal.
- ❌ Two cashiers cannot share a PIN.

---

## 10. Recommended daily & weekly routine

### 🌅 Morning (open of business)
- **Cashier**: log in, open shift with cash float
- **Kitchen**: log in on the kitchen tablet
- **Manager**: glance at the dashboard — yesterday's totals, any low-stock alerts

### 🍽️ Throughout the day
- Cashiers take orders → kitchen prepares → customers collect
- Stock counts down automatically with each sale

### 🌙 Evening (close of business)
- **Cashier**: close shift, print Z-Report, reconcile cash drawer
- **Manager**: review today's revenue and payment-method split

### 📦 Weekly (delivery day, e.g. Friday)
- **Owner/Manager**: log in → Inventory → **Receive Stock**
- Enter the supplier, add every item delivered with quantities
- Save → inventory is now refilled for the week

### 📋 Monthly
- **Owner**: review staff list, deactivate anyone who has left
- Spot-check inventory: physical count vs system count (the difference flags theft or wastage)

---

## 11. Tips & best practice

- ✅ **Change all default passwords and PINs on day one** (Users page).
- ✅ Give every staff member their **own PIN** — never share. The Z-Report is per-cashier so you can see exactly who took what.
- ✅ Keep the kitchen tablet plugged in and on the wall — orders pop up automatically with a sound alert.
- ✅ Always **open a shift** at the start of the day and **close it** at the end. The Z-Report is your daily till book.
- ✅ Log every stock delivery the **same day** it arrives, while the boxes are still in front of you.
- ✅ Set realistic **low-stock thresholds** for each item (e.g. 10 packs of chips) so you get warned before running out.
- ❌ Don't share the admin email/password with anyone who shouldn't have full access — give them a Manager account instead.

---

## 12. Common questions

**Q: What if the internet goes down?**
The system is web-based, so it needs internet. If you have a brief outage, finish current sales by hand and log them later via the admin (or, recommended, install a 4G backup router).

**Q: Can I add a new menu item?**
Yes — currently this is done by your developer/admin via the system database. A future update can add a "Menu management" page where you can add/edit items yourself. Talk to the developer when you need this.

**Q: Where is my data stored?**
In a secure cloud database (Neon Postgres). It's automatically backed up. No data lives on the till tablet — you can use any device.

**Q: A cashier forgot their PIN. What do I do?**
Log in as admin → Users → ✏️ next to their name → enter a new 4-digit PIN → save. Tell them the new PIN.

**Q: I made a mistake when logging a stock delivery. Can I undo it?**
Yes. Go to Inventory → Receipt History → find the batch → click the reverse button. Stock will be subtracted back out automatically.

**Q: Can I see a specific cashier's sales for a day?**
Yes — close-of-shift Z-Reports show per-cashier totals. The dashboard's order feed also shows the cashier name on every order.

**Q: How do I add 5% discount or a promo?**
Currently not built in. Tell the developer if you need promo codes / discounts and it can be added.

---

## 13. Who to call

- **System issues / errors / new features**: contact your developer
- **Staff training**: print sections 4, 6 and 7 of this guide for cashiers and kitchen
- **Owner/admin training**: sections 5, 8, 9 of this guide

---

**That's it!** You now have a modern, professional POS that handles ordering, payments, kitchen tickets, stock and staff in one place. The most important habit to build is logging stock the day it arrives and closing shifts at the end of every day — do those two things consistently and the system gives you accurate numbers forever.

Welcome to Diamond Chicken POS. 🐔💎
