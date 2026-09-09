/**
 * Create a user account directly in the database.
 *
 * Usage:
 *   node create-admin.js email@domain.com Password123 "Full Name" [role]
 *
 * role: admin (default) | user | franchise
 *   admin     — everything
 *   user      — Angebot + CV creator
 *   franchise — franchise calculator only, nothing else
 *
 * Requires DATABASE_URL. The table is created by the application's
 * migrations, so start the server at least once before running this.
 */
const db     = require('./db');
const bcrypt = require('bcrypt');

const ROLES = ['admin', 'user', 'franchise'];

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node create-admin.js email@domain.com Password123 "Full Name" [admin|user|franchise]');
  process.exit(1);
}

const [email, password, name, roleArg] = args;
const role = roleArg || 'admin';

if (password.length < 8) {
  console.error('Password must be at least 8 characters');
  process.exit(1);
}
if (!ROLES.includes(role)) {
  console.error(`Unknown role "${role}". Allowed: ${ROLES.join(', ')}`);
  process.exit(1);
}

(async () => {
  try {
    await db.waitUntilReady();

    // Fail with a clear message instead of a cryptic SQL error when the
    // migrations have not run yet.
    const t = await db.query(
      "SELECT to_regclass('public.users') IS NOT NULL AS present"
    );
    if (!t.rows[0].present) {
      console.error('Table "users" does not exist yet. Start the server once so migrations run, then retry.');
      process.exit(1);
    }

    const hash = await bcrypt.hash(password, 10);
    const id   = 'usr_' + Date.now();

    await db.query(
      `INSERT INTO users (id,email,password,name,role,active,login_attempts,created)
       VALUES ($1,$2,$3,$4,$5,1,0,$6)`,
      [id, email.toLowerCase().trim(), hash, name || 'Admin', role, new Date().toISOString()]
    );

    console.log(`Account created: ${email}`);
    console.log(`  Role: ${role} | ID: ${id}`);
    if (role === 'franchise') {
      console.log('  This account sees only the franchise calculator.');
    }
  } catch (e) {
    if (e.code === '23505')      console.error('Email already exists');
    else if (e.code === '23514') console.error(`Role "${role}" rejected by the database constraint`);
    else                         console.error('Error:', e.message);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
})();
