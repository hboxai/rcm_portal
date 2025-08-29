import { query } from '../config/db.js';

async function clearSubmitTable() {
  console.log('Clearing table: api_bil_claim_submit …');
  try {
    const before = await query('SELECT COUNT(*)::int AS n FROM api_bil_claim_submit');
    console.log(`Rows before: ${before.rows[0]?.n ?? 0}`);

    await query('BEGIN');
    try {
      // Prefer TRUNCATE with CASCADE to clean dependent rows and reset identity
      await query('TRUNCATE TABLE api_bil_claim_submit RESTART IDENTITY CASCADE');
      await query('COMMIT');
    } catch (err) {
      console.warn('TRUNCATE failed, falling back to DELETE:', (err as any)?.message || err);
      await query('ROLLBACK');
      await query('BEGIN');
      await query('DELETE FROM api_bil_claim_submit');
      await query('COMMIT');
    }

    const after = await query('SELECT COUNT(*)::int AS n FROM api_bil_claim_submit');
    console.log(`Rows after: ${after.rows[0]?.n ?? 0}`);
    console.log('Done.');
    process.exit(0);
  } catch (e) {
    console.error('Failed to clear api_bil_claim_submit:', e);
    try { await query('ROLLBACK'); } catch {}
    process.exit(1);
  }
}

clearSubmitTable();
