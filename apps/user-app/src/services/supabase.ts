import { createClient } from '@supabase/supabase-js'

declare const process: {
  env: {
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string
    EXPO_PUBLIC_SUPABASE_URL?: string
  }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export const supabase =
  supabaseUrl && supabasePublishableKey ? createClient(supabaseUrl, supabasePublishableKey) : null

export const isSupabaseConfigured = supabase !== null

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.')
  }

  return supabase
}
