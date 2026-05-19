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
        personal_email TEXT NOT NULL DEFAULT '',
        birth_date DATE,
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
        admin_modified BOOLEAN NOT NULL DEFAULT FALSE,
        worker_original_pref TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS permanent_shift_templates (
        id SERIAL PRIMARY KEY,
        worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        start_date TEXT NOT NULL,
        end_date TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(worker_id, branch_id)
      );

      CREATE TABLE IF NOT EXISTS permanent_shift_entries (
        id SERIAL PRIMARY KEY,
        template_id INTEGER NOT NULL REFERENCES permanent_shift_templates(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
        shift_type TEXT NOT NULL,
        preference_type TEXT NOT NULL CHECK(preference_type IN ('can','prefer','cannot')),
        UNIQUE(template_id, day_of_week, shift_type)
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
        file_url TEXT,
        file_name TEXT,
        file_type TEXT,
        file_size INTEGER,
        link_url TEXT,
        link_title TEXT,
        link_image TEXT,
        link_description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS group_messages (
        id         SERIAL PRIMARY KEY,
        branch_id  INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
        sender_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content    TEXT NOT NULL,
        file_url   TEXT,
        file_name  TEXT,
        file_type  TEXT,
        file_size  INTEGER,
        link_url         TEXT,
        link_title       TEXT,
        link_image       TEXT,
        link_description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_group_messages_branch ON group_messages(branch_id, created_at DESC);

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

      CREATE TABLE IF NOT EXISTS event_types (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        UNIQUE(name, branch_id)
      );

      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        event_type_id INTEGER REFERENCES event_types(id) ON DELETE SET NULL,
        description TEXT,
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS event_sessions (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        session_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        max_capacity INTEGER NOT NULL DEFAULT 20,
        location TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS event_invitees (
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        PRIMARY KEY (event_id, worker_id)
      );

      CREATE TABLE IF NOT EXISTS event_session_assignments (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES event_sessions(id) ON DELETE CASCADE,
        worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        assigned_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(session_id, worker_id)
      );

      CREATE TABLE IF NOT EXISTS site_coverage_requests (
        id SERIAL PRIMARY KEY,
        original_assignment_id INTEGER NOT NULL REFERENCES worker_site_assignments(id) ON DELETE CASCADE,
        coverage_worker_id INTEGER REFERENCES workers(id) ON DELETE SET NULL,
        event_session_id INTEGER NOT NULL REFERENCES event_sessions(id) ON DELETE CASCADE,
        coverage_from_time TEXT NOT NULL,
        coverage_to_time TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'approved', 'rejected')),
        branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        approved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(original_assignment_id, event_session_id)
      );

      CREATE TABLE IF NOT EXISTS invitee_templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        worker_ids INTEGER[] NOT NULL DEFAULT '{}',
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS profile_change_requests (
        id SERIAL PRIMARY KEY,
        worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        requested_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
        honorific_id INTEGER REFERENCES honorifics(id) ON DELETE SET NULL,
        first_name TEXT,
        family_name TEXT,
        phone TEXT,
        personal_email TEXT,
        birth_date TEXT,
        photo_url TEXT,
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        decided_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS branch_settings (
        id SERIAL PRIMARY KEY,
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        lock_mode TEXT NOT NULL DEFAULT 'monthly',
        lock_day_of_month INTEGER NOT NULL DEFAULT 20,
        lock_day_of_week INTEGER NOT NULL DEFAULT 2,
        lock_override_until DATE,
        UNIQUE(branch_id)
      );

      CREATE TABLE IF NOT EXISTS worker_lock_overrides (
        id SERIAL PRIMARY KEY,
        worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        override_until DATE NOT NULL,
        UNIQUE(worker_id, branch_id)
      );

      CREATE INDEX IF NOT EXISTS idx_profile_change_requests_worker ON profile_change_requests(worker_id);
      CREATE INDEX IF NOT EXISTS idx_profile_change_requests_status ON profile_change_requests(status);

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

      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(endpoint)
      );

      CREATE TABLE IF NOT EXISTS user_column_preferences (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        name_format VARCHAR(20) NOT NULL DEFAULT 'family_first',
        column_order JSONB NOT NULL DEFAULT '["title","name","id_number","classification","job","employment_type","phone","email","personal_email"]'
      );
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
    await query(`ALTER TABLE shift_requests ADD COLUMN IF NOT EXISTS admin_modified BOOLEAN NOT NULL DEFAULT FALSE;`);
    await query(`ALTER TABLE shift_requests ADD COLUMN IF NOT EXISTS worker_original_pref TEXT;`);
    // Ensure each branch has תורנים/כוננים activity type groups and base activity types
    const branchRows = (await query('SELECT id FROM branches')).rows;
    for (const b of branchRows) {
      for (const [groupName, typeName] of [['תורנים', 'תורן'], ['כוננים', 'כונן']]) {
        await query(`INSERT INTO activity_type_groups (name, branch_id) VALUES ($1, $2) ON CONFLICT(name, branch_id) DO NOTHING`, [groupName, b.id]);
        const grp = await query(`SELECT id FROM activity_type_groups WHERE name = $1 AND branch_id = $2`, [groupName, b.id]);
        if (grp.rows.length > 0) {
          await query(`INSERT INTO activity_types (name, group_id, branch_id) VALUES ($1, $2, $3) ON CONFLICT(name, branch_id) DO NOTHING`, [typeName, grp.rows[0].id, b.id]);
        }
      }
    }
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
    await query(`
      ALTER TABLE profile_change_requests
        ADD COLUMN IF NOT EXISTS orig_first_name    TEXT,
        ADD COLUMN IF NOT EXISTS orig_family_name   TEXT,
        ADD COLUMN IF NOT EXISTS orig_phone         TEXT,
        ADD COLUMN IF NOT EXISTS orig_personal_email TEXT,
        ADD COLUMN IF NOT EXISTS orig_birth_date    TEXT,
        ADD COLUMN IF NOT EXISTS orig_honorific_id  INTEGER
    `);
    await query(`ALTER TABLE event_sessions ADD COLUMN IF NOT EXISTS participant_pct INTEGER`);
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
    await query(`ALTER TABLE workers ADD COLUMN IF NOT EXISTS personal_email TEXT NOT NULL DEFAULT '';`);
    await query(`ALTER TABLE workers ADD COLUMN IF NOT EXISTS birth_date DATE;`);

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
        ('master',     'מנהל מערכת', 1,   'master',     TRUE),
        ('superadmin', 'מנהל ראשי',  100, 'superadmin', TRUE),
        ('admin',      'מנהל סניף',  200, 'admin',      TRUE),
        ('user',       'משתמש',      300, 'user',       TRUE)
      ON CONFLICT (name) DO NOTHING
    `);
    // Ensure the bootstrap admin user always has master role
    await query(`UPDATE users SET role='master' WHERE username=$1 AND role != 'master'`, [process.env.ADMIN_USERNAME || 'admin']);

    // Seed תורנים/כוננים site groups for every branch
    await query(`
      INSERT INTO site_groups (name, color, group_type, branch_id)
      SELECT bp.name, bp.color, bp.gtype, b.id
      FROM branches b
      CROSS JOIN (VALUES
        ('תורנים', '#f59e0b', 'night'),
        ('כוננים', '#8b5cf6', 'oncall')
      ) AS bp(name, color, gtype)
      WHERE NOT EXISTS (
        SELECT 1 FROM site_groups sg WHERE sg.name = bp.name AND sg.branch_id = b.id
      )
    `);

    // Add complexity_level to activity_types for overqualification scoring
    await query(`ALTER TABLE activity_types ADD COLUMN IF NOT EXISTS complexity_level INTEGER NOT NULL DEFAULT 1`);
    await query(`ALTER TABLE workers ADD COLUMN IF NOT EXISTS photo_url TEXT`);
    await query(`ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS lock_override_from DATE`);

    await query(`
      CREATE TABLE IF NOT EXISTS group_messages (
        id         SERIAL PRIMARY KEY,
        branch_id  INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
        sender_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content    TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_group_messages_branch ON group_messages(branch_id, created_at DESC)`);

    await query(`
      ALTER TABLE messages
        ADD COLUMN IF NOT EXISTS file_url  TEXT,
        ADD COLUMN IF NOT EXISTS file_name TEXT,
        ADD COLUMN IF NOT EXISTS file_type TEXT,
        ADD COLUMN IF NOT EXISTS file_size INTEGER,
        ADD COLUMN IF NOT EXISTS link_url         TEXT,
        ADD COLUMN IF NOT EXISTS link_title       TEXT,
        ADD COLUMN IF NOT EXISTS link_image       TEXT,
        ADD COLUMN IF NOT EXISTS link_description TEXT
    `);
    await query(`
      ALTER TABLE group_messages
        ADD COLUMN IF NOT EXISTS file_url  TEXT,
        ADD COLUMN IF NOT EXISTS file_name TEXT,
        ADD COLUMN IF NOT EXISTS file_type TEXT,
        ADD COLUMN IF NOT EXISTS file_size INTEGER,
        ADD COLUMN IF NOT EXISTS link_url         TEXT,
        ADD COLUMN IF NOT EXISTS link_title       TEXT,
        ADD COLUMN IF NOT EXISTS link_image       TEXT,
        ADD COLUMN IF NOT EXISTS link_description TEXT
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(endpoint)
      )
    `);

    await query(`ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'general'`);

    await query(`ALTER TABLE admin_chat_members DROP COLUMN IF EXISTS branch_id`);
    await query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_chat_members_user_id_branch_id_key') THEN
          ALTER TABLE admin_chat_members DROP CONSTRAINT admin_chat_members_user_id_branch_id_key;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_chat_members_user_id_key') THEN
          ALTER TABLE admin_chat_members ADD CONSTRAINT admin_chat_members_user_id_key UNIQUE (user_id);
        END IF;
      END $$
    `);
    await query(`
      INSERT INTO admin_chat_members (user_id, added_by)
      SELECT u.id, u.id
      FROM users u JOIN roles r ON r.name = u.role
      WHERE r.tier IN ('superadmin')
      ON CONFLICT (user_id) DO NOTHING
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_group_messages_channel ON group_messages(branch_id, channel, created_at DESC)`);
    await query(`
      DELETE FROM admin_chat_members
      WHERE user_id IN (
        SELECT u.id FROM users u JOIN roles r ON r.name = u.role WHERE r.tier = 'admin'
      )
      AND added_by = user_id
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS admin_chat_members (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        added_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS admin_group_messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        file_url TEXT,
        file_name TEXT,
        file_type TEXT,
        file_size INTEGER,
        link_url TEXT,
        link_title TEXT,
        link_image TEXT,
        link_description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_admin_group_messages_time ON admin_group_messages(created_at DESC)`);
    await query(`ALTER TABLE admin_group_messages ADD COLUMN IF NOT EXISTS file_url TEXT`);
    await query(`ALTER TABLE admin_group_messages ADD COLUMN IF NOT EXISTS file_name TEXT`);
    await query(`ALTER TABLE admin_group_messages ADD COLUMN IF NOT EXISTS file_type TEXT`);
    await query(`ALTER TABLE admin_group_messages ADD COLUMN IF NOT EXISTS file_size INTEGER`);
    await query(`ALTER TABLE admin_group_messages ADD COLUMN IF NOT EXISTS link_url TEXT`);
    await query(`ALTER TABLE admin_group_messages ADD COLUMN IF NOT EXISTS link_title TEXT`);
    await query(`ALTER TABLE admin_group_messages ADD COLUMN IF NOT EXISTS link_image TEXT`);
    await query(`ALTER TABLE admin_group_messages ADD COLUMN IF NOT EXISTS link_description TEXT`);

    await query(`ALTER TABLE user_column_preferences ADD COLUMN IF NOT EXISTS hidden_columns JSONB NOT NULL DEFAULT '[]'`);

    await query(`ALTER TABLE worker_activity_authorizations ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5)`);

    // Shift approval requests feature
    await query(`
      CREATE TABLE IF NOT EXISTS shift_approval_requests (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER NOT NULL REFERENCES users(id),
        worker_id INTEGER NOT NULL REFERENCES users(id),
        shift_request_id INTEGER REFERENCES shift_requests(id) ON DELETE SET NULL,
        date TEXT NOT NULL,
        shift_type TEXT NOT NULL,
        old_preference TEXT,
        new_preference TEXT NOT NULL,
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK(status IN ('pending','approved','rejected','cancelled')),
        message_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        responded_at TIMESTAMP
      )
    `);
    await query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text'`);
    await query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS approval_request_id INTEGER REFERENCES shift_approval_requests(id) ON DELETE SET NULL`);
    await query(`ALTER TABLE shift_requests ADD COLUMN IF NOT EXISTS pending_approval_id INTEGER REFERENCES shift_approval_requests(id) ON DELETE SET NULL`);

    // Multi-activity per shift: drop old single-activity unique constraint, add sort_order/start_time
    await query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_shift_activities_site_id_date_shift_type_key') THEN
          ALTER TABLE site_shift_activities DROP CONSTRAINT site_shift_activities_site_id_date_shift_type_key;
        END IF;
      END $$
    `);
    await query(`ALTER TABLE site_shift_activities ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`);
    await query(`ALTER TABLE site_shift_activities ADD COLUMN IF NOT EXISTS start_time TEXT`);
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS ssa_site_date_shift_activity ON site_shift_activities(site_id, date, shift_type, activity_type_id) WHERE activity_type_id IS NOT NULL`);

    // Per-activity worker assignments: add end_time to activities, link assignments to activity
    await query(`ALTER TABLE site_shift_activities ADD COLUMN IF NOT EXISTS end_time TEXT`);
    await query(`ALTER TABLE worker_site_assignments ADD COLUMN IF NOT EXISTS site_shift_activity_id INTEGER REFERENCES site_shift_activities(id) ON DELETE SET NULL`);
    // Drop old unique constraint (worker_id, date, site_id, shift_type) — allow multiple rows per shift (one per activity)
    await query(`
      DO $$ DECLARE r RECORD; BEGIN
        FOR r IN
          SELECT c.conname FROM pg_constraint c
          JOIN pg_class t ON c.conrelid = t.oid
          WHERE t.relname = 'worker_site_assignments' AND c.contype = 'u'
            AND pg_get_constraintdef(c.oid) LIKE '%worker_id%'
            AND pg_get_constraintdef(c.oid) LIKE '%site_id%'
            AND pg_get_constraintdef(c.oid) NOT LIKE '%site_shift_activity%'
        LOOP
          EXECUTE format('ALTER TABLE worker_site_assignments DROP CONSTRAINT %I', r.conname);
        END LOOP;
      END $$
    `);
    await query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wsa_unique_per_activity') THEN
          ALTER TABLE worker_site_assignments ADD CONSTRAINT wsa_unique_per_activity
            UNIQUE(worker_id, date, site_id, shift_type, site_shift_activity_id);
        END IF;
      END $$
    `);

    // Activity template items: support multiple activities per shift
    await query(`ALTER TABLE activity_template_items ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`);
    await query(`
      DO $$ DECLARE r RECORD; BEGIN
        FOR r IN
          SELECT c.conname FROM pg_constraint c
          JOIN pg_class t ON c.conrelid = t.oid
          WHERE t.relname = 'activity_template_items' AND c.contype = 'u'
            AND pg_get_constraintdef(c.oid) LIKE '%template_id%'
            AND pg_get_constraintdef(c.oid) NOT LIKE '%activity_type_id%'
        LOOP
          EXECUTE format('ALTER TABLE activity_template_items DROP CONSTRAINT %I', r.conname);
        END LOOP;
      END $$
    `);
    await query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ati_unique_per_activity') THEN
          ALTER TABLE activity_template_items ADD CONSTRAINT ati_unique_per_activity
            UNIQUE(template_id, site_id, shift_type, activity_type_id);
        END IF;
      END $$
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
