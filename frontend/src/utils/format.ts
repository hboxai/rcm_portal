// Shared formatting helpers (dates, etc.).

export function formatDateString(value: any): string {
  if (!value) return 'N/A';
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  } catch {
    return 'Invalid date';
  }
}
