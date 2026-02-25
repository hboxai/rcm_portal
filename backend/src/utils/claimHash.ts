import * as crypto from 'crypto';

/**
 * Generate a hash for a CPT line item to detect changes
 * Includes all relevant fields for that CPT line (1-6)
 */
export function generateCptHash(lineNum: 1 | 2 | 3 | 4 | 5 | 6, claimData: any): string {
  // Fields that matter for each CPT line
  const fields = [
    `cpt_code_id${lineNum}`,
    `dateofservice${lineNum}`,
    `todateofservice${lineNum}`,
    `placeofservice${lineNum}`,
    `emg${lineNum}`,
    `charges${lineNum}`,
    `units${lineNum}`,
    `modifiera${lineNum}`,
    `modifierb${lineNum}`,
    `modifierc${lineNum}`,
    `modifierd${lineNum}`,
    `diagnosispointer${lineNum}`,
    `renderingnpi${lineNum}`,
  ];

  // Concatenate values (normalize nulls/undefined to empty string)
  const values = fields.map(f => {
    const val = claimData[f];
    return val == null ? '' : String(val).trim();
  });

  const combined = values.join('|');
  return crypto.createHash('sha256').update(combined).digest('hex');
}

/**
 * Compare old and new claim data, return list of changed fields
 */
export function detectChangedFields(oldData: any, newData: any, allFields: string[]): string[] {
  const changed: string[] = [];
  
  for (const field of allFields) {
    const oldVal = oldData[field] == null ? '' : String(oldData[field]).trim();
    const newVal = newData[field] == null ? '' : String(newData[field]).trim();
    
    if (oldVal !== newVal) {
      changed.push(field);
    }
  }
  
  return changed;
}

/**
 * Get all 280 claim fields for comparison
 * (Based on your Excel structure)
 */
export function getAllClaimFields(): string[] {
  return [
    // Patient Demographics
    'patientlast', 'patientfirst', 'patientmi', 'patientdob', 'patientgender',
    'patientaddress', 'patientcity', 'patientstate', 'patientzipcode',
    'patientphonenumber', 'patient_id',
    
    // Insurance - Primary
    'insuranceplanname', 'insurancepayerid', 'insurancepolicyholderid',
    'insurancepolicyholdername', 'insurancepolicyholderdob',
    'insurancepolicyholdergender', 'relationshiptoinsured',
    'insurancegroupnumber',
    
    // Insurance - Secondary (if applicable)
    'secondaryinsuranceplanname', 'secondaryinsurancepayerid',
    'secondaryinsurancepolicyholderid', 'secondaryinsurancepolicyholdername',
    
    // Provider Information
    'billingprovidername', 'billingprovidernpi', 'billingprovidertin',
    'billingprovideraddress', 'billingprovidercity', 'billingproviderstate',
    'billingproviderzipcode', 'billingproviderphonenumber',
    
    // Rendering Provider
    'renderingprovidername', 'renderingnpi',
    
    // Referring Provider
    'referringprovidername', 'referringnpi',
    
    // Facility Information
    'facilityname', 'facilitynpi', 'facilityaddress', 'facilitycity',
    'facilitystate', 'facilityzipcode',
    
    // Claim Information
    'oa_claimid', 'payor_reference_id', 'totalcharges',
    'amountpaid', 'patientresponsibility', 'claimnote',
    
    // Diagnosis Codes
    'diagnosis1', 'diagnosis2', 'diagnosis3', 'diagnosis4',
    'diagnosis5', 'diagnosis6', 'diagnosis7', 'diagnosis8',
    'diagnosis9', 'diagnosis10', 'diagnosis11', 'diagnosis12',
    
    // CPT Line 1
    'dateofservice1', 'todateofservice1', 'placeofservice1',
    'emg1', 'cpt_code_id1', 'modifiera1', 'modifierb1', 'modifierc1', 'modifierd1',
    'diagnosispointer1', 'charges1', 'units1',
    
    // CPT Line 2
    'dateofservice2', 'todateofservice2', 'placeofservice2',
    'emg2', 'cpt_code_id2', 'modifiera2', 'modifierb2', 'modifierc2', 'modifierd2',
    'diagnosispointer2', 'charges2', 'units2',
    
    // CPT Line 3
    'dateofservice3', 'todateofservice3', 'placeofservice3',
    'emg3', 'cpt_code_id3', 'modifiera3', 'modifierb3', 'modifierc3', 'modifierd3',
    'diagnosispointer3', 'charges3', 'units3',
    
    // CPT Line 4
    'dateofservice4', 'todateofservice4', 'placeofservice4',
    'emg4', 'cpt_code_id4', 'modifiera4', 'modifierb4', 'modifierc4', 'modifierd4',
    'diagnosispointer4', 'charges4', 'units4',
    
    // CPT Line 5
    'dateofservice5', 'todateofservice5', 'placeofservice5',
    'emg5', 'cpt_code_id5', 'modifiera5', 'modifierb5', 'modifierc5', 'modifierd5',
    'diagnosispointer5', 'charges5', 'units5',
    
    // CPT Line 6
    'dateofservice6', 'todateofservice6', 'placeofservice6',
    'emg6', 'cpt_code_id6', 'modifiera6', 'modifierb6', 'modifierc6', 'modifierd6',
    'diagnosispointer6', 'charges6', 'units6',
    
    // Additional fields (add more based on your 280 columns)
    // Add any remaining fields from your Excel structure here
  ];
}
