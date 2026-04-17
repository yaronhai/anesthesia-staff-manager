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

// ── Database Initialization ─────────────────────────────────────────────────

async function seedDatabase() {
  try {
    // Seed job titles
    const jobTitles = ['רופא', 'עוזר רופא', 'טכנאי הרדמה', 'אחות', 'אחר'];
    for (const name of jobTitles) {
      await query('INSERT INTO job_titles (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
    }

    // Seed employment types
    const empTypes = ['שכיר', 'שכיר-שעתי', 'עצמאי'];
    for (const name of empTypes) {
      await query('INSERT INTO employment_types (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
    }

    // Seed honorifics
    const honorifics = ['ד"ר', "פרופ'", 'מר', 'גברת', "גב'"];
    for (const name of honorifics) {
      await query('INSERT INTO honorifics (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
    }

    // Seed site groups with colors
    const groupColors = {
      'מרדימים אחראיים': '#ef4444',
      'תורנים': '#f59e0b',
      'כוננים': '#8b5cf6',
      'מרפאה טרום ניתוחית': '#ec4899',
      'חדרי ניתוח': '#3b82f6',
      'אתרים אחרים': '#10b981'
    };
    for (const [name, color] of Object.entries(groupColors)) {
      await query('INSERT INTO site_groups (name, color) VALUES ($1, $2) ON CONFLICT DO NOTHING', [name, color]);
    }

    // Get group IDs for seeding sites
    const roomGroupRes = await query("SELECT id FROM site_groups WHERE name = 'חדרי ניתוח'");
    const otherGroupRes = await query("SELECT id FROM site_groups WHERE name = 'אתרים אחרים'");
    
    const operatingRoomGroupId = roomGroupRes.rows[0]?.id;
    const otherGroupId = otherGroupRes.rows[0]?.id;

    // Seed default sites
    const sites = [
      { name: 'חדר ניתוח 1', groupId: operatingRoomGroupId },
      { name: 'חדר ניתוח 2', groupId: operatingRoomGroupId },
      { name: 'חדר ניתוח 3', groupId: operatingRoomGroupId },
      { name: 'חדר ניתוח 4', groupId: operatingRoomGroupId },
      { name: 'חדר ניתוח 5', groupId: operatingRoomGroupId },
      { name: 'חדר ניתוח 6', groupId: operatingRoomGroupId },
      { name: 'חדר ניתוח 7', groupId: operatingRoomGroupId },
      { name: 'חדר ניתוח 8', groupId: operatingRoomGroupId },
      { name: 'חדר ניתוח 9', groupId: operatingRoomGroupId },
      { name: 'חדר ניתוח 10', groupId: operatingRoomGroupId },
      { name: 'חדר ניתוח 11', groupId: operatingRoomGroupId },
      { name: 'חדר ניתוח 12', groupId: operatingRoomGroupId },
      { name: 'חדר ניתוח 13', groupId: operatingRoomGroupId },
      { name: 'חדר ניתוח 14', groupId: operatingRoomGroupId },
      { name: 'חדר ניתוח 15', groupId: operatingRoomGroupId },
      { name: 'חדר ניתוח 16', groupId: operatingRoomGroupId },
      { name: 'חדר ניתוח 17', groupId: operatingRoomGroupId },
      { name: 'חדר ניתוח 18', groupId: operatingRoomGroupId },
      { name: 'IVF', groupId: otherGroupId },
      { name: 'גסטרו', groupId: otherGroupId }
    ];
    for (const site of sites) {
      await query('INSERT INTO sites (name, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [site.name, site.groupId]);
    }

    // Bootstrap admin user
    const adminCheck = await query("SELECT COUNT(*) as c FROM users WHERE username = 'admin'");
    if (parseInt(adminCheck.rows[0].c) === 0) {
      await query(
        'INSERT INTO users (username, password_hash, role, must_change_password) VALUES ($1, $2, $3, $4)',
        ['admin', bcrypt.hashSync('admin123', 8), 'admin', 0]
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
      query('SELECT id, name FROM employment_types ORDER BY id'),
      query('SELECT id, name FROM honorifics ORDER BY id'),
      query('SELECT id, name, color FROM site_groups ORDER BY id'),
      query('SELECT id, name, description, group_id FROM sites ORDER BY name'),
      query('SELECT id, name FROM activity_types ORDER BY name'),
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

    return {
      jobs: res[0].rows,
      employment_types: res[1].rows,
      honorifics: res[2].rows,
      site_groups: res[3].rows,
      sites: res[4].rows,
      activity_types: res[5].rows,
      site_group_allowed_jobs: allowedJobsByGroup,
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
         w.id_number, w.classification,
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
      const workerRes = await query('SELECT email, first_name, family_name FROM workers WHERE id = $1', [user.worker_id]);
      const worker = workerRes.rows[0];
      if (worker) {
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
      const updateRes = await query(`
        UPDATE workers SET honorific_id=$1, first_name=$2, family_name=$3, job_id=$4,
          employment_type_id=$5, phone=$6, email=$7, notes=$8, id_number=$9, classification=$10
        WHERE id=$11
      `, [honorific_id || null, first_name, family_name, job_id || null,
           employment_type_id || null, phone, email.trim(), notes, idNum, cls, req.params.id]);
      
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

    // Get all shift activities for the date
    const activitiesRes = await query(`
      SELECT ssa.id, ssa.site_id, ssa.date, ssa.shift_type,
             ssa.activity_type_id, at.name AS activity_name,
             s.name AS site_name
      FROM site_shift_activities ssa
      LEFT JOIN activity_types at ON ssa.activity_type_id = at.id
      JOIN sites s ON ssa.site_id = s.id
      WHERE ssa.date = $1 AND ssa.activity_type_id IS NOT NULL
      ORDER BY ssa.site_id, ssa.shift_type
    `, [date]);

    const shiftActivities = activitiesRes.rows;

    // Get all shift requests for the date (can or prefer)
    const shiftsRes = await query(`
      SELECT sr.user_id, sr.shift_type, sr.preference_type,
             w.id AS worker_id, w.first_name, w.family_name, w.job_id,
             u.id AS user_id
      FROM shift_requests sr
      JOIN users u ON sr.user_id = u.id
      JOIN workers w ON u.worker_id = w.id
      WHERE sr.date = $1 AND sr.preference_type IN ('can', 'prefer')
      ORDER BY sr.preference_type DESC, w.first_name, w.family_name
    `, [date]);

    const shiftRequests = shiftsRes.rows;

    // Get all worker activity authorizations
    const authRes = await query(`
      SELECT worker_id, activity_type_id
      FROM worker_activity_authorizations
    `);

    const authorizations = new Map();
    authRes.rows.forEach(row => {
      if (!authorizations.has(row.worker_id)) {
        authorizations.set(row.worker_id, new Set());
      }
      authorizations.get(row.worker_id).add(row.activity_type_id);
    });

    // Get site -> group mapping
    const sitesRes = await query('SELECT id, group_id FROM sites');
    const siteGroupMap = new Map();
    sitesRes.rows.forEach(row => {
      siteGroupMap.set(row.id, row.group_id);
    });

    // Get allowed jobs per site group
    const allowedJobsRes = await query(`
      SELECT group_id, job_id FROM site_group_allowed_jobs
    `);
    const groupAllowedJobs = new Map();
    allowedJobsRes.rows.forEach(row => {
      if (!groupAllowedJobs.has(row.group_id)) {
        groupAllowedJobs.set(row.group_id, new Set());
      }
      groupAllowedJobs.get(row.group_id).add(row.job_id);
    });

    // Get already assigned workers for the date
    const assignedRes = await query(`
      SELECT worker_id, shift_type
      FROM worker_site_assignments
      WHERE date = $1
    `, [date]);

    const assigned = new Set();
    assignedRes.rows.forEach(row => {
      assigned.add(`${row.worker_id}-${row.shift_type}`);
    });

    // Build available workers per shift
    const availableByShift = {
      morning: [],
      evening: [],
      night: []
    };

    shiftRequests.forEach(req => {
      if (!assigned.has(`${req.worker_id}-${req.shift_type}`)) {
        if (!availableByShift[req.shift_type]) {
          availableByShift[req.shift_type] = [];
        }
        availableByShift[req.shift_type].push({
          worker_id: req.worker_id,
          first_name: req.first_name,
          family_name: req.family_name,
          preference_type: req.preference_type,
          job_id: req.job_id
        });
      }
    });

    // For each shift activity, find eligible workers
    const eligibleMap = new Map();
    shiftActivities.forEach(activity => {
      const key = `${activity.site_id}-${activity.shift_type}`;
      const candidates = availableByShift[activity.shift_type] || [];
      const eligible = candidates.filter(w => {
        // Check activity authorization (existing)
        const workerAuths = authorizations.get(w.worker_id) || new Set();
        if (!workerAuths.has(activity.activity_type_id)) return false;

        // Check job title restriction (new — only enforced if group has restrictions)
        const groupId = siteGroupMap.get(activity.site_id);
        if (groupId) {
          const allowedJobs = groupAllowedJobs.get(groupId);
          if (allowedJobs && allowedJobs.size > 0) {
            if (!allowedJobs.has(w.job_id)) return false;
          }
        }

        return true;
      });
      eligibleMap.set(key, {
        activity,
        eligible: eligible.sort((a, b) => {
          // Prefer 'prefer' over 'can'
          if (a.preference_type !== b.preference_type) {
            return a.preference_type === 'prefer' ? -1 : 1;
          }
          return 0;
        })
      });
    });

    // Greedy matching: sort by fewest eligible workers, assign best available
    const sorted = Array.from(eligibleMap.entries())
      .sort((a, b) => a[1].eligible.length - b[1].eligible.length);

    const usedWorkers = new Set();
    const suggestions = [];
    const unassignable = [];

    sorted.forEach(([, { activity, eligible }]) => {
      // Find first available worker (not already used in this suggestion round)
      const chosen = eligible.find(w => !usedWorkers.has(`${w.worker_id}-${activity.shift_type}`));

      if (chosen) {
        suggestions.push({
          site_id: activity.site_id,
          site_name: activity.site_name,
          shift_type: activity.shift_type,
          activity_type_id: activity.activity_type_id,
          activity_type_name: activity.activity_name,
          worker_id: chosen.worker_id,
          worker_name: `${chosen.first_name} ${chosen.family_name}`,
          preference_type: chosen.preference_type
        });
        usedWorkers.add(`${chosen.worker_id}-${activity.shift_type}`);
      } else {
        // Analyze why no one is eligible
        const candidates = availableByShift[activity.shift_type] || [];
        const withoutJobTitle = [];
        const withoutAuth = [];
        const withAuth = [];

        const groupId = siteGroupMap.get(activity.site_id);
        const allowedJobs = groupId ? groupAllowedJobs.get(groupId) : null;

        candidates.forEach(w => {
          const workerAuths = authorizations.get(w.worker_id) || new Set();
          if (!workerAuths.has(activity.activity_type_id)) {
            withoutAuth.push({ name: `${w.first_name} ${w.family_name}`, reason: `אין הרשאה לסוג פעילות "${activity.activity_name}"` });
          } else if (allowedJobs && allowedJobs.size > 0 && !allowedJobs.has(w.job_id)) {
            withoutJobTitle.push({ name: `${w.first_name} ${w.family_name}`, reason: `תפקיד לא מורשה לקבוצת אתרים זו` });
          } else {
            withAuth.push(w);
          }
        });

        let mainReason = 'אין עובדים מתאימים';
        let detailedReasons = [];

        if (withAuth.length === 0) {
          if (withoutJobTitle.length > 0) {
            mainReason = `${withoutJobTitle.length} עובד/ים חסום/ים בגלל תפקיד לא מורשה לקבוצה זו`;
            detailedReasons = withoutJobTitle.slice(0, 5);
          } else if (withoutAuth.length > 0) {
            mainReason = `${withoutAuth.length} עובד/ים ביקשו את המשמרת אך חסרה להם הרשאה לסוג פעילות זה`;
            detailedReasons = withoutAuth.slice(0, 5);
          } else {
            mainReason = `אף עובד לא ביקש את המשמרת הזו`;
          }
        }

        unassignable.push({
          site_id: activity.site_id,
          site_name: activity.site_name,
          shift_type: activity.shift_type,
          activity_type_name: activity.activity_name,
          reason: mainReason,
          unavailable_workers: detailedReasons
        });
      }
    });

    res.json({ suggestions, unassignable });
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
