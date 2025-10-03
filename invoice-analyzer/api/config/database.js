const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Initialize database tables
const initDb = async () => {
  try {
    // Create uploads table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS uploads (
        id VARCHAR(255) PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        country VARCHAR(10),
        erp VARCHAR(100),
        rows_parsed INTEGER,
        pii_masked BOOLEAN DEFAULT false,
        file_type VARCHAR(10),
        original_filename VARCHAR(255)
      )
    `);

    // Create reports table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id VARCHAR(255) PRIMARY KEY,
        upload_id VARCHAR(255) REFERENCES uploads(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        scores_overall INTEGER,
        report_json JSONB,
        expires_at TIMESTAMP
      )
    `);

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('Database connected successfully at:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
};

module.exports = {
  pool,
  initDb,
  testConnection
};