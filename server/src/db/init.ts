import { initializeDatabase, closeDatabase } from './connection.js';

try {
  initializeDatabase();
  console.log('Database initialization complete');
} catch (error) {
  console.error('Failed to initialize database:', error);
  process.exit(1);
} finally {
  closeDatabase();
}
