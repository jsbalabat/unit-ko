// Deterministic date formatting for the add-property wizard.
//
// Hand-rolled month names rather than toLocaleDateString: this dialog is
// server-rendered for the initial HTML, and locale data can differ between
// server and client, which shows up as a hydration mismatch.
//
// Deliberately distinct from lib/format's formatDate, which prints the long
// month ("January 5, 2026") — collapsing the two would change what the wizard
// displays, so it's a display decision, not a cleanup.

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "Jan 5, 2026"; empty string for an empty input. */
export function formatShortDate(dateString: string): string {
  if (!dateString) return "";

  const date = new Date(dateString);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** "Jan 2026"; empty string for an empty input. */
export function formatMonthYear(dateString: string): string {
  if (!dateString) return "";

  const date = new Date(dateString);
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}
