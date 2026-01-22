/**
 * Application Configuration
 * This file contains app-wide configuration constants
 */

// Determine the app URL based on environment
export const APP_URL = import.meta.env.VITE_APP_URL ||
  (import.meta.env.DEV
    ? 'http://localhost:5173'
    : 'https://diytvuczpciikzdhldny.supabase.co');

// Email redirect URLs for Supabase Auth
export const EMAIL_REDIRECT_URLS = {
  SETUP_PASSWORD: `${APP_URL}/#/setup-password`,
  RESET_PASSWORD: `${APP_URL}/#/reset-password`,
  CANDIDATE_WELCOME: `${APP_URL}/#/candidate/welcome`,
} as const;
