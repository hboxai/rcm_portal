// Shared formatting helpers (dates, etc.).

// Format as DD-MM-YYYY with leading zeros to match table display
export function formatDateString(value: any): string {
  if (value === null || value === undefined || value === '') return 'N/A';

  // If already in d/m/Y or d-m-Y, normalize to DD-MM-YYYY
  if (typeof value === 'string') {
    const m = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (m) {
      const d = m[1].padStart(2, '0');
      const mo = m[2].padStart(2, '0');
      const y = m[3];
      return `${d}-${mo}-${y}`;
    }
  }

  // Try parsing as Date (handles ISO like 1950-06-28T18:30:00.000Z)
  try {
    const dt = value instanceof Date ? value : new Date(value);
    if (isNaN(dt.getTime())) return String(value);
    const d = String(dt.getDate()).padStart(2, '0');
    const mo = String(dt.getMonth() + 1).padStart(2, '0');
    const y = String(dt.getFullYear());
    return `${d}-${mo}-${y}`;
  } catch {
    return String(value);
  }
}
