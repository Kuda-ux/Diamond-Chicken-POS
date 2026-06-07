import 'dotenv/config';
import bcrypt from 'bcrypt';
import sql from './client';

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    const adminPasswordHash = await bcrypt.hash('Admin@1234', 12);
    const managerPasswordHash = await bcrypt.hash('Manager@1234', 12);
    const pin1Hash = await bcrypt.hash('1234', 10);
    const pin2Hash = await bcrypt.hash('5678', 10);
    const kitchenPinHash = await bcrypt.hash('9999', 10);

    await sql`
      INSERT INTO users (name, email, password_hash, role)
      VALUES 
        ('Admin', 'admin@diamondchicken.co.zw', ${adminPasswordHash}, 'admin'),
        ('Manager', 'manager@diamondchicken.co.zw', ${managerPasswordHash}, 'manager')
      ON CONFLICT (email) DO NOTHING
    `;

    await sql`
      INSERT INTO users (name, pin, role)
      VALUES 
        ('Tendai Moyo', ${pin1Hash}, 'cashier'),
        ('Rudo Chikwanda',${kitchenPinHash}in2Hash}, 'cashier'),
        ('Chef Blessing', NULL, 'kitchen')
      ON CONFLICT DO NOTHING
    `;

    const categories = [
      { name: 'Chicken', icon: '🍗', order: 1 },
      { name: 'Burgers', icon: '🍔', order: 2 },
      { name: 'Sides', icon: '🍟', order: 3 },
      { name: 'Drinks', icon: '🥤', order: 4 },
      { name: 'Desserts', icon: '🍰', order: 5 },
      { name: 'Combos', icon: '🍽️', order: 6 },
      { name: 'Sauces', icon: '🧂', order: 7 },
    ];

    for (const cat of categories) {
      await sql`
        INSERT INTO categories (name, icon, sort_order)
        VALUES (${cat.name}, ${cat.icon}, ${cat.order})
        ON CONFLICT DO NOTHING
      `;
    }

    const chickenCat = await sql`SELECT id FROM categories WHERE name = 'Chicken' LIMIT 1`;
    const burgersCat = await sql`SELECT id FROM categories WHERE name = 'Burgers' LIMIT 1`;
    const sidesCat = await sql`SELECT id FROM categories WHERE name = 'Sides' LIMIT 1`;
    const drinksCat = await sql`SELECT id FROM categories WHERE name = 'Drinks' LIMIT 1`;
    const dessertsCat = await sql`SELECT id FROM categories WHERE name = 'Desserts' LIMIT 1`;
    const combosCat = await sql`SELECT id FROM categories WHERE name = 'Combos' LIMIT 1`;
    const saucesCat = await sql`SELECT id FROM categories WHERE name = 'Sauces' LIMIT 1`;

    const menuItems = [
      { categoryId: chickenCat[0].id, name: '2 Chicken Pieces', description: 'Crispy fried chicken pieces', price: 2.50, prepTime: 5, order: 1 },
      { categoryId: chickenCat[0].id, name: 'Quarter Chicken', description: 'Quarter chicken with seasoning', price: 4.50, prepTime: 8, order: 2 },
      { categoryId: chickenCat[0].id, name: 'Half Chicken', description: 'Half chicken grilled or fried', price: 8.00, prepTime: 12, order: 3 },
      { categoryId: chickenCat[0].id, name: 'Whole Chicken', description: 'Full chicken for sharing', price: 14.00, prepTime: 15, order: 4 },
      { categoryId: chickenCat[0].id, name: 'Chicken Wings (6pc)', description: 'Spicy chicken wings', price: 3.50, prepTime: 6, order: 5 },
      { categoryId: burgersCat[0].id, name: 'Chicken Burger', description: 'Crispy chicken fillet burger', price: 4.00, prepTime: 7, order: 1 },
      { categoryId: burgersCat[0].id, name: 'Beef Burger', description: 'Juicy beef patty burger', price: 4.50, prepTime: 8, order: 2 },
      { categoryId: burgersCat[0].id, name: 'Double Chicken Burger', description: 'Two chicken fillets', price: 6.00, prepTime: 8, order: 3 },
      { categoryId: sidesCat[0].id, name: 'Chips (Regular)', description: 'Crispy french fries', price: 1.50, prepTime: 5, order: 1 },
      { categoryId: sidesCat[0].id, name: 'Chips (Large)', description: 'Large portion of fries', price: 2.50, prepTime: 5, order: 2 },
      { categoryId: sidesCat[0].id, name: 'Coleslaw', description: 'Fresh coleslaw salad', price: 1.00, prepTime: 2, order: 3 },
      { categoryId: sidesCat[0].id, name: 'Sadza & Chicken', description: 'Traditional sadza with chicken', price: 4.50, prepTime: 10, order: 4 },
      { categoryId: sidesCat[0].id, name: 'Rice & Chicken', description: 'Steamed rice with chicken', price: 4.50, prepTime: 10, order: 5 },
      { categoryId: drinksCat[0].id, name: 'Mazoe Orange (500ml)', description: 'Zimbabwean orange drink', price: 1.00, prepTime: 1, order: 1 },
      { categoryId: drinksCat[0].id, name: 'Coca-Cola (330ml)', description: 'Classic Coke', price: 1.00, prepTime: 1, order: 2 },
      { categoryId: drinksCat[0].id, name: 'Fanta Orange (330ml)', description: 'Orange soda', price: 1.00, prepTime: 1, order: 3 },
      { categoryId: drinksCat[0].id, name: 'Sprite (330ml)', description: 'Lemon-lime soda', price: 1.00, prepTime: 1, order: 4 },
      { categoryId: drinksCat[0].id, name: 'Bottled Water (500ml)', description: 'Pure drinking water', price: 0.50, prepTime: 1, order: 5 },
      { categoryId: dessertsCat[0].id, name: 'Ice Cream Cup', description: 'Vanilla ice cream', price: 1.50, prepTime: 2, order: 1 },
      { categoryId: dessertsCat[0].id, name: 'Chocolate Brownie', description: 'Warm chocolate brownie', price: 1.50, prepTime: 3, order: 2 },
      { categoryId: combosCat[0].id, name: '2-Piece Combo', description: '2 pieces + chips + drink', price: 5.00, prepTime: 7, order: 1 },
      { categoryId: combosCat[0].id, name: 'Quarter Chicken Combo', description: 'Quarter + chips + drink', price: 7.00, prepTime: 10, order: 2 },
      { categoryId: combosCat[0].id, name: 'Burger Combo', description: 'Burger + chips + drink', price: 6.50, prepTime: 8, order: 3 },
      { categoryId: saucesCat[0].id, name: 'Tomato Sauce', description: 'Tomato ketchup sachet', price: 0.20, prepTime: 1, order: 1 },
      { categoryId: saucesCat[0].id, name: 'Peri-Peri Sauce', description: 'Spicy peri-peri sauce', price: 0.30, prepTime: 1, order: 2 },
    ];

    for (const item of menuItems) {
      const result = await sql`
        INSERT INTO menu_items (category_id, name, description, price, prep_time_minutes, sort_order)
        VALUES (${item.categoryId}, ${item.name}, ${item.description}, ${item.price}, ${item.prepTime}, ${item.order})
        RETURNING id
      `;
      
      const stockQuantity = item.price < 1 ? 500 : item.price < 3 ? 200 : 100;
      await sql`
        INSERT INTO inventory (menu_item_id, quantity, low_stock_threshold, unit)
        VALUES (${result[0].id}, ${stockQuantity}, 10, 'pieces')
      `;
    }

    await sql`
      INSERT INTO settings (key, value)
      VALUES 
        ('restaurant_name', 'Diamond Chicken'),
        ('vat_number', 'VAT123456789'),
        ('tax_rate', '0.15'),
        ('currency', 'USD'),
        ('address', 'Naiks Corner, Herbert Chitepo Street, Bulawayo'),
        ('phone', '+263 771 234 567')
      ON CONFLICT (key) DO NOTHING
    `;

    console.log('✅ Database seeded successfully');
    console.log('');
    console.log('📋 Admin login (change immediately after first sign-in):');
    console.log(`   Email:    ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log('');
    console.log('   The admin can create all other staff (managers, cashiers, kitchen)');
    console.log('   via the Users page once signed in.');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default seed;
