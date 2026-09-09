import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://pgcyybkwtsykmgsxvnnn.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_n2mpISCFp663W5i2Aj7UBg_h7bXzRrp";

// Storage bridge: ensures code_verifier is accessible both in localStorage (for client-side)
// and via standard cookie (for server-side callback exchange in Next.js)
const browserStorageBridge = {
  getItem: (key: string) => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, value);
    } catch {}
    // If a PKCE verifier is written, also store it in a temporary lax cookie for server exchange
    if (key.includes("verifier")) {
      try {
        const cleanVal = value.split("/")[0];
        document.cookie = `sb_pkce_verifier=${encodeURIComponent(cleanVal)}; path=/; max-age=600; SameSite=Lax`;
      } catch {}
    }
  },
  removeItem: (key: string) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(key);
    } catch {}
    if (key.includes("verifier")) {
      try {
        document.cookie = "sb_pkce_verifier=; path=/; max-age=0; SameSite=Lax";
      } catch {}
    }
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: browserStorageBridge,
  },
});

