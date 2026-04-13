import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables:", {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabaseKey ? "***" : "undefined",
  });
}

export const createClient = () =>
  createBrowserClient(
    supabaseUrl || "https://lmbwhoqmgrouoywxvilh.supabase.co",
    supabaseKey || "sb_publishable_kNFrVXu_rAkvYdhoJN09zQ_GBpkJkEt"
  );