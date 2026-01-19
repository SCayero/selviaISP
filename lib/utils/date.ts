/**
 * Date and time utility functions for Selvia ISP Calculator
 * All functions work with ISO date strings (YYYY-MM-DD)
 */

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 */
export function getTodayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Add days to an ISO date string
 */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate + "T00:00:00");
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Get weekday number (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 */
export function getWeekday(isoDate: string): number {
  const date = new Date(isoDate + "T00:00:00");
  return date.getDay();
}

/**
 * Get weekday name in Spanish
 */
export function getWeekdayName(weekday: number): string {
  const names = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  return names[weekday] || "";
}

/**
 * Calculate difference in days between two dates
 * Returns positive number if date2 > date1
 */
export function diffDays(isoDate1: string, isoDate2: string): number {
  const date1 = new Date(isoDate1 + "T00:00:00");
  const date2 = new Date(isoDate2 + "T00:00:00");
  const diffTime = date2.getTime() - date1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format ISO date to Spanish locale string (DD/MM/YYYY)
 */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Format ISO date to readable Spanish string (e.g., "15 de enero de 2025")
 */
export function formatDateLong(isoDate: string): string {
  const date = new Date(isoDate + "T00:00:00");
  const months = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} de ${month} de ${year}`;
}

/**
 * Get Monday of the week for a given date
 */
export function getWeekStart(isoDate: string): string {
  const weekday = getWeekday(isoDate);
  // Monday is 1, Sunday is 0
  // If Sunday (0), go back 6 days; otherwise go back (weekday - 1) days
  const daysToMonday = weekday === 0 ? 6 : weekday - 1;
  return addDays(isoDate, -daysToMonday);
}

/**
 * Check if a date is valid ISO format (YYYY-MM-DD)
 */
export function isValidISODate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  const date = new Date(dateString + "T00:00:00");
  return date.toISOString().slice(0, 10) === dateString;
}

/**
 * Get ISO datetime string for current time
 */
export function getNowISO(): string {
  return new Date().toISOString();
}
