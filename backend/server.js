require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

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

// ── Seed defaults ────────────────────────────────────────────────────────────

['רופא', 'עוזר רופא', 'טכנאי הרדמה', 'אחות', 'אחר'].forEach(n =>
  db.prepare('INSERT OR IGNORE INTO job_titles (name) VALUES (?)').run(n));
['שכיר', 'שכיר-שעתי', 'עצמאי'].forEach(n =>
  db.prepare('INSERT OR IGNORE INTO employment_types (name) VALUES (?)').run(n));
['ד"ר', "פרופ'", 'מר', 'גברת', "גב'"].forEach(n =>
  db.prepare('INSERT OR IGNORE INTO honorifics (name) VALUES (?)').run(n));

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
         w.created_at
  FROM workers w
  LEFT JOIN honorifics h ON w.honorific_id = h.id
  LEFT JOIN job_titles j ON w.job_id = j.id
  LEFT JOIN employment_types e ON w.employment_type_id = e.id
`;

// ── Auth endpoints ──────────────────────────────────────────────────────────

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'שדות חסרים' });
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'שם משתמש או סיסמא שגויים' });
  }
  const payload = { id: user.id, username: user.username, role: user.role, worker_id: user.worker_id };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { ...payload, email: user.email, must_change_password: user.must_change_password } });
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

app.post('/api/shift-requests', requireAuth, (req, res) => {
  const { date, shift_type, preference_type } = req.body;
  if (!date || !['morning', 'evening', 'oncall'].includes(shift_type) ||
      !['can', 'prefer', 'cannot'].includes(preference_type)) {
    return res.status(400).json({ error: 'שדות לא תקינים' });
  }
  db.prepare(`
    INSERT INTO shift_requests (user_id, date, shift_type, preference_type) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, date, shift_type) DO UPDATE SET preference_type = excluded.preference_type
  `).run(req.user.id, date, shift_type, preference_type);
  res.json(db.prepare('SELECT * FROM shift_requests WHERE user_id = ? AND date = ? AND shift_type = ?')
    .get(req.user.id, date, shift_type));
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

const PORT = 5001;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
