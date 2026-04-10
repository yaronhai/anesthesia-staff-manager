require('dotenv').config();
const { query } = require('./db');

async function checkDatabase() {
  try {
    // Get all tables
    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('\n📊 Tables in database:\n');
    for (const table of tablesResult.rows) {
      const countResult = await query(`SELECT COUNT(*) FROM ${table.table_name}`);
      console.log(`  • ${table.table_name} (${countResult.rows[0].count} rows)`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkDatabase();
