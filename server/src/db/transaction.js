import { pool } from './pool.js';

// Runs `work(connection)` inside a transaction on a dedicated connection.
// Commits if it resolves, rolls back if it throws, and always releases.
export async function withTransaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}
