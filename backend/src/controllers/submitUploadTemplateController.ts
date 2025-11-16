import { Request, Response } from 'express';
import * as XLSX from 'xlsx';

// Define the exact header structure for submit claims
const SUBMIT_HEADERS = [
  'Clinic Name',
  'Clinic ID',
  'Billing Name',
  'Billing NPI',
  'Patient Account Number',
  'Patient First Name',
  'Patient Last Name',
  'Patient DOB',
  'Patient Gender',
  'Insurance Name',
  'Insurance ID',
  'Subscriber ID',
  'Claim Number',
  'Service From Date',
  'Service To Date',
  'CPT ID Line 1',
  'CPT Code Line 1',
  'Units Line 1',
  'Charge Line 1',
  'CPT ID Line 2',
  'CPT Code Line 2',
  'Units Line 2',
  'Charge Line 2',
  'CPT ID Line 3',
  'CPT Code Line 3',
  'Units Line 3',
  'Charge Line 3',
  'CPT ID Line 4',
  'CPT Code Line 4',
  'Units Line 4',
  'Charge Line 4',
  'CPT ID Line 5',
  'CPT Code Line 5',
  'Units Line 5',
  'Charge Line 5',
  'CPT ID Line 6',
  'CPT Code Line 6',
  'Units Line 6',
  'Charge Line 6',
  'Total Charge',
  'Provider Name',
  'Provider NPI',
  'Rendering Provider Name',
  'Rendering Provider NPI',
  'Place of Service'
];

// Sample data row for reference
const SAMPLE_DATA = [
  'ABC Medical Center',
  'CLINIC001',
  'ABC Billing LLC',
  '1234567890',
  'PAT001',
  'John',
  'Doe',
  '1980-01-15',
  'M',
  'Blue Cross',
  'BC123456',
  'SUB789',
  'CLM2024001',
  '2024-01-10',
  '2024-01-10',
  'CPT001',
  '99213',
  '1',
  '150.00',
  'CPT002',
  '90834',
  '1',
  '200.00',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '350.00',
  'Dr. Jane Smith',
  '9876543210',
  'Dr. Jane Smith',
  '9876543210',
  '11'
];

/**
 * Download Excel template for submit claims upload
 * GET /api/submit/upload/template
 */
export const downloadSubmitTemplate = async (req: Request, res: Response) => {
  try {
    // Create workbook with two sheets
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Template with headers and sample data
    const templateData = [
      SUBMIT_HEADERS,
      SAMPLE_DATA
    ];
    const templateSheet = XLSX.utils.aoa_to_sheet(templateData);

    // Set column widths for better readability
    const colWidths = SUBMIT_HEADERS.map(header => ({
      wch: Math.max(header.length + 2, 15)
    }));
    templateSheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, templateSheet, 'Submit Claims Template');

    // Sheet 2: Instructions
    const instructions = [
      ['Submit Claims Upload Template - Instructions'],
      [],
      ['REQUIRED FIELDS (must have values):'],
      ['- Clinic Name'],
      ['- Clinic ID'],
      ['- Patient Account Number'],
      ['- Patient First Name'],
      ['- Patient Last Name'],
      ['- Patient DOB (format: YYYY-MM-DD)'],
      ['- Service From Date (format: YYYY-MM-DD)'],
      ['- Service To Date (format: YYYY-MM-DD)'],
      ['- At least one CPT line with: CPT ID, CPT Code, Units, Charge'],
      [],
      ['OPTIONAL FIELDS:'],
      ['- All other fields can be left empty if not applicable'],
      ['- You can include up to 6 CPT lines per claim'],
      ['- If fewer than 6 CPT lines, leave remaining CPT fields empty'],
      [],
      ['DATE FORMAT:'],
      ['- All dates must be in YYYY-MM-DD format (e.g., 2024-01-15)'],
      ['- Patient DOB, Service From Date, Service To Date'],
      [],
      ['CPT LINES:'],
      ['- Each claim can have 1-6 CPT procedure lines'],
      ['- For each CPT line, provide: CPT ID, CPT Code, Units, Charge'],
      ['- CPT ID must be unique across all claims (used for duplicate detection)'],
      ['- Units must be a positive number'],
      ['- Charge must be a decimal amount (e.g., 150.00)'],
      [],
      ['DUPLICATE DETECTION:'],
      ['- System uses CPT ID to detect duplicates'],
      ['- If CPT ID already exists, the claim will be updated (new cycle)'],
      ['- Otherwise, a new claim will be created'],
      [],
      ['REIMBURSE MIRRORING:'],
      ['- Each submit claim automatically creates corresponding reimburse rows'],
      ['- One reimburse row per CPT line (1 claim with 3 CPTs = 3 reimburse rows)'],
      ['- Reimburse rows are linked via submit_cpt_id'],
      [],
      ['TIPS:'],
      ['- Remove the sample data row before uploading your data'],
      ['- Keep the header row exactly as shown (first row)'],
      ['- Excel will be parsed during preview - you can review before commit'],
      ['- Errors will be shown with specific row numbers for easy correction']
    ];

    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
    instructionsSheet['!cols'] = [{ wch: 80 }];

    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=submit_claims_template.xlsx');
    res.setHeader('Content-Length', buffer.length);

    // Send file
    res.send(buffer);
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate template file',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
