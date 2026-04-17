const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Query helper
async function query(text, params) {
  return pool.query(text, params);
}

// Initialize schema
async function initializeSchema() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS job_titles (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS employment_types (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS honorifics (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS workers (
        id SERIAL PRIMARY KEY,
        honorific_id INTEGER REFERENCES honorifics(id) ON DELETE SET NULL,
        first_name TEXT NOT NULL,
        family_name TEXT NOT NULL,
        job_id INTEGER REFERENCES job_titles(id) ON DELETE SET NULL,
        employment_type_id INTEGER REFERENCES employment_types(id) ON DELETE SET NULL,
        phone TEXT,
        email TEXT NOT NULL DEFAULT '',
        notes TEXT,
        id_number TEXT UNIQUE,
        classification TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT,
        worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'user',
        must_change_password INTEGER NOT NULL DEFAULT 1,
        reset_token TEXT,
        reset_token_expires TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS shift_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        shift_type TEXT NOT NULL CHECK(shift_type IN ('morning', 'evening', 'night', 'oncall')),
        preference_type TEXT NOT NULL DEFAULT 'can' CHECK(preference_type IN ('can', 'prefer', 'cannot')),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, date, shift_type)
      );

      CREATE TABLE IF NOT EXISTS site_groups (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT DEFAULT '#667eea',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sites (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        group_id INTEGER REFERENCES site_groups(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS worker_site_assignments (
        id SERIAL PRIMARY KEY,
        worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        shift_type TEXT NOT NULL DEFAULT 'morning' CHECK(shift_type IN ('morning', 'evening', 'night')),
        start_time TEXT,
        end_time TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(worker_id, date, site_id, shift_type)
      );

      CREATE TABLE IF NOT EXISTS activity_types (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS site_shift_activities (
        id SERIAL PRIMARY KEY,
        site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        shift_type TEXT NOT NULL CHECK(shift_type IN ('morning', 'evening', 'night')),
        activity_type_id INTEGER NOT NULL REFERENCES activity_types(id) ON DELETE SET NULL,
        UNIQUE(site_id, date, shift_type)
      );

      CREATE TABLE IF NOT EXISTS worker_activity_authorizations (
        id SERIAL PRIMARY KEY,
        worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        activity_type_id INTEGER NOT NULL REFERENCES activity_types(id) ON DELETE CASCADE,
        UNIQUE(worker_id, activity_type_id)
      );

      CREATE TABLE IF NOT EXISTS activity_templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS activity_template_items (
        id SERIAL PRIMARY KEY,
        template_id INTEGER NOT NULL REFERENCES activity_templates(id) ON DELETE CASCADE,
        site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        shift_type TEXT NOT NULL CHECK(shift_type IN ('morning', 'evening', 'night')),
        activity_type_id INTEGER NOT NULL REFERENCES activity_types(id) ON DELETE CASCADE,
        UNIQUE(template_id, site_id, shift_type)
      );

      CREATE TABLE IF NOT EXISTS site_group_allowed_jobs (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES site_groups(id) ON DELETE CASCADE,
        job_id INTEGER NOT NULL REFERENCES job_titles(id) ON DELETE CASCADE,
        UNIQUE(group_id, job_id)
      );

      CREATE INDEX IF NOT EXISTS idx_workers_id_number ON workers(id_number);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_shift_requests_user_id ON shift_requests(user_id);
      CREATE INDEX IF NOT EXISTS idx_shift_requests_date ON shift_requests(date);
      CREATE INDEX IF NOT EXISTS idx_worker_site_assignments_date ON worker_site_assignments(date);
      CREATE INDEX IF NOT EXISTS idx_site_shift_activities_date ON site_shift_activities(date);
    `);
    console.log('✓ Database schema initialized');
  } catch (error) {
    console.error('Error initializing schema:', error);
    throw error;
  }
}

module.exports = {
  query,
  pool,
  initializeSchema,
};
