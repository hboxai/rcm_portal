# Excel to Database Submit Table Mapping Guide

## Overview
This document provides a comprehensive mapping between Excel column headers and database submit table columns for the RCM Portal system.

## Mapping Logic
The system uses a normalization function to match Excel headers to database columns:

1. **Normalization Process:**
   - Remove spaces and underscores
   - Remove special characters (keep only alphanumeric and _)
   - Convert to lowercase
   - Match normalized Excel header to normalized database column

## Key Successful Mappings

### Patient Information
| Excel Header | Database Column | Data Type | Notes |
|--------------|-----------------|-----------|-------|
| PatientID | patient_id | integer | Primary patient identifier |
| PatientLast | patientlast | varchar | Patient last name |
| PatientFirst | patientfirst | varchar | Patient first name |
| PatientMidInit | patientmidinit | varchar | Patient middle initial |
| PatientDOB | patientdob | date | Patient date of birth |
| PatientMale | patientmale | varchar | Male gender indicator |
| PatientFemale | patientfemale | varchar | Female gender indicator |
| PatientStreetAddress | patientstreetaddress | varchar | Patient street address |
| PatientCity | patientcity | varchar | Patient city |
| PatientState | patientstate | varchar | Patient state |
| PatientZip | patientzip | varchar | Patient ZIP code |
| PatientPhone | patientphone | varchar | Patient phone number |

### Insurance Information
| Excel Header | Database Column | Data Type | Notes |
|--------------|-----------------|-----------|-------|
| InsurancePlanName | insuranceplanname | varchar | Insurance plan name |
| InsurancePayerID | insurancepayerid | varchar | Insurance payer ID |
| InsuranceStreetAddr | insurancestreetaddr | varchar | Insurance address |
| InsuranceCity | insurancecity | varchar | Insurance city |
| InsuranceState | insurancestate | varchar | Insurance state |
| InsuranceZip | insurancezip | varchar | Insurance ZIP |
| InsurancePhone | insurancephone | varchar | Insurance phone |
| PlanMedicare | planmedicare | varchar | Medicare plan indicator |
| PlanMedicaid | planmedicaid | varchar | Medicaid plan indicator |
| PlanChampus | planchampus | varchar | CHAMPUS plan indicator |
| PlanChampVA | planchampva | varchar | CHAMPVA plan indicator |
| PlanGroupHealthPlan | plangrouphealthplan | varchar | Group health plan |
| PlanFECA | planfeca | varchar | FECA plan indicator |
| PlanOther | planother | varchar | Other plan indicator |

### Insured Person Information
| Excel Header | Database Column | Data Type | Notes |
|--------------|-----------------|-----------|-------|
| InsuredLast | insuredlast | varchar | Insured last name |
| InsuredFirst | insuredfirst | varchar | Insured first name |
| InsuredMidInit | insuredmidinit | varchar | Insured middle initial |
| InsuredDOB | insureddob | date | Insured date of birth |
| InsuredGenderMale | insuredgendermale | varchar | Insured male indicator |
| InsuredGenderFemale | insuredgenderfemale | varchar | Insured female indicator |
| InsuredStreetAddress | insuredstreetaddress | varchar | Insured address |
| InsuredCity | insuredcity | varchar | Insured city |
| InsuredState | insuredstate | varchar | Insured state |
| InsuredZip | insuredzip | varchar | Insured ZIP |
| InsuredPhone | insuredphone | varchar | Insured phone |

### Medical Information
| Excel Header | Database Column | Data Type | Notes |
|--------------|-----------------|-----------|-------|
| DiagCode1 | diagcode1 | varchar | Primary diagnosis code |
| DiagCode2 | diagcode2 | varchar | Secondary diagnosis code |
| DiagCode3 | diagcode3 | varchar | Tertiary diagnosis code |
| CPTCode | cptcode | varchar | CPT procedure code |
| DateOfService | dateofservice | date | Date of service |
| TotalCharges | totalcharges | numeric | Total charge amount |
| ICD Indicator | icd_indicator | varchar | ICD version indicator |

### Provider Information
| Excel Header | Database Column | Data Type | Notes |
|--------------|-----------------|-----------|-------|
| RenderingProviderName | renderingprovidername | varchar | Rendering provider name |
| ReferringPhysician | referringphysician | varchar | Referring physician |
| ReferringPhysicianID | referringphysicianid | varchar | Referring physician ID |
| BillingProviderName | billingprovidername | varchar | Billing provider name |
| BillingProviderNPI | billingprovidernpi | varchar | Billing provider NPI |

## System-Generated Fields (Not in Excel)
These fields are automatically handled by the system:

| Database Column | Purpose | How Set |
|-----------------|---------|---------|
| bil_claim_submit_id | Primary key | Auto-generated |
| oa_fileid | Upload file reference | Injected during upload |
| oa_claimid | Claim ID reference | Generated |
| clinic_id | Clinic reference | Set by system |
| payor_reference_id | Payor reference | Set during processing |
| payor_status | Payor status | Set during processing |
| payor_rejection_reason | Rejection reason | Set if rejected |

## Data Validation & Sanitization
The system automatically:

1. **Type Conversion:**
   - Converts Excel strings to appropriate database types
   - Handles dates, numbers, and boolean values
   - Truncates strings to fit column length limits

2. **Data Cleaning:**
   - Removes commas from numeric values
   - Standardizes date formats
   - Handles null/empty values appropriately

3. **Validation:**
   - Ensures required fields have values
   - Validates data type compatibility
   - Checks for proper formatting

## Mapping Coverage
- **Total Database Columns:** 278
- **Successfully Mapped:** 232 (83% coverage)
- **Missing Mappings:** 46 (system-generated fields)
- **Required Missing:** 0 (all required fields covered)

## Upload Process
1. Excel file is uploaded and parsed
2. Headers are normalized for matching
3. Each row is processed:
   - Data is mapped to database columns
   - Values are sanitized and validated
   - Records are inserted into api_bil_claim_submit table
   - Upload tracking links are created

## Error Handling
- Invalid data types are converted or set to null
- Missing required fields cause row rejection
- Processing continues for valid rows even if some fail
- Detailed error messages are provided for troubleshooting
