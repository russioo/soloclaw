const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Try updating with transactions field - if column doesn't exist, Supabase will tell us
  const { error } = await sb
    .from("agent_stats")
    .update({ transactions: [] })
    .eq("id", "default");

  if (error) {
    console.log("Column might not exist yet:", error.message);
    console.log("Please run this SQL in Supabase dashboard:");
    console.log("  alter table agent_stats add column if not exists transactions jsonb default '[]';");
  } else {
    console.log("OK - transactions column exists and is set to []");
  }
}

main();
