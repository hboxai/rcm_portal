// Centralized claim status configuration.
// Provides a single source for status & closure options plus style mapping.

export const CLAIM_STATUS_OPTIONS: string[] = [
  'Claim not filed',
  'Claim not received from HBox',
  'Deductible Applied',
  'High Copay Writeoff',
  'Inpatient for DOS',
  'Insurance Paid',
  'Multiple Provider enrollment',
  'No Sec Ins',
  'Patient Deceased',
  'Policy Inactive',
  'Prim Denied',
  'Prim Pymt Pending',
  'Program not covered',
  'Sec Denied. Prim Paid more than Allowed amt',
  'Sec not paying',
  'Sec Pymt Pending'
];

export const CLAIM_CLOSURE_OPTIONS: string[] = [
  'Completed - Payment Received',
  'Closed - Denied with no appeal',
  'Closed - Write-off',
  'Closed - Patient Responsibility',
  'Closed - Timely Filing',
  'Closed - Non-covered Service',
  'Closed - Duplicate Claim'
];

export function getClaimStatusStyle(status?: string): string {
  if (!status) return 'bg-gray-600/30 text-white/70';
  switch (status) {
    case 'Insurance Paid':
    case 'Claim not filed':
    case 'Posted':
      return 'bg-green/20 text-green';
    case 'Prim Denied':
    case 'Sec Denied. Prim Paid more than Allowed amt':
    case 'Patient Deceased':
    case 'Rejected':
      return 'bg-red/20 text-red';
    case 'Prim Pymt Pending':
    case 'Sec Pymt Pending':
    case 'Claim not received from HBox':
    case 'Pending':
      return 'bg-yellow/20 text-yellow';
    default:
      return 'bg-blue/20 text-blue';
  }
}
