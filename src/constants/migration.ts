/**
 * Migration Constants
 * 
 * This file defines constants related to the Firebase to Supabase migration
 */

/**
 * MIGRATION_START_DATE: Date when we started using Supabase exclusively
 * All orders created BEFORE this date in Firebase should be ignored
 * Only orders created FROM this date onwards should be handled in Supabase
 */
export const MIGRATION_START_DATE = new Date('2025-01-20T00:00:00.000Z');

/**
 * Check if a date is after migration start date
 */
export function isAfterMigrationDate(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const checkDate = typeof date === 'string' ? new Date(date) : date;
  return checkDate >= MIGRATION_START_DATE;
}

/**
 * Check if an order should be handled in Supabase
 * (i.e., created after migration start date)
 */
export function shouldHandleInSupabase(createdAt: Date | string | null | undefined): boolean {
  return isAfterMigrationDate(createdAt);
}

