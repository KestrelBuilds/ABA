// Only public/anonymous keys are eligible here. Never use a service-role key for sessions.
export function resolveSupabaseSettings(settings: {
  publicUrl?: string;
  serverUrl?: string;
  publishableKey?: string;
  anonymousKey?: string;
}) {
  return {
    url: settings.publicUrl?.trim() || settings.serverUrl?.trim() || "",
    key: settings.publishableKey?.trim() || settings.anonymousKey?.trim() || "",
  };
}

export function supabaseSettings() {
  return resolveSupabaseSettings({
    publicUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serverUrl: process.env.SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    anonymousKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
