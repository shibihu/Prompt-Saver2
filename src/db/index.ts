import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.ts';

const { Pool } = pg;

// Function to create a new connection pool.
export const createPool = () => {
  const connectionString = process.env.DATABASE_URL || process.env.SQL_DATABASE_URL;
  if (connectionString) {
    const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
    const isRenderInternal = /dpg-[a-z0-9]+-a([:@/]|$)/i.test(connectionString) && !connectionString.includes('.render.com');
    
    if (isRenderInternal && !process.env.RENDER) {
      console.warn(
        '\n⚠️  DATABASE CONNECTION WARNING ⚠️\n' +
        'It looks like you are using a Render.com INTERNAL Database URL (host ending in "-a") ' +
        'outside of Render\'s private network.\n' +
        'To connect from AI Studio, Vercel, or local development, you MUST use Render\'s EXTERNAL Database URL ' +
        '(which ends with ".render.com").\n' +
        'Please update your DATABASE_URL environment variable to use the External Database URL.\n'
      );
    }

    return new Pool({
      connectionString,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    });
  }

  const host = process.env.SQL_HOST;
  const isLocalhost = !host || host === 'localhost' || host === '127.0.0.1';
  const isRenderInternal = host && /dpg-[a-z0-9]+-a$/i.test(host) && !host.includes('.render.com');

  if (isRenderInternal && !process.env.RENDER) {
    console.warn(
      '\n⚠️  DATABASE CONNECTION WARNING ⚠️\n' +
      'It looks like you are using a Render.com INTERNAL database host (SQL_HOST ending in "-a") ' +
      'outside of Render\'s private network.\n' +
      'To connect from AI Studio, Vercel, or local development, you MUST use Render\'s EXTERNAL database host ' +
      '(which ends with ".render.com").\n' +
      'Please update your SQL_HOST/DATABASE_URL environment variable to use the External host.\n'
    );
  }

  return new Pool({
    host: host,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
};

// Create a pool instance.
const pool = createPool();

// Prevent unhandled pool-level errors from crashing the application
pool.on('error', (err) => {
  console.error('Unexpected error on idle SQL pool client:', err);
});

// Initialize Drizzle with the pool and schema.
export const db = drizzle(pool, { schema });
