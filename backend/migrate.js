#!/usr/bin/env node

/**
 * Migration script to move data from SQLite to PostgreSQL
 * Usage: node migrate.js
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');

// Only import better-sqlite3 for migration, not as a permanent dependency
let Database;
try {
  Database = require('better-sqlite3');
} catch {
  console.error('❌ better-sqlite3 not found. Install it temporarily: npm install better-sqlite3');
  process.exit(1);
}

const { pool } = require('./db');

const DATA_DIR = path.join(__dirname, 'data');
const SQLITE_DB_PATH = path.join(DATA_DIR, 'workers.db');

async function migrate() {
  if (!fs.existsSync(SQLITE_DB_PATH)) {
    console.log('⚠️  No SQLite database found at', SQLITE_DB_PATH);
    console.log('Starting fresh with PostgreSQL...');
    return;
  }

  console.log('🔄 Starting migration from SQLite to PostgreSQL...');
  
  const db = new Database(SQLITE_DB_PATH);
  
  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Migrate job_titles
      const jobs = db.prepare('SELECT id, name FROM job_titles').all();
      for (const job of jobs) {
        await client.query(
          'INSERT INTO job_titles (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [job.id, job.name]
        );
      }
      console.log(`✓ Migrated ${jobs.length} job titles`);

      // Migrate employment_types
      const empTypes = db.prepare('SELECT id, name FROM employment_types').all();
      for (const type of empTypes) {
        await client.query(
          'INSERT INTO employment_types (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [type.id, type.name]
        );
      }
      console.log(`✓ Migrated ${empTypes.length} employment types`);

      // Migrate honorifics
      const honorifics = db.prepare('SELECT id, name FROM honorifics').all();
      for (const h of honorifics) {
        await client.query(
          'INSERT INTO honorifics (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [h.id, h.name]
        );
      }
      console.log(`✓ Migrated ${honorifics.length} honorifics`);

      // Migrate site_groups
      const siteGroups = db.prepare('SELECT id, name, color, created_at FROM site_groups').all();
      for (const sg of siteGroups) {
        await client.query(
          'INSERT INTO site_groups (id, name, color, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
          [sg.id, sg.name, sg.color, sg.created_at]
        );
      }
      console.log(`✓ Migrated ${siteGroups.length} site groups`);

      // Migrate sites
      const sites = db.prepare('SELECT id, name, description, group_id, created_at FROM sites').all();
      for (const site of sites) {
        await client.query(
          'INSERT INTO sites (id, name, description, group_id, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
          [site.id, site.name, site.description, site.group_id, site.created_at]
        );
      }
      console.log(`✓ Migrated ${sites.length} sites`);

      // Migrate workers
      const workers = db.prepare(
        'SELECT id, honorific_id, first_name, family_name, job_id, employment_type_id, phone, email, notes, id_number, classification, created_at FROM workers'
      ).all();
      for (const worker of workers) {
        await client.query(
          `INSERT INTO workers (id, honorific_id, first_name, family_name, job_id, employment_type_id, phone, email, notes, id_number, classification, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT DO NOTHING`,
          [worker.id, worker.honorific_id, worker.first_name, worker.family_name, worker.job_id, 
           worker.employment_type_id, worker.phone, worker.email, worker.notes, worker.id_number, 
           worker.classification, worker.created_at]
        );
      }
      console.log(`✓ Migrated ${workers.length} workers`);

      // Migrate users
      const users = db.prepare(
        'SELECT id, username, password_hash, email, worker_id, role, must_change_password, reset_token, reset_token_expires, created_at FROM users'
      ).all();
      for (const user of users) {
        await client.query(
          `INSERT INTO users (id, username, password_hash, email, worker_id, role, must_change_password, reset_token, reset_token_expires, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING`,
          [user.id, user.username, user.password_hash, user.email, user.worker_id, user.role, 
           user.must_change_password, user.reset_token, user.reset_token_expires, user.created_at]
        );
      }
      console.log(`✓ Migrated ${users.length} users`);

      // Migrate shift_requests
      const shiftRequests = db.prepare(
        'SELECT id, user_id, date, shift_type, preference_type, created_at FROM shift_requests'
      ).all();
      for (const sr of shiftRequests) {
        await client.query(
          `INSERT INTO shift_requests (id, user_id, date, shift_type, preference_type, created_at)
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
          [sr.id, sr.user_id, sr.date, sr.shift_type, sr.preference_type, sr.created_at]
        );
      }
      console.log(`✓ Migrated ${shiftRequests.length} shift requests`);

      // Migrate worker_site_assignments
      const assignments = db.prepare(
        'SELECT id, worker_id, date, site_id, shift_type, start_time, end_time, notes, created_at FROM worker_site_assignments'
      ).all();
      for (const a of assignments) {
        await client.query(
          `INSERT INTO worker_site_assignments (id, worker_id, date, site_id, shift_type, start_time, end_time, notes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING`,
          [a.id, a.worker_id, a.date, a.site_id, a.shift_type, a.start_time, a.end_time, a.notes, a.created_at]
        );
      }
      console.log(`✓ Migrated ${assignments.length} worker site assignments`);

      // Reset sequences to max ID
      const tables = ['job_titles', 'employment_types', 'honorifics', 'site_groups', 'sites', 'workers', 'users', 'shift_requests', 'worker_site_assignments'];
      for (const table of tables) {
        await client.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT MAX(id) FROM ${table}))`);
      }

      await client.query('COMMIT');
      console.log('\n✅ Migration completed successfully!');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    db.close();
    await pool.end();
  }
}

migrate();
