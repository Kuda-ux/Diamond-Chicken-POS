import { readFileSync } from 'fs';
import { join } from 'path';
import sql from './client';

export async function runMigrations() {
  console.log('🔄 Running database migrations...');
  
  try {
    const migrationPath = join(__dirname, '../../migrations/001_initial_schema.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    await sql(migrationSQL);
    
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
