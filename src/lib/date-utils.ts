// Local (device) calendar date as "yyyy-mm-dd". Never use
// `date.toISOString().slice(0, 10)` for this — that gives the UTC calendar
// date, which is a day ahead of the user's actual local date for a chunk of
// every evening in any negative-UTC-offset timezone.
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const DATE_STRING_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(value: string): boolean {
  return DATE_STRING_PATTERN.test(value);
}
