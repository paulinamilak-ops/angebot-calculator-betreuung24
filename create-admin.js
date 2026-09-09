/**
 * Create first admin user
 * Usage: node create-admin.js email@domain.com YourPassword123 "Your Name"
 */
const Database = require('better-sqlite3');
const bcrypt   = require('bcrypt');
const path     = require('path');
const fs       = require('fs');

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node create-admin.js email@domain.com Password123 "Full Name"');
  process.exit(1);
}

const [email, password, name] = args;
if (password.length < 8) { console.error('Password must be at least 8 characters'); process.exit(1); }

const DB_DIR  = path.join(__dirname, 'cv-data');
const DB_PATH = path.join(DB_DIR, 'cv.db');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'user',
    active INTEGER NOT NULL DEFAULT 1, created TEXT NOT NULL, last_login TEXT
  );
`);

(async () => {
  const hash = await bcrypt.hash(password, 10);
  const id   = 'usr_' + Date.now();
  try {
    db.prepare(`INSERT INTO users (id,email,password,name,role,active,created) VALUES (?,?,?,?,?,1,?)`)
      .run(id, email.toLowerCase().trim(), hash, name || 'Admin', 'admin', new Date().toISOString());
    console.log(`✅ Admin created: ${email}`);
    console.log(`   Role: admin | ID: ${id}`);
  } catch(e) {
    if (e.message.includes('UNIQUE')) console.error('❌ Email already exists');
    else console.error('❌ Error:', e.message);
  }
})();
