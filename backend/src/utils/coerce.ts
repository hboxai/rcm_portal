export type CType = 'text'|'int'|'float'|'date'|'bool';

export function coerce(v: any, t: CType) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;

  switch (t) {
    case 'text':
      return s;
    case 'int': {
      const n = Number(s.replace(/[ ,]/g, ''));
      return Number.isFinite(n) ? Math.trunc(n) : null;
    }
    case 'float': {
      const n = Number(s.replace(/[ ,]/g, ''));
      return Number.isFinite(n) ? n : null;
    }
    case 'date': {
      // Preserve sheet display: if it's a formatted string, return as-is.
      // Avoid JS Date/UTC conversion to prevent off-by-one shifts.
      if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(s) ||
          /^\d{4}-\d{2}-\d{2}$/.test(s) ||
          /^(\d{1,2})\s*[A-Za-z]{3,}\s*\d{2,4}$/.test(s)) {
        return s;
      }
      // Fallback: Excel serial date number passed as text
      if (/^\d+$/.test(s)) {
        const serial = Number(s);
        // Excel epoch (1900-based, with 1900 leap-year bug). Use 1899-12-30 as base.
        const base = Date.UTC(1899, 11, 30);
        const ms = base + serial * 86400000;
        const d = new Date(ms);
        // Format as YYYY-MM-DD without timezone influence
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
      // Unknown format: return original string; DB may parse if valid
      return s;
    }
    case 'bool': {
      if (/^(y|yes|true|1|male)$/i.test(s)) return true;
      if (/^(n|no|false|0|female)$/i.test(s)) return false;
      return null;
    }
  }
}

// Destination column → coercion type (extend as needed)
export const colType: Record<string, CType> = {
  // ids & text
  patient_id: 'text',
  patientlast: 'text',
  patientfirst: 'text',
  insuranceplanname: 'text',
  insurancepayerid: 'text',
  facilityname: 'text',
  facilitynpi: 'text',

  // dates
  patientdob: 'date',
  insuredob: 'date',
  dateofcurrent: 'date',
  dateofsimilarillness: 'date',
  hospitalizationfromdate: 'date',
  hospitalizationtodate: 'date',
  dateofservice1: 'date',
  todateofservice1: 'date',
  dateofservice2: 'date',
  todateofservice2: 'date',
  dateofservice3: 'date',
  todateofservice3: 'date',
  dateofservice4: 'date',
  todateofservice4: 'date',
  dateofservice5: 'date',
  todateofservice5: 'date',
  dateofservice6: 'date',
  todateofservice6: 'date',

  // flags
  patientmale: 'bool',
  patientfemale: 'bool',
  planmedicare: 'text',
  planmedicaid: 'text',
  emg1: 'bool',
  emg2: 'bool',
  emg3: 'bool',
  emg4: 'bool',
  emg5: 'bool',
  emg6: 'bool',

  // money / numeric
  charges1: 'float',
  units1: 'float',
  charges2: 'float',
  units2: 'float',
  charges3: 'float',
  units3: 'float',
  charges4: 'float',
  units4: 'float',
  charges5: 'float',
  units5: 'float',
  charges6: 'float',
  units6: 'float',
  totalcharges: 'float',
  amountpaid: 'float',
  balancedue: 'float',
};

// Ensure all Plan* indicators are text per schema
for (const k of [
  'planmedicare','planmedicaid','planchampus','planchampva',
  'plangrouphealthplan','planfeca','planother'
]) {
  colType[k] = 'text';
}
