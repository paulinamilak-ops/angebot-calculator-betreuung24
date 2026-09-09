/**
 * Betreuung 24 — CV API Server (production v4)
 * SQLite + JWT (12h) + Rate Limiting + Security Log + Account Lockout
 * Office 365 SMTP + Backup + Photo Storage + Request Logging + Auto-cleanup
 *
 * Installation:
 *   npm install express cors better-sqlite3 node-cron helmet jsonwebtoken bcrypt nodemailer express-rate-limit
 *   node server.js
 *
 * First run — create admin account:
 *   node create-admin.js admin@betreuung24.de YourPassword123 "Your Name"
 */

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const Database   = require('better-sqlite3');
const cron       = require('node-cron');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcrypt');
const nodemailer = require('nodemailer');
const rateLimit  = require('express-rate-limit');
const crypto     = require('crypto');
const path       = require('path');
const fs         = require('fs');

const app     = express();
const PORT    = process.env.PORT || 3001;
// Bind address. Production keeps 127.0.0.1 (Nginx connects locally);
// containers must bind 0.0.0.0 or the app is unreachable from outside.
const HOST    = process.env.HOST || '127.0.0.1';
const BASE    = process.env.CV_DATA_DIR || path.join(__dirname, 'cv-data');
const DB_PATH = path.join(BASE, 'cv.db');
const PHO_DIR = path.join(BASE, 'photos');
const BAK_DIR = path.join(BASE, 'backups');
const LOG_FILE= path.join(BASE, 'access.log');

// ============================================================
// CONFIGURATION — change before deployment
// ============================================================
const CONFIG = {
  JWT_SECRET:     process.env.JWT_SECRET  || 'CHANGE-JWT-SECRET-MIN-32-CHARS',
  JWT_EXPIRES_IN: '12h',
  API_KEY:        process.env.API_KEY     || 'CHANGE-API-KEY-MIN-32-CHARS',
  APP_URL:        'https://calculator.betreuung24.de',

  SMTP: {
    host:   'smtp.office365.com',
    port:   587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || 'noreply@betreuung24.de',
      pass: process.env.SMTP_PASS || 'CHANGE-TO-APP-PASSWORD'
    },
    tls: { ciphers: 'SSLv3' }
  },

  ALLOWED_ORIGINS: [
    'https://calculator.betreuung24.de',
    'https://www.betreuung24.de',
    'http://localhost:8080',
    'http://localhost:3000',
    'null'
  ],

  RETENTION_DAYS:     90,
  BACKUP_KEEP:        30,
  LOG_MAX_MB:         50,
  RESET_TOKEN_HOURS:  1,
  BCRYPT_ROUNDS:      10,
  MAX_LOGIN_ATTEMPTS: 10,
  LOCKOUT_MINUTES:    30,

  // Ollama AI queue
  OLLAMA_URL:         process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
  OLLAMA_MAX_QUEUE:   20,    // max jobs waiting in queue
  OLLAMA_TIMEOUT_MS:  120000 // 2 minutes per generation
};
// ============================================================

// ============================================================
// OLLAMA QUEUE — handles concurrent AI generation requests
// Max one generation at a time, others wait in line
// ============================================================
const aiQueue = {
  running: false,
  jobs: [],          // array of pending { resolve, reject, payload }

  // Add a new generation job to the queue
  add(payload) {
    return new Promise((resolve, reject) => {
      if (this.jobs.length >= CONFIG.OLLAMA_MAX_QUEUE) {
        return reject(new Error('Queue full — too many requests, please try again in a moment'));
      }
      this.jobs.push({ resolve, reject, payload });
      this.run();
    });
  },

  // Process next job in queue
  async run() {
    if (this.running || this.jobs.length === 0) return;
    this.running = true;
    const job = this.jobs.shift();
    try {
      const result = await this._generate(job.payload);
      job.resolve(result);
    } catch(e) {
      job.reject(e);
    } finally {
      this.running = false;
      this.run(); // process next job
    }
  },

  // Actual fetch to Ollama
  async _generate(payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.OLLAMA_TIMEOUT_MS);
    try {
      const r = await fetch(CONFIG.OLLAMA_URL + '/api/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
        signal:  controller.signal
      });
      if (!r.ok) throw new Error('Ollama HTTP ' + r.status);
      return await r.json();
    } finally {
      clearTimeout(timeout);
    }
  },

  // How many jobs are waiting
  get queueLength() { return this.jobs.length; },
  get isRunning()   { return this.running; }
};

// Create directories
[BASE, PHO_DIR, BAK_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// --- Email transporter ---
const mailer = nodemailer.createTransport(CONFIG.SMTP);

// --- Rate limiters ---
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Too many requests. Please slow down.' }
});

// --- Request logger ---
function logRequest(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const line = `${new Date().toISOString()} ${req.method} ${req.path} ${res.statusCode} ${Date.now()-start}ms ${req.ip}\n`;
    try {
      const stat = fs.existsSync(LOG_FILE) ? fs.statSync(LOG_FILE) : null;
      if (stat && stat.size > CONFIG.LOG_MAX_MB * 1024 * 1024) {
        fs.renameSync(LOG_FILE, LOG_FILE + '.old');
      }
      fs.appendFileSync(LOG_FILE, line);
    } catch(e) {}
  });
  next();
}

// --- Middleware ---
app.set('trust proxy', 1);

// AI generation needs a local Ollama instance. Environments without one
// (local Docker, Railway test) set AI_DISABLED=1 so the frontend gets a
// clear error instead of hanging until the 2 minute timeout.
app.use('/ai/generate', (req, res, next) => {
  if (process.env.AI_DISABLED === '1') {
    return res.status(503).json({ error: 'ai_unavailable',
      message: 'Generator AI nie jest dostepny w tym srodowisku.' });
  }
  next();
}); // Nginx reverse proxy — echte Client-IP aus X-Forwarded-For lesen
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '20mb' }));
app.use(logRequest);
app.use(apiLimiter);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || CONFIG.ALLOWED_ORIGINS.includes(origin)) cb(null, true);
    else cb(new Error('CORS: origin not allowed — ' + origin));
  },
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization']
}));

// --- Database ---
const db = new Database(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password      TEXT NOT NULL,
    name          TEXT NOT NULL DEFAULT '',
    role          TEXT NOT NULL DEFAULT 'user',
    active        INTEGER NOT NULL DEFAULT 1,
    login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until  TEXT,
    created       TEXT NOT NULL,
    last_login    TEXT
  );

  CREATE TABLE IF NOT EXISTS security_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ts         TEXT NOT NULL,
    event      TEXT NOT NULL,
    email      TEXT,
    ip         TEXT,
    details    TEXT
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    token   TEXT PRIMARY KEY,
    email   TEXT NOT NULL,
    expires TEXT NOT NULL,
    used    INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS cv (
    id        TEXT PRIMARY KEY,
    imie      TEXT NOT NULL DEFAULT '',
    nazwisko  TEXT NOT NULL DEFAULT '',
    badge     TEXT NOT NULL DEFAULT '',
    step      INTEGER NOT NULL DEFAULT 0,
    is_draft  INTEGER NOT NULL DEFAULT 0,
    photo_ext TEXT NOT NULL DEFAULT '',
    updated   TEXT NOT NULL,
    created   TEXT NOT NULL,
    data_json TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_users_email   ON users(email);
  CREATE INDEX IF NOT EXISTS idx_seclog_ts     ON security_log(ts);
  CREATE INDEX IF NOT EXISTS idx_seclog_email  ON security_log(email);
  CREATE INDEX IF NOT EXISTS idx_imie          ON cv(imie);
  CREATE INDEX IF NOT EXISTS idx_nazwisko      ON cv(nazwisko);
  CREATE INDEX IF NOT EXISTS idx_updated       ON cv(updated);
  CREATE INDEX IF NOT EXISTS idx_draft         ON cv(is_draft);
`);

// ============================================================
// SECURITY LOG HELPER
// ============================================================
function secLog(event, email, ip, details) {
  try {
    db.prepare(`INSERT INTO security_log (ts,event,email,ip,details) VALUES (?,?,?,?,?)`)
      .run(new Date().toISOString(), event, email||null, ip||null, details||null);
  } catch(e) {}
}

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  const token  = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, CONFIG.JWT_SECRET);
    next();
  } catch(e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (key && key === CONFIG.API_KEY) return next();
  requireAuth(req, res, next);
}

// ============================================================
// PHOTO HELPERS
// ============================================================
function savePhoto(cvId, base64Data) {
  if (!base64Data || !base64Data.startsWith('data:image')) return '';
  try {
    const match = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) return '';
    fs.writeFileSync(path.join(PHO_DIR, `${cvId}.${match[1]}`), Buffer.from(match[2], 'base64'));
    return match[1];
  } catch(e) { return ''; }
}

function loadPhoto(cvId, ext) {
  if (!ext) return '';
  try {
    const file = path.join(PHO_DIR, `${cvId}.${ext}`);
    if (!fs.existsSync(file)) return '';
    return `data:image/${ext};base64,` + fs.readFileSync(file).toString('base64');
  } catch(e) { return ''; }
}

function deletePhoto(cvId, ext) {
  if (!ext) return;
  try {
    const file = path.join(PHO_DIR, `${cvId}.${ext}`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch(e) {}
}

// ============================================================
// PREPARED STATEMENTS
// ============================================================
const stmt = {
  // Users
  userByEmail:      db.prepare(`SELECT * FROM users WHERE email=?`),
  userById:         db.prepare(`SELECT id,email,name,role,active,login_attempts,locked_until,created,last_login FROM users WHERE id=?`),
  usersList:        db.prepare(`SELECT id,email,name,role,active,login_attempts,locked_until,created,last_login FROM users ORDER BY created DESC`),
  userInsert:       db.prepare(`INSERT INTO users (id,email,password,name,role,active,login_attempts,created) VALUES (@id,@email,@password,@name,@role,@active,0,@created)`),
  userUpdate:       db.prepare(`UPDATE users SET name=@name,role=@role,active=@active WHERE id=@id`),
  userPassword:     db.prepare(`UPDATE users SET password=@password,login_attempts=0,locked_until=NULL WHERE email=@email`),
  userLastLogin:    db.prepare(`UPDATE users SET last_login=@time,login_attempts=0,locked_until=NULL WHERE id=@id`),
  userFailedLogin:  db.prepare(`UPDATE users SET login_attempts=login_attempts+1 WHERE email=@email`),
  userLock:         db.prepare(`UPDATE users SET locked_until=@until WHERE email=@email`),
  userUnlock:       db.prepare(`UPDATE users SET login_attempts=0,locked_until=NULL WHERE id=@id`),
  userDelete:       db.prepare(`DELETE FROM users WHERE id=?`),

  // Security log
  secLogList:       db.prepare(`SELECT * FROM security_log ORDER BY ts DESC LIMIT 200`),
  secLogCleanup:    db.prepare(`DELETE FROM security_log WHERE ts < @cutoff`),

  // Password resets
  resetInsert:      db.prepare(`INSERT OR REPLACE INTO password_resets (token,email,expires,used) VALUES (@token,@email,@expires,0)`),
  resetGet:         db.prepare(`SELECT * FROM password_resets WHERE token=? AND used=0`),
  resetMarkUsed:    db.prepare(`UPDATE password_resets SET used=1 WHERE token=?`),
  resetCleanup:     db.prepare(`DELETE FROM password_resets WHERE expires < ? OR used=1`),

  // CV
  cvUpsert:    db.prepare(`INSERT INTO cv (id,imie,nazwisko,badge,step,is_draft,photo_ext,updated,created,data_json) VALUES (@id,@imie,@nazwisko,@badge,@step,@is_draft,@photo_ext,@updated,@created,@data_json) ON CONFLICT(id) DO UPDATE SET imie=excluded.imie,nazwisko=excluded.nazwisko,badge=excluded.badge,step=excluded.step,is_draft=excluded.is_draft,photo_ext=excluded.photo_ext,updated=excluded.updated,data_json=excluded.data_json`),
  cvGetAll:    db.prepare(`SELECT id,imie,nazwisko,badge,step,photo_ext,updated,created FROM cv WHERE is_draft=0 ORDER BY updated DESC LIMIT 500`),
  cvSearch:    db.prepare(`SELECT id,imie,nazwisko,badge,step,photo_ext,updated,created FROM cv WHERE is_draft=0 AND (imie LIKE @q OR nazwisko LIKE @q OR (imie||' '||nazwisko) LIKE @q) ORDER BY updated DESC LIMIT 100`),
  cvGetOne:    db.prepare(`SELECT * FROM cv WHERE id=?`),
  cvDelete:    db.prepare(`DELETE FROM cv WHERE id=?`),
  cvCleanList: db.prepare(`SELECT id,photo_ext FROM cv WHERE updated < @cutoff`),
  cvCleanDel:  db.prepare(`DELETE FROM cv WHERE updated < @cutoff`),
  cvCount:     db.prepare(`SELECT COUNT(*) as total FROM cv WHERE is_draft=0`)
};

// ============================================================
// ROUTES — AUTH
// ============================================================

app.get('/health', (req, res) => {
  const { total } = stmt.cvCount.get();
  res.json({ status: 'ok', total, time: new Date().toISOString() });
});

// POST /auth/login
app.post('/auth/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = stmt.userByEmail.get(email.toLowerCase().trim());

  // User not found
  if (!user) {
    secLog('LOGIN_FAILED', email, ip, 'User not found');
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Account disabled by admin
  if (!user.active) {
    secLog('LOGIN_BLOCKED', email, ip, 'Account disabled');
    return res.status(401).json({ error: 'Account has been disabled. Contact administrator.' });
  }

  // Check if account is locked
  if (user.locked_until) {
    const lockTime = new Date(user.locked_until);
    if (lockTime > new Date()) {
      const minutesLeft = Math.ceil((lockTime - new Date()) / 60000);
      secLog('LOGIN_LOCKED', email, ip, `Locked for ${minutesLeft} more minutes`);
      return res.status(401).json({ error: `Account locked. Try again in ${minutesLeft} minute(s).` });
    }
    // Lock expired — auto-unlock
    stmt.userUnlock.run({ id: user.id });
  }

  // Verify password
  const valid = await bcrypt.compare(password, user.password);

  if (!valid) {
    stmt.userFailedLogin.run({ email: user.email });
    const attempts = user.login_attempts + 1;

    // Lock account after MAX_LOGIN_ATTEMPTS
    if (attempts >= CONFIG.MAX_LOGIN_ATTEMPTS) {
      const until = new Date(Date.now() + CONFIG.LOCKOUT_MINUTES * 60000).toISOString();
      stmt.userLock.run({ until, email: user.email });
      secLog('ACCOUNT_LOCKED', email, ip, `Locked after ${attempts} failed attempts`);

      // Send email notification
      try {
        await mailer.sendMail({
          from:    `"Betreuung 24" <${CONFIG.SMTP.auth.user}>`,
          to:      user.email,
          subject: 'Ihr Konto wurde gesperrt – Betreuung 24',
          html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:32px;">
            <h2 style="color:#ef4444;">⚠️ Konto gesperrt</h2>
            <p>Hallo ${user.name || user.email},</p>
            <p>Ihr Konto wurde nach <strong>${attempts} fehlgeschlagenen Anmeldeversuchen</strong> vorübergehend gesperrt.</p>
            <p>Die Sperre wird automatisch nach <strong>${CONFIG.LOCKOUT_MINUTES} Minuten</strong> aufgehoben.</p>
            <p>Falls Sie das nicht waren, kontaktieren Sie sofort Ihren Administrator.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
            <p style="color:#aaa;font-size:11px;">IP-Adresse: ${ip} · ${new Date().toISOString()}</p>
          </div>`
        });
      } catch(e) {}

      return res.status(401).json({ error: `Account locked for ${CONFIG.LOCKOUT_MINUTES} minutes due to too many failed attempts.` });
    }

    const remaining = CONFIG.MAX_LOGIN_ATTEMPTS - attempts;
    secLog('LOGIN_FAILED', email, ip, `Wrong password, ${remaining} attempts remaining`);
    return res.status(401).json({ error: `Invalid email or password. ${remaining} attempt(s) remaining.` });
  }

  // Success
  stmt.userLastLogin.run({ time: new Date().toISOString(), id: user.id });
  secLog('LOGIN_SUCCESS', email, ip, null);

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    CONFIG.JWT_SECRET,
    { expiresIn: CONFIG.JWT_EXPIRES_IN }
  );

  res.json({ ok: true, token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

// POST /auth/forgot
app.post('/auth/forgot', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const user = stmt.userByEmail.get(email.toLowerCase().trim());
  if (!user) return res.json({ ok: true }); // Don't reveal if email exists

  const token   = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + CONFIG.RESET_TOKEN_HOURS * 3600000).toISOString();
  stmt.resetInsert.run({ token, email: user.email, expires });
  secLog('PASSWORD_RESET_REQUESTED', user.email, req.ip, null);

  const resetUrl = `${CONFIG.APP_URL}?reset=${token}`;
  try {
    await mailer.sendMail({
      from:    `"Betreuung 24" <${CONFIG.SMTP.auth.user}>`,
      to:      user.email,
      subject: 'Passwort zurücksetzen – Betreuung 24',
      html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:32px;">
        <h2 style="color:#0d1b3e;">Passwort zurücksetzen</h2>
        <p>Hallo ${user.name || user.email},</p>
        <p>Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.</p>
        <p>Klicken Sie auf den folgenden Link. Der Link ist <strong>1 Stunde</strong> gültig:</p>
        <a href="${resetUrl}" style="display:inline-block;background:#f7a800;color:#0d1b3e;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">
          Passwort zurücksetzen
        </a>
        <p style="color:#888;font-size:12px;">Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="color:#aaa;font-size:11px;">Betreuung 24 Sp. z o.o | Al. Jerozolimskie 93, 02-001 Warschau</p>
      </div>`
    });
  } catch(e) {
    console.error('Email error:', e.message);
    return res.status(500).json({ error: 'Failed to send email. Check SMTP configuration.' });
  }
  res.json({ ok: true });
});

// POST /auth/reset
app.post('/auth/reset', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const record = stmt.resetGet.get(token);
  if (!record) return res.status(400).json({ error: 'Invalid or expired reset link' });
  if (new Date(record.expires) < new Date()) return res.status(400).json({ error: 'Reset link has expired' });

  const hash = await bcrypt.hash(password, CONFIG.BCRYPT_ROUNDS);
  stmt.userPassword.run({ password: hash, email: record.email });
  stmt.resetMarkUsed.run(token);
  secLog('PASSWORD_RESET_SUCCESS', record.email, req.ip, null);

  res.json({ ok: true });
});

// GET /auth/me
app.get('/auth/me', requireAuth, (req, res) => {
  const user = stmt.userById.get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ============================================================
// ROUTES — USER MANAGEMENT (admin only)
// ============================================================

app.get('/users', requireAuth, requireAdmin, (req, res) => {
  res.json(stmt.usersList.all());
});

app.post('/users', requireAuth, requireAdmin, async (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const id   = 'usr_' + Date.now();
  const hash = await bcrypt.hash(password, CONFIG.BCRYPT_ROUNDS);
  try {
    stmt.userInsert.run({ id, email: email.toLowerCase().trim(), password: hash, name: name||'', role: role||'user', active: 1, created: new Date().toISOString() });
    secLog('USER_CREATED', email, req.ip, `Role: ${role||'user'}`);
    res.json({ ok: true, id });
  } catch(e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: e.message });
  }
});

app.put('/users/:id', requireAuth, requireAdmin, (req, res) => {
  const { name, role, active } = req.body;
  try {
    stmt.userUpdate.run({ id: req.params.id, name: name||'', role: role||'user', active: active?1:0 });
    secLog('USER_UPDATED', null, req.ip, `ID: ${req.params.id} active:${active} role:${role}`);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT /users/:id/unlock — admin unlocks a locked account
app.put('/users/:id/unlock', requireAuth, requireAdmin, (req, res) => {
  try {
    stmt.userUnlock.run({ id: req.params.id });
    secLog('ACCOUNT_UNLOCKED', null, req.ip, `ID: ${req.params.id} by admin ${req.user.email}`);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/users/:id', requireAuth, requireAdmin, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
  try {
    stmt.userDelete.run(req.params.id);
    secLog('USER_DELETED', null, req.ip, `ID: ${req.params.id}`);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /security-log — admin only
app.get('/security-log', requireAuth, requireAdmin, (req, res) => {
  res.json(stmt.secLogList.all());
});

// ============================================================
// ROUTES — CV
// ============================================================
app.get('/cv/list',      requireApiKey, (req, res) => {
  try { res.json(stmt.cvGetAll.all()); } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/cv/search',    requireApiKey, (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json(stmt.cvGetAll.all());
  try { res.json(stmt.cvSearch.all({ q: `%${q}%` })); } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/cv/stats',     requireApiKey, (req, res) => {
  try {
    const { total } = stmt.cvCount.get();
    let mb = 0;
    try { mb = fs.readdirSync(PHO_DIR).reduce((s,f) => { try { return s + fs.statSync(path.join(PHO_DIR,f)).size; } catch(e){ return s; } }, 0) / (1024*1024); } catch(e) {}
    res.json({ total, retention_days: CONFIG.RETENTION_DAYS, photos_mb: Math.round(mb*10)/10 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/cv/:id',       requireApiKey, (req, res) => {
  try {
    const row = stmt.cvGetOne.get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const data = JSON.parse(row.data_json);
    data.photo = loadPhoto(row.id, row.photo_ext);
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/cv/save',     requireApiKey, (req, res) => {
  const data = req.body;
  if (!data || !data.imie) return res.status(400).json({ error: 'Missing first name (imie)' });
  const id  = (data.id && !data.id.startsWith('draft_')) ? data.id : ('cv_' + Date.now());
  const now = new Date().toISOString();
  const photoExt = savePhoto(id, data.photo || '');
  const store = { ...data }; delete store.photo;
  store.id = id; store.updated = now;
  try {
    const existing = stmt.cvGetOne.get(id);
    stmt.cvUpsert.run({ id, imie:(data.imie||'').trim(), nazwisko:(data.nazwisko||'').trim(), badge:data.badge||'', step:data.step||0, is_draft:0, photo_ext:photoExt||(existing?.photo_ext||''), updated:now, created:now, data_json:JSON.stringify(store) });
    res.json({ ok: true, id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/cv/draft',    requireApiKey, (req, res) => {
  const data = req.body;
  if (!data || !data.imie) return res.json({ ok: false });
  const id  = 'draft_' + (data.imie||'x').trim().replace(/\s+/g,'_').toLowerCase();
  const now = new Date().toISOString();
  const photoExt = savePhoto(id, data.photo || '');
  const store = { ...data }; delete store.photo; store.id = id;
  try {
    const existing = stmt.cvGetOne.get(id);
    stmt.cvUpsert.run({ id, imie:(data.imie||'').trim(), nazwisko:(data.nazwisko||'').trim(), badge:data.badge||'', step:data.step||0, is_draft:1, photo_ext:photoExt||(existing?.photo_ext||''), updated:now, created:now, data_json:JSON.stringify(store) });
    res.json({ ok: true, id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/cv/draft/:name', requireApiKey, (req, res) => {
  try {
    const row = stmt.cvGetOne.get('draft_' + req.params.name.toLowerCase());
    if (!row) return res.status(404).json({ error: 'Draft not found' });
    const data = JSON.parse(row.data_json);
    data.photo = loadPhoto(row.id, row.photo_ext);
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/cv/:id',    requireApiKey, (req, res) => {
  try {
    const row = stmt.cvGetOne.get(req.params.id);
    if (row) deletePhoto(row.id, row.photo_ext);
    stmt.cvDelete.run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// ROUTES — AI GENERATION (queued)
// ============================================================

// GET /ai/status — check queue status (no auth needed)
app.get('/ai/status', (req, res) => {
  res.json({
    queue:   aiQueue.queueLength,
    running: aiQueue.isRunning,
    max:     CONFIG.OLLAMA_MAX_QUEUE
  });
});

// POST /ai/generate — queued Ollama generation
app.post('/ai/generate', requireApiKey, async (req, res) => {
  const { model, prompt, options } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  const position = aiQueue.queueLength + (aiQueue.isRunning ? 1 : 0);

  try {
    const data = await aiQueue.add({
      model:   model   || 'mistral',
      prompt:  prompt,
      stream:  false,
      options: options || { temperature: 0.85, num_predict: 280 }
    });
    res.json({ ok: true, response: data.response || '' });
  } catch(e) {
    if (e.name === 'AbortError') {
      return res.status(504).json({ error: 'Generation timed out after 2 minutes' });
    }
    res.status(503).json({ error: e.message });
  }
});

// ============================================================
// SCHEDULED JOBS
// ============================================================

// Nightly backup at 3:00 AM
cron.schedule('0 3 * * *', () => {
  try {
    const stamp  = new Date().toISOString().slice(0,10);
    const backup = path.join(BAK_DIR, `cv-${stamp}.db`);
    fs.copyFileSync(DB_PATH, backup);
    const files = fs.readdirSync(BAK_DIR).filter(f=>f.endsWith('.db')).sort().reverse();
    files.slice(CONFIG.BACKUP_KEEP).forEach(f => fs.unlinkSync(path.join(BAK_DIR, f)));
    console.log(`[${new Date().toISOString()}] Backup: ${backup} (kept ${Math.min(files.length, CONFIG.BACKUP_KEEP)})`);
  } catch(e) { console.error('Backup error:', e.message); }
});

// Auto-cleanup at 2:00 AM
cron.schedule('0 2 * * *', () => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CONFIG.RETENTION_DAYS);
  const cutoffStr = cutoff.toISOString();
  try {
    stmt.cvCleanList.all({ cutoff: cutoffStr }).forEach(r => deletePhoto(r.id, r.photo_ext));
    const r = stmt.cvCleanDel.run({ cutoff: cutoffStr });
    stmt.resetCleanup.run(new Date().toISOString());
    // Clean security log older than 1 year
    const logCutoff = new Date(); logCutoff.setFullYear(logCutoff.getFullYear() - 1);
    stmt.secLogCleanup.run({ cutoff: logCutoff.toISOString() });
    if (r.changes > 0) console.log(`[${new Date().toISOString()}] Cleanup: deleted ${r.changes} old CV records`);
  } catch(e) { console.error('Cleanup error:', e.message); }
});

// ============================================================
// STATIC FILES (fallback)
// ============================================================
// Serves index.html, fonts and images when no reverse proxy is in front
// (local Docker, Railway). On production Nginx serves these first, so this
// middleware is never reached there. Must stay AFTER every API route.
const STATIC_DIR = process.env.STATIC_DIR || __dirname;

// index.html ships with __API_KEY_PLACEHOLDER__ instead of a committed key.
// It is substituted from the environment at request time, so the key exists
// only in env vars. Must be registered before express.static below.
app.get(['/', '/index.html'], (req, res) => {
  fs.readFile(path.join(STATIC_DIR, 'index.html'), 'utf8', (err, html) => {
    if (err) return res.status(500).send('index.html not found');
    res.type('html').send(html.split('__API_KEY_PLACEHOLDER__').join(CONFIG.API_KEY));
  });
});

app.use(express.static(STATIC_DIR));

// ============================================================
// START
// ============================================================
app.listen(PORT, HOST, () => {
  const { total } = stmt.cvCount.get();
  const users = stmt.usersList.all().length;
  console.log(`[${new Date().toISOString()}] CV API v4 running on ${HOST}:${PORT}`);
  console.log(`CVs: ${total} | Users: ${users} | DB: ${DB_PATH}`);
  console.log(`Security: JWT 12h | Rate limit: 5 logins/15min | Lockout after ${CONFIG.MAX_LOGIN_ATTEMPTS} attempts`);
});
