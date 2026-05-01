const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
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
        name TEXT NOT NULL,
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        UNIQUE(name, branch_id)
      );

      CREATE TABLE IF NOT EXISTS employment_types (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        is_independent BOOLEAN DEFAULT FALSE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS honorifics (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS branches (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
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
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        primary_branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS worker_branches (
        worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        PRIMARY KEY (worker_id, branch_id)
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT,
        worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'user',
        branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
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
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS site_groups (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#667eea',
        group_type TEXT NOT NULL DEFAULT 'regular' CHECK(group_type IN ('regular', 'night', 'oncall')),
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(name, branch_id)
      );

      CREATE TABLE IF NOT EXISTS sites (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        group_id INTEGER REFERENCES site_groups(id) ON DELETE SET NULL,
        branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(name, branch_id)
      );

      CREATE TABLE IF NOT EXISTS worker_site_assignments (
        id SERIAL PRIMARY KEY,
        worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        shift_type TEXT NOT NULL DEFAULT 'morning' CHECK(shift_type IN ('morning', 'evening', 'night', 'oncall')),
        start_time TEXT,
        end_time TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(worker_id, date, site_id, shift_type)
      );

      CREATE TABLE IF NOT EXISTS activity_type_groups (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(name, branch_id)
      );

      CREATE TABLE IF NOT EXISTS activity_types (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        group_id INTEGER REFERENCES activity_type_groups(id) ON DELETE SET NULL,
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(name, branch_id)
      );

      CREATE TABLE IF NOT EXISTS site_shift_activities (
        id SERIAL PRIMARY KEY,
        site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        shift_type TEXT NOT NULL CHECK(shift_type IN ('morning', 'evening', 'night', 'oncall')),
        activity_type_id INTEGER REFERENCES activity_types(id) ON DELETE SET NULL,
        UNIQUE(site_id, date, shift_type)
      );

      CREATE TABLE IF NOT EXISTS worker_activity_authorizations (
        id SERIAL PRIMARY KEY,
        worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        activity_type_id INTEGER NOT NULL REFERENCES activity_types(id) ON DELETE CASCADE,
        UNIQUE(worker_id, activity_type_id)
      );

      CREATE TABLE IF NOT EXISTS activity_template_groups (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(name, branch_id)
      );

      CREATE TABLE IF NOT EXISTS activity_templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        group_id INTEGER REFERENCES activity_template_groups(id) ON DELETE SET NULL,
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(name, branch_id)
      );

      CREATE TABLE IF NOT EXISTS activity_template_items (
        id SERIAL PRIMARY KEY,
        template_id INTEGER NOT NULL REFERENCES activity_templates(id) ON DELETE CASCADE,
        site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        shift_type TEXT NOT NULL CHECK(shift_type IN ('morning', 'evening', 'night', 'oncall')),
        activity_type_id INTEGER NOT NULL REFERENCES activity_types(id) ON DELETE CASCADE,
        UNIQUE(template_id, site_id, shift_type)
      );

      CREATE TABLE IF NOT EXISTS shift_types (
        key TEXT PRIMARY KEY,
        label_he TEXT NOT NULL,
        label_short TEXT NOT NULL DEFAULT '',
        icon TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '',
        bg_color TEXT NOT NULL DEFAULT '',
        show_in_assignments BOOLEAN NOT NULL DEFAULT TRUE,
        show_in_availability_bar BOOLEAN NOT NULL DEFAULT FALSE,
        default_start TEXT,
        default_end TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS preference_types (
        key TEXT PRIMARY KEY,
        label_he TEXT NOT NULL,
        label_group_he TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS fairness_sites (
        site_id INTEGER PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS special_days (
        id SERIAL PRIMARY KEY,
        date TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'holiday' CHECK(type IN ('holiday','eve','other')),
        color TEXT NOT NULL DEFAULT '#6ee7b7',
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        level INTEGER UNIQUE NOT NULL,
        tier TEXT NOT NULL DEFAULT 'user',
        is_protected BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sent_emails (
        id SERIAL PRIMARY KEY,
        schedule_date TEXT NOT NULL,
        worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        recipient_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('sent', 'failed')),
        error_message TEXT,
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        read_at TIMESTAMP,
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS vacation_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE,
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        approved_start TEXT,
        approved_end TEXT,
        reason TEXT,
        admin_notes TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','partial','rejected','cancelled')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        decided_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_workers_id_number ON workers(id_number);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_shift_requests_user_id ON shift_requests(user_id);
      CREATE INDEX IF NOT EXISTS idx_shift_requests_date ON shift_requests(date);
      CREATE INDEX IF NOT EXISTS idx_worker_site_assignments_date ON worker_site_assignments(date);
      CREATE INDEX IF NOT EXISTS idx_site_shift_activities_date ON site_shift_activities(date);
      CREATE INDEX IF NOT EXISTS idx_vacation_requests_user_id ON vacation_requests(user_id);
      CREATE INDEX IF NOT EXISTS idx_vacation_requests_branch_id ON vacation_requests(branch_id);
      CREATE INDEX IF NOT EXISTS idx_vacation_requests_status ON vacation_requests(status);
      CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
    `);
    await query(`
      ALTER TABLE employment_types ADD COLUMN IF NOT EXISTS is_independent BOOLEAN DEFAULT FALSE NOT NULL;
    `);
    await query(`
      ALTER TABLE workers ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
    `);
    // Add branch_id to legacy tables if they exist without it
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;`);
    await query(`ALTER TABLE workers ADD COLUMN IF NOT EXISTS primary_branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;`);
    // Add new columns to shift_types and preference_types for existing DBs
    await query(`ALTER TABLE shift_types ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT '';`);
    await query(`ALTER TABLE shift_types ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '';`);
    await query(`ALTER TABLE shift_types ADD COLUMN IF NOT EXISTS bg_color TEXT NOT NULL DEFAULT '';`);
    await query(`ALTER TABLE shift_types ADD COLUMN IF NOT EXISTS show_in_assignments BOOLEAN NOT NULL DEFAULT TRUE;`);
    await query(`ALTER TABLE shift_types ADD COLUMN IF NOT EXISTS show_in_availability_bar BOOLEAN NOT NULL DEFAULT FALSE;`);
    await query(`ALTER TABLE preference_types ADD COLUMN IF NOT EXISTS label_group_he TEXT NOT NULL DEFAULT '';`);
    await query(`ALTER TABLE preference_types ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '';`);
    await query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='created_at' AND data_type='timestamp without time zone') THEN
          ALTER TABLE messages ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='read_at' AND data_type='timestamp without time zone') THEN
          ALTER TABLE messages ALTER COLUMN read_at TYPE TIMESTAMPTZ USING read_at AT TIME ZONE 'UTC';
        END IF;
      END $$;
    `);
    console.log('✓ Database schema initialized');
  } catch (error) {
    console.error('Error initializing schema:', error);
    throw error;
  }
}

// Initialize site_allowed_jobs table (per-site job restrictions)
async function ensureSiteAllowedJobsTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS site_allowed_jobs (
        id SERIAL PRIMARY KEY,
        site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        job_id INTEGER NOT NULL REFERENCES job_titles(id) ON DELETE CASCADE,
        UNIQUE(site_id, job_id)
      );
    `);
    // Migrate existing per-group restrictions to per-site
    await query(`
      INSERT INTO site_allowed_jobs (site_id, job_id)
      SELECT s.id, sgaj.job_id
      FROM site_group_allowed_jobs sgaj
      JOIN sites s ON s.group_id = sgaj.group_id
      ON CONFLICT DO NOTHING
    `).catch(() => {}); // site_group_allowed_jobs may not exist
    // Drop old per-group table
    await query(`DROP TABLE IF EXISTS site_group_allowed_jobs`);
    console.log('✓ site_allowed_jobs table initialized');
  } catch (error) {
    console.error('Error initializing site_allowed_jobs table:', error);
    throw error;
  }
}

// Migration: move existing data to default branch, fix unique constraints
async function runMigrations() {
  try {
    // 1. Create default branch only if NO branches exist at all
    await query(`
      INSERT INTO branches (name, description)
      SELECT 'ברירת מחדל', 'סניף ברירת מחדל'
      WHERE NOT EXISTS (SELECT 1 FROM branches LIMIT 1)
    `);

    // 1b. Add branch_id columns to existing tables that may not have them
    await query(`ALTER TABLE site_groups ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;`);
    await query(`ALTER TABLE activity_types ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;`);
    await query(`ALTER TABLE activity_types ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES activity_type_groups(id) ON DELETE SET NULL;`);
    await query(`ALTER TABLE activity_templates ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;`);
    await query(`ALTER TABLE shift_requests ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;`);
    await query(`ALTER TABLE sites ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;`);

    // 2. Drop old name-only unique constraints and add composite ones (idempotent)
    await query(`
      DO $$
      BEGIN
        -- site_groups: drop old unique(name), add unique(name, branch_id)
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_groups_name_key') THEN
          ALTER TABLE site_groups DROP CONSTRAINT site_groups_name_key;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_groups_name_branch_id_key') THEN
          ALTER TABLE site_groups ADD CONSTRAINT site_groups_name_branch_id_key UNIQUE (name, branch_id);
        END IF;

        -- sites: drop old unique(name), add unique(name, branch_id)
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sites_name_key') THEN
          ALTER TABLE sites DROP CONSTRAINT sites_name_key;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sites_name_branch_id_key') THEN
          ALTER TABLE sites ADD CONSTRAINT sites_name_branch_id_key UNIQUE (name, branch_id);
        END IF;

        -- activity_types: drop old unique(name), add unique(name, branch_id)
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activity_types_name_key') THEN
          ALTER TABLE activity_types DROP CONSTRAINT activity_types_name_key;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activity_types_name_branch_id_key') THEN
          ALTER TABLE activity_types ADD CONSTRAINT activity_types_name_branch_id_key UNIQUE (name, branch_id);
        END IF;

        -- site_shift_activities.activity_type_id: remove NOT NULL so ON DELETE SET NULL works
        ALTER TABLE site_shift_activities ALTER COLUMN activity_type_id DROP NOT NULL;

        -- activity_templates: drop old unique(name), add unique(name, branch_id)
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activity_templates_name_key') THEN
          ALTER TABLE activity_templates DROP CONSTRAINT activity_templates_name_key;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activity_templates_name_branch_id_key') THEN
          ALTER TABLE activity_templates ADD CONSTRAINT activity_templates_name_branch_id_key UNIQUE (name, branch_id);
        END IF;
      END $$;
    `);

    // 3. Migrate orphaned rows to default branch
    await query(`
      UPDATE site_groups SET branch_id = (SELECT id FROM branches WHERE name = 'ברירת מחדל')
      WHERE branch_id IS NULL
    `);
    // Assign sites to branch via their group, or default branch if ungrouped
    await query(`
      UPDATE sites SET branch_id = sg.branch_id
      FROM site_groups sg
      WHERE sites.group_id = sg.id AND sites.branch_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM sites s2 WHERE s2.name = sites.name AND s2.branch_id = sg.branch_id AND s2.id <> sites.id
        )
    `);
    await query(`
      UPDATE sites SET branch_id = (SELECT id FROM branches WHERE name = 'ברירת מחדל')
      WHERE branch_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM sites s2 WHERE s2.name = sites.name AND s2.branch_id = (SELECT id FROM branches WHERE name = 'ברירת מחדל') AND s2.id <> sites.id
        )
    `);
    await query(`
      UPDATE activity_types SET branch_id = (SELECT id FROM branches WHERE name = 'ברירת מחדל')
      WHERE branch_id IS NULL
    `);
    await query(`
      UPDATE activity_templates SET branch_id = (SELECT id FROM branches WHERE name = 'ברירת מחדל')
      WHERE branch_id IS NULL
    `);

    // 4. Fix shift_requests unique constraint to include branch_id
    await query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shift_requests_user_id_date_shift_type_key') THEN
          ALTER TABLE shift_requests DROP CONSTRAINT shift_requests_user_id_date_shift_type_key;
        END IF;
      END $$;
    `);
    await query(`
      UPDATE shift_requests SET branch_id = (SELECT id FROM branches WHERE name = 'ברירת מחדל')
      WHERE branch_id IS NULL
    `);
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shift_requests_user_id_date_shift_type_branch_id_key') THEN
          ALTER TABLE shift_requests ADD CONSTRAINT shift_requests_user_id_date_shift_type_branch_id_key
            UNIQUE (user_id, date, shift_type, branch_id);
        END IF;
      END $$;
    `);

    // 5. Set primary_branch_id for workers that don't have one yet
    await query(`
      UPDATE workers SET primary_branch_id = (SELECT id FROM branches WHERE name = 'ברירת מחדל')
      WHERE primary_branch_id IS NULL
    `);

    // 6. Create worker_branches entries for workers not yet assigned to default branch
    await query(`
      INSERT INTO worker_branches (worker_id, branch_id, is_active)
      SELECT w.id, b.id, w.is_active
      FROM workers w
      CROSS JOIN branches b
      WHERE b.name = 'ברירת מחדל'
        AND NOT EXISTS (
          SELECT 1 FROM worker_branches wb WHERE wb.worker_id = w.id AND wb.branch_id = b.id
        )
    `);

    // 6. Assign existing admin users to default branch if not yet assigned
    await query(`
      UPDATE users SET branch_id = (SELECT id FROM branches WHERE name = 'ברירת מחדל')
      WHERE role = 'admin' AND branch_id IS NULL
    `);

    // 7. Remove and delete "ברירת מחדל" branch if other branches exist
    await query(`
      DO $$
      DECLARE default_id INTEGER;
      BEGIN
        SELECT id INTO default_id FROM branches WHERE name = 'ברירת מחדל';
        IF default_id IS NOT NULL AND (SELECT COUNT(*) FROM branches WHERE id <> default_id) > 0 THEN
          DELETE FROM worker_branches WHERE branch_id = default_id;
          UPDATE workers SET primary_branch_id = NULL WHERE primary_branch_id = default_id;
          UPDATE users SET branch_id = NULL WHERE branch_id = default_id;
          UPDATE site_groups SET branch_id = NULL WHERE branch_id = default_id;
          UPDATE sites SET branch_id = NULL WHERE branch_id = default_id;
          UPDATE activity_types SET branch_id = NULL WHERE branch_id = default_id;
          UPDATE activity_templates SET branch_id = NULL WHERE branch_id = default_id;
          UPDATE shift_requests SET branch_id = NULL WHERE branch_id = default_id;
          DELETE FROM branches WHERE id = default_id;
        END IF;
      END $$;
    `);

    await query(`ALTER TABLE site_groups ADD COLUMN IF NOT EXISTS group_type TEXT NOT NULL DEFAULT 'regular'`);
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'site_groups_group_type_check'
        ) THEN
          ALTER TABLE site_groups ADD CONSTRAINT site_groups_group_type_check CHECK(group_type IN ('regular','night','oncall'));
        END IF;
      END $$
    `);

    await query(`ALTER TABLE workers ADD COLUMN IF NOT EXISTS can_submit_requests BOOLEAN NOT NULL DEFAULT TRUE;`);

    await query(`ALTER TABLE special_days ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'holiday';`);

    await query(`
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN
          SELECT c.conname FROM pg_constraint c
          JOIN pg_class t ON c.conrelid = t.oid
          WHERE t.relname = 'special_days' AND c.contype = 'c'
        LOOP
          EXECUTE format('ALTER TABLE special_days DROP CONSTRAINT IF EXISTS %I', r.conname);
        END LOOP;
      END $$
    `);
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'special_days_type_check') THEN
          ALTER TABLE special_days ADD CONSTRAINT special_days_type_check CHECK(type IN ('holiday','eve','other'));
        END IF;
      END $$
    `);

    // Expand shift_type CHECK constraints to include 'oncall'
    await query(`
      DO $$
      DECLARE r RECORD; needs_update BOOLEAN;
      BEGIN
        SELECT NOT (pg_get_constraintdef(c.oid) LIKE '%oncall%') INTO needs_update
          FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
          WHERE t.relname = 'worker_site_assignments' AND c.contype = 'c'
            AND pg_get_constraintdef(c.oid) LIKE '%shift_type%'
          LIMIT 1;
        IF needs_update IS NULL OR needs_update THEN
          FOR r IN
            SELECT c.conname FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'worker_site_assignments' AND c.contype = 'c'
              AND pg_get_constraintdef(c.oid) LIKE '%shift_type%'
          LOOP
            EXECUTE format('ALTER TABLE worker_site_assignments DROP CONSTRAINT IF EXISTS %I', r.conname);
          END LOOP;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
              WHERE t.relname = 'worker_site_assignments' AND c.conname = 'worker_site_assignments_shift_type_check') THEN
            ALTER TABLE worker_site_assignments ADD CONSTRAINT worker_site_assignments_shift_type_check CHECK(shift_type IN ('morning','evening','night','oncall'));
          END IF;
        END IF;
      END $$
    `);

    await query(`
      DO $$
      DECLARE r RECORD; needs_update BOOLEAN;
      BEGIN
        SELECT NOT (pg_get_constraintdef(c.oid) LIKE '%oncall%') INTO needs_update
          FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
          WHERE t.relname = 'site_shift_activities' AND c.contype = 'c'
            AND pg_get_constraintdef(c.oid) LIKE '%shift_type%'
          LIMIT 1;
        IF needs_update IS NULL OR needs_update THEN
          FOR r IN
            SELECT c.conname FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'site_shift_activities' AND c.contype = 'c'
              AND pg_get_constraintdef(c.oid) LIKE '%shift_type%'
          LOOP
            EXECUTE format('ALTER TABLE site_shift_activities DROP CONSTRAINT IF EXISTS %I', r.conname);
          END LOOP;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
              WHERE t.relname = 'site_shift_activities' AND c.conname = 'site_shift_activities_shift_type_check') THEN
            ALTER TABLE site_shift_activities ADD CONSTRAINT site_shift_activities_shift_type_check CHECK(shift_type IN ('morning','evening','night','oncall'));
          END IF;
        END IF;
      END $$
    `);

    await query(`
      DO $$
      DECLARE r RECORD; needs_update BOOLEAN;
      BEGIN
        SELECT NOT (pg_get_constraintdef(c.oid) LIKE '%oncall%') INTO needs_update
          FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
          WHERE t.relname = 'activity_template_items' AND c.contype = 'c'
            AND pg_get_constraintdef(c.oid) LIKE '%shift_type%'
          LIMIT 1;
        IF needs_update IS NULL OR needs_update THEN
          FOR r IN
            SELECT c.conname FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'activity_template_items' AND c.contype = 'c'
              AND pg_get_constraintdef(c.oid) LIKE '%shift_type%'
          LOOP
            EXECUTE format('ALTER TABLE activity_template_items DROP CONSTRAINT IF EXISTS %I', r.conname);
          END LOOP;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
              WHERE t.relname = 'activity_template_items' AND c.conname = 'activity_template_items_shift_type_check') THEN
            ALTER TABLE activity_template_items ADD CONSTRAINT activity_template_items_shift_type_check CHECK(shift_type IN ('morning','evening','night','oncall'));
          END IF;
        END IF;
      END $$
    `);

    await query(`ALTER TABLE activity_templates ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES activity_template_groups(id) ON DELETE SET NULL`);

    // Migrate job_titles to be branch-scoped
    await query(`ALTER TABLE job_titles ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE`);
    await query(`UPDATE job_titles SET branch_id = (SELECT id FROM branches ORDER BY id LIMIT 1) WHERE branch_id IS NULL`);
    await query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
          WHERE t.relname = 'job_titles' AND c.conname = 'job_titles_name_key'
        ) THEN
          ALTER TABLE job_titles DROP CONSTRAINT job_titles_name_key;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
          WHERE t.relname = 'job_titles' AND c.conname = 'job_titles_name_branch_id_key'
        ) THEN
          ALTER TABLE job_titles ADD CONSTRAINT job_titles_name_branch_id_key UNIQUE(name, branch_id);
        END IF;
      END $$
    `);
    // Deduplicate job_titles: keep lowest id per (name, branch_id)
    await query(`
      DELETE FROM job_titles a
      USING job_titles b
      WHERE a.id > b.id
      AND a.name = b.name
      AND a.branch_id IS NOT DISTINCT FROM b.branch_id
    `);

    // Seed default job titles for every branch
    await query(`
      INSERT INTO job_titles (name, branch_id)
      SELECT bp.name, b.id
      FROM branches b
      CROSS JOIN (VALUES ('רופא מרדים'), ('עוזר מרדים'), ('מנהל מחלקה')) AS bp(name)
      ON CONFLICT DO NOTHING
    `);

    // Seed role hierarchy levels
    await query(`
      INSERT INTO roles (name, display_name, level, tier, is_protected)
      VALUES
        ('superadmin', 'מנהל ראשי', 100, 'superadmin', TRUE),
        ('admin',      'מנהל סניף', 200, 'admin',      TRUE),
        ('user',       'משתמש',     300, 'user',       TRUE)
      ON CONFLICT (name) DO NOTHING
    `);

    console.log('✓ Migrations complete');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  }
}

module.exports = {
  query,
  pool,
  initializeSchema,
  ensureSiteAllowedJobsTable,
  runMigrations,
};
