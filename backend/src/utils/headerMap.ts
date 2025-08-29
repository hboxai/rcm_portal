export function norm(s: string): string {
  return (s || '')
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "")
    .toLowerCase();
}

export const alias: Record<string, string> = {
  // Exact header → canonical key (normalized)
  // PatientID in XLS should populate insurerid in submit table
  patientid: "insurerid",
  patientlast: "patientlast",
  patientfirst: "patientfirst",
  patientdob: "patientdob",
  patientmale: "patientmale",
  patientfemale: "patientfemale",

  insuranceplanname: "insuranceplanname",
  insurancepayerid: "insurancepayerid",
  insurancestreetaddr: "insurancestreetaddr",
  insurancecity: "insurancecity",
  insurancestate: "insurancestate",
  insurancezip: "insurancezip",
  insurancecitystatezip: "insurancecitystatezip",
  insurancephone: "insurancephone",

  icdindicator: "icd_indicator",

  // Facility / provider
  facilityname: "facilityname",
  facilitystreetaddr: "facilitystreetaddr",
  facilitycity: "facilitycity",
  facilitystate: "facilitystate",
  facilityzip: "facilityzip",
  facilitycitystatezip: "facilitycitystatezip",
  facilitynpi: "facilitynpi",
  facilityid: "facilityid",
  physicianlast: "physicianlast",
  physicianfirst: "physicianfirst",
  physicianmidinit: "physicianmidinit",

  // Totals
  totalcharges: "totalcharges",
  amountpaid: "amountpaid",
  balancedue: "balancedue",

  // Many flags in sheet map straight to similarly-named columns
  planmedicare: "planmedicare",
  planmedicaid: "planmedicaid",
  planchampus: "planchampus",
  planchampva: "planchampva",
  plangrouphealthplan: "plangrouphealthplan",
  planfeca: "planfeca",
  planother: "planother",

  // COB / signatures / claim meta
  claim_frequency_code: "claim_frequency_code",
  original_claim_reference_number: "original_claim_reference_number",
  patient_signature_on_file: "patientsignature",
  provider_signature_on_file: "providersignature",
  clia_number: "clia_number",
};

// Programmatic mapping for service lines 1..6
const SL: Array<[string, string]> = [
  ["FromDateOfService", "fromdateofservice"],
  ["ToDateOfService", "todateofservice"],
  ["PlaceOfService", "placeofservice"],
  ["EMG", "emg"],
  ["CPT", "cpt"],
  ["ModifierA", "modifiera"],
  ["ModifierB", "modifierb"],
  ["ModifierC", "modifierc"],
  ["ModifierD", "modifierd"],
  ["DiagCodePointer", "diagcodepointer"],
  ["Charges", "charges"],
  ["Units", "units"],
  ["EPSDT", "epsdt"],
  ["RenderingPhysQualifier", "renderingphysqualifier"],
  ["RenderingPhysID", "renderingphysid"],
  ["RenderingPhysNPI", "renderingphysnpi"],
];

for (let i = 1; i <= 6; i++) {
  for (const [hdr, col] of SL) {
    alias[norm(`${hdr}${i}`)] = `${col}${i}`;
  }
}

// Additional aliases (typo and variant guards)
alias[norm("OtherInsuredEmlpoyerNameOrSchoolName")] = "otherinsuredemlpoyernam_orschoolname"; // header typo → db typo
alias[norm("OtherInsuredEmployerNameOrSchoolName")] = "otherinsuredemlpoyernam_orschoolname";  // correct spelling → db typo
alias[norm("InsuredEmployerNameOrSchoolName")] = "insuredemployernam_orschoolname";

// Optional generic catch for common misspelling fragments
alias[norm("Emlpoyer")] = "employer";
