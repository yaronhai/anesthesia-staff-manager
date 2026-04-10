require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const { query, pool, initializeSchema } = require('./db');

const app = express();
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
    if (adminCheck.rows[0].c === 0) {
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

const JWT_SECRET = 'anesthesia-dept-2024-secret-key';

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
  const res = await Promise.all([
    query('SELECT id, name FROM job_titles ORDER BY id'),
    query('SELECT id, name FROM employment_types ORDER BY id'),
    query('SELECT id, name FROM honorifics ORDER BY id'),
    query('SELECT id, name, color FROM site_groups ORDER BY id'),
    query('SELECT id, name, description, group_id FROM sites ORDER BY name'),
  ]);
  
  return {
    jobs: res[0].rows,
    employment_types: res[1].rows,
    honorifics: res[2].rows,
    site_groups: res[3].rows,
    sites: res[4].rows,
  };
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
    if (!date || !['morning', 'evening', 'oncall'].includes(shift_type) ||
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

    res.json({ workers, siteAssignments });
  } catch (error) {
    console.error('Get month view error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת תצוגת חודש' });
  }
});

app.post('/api/worker-site-assignments', requireAdmin, async (req, res) => {
  try {
    const { worker_id, date, site_id, shift_type, start_time, end_time, notes } = req.body;
    const shiftType = shift_type || 'morning';

    if (!worker_id || !date || !site_id) {
      return res.status(400).json({ error: 'שדות חסרים' });
    }
    if (!['morning', 'evening'].includes(shiftType)) {
      return res.status(400).json({ error: 'סוג משמרת לא תקין' });
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

const PORT = 5001;

async function start() {
  try {
    await initializeApp();
    app.listen(PORT, '127.0.0.1', () => console.log(`Backend running on http://localhost:${PORT}`));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

const app = express();
app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const db = new Database(path.join(DATA_DIR, 'workers.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS job_titles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS employment_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS honorifics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS workers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    honorific_id INTEGER REFERENCES honorifics(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    family_name TEXT NOT NULL,
    job_id INTEGER REFERENCES job_titles(id) ON DELETE SET NULL,
    employment_type_id INTEGER REFERENCES employment_types(id) ON DELETE SET NULL,
    phone TEXT,
    email TEXT NOT NULL DEFAULT '',
    notes TEXT,
    id_number TEXT,
    classification TEXT NOT NULL DEFAULT 'user',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT,
    worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'user',
    must_change_password INTEGER NOT NULL DEFAULT 1,
    reset_token TEXT,
    reset_token_expires TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS shift_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    shift_type TEXT NOT NULL CHECK(shift_type IN ('morning', 'evening', 'oncall')),
    preference_type TEXT NOT NULL DEFAULT 'can' CHECK(preference_type IN ('can', 'prefer', 'cannot')),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, date, shift_type)
  );

  CREATE TABLE IF NOT EXISTS site_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#667eea',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    group_id INTEGER REFERENCES site_groups(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS worker_site_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(worker_id, date, site_id)
  );
`);

// ── Migrations (safe for existing DBs) ──────────────────────────────────────

const migrations = [
  'ALTER TABLE workers ADD COLUMN id_number TEXT',
  'ALTER TABLE workers ADD COLUMN classification TEXT NOT NULL DEFAULT \'user\'',
  'ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE users ADD COLUMN worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_id_number ON workers(id_number) WHERE id_number IS NOT NULL',
  'ALTER TABLE users ADD COLUMN email TEXT',
  'ALTER TABLE users ADD COLUMN reset_token TEXT',
  'ALTER TABLE users ADD COLUMN reset_token_expires TEXT',
  'CREATE TABLE IF NOT EXISTS site_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at TEXT DEFAULT (datetime(\'now\')))',
  'ALTER TABLE sites ADD COLUMN group_id INTEGER REFERENCES site_groups(id) ON DELETE SET NULL',
  'ALTER TABLE site_groups ADD COLUMN color TEXT DEFAULT \'#667eea\'',
];
migrations.forEach(sql => { try { db.exec(sql); } catch {} });

// Migrate shift_requests to new schema if preference_type column is missing
{
  const cols = db.prepare('PRAGMA table_info(shift_requests)').all();
  if (cols.length > 0 && !cols.some(c => c.name === 'preference_type')) {
    db.exec(`
      ALTER TABLE shift_requests RENAME TO _shift_requests_old;
      CREATE TABLE shift_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        shift_type TEXT NOT NULL CHECK(shift_type IN ('morning', 'evening', 'oncall')),
        preference_type TEXT NOT NULL DEFAULT 'can' CHECK(preference_type IN ('can', 'prefer', 'cannot')),
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, date, shift_type)
      );
      INSERT OR IGNORE INTO shift_requests (id, user_id, date, shift_type, preference_type, created_at)
        SELECT id, user_id, date, shift_type, 'can', created_at FROM _shift_requests_old;
      DROP TABLE _shift_requests_old;
    `);
  }
}

// Migrate worker_site_assignments to add shift_type, start_time, end_time
{
  const cols = db.prepare('PRAGMA table_info(worker_site_assignments)').all();
  if (cols.length > 0 && !cols.some(c => c.name === 'shift_type')) {
    db.exec(`
      DROP TABLE IF EXISTS _wsa_old;
      ALTER TABLE worker_site_assignments RENAME TO _wsa_old;

      CREATE TABLE worker_site_assignments (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        worker_id   INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        date        TEXT    NOT NULL,
        site_id     INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        shift_type  TEXT    NOT NULL DEFAULT 'morning'
                            CHECK(shift_type IN ('morning', 'evening')),
        start_time  TEXT,
        end_time    TEXT,
        notes       TEXT,
        created_at  TEXT    DEFAULT (datetime('now')),
        UNIQUE(worker_id, date, site_id, shift_type)
      );

      INSERT OR IGNORE INTO worker_site_assignments
        (id, worker_id, date, site_id, shift_type, start_time, end_time, notes, created_at)
      SELECT id, worker_id, date, site_id, 'morning', NULL, NULL, notes, created_at
      FROM _wsa_old;

      DROP TABLE _wsa_old;
    `);
  }
}

// ── Seed defaults ────────────────────────────────────────────────────────────

['רופא', 'עוזר רופא', 'טכנאי הרדמה', 'אחות', 'אחר'].forEach(n =>
  db.prepare('INSERT OR IGNORE INTO job_titles (name) VALUES (?)').run(n));
['שכיר', 'שכיר-שעתי', 'עצמאי'].forEach(n =>
  db.prepare('INSERT OR IGNORE INTO employment_types (name) VALUES (?)').run(n));
['ד"ר', "פרופ'", 'מר', 'גברת', "גב'"].forEach(n =>
  db.prepare('INSERT OR IGNORE INTO honorifics (name) VALUES (?)').run(n));

// Seed site groups with colors
const groupColors = {
  'מרדימים אחראיים': '#ef4444',
  'תורנים': '#f59e0b',
  'כוננים': '#8b5cf6',
  'מרפאה טרום ניתוחית': '#ec4899',
  'חדרי ניתוח': '#3b82f6',
  'אתרים אחרים': '#10b981'
};
Object.entries(groupColors).forEach(([name, color]) => {
  db.prepare('INSERT OR IGNORE INTO site_groups (name, color) VALUES (?, ?)').run(name, color);
  db.prepare('UPDATE site_groups SET color = ? WHERE name = ?').run(color, name);
});

// Seed default sites (20 total) with group assignment
const operatingRoomGroupId = db.prepare("SELECT id FROM site_groups WHERE name = 'חדרי ניתוח'").get()?.id;
const otherGroupId = db.prepare("SELECT id FROM site_groups WHERE name = 'אתרים אחרים'").get()?.id;

[
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
].forEach(s =>
  db.prepare('INSERT OR IGNORE INTO sites (name, group_id) VALUES (?, ?)').run(s.name, s.groupId));

// Bootstrap admin (not tied to a worker — for initial system setup)
if (db.prepare("SELECT COUNT(*) AS c FROM users WHERE username = 'admin'").get().c === 0) {
  db.prepare('INSERT INTO users (username, password_hash, role, must_change_password) VALUES (?, ?, ?, ?)')
    .run('admin', bcrypt.hashSync('admin123', 8), 'admin', 0);
}
db.prepare("UPDATE users SET must_change_password = 0 WHERE username = 'admin'").run();

const JWT_SECRET = 'anesthesia-dept-2024-secret-key';

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

function createUserForWorker(worker_id, id_number, classification, email) {
  if (!id_number) return;
  const hash = bcrypt.hashSync(id_number, 8);
  try {
    db.prepare(
      'INSERT INTO users (username, password_hash, worker_id, role, must_change_password, email) VALUES (?, ?, ?, ?, 1, ?)'
    ).run(id_number, hash, worker_id, classification, email || null);
  } catch {}
}

function syncUserForWorker(worker_id, id_number, classification, email) {
  if (!id_number) return;
  const user = db.prepare('SELECT id FROM users WHERE worker_id = ?').get(worker_id);
  if (user) {
    db.prepare('UPDATE users SET username = ?, role = ?, email = ? WHERE id = ?')
      .run(id_number, classification, email || null, user.id);
  } else {
    createUserForWorker(worker_id, id_number, classification, email);
  }
}

// ── Config helpers ───────────────────────────────────────────────────────────

function getConfig() {
  return {
    jobs: db.prepare('SELECT id, name FROM job_titles ORDER BY id').all(),
    employment_types: db.prepare('SELECT id, name FROM employment_types ORDER BY id').all(),
    honorifics: db.prepare('SELECT id, name FROM honorifics ORDER BY id').all(),
    site_groups: db.prepare('SELECT id, name, color FROM site_groups ORDER BY id').all(),
    sites: db.prepare('SELECT id, name, description, group_id FROM sites ORDER BY name').all(),
  };
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

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'שדות חסרים' });
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'שם משתמש או סיסמא שגויים' });
  }
  // Get email and name from worker
  let email = user.email;
  let displayName = user.username;
  if (user.worker_id) {
    const worker = db.prepare('SELECT email, first_name, family_name FROM workers WHERE id = ?').get(user.worker_id);
    if (worker) {
      email = email || worker.email;
      displayName = `${worker.first_name} ${worker.family_name}`;
    }
  }
  const payload = { id: user.id, username: user.username, role: user.role, worker_id: user.worker_id };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { ...payload, email, displayName, must_change_password: user.must_change_password } });
});

app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'הסיסמא חייבת להכיל לפחות 6 תווים' });
  }
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?')
    .run(bcrypt.hashSync(newPassword, 8), req.user.id);
  res.json({ ok: true });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'אימייל חסר' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.json({ ok: true }); // don't reveal whether email exists

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?')
    .run(token, expires, user.id);

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
});

app.post('/api/auth/reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'שדות לא תקינים' });
  }
  const user = db.prepare('SELECT * FROM users WHERE reset_token = ?').get(token);
  if (!user) return res.status(400).json({ error: 'קישור לא תקין' });
  if (new Date(user.reset_token_expires) < new Date()) {
    return res.status(400).json({ error: 'הקישור פג תוקף, בקש קישור חדש' });
  }
  db.prepare(
    'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL, must_change_password = 0 WHERE id = ?'
  ).run(bcrypt.hashSync(newPassword, 8), user.id);
  res.json({ ok: true });
});

app.post('/api/auth/reset-worker-password/:workerId', requireAdmin, (req, res) => {
  const { workerId } = req.params;
  const worker = db.prepare('SELECT id_number FROM workers WHERE id = ?').get(workerId);
  if (!worker) return res.status(404).json({ error: 'עובד לא נמצא' });

  const user = db.prepare('SELECT id FROM users WHERE worker_id = ?').get(workerId);
  if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });

  const newPassword = bcrypt.hashSync(worker.id_number, 8);
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?')
    .run(newPassword, user.id);

  res.json({ ok: true });
});

// ── Workers ─────────────────────────────────────────────────────────────────

app.get('/api/workers', requireAuth, (req, res) => {
  res.json(db.prepare(WORKER_SELECT + ' ORDER BY w.id').all());
});

app.post('/api/workers', requireAdmin, (req, res) => {
  const { honorific_id, first_name, family_name, job_id, employment_type_id,
          phone, email, notes, id_number, classification } = req.body;
  if (!email?.trim()) return res.status(400).json({ error: 'אימייל הוא שדה חובה' });
  const cls = classification || 'user';
  const idNum = id_number?.trim() || null;
  try {
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO workers (honorific_id, first_name, family_name, job_id, employment_type_id,
                           phone, email, notes, id_number, classification)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(honorific_id || null, first_name, family_name, job_id || null,
           employment_type_id || null, phone, email.trim(), notes, idNum, cls);
    createUserForWorker(lastInsertRowid, idNum, cls, email.trim());
    res.status(201).json(db.prepare(WORKER_SELECT + ' WHERE w.id = ?').get(lastInsertRowid));
  } catch (e) {
    if (e.message?.includes('UNIQUE') && e.message?.includes('id_number')) {
      return res.status(400).json({ error: 'מספר תעודת זהות כבר קיים במערכת' });
    }
    throw e;
  }
});

app.put('/api/workers/:id', requireAdmin, (req, res) => {
  const { honorific_id, first_name, family_name, job_id, employment_type_id,
          phone, email, notes, id_number, classification } = req.body;
  if (!email?.trim()) return res.status(400).json({ error: 'אימייל הוא שדה חובה' });
  const cls = classification || 'user';
  const idNum = id_number?.trim() || null;
  try {
    const { changes } = db.prepare(`
      UPDATE workers SET honorific_id=?, first_name=?, family_name=?, job_id=?,
        employment_type_id=?, phone=?, email=?, notes=?, id_number=?, classification=?
      WHERE id=?
    `).run(honorific_id || null, first_name, family_name, job_id || null,
           employment_type_id || null, phone, email.trim(), notes, idNum, cls, req.params.id);
    if (changes === 0) return res.status(404).json({ error: 'Worker not found' });
    syncUserForWorker(Number(req.params.id), idNum, cls, email.trim());
    res.json(db.prepare(WORKER_SELECT + ' WHERE w.id = ?').get(req.params.id));
  } catch (e) {
    if (e.message?.includes('UNIQUE') && e.message?.includes('id_number')) {
      return res.status(400).json({ error: 'מספר תעודת זהות כבר קיים במערכת' });
    }
    throw e;
  }
});

app.delete('/api/workers/:id', requireAdmin, (req, res) => {
  const { changes } = db.prepare('DELETE FROM workers WHERE id=?').run(req.params.id);
  if (changes === 0) return res.status(404).json({ error: 'Worker not found' });
  res.status(204).send();
});

// ── Shift Requests ──────────────────────────────────────────────────────────

app.get('/api/shift-requests', requireAuth, (req, res) => {
  const { month, year } = req.query;
  const datePrefix = month && year ? `${year}-${String(month).padStart(2, '0')}-` : null;

  if (req.user.role === 'admin') {
    // For admin: return all shift requests with worker info
    const sql = `
      SELECT sr.id, sr.user_id, sr.date, sr.shift_type, sr.preference_type,
             u.username, u.worker_id, w.first_name, w.family_name
      FROM shift_requests sr
      JOIN users u ON sr.user_id = u.id
      LEFT JOIN workers w ON u.worker_id = w.id
      ${datePrefix ? 'WHERE sr.date LIKE ?' : ''}
      ORDER BY sr.date, u.username
    `;
    res.json(datePrefix ? db.prepare(sql).all(datePrefix + '%') : db.prepare(sql).all());
  } else {
    const sql = `SELECT * FROM shift_requests WHERE user_id = ?${datePrefix ? ' AND date LIKE ?' : ''} ORDER BY date`;
    res.json(datePrefix
      ? db.prepare(sql).all(req.user.id, datePrefix + '%')
      : db.prepare(sql).all(req.user.id));
  }
});

app.get('/api/shift-requests/admin/all-with-workers', requireAdmin, (req, res) => {
  // Returns all workers with their shift requests for the given month
  const { month, year } = req.query;
  const datePrefix = month && year ? `${year}-${String(month).padStart(2, '0')}-` : null;
  
  const workers = db.prepare('SELECT * FROM workers ORDER BY first_name, family_name').all();
  const requests = [];
  
  if (datePrefix) {
    const sql = `
      SELECT sr.id, sr.user_id, sr.date, sr.shift_type, sr.preference_type,
             u.username, u.worker_id, w.first_name, w.family_name
      FROM shift_requests sr
      JOIN users u ON sr.user_id = u.id
      LEFT JOIN workers w ON u.worker_id = w.id
      WHERE sr.date LIKE ?
      ORDER BY sr.date, u.username
    `;
    requests.push(...db.prepare(sql).all(datePrefix + '%'));
  } else {
    const sql = `
      SELECT sr.id, sr.user_id, sr.date, sr.shift_type, sr.preference_type,
             u.username, u.worker_id, w.first_name, w.family_name
      FROM shift_requests sr
      JOIN users u ON sr.user_id = u.id
      LEFT JOIN workers w ON u.worker_id = w.id
      ORDER BY sr.date, u.username
    `;
    requests.push(...db.prepare(sql).all());
  }
  
  res.json({ workers, requests });
});

app.post('/api/shift-requests', requireAuth, (req, res) => {
  const { date, shift_type, preference_type, user_id } = req.body;
  if (!date || !['morning', 'evening', 'oncall'].includes(shift_type) ||
      !['can', 'prefer', 'cannot'].includes(preference_type)) {
    return res.status(400).json({ error: 'שדות לא תקינים' });
  }
  // Admin can set for other users; regular users can only set for themselves
  const targetUserId = req.user.role === 'admin' && user_id ? user_id : req.user.id;
  db.prepare(`
    INSERT INTO shift_requests (user_id, date, shift_type, preference_type) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, date, shift_type) DO UPDATE SET preference_type = excluded.preference_type
  `).run(targetUserId, date, shift_type, preference_type);
  res.json(db.prepare('SELECT * FROM shift_requests WHERE user_id = ? AND date = ? AND shift_type = ?')
    .get(targetUserId, date, shift_type));
});

app.delete('/api/shift-requests/:id', requireAuth, (req, res) => {
  if (req.user.role === 'admin') {
    db.prepare('DELETE FROM shift_requests WHERE id = ?').run(req.params.id);
  } else {
    db.prepare('DELETE FROM shift_requests WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  }
  res.status(204).send();
});

// ── Config ──────────────────────────────────────────────────────────────────

app.get('/api/config', requireAuth, (req, res) => res.json(getConfig()));

app.post('/api/config/jobs', requireAdmin, (req, res) => {
  const { value } = req.body;
  if (!value?.trim()) return res.status(400).json({ error: 'ערך לא תקין' });
  try { db.prepare('INSERT INTO job_titles (name) VALUES (?)').run(value.trim()); res.json(getConfig()); }
  catch { res.status(400).json({ error: 'ערך כפול' }); }
});

app.put('/api/config/jobs/:id', requireAdmin, (req, res) => {
  const { value } = req.body;
  if (!value?.trim()) return res.status(400).json({ error: 'ערך לא תקין' });
  try { db.prepare('UPDATE job_titles SET name=? WHERE id=?').run(value.trim(), req.params.id); res.json(getConfig()); }
  catch { res.status(400).json({ error: 'ערך כפול' }); }
});

app.delete('/api/config/jobs/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM job_titles WHERE id=?').run(req.params.id);
  res.json(getConfig());
});

app.post('/api/config/employment-types', requireAdmin, (req, res) => {
  const { value } = req.body;
  if (!value?.trim()) return res.status(400).json({ error: 'ערך לא תקין' });
  try { db.prepare('INSERT INTO employment_types (name) VALUES (?)').run(value.trim()); res.json(getConfig()); }
  catch { res.status(400).json({ error: 'ערך כפול' }); }
});

app.put('/api/config/employment-types/:id', requireAdmin, (req, res) => {
  const { value } = req.body;
  if (!value?.trim()) return res.status(400).json({ error: 'ערך לא תקין' });
  try { db.prepare('UPDATE employment_types SET name=? WHERE id=?').run(value.trim(), req.params.id); res.json(getConfig()); }
  catch { res.status(400).json({ error: 'ערך כפול' }); }
});

app.delete('/api/config/employment-types/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM employment_types WHERE id=?').run(req.params.id);
  res.json(getConfig());
});

app.post('/api/config/honorifics', requireAdmin, (req, res) => {
  const { value } = req.body;
  if (!value?.trim()) return res.status(400).json({ error: 'ערך לא תקין' });
  try { db.prepare('INSERT INTO honorifics (name) VALUES (?)').run(value.trim()); res.json(getConfig()); }
  catch { res.status(400).json({ error: 'ערך כפול' }); }
});

app.put('/api/config/honorifics/:id', requireAdmin, (req, res) => {
  const { value } = req.body;
  if (!value?.trim()) return res.status(400).json({ error: 'ערך לא תקין' });
  try { db.prepare('UPDATE honorifics SET name=? WHERE id=?').run(value.trim(), req.params.id); res.json(getConfig()); }
  catch { res.status(400).json({ error: 'ערך כפול' }); }
});

app.delete('/api/config/honorifics/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM honorifics WHERE id=?').run(req.params.id);
  res.json(getConfig());
});

// Sites config endpoints
app.post('/api/config/sites', requireAdmin, (req, res) => {
  const { name, description } = req.body;
  console.log('POST /api/config/sites - name:', name);
  if (!name?.trim()) return res.status(400).json({ error: 'שם אתר חובה' });
  try {
    db.prepare('INSERT INTO sites (name, description) VALUES (?, ?)')
      .run(name.trim(), description?.trim() || null);
    const config = getConfig();
    console.log('Site added, sites count:', config.sites.length);
    res.json(config);
  } catch (err) {
    console.error('Error adding site:', err.message);
    res.status(400).json({ error: 'שם אתר כפול' });
  }
});

app.put('/api/config/sites/:id', requireAdmin, (req, res) => {
  const { value, name } = req.body;
  const siteName = name || value;
  if (!siteName?.trim()) return res.status(400).json({ error: 'שם אתר חובה' });
  try {
    db.prepare('UPDATE sites SET name=? WHERE id=?').run(siteName.trim(), req.params.id);
    res.json(getConfig());
  } catch (err) {
    res.status(400).json({ error: 'שם אתר כפול' });
  }
});

app.delete('/api/config/sites/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM sites WHERE id=?').run(req.params.id);
  res.json(getConfig());
});

// Site groups endpoints
app.post('/api/config/site-groups', requireAdmin, (req, res) => {
  const { value, color } = req.body;
  if (!value?.trim()) return res.status(400).json({ error: 'שם קבוצה חובה' });
  try {
    db.prepare('INSERT INTO site_groups (name, color) VALUES (?, ?)').run(value.trim(), color || '#667eea');
    res.json(getConfig());
  } catch {
    res.status(400).json({ error: 'קבוצה כפולה' });
  }
});

app.put('/api/config/site-groups/:id', requireAdmin, (req, res) => {
  const { value, color } = req.body;
  if (!value?.trim()) return res.status(400).json({ error: 'שם קבוצה חובה' });
  try {
    db.prepare('UPDATE site_groups SET name=?, color=? WHERE id=?').run(value.trim(), color || '#667eea', req.params.id);
    res.json(getConfig());
  } catch {
    res.status(400).json({ error: 'קבוצה כפולה' });
  }
});

app.delete('/api/config/site-groups/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM site_groups WHERE id=?').run(req.params.id);
  res.json(getConfig());
});

// Assign site to group
app.put('/api/config/sites/:id/group', requireAdmin, (req, res) => {
  const { group_id } = req.body;
  db.prepare('UPDATE sites SET group_id=? WHERE id=?').run(group_id || null, req.params.id);
  res.json(getConfig());
});

// Worker site assignments endpoints
app.get('/api/staffing/month-view', requireAdmin, (req, res) => {
  const { month, year, siteId } = req.query;
  const datePrefix = month && year ? `${year}-${String(month).padStart(2, '0')}-` : null;

  // Get all workers
  const workers = db.prepare(WORKER_SELECT + ' ORDER BY w.first_name, w.family_name').all();

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
    ${datePrefix ? 'WHERE wsa.date LIKE ?' : ''}
    ${siteId ? (datePrefix ? 'AND' : 'WHERE') + ' wsa.site_id = ?' : ''}
    ORDER BY wsa.date, wsa.site_id, wsa.shift_type, wsa.worker_id
  `;

  const params = [];
  if (datePrefix) params.push(datePrefix + '%');
  if (siteId) params.push(siteId);

  const siteAssignments = db.prepare(assignmentsQuery).all(...params);

  res.json({ workers, siteAssignments });
});

app.post('/api/worker-site-assignments', requireAdmin, (req, res) => {
  const { worker_id, date, site_id, shift_type, start_time, end_time, notes } = req.body;
  const shiftType = shift_type || 'morning';

  if (!worker_id || !date || !site_id) {
    return res.status(400).json({ error: 'שדות חסרים' });
  }
  if (!['morning', 'evening'].includes(shiftType)) {
    return res.status(400).json({ error: 'סוג משמרת לא תקין' });
  }

  try {
    db.prepare(`
      INSERT INTO worker_site_assignments (worker_id, date, site_id, shift_type, start_time, end_time, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(worker_id, date, site_id, shift_type) DO UPDATE SET
        start_time = excluded.start_time,
        end_time   = excluded.end_time,
        notes      = excluded.notes
    `).run(worker_id, date, site_id, shiftType, start_time || null, end_time || null, notes || null);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error saving assignment:', err);
    res.status(400).json({ error: 'שגיאה בשמירת השיבוץ' });
  }
});

app.put('/api/worker-site-assignments/:id', requireAdmin, (req, res) => {
  const { start_time, end_time, notes } = req.body;
  const { changes } = db.prepare(`
    UPDATE worker_site_assignments SET start_time = ?, end_time = ?, notes = ? WHERE id = ?
  `).run(start_time || null, end_time || null, notes || null, req.params.id);
  if (changes === 0) return res.status(404).json({ error: 'שיבוץ לא נמצא' });
  res.json({ ok: true });
});

app.delete('/api/worker-site-assignments/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM worker_site_assignments WHERE id=?').run(req.params.id);
  res.status(204).send();
});

const PORT = 5001;
app.listen(PORT, '127.0.0.1', () => console.log(`Backend running on http://localhost:${PORT}`));
