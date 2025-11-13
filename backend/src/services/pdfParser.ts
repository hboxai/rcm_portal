import PDFParser from 'pdf2json';
import { downloadFromS3 } from './s3.js';

type ParsedRow = {
  submit_cpt_id?: string;
  billing_id?: number;
  patient_id?: string;
  cpt_code?: string;
  dos?: string;
  prim_amt?: number;
  prim_chk_det?: string;
  prim_recv_dt?: string;
  sec_amt?: number;
  pat_amt?: number;
  allowed_amt?: number;
  write_off_amt?: number;
  claim_status?: string;
};

/**
 * Parse ERA PDF from S3 and extract claim data
 */
export async function parseEraPdf(bucket: string, key: string): Promise<ParsedRow[]> {
  try {
    // Download PDF from S3
    const pdfBuffer = await downloadFromS3({ bucket, key });
    
    // Extract text from PDF using pdf2json
    const text = await extractTextFromPdf(pdfBuffer);
    
    console.log('PDF Text extracted, length:', text.length);
    
    // Parse the text to extract claim rows
    const rows = extractClaimRows(text);
    
    console.log('Extracted rows:', rows.length);
    return rows;
  } catch (error) {
    console.error('Error parsing ERA PDF:', error);
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from PDF buffer using pdf2json
 */
function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new (PDFParser as any)(null, 1);
    
    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        // Extract all text from all pages
        let text = '';
        if (pdfData.Pages) {
          for (const page of pdfData.Pages) {
            if (page.Texts) {
              for (const textItem of page.Texts) {
                if (textItem.R) {
                  for (const run of textItem.R) {
                    if (run.T) {
                      text += decodeURIComponent(run.T) + ' ';
                    }
                  }
                }
              }
              text += '\n';
            }
          }
        }
        resolve(text);
      } catch (err) {
        reject(err);
      }
    });
    
    pdfParser.on('pdfParser_dataError', (errData: any) => {
      reject(new Error(errData.parserError || 'PDF parsing failed'));
    });
    
    pdfParser.parseBuffer(pdfBuffer);
  });
}

/**
 * Extract claim rows from ERA PDF text
 * This is a basic parser - you may need to customize based on your ERA format
 */
function extractClaimRows(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  // Common ERA patterns to look for
  // Pattern 1: Look for claim IDs, CPT codes, amounts
  const claimIdPattern = /(?:CLAIM|CLM|ID)[:\s#]*([A-Z0-9-]+)/i;
  const cptPattern = /(?:CPT|PROC)[:\s]*(\d{5})/i;
  const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;
  const amountPattern = /\$?\s*(\d+\.\d{2})/g;
  
  let currentRow: Partial<ParsedRow> = {};
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Look for claim identifier
    const claimMatch = line.match(claimIdPattern);
    if (claimMatch) {
      // Save previous row if exists
      if (Object.keys(currentRow).length > 0) {
        rows.push(currentRow as ParsedRow);
      }
      currentRow = {
        submit_cpt_id: claimMatch[1]
      };
    }
    
    // Look for CPT code
    const cptMatch = line.match(cptPattern);
    if (cptMatch && currentRow) {
      currentRow.cpt_code = cptMatch[1];
    }
    
    // Look for dates
    const dateMatch = line.match(datePattern);
    if (dateMatch && currentRow) {
      const dateStr = normalizeDate(dateMatch[1]);
      if (!currentRow.dos) {
        currentRow.dos = dateStr;
      } else if (!currentRow.prim_recv_dt) {
        currentRow.prim_recv_dt = dateStr;
      }
    }
    
    // Look for amounts (primary, secondary, patient)
    const amounts = [...line.matchAll(amountPattern)];
    if (amounts.length > 0 && currentRow) {
      // Common pattern: Primary, Secondary, Patient amounts
      if (amounts[0] && !currentRow.prim_amt) {
        currentRow.prim_amt = parseFloat(amounts[0][1]);
      }
      if (amounts[1] && !currentRow.sec_amt) {
        currentRow.sec_amt = parseFloat(amounts[1][1]);
      }
      if (amounts[2] && !currentRow.pat_amt) {
        currentRow.pat_amt = parseFloat(amounts[2][1]);
      }
    }
    
    // Look for check numbers
    if (line.includes('CHECK') || line.includes('CHK')) {
      const checkMatch = line.match(/(?:CHECK|CHK)[#:\s]*([A-Z0-9-]+)/i);
      if (checkMatch && currentRow) {
        currentRow.prim_chk_det = checkMatch[1];
      }
    }
    
    // Look for patient ID
    if (line.includes('PATIENT') && !currentRow.patient_id) {
      const patMatch = line.match(/PATIENT[:\s#]*([A-Z0-9-]+)/i);
      if (patMatch) {
        currentRow.patient_id = patMatch[1];
      }
    }
  }
  
  // Add last row
  if (Object.keys(currentRow).length > 0) {
    rows.push(currentRow as ParsedRow);
  }
  
  // Filter out rows with minimal data
  return rows.filter(r => 
    (r.submit_cpt_id || r.patient_id || r.cpt_code) && 
    (r.prim_amt || r.sec_amt || r.pat_amt)
  );
}

/**
 * Normalize date to YYYY-MM-DD format
 */
function normalizeDate(dateStr: string): string {
  try {
    // Handle MM/DD/YYYY, M/D/YY, etc.
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      let [month, day, year] = parts;
      
      // Handle 2-digit year
      if (year.length === 2) {
        year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
      }
      
      // Pad month and day
      month = month.padStart(2, '0');
      day = day.padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    }
  } catch (e) {
    console.error('Date parse error:', e);
  }
  return dateStr;
}
