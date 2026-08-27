import { createClient } from "@supabase/supabase-js";

// service_role key bypasses Row Level Security — server-side use only,
// never import this file from client components.
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}
