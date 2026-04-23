require('dotenv').config();
const { Client } = require('pg');

async function createDatabase() {
  const client = process.env.DATABASE_URL
    ? new Client({ connectionString: process.env.DATABASE_URL })
    : new Client({
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: 'postgres',
      });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL...');

    // Check if database exists
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'anesthesia_workers'"
    );

    if (result.rows.length === 0) {
      console.log('Creating database anesthesia_workers...');
      await client.query('CREATE DATABASE anesthesia_workers');
      console.log('✓ Database created successfully');
    } else {
      console.log('✓ Database already exists');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

createDatabase();
