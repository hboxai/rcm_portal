import fs from 'fs';
import XLSX from 'xlsx';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'rcm_portal',
  port: 5432
});

async function analyzeMapping() {
  try {
    // 1. Get Excel headers
    console.log('=== EXCEL FILE HEADERS ===');
    const excelPath = 'uploads/excel/1756365436538-Venocure Upload _6_11_2025_File1.xls';
    const wb = XLSX.readFile(excelPath);
    const sheet = wb.SheetNames[0];
    const ws = wb.Sheets[sheet];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false, blankrows: false });
    const excelHeaders = rows.length ? Object.keys(rows[0]) : [];
    
    console.log('Total Excel headers:', excelHeaders.length);
    excelHeaders.forEach((h, i) => console.log(`  ${i+1}. ${h}`));
    
    // 2. Get database table structure
    console.log('\n=== DATABASE TABLE STRUCTURE ===');
    const res = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='api_bil_claim_submit' 
      ORDER BY ordinal_position
    `);
    
    console.log('api_bil_claim_submit columns:', res.rows.length);
    res.rows.forEach((r, i) => {
      console.log(`  ${i+1}. ${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`);
    });
    
    // 3. Show some key mappings we need
    console.log('\n=== KEY MAPPINGS NEEDED ===');
    console.log('Excel -> Database');
    console.log('PatientID -> patient_id');
    console.log('PatientDOB -> dateofbirth');
    console.log('InsurancePlanName -> insuranceplanname');
    console.log('CPTCode -> cptcode');
    console.log('DiagCode1 -> diagnosiscode');
    console.log('DateOfService -> dateofservice');
    console.log('RenderingProviderName -> renderingprovidername');
    console.log('Charges -> charges');
    console.log('Units -> units');
    
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    await pool.end();
  }
}

analyzeMapping();
