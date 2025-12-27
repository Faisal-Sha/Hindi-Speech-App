const { Pool } = require('pg');

function getPoolConfig() {
  // For Render deployment with DATABASE_URL
  if (process.env.DATABASE_URL) {
    const dbUrl = new URL(process.env.DATABASE_URL);
    return {
      user: dbUrl.username,
      password: dbUrl.password,
      host: dbUrl.hostname,
      port: dbUrl.port || 5432,
      database: dbUrl.pathname.split('/')[1],
      ssl: {
        rejectUnauthorized: false
      }
    };
  }

  // For Docker Compose development
  if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
    return {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'postgres', // Matches the service name in docker-compose
      database: process.env.DB_NAME || 'personal_assistant',
      password: process.env.DB_PASSWORD || 'postgres',
      port: parseInt(process.env.DB_PORT || '5432', 10)
    };
  }

  // Fallback for other environments
  return {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  };
}

const pool = new Pool(getPoolConfig());

// Test the connection
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('❌ Error connecting to the database:', err);
  } else {
    console.log(`✅ Successfully connected to database: ${pool.options.database} on ${pool.options.host}:${pool.options.port}`);
  }
});

// Handle connection errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = { pool };