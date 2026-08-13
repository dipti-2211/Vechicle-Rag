/**
 * Supabase client — public (anon) key only.
 * Used by the frontend for Supabase Auth.
 * The service role key is NEVER placed here — it stays backend-only.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnon) {
  console.warn(
    '[Auron] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set.\n' +
    'Auth features will not work. Add them to your .env file.'
  )
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnon ?? '')
