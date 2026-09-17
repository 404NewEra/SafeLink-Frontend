import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://dasdtwxxxagxewtdulvy.supabase.co",
  "sb_publishable_EWL5pHsSUUI1WDSVNa4Taw_PBu8GP7r",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
