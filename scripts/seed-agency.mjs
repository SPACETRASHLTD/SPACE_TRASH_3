#!/usr/bin/env node
// Seeds the single agency row for this single-tenant deploy.
// Prints the new agency's UUID so you can paste it into AGENCY_ID.
//
// Usage:
//   node --env-file=.env.local scripts/seed-agency.mjs "<Agency Name>" [<timezone>]
//
// Example:
//   node --env-file=.env.local scripts/seed-agency.mjs "Lecky & Co." "America/New_York"

import { createClient } from "@supabase/supabase-js";

const [, , nameArg, tzArg] = process.argv;

if (!nameArg) {
  console.error("Usage: node --env-file=.env.local scripts/seed-agency.mjs \"<Agency Name>\" [<timezone>]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.");
  process.exit(1);
}

const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const timezone = tzArg || "America/New_York";

const { data, error } = await sb
  .from("agencies")
  .insert({ name: nameArg, timezone })
  .select("id, name, timezone")
  .single();

if (error) {
  console.error("Insert failed:", error.message);
  process.exit(1);
}

console.log();
console.log("✔ Agency created.");
console.log("  id:        ", data.id);
console.log("  name:      ", data.name);
console.log("  timezone:  ", data.timezone);
console.log();
console.log("Paste this into your .env.local:");
console.log();
console.log(`  AGENCY_ID=${data.id}`);
console.log();
