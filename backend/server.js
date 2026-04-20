require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const { query, pool, initializeSchema, ensureSiteGroupAllowedJobsTable } = require('./db');

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

    // Seed site groups with colors
    for (const [name, color] of Object.entries(groupColors)) {
      await query('INSERT INTO site_groups (name, color) VALUES ($1, $2) ON CONFLICT DO NOTHING', [name, color]);
    }

    // Seed sites (resolve group name → id at runtime)
    const groupIdCache = {};
    for (const site of sites) {
      if (!groupIdCache[site.groupName]) {
        const res = await query('SELECT id FROM site_groups WHERE name = $1', [site.groupName]);
        groupIdCache[site.groupName] = res.rows[0]?.id;
      }
      await query('INSERT INTO sites (name, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [site.name, groupIdCache[site.groupName]]);
    }

    // Seed shift types
    for (const st of shiftTypes) {
      await query(
        `INSERT INTO shift_types (key, label_he, label_short, default_start, default_end, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (key) DO NOTHING`,
        [st.key, st.label_he, st.label_short, st.default_start, st.default_end, st.sort_order]
      );
    }

    // Seed preference types
    for (const pt of preferenceTypes) {
      await query(
        `INSERT INTO preference_types (key, label_he, sort_order)
         VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING`,
        [pt.key, pt.label_he, pt.sort_order]
      );
    }

    // Bootstrap admin user
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminCheck = await query('SELECT COUNT(*) as c FROM users WHERE username = $1', [adminUsername]);
    if (parseInt(adminCheck.rows[0].c) === 0) {
      await query(
        'INSERT INTO users (username, password_hash, role, must_change_password) VALUES ($1, $2, $3, $4)',
        [adminUsername, bcrypt.hashSync(adminPassword, 8), 'admin', 0]
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
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'אין הרשאה' });
    next();
  });
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
    await createUserForWorker(worker_id, id_number, classification, email);
  }
}

// ── Config helpers ───────────────────────────────────────────────────────────

async function getConfig() {
  try {
    const res = await Promise.all([
      query('SELECT id, name FROM job_titles ORDER BY id'),
      query('SELECT id, name, is_independent FROM employment_types ORDER BY id'),
      query('SELECT id, name FROM honorifics ORDER BY id'),
      query('SELECT id, name, color FROM site_groups ORDER BY id'),
      query('SELECT id, name, description, group_id FROM sites ORDER BY name'),
      query('SELECT id, name FROM activity_types ORDER BY name'),
      query('SELECT key, label_he, label_short, default_start, default_end, sort_order FROM shift_types ORDER BY sort_order'),
      query('SELECT key, label_he, sort_order FROM preference_types ORDER BY sort_order'),
    ]);

    // Try to get allowed jobs, but don't fail if table doesn't exist
    let allowedJobsByGroup = {};
    try {
      const allowedJobsRes = await query(`
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
      const fRes = await query('SELECT site_id FROM fairness_sites ORDER BY site_id');
      fairnessSiteIds = fRes.rows.map(r => r.site_id);
    } catch (e) {
      console.warn('fairness_sites not available:', e.message);
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
         w.id_number, w.classification, w.is_active,
         w.created_at,
         u.id AS user_id
  FROM workers w
  LEFT JOIN honorifics h ON w.honorific_id = h.id
  LEFT JOIN job_titles j ON w.job_id = j.id
  LEFT JOIN employment_types e ON w.employment_type_id = e.id
  LEFT JOIN users u ON u.worker_id = w.id
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
    
    if (user.worker_id) {
      const workerRes = await query('SELECT email, first_name, family_name, is_active FROM workers WHERE id = $1', [user.worker_id]);
      const worker = workerRes.rows[0];
      if (worker) {
        if (!worker.is_active) {
          return res.status(403).json({ error: 'חשבון זה אינו פעיל' });
        }
        email = email || worker.email;
        displayName = `${worker.first_name} ${worker.family_name}`;
      }
    }
    
    const payload = { id: user.id, username: user.username, role: user.role, worker_id: user.worker_id };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { ...payload, email, displayName, must_change_password: user.must_change_password } });
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
    const res_query = await query(WORKER_SELECT + ' ORDER BY w.id');
    res.json(res_query.rows);
  } catch (error) {
    console.error('Get workers error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת עובדים' });
  }
});

app.post('/api/workers', requireAdmin, async (req, res) => {
  try {
    const { honorific_id, first_name, family_name, job_id, employment_type_id,
            phone, email, notes, id_number, classification } = req.body;
    if (!email?.trim()) return res.status(400).json({ error: 'אימייל הוא שדה חובה' });
    
    const cls = classification || 'user';
    const idNum = id_number?.trim() || null;
    
    try {
      const insertRes = await query(`
        INSERT INTO workers (honorific_id, first_name, family_name, job_id, employment_type_id,
                             phone, email, notes, id_number, classification)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `, [honorific_id || null, first_name, family_name, job_id || null,
           employment_type_id || null, phone, email.trim(), notes, idNum, cls]);
      
      const workerId = insertRes.rows[0].id;
      await createUserForWorker(workerId, idNum, cls, email.trim());
      
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
            phone, email, notes, id_number, classification } = req.body;
    if (!email?.trim()) return res.status(400).json({ error: 'אימייל הוא שדה חובה' });
    
    const cls = classification || 'user';
    const idNum = id_number?.trim() || null;
    
    try {
      const is_active = req.body.is_active !== undefined ? req.body.is_active : true;
      const updateRes = await query(`
        UPDATE workers SET honorific_id=$1, first_name=$2, family_name=$3, job_id=$4,
          employment_type_id=$5, phone=$6, email=$7, notes=$8, id_number=$9, classification=$10,
          is_active=$11
        WHERE id=$12
      `, [honorific_id || null, first_name, family_name, job_id || null,
           employment_type_id || null, phone, email.trim(), notes, idNum, cls, is_active, req.params.id]);
      
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
    const datePrefix = month && year ? `${year}-${String(month).padStart(2, '0')}-` : null;

    if (req.user.role === 'admin') {
      // For admin: return all shift requests with worker info
      let sql = `
        SELECT sr.id, sr.user_id, sr.date, sr.shift_type, sr.preference_type,
               u.username, u.worker_id, w.first_name, w.family_name
        FROM shift_requests sr
        JOIN users u ON sr.user_id = u.id
        LEFT JOIN workers w ON u.worker_id = w.id
      `;
      
      if (datePrefix) {
        sql += ' WHERE sr.date LIKE $1 ';
      }
      sql += ' ORDER BY sr.date, u.username';
      
      const params = datePrefix ? [datePrefix + '%'] : [];
      const result = await query(sql, params);
      res.json(result.rows);
    } else {
      let sql = `SELECT * FROM shift_requests WHERE user_id = $1`;
      const params = [req.user.id];
      
      if (datePrefix) {
        sql += ' AND date LIKE $2';
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
    const datePrefix = month && year ? `${year}-${String(month).padStart(2, '0')}-` : null;
    
    const workersRes = await query('SELECT * FROM workers ORDER BY first_name, family_name');
    const workers = workersRes.rows;
    const requests = [];
    
    let sql = `
      SELECT sr.id, sr.user_id, sr.date, sr.shift_type, sr.preference_type,
             u.username, u.worker_id, w.first_name, w.family_name
      FROM shift_requests sr
      JOIN users u ON sr.user_id = u.id
      LEFT JOIN workers w ON u.worker_id = w.id
    `;
    
    if (datePrefix) {
      sql += ' WHERE sr.date LIKE $1';
    }
    sql += ' ORDER BY sr.date, u.username';
    
    const params = datePrefix ? [datePrefix + '%'] : [];
    const requestsRes = await query(sql, params);
    requests.push(...requestsRes.rows);
    
    res.json({ workers, requests });
  } catch (error) {
    console.error('Get all shift requests error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת בקשות משמרת' });
  }
});

app.post('/api/shift-requests', requireAuth, async (req, res) => {
  try {
    const { date, shift_type, preference_type, user_id } = req.body;
    if (!date || !['morning', 'evening', 'night', 'oncall'].includes(shift_type) ||
        !['can', 'prefer', 'cannot'].includes(preference_type)) {
      return res.status(400).json({ error: 'שדות לא תקינים' });
    }
    
    // Admin can set for other users; regular users can only set for themselves
    const targetUserId = req.user.role === 'admin' && user_id ? user_id : req.user.id;
    
    await query(`
      INSERT INTO shift_requests (user_id, date, shift_type, preference_type) VALUES ($1, $2, $3, $4)
      ON CONFLICT(user_id, date, shift_type) DO UPDATE SET preference_type = excluded.preference_type
    `, [targetUserId, date, shift_type, preference_type]);
    
    const resultRes = await query('SELECT * FROM shift_requests WHERE user_id = $1 AND date = $2 AND shift_type = $3',
      [targetUserId, date, shift_type]);
    res.json(resultRes.rows[0]);
  } catch (error) {
    console.error('Create shift request error:', error);
    res.status(500).json({ error: 'שגיאה בשמירת בקשת משמרת' });
  }
});

app.delete('/api/shift-requests/:id', requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
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

// ── Config ──────────────────────────────────────────────────────────────────

app.get('/api/config', requireAuth, async (req, res) => {
  try {
    const config = await getConfig();
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
      const config = await getConfig();
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
      const config = await getConfig();
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
    const config = await getConfig();
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
      const config = await getConfig();
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
      const config = await getConfig();
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
    const config = await getConfig();
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
      const config = await getConfig();
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
      const config = await getConfig();
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
    const config = await getConfig();
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
    try {
      await query('INSERT INTO sites (name, description) VALUES ($1, $2)',
        [name.trim(), description?.trim() || null]);
      const config = await getConfig();
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
    try {
      await query('UPDATE sites SET name=$1 WHERE id=$2', [siteName.trim(), req.params.id]);
      const config = await getConfig();
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
    await query('DELETE FROM sites WHERE id=$1', [req.params.id]);
    const config = await getConfig();
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
    try {
      await query('INSERT INTO site_groups (name, color) VALUES ($1, $2)', [value.trim(), color || '#667eea']);
      const config = await getConfig();
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
    try {
      await query('UPDATE site_groups SET name=$1, color=$2 WHERE id=$3', [value.trim(), color || '#667eea', req.params.id]);
      const config = await getConfig();
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
    await query('DELETE FROM site_groups WHERE id=$1', [req.params.id]);
    const config = await getConfig();
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
    await query('UPDATE sites SET group_id=$1 WHERE id=$2', [group_id || null, req.params.id]);
    const config = await getConfig();
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
    res.json(await getConfig());
  } catch (e) {
    console.error('Add fairness site error:', e);
    res.status(500).json({ error: 'שגיאה בהוספת אתר לצדק' });
  }
});

app.delete('/api/config/fairness-sites/:siteId', requireAdmin, async (req, res) => {
  try {
    const siteId = parseInt(req.params.siteId);
    await query('DELETE FROM fairness_sites WHERE site_id = $1', [siteId]);
    res.json(await getConfig());
  } catch (e) {
    console.error('Remove fairness site error:', e);
    res.status(500).json({ error: 'שגיאה בהסרת אתר מהצדק' });
  }
});

// ── Activity Types Endpoints ────────────────────────────────────────────────

app.post('/api/config/activity-types', requireAdmin, async (req, res) => {
  try {
    const { value } = req.body;
    if (!value?.trim()) return res.status(400).json({ error: 'שם סוג פעילות חובה' });
    try {
      await query('INSERT INTO activity_types (name) VALUES ($1)', [value.trim()]);
      const config = await getConfig();
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
    try {
      await query('UPDATE activity_types SET name=$1 WHERE id=$2', [value.trim(), req.params.id]);
      const config = await getConfig();
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
    await query('DELETE FROM activity_types WHERE id=$1', [req.params.id]);
    const config = await getConfig();
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
    const datePrefix = month && year ? `${year}-${String(month).padStart(2, '0')}-` : null;

    // Get all workers
    const workersRes = await query(WORKER_SELECT + ' ORDER BY w.first_name, w.family_name');
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

    // Get all sites with their group and name
    const sitesRes = await query(`
      SELECT s.id, s.name, s.group_id, sg.name AS group_name
      FROM sites s
      LEFT JOIN site_groups sg ON s.group_id = sg.id
      ORDER BY s.name
    `);
    const sites = sitesRes.rows;

    // Get allowed jobs per site group
    const groupAllowedJobs = new Map(); // group_id -> Set<job_id>
    try {
      const allowedJobsRes = await query(`SELECT group_id, job_id FROM site_group_allowed_jobs`);
      allowedJobsRes.rows.forEach(row => {
        if (!groupAllowedJobs.has(row.group_id)) groupAllowedJobs.set(row.group_id, new Set());
        groupAllowedJobs.get(row.group_id).add(row.job_id);
      });
    } catch (e) {
      console.warn('site_group_allowed_jobs not available:', e.message);
    }

    // Get workers who requested shifts for the date (can or prefer)
    const shiftsRes = await query(`
      SELECT sr.shift_type, sr.preference_type,
             w.id AS worker_id, w.first_name, w.family_name, w.job_id
      FROM shift_requests sr
      JOIN users u ON sr.user_id = u.id
      JOIN workers w ON u.worker_id = w.id
      WHERE sr.date = $1 AND sr.preference_type IN ('can', 'prefer') AND w.is_active = TRUE
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

    // Workers already assigned somewhere on this date (per shift type)
    const assignedRes = await query(`
      SELECT worker_id, shift_type FROM worker_site_assignments WHERE date = $1
    `, [date]);
    const workerAssigned = new Set();
    assignedRes.rows.forEach(r => workerAssigned.add(`${r.worker_id}-${r.shift_type}`));
    console.log('=== SUGGEST DEBUG ===');
    console.log('date param:', JSON.stringify(date));
    console.log('existing assignments:', JSON.stringify(assignedRes.rows));

    // Open slots: configured activity AND no worker assigned yet — built entirely in SQL
    const openSlotsRes = await query(`
      SELECT ssa.site_id, ssa.shift_type
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

    // Fetch fairness scores: count assignments per worker to fairness-designated sites
    const fairnessCountByWorker = new Map();
    let fairnessSiteSet = new Set();
    try {
      const fRes = await query('SELECT site_id FROM fairness_sites');
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
      slotsByShift[r.shift_type].push({ site, shift: r.shift_type, hasRestriction, allowedJobs });
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
          .map((w, idx) => ({
            idx,
            preferFirst: w.preference_type === 'prefer' ? 0 : 1,
            eligible: !slot.hasRestriction || slot.allowedJobs.has(w.job_id),
          }))
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
        } else if (slot.hasRestriction) {
          // Only report unassignable when there are job restrictions (otherwise it's just "no one requested")
          const allForShift = availableByShift[shift] || [];
          const wrongJob = allForShift.filter(w => !slot.allowedJobs.has(w.job_id));
          const reason = wrongJob.length > 0
            ? `${wrongJob.length} עובד/ים ביקשו את המשמרת אך תפקידם לא מורשה לקבוצה זו`
            : 'אף עובד עם תפקיד מתאים לא ביקש משמרת זו';
          unassignable.push({
            site_id: slot.site.id,
            site_name: slot.site.name,
            group_name: slot.site.group_name,
            shift_type: shift,
            reason,
            unavailable_workers: wrongJob.slice(0, 5).map(w => ({
              name: `${w.first_name} ${w.family_name}`,
              reason: 'תפקיד לא מורשה לקבוצה זו',
            })),
          });
        }
      });
    }

    // Safety filter: re-query assignments and strip any suggestion that slipped through
    const finalCheckRes = await query(`
      SELECT worker_id, site_id, shift_type FROM worker_site_assignments WHERE date = $1
    `, [date]);
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
      // Check if worker is authorized for this activity type
      const authRes = await query(`
        SELECT COUNT(*) as count FROM worker_activity_authorizations
        WHERE worker_id = $1 AND activity_type_id = $2
      `, [worker_id, activityTypeId]);

      if (authRes.rows[0].count === 0) {
        return res.status(403).json({ error: 'עובד לא מורשה לסוג פעילות זה' });
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
    const templatesRes = await query(`
      SELECT id, name, created_at
      FROM activity_templates
      ORDER BY name
    `);

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

    const result = await query(
      'INSERT INTO activity_templates (name) VALUES ($1) RETURNING id, name, created_at',
      [name.trim()]
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
    await query('UPDATE activity_templates SET name = $1 WHERE id = $2', [name.trim(), req.params.id]);
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
    await query('DELETE FROM activity_templates WHERE id = $1', [req.params.id]);
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
