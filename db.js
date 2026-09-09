/**
 * Betreuung 24 — PostgreSQL access layer
 *
 * The application was originally written against better-sqlite3, whose
 * prepared statements expose .get() / .all() / .run() and accept either
 * positional (?) or named (@name) bindings. This module keeps that exact
 * surface on top of node-postgres, so call sites only need `await`.
 *
 * Placeholder translation:
 *   'SELECT * FROM users WHERE email=?'      -> $1, called with a value
 *   'UPDATE users SET name=@name WHERE id=@id' -> $1,$2, called with an object
 *
 * Every method returns a Promise.
 */

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('FATAL: DATABASE_URL is not set. The app needs a PostgreSQL database.');
  process.exit(1);
}

// Railway and most managed providers terminate TLS with their own CA.
const useSsl = process.env.PGSSL === 'require' ||
               /[?&]sslmode=require/.test(connectionString);

const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: Number(process.env.PGPOOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

/**
 * Convert a better-sqlite3 style statement into a pg statement.
 * Named (@name) and positional (?) styles are mutually exclusive within
 * one statement, which matches how the application writes its queries.
 */
function compile(sql) {
  const names = [];
  // Named bindings: @name  (skip ::type casts, which contain no @)
  let text = sql.replace(/@([a-zA-Z_][a-zA-Z0-9_]*)/g, (_m, name) => {
    let i = names.indexOf(name);
    if (i === -1) { names.push(name); i = names.length - 1; }
    return '$' + (i + 1);
  });

  if (names.length > 0) {
    return { text, names, positional: 0 };
  }

  // Positional bindings: ?
  let n = 0;
  text = sql.replace(/\?/g, () => '$' + (++n));
  return { text, names: null, positional: n };
}

function bind(compiled, arg) {
  if (compiled.names) {
    const obj = arg || {};
    return compiled.names.map((name) => {
      const v = obj[name];
      return v === undefined ? null : v;
    });
  }
  if (compiled.positional === 0) return [];
  if (Array.isArray(arg)) return arg;
  return arg === undefined ? [] : [arg];
}

class Statement {
  constructor(sql) {
    this.sql = sql;
    this.compiled = compile(sql);
  }

  async _run(arg) {
    return pool.query(this.compiled.text, bind(this.compiled, arg));
  }

  /** First row, or undefined — like better-sqlite3's .get() */
  async get(arg) {
    const r = await this._run(arg);
    return r.rows[0];
  }

  /** All rows — like better-sqlite3's .all() */
  async all(arg) {
    const r = await this._run(arg);
    return r.rows;
  }

  /**
   * Execute a write. Returns { changes, rows } — `changes` mirrors
   * better-sqlite3's naming so existing call sites keep working.
   */
  async run(arg) {
    const r = await this._run(arg);
    return { changes: r.rowCount, rows: r.rows };
  }
}

module.exports = {
  /** Build a reusable statement with the better-sqlite3 call surface. */
  prepare: (sql) => new Statement(sql),

  /** Run raw SQL (DDL, multi-statement migrations). */
  exec: (sql) => pool.query(sql),

  /** Direct parameterised query, when the shim is not needed. */
  query: (text, params) => pool.query(text, params),

  /** Dedicated client for transactions. Remember to release() it. */
  getClient: () => pool.connect(),

  /** True when the database answers. Used by /health and by startup. */
  async ping() {
    const r = await pool.query('SELECT 1 AS ok');
    return r.rows[0].ok === 1;
  },

  /**
   * Wait for the database to accept connections. Railway starts the app
   * and the database in parallel, so the first attempts can fail.
   */
  async waitUntilReady(attempts = 15, delayMs = 2000) {
    for (let i = 1; i <= attempts; i++) {
      try {
        await this.ping();
        return true;
      } catch (e) {
        if (i === attempts) throw e;
        console.log(`Waiting for PostgreSQL (${i}/${attempts}): ${e.message}`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  },

  close: () => pool.end()
};
