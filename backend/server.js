require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const { query, pool, initializeSchema, ensureSiteGroupAllowedJobsTable, runMigrations } = require('./db');

const app = express();
app.disable('etag');
app.use(cors());
app.use(express.json());

const FRONTEND_DIST = require('path').join(__dirname, '../frontend/dist');
if (require('fs').existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(require('path').join(FRONTEND_DIST, 'index.html'));
  });
}

const { jobTitles, empTypes, honorifics, groupColors, sites, shiftTypes, preferenceTypes } = require('./seed-data');

// ── Database Initialization ─────────────────────────────────────────────────

async function seedDatabase() {
  try {
    // Seed job titles
    for (const name of jobTitles) {
      await query('INSERT INTO job_titles (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
    }

    // Seed employment types
    for (const et of empTypes) {
      await query(
        `INSERT INTO employment_types (name, is_independent) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET is_independent = EXCLUDED.is_independent`,
        [et.name, et.is_independent]
      );
    }

    // Seed honorifics
    for (const name of honorifics) {
      await query('INSERT INTO honorifics (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
    }

    // Seed site groups with colors (scoped to default branch)
    const defaultBranchRes = await query("SELECT id FROM branches WHERE name = 'ברירת מחדל'");
    const defaultBranchId = defaultBranchRes.rows[0]?.id;
    if (defaultBranchId) {
      for (const [name, color] of Object.entries(groupColors)) {
        await query(
          'INSERT INTO site_groups (name, color, branch_id) VALUES ($1, $2, $3) ON CONFLICT (name, branch_id) DO NOTHING',
          [name, color, defaultBranchId]
        );
      }
    }

    // Seed sites (resolve group name → id at runtime)
    const groupIdCache = {};
    for (const site of sites) {
      if (!groupIdCache[site.groupName]) {
        const res = await query('SELECT id FROM site_groups WHERE name = $1 AND branch_id = $2', [site.groupName, defaultBranchId]);
        groupIdCache[site.groupName] = res.rows[0]?.id;
      }
      await query('INSERT INTO sites (name, group_id, branch_id) VALUES ($1, $2, $3) ON CONFLICT (name, branch_id) DO NOTHING',
        [site.name, groupIdCache[site.groupName], defaultBranchId]);
    }

    // Seed shift types
    for (const st of shiftTypes) {
      await query(
        `INSERT INTO shift_types (key, label_he, label_short, icon, color, bg_color, show_in_assignments, show_in_availability_bar, default_start, default_end, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (key) DO UPDATE SET
           label_he = EXCLUDED.label_he, label_short = EXCLUDED.label_short,
           icon = EXCLUDED.icon, color = EXCLUDED.color, bg_color = EXCLUDED.bg_color,
           show_in_assignments = EXCLUDED.show_in_assignments,
           show_in_availability_bar = EXCLUDED.show_in_availability_bar,
           default_start = EXCLUDED.default_start,
           default_end = EXCLUDED.default_end,
           sort_order = EXCLUDED.sort_order`,
        [st.key, st.label_he, st.label_short, st.icon, st.color, st.bg_color,
         st.show_in_assignments, st.show_in_availability_bar,
         st.default_start, st.default_end, st.sort_order]
      );
    }

    // Seed preference types
    for (const pt of preferenceTypes) {
      await query(
        `INSERT INTO preference_types (key, label_he, label_group_he, color, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (key) DO UPDATE SET
           label_he = EXCLUDED.label_he, label_group_he = EXCLUDED.label_group_he,
           color = EXCLUDED.color, sort_order = EXCLUDED.sort_order`,
        [pt.key, pt.label_he, pt.label_group_he, pt.color, pt.sort_order]
      );
    }

    // Bootstrap admin user
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminCheck = await query('SELECT COUNT(*) as c FROM users WHERE username = $1', [adminUsername]);
    if (parseInt(adminCheck.rows[0].c) === 0) {
      const defBranch = await query("SELECT id FROM branches WHERE name = 'ברירת מחדל'");
      const defBranchId = defBranch.rows[0]?.id || null;
      await query(
        'INSERT INTO users (username, password_hash, role, must_change_password, branch_id) VALUES ($1, $2, $3, $4, $5)',
        [adminUsername, bcrypt.hashSync(adminPassword, 8), 'admin', 0, defBranchId]
      );
    }

    // Bootstrap system user for schedule messages
    const sidurCheck = await query("SELECT id FROM users WHERE username = 'system_sidur'");
    if (sidurCheck.rows.length === 0) {
      await query(
        "INSERT INTO users (username, password_hash, role, must_change_password) VALUES ('system_sidur', $1, 'system', 0)",
        [bcrypt.hashSync('disabled_' + Date.now(), 10)]
      );
    }

    console.log('✓ Database seeded');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

// ── Initialize app ──────────────────────────────────────────────────────────

async function initializeApp() {
  try {
    await initializeSchema();
    await ensureSiteGroupAllowedJobsTable();
    await runMigrations();
    await seedDatabase();
    console.log('✓ App initialized');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    process.exit(1);
  }
}

// ── Email transporter ────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── Vacation Request Email Helper ───────────────────────────────────────────

function formatDateHe(d) {
  if (!d) return '';
  const [y, m, dd] = d.split('-');
  return `${dd}.${m}.${y}`;
}

function buildVacationDecisionEmail(decision, workerName, vr, approvedStart, approvedEnd, adminNotes) {
  const origRange = `${formatDateHe(vr.start_date)} – ${formatDateHe(vr.end_date)}`;
  const apprRange = `${formatDateHe(approvedStart)} – ${formatDateHe(approvedEnd)}`;
  const color = decision === 'approved' ? '#16a34a' : decision === 'rejected' ? '#dc2626' : '#d97706';
  const title = decision === 'approved' ? 'בקשת החופשה שלך אושרה'
              : decision === 'rejected' ? 'בקשת החופשה שלך נדחתה'
              : 'בקשת החופשה שלך אושרה חלקית';
  const body = decision === 'approved'
    ? `<p>בקשתך לתאריכים <strong>${origRange}</strong> אושרה במלואה.</p>`
    : decision === 'rejected'
    ? `<p>בקשתך לתאריכים <strong>${origRange}</strong> נדחתה.</p>`
    : `<p>בקשתך לתאריכים <strong>${origRange}</strong> אושרה חלקית.</p>
       <p>התאריכים המאושרים: <strong>${apprRange}</strong></p>`;
  const notes = adminNotes
    ? `<p style="padding:10px;background:#f1f5f9;border-radius:6px;font-size:13px"><strong>הערות מנהל:</strong> ${adminNotes}</p>`
    : '';
  return `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:500px">
    <h2 style="color:${color}">${title}</h2>
    <p>שלום ${workerName},</p>${body}${notes}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>
    <p style="color:#6b7280;font-size:12px">מחלקת הרדמה — מערכת ניהול צוות</p>
  </div>`;
}

// ── Auth helpers ────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || 'anesthesia-dept-2024-secret-key';

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'נדרשת התחברות' });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'טוקן לא תקין' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'אין הרשאה' });
    }
    next();
  });
}

function requireSuperAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'נדרשת הרשאת מנהל-על' });
    }
    next();
  });
}

function getEffectiveBranchId(req) {
  if (req.user.role === 'superadmin') {
    return req.query.branch_id ? parseInt(req.query.branch_id) : null;
  }
  if (req.user.role === 'admin') {
    return req.user.branch_id ?? null;
  }
  // regular user
  const b = req.query.branch_id || req.body?.branch_id;
  return b ? parseInt(b) : null;
}

// ── Worker ↔ User sync helpers ───────────────────────────────────────────────

async function createUserForWorker(worker_id, id_number, classification, email) {
  if (!id_number) return;
  const hash = bcrypt.hashSync(id_number, 8);
  try {
    await query(
      'INSERT INTO users (username, password_hash, worker_id, role, must_change_password, email) VALUES ($1, $2, $3, $4, $5, $6)',
      [id_number, hash, worker_id, classification, 1, email || null]
    );
  } catch {}
}

async function syncUserForWorker(worker_id, id_number, classification, email) {
  if (!id_number) return;
  const userRes = await query('SELECT id FROM users WHERE worker_id = $1', [worker_id]);
  const user = userRes.rows[0];
  if (user) {
    await query('UPDATE users SET username = $1, role = $2, email = $3 WHERE id = $4',
      [id_number, classification, email || null, user.id]);
  } else {
    // User not linked by worker_id — check if username already exists
    const existingRes = await query('SELECT id FROM users WHERE username = $1', [id_number]);
    const existing = existingRes.rows[0];
    if (existing) {
      await query('UPDATE users SET worker_id = $1, role = $2, email = $3 WHERE id = $4',
        [worker_id, classification, email || null, existing.id]);
    } else {
      await createUserForWorker(worker_id, id_number, classification, email);
    }
  }
}

// ── Config helpers ───────────────────────────────────────────────────────────

async function getConfig(branchId = null) {
  try {
    const siteGroupsQuery = branchId
      ? query('SELECT id, name, color, branch_id FROM site_groups WHERE branch_id = $1 ORDER BY id', [branchId])
      : query('SELECT id, name, color, branch_id FROM site_groups ORDER BY id');
    const activityTypesQuery = branchId
      ? query('SELECT id, name FROM activity_types WHERE branch_id = $1 ORDER BY name', [branchId])
      : query('SELECT id, name FROM activity_types ORDER BY name');
    const sitesQuery = branchId
      ? query('SELECT id, name, description, group_id FROM sites WHERE branch_id = $1 ORDER BY name', [branchId])
      : query('SELECT id, name, description, group_id FROM sites ORDER BY name');

    const res = await Promise.all([
      query('SELECT id, name FROM job_titles ORDER BY id'),
      query('SELECT id, name, is_independent FROM employment_types ORDER BY id'),
      query('SELECT id, name FROM honorifics ORDER BY id'),
      siteGroupsQuery,
      sitesQuery,
      activityTypesQuery,
      query('SELECT key, label_he, label_short, icon, color, bg_color, show_in_assignments, show_in_availability_bar, default_start, default_end, sort_order FROM shift_types ORDER BY sort_order'),
      query('SELECT key, label_he, label_group_he, color, sort_order FROM preference_types ORDER BY sort_order'),
    ]);

    // Try to get allowed jobs, but don't fail if table doesn't exist
    let allowedJobsByGroup = {};
    try {
      const allowedJobsRes = branchId
        ? await query(`
            SELECT sgaj.group_id, sgaj.job_id, j.name
            FROM site_group_allowed_jobs sgaj
            JOIN job_titles j ON sgaj.job_id = j.id
            JOIN site_groups sg ON sgaj.group_id = sg.id
            WHERE sg.branch_id = $1
            ORDER BY sgaj.group_id, j.name
          `, [branchId])
        : await query(`
            SELECT sgaj.group_id, sgaj.job_id, j.name
            FROM site_group_allowed_jobs sgaj
            JOIN job_titles j ON sgaj.job_id = j.id
            ORDER BY sgaj.group_id, j.name
          `);

      allowedJobsRes.rows.forEach(row => {
        if (!allowedJobsByGroup[row.group_id]) {
          allowedJobsByGroup[row.group_id] = [];
        }
        allowedJobsByGroup[row.group_id].push({ job_id: row.job_id, name: row.name });
      });
    } catch (err) {
      console.warn('Warning: Could not fetch site_group_allowed_jobs:', err.message);
    }

    let fairnessSiteIds = [];
    try {
      const fRes = branchId
        ? await query('SELECT fs.site_id FROM fairness_sites fs JOIN sites s ON fs.site_id = s.id WHERE s.branch_id = $1 ORDER BY fs.site_id', [branchId])
        : await query('SELECT site_id FROM fairness_sites ORDER BY site_id');
      fairnessSiteIds = fRes.rows.map(r => r.site_id);
    } catch (e) {
      console.warn('fairness_sites not available:', e.message);
    }

    let specialDays = [];
    try {
      const sdRes = branchId
        ? await query('SELECT id, date, name, type, color FROM special_days WHERE branch_id = $1 OR branch_id IS NULL ORDER BY date', [branchId])
        : await query('SELECT id, date, name, type, color FROM special_days ORDER BY date');
      specialDays = sdRes.rows;
    } catch (e) {
      console.warn('special_days not available:', e.message);
    }

    return {
      jobs: res[0].rows,
      employment_types: res[1].rows,
      honorifics: res[2].rows,
      site_groups: res[3].rows,
      sites: res[4].rows,
      activity_types: res[5].rows,
      site_group_allowed_jobs: allowedJobsByGroup,
      shift_types: res[6].rows,
      preference_types: res[7].rows,
      fairness_sites: fairnessSiteIds,
      special_days: specialDays,
    };
  } catch (error) {
    console.error('Error in getConfig:', error);
    throw error;
  }
}

const WORKER_SELECT = `
  SELECT w.id,
         w.honorific_id, h.name AS title,
         w.first_name, w.family_name,
         w.job_id, j.name AS job,
         w.employment_type_id, e.name AS employment_type,
         w.phone, w.email, w.notes,
         w.id_number, w.classification, w.can_submit_requests,
         COALESCE((SELECT BOOL_OR(wb2.is_active) FROM worker_branches wb2 WHERE wb2.worker_id = w.id), TRUE) AS is_active,
         w.primary_branch_id, pb.name AS primary_branch_name,
         w.created_at,
         u.id AS user_id
  FROM workers w
  LEFT JOIN honorifics h ON w.honorific_id = h.id
  LEFT JOIN job_titles j ON w.job_id = j.id
  LEFT JOIN employment_types e ON w.employment_type_id = e.id
  LEFT JOIN users u ON u.worker_id = w.id
  LEFT JOIN branches pb ON pb.id = w.primary_branch_id
`;

// ── Auth endpoints ──────────────────────────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'שדות חסרים' });
    
    const userRes = await query('SELECT * FROM users WHERE username = $1', [username]);
    const user = userRes.rows[0];
    
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'שם משתמש או סיסמא שגויים' });
    }
    
    let email = user.email;
    let displayName = user.username;
    let canSubmitRequests = true;

    let effectiveBranchId = user.branch_id ?? null;

    if (user.worker_id) {
      const workerRes = await query(`
        SELECT w.email, w.first_name, w.family_name, w.primary_branch_id, w.can_submit_requests,
               COALESCE((SELECT BOOL_OR(wb.is_active) FROM worker_branches wb WHERE wb.worker_id = w.id), TRUE) AS is_active
        FROM workers w WHERE w.id = $1
      `, [user.worker_id]);
      const worker = workerRes.rows[0];
      if (worker) {
        if (!worker.is_active) {
          return res.status(403).json({ error: 'חשבון זה אינו פעיל' });
        }
        email = email || worker.email;
        displayName = `${worker.first_name} ${worker.family_name}`;
        canSubmitRequests = worker.can_submit_requests;
        // Use worker's primary branch as effective branch for all roles
        if (worker.primary_branch_id) {
          effectiveBranchId = worker.primary_branch_id;
        }
      }
    }

    let branchName = null;
    if (effectiveBranchId) {
      const branchRes = await query('SELECT name FROM branches WHERE id = $1', [effectiveBranchId]);
      branchName = branchRes.rows[0]?.name ?? null;
    }

    const payload = { id: user.id, username: user.username, role: user.role, worker_id: user.worker_id, branch_id: effectiveBranchId };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { ...payload, email, displayName, branch_name: branchName, must_change_password: user.must_change_password, can_submit_requests: canSubmitRequests } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'שגיאה בהתחברות' });
  }
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'הסיסמא חייבת להכיל לפחות 6 תווים' });
    }
    await query('UPDATE users SET password_hash = $1, must_change_password = 0 WHERE id = $2',
      [bcrypt.hashSync(newPassword, 8), req.user.id]);
    res.json({ ok: true });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'שגיאה בשינוי סיסמא' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'אימייל חסר' });

    const userRes = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userRes.rows[0];
    
    if (!user) return res.json({ ok: true }); // don't reveal whether email exists

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await query('UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [token, expires, user.id]);

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const resetLink = `${appUrl}/?reset=${token}`;

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'איפוס סיסמא — מחלקת הרדמה',
        html: `
          <div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px">
            <h2>איפוס סיסמא</h2>
            <p>קיבלנו בקשה לאיפוס הסיסמא שלך.</p>
            <p style="margin:24px 0">
              <a href="${resetLink}"
                 style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:15px">
                לחץ כאן לאיפוס סיסמא
              </a>
            </p>
            <p style="color:#6b7280;font-size:13px">הקישור תקף לשעה אחת.</p>
            <p style="color:#6b7280;font-size:13px">אם לא ביקשת איפוס סיסמא, התעלם מהודעה זו.</p>
          </div>
        `,
      });
    } catch (err) {
      console.error('Email send error:', err.message);
      return res.status(500).json({ error: 'שגיאה בשליחת אימייל. פנה למנהל המערכת.' });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'שגיאה בעיבוד בקשה' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'שדות לא תקינים' });
    }
    
    const userRes = await query('SELECT * FROM users WHERE reset_token = $1', [token]);
    const user = userRes.rows[0];
    
    if (!user) return res.status(400).json({ error: 'קישור לא תקין' });
    if (new Date(user.reset_token_expires) < new Date()) {
      return res.status(400).json({ error: 'הקישור פג תוקף, בקש קישור חדש' });
    }
    
    await query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL, must_change_password = 0 WHERE id = $2',
      [bcrypt.hashSync(newPassword, 8), user.id]
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'שגיאה בעיבוד בקשה' });
  }
});

app.post('/api/auth/reset-worker-password/:workerId', requireAdmin, async (req, res) => {
  try {
    const { workerId } = req.params;
    
    const workerRes = await query('SELECT id_number FROM workers WHERE id = $1', [workerId]);
    const worker = workerRes.rows[0];
    if (!worker) return res.status(404).json({ error: 'עובד לא נמצא' });

    const userRes = await query('SELECT id FROM users WHERE worker_id = $1', [workerId]);
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });

    const newPassword = bcrypt.hashSync(worker.id_number, 8);
    await query('UPDATE users SET password_hash = $1, must_change_password = 1 WHERE id = $2',
      [newPassword, user.id]);

    res.json({ ok: true });
  } catch (error) {
    console.error('Reset worker password error:', error);
    res.status(500).json({ error: 'שגיאה בעיבוד בקשה' });
  }
});

// ── Workers ─────────────────────────────────────────────────────────────────

app.get('/api/workers', requireAuth, async (req, res) => {
  try {
    const allBranches = req.query.all_branches === 'true' && (req.user.role === 'admin' || req.user.role === 'superadmin');
    const branchId = allBranches ? null : getEffectiveBranchId(req);
    let sql, params;
    if (allBranches) {
      sql = `SELECT w.id, w.honorific_id, h.name AS title,
                    w.first_name, w.family_name,
                    w.job_id, j.name AS job,
                    w.employment_type_id, e.name AS employment_type,
                    w.phone, w.email, w.notes,
                    w.id_number, w.classification, w.can_submit_requests,
                    COALESCE((SELECT BOOL_OR(wb2.is_active) FROM worker_branches wb2 WHERE wb2.worker_id = w.id), TRUE) AS is_active,
                    w.primary_branch_id, pb.name AS primary_branch_name,
                    w.created_at, u.id AS user_id,
                    TRUE AS is_primary_branch
             FROM workers w
             LEFT JOIN honorifics h ON w.honorific_id = h.id
             LEFT JOIN job_titles j ON w.job_id = j.id
             LEFT JOIN employment_types e ON w.employment_type_id = e.id
             LEFT JOIN users u ON u.worker_id = w.id
             LEFT JOIN branches pb ON pb.id = w.primary_branch_id
             ORDER BY w.family_name`;
      params = [];
    } else if (branchId && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
      sql = `
        SELECT w.id,
               w.honorific_id, h.name AS title,
               w.first_name, w.family_name,
               w.job_id, j.name AS job,
               w.employment_type_id, e.name AS employment_type,
               w.phone, w.email, w.notes,
               w.id_number, w.classification, w.can_submit_requests, wb.is_active,
               w.primary_branch_id, pb.name AS primary_branch_name,
               w.created_at, u.id AS user_id,
               (w.primary_branch_id = $1) AS is_primary_branch
        FROM workers w
        LEFT JOIN honorifics h ON w.honorific_id = h.id
        LEFT JOIN job_titles j ON w.job_id = j.id
        LEFT JOIN employment_types e ON w.employment_type_id = e.id
        LEFT JOIN users u ON u.worker_id = w.id
        LEFT JOIN branches pb ON pb.id = w.primary_branch_id
        JOIN worker_branches wb ON wb.worker_id = w.id AND wb.branch_id = $1
        ORDER BY is_primary_branch DESC, w.family_name
      `;
      params = [branchId];
    } else {
      sql = WORKER_SELECT + ', TRUE AS is_primary_branch ORDER BY w.family_name';
      params = [];
    }
    const res_query = await query(sql, params);
    res.json(res_query.rows);
  } catch (error) {
    console.error('Get workers error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת עובדים' });
  }
});

app.post('/api/workers', requireAdmin, async (req, res) => {
  try {
    const { honorific_id, first_name, family_name, job_id, employment_type_id,
            phone, email, notes, id_number, classification, branch_ids, can_submit_requests } = req.body;
    if (!email?.trim()) return res.status(400).json({ error: 'אימייל הוא שדה חובה' });

    const cls = classification || 'user';
    const idNum = id_number?.trim() || null;
    const adminBranchId = req.user.branch_id ?? null;
    const canSubmit = can_submit_requests !== undefined ? Boolean(can_submit_requests) : true;

    // For superadmin: branch_ids array; first entry is primary. For admin: their own branch.
    const selectedBranchIds = (req.user.role === 'superadmin' && Array.isArray(branch_ids) && branch_ids.length > 0)
      ? branch_ids.map(Number)
      : (adminBranchId ? [adminBranchId] : []);
    const primaryBranchId = selectedBranchIds[0] || null;

    try {
      const insertRes = await query(`
        INSERT INTO workers (honorific_id, first_name, family_name, job_id, employment_type_id,
                             phone, email, notes, id_number, classification, primary_branch_id, can_submit_requests)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `, [honorific_id || null, first_name, family_name, job_id || null,
           employment_type_id || null, phone, email.trim(), notes, idNum, cls, primaryBranchId, canSubmit]);

      const workerId = insertRes.rows[0].id;
      await createUserForWorker(workerId, idNum, cls, email.trim());

      for (const branchId of selectedBranchIds) {
        await query(
          'INSERT INTO worker_branches (worker_id, branch_id, is_active) VALUES ($1, $2, TRUE) ON CONFLICT DO NOTHING',
          [workerId, branchId]
        );
      }

      const workerRes = await query(WORKER_SELECT + ' WHERE w.id = $1', [workerId]);
      res.status(201).json(workerRes.rows[0]);
    } catch (e) {
      if (e.message?.includes('unique') && e.message?.includes('id_number')) {
        return res.status(400).json({ error: 'מספר תעודת זהות כבר קיים במערכת' });
      }
      throw e;
    }
  } catch (error) {
    console.error('Create worker error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת עובד' });
  }
});

app.put('/api/workers/:id', requireAdmin, async (req, res) => {
  try {
    const { honorific_id, first_name, family_name, job_id, employment_type_id,
            phone, email, notes, id_number, classification, primary_branch_id, can_submit_requests } = req.body;
    if (!email?.trim()) return res.status(400).json({ error: 'אימייל הוא שדה חובה' });

    const cls = classification || 'user';
    const idNum = id_number?.trim() || null;
    const primaryBranchId = primary_branch_id || null;
    const canSubmit = can_submit_requests !== undefined ? Boolean(can_submit_requests) : true;

    try {
      const updateRes = await query(
        `UPDATE workers SET honorific_id=$1, first_name=$2, family_name=$3, job_id=$4,
           employment_type_id=$5, phone=$6, email=$7, notes=$8, id_number=$9, classification=$10,
           primary_branch_id=$11, can_submit_requests=$12
         WHERE id=$13`,
        [honorific_id || null, first_name, family_name, job_id || null,
         employment_type_id || null, phone, email.trim(), notes, idNum, cls, primaryBranchId, canSubmit, req.params.id]
      );
      
      if (updateRes.rowCount === 0) return res.status(404).json({ error: 'עובד לא נמצא' });
      
      await syncUserForWorker(Number(req.params.id), idNum, cls, email.trim());
      
      const workerRes = await query(WORKER_SELECT + ' WHERE w.id = $1', [req.params.id]);
      res.json(workerRes.rows[0]);
    } catch (e) {
      if (e.message?.includes('unique') && e.message?.includes('id_number')) {
        return res.status(400).json({ error: 'מספר תעודת זהות כבר קיים במערכת' });
      }
      throw e;
    }
  } catch (error) {
    console.error('Update worker error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון עובד' });
  }
});

app.delete('/api/workers/:id', requireAdmin, async (req, res) => {
  try {
    const deleteRes = await query('DELETE FROM workers WHERE id=$1', [req.params.id]);
    if (deleteRes.rowCount === 0) return res.status(404).json({ error: 'עובד לא נמצא' });
    res.status(204).send();
  } catch (error) {
    console.error('Delete worker error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת עובד' });
  }
});

// ── Worker Activity Authorizations ──────────────────────────────────────────

app.get('/api/workers/:id', requireAuth, async (req, res) => {
  try {
    const workerId = parseInt(req.params.id);
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && req.user.worker_id !== workerId) {
      return res.status(403).json({ error: 'אין הרשאה' });
    }
    const result = await query(WORKER_SELECT + ' WHERE w.id = $1', [workerId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'עובד לא נמצא' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'שגיאה' });
  }
});

app.get('/api/workers/:id/activity-authorizations', requireAdmin, async (req, res) => {
  try {
    const res_query = await query(`
      SELECT waa.id, waa.activity_type_id, at.name
      FROM worker_activity_authorizations waa
      JOIN activity_types at ON waa.activity_type_id = at.id
      WHERE waa.worker_id = $1
      ORDER BY at.name
    `, [req.params.id]);
    res.json(res_query.rows);
  } catch (error) {
    console.error('Get worker activity authorizations error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת הרשאות' });
  }
});

app.post('/api/workers/:id/activity-authorizations', requireAdmin, async (req, res) => {
  try {
    const { activity_type_id } = req.body;
    if (!activity_type_id) return res.status(400).json({ error: 'סוג פעילות חובה' });

    try {
      await query(`
        INSERT INTO worker_activity_authorizations (worker_id, activity_type_id)
        VALUES ($1, $2)
      `, [req.params.id, activity_type_id]);

      const res_query = await query(`
        SELECT waa.id, waa.activity_type_id, at.name
        FROM worker_activity_authorizations waa
        JOIN activity_types at ON waa.activity_type_id = at.id
        WHERE waa.worker_id = $1
        ORDER BY at.name
      `, [req.params.id]);
      res.json(res_query.rows);
    } catch (e) {
      if (e.message?.includes('unique')) {
        return res.status(400).json({ error: 'עובד כבר מורשה לסוג פעילות זה' });
      }
      throw e;
    }
  } catch (error) {
    console.error('Add worker activity authorization error:', error);
    res.status(500).json({ error: 'שגיאה בהוספת הרשאה' });
  }
});

app.delete('/api/workers/:id/activity-authorizations/:activityTypeId', requireAdmin, async (req, res) => {
  try {
    await query(`
      DELETE FROM worker_activity_authorizations
      WHERE worker_id = $1 AND activity_type_id = $2
    `, [req.params.id, req.params.activityTypeId]);

    const res_query = await query(`
      SELECT waa.id, waa.activity_type_id, at.name
      FROM worker_activity_authorizations waa
      JOIN activity_types at ON waa.activity_type_id = at.id
      WHERE waa.worker_id = $1
      ORDER BY at.name
    `, [req.params.id]);
    res.json(res_query.rows);
  } catch (error) {
    console.error('Delete worker activity authorization error:', error);
    res.status(500).json({ error: 'שגיאה בהסרת הרשאה' });
  }
});

// ── Shift Requests ──────────────────────────────────────────────────────────

app.get('/api/shift-requests', requireAuth, async (req, res) => {
  try {
    const { month, year } = req.query;
    const branchId = getEffectiveBranchId(req);
    const datePrefix = month && year ? `${year}-${String(month).padStart(2, '0')}-` : null;

    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      let conditions = [];
      const params = [];
      let p = 1;

      if (branchId) {
        conditions.push(`sr.branch_id = $${p++}`);
        params.push(branchId);
      }
      if (datePrefix) {
        conditions.push(`sr.date LIKE $${p++}`);
        params.push(datePrefix + '%');
      }

      const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
      const sql = `
        SELECT sr.id, sr.user_id, sr.date, sr.shift_type, sr.preference_type, sr.branch_id,
               u.username, u.worker_id, w.first_name, w.family_name
        FROM shift_requests sr
        JOIN users u ON sr.user_id = u.id
        LEFT JOIN workers w ON u.worker_id = w.id
        ${where}
        ORDER BY sr.date, u.username
      `;
      const result = await query(sql, params);
      res.json(result.rows);
    } else {
      let sql = `SELECT * FROM shift_requests WHERE user_id = $1`;
      const params = [req.user.id];

      if (branchId) {
        sql += ` AND branch_id = $${params.length + 1}`;
        params.push(branchId);
      }
      if (datePrefix) {
        sql += ` AND date LIKE $${params.length + 1}`;
        params.push(datePrefix + '%');
      }
      sql += ' ORDER BY date';

      const result = await query(sql, params);
      res.json(result.rows);
    }
  } catch (error) {
    console.error('Get shift requests error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת בקשות משמרת' });
  }
});

app.get('/api/shift-requests/admin/all-with-workers', requireAdmin, async (req, res) => {
  try {
    const { month, year } = req.query;
    const branchId = getEffectiveBranchId(req);
    const datePrefix = month && year ? `${year}-${String(month).padStart(2, '0')}-` : null;

    let workersSql = WORKER_SELECT;
    let workersParams = [];
    if (branchId) {
      workersSql += ' JOIN worker_branches wb ON wb.worker_id = w.id AND wb.branch_id = $1 AND wb.is_active = TRUE';
      workersParams = [branchId];
    }
    workersSql += ' ORDER BY w.first_name, w.family_name';
    const workersRes = await query(workersSql, workersParams);
    const workers = workersRes.rows;

    let conditions = [];
    const params = [];
    let p = 1;
    if (branchId) { conditions.push(`sr.branch_id = $${p++}`); params.push(branchId); }
    if (datePrefix) { conditions.push(`sr.date LIKE $${p++}`); params.push(datePrefix + '%'); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const sql = `
      SELECT sr.id, sr.user_id, sr.date, sr.shift_type, sr.preference_type, sr.branch_id,
             u.username, u.worker_id, w.first_name, w.family_name
      FROM shift_requests sr
      JOIN users u ON sr.user_id = u.id
      LEFT JOIN workers w ON u.worker_id = w.id
      ${where}
      ORDER BY sr.date, u.username
    `;
    const requestsRes = await query(sql, params);

    res.json({ workers, requests: requestsRes.rows });
  } catch (error) {
    console.error('Get all shift requests error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת בקשות משמרת' });
  }
});

app.post('/api/shift-requests', requireAuth, async (req, res) => {
  try {
    const { date, shift_type, preference_type, user_id, branch_id: bodyBranchId, force_override } = req.body;
    if (!date || !['morning', 'evening', 'night', 'oncall'].includes(shift_type) ||
        !['can', 'prefer', 'cannot'].includes(preference_type)) {
      return res.status(400).json({ error: 'שדות לא תקינים' });
    }

    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
    const targetUserId = isAdmin && user_id ? user_id : req.user.id;
    const branchId = getEffectiveBranchId(req) || bodyBranchId || null;

    // Always check can_submit_requests for the target worker, regardless of submitter's role
    const workerCheck = await query(
      'SELECT w.can_submit_requests FROM workers w JOIN users u ON u.worker_id = w.id WHERE u.id = $1',
      [targetUserId]
    );
    if (workerCheck.rows.length > 0 && workerCheck.rows[0].can_submit_requests === false) {
      return res.status(403).json({ error: 'עובד זה אינו מורשה להגיש בקשות משמרת' });
    }

    const vacCheck = await query(
      `SELECT id FROM vacation_requests
       WHERE user_id = $1 AND status IN ('approved', 'partial')
       AND approved_start <= $2 AND approved_end >= $2`,
      [targetUserId, date]
    );
    if (vacCheck.rows.length > 0 && !(isAdmin && force_override)) {
      return res.status(409).json({ error: 'לא ניתן לשלוח בקשת משמרת לתאריך זה — קיים חופש מאושר' });
    }

    await query(`
      INSERT INTO shift_requests (user_id, date, shift_type, preference_type, branch_id) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT(user_id, date, shift_type, branch_id) DO UPDATE SET preference_type = excluded.preference_type
    `, [targetUserId, date, shift_type, preference_type, branchId]);

    const resultRes = await query(
      'SELECT * FROM shift_requests WHERE user_id = $1 AND date = $2 AND shift_type = $3 AND branch_id IS NOT DISTINCT FROM $4',
      [targetUserId, date, shift_type, branchId]
    );
    res.json(resultRes.rows[0]);
  } catch (error) {
    console.error('Create shift request error:', error);
    res.status(500).json({ error: 'שגיאה בשמירת בקשת משמרת' });
  }
});

app.delete('/api/shift-requests/:id', requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';

    // Check can_submit_requests for the owner of this request
    const ownerCheck = await query(
      `SELECT sr.user_id, w.can_submit_requests
       FROM shift_requests sr
       JOIN users u ON sr.user_id = u.id
       LEFT JOIN workers w ON u.worker_id = w.id
       WHERE sr.id = $1`,
      [req.params.id]
    );
    if (ownerCheck.rows.length > 0 && ownerCheck.rows[0].can_submit_requests === false) {
      const isOwnRequest = ownerCheck.rows[0].user_id === req.user.id;
      if (isOwnRequest) {
        return res.status(403).json({ error: 'אין לך הרשאה לערוך בקשות משמרת' });
      }
    }

    if (isAdmin) {
      await query('DELETE FROM shift_requests WHERE id = $1', [req.params.id]);
    } else {
      await query('DELETE FROM shift_requests WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    }
    res.status(204).send();
  } catch (error) {
    console.error('Delete shift request error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת בקשת משמרת' });
  }
});

// ── Vacation Requests ───────────────────────────────────────────────────────

app.get('/api/vacation-requests', requireAuth, async (req, res) => {
  try {
    const { status, all_branches } = req.query;
    const branchId = all_branches === 'true' ? null : getEffectiveBranchId(req);

    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      const params = [];
      const conditions = [];
      let p = 1;

      if (branchId) {
        conditions.push(`vr.branch_id = $${p++}`);
        params.push(branchId);
      }
      if (status) {
        conditions.push(`vr.status = $${p++}`);
        params.push(status);
      }
      const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

      const sql = `
        SELECT vr.*,
               w.first_name, w.family_name,
               u.username
        FROM vacation_requests vr
        JOIN users u ON vr.user_id = u.id
        LEFT JOIN workers w ON vr.worker_id = w.id
        ${where}
        ORDER BY
          CASE vr.status WHEN 'pending' THEN 0 ELSE 1 END,
          vr.created_at DESC
      `;
      const result = await query(sql, params);
      res.json(result.rows);
    } else {
      const result = await query(
        'SELECT * FROM vacation_requests WHERE user_id = $1 ORDER BY created_at DESC',
        [req.user.id]
      );
      res.json(result.rows);
    }
  } catch (err) {
    console.error('Get vacation requests error:', err);
    res.status(500).json({ error: 'שגיאה בטעינת בקשות חופשה' });
  }
});

app.post('/api/vacation-requests', requireAuth, async (req, res) => {
  try {
    const { start_date, end_date, reason, on_behalf_of_worker_id } = req.body;
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'תאריך התחלה וסיום הם שדות חובה' });
    }
    if (start_date > end_date) {
      return res.status(400).json({ error: 'תאריך ההתחלה חייב להיות לפני תאריך הסיום' });
    }

    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
    let targetUserId = req.user.id;
    let targetWorkerId = req.user.worker_id ?? null;
    let branchId = getEffectiveBranchId(req);

    if (on_behalf_of_worker_id && isAdmin) {
      const workerRes = await query(
        `SELECT w.id, w.primary_branch_id, u.id AS user_id
         FROM workers w
         LEFT JOIN users u ON u.worker_id = w.id
         WHERE w.id = $1`,
        [on_behalf_of_worker_id]
      );
      if (!workerRes.rows.length) {
        return res.status(404).json({ error: 'עובד לא נמצא' });
      }
      const w = workerRes.rows[0];
      if (!w.user_id) {
        return res.status(400).json({ error: 'לעובד אין חשבון משתמש מקושר' });
      }
      targetUserId = w.user_id;
      targetWorkerId = w.id;
      branchId = w.primary_branch_id ?? branchId;
    }

    const overlap = await query(`
      SELECT id FROM vacation_requests
      WHERE user_id = $1
        AND status = 'pending'
        AND NOT (end_date < $2 OR start_date > $3)
    `, [targetUserId, start_date, end_date]);

    if (overlap.rows.length > 0) {
      return res.status(409).json({ error: 'קיימת כבר בקשת חופשה ממתינה לתקופה חופפת' });
    }

    const result = await query(
      `INSERT INTO vacation_requests
         (user_id, worker_id, branch_id, start_date, end_date, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [targetUserId, targetWorkerId, branchId, start_date, end_date, reason || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create vacation request error:', err);
    res.status(500).json({ error: 'שגיאה ביצירת בקשת חופשה' });
  }
});

app.delete('/api/vacation-requests/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await query(
      'SELECT * FROM vacation_requests WHERE id = $1', [id]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'בקשה לא נמצאה' });
    }
    const vr = existing.rows[0];

    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      if (vr.user_id !== req.user.id) {
        return res.status(403).json({ error: 'אין הרשאה' });
      }
      if (vr.status !== 'pending') {
        return res.status(400).json({ error: 'ניתן לבטל רק בקשות ממתינות' });
      }
    }

    await query(
      `UPDATE vacation_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [id]
    );
    res.status(204).send();
  } catch (err) {
    console.error('Cancel vacation request error:', err);
    res.status(500).json({ error: 'שגיאה בביטול בקשה' });
  }
});

app.put('/api/vacation-requests/:id/decision', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, approved_start, approved_end, admin_notes } = req.body;

    if (!['approved', 'rejected', 'partial'].includes(decision)) {
      return res.status(400).json({ error: 'החלטה לא תקינה' });
    }
    if (decision === 'partial' && (!approved_start || !approved_end)) {
      return res.status(400).json({ error: 'אישור חלקי דורש תאריכי אישור' });
    }

    const existing = await query(
      `SELECT vr.*, u.email AS worker_email, u.username,
              w.first_name, w.family_name
       FROM vacation_requests vr
       JOIN users u ON vr.user_id = u.id
       LEFT JOIN workers w ON vr.worker_id = w.id
       WHERE vr.id = $1`,
      [id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'בקשה לא נמצאה' });
    const vr = existing.rows[0];

    const finalStart = decision === 'approved' ? vr.start_date  : (approved_start || null);
    const finalEnd   = decision === 'approved' ? vr.end_date    : (approved_end   || null);

    const updated = await query(
      `UPDATE vacation_requests
       SET status         = $1,
           approved_start = $2,
           approved_end   = $3,
           admin_notes    = $4,
           decided_at     = NOW(),
           updated_at     = NOW()
       WHERE id = $5
       RETURNING *`,
      [decision, finalStart, finalEnd, admin_notes || null, id]
    );

    const workerEmail = vr.worker_email;
    const workerName  = vr.first_name
      ? `${vr.first_name} ${vr.family_name}`
      : vr.username;

    if (workerEmail) {
      const emailHtml = buildVacationDecisionEmail(decision, workerName, vr, finalStart, finalEnd, admin_notes);
      const subjectMap = {
        approved: 'בקשת חופשה אושרה — מחלקת הרדמה',
        rejected: 'בקשת חופשה נדחתה — מחלקת הרדמה',
        partial:  'בקשת חופשה אושרה חלקית — מחלקת הרדמה',
      };
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: workerEmail,
          subject: subjectMap[decision],
          html: emailHtml,
        });
      } catch (emailErr) {
        console.error('Vacation decision email error:', emailErr.message);
      }
    }

    res.json(updated.rows[0]);
  } catch (err) {
    console.error('Vacation decision error:', err);
    res.status(500).json({ error: 'שגיאה בעיבוד ההחלטה' });
  }
});

app.delete('/api/vacation-requests/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await query('SELECT id FROM vacation_requests WHERE id = $1', [id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'בקשה לא נמצאה' });
    await query('DELETE FROM vacation_requests WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    console.error('Delete vacation request error:', err);
    res.status(500).json({ error: 'שגיאה במחיקת בקשה' });
  }
});

// ── Config ──────────────────────────────────────────────────────────────────

app.get('/api/config', requireAuth, async (req, res) => {
  try {
    const branchId = getEffectiveBranchId(req);
    const config = await getConfig(branchId);
    res.json(config);
  } catch (error) {
    console.error('Get config error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת הגדרות' });
  }
});

app.post('/api/config/jobs', requireAdmin, async (req, res) => {
  try {
    const { value } = req.body;
    if (!value?.trim()) return res.status(400).json({ error: 'ערך לא תקין' });
    try {
      await query('INSERT INTO job_titles (name) VALUES ($1)', [value.trim()]);
      const config = await getConfig(getEffectiveBranchId(req));
      res.json(config);
    } catch {
      res.status(400).json({ error: 'ערך כפול' });
    }
  } catch (error) {
    console.error('Add job title error:', error);
    res.status(500).json({ error: 'שגיאה' });
  }
});

app.put('/api/config/jobs/:id', requireAdmin, async (req, res) => {
  try {
    const { value } = req.body;
    if (!value?.trim()) return res.status(400).json({ error: 'ערך לא תקין' });
    try {
      await query('UPDATE job_titles SET name=$1 WHERE id=$2', [value.trim(), req.params.id]);
      const config = await getConfig(getEffectiveBranchId(req));
      res.json(config);
    } catch {
      res.status(400).json({ error: 'ערך כפול' });
    }
  } catch (error) {
    console.error('Update job title error:', error);
    res.status(500).json({ error: 'שגיאה' });
  }
});

app.delete('/api/config/jobs/:id', requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM job_titles WHERE id=$1', [req.params.id]);
    const config = await getConfig(getEffectiveBranchId(req));
    res.json(config);
  } catch (error) {
    console.error('Delete job title error:', error);
    res.status(500).json({ error: 'שגיאה' });
  }
});

app.post('/api/config/employment-types', requireAdmin, async (req, res) => {
  try {
    const { value } = req.body;
    if (!value?.trim()) return res.status(400).json({ error: 'ערך לא תקין' });
    try {
      await query('INSERT INTO employment_types (name) VALUES ($1)', [value.trim()]);
      const config = await getConfig(getEffectiveBranchId(req));
      res.json(config);
    } catch {
      res.status(400).json({ error: 'ערך כפול' });
    }
  } catch (error) {
    console.error('Add employment type error:', error);
    res.status(500).json({ error: 'שגיאה' });
  }
});

app.put('/api/config/employment-types/:id', requireAdmin, async (req, res) => {
  try {
    const { value } = req.body;
    if (!value?.trim()) return res.status(400).json({ error: 'ערך לא תקין' });
    try {
      await query('UPDATE employment_types SET name=$1 WHERE id=$2', [value.trim(), req.params.id]);
      const config = await getConfig(getEffectiveBranchId(req));
      res.json(config);
    } catch {
      res.status(400).json({ error: 'ערך כפול' });
    }
  } catch (error) {
    console.error('Update employment type error:', error);
    res.status(500).json({ error: 'שגיאה' });
  }
});

app.delete('/api/config/employment-types/:id', requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM employment_types WHERE id=$1', [req.params.id]);
    const config = await getConfig(getEffectiveBranchId(req));
    res.json(config);
  } catch (error) {
    console.error('Delete employment type error:', error);
    res.status(500).json({ error: 'שגיאה' });
  }
});

app.post('/api/config/honorifics', requireAdmin, async (req, res) => {
  try {
    const { value } = req.body;
    if (!value?.trim()) return res.status(400).json({ error: 'ערך לא תקין' });
    try {
      await query('INSERT INTO honorifics (name) VALUES ($1)', [value.trim()]);
      const config = await getConfig(getEffectiveBranchId(req));
      res.json(config);
    } catch {
      res.status(400).json({ error: 'ערך כפול' });
    }
  } catch (error) {
    console.error('Add honorific error:', error);
    res.status(500).json({ error: 'שגיאה' });
  }
});

app.put('/api/config/honorifics/:id', requireAdmin, async (req, res) => {
  try {
    const { value } = req.body;
    if (!value?.trim()) return res.status(400).json({ error: 'ערך לא תקין' });
    try {
      await query('UPDATE honorifics SET name=$1 WHERE id=$2', [value.trim(), req.params.id]);
      const config = await getConfig(getEffectiveBranchId(req));
      res.json(config);
    } catch {
      res.status(400).json({ error: 'ערך כפול' });
    }
  } catch (error) {
    console.error('Update honorific error:', error);
    res.status(500).json({ error: 'שגיאה' });
  }
});

app.delete('/api/config/honorifics/:id', requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM honorifics WHERE id=$1', [req.params.id]);
    const config = await getConfig(getEffectiveBranchId(req));
    res.json(config);
  } catch (error) {
    console.error('Delete honorific error:', error);
    res.status(500).json({ error: 'שגיאה' });
  }
});

app.post('/api/config/sites', requireAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'שם אתר חובה' });
    const branchId = getEffectiveBranchId(req);
    try {
      await query('INSERT INTO sites (name, description, branch_id) VALUES ($1, $2, $3)',
        [name.trim(), description?.trim() || null, branchId]);
      const config = await getConfig(branchId);
      res.json(config);
    } catch (err) {
      res.status(400).json({ error: 'שם אתר כפול' });
    }
  } catch (error) {
    console.error('Add site error:', error);
    res.status(500).json({ error: 'שגיאה' });
  }
});

app.put('/api/config/sites/:id', requireAdmin, async (req, res) => {
  try {
    const { value, name } = req.body;
    const siteName = name || value;
    if (!siteName?.trim()) return res.status(400).json({ error: 'שם אתר חובה' });
    const branchId = getEffectiveBranchId(req);
    try {
      const r = await query('UPDATE sites SET name=$1 WHERE id=$2 AND branch_id=$3',
        [siteName.trim(), req.params.id, branchId]);
      if (r.rowCount === 0) return res.status(403).json({ error: 'אתר לא נמצא בסניף זה' });
      const config = await getConfig(branchId);
      res.json(config);
    } catch (err) {
      res.status(400).json({ error: 'שם אתר כפול' });
    }
  } catch (error) {
    console.error('Update site error:', error);
    res.status(500).json({ error: 'שגיאה' });
  }
});

app.delete('/api/config/sites/:id', requireAdmin, async (req, res) => {
  try {
    const branchId = getEffectiveBranchId(req);
    const r = await query('DELETE FROM sites WHERE id=$1 AND branch_id=$2', [req.params.id, branchId]);
    if (r.rowCount === 0) return res.status(403).json({ error: 'אתר לא נמצא בסניף זה' });
    const config = await getConfig(branchId);
    res.json(config);
  } catch (error) {
    console.error('Delete site error:', error);
    res.status(500).json({ error: 'שגיאה' });
  }
});

app.post('/api/config/site-groups', requireAdmin, async (req, res) => {
  try {
    const { value, color } = req.body;
    if (!value?.trim()) return res.status(400).json({ error: 'שם קבוצה חובה' });
    const branchId = getEffectiveBranchId(req);
    try {
      await query('INSERT INTO site_groups (name, color, branch_id) VALUES ($1, $2, $3)', [value.trim(), color || '#667eea', branchId]);
      const config = await getConfig(branchId);
      res.json(config);
    } catch {
      res.status(400).json({ error: 'קבוצה כפולה' });
    }
  } catch (error) {
    console.error('Add site group error:', error);
    res.status(500).json({ error: 'שגיאה' });
  }
});

app.put('/api/config/site-groups/:id', requireAdmin, async (req, res) => {
  try {
    const { value, color } = req.body;
    if (!value?.trim()) return res.status(400).json({ error: 'שם קבוצה חובה' });
    const branchId = getEffectiveBranchId(req);
    try {
      const r = await query('UPDATE site_groups SET name=$1, color=$2 WHERE id=$3 AND branch_id=$4',
        [value.trim(), color || '#667eea', req.params.id, branchId]);
      if (r.rowCount === 0) return res.status(403).json({ error: 'קבוצה לא נמצאת בסניף זה' });
      const config = await getConfig(branchId);
      res.json(config);
    } catch {
      res.status(400).json({ error: 'קבוצה כפולה' });
    }
  } catch (error) {
    console.error('Update site group error:', error);
    res.status(500).json({ error: 'שגיאה' });
  }
});

app.delete('/api/config/site-groups/:id', requireAdmin, async (req, res) => {
  try {
    const branchId = getEffectiveBranchId(req);
    const r = await query('DELETE FROM site_groups WHERE id=$1 AND branch_id=$2', [req.params.id, branchId]);
    if (r.rowCount === 0) return res.status(403).json({ error: 'קבוצה לא נמצאת בסניף זה' });
    const config = await getConfig(branchId);
    res.json(config);
  } catch (error) {
    console.error('Delete site group error:', error);
    res.status(500).json({ error: 'שגיאה' });
  }
});

// ── Site Group Allowed Jobs ──

app.get('/api/config/site-groups/:id/allowed-jobs', requireAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT sgaj.id, sgaj.job_id, j.name
      FROM site_group_allowed_jobs sgaj
      JOIN job_titles j ON sgaj.job_id = j.id
      WHERE sgaj.group_id = $1
      ORDER BY j.name
    `, [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Get site group allowed jobs error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת תפקידים מורשים' });
  }
});

app.post('/api/config/site-groups/:id/allowed-jobs', requireAdmin, async (req, res) => {
  try {
    const { job_id } = req.body;
    if (!job_id) return res.status(400).json({ error: 'תפקיד חובה' });
    try {
      await query(
        'INSERT INTO site_group_allowed_jobs (group_id, job_id) VALUES ($1, $2)',
        [req.params.id, job_id]
      );
      const result = await query(`
        SELECT sgaj.id, sgaj.job_id, j.name
        FROM site_group_allowed_jobs sgaj
        JOIN job_titles j ON sgaj.job_id = j.id
        WHERE sgaj.group_id = $1
        ORDER BY j.name
      `, [req.params.id]);
      res.json(result.rows);
    } catch (e) {
      if (e.message?.includes('unique')) {
        return res.status(400).json({ error: 'תפקיד כבר מורשה לקבוצה זו' });
      }
      throw e;
    }
  } catch (error) {
    console.error('Add site group allowed job error:', error);
    res.status(500).json({ error: 'שגיאה בהוספת תפקיד מורשה' });
  }
});

app.delete('/api/config/site-groups/:id/allowed-jobs/:jobId', requireAdmin, async (req, res) => {
  try {
    await query(
      'DELETE FROM site_group_allowed_jobs WHERE group_id = $1 AND job_id = $2',
      [req.params.id, req.params.jobId]
    );
    const result = await query(`
      SELECT sgaj.id, sgaj.job_id, j.name
      FROM site_group_allowed_jobs sgaj
      JOIN job_titles j ON sgaj.job_id = j.id
      WHERE sgaj.group_id = $1
      ORDER BY j.name
    `, [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Delete site group allowed job error:', error);
    res.status(500).json({ error: 'שגיאה בהסרת תפקיד מורשה' });
  }
});

app.put('/api/config/sites/:id/group', requireAdmin, async (req, res) => {
  try {
    const { group_id } = req.body;
    const branchId = getEffectiveBranchId(req);
    const r = await query('UPDATE sites SET group_id=$1 WHERE id=$2 AND branch_id=$3',
      [group_id || null, req.params.id, branchId]);
    if (r.rowCount === 0) return res.status(403).json({ error: 'אתר לא נמצא בסניף זה' });
    const config = await getConfig(branchId);
    res.json(config);
  } catch (error) {
    console.error('Update site group assignment error:', error);
    res.status(500).json({ error: 'שגיאה' });
  }
});

// ── Fairness Sites Endpoints ────────────────────────────────────────────────

app.post('/api/config/fairness-sites/:siteId', requireAdmin, async (req, res) => {
  try {
    const siteId = parseInt(req.params.siteId);
    if (!siteId) return res.status(400).json({ error: 'מזהה אתר לא תקין' });
    await query('INSERT INTO fairness_sites (site_id) VALUES ($1) ON CONFLICT DO NOTHING', [siteId]);
    res.json(await getConfig(getEffectiveBranchId(req)));
  } catch (e) {
    console.error('Add fairness site error:', e);
    res.status(500).json({ error: 'שגיאה בהוספת אתר לצדק' });
  }
});

app.delete('/api/config/fairness-sites/:siteId', requireAdmin, async (req, res) => {
  try {
    const siteId = parseInt(req.params.siteId);
    await query('DELETE FROM fairness_sites WHERE site_id = $1', [siteId]);
    res.json(await getConfig(getEffectiveBranchId(req)));
  } catch (e) {
    console.error('Remove fairness site error:', e);
    res.status(500).json({ error: 'שגיאה בהסרת אתר מהצדק' });
  }
});

// ── Special Days ─────────────────────────────────────────────────────────────

app.post('/api/config/special-days', requireAdmin, async (req, res) => {
  try {
    const { date, name, type, color } = req.body;
    console.log('[special-days POST] received type:', type);
    if (!date || !name) return res.status(400).json({ error: 'תאריך ושם נדרשים' });
    const branchId = getEffectiveBranchId(req);
    const resolvedType = ['holiday','eve','other'].includes(type) ? type : 'holiday';
    console.log('[special-days POST] resolved type:', resolvedType);
    const inserted = await query('INSERT INTO special_days (date, name, type, color, branch_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, type',
      [date, name.trim(), resolvedType, color || '#f59e0b', branchId]);
    console.log('[special-days POST] inserted row:', inserted.rows[0]);
    res.json(await getConfig(branchId));
  } catch (e) {
    console.error('Add special day error:', e);
    res.status(500).json({ error: 'שגיאה בהוספת יום מיוחד' });
  }
});

app.put('/api/config/special-days/:id', requireAdmin, async (req, res) => {
  try {
    const { date, name, type, color } = req.body;
    console.log('[special-days PUT] received type:', type);
    if (!date || !name) return res.status(400).json({ error: 'תאריך ושם נדרשים' });
    const resolvedType = ['holiday','eve','other'].includes(type) ? type : 'holiday';
    console.log('[special-days PUT] resolved type:', resolvedType);
    await query('UPDATE special_days SET date=$1, name=$2, type=$3, color=$4 WHERE id=$5',
      [date, name.trim(), resolvedType, color || '#f59e0b', req.params.id]);
    res.json(await getConfig(getEffectiveBranchId(req)));
  } catch (e) {
    console.error('Update special day error:', e);
    res.status(500).json({ error: 'שגיאה בעדכון יום מיוחד' });
  }
});

app.delete('/api/config/special-days/:id', requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM special_days WHERE id=$1', [req.params.id]);
    res.json(await getConfig(getEffectiveBranchId(req)));
  } catch (e) {
    console.error('Delete special day error:', e);
    res.status(500).json({ error: 'שגיאה במחיקת יום מיוחד' });
  }
});

// ── Send Schedule Email ─────────────────────────────────────────────────────

app.post('/api/send-schedule', requireAdmin, async (req, res) => {
  try {
    const { date, workerIds } = req.body;
    if (!date || !Array.isArray(workerIds) || workerIds.length === 0) {
      return res.status(400).json({ error: 'date ו-workerIds נדרשים' });
    }

    const branchId = getEffectiveBranchId(req);

    // Get all assignments for the date with site/group/activity info
    let query_str = `
      SELECT wsa.worker_id, wsa.shift_type, wsa.start_time, wsa.end_time,
             s.name AS site_name, sg.name AS group_name,
             at.name AS activity_name,
             w.first_name, w.family_name
      FROM worker_site_assignments wsa
      JOIN sites s ON wsa.site_id = s.id
      LEFT JOIN site_groups sg ON s.group_id = sg.id
      LEFT JOIN site_shift_activities ssa ON ssa.site_id = wsa.site_id AND ssa.date = wsa.date AND ssa.shift_type = wsa.shift_type
      LEFT JOIN activity_types at ON ssa.activity_type_id = at.id
      JOIN workers w ON wsa.worker_id = w.id
      WHERE wsa.date = $1
    `;
    const params = [date];
    let paramIndex = 2;
    if (branchId) {
      query_str += ` AND s.branch_id = $${paramIndex}`;
      params.push(branchId);
      paramIndex++;
    }
    query_str += ' ORDER BY sg.name, s.name, wsa.shift_type';

    const assignRes = await query(query_str, params);
    const assignments = assignRes.rows;

    // Get worker details for selected workers
    let workersQuery = `SELECT id, first_name, family_name, email FROM workers WHERE id = ANY($1)`;
    const workerParams = [workerIds];
    if (branchId) {
      workersQuery = `
        SELECT w.id, w.first_name, w.family_name, w.email
        FROM workers w
        JOIN worker_branches wb ON wb.worker_id = w.id AND wb.branch_id = $2 AND wb.is_active = TRUE
        WHERE w.id = ANY($1)
      `;
      workerParams.push(branchId);
    }
    const workersRes = await query(workersQuery, workerParams);
    const workers = workersRes.rows;

    // Format date
    const [y, m, d] = date.split('-');
    const dateStr = `${d}.${m}.${y}`;

    // Build HTML for schedule
    let html = `
      <div style="direction: rtl; font-family: Arial, sans-serif; background: #f9fafb; padding: 20px;">
        <h2 style="color: #1f2937; margin: 0 0 20px 0;">תוכנית עבודה — ${dateStr}</h2>
        <table style="width: 100%; border-collapse: collapse; background: white;">
          <thead>
            <tr style="background: #f3f4f6; border-bottom: 2px solid #d1d5db;">
              <th style="padding: 10px; text-align: right; border: 1px solid #e5e7eb;">קבוצה</th>
              <th style="padding: 10px; text-align: right; border: 1px solid #e5e7eb;">חדר</th>
              <th style="padding: 10px; text-align: right; border: 1px solid #e5e7eb;">משמרת</th>
              <th style="padding: 10px; text-align: right; border: 1px solid #e5e7eb;">שעות</th>
              <th style="padding: 10px; text-align: right; border: 1px solid #e5e7eb;">פעילות</th>
              <th style="padding: 10px; text-align: right; border: 1px solid #e5e7eb;">עובד</th>
            </tr>
          </thead>
          <tbody>
    `;

    const shiftLabels = { morning: 'בוקר', evening: 'ערב', night: 'לילה', oncall: 'זימון' };
    assignments.forEach(a => {
      const hours = a.start_time && a.end_time ? `${a.start_time}-${a.end_time}` : '—';
      html += `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px; text-align: right; border: 1px solid #e5e7eb;">${a.group_name || '—'}</td>
          <td style="padding: 8px; text-align: right; border: 1px solid #e5e7eb;">${a.site_name}</td>
          <td style="padding: 8px; text-align: right; border: 1px solid #e5e7eb;">${shiftLabels[a.shift_type] || a.shift_type}</td>
          <td style="padding: 8px; text-align: right; border: 1px solid #e5e7eb;">${hours}</td>
          <td style="padding: 8px; text-align: right; border: 1px solid #e5e7eb;">${a.activity_name || '—'}</td>
          <td style="padding: 8px; text-align: right; border: 1px solid #e5e7eb;">${a.first_name} ${a.family_name}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    // Send emails
    const sent = [];
    const noEmail = [];
    const failed = [];

    const subject = `תוכנית עבודה — ${dateStr}`;

    for (const worker of workers) {
      if (!worker.email) {
        noEmail.push(`${worker.first_name} ${worker.family_name}`);
        continue;
      }
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: worker.email,
          subject,
          html,
        });
        sent.push(`${worker.first_name} ${worker.family_name}`);
        // Log successful send (async, fire-and-forget)
        query(
          'INSERT INTO sent_emails (schedule_date, worker_id, recipient_email, subject, status, branch_id) VALUES ($1, $2, $3, $4, $5, $6)',
          [date, worker.id, worker.email, subject, 'sent', branchId || null]
        ).catch(err => console.warn('Failed to log email:', err.message));
      } catch (err) {
        console.error(`Failed to send to ${worker.email}:`, err);
        failed.push(`${worker.first_name} ${worker.family_name}`);
        // Log failed send (async, fire-and-forget)
        query(
          'INSERT INTO sent_emails (schedule_date, worker_id, recipient_email, subject, status, error_message, branch_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [date, worker.id, worker.email, subject, 'failed', err.message, branchId || null]
        ).catch(err => console.warn('Failed to log email error:', err.message));
      }
    }

    res.json({ sent, noEmail, failed });
  } catch (e) {
    console.error('Send schedule error:', e);
    res.status(500).json({ error: 'שגיאה בשליחת תוכנית' });
  }
});

// ── Send Schedule via Chat ──────────────────────────────────────────────────

app.post('/api/send-schedule-chat', requireAdmin, async (req, res) => {
  try {
    const { date, workerIds } = req.body;
    if (!date || !Array.isArray(workerIds)) {
      return res.status(400).json({ error: 'תאריך ורשימת עובדים נדרשים' });
    }

    const sidurRes = await query("SELECT id FROM users WHERE username = 'system_sidur'");
    const senderId = sidurRes.rows[0]?.id || req.user.id;
    const branchId = getEffectiveBranchId(req);
    const sent = [];
    const noAccount = [];
    const failed = [];

    const shiftLabels = {
      morning: 'בוקר',
      evening: 'ערב',
      night: 'לילה',
      oncall: 'כוננות'
    };
    const shiftDefaultTimes = {
      morning: { start: '07:00', end: '15:00' },
      evening: { start: '15:00', end: '23:00' },
      night:   { start: '23:00', end: '07:00' },
    };

    for (const workerId of workerIds) {
      try {
        const userRes = await query(
          'SELECT u.id FROM users u WHERE u.worker_id = $1',
          [workerId]
        );

        const workerRes = await query('SELECT first_name, family_name FROM workers WHERE id = $1', [workerId]);

        if (userRes.rows.length === 0) {
          const worker = workerRes.rows[0];
          noAccount.push(`${worker.first_name} ${worker.family_name}`);
          continue;
        }

        const user = userRes.rows[0];
        const userId = user.id;
        const worker = workerRes.rows[0];
        const workerName = `${worker.first_name} ${worker.family_name}`;

        const assignRes = await query(
          `SELECT s.name AS site_name, wsa.shift_type,
                  COALESCE(wsa.start_time, st.default_start) AS start_time,
                  COALESCE(wsa.end_time, st.default_end) AS end_time,
                  wsa.notes, at.name AS activity_name
           FROM worker_site_assignments wsa
           JOIN sites s ON s.id = wsa.site_id
           LEFT JOIN shift_types st ON st.key = wsa.shift_type
           LEFT JOIN site_shift_activities ssa ON ssa.site_id = wsa.site_id AND ssa.shift_type = wsa.shift_type AND ssa.date = wsa.date
           LEFT JOIN activity_types at ON at.id = ssa.activity_type_id
           WHERE wsa.worker_id = $1 AND wsa.date = $2
           ORDER BY s.name`,
          [workerId, date]
        );

        if (assignRes.rows.length === 0) {
          continue;
        }

        const lines = [`תוכנית יומית ל-${date}`];
        const formatTime = (time) => {
          if (!time) return null;
          const timeStr = String(time).trim();
          if (timeStr.length === 0) return null;
          const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
          if (match) {
            const hours = String(match[1]).padStart(2, '0');
            const mins = String(match[2]).padStart(2, '0');
            return `${hours}:${mins}`;
          }
          return null;
        };

        for (const a of assignRes.rows) {
          const shiftLabel = shiftLabels[a.shift_type] || a.shift_type;
          const defaults = shiftDefaultTimes[a.shift_type] || {};
          const startTime = formatTime(a.start_time) || defaults.start || null;
          const endTime = formatTime(a.end_time) || defaults.end || null;
          const hours = startTime && endTime ? `${startTime}-${endTime}` : '—';
          let line = `${a.site_name} | ${shiftLabel} | ${hours}`;
          if (a.activity_name) {
            line += ` | ${a.activity_name}`;
          }
          if (a.notes) {
            line += ` | הערה: ${a.notes}`;
          }
          lines.push(line);
        }
        const content = lines.join('\n');

        await query(
          'INSERT INTO messages (sender_id, recipient_id, content, branch_id) VALUES ($1, $2, $3, $4)',
          [senderId, userId, content, branchId || null]
        );

        sent.push(workerName);
      } catch (e) {
        console.error(`Error sending schedule to worker ${workerId}:`, e);
        try {
          const workerRes = await query('SELECT first_name, family_name FROM workers WHERE id = $1', [workerId]);
          if (workerRes.rows[0]) {
            const worker = workerRes.rows[0];
            failed.push(`${worker.first_name} ${worker.family_name}`);
          }
        } catch (err) {
          console.error('Error fetching worker name:', err);
          failed.push(`Worker ${workerId}`);
        }
      }
    }

    res.json({ sent, noAccount, failed });
  } catch (e) {
    console.error('Send schedule chat error:', e);
    res.status(500).json({ error: 'שגיאה בשליחת תוכנית' });
  }
});

// ── Sent Emails History ────────────────────────────────────────────────────

app.get('/api/sent-emails', requireAdmin, async (req, res) => {
  try {
    const branchId = getEffectiveBranchId(req);
    const { days = 30 } = req.query;

    let sql = `
      SELECT se.id, se.schedule_date, se.worker_id, w.first_name, w.family_name,
             se.recipient_email, se.subject, se.status, se.error_message, se.created_at
      FROM sent_emails se
      JOIN workers w ON se.worker_id = w.id
      WHERE se.created_at > NOW() - INTERVAL '${parseInt(days)} days'
    `;
    const params = [];

    if (branchId) {
      sql += ` AND (se.branch_id = $1 OR se.branch_id IS NULL)`;
      params.push(branchId);
    }

    sql += ` ORDER BY se.created_at DESC LIMIT 500`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (e) {
    console.error('Sent emails error:', e);
    res.status(500).json({ error: 'שגיאה בטעינת הודעות' });
  }
});

// ── Messaging ──────────────────────────────────────────────────────────────────

app.post('/api/messages', requireAuth, async (req, res) => {
  try {
    const { recipient_id, content } = req.body;
    if (!recipient_id || !content?.trim()) {
      return res.status(400).json({ error: 'מקבל והודעה נדרשים' });
    }
    const sender_id = req.user.id;
    const branchId = getEffectiveBranchId(req);

    const result = await query(
      'INSERT INTO messages (sender_id, recipient_id, content, branch_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [sender_id, recipient_id, content.trim(), branchId || null]
    );
    res.json(result.rows[0]);
  } catch (e) {
    console.error('Send message error:', e);
    res.status(500).json({ error: 'שגיאה בשליחת הודעה' });
  }
});

app.get('/api/messages/conversations', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const branchId = getEffectiveBranchId(req);

    let sql = `
      SELECT DISTINCT ON (partner_id)
        partner_id,
        u.username as partner_username,
        (SELECT CASE
           WHEN u2.role = 'system' THEN 'סידור עבודה'
           WHEN w.id IS NOT NULL THEN w.first_name || ' ' || w.family_name
           ELSE u2.username
         END
         FROM users u2 LEFT JOIN workers w ON u2.worker_id = w.id WHERE u2.id = partner_id) as partner_name,
        m.content as last_message,
        m.created_at as last_at,
        COUNT(CASE WHEN m.recipient_id = $1 AND m.read_at IS NULL THEN 1 END) OVER (
          PARTITION BY CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END
        ) as unread_count
      FROM (
        SELECT CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS partner_id,
               sender_id, recipient_id, content, created_at, read_at
        FROM messages WHERE sender_id = $1 OR recipient_id = $1
    `;
    const params = [userId];
    let paramIndex = 2;

    if (branchId) {
      sql += ` AND (branch_id = $${paramIndex} OR branch_id IS NULL)`;
      params.push(branchId);
      paramIndex++;
    }

    sql += `
      ) m
      JOIN users u ON m.partner_id = u.id
      ORDER BY partner_id, m.created_at DESC
      LIMIT 50
    `;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (e) {
    console.error('Get conversations error:', e);
    res.status(500).json({ error: 'שגיאה בטעינת שיחות' });
  }
});

app.get('/api/messages/with/:user_id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const otherUserId = parseInt(req.params.user_id);
    const branchId = getEffectiveBranchId(req);

    let sql = `
      SELECT m.id, m.sender_id, m.recipient_id, m.content, m.read_at, m.branch_id,
             u.username as sender_username, uw.username as recipient_username,
             TO_CHAR(m.created_at AT TIME ZONE 'Asia/Jerusalem', 'HH24:MI') as time_display,
             m.created_at
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      JOIN users uw ON m.recipient_id = uw.id
      WHERE (m.sender_id = $1 AND m.recipient_id = $2)
         OR (m.sender_id = $2 AND m.recipient_id = $1)
    `;
    const params = [userId, otherUserId];
    let paramIndex = 3;

    if (branchId) {
      sql += ` AND (m.branch_id = $${paramIndex} OR m.branch_id IS NULL)`;
      params.push(branchId);
      paramIndex++;
    }

    sql += ` ORDER BY m.created_at ASC`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (e) {
    console.error('Get messages error:', e);
    res.status(500).json({ error: 'שגיאה בטעינת הודעות' });
  }
});

app.post('/api/messages/read/:user_id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const otherUserId = parseInt(req.params.user_id);

    await query(
      'UPDATE messages SET read_at = NOW() WHERE sender_id = $1 AND recipient_id = $2 AND read_at IS NULL',
      [otherUserId, userId]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Mark read error:', e);
    res.status(500).json({ error: 'שגיאה בעדכון הודעות' });
  }
});

app.get('/api/messages/contacts', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRes = await query(
      `SELECT u.role, COALESCE(w.primary_branch_id, u.branch_id) AS branch_id
       FROM users u LEFT JOIN workers w ON w.id = u.worker_id
       WHERE u.id = $1`,
      [userId]
    );
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });

    let contacts;
    if (user.role === 'admin' || user.role === 'superadmin') {
      const r = await query(
        `SELECT u.id, w.first_name || ' ' || w.family_name AS display_name
         FROM users u JOIN workers w ON w.id = u.worker_id
         WHERE u.role = 'user' AND (w.primary_branch_id = $1 OR u.branch_id = $1) AND u.id != $2
         ORDER BY w.first_name, w.family_name`,
        [user.branch_id, userId]
      );
      contacts = r.rows;
    } else {
      // Workers see all users in their branch
      const r = await query(
        `SELECT u.id, w.first_name || ' ' || w.family_name AS display_name
         FROM users u JOIN workers w ON w.id = u.worker_id
         WHERE (w.primary_branch_id = $1 OR u.branch_id = $1) AND u.id != $2
         ORDER BY w.first_name, w.family_name`,
        [user.branch_id, userId]
      );
      contacts = r.rows;
    }
    res.json(contacts);
  } catch (e) {
    console.error('Contacts error:', e);
    res.status(500).json({ error: 'שגיאה בטעינת אנשי קשר' });
  }
});

// ── Fairness Report ─────────────────────────────────────────────────────────

app.get('/api/fairness-report', requireAdmin, async (req, res) => {
  try {
    const branchId = getEffectiveBranchId(req);

    // Get fairness site ids for this branch
    const fsRes = branchId
      ? await query('SELECT fs.site_id, s.name AS site_name FROM fairness_sites fs JOIN sites s ON fs.site_id = s.id WHERE s.branch_id = $1 ORDER BY s.name', [branchId])
      : await query('SELECT fs.site_id, s.name AS site_name FROM fairness_sites fs JOIN sites s ON fs.site_id = s.id ORDER BY s.name');

    const fairnessSites = fsRes.rows;

    if (fairnessSites.length === 0) {
      return res.json({ sites: [], workers: [] });
    }

    const siteIds = fairnessSites.map(s => s.site_id);
    const placeholders = siteIds.map((_, i) => `$${i + 1}`).join(', ');

    // Get workers for this branch
    const workersRes = branchId
      ? await query('SELECT w.id, w.first_name, w.family_name FROM workers w JOIN worker_branches wb ON wb.worker_id = w.id AND wb.branch_id = $1 AND wb.is_active = TRUE WHERE w.is_active = TRUE ORDER BY w.family_name, w.first_name', [branchId])
      : await query('SELECT id, first_name, family_name FROM workers WHERE is_active = TRUE ORDER BY family_name, first_name');

    // Count assignments per worker per fairness site
    const assignmentsRes = await query(
      `SELECT wsa.worker_id, wsa.site_id, COUNT(*) AS cnt
       FROM worker_site_assignments wsa
       WHERE wsa.site_id IN (${placeholders})
       GROUP BY wsa.worker_id, wsa.site_id`,
      siteIds
    );

    const countMap = {};
    assignmentsRes.rows.forEach(r => {
      if (!countMap[r.worker_id]) countMap[r.worker_id] = {};
      countMap[r.worker_id][r.site_id] = parseInt(r.cnt);
    });

    const workers = workersRes.rows.map(w => {
      const counts = countMap[w.id] || {};
      const total = siteIds.reduce((sum, sid) => sum + (counts[sid] || 0), 0);
      return {
        worker_id: w.id,
        name: `${w.first_name} ${w.family_name}`,
        counts,
        total,
      };
    });

    workers.sort((a, b) => a.total - b.total);

    res.json({ sites: fairnessSites, workers });
  } catch (e) {
    console.error('Fairness report error:', e);
    res.status(500).json({ error: 'שגיאה בטעינת דוח צדק' });
  }
});

// ── Activity Types Endpoints ────────────────────────────────────────────────

app.post('/api/config/activity-types', requireAdmin, async (req, res) => {
  try {
    const { value } = req.body;
    if (!value?.trim()) return res.status(400).json({ error: 'שם סוג פעילות חובה' });
    const branchId = getEffectiveBranchId(req);
    try {
      await query('INSERT INTO activity_types (name, branch_id) VALUES ($1, $2)', [value.trim(), branchId]);
      const config = await getConfig(branchId);
      res.json(config);
    } catch {
      res.status(400).json({ error: 'סוג פעילות כפול' });
    }
  } catch (error) {
    console.error('Add activity type error:', error);
    res.status(500).json({ error: 'שגיאה' });
  }
});

app.put('/api/config/activity-types/:id', requireAdmin, async (req, res) => {
  try {
    const { value } = req.body;
    if (!value?.trim()) return res.status(400).json({ error: 'שם סוג פעילות חובה' });
    const branchId = getEffectiveBranchId(req);
    try {
      const r = await query('UPDATE activity_types SET name=$1 WHERE id=$2 AND branch_id=$3',
        [value.trim(), req.params.id, branchId]);
      if (r.rowCount === 0) return res.status(403).json({ error: 'סוג פעילות לא נמצא בסניף זה' });
      const config = await getConfig(branchId);
      res.json(config);
    } catch {
      res.status(400).json({ error: 'סוג פעילות כפול' });
    }
  } catch (error) {
    console.error('Update activity type error:', error);
    res.status(500).json({ error: 'שגיאה' });
  }
});

app.delete('/api/config/activity-types/:id', requireAdmin, async (req, res) => {
  try {
    const branchId = getEffectiveBranchId(req);
    const r = await query('DELETE FROM activity_types WHERE id=$1 AND branch_id=$2', [req.params.id, branchId]);
    if (r.rowCount === 0) return res.status(403).json({ error: 'סוג פעילות לא נמצא בסניף זה' });
    const config = await getConfig(branchId);
    res.json(config);
  } catch (error) {
    console.error('Delete activity type error:', error);
    res.status(500).json({ error: 'שגיאה' });
  }
});

// Worker site assignments endpoints
app.get('/api/staffing/month-view', requireAdmin, async (req, res) => {
  try {
    const { month, year, siteId } = req.query;
    const branchId = getEffectiveBranchId(req);
    const datePrefix = month && year ? `${year}-${String(month).padStart(2, '0')}-` : null;

    // Get workers (filtered by branch if specified)
    let workersSql = WORKER_SELECT;
    let workersParams = [];
    if (branchId) {
      workersSql += ' JOIN worker_branches wb ON wb.worker_id = w.id AND wb.branch_id = $1 AND wb.is_active = TRUE';
      workersParams = [branchId];
    }
    workersSql += ' ORDER BY w.first_name, w.family_name';
    const workersRes = await query(workersSql, workersParams);
    const workers = workersRes.rows;

    // Get assignments for month (optionally filtered by site)
    let assignmentsQuery = `
      SELECT wsa.id, wsa.worker_id, wsa.date, wsa.site_id,
             wsa.shift_type, wsa.start_time, wsa.end_time, wsa.notes,
             s.name AS site_name,
             w.first_name, w.family_name, jt.name AS job_name
      FROM worker_site_assignments wsa
      JOIN sites s ON wsa.site_id = s.id
      JOIN workers w ON wsa.worker_id = w.id
      LEFT JOIN job_titles jt ON w.job_id = jt.id
    `;

    const params = [];
    let paramIndex = 1;

    if (datePrefix) {
      assignmentsQuery += ` WHERE wsa.date LIKE $${paramIndex}`;
      params.push(datePrefix + '%');
      paramIndex++;
    }

    if (siteId) {
      assignmentsQuery += (datePrefix ? ' AND' : ' WHERE') + ` wsa.site_id = $${paramIndex}`;
      params.push(siteId);
    }

    assignmentsQuery += ' ORDER BY wsa.date, wsa.site_id, wsa.shift_type, wsa.worker_id';

    const assignmentsRes = await query(assignmentsQuery, params);
    const siteAssignments = assignmentsRes.rows;

    // Get site shift activities for the month
    let activitiesQuery = `
      SELECT ssa.id, ssa.site_id, ssa.date, ssa.shift_type,
             ssa.activity_type_id, at.name AS activity_name
      FROM site_shift_activities ssa
      LEFT JOIN activity_types at ON ssa.activity_type_id = at.id
    `;

    const actParams = [];
    let actParamIndex = 1;

    if (datePrefix) {
      activitiesQuery += ` WHERE ssa.date LIKE $${actParamIndex}`;
      actParams.push(datePrefix + '%');
      actParamIndex++;
    }

    if (siteId) {
      activitiesQuery += (datePrefix ? ' AND' : ' WHERE') + ` ssa.site_id = $${actParamIndex}`;
      actParams.push(siteId);
    }

    activitiesQuery += ' ORDER BY ssa.date, ssa.site_id, ssa.shift_type';

    const activitiesRes = await query(activitiesQuery, actParams);
    const siteShiftActivities = activitiesRes.rows;

    res.json({ workers, siteAssignments, siteShiftActivities });
  } catch (error) {
    console.error('Get month view error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת תצוגת חודש' });
  }
});

// Suggest assignments endpoint
app.get('/api/staffing/suggest-debug', requireAdmin, (_, res) => {
  res.json({ status: 'suggest endpoint is working', date: new Date().toISOString() });
});

app.get('/api/staffing/suggest', requireAdmin, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'תאריך חסר' });
    }
    const branchId = getEffectiveBranchId(req);

    // Get sites (filtered by branch via direct branch_id column)
    const sitesRes = branchId
      ? await query(`
          SELECT s.id, s.name, s.group_id, sg.name AS group_name
          FROM sites s
          LEFT JOIN site_groups sg ON s.group_id = sg.id
          WHERE s.branch_id = $1
          ORDER BY s.name
        `, [branchId])
      : await query(`
          SELECT s.id, s.name, s.group_id, sg.name AS group_name
          FROM sites s
          LEFT JOIN site_groups sg ON s.group_id = sg.id
          ORDER BY s.name
        `);
    const sites = sitesRes.rows;

    // Get allowed jobs per site group (filtered by branch)
    const groupAllowedJobs = new Map(); // group_id -> Set<job_id>
    try {
      const allowedJobsRes = branchId
        ? await query(`
            SELECT sgaj.group_id, sgaj.job_id
            FROM site_group_allowed_jobs sgaj
            JOIN site_groups sg ON sgaj.group_id = sg.id
            WHERE sg.branch_id = $1
          `, [branchId])
        : await query(`SELECT group_id, job_id FROM site_group_allowed_jobs`);
      allowedJobsRes.rows.forEach(row => {
        if (!groupAllowedJobs.has(row.group_id)) groupAllowedJobs.set(row.group_id, new Set());
        groupAllowedJobs.get(row.group_id).add(row.job_id);
      });
    } catch (e) {
      console.warn('site_group_allowed_jobs not available:', e.message);
    }

    // Get workers who requested shifts for the date (can or prefer)
    const shiftsRes = branchId
      ? await query(`
          SELECT sr.shift_type, sr.preference_type,
                 w.id AS worker_id, w.first_name, w.family_name, w.job_id
          FROM shift_requests sr
          JOIN users u ON sr.user_id = u.id
          JOIN workers w ON u.worker_id = w.id
          JOIN worker_branches wb ON wb.worker_id = w.id AND wb.branch_id = $2
          WHERE sr.date = $1 AND sr.branch_id = $2 AND sr.preference_type IN ('can', 'prefer') AND wb.is_active = TRUE
          ORDER BY CASE sr.preference_type WHEN 'prefer' THEN 0 ELSE 1 END,
                   w.first_name, w.family_name
        `, [date, branchId])
      : await query(`
          SELECT sr.shift_type, sr.preference_type,
                 w.id AS worker_id, w.first_name, w.family_name, w.job_id
          FROM shift_requests sr
          JOIN users u ON sr.user_id = u.id
          JOIN workers w ON u.worker_id = w.id
          WHERE sr.date = $1 AND sr.preference_type IN ('can', 'prefer')
          ORDER BY CASE sr.preference_type WHEN 'prefer' THEN 0 ELSE 1 END,
                   w.first_name, w.family_name
        `, [date]);

    // Build available workers per shift: shift_type -> [{worker_id, name, job_id, preference_type}]
    const availableByShift = { morning: [], evening: [], night: [] };
    shiftsRes.rows.forEach(r => {
      if (availableByShift[r.shift_type]) {
        availableByShift[r.shift_type].push({
          worker_id: r.worker_id,
          first_name: r.first_name,
          family_name: r.family_name,
          job_id: r.job_id,
          preference_type: r.preference_type,
        });
      }
    });

    // Workers already assigned somewhere on this date in this branch (per shift type)
    const assignedRes = branchId
      ? await query(`
          SELECT wsa.worker_id, wsa.shift_type
          FROM worker_site_assignments wsa
          JOIN sites s ON wsa.site_id = s.id
          WHERE wsa.date = $1 AND s.branch_id = $2
        `, [date, branchId])
      : await query(`SELECT worker_id, shift_type FROM worker_site_assignments WHERE date = $1`, [date]);
    const workerAssigned = new Set();
    assignedRes.rows.forEach(r => workerAssigned.add(`${r.worker_id}-${r.shift_type}`));
    console.log('=== SUGGEST DEBUG ===');
    console.log('date param:', JSON.stringify(date));
    console.log('existing assignments:', JSON.stringify(assignedRes.rows));

    // Open slots: configured activity AND no worker assigned yet, scoped to branch
    const openSlotsRes = branchId
      ? await query(`
          SELECT ssa.site_id, ssa.shift_type, ssa.activity_type_id
          FROM site_shift_activities ssa
          JOIN sites s ON ssa.site_id = s.id
          WHERE ssa.date = $1
            AND s.branch_id = $2
            AND ssa.activity_type_id IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM worker_site_assignments wsa
              WHERE wsa.site_id    = ssa.site_id
                AND wsa.date       = $1
                AND wsa.shift_type = ssa.shift_type
            )
        `, [date, branchId])
      : await query(`
          SELECT ssa.site_id, ssa.shift_type, ssa.activity_type_id
          FROM site_shift_activities ssa
          WHERE ssa.date = $1
            AND ssa.activity_type_id IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM worker_site_assignments wsa
              WHERE wsa.site_id    = ssa.site_id
                AND wsa.date       = $1
                AND wsa.shift_type = ssa.shift_type
            )
        `, [date]);
    console.log('open slots from SQL:', JSON.stringify(openSlotsRes.rows));

    // Fetch activity authorizations for all workers who requested shifts
    const workerIds = [...new Set(shiftsRes.rows.map(r => r.worker_id))];
    const workerAuthSet = new Map(); // worker_id -> Set<activity_type_id>
    if (workerIds.length > 0) {
      const placeholders = workerIds.map((_, i) => `$${i + 1}`).join(', ');
      const authRes = await query(
        `SELECT worker_id, activity_type_id FROM worker_activity_authorizations WHERE worker_id IN (${placeholders})`,
        workerIds
      );
      authRes.rows.forEach(r => {
        if (!workerAuthSet.has(r.worker_id)) workerAuthSet.set(r.worker_id, new Set());
        workerAuthSet.get(r.worker_id).add(r.activity_type_id);
      });
    }

    // Fetch fairness scores: count assignments per worker to fairness-designated sites (branch-scoped)
    const fairnessCountByWorker = new Map();
    let fairnessSiteSet = new Set();
    try {
      const fRes = branchId
        ? await query(`
            SELECT fs.site_id FROM fairness_sites fs
            JOIN sites s ON fs.site_id = s.id
            WHERE s.branch_id = $1
          `, [branchId])
        : await query('SELECT site_id FROM fairness_sites');
      const fIds = fRes.rows.map(r => r.site_id);
      fairnessSiteSet = new Set(fIds);
      if (fIds.length > 0) {
        const placeholders = fIds.map((_, i) => `$${i + 1}`).join(', ');
        const cRes = await query(
          `SELECT worker_id, COUNT(*) AS cnt FROM worker_site_assignments WHERE site_id IN (${placeholders}) GROUP BY worker_id`,
          fIds
        );
        cRes.rows.forEach(r => fairnessCountByWorker.set(r.worker_id, parseInt(r.cnt)));
      }
    } catch (e) {
      console.warn('Fairness fetch failed, skipping:', e.message);
    }

    // Build slotsByShift directly from SQL results — no JS type-comparison needed
    const siteMap = new Map(sites.map(s => [s.id, s]));
    const slotsByShift = {};
    openSlotsRes.rows.forEach(r => {
      const site = siteMap.get(r.site_id);
      if (!site) return;
      const allowedJobs = site.group_id ? groupAllowedJobs.get(site.group_id) : null;
      const hasRestriction = allowedJobs && allowedJobs.size > 0;
      if (!slotsByShift[r.shift_type]) slotsByShift[r.shift_type] = [];
      slotsByShift[r.shift_type].push({ site, shift: r.shift_type, hasRestriction, allowedJobs, activity_type_id: r.activity_type_id });
    });

    const suggestions = [];
    const unassignable = [];

    // Maximum bipartite matching per shift type.
    // Each shift is solved independently: workers ↔ slots.
    // Augmenting paths allow previously-assigned workers to be re-routed,
    // guaranteeing the maximum number of slots filled.
    // Within each adjacency list, "prefer" workers are tried before "can" workers.
    for (const [shift, shiftSlots] of Object.entries(slotsByShift)) {
      // Workers available for this shift (not already assigned on this date+shift)
      const shiftWorkers = (availableByShift[shift] || [])
        .filter(w => !workerAssigned.has(`${w.worker_id}-${shift}`));

      // adjacency[slotIdx] = sorted array of eligible workerIdx (prefer first)
      const adjacency = shiftSlots.map(slot => {
        return shiftWorkers
          .map((w, idx) => {
            const jobOk = !slot.hasRestriction || slot.allowedJobs.has(w.job_id);
            const workerAuths = workerAuthSet.get(w.worker_id);
            const authOk = !slot.activity_type_id || !workerAuths || workerAuths.has(slot.activity_type_id);
            return { idx, preferFirst: w.preference_type === 'prefer' ? 0 : 1, eligible: jobOk && authOk };
          })
          .filter(e => e.eligible)
          .sort((a, b) => {
            if (a.preferFirst !== b.preferFirst) return a.preferFirst - b.preferFirst;
            return (fairnessCountByWorker.get(shiftWorkers[a.idx].worker_id) ?? 0)
                 - (fairnessCountByWorker.get(shiftWorkers[b.idx].worker_id) ?? 0);
          })
          .map(e => e.idx);
      });

      // Hopcroft-Karp style augmenting path (simple DFS variant)
      const matchSlot   = new Array(shiftSlots.length).fill(-1);  // slotIdx  → workerIdx
      const matchWorker = new Array(shiftWorkers.length).fill(-1); // workerIdx → slotIdx

      const augment = (sIdx, visited) => {
        for (const wIdx of adjacency[sIdx]) {
          if (visited.has(wIdx)) continue;
          visited.add(wIdx);
          // Worker is free, or we can find an alternative slot for their current assignment
          if (matchWorker[wIdx] === -1 || augment(matchWorker[wIdx], visited)) {
            matchSlot[sIdx]   = wIdx;
            matchWorker[wIdx] = sIdx;
            return true;
          }
        }
        return false;
      };

      for (let sIdx = 0; sIdx < shiftSlots.length; sIdx++) {
        augment(sIdx, new Set());
      }

      // Build suggestions and unassignable from matching result
      shiftSlots.forEach((slot, sIdx) => {
        const wIdx = matchSlot[sIdx];
        if (wIdx !== -1) {
          const worker = shiftWorkers[wIdx];
          suggestions.push({
            site_id: slot.site.id,
            site_name: slot.site.name,
            group_name: slot.site.group_name,
            shift_type: shift,
            worker_id: worker.worker_id,
            worker_name: `${worker.first_name} ${worker.family_name}`,
            preference_type: worker.preference_type,
            fairness_count: fairnessCountByWorker.get(worker.worker_id) ?? 0,
            is_fairness_site: fairnessSiteSet.has(slot.site.id),
          });
        } else {
          const allForShift = availableByShift[shift] || [];
          const ineligible = allForShift.filter(w => {
            const jobOk = !slot.hasRestriction || slot.allowedJobs.has(w.job_id);
            const workerAuths = workerAuthSet.get(w.worker_id);
            const authOk = !slot.activity_type_id || !workerAuths || workerAuths.has(slot.activity_type_id);
            return !jobOk || !authOk;
          });
          if (ineligible.length > 0 || slot.hasRestriction || slot.activity_type_id) {
            const reason = ineligible.length > 0
              ? `${ineligible.length} עובד/ים ביקשו את המשמרת אך חסרה להם הרשאה`
              : 'אף עובד מורשה לא ביקש משמרת זו';
            unassignable.push({
              site_id: slot.site.id,
              site_name: slot.site.name,
              group_name: slot.site.group_name,
              shift_type: shift,
              reason,
              unavailable_workers: ineligible.slice(0, 5).map(w => ({
                name: `${w.first_name} ${w.family_name}`,
                reason: !slot.allowedJobs?.has(w.job_id) ? 'תפקיד לא מורשה לקבוצה זו' : 'אין הרשאה לסוג פעילות זה',
              })),
            });
          }
        }
      });
    }

    // Safety filter: re-query assignments (branch-scoped) and strip any suggestion that slipped through
    const finalCheckRes = branchId
      ? await query(`
          SELECT wsa.worker_id, wsa.site_id, wsa.shift_type
          FROM worker_site_assignments wsa
          JOIN sites s ON wsa.site_id = s.id
          WHERE wsa.date = $1 AND s.branch_id = $2
        `, [date, branchId])
      : await query(`SELECT worker_id, site_id, shift_type FROM worker_site_assignments WHERE date = $1`, [date]);
    const staffedSlotsFinal  = new Set(finalCheckRes.rows.map(r => `${r.site_id}-${r.shift_type}`));
    const workerBusyFinal    = new Set(finalCheckRes.rows.map(r => `${r.worker_id}-${r.shift_type}`));
    const safeSuggestions = suggestions.filter(s =>
      !staffedSlotsFinal.has(`${s.site_id}-${s.shift_type}`) &&
      !workerBusyFinal.has(`${s.worker_id}-${s.shift_type}`)
    );
    console.log('raw suggestions:', JSON.stringify(suggestions.map(s => ({ site: s.site_name, shift: s.shift_type, worker: s.worker_name }))));
    console.log('after safety filter:', JSON.stringify(safeSuggestions.map(s => ({ site: s.site_name, shift: s.shift_type, worker: s.worker_name }))));

    res.json({ suggestions: safeSuggestions, unassignable });
  } catch (error) {
    console.error('Suggest assignments error:', error);
    res.status(500).json({ error: 'שגיאה בהצעת שיבוצים' });
  }
});

app.post('/api/worker-site-assignments', requireAdmin, async (req, res) => {
  try {
    const { worker_id, date, site_id, shift_type, start_time, end_time, notes } = req.body;
    const shiftType = shift_type || 'morning';

    if (!worker_id || !date || !site_id) {
      return res.status(400).json({ error: 'שדות חסרים' });
    }
    if (!['morning', 'evening', 'night'].includes(shiftType)) {
      return res.status(400).json({ error: 'סוג משמרת לא תקין' });
    }

    // Check if site has an activity type set for this shift/date
    const activityRes = await query(`
      SELECT activity_type_id FROM site_shift_activities
      WHERE site_id = $1 AND date = $2 AND shift_type = $3
    `, [site_id, date, shiftType]);

    if (activityRes.rows.length > 0) {
      const activityTypeId = activityRes.rows[0].activity_type_id;
      if (activityTypeId) {
        const totalAuthRes = await query(
          `SELECT COUNT(*) as count FROM worker_activity_authorizations WHERE worker_id = $1`,
          [worker_id]
        );
        const hasAnyAuth = parseInt(totalAuthRes.rows[0].count) > 0;
        if (hasAnyAuth) {
          const specificAuthRes = await query(
            `SELECT COUNT(*) as count FROM worker_activity_authorizations WHERE worker_id = $1 AND activity_type_id = $2`,
            [worker_id, activityTypeId]
          );
          if (parseInt(specificAuthRes.rows[0].count) === 0) {
            return res.status(403).json({ error: 'עובד לא מורשה לסוג פעילות זה' });
          }
        }
      }
    }

    // Check if worker's job matches site group restrictions
    const siteGroupRes = await query(`
      SELECT s.group_id FROM sites s WHERE s.id = $1
    `, [site_id]);

    if (siteGroupRes.rows.length > 0 && siteGroupRes.rows[0].group_id) {
      const groupId = siteGroupRes.rows[0].group_id;
      const allowedJobsRes = await query(`
        SELECT job_id FROM site_group_allowed_jobs WHERE group_id = $1
      `, [groupId]);

      if (allowedJobsRes.rows.length > 0) {
        // Group has restrictions, check if worker's job is allowed
        const workerRes = await query(`
          SELECT job_id FROM workers WHERE id = $1
        `, [worker_id]);

        if (workerRes.rows.length > 0) {
          const workerJobId = workerRes.rows[0].job_id;
          const isJobAllowed = allowedJobsRes.rows.some(row => row.job_id === workerJobId);
          if (!isJobAllowed) {
            return res.status(403).json({ error: 'תפקיד העובד לא מורשה לקבוצת אתרים זו' });
          }
        }
      }
    }

    // Check if worker is on approved vacation on this date
    const workerVacCheck = await query(
      `SELECT vr.id FROM vacation_requests vr
       JOIN users u ON vr.user_id = u.id
       WHERE u.worker_id = $1 AND vr.status IN ('approved', 'partial')
       AND vr.approved_start <= $2 AND vr.approved_end >= $2`,
      [worker_id, date]
    );
    if (workerVacCheck.rows.length > 0) {
      return res.status(409).json({ error: 'לא ניתן לשבץ עובד זה — קיים חופש מאושר בתאריך זה' });
    }

    await query(`
      INSERT INTO worker_site_assignments (worker_id, date, site_id, shift_type, start_time, end_time, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT(worker_id, date, site_id, shift_type) DO UPDATE SET
        start_time = excluded.start_time,
        end_time   = excluded.end_time,
        notes      = excluded.notes
    `, [worker_id, date, site_id, shiftType, start_time || null, end_time || null, notes || null]);

    res.json({ ok: true });
  } catch (err) {
    console.error('Error saving assignment:', err);
    res.status(400).json({ error: 'שגיאה בשמירת השיבוץ' });
  }
});

app.put('/api/worker-site-assignments/:id', requireAdmin, async (req, res) => {
  try {
    const { start_time, end_time, notes } = req.body;
    const updateRes = await query(`
      UPDATE worker_site_assignments SET start_time = $1, end_time = $2, notes = $3 WHERE id = $4
    `, [start_time || null, end_time || null, notes || null, req.params.id]);
    
    if (updateRes.rowCount === 0) return res.status(404).json({ error: 'שיבוץ לא נמצא' });
    res.json({ ok: true });
  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון שיבוץ' });
  }
});

app.delete('/api/worker-site-assignments/:id', requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM worker_site_assignments WHERE id=$1', [req.params.id]);
    res.status(204).send();
  } catch (error) {
    console.error('Delete assignment error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת שיבוץ' });
  }
});

// ── Site Shift Activities ──────────────────────────────────────────────────

app.post('/api/site-shift-activities', requireAdmin, async (req, res) => {
  try {
    const { site_id, date, shift_type, activity_type_id } = req.body;

    if (!site_id || !date || !shift_type) {
      return res.status(400).json({ error: 'שדות חסרים' });
    }
    if (!['morning', 'evening', 'night'].includes(shift_type)) {
      return res.status(400).json({ error: 'סוג משמרת לא תקין' });
    }

    // Upsert: insert or update
    if (activity_type_id) {
      await query(`
        INSERT INTO site_shift_activities (site_id, date, shift_type, activity_type_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT(site_id, date, shift_type) DO UPDATE SET
          activity_type_id = excluded.activity_type_id
      `, [site_id, date, shift_type, activity_type_id]);
    } else {
      // If no activity_type_id, delete the entry
      await query(`
        DELETE FROM site_shift_activities
        WHERE site_id = $1 AND date = $2 AND shift_type = $3
      `, [site_id, date, shift_type]);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error saving site shift activity:', error);
    res.status(500).json({ error: 'שגיאה בשמירת פעילות' });
  }
});

app.delete('/api/site-shift-activities/:id', requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM site_shift_activities WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (error) {
    console.error('Delete site shift activity error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת פעילות' });
  }
});

// ── Activity Templates Endpoints ─────────────────────────────────────────

// Get all templates with their items
app.get('/api/config/activity-templates', requireAdmin, async (req, res) => {
  try {
    const branchId = getEffectiveBranchId(req);
    const templatesRes = branchId
      ? await query(`SELECT id, name, created_at FROM activity_templates WHERE branch_id=$1 ORDER BY name`, [branchId])
      : await query(`SELECT id, name, created_at FROM activity_templates ORDER BY name`);

    const templates = [];
    for (const template of templatesRes.rows) {
      const itemsRes = await query(`
        SELECT ati.id, ati.site_id, ati.shift_type, ati.activity_type_id,
               s.name AS site_name, at.name AS activity_type_name
        FROM activity_template_items ati
        JOIN sites s ON ati.site_id = s.id
        JOIN activity_types at ON ati.activity_type_id = at.id
        WHERE ati.template_id = $1
        ORDER BY s.name, ati.shift_type
      `, [template.id]);

      templates.push({
        ...template,
        items: itemsRes.rows
      });
    }

    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'שגיאה בטעינת תבניות' });
  }
});

// Create template
app.post('/api/config/activity-templates', requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'שם התבנית חובה' });
    }

    const branchId = getEffectiveBranchId(req);
    const result = await query(
      'INSERT INTO activity_templates (name, branch_id) VALUES ($1, $2) RETURNING id, name, created_at',
      [name.trim(), branchId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating template:', error);
    if (error.message.includes('unique')) {
      res.status(409).json({ error: 'תבנית בשם זה כבר קיימת' });
    } else {
      res.status(500).json({ error: 'שגיאה בשמירת התבנית' });
    }
  }
});

// Rename template
app.put('/api/config/activity-templates/:id', requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'שם התבנית חובה' });
    }
    const branchId = getEffectiveBranchId(req);
    const r = await query('UPDATE activity_templates SET name = $1 WHERE id = $2 AND branch_id IS NOT DISTINCT FROM $3',
      [name.trim(), req.params.id, branchId]);
    if (r.rowCount === 0) return res.status(403).json({ error: 'תבנית לא נמצאת בסניף זה' });
    res.json({ ok: true });
  } catch (error) {
    console.error('Error renaming template:', error);
    if (error.message.includes('unique')) {
      res.status(409).json({ error: 'תבנית בשם זה כבר קיימת' });
    } else {
      res.status(500).json({ error: 'שגיאה בשינוי שם התבנית' });
    }
  }
});

// Delete template
app.delete('/api/config/activity-templates/:id', requireAdmin, async (req, res) => {
  try {
    const branchId = getEffectiveBranchId(req);
    const r = await query('DELETE FROM activity_templates WHERE id = $1 AND branch_id IS NOT DISTINCT FROM $2',
      [req.params.id, branchId]);
    if (r.rowCount === 0) return res.status(403).json({ error: 'תבנית לא נמצאת בסניף זה' });
    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'שגיאה במחיקת התבנית' });
  }
});

// Update template items
app.put('/api/config/activity-templates/:id/items', requireAdmin, async (req, res) => {
  try {
    const { items } = req.body;
    const templateId = req.params.id;

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items must be an array' });
    }

    const branchId = getEffectiveBranchId(req);
    const tmpl = await query('SELECT id FROM activity_templates WHERE id = $1 AND branch_id IS NOT DISTINCT FROM $2',
      [templateId, branchId]);
    if (tmpl.rowCount === 0) return res.status(403).json({ error: 'תבנית לא נמצאת בסניף זה' });

    // Delete existing items
    await query('DELETE FROM activity_template_items WHERE template_id = $1', [templateId]);

    // Insert new items
    for (const item of items) {
      const { site_id, shift_type, activity_type_id } = item;
      if (!site_id || !shift_type || !activity_type_id) {
        return res.status(400).json({ error: 'Missing required fields in item' });
      }
      await query(`
        INSERT INTO activity_template_items (template_id, site_id, shift_type, activity_type_id)
        VALUES ($1, $2, $3, $4)
      `, [templateId, site_id, shift_type, activity_type_id]);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error updating template items:', error);
    res.status(500).json({ error: 'שגיאה בעדכון פעולות התבנית' });
  }
});

// Apply template to a date
app.post('/api/config/activity-templates/:id/apply', requireAdmin, async (req, res) => {
  try {
    const { date } = req.body;
    const templateId = req.params.id;

    if (!date) {
      return res.status(400).json({ error: 'תאריך חובה' });
    }

    const branchId = getEffectiveBranchId(req);
    const tmpl = await query('SELECT id FROM activity_templates WHERE id = $1 AND branch_id IS NOT DISTINCT FROM $2',
      [templateId, branchId]);
    if (tmpl.rowCount === 0) return res.status(403).json({ error: 'תבנית לא נמצאת בסניף זה' });

    // Insert template items into site_shift_activities, ignoring conflicts
    await query(`
      INSERT INTO site_shift_activities (site_id, date, shift_type, activity_type_id)
      SELECT site_id, $1, shift_type, activity_type_id
      FROM activity_template_items
      WHERE template_id = $2
      ON CONFLICT(site_id, date, shift_type) DO NOTHING
    `, [date, templateId]);

    res.json({ ok: true });
  } catch (error) {
    console.error('Error applying template:', error);
    res.status(500).json({ error: 'שגיאה בהחלת התבנית' });
  }
});

// Debug endpoint to check site_group_allowed_jobs table
app.get('/api/admin/debug/table-contents', requireAdmin, async (req, res) => {
  try {
    const tableExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'site_group_allowed_jobs'
      );
    `);

    const contents = await query('SELECT * FROM site_group_allowed_jobs').catch(() => null);

    res.json({
      tableExists: tableExists.rows[0],
      contents: contents?.rows || 'Query failed - table may not exist',
      debug: 'Check browser console for actual data'
    });
  } catch (error) {
    res.json({ error: error.message, table_exists: false });
  }
});

// Temporary endpoint to ensure site_group_allowed_jobs table exists
app.post('/api/admin/init-table', requireAdmin, async (req, res) => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS site_group_allowed_jobs (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES site_groups(id) ON DELETE CASCADE,
        job_id INTEGER NOT NULL REFERENCES job_titles(id) ON DELETE CASCADE,
        UNIQUE(group_id, job_id)
      );
    `);
    res.json({ ok: true, message: 'Table created successfully' });
  } catch (error) {
    console.error('Error creating table:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── Branches ─────────────────────────────────────────────────────────────────

app.get('/api/branches', requireAdmin, async (req, res) => {
  try {
    if (req.user.role === 'superadmin') {
      const result = await query('SELECT id, name, description, created_at FROM branches ORDER BY id');
      res.json(result.rows);
    } else {
      // admin sees only their own branch
      const branchId = req.user.branch_id;
      if (!branchId) return res.json([]);
      const result = await query('SELECT id, name, description, created_at FROM branches WHERE id = $1', [branchId]);
      res.json(result.rows);
    }
  } catch (error) {
    console.error('Get branches error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת סניפים' });
  }
});

app.get('/api/branches/overview', requireSuperAdmin, async (req, res) => {
  try {
    const [branches, empBreakdown] = await Promise.all([
      query(`
        SELECT b.id, b.name, b.description,
               COUNT(DISTINCT w.id)::int AS worker_count,
               COUNT(DISTINCT CASE WHEN w.is_active = true THEN w.id END)::int AS active_worker_count
        FROM branches b
        LEFT JOIN worker_branches wb ON wb.branch_id = b.id
        LEFT JOIN workers w ON w.id = wb.worker_id AND w.primary_branch_id = b.id
        GROUP BY b.id, b.name, b.description
        ORDER BY b.id
      `),
      query(`
        SELECT wb.branch_id,
               COALESCE(et.name, 'לא מוגדר') AS emp_type_name,
               COUNT(*)::int AS active_count
        FROM worker_branches wb
        JOIN workers w ON w.id = wb.worker_id AND w.primary_branch_id = wb.branch_id AND w.is_active = true
        LEFT JOIN employment_types et ON et.id = w.employment_type_id
        GROUP BY wb.branch_id, et.id, et.name
        ORDER BY et.name NULLS LAST
      `),
    ]);
    const byBranch = {};
    for (const row of empBreakdown.rows) {
      if (!byBranch[row.branch_id]) byBranch[row.branch_id] = [];
      byBranch[row.branch_id].push({ name: row.emp_type_name, count: row.active_count });
    }
    const result = branches.rows.map(b => ({ ...b, emp_type_breakdown: byBranch[b.id] || [] }));
    res.json(result);
  } catch (error) {
    console.error('Get branches overview error:', error);
    res.status(500).json({ error: 'שגיאה' });
  }
});

app.get('/api/dashboard-stats', requireSuperAdmin, async (req, res) => {
  try {
    const [summary, byType] = await Promise.all([
      query(`
        SELECT
          COUNT(*)::int AS total_workers,
          COUNT(CASE WHEN is_active = true THEN 1 END)::int AS active_workers,
          COUNT(CASE WHEN is_active = false THEN 1 END)::int AS inactive_workers
        FROM workers
      `),
      query(`
        SELECT
          COALESCE(et.name, 'לא מוגדר') AS name,
          et.is_independent,
          COUNT(CASE WHEN w.is_active = true THEN 1 END)::int AS active_count,
          COUNT(*)::int AS total_count
        FROM workers w
        LEFT JOIN employment_types et ON et.id = w.employment_type_id
        GROUP BY et.id, et.name, et.is_independent
        ORDER BY et.name NULLS LAST
      `),
    ]);
    res.json({ ...summary.rows[0], by_type: byType.rows });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'שגיאה' });
  }
});

app.post('/api/branches', requireSuperAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'שם סניף חובה' });
    try {
      const result = await query(
        'INSERT INTO branches (name, description) VALUES ($1, $2) RETURNING id, name, description, created_at',
        [name.trim(), description?.trim() || null]
      );
      res.status(201).json(result.rows[0]);
    } catch {
      res.status(400).json({ error: 'שם סניף כפול' });
    }
  } catch (error) {
    console.error('Create branch error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת סניף' });
  }
});

app.put('/api/branches/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'שם סניף חובה' });
    try {
      const result = await query(
        'UPDATE branches SET name=$1, description=$2 WHERE id=$3 RETURNING id, name, description',
        [name.trim(), description?.trim() || null, req.params.id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'סניף לא נמצא' });
      res.json(result.rows[0]);
    } catch {
      res.status(400).json({ error: 'שם סניף כפול' });
    }
  } catch (error) {
    console.error('Update branch error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון סניף' });
  }
});

app.delete('/api/branches/:id', requireSuperAdmin, async (req, res) => {
  try {
    const branchId = req.params.id;
    const workerCheck = await query('SELECT COUNT(*) AS c FROM worker_branches WHERE branch_id = $1', [branchId]);
    if (parseInt(workerCheck.rows[0].c) > 0) {
      return res.status(400).json({ error: 'לא ניתן למחוק סניף עם עובדים משויכים' });
    }
    await query('DELETE FROM branches WHERE id=$1', [branchId]);
    res.status(204).send();
  } catch (error) {
    console.error('Delete branch error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת סניף' });
  }
});

// ── Worker-Branch Management ──────────────────────────────────────────────────

app.get('/api/workers/:id/branches', requireAuth, async (req, res) => {
  try {
    const workerId = req.params.id;
    // Workers can see their own branches; admins/superadmin can see any
    if (req.user.role === 'user' && req.user.worker_id != workerId) {
      return res.status(403).json({ error: 'אין הרשאה' });
    }
    const result = await query(`
      SELECT wb.branch_id, wb.is_active, b.name AS branch_name
      FROM worker_branches wb
      JOIN branches b ON wb.branch_id = b.id
      WHERE wb.worker_id = $1
      ORDER BY b.name
    `, [workerId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Get worker branches error:', error);
    res.status(500).json({ error: 'שגיאה' });
  }
});

app.post('/api/workers/:id/branches', requireSuperAdmin, async (req, res) => {
  try {
    const { branch_id } = req.body;
    if (!branch_id) return res.status(400).json({ error: 'branch_id חסר' });
    try {
      await query(
        'INSERT INTO worker_branches (worker_id, branch_id, is_active) VALUES ($1, $2, TRUE)',
        [req.params.id, branch_id]
      );
    } catch (e) {
      if (e.message?.includes('unique') || e.message?.includes('duplicate')) {
        return res.status(400).json({ error: 'עובד כבר משויך לסניף זה' });
      }
      throw e;
    }
    const result = await query(`
      SELECT wb.branch_id, wb.is_active, b.name AS branch_name
      FROM worker_branches wb JOIN branches b ON wb.branch_id = b.id
      WHERE wb.worker_id = $1 ORDER BY b.name
    `, [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Add worker branch error:', error);
    res.status(500).json({ error: 'שגיאה' });
  }
});

app.put('/api/workers/:id/branches/:branchId', requireSuperAdmin, async (req, res) => {
  try {
    const { is_active } = req.body;
    await query(
      'UPDATE worker_branches SET is_active=$1 WHERE worker_id=$2 AND branch_id=$3',
      [is_active, req.params.id, req.params.branchId]
    );
    const result = await query(`
      SELECT wb.branch_id, wb.is_active, b.name AS branch_name
      FROM worker_branches wb JOIN branches b ON wb.branch_id = b.id
      WHERE wb.worker_id = $1 ORDER BY b.name
    `, [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Update worker branch error:', error);
    res.status(500).json({ error: 'שגיאה' });
  }
});

app.delete('/api/workers/:id/branches/:branchId', requireSuperAdmin, async (req, res) => {
  try {
    await query('DELETE FROM worker_branches WHERE worker_id=$1 AND branch_id=$2',
      [req.params.id, req.params.branchId]);
    res.status(204).send();
  } catch (error) {
    console.error('Delete worker branch error:', error);
    res.status(500).json({ error: 'שגיאה' });
  }
});

const PORT = process.env.PORT || 5001;

async function start() {
  try {
    await initializeApp();
    app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

