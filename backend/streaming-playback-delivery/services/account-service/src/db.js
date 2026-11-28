const { Pool } = require('pg');
const config = require('./config');
const { camelRows } = require('./utils/camel');

const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });
pool.on('error', (err) => console.error('[pg] idle client error:', err.message));

// Returns rows with camelCase keys.
async function query(text, params, client = pool) {
  const res = await client.query(text, params);
  return camelRows(res.rows);
}

// Runs fn(client) inside a transaction; rolls back on any thrown error.
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, tx };
