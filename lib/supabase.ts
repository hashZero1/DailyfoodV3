import "server-only";
import { createClient } from "@supabase/supabase-js";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Add it to .env.local.`);
  }
  return value;
}

// Service-role key bypasses Row Level Security entirely — that's
// intentional here since Auth0 (not Supabase Auth) owns identity, and
// every table has RLS enabled with no policies (see supabase/schema.sql),
// which blocks the anon/public key from touching the data at all.
// This client must only ever be imported from server-side code
// (Route Handlers, Server Actions, Server Components) — "server-only"
// makes that a build error if broken.
export const supabase = createClient(
  getEnv("SUPABASE_URL"),
  getEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } }
);
