import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env, requireServerEnv } from "./env";

/**
 * Browser client — for use in Client Components. Holds the agent's
 * session in cookies. Uses the publishable (anon) key, RLS-bound.
 */
export function browserClient(): SupabaseClient {
  const e = env();
  return createBrowserClient(
    e.NEXT_PUBLIC_SUPABASE_URL,
    e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

/**
 * Server client (user-bound) — for use in Server Components, Route
 * Handlers, and Server Actions where you want operations scoped to the
 * logged-in agent's session. Reads/writes the auth cookie. RLS applies.
 */
export async function serverClient(): Promise<SupabaseClient> {
  const e = env();
  const store = await cookies();
  return createServerClient(
    e.NEXT_PUBLIC_SUPABASE_URL,
    e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (toSet) => {
          for (const { name, value, options } of toSet) {
            store.set(name, value, options);
          }
        },
      },
    },
  );
}

/**
 * Service-role client — bypasses RLS. Use ONLY in server-side code
 * (Route Handlers, Server Actions, cron / Edge Functions). Never expose
 * the underlying client or its key to the browser.
 *
 * Used for:
 *   - Storing/reading encrypted Google refresh tokens
 *   - Writing busy_blocks during cron polling
 *   - Serving the public .ics feed (no auth context, but must read busy_blocks)
 *   - Creating offers / sending SMS
 */
export function serviceClient(): SupabaseClient {
  const e = env();
  const serviceKey = requireServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(e.NEXT_PUBLIC_SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
