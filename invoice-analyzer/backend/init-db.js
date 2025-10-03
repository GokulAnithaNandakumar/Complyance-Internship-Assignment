const { pool } = require('./config/database');

async function initializeDatabase() {
  try {
    console.log('Initializing database...');
    
    // Create reports table if it doesn't exist
    const createReportsTable = `
      CREATE TABLE IF NOT EXISTS reports (
        id VARCHAR(255) PRIMARY KEY,
        upload_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        scores_overall INTEGER DEFAULT 0,
        report_json JSONB NOT NULL,
        expires_at TIMESTAMP NOT NULL
      );
    `;
    
    await pool.query(createReportsTable);
    console.log('Reports table created/verified');
    
    // Create index on expires_at for efficient cleanup
    const createIndex = `
      CREATE INDEX IF NOT EXISTS idx_reports_expires_at 
      ON reports (expires_at);
    `;
    
    await pool.query(createIndex);
    console.log('Database indexes created/verified');
    
    // Test connection
    const testQuery = 'SELECT COUNT(*) as count FROM reports';
    const result = await pool.query(testQuery);
    console.log(`Database initialized successfully. Found ${result.rows[0].count} existing reports.`);
    
  } catch (error) {
    console.error('Database initialization error:', error);
    console.log('Falling back to memory storage only.');
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase().then(() => {
    console.log('Database initialization complete');
    process.exit(0);
  }).catch(error => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
}

module.exports = { initializeDatabase };