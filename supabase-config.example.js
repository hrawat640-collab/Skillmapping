/**
 * Copy this file to supabase-config.js and set your values.
 * Dashboard: Project Settings → API → Project URL + anon (or publishable) key.
 *
 * Security: The anon/publishable key is meant for browsers. It will always be visible to
 * users (Network tab, bundled JS). Protect data with Row Level Security (RLS) on every
 * table; never put the service_role key in any file served to the browser.
 */
window.__SKILLMAPPER_SUPABASE__ = {
  url: 'https://YOUR_PROJECT_REF.supabase.co',
  anonKey: 'YOUR_ANON_OR_PUBLISHABLE_KEY'
};
