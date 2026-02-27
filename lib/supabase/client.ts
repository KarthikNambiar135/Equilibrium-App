import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseUrl = raw.startsWith('http') ? raw : 'https://placeholder.supabase.co'
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

  return createBrowserClient(supabaseUrl, supabaseKey)
}
