/**
 * Date and time utility functions for Selvia ISP Calculator
 * All functions work with ISO date strings (YYYY-MM-DD)
 * All date arithmetic uses LOCAL calendar days, not UTC
 */

/**
 * Parse ISO date string to local date components
 */
function parseISO(isoDate: string): { year: number; month: number; day: number } {
  const [year, month, day] = isoDate.split("-").map(Number);
  return { year, month: month - 1, day }; // month is 0-indexed for Date constructor
}

/**
 * Format Date to ISO string using local timezone
 */
function toLocalISOString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 */
export function getTodayISO(): string {
  return toLocalISOString(new Date());
}

/**
 * Add days to an ISO date string
 */
export function addDays(isoDate: string, days: number): string {
  const { year, month, day } = parseISO(isoDate);
  const date = new Date(year, month, day + days);
  return toLocalISOString(date);
}

/**
 * Get weekday number (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 */
export function getWeekday(isoDate: string): number {
  const { year, month, day } = parseISO(isoDate);
  return new Date(year, month, day).getDay();
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
  const d1 = parseISO(isoDate1);
  const d2 = parseISO(isoDate2);
  const date1 = new Date(d1.year, d1.month, d1.day);
  const date2 = new Date(d2.year, d2.month, d2.day);
  const diffTime = date2.getTime() - date1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
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
  const { year, month, day } = parseISO(isoDate);
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
  return `${day} de ${months[month]} de ${year}`;
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
  const { year, month, day } = parseISO(dateString);
  const date = new Date(year, month, day);
  return date.getFullYear() === year && 
         date.getMonth() === month && 
         date.getDate() === day;
}

/**
 * Get ISO datetime string for current time
 */
export function getNowISO(): string {
  return new Date().toISOString();
}
