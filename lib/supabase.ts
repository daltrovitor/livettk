import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rluanvvsmfrbxghjwzkn.supabase.co";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdWFudnZzbWZyYnhnaGp3emtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMTUyNjUsImV4cCI6MjEwMDg5MTI2NX0.JyL63SB5NOca1ykRTnxMovBqhcqbW9OxVVou8ke4fZI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
