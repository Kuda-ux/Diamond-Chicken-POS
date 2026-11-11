import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from '@neondatabase/serverless';

export async function runMigrations() {
  console.log('🔄 Running database migrations...');

  // Prefer the direct (unpooled) connection for migrations — pooled PgBouncer
  // connections don't support the session state DDL/migration tools rely on.
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString });

  try {
    const migrationFiles = [
      '001_initial_schema.sql',
      '002_stock_receipts.sql',
      '003_production_cleanup.sql',
      '004_ingredients_recipes.sql',
      '005_waste_tracking.sql',
      '006_stock_reconciliation.sql',
      '007_confect_department.sql',
    ];

    const client = await pool.connect();
    try {
      for (const file of migrationFiles) {
        const migrationPath = join(__dirname, '../../migrations/', file);
        const migrationSQL = readFileSync(migrationPath, 'utf-8');
        await client.query(migrationSQL);
        console.log(`  ✓ ${file}`);
      }
      console.log('✅ Migrations completed successfully');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
