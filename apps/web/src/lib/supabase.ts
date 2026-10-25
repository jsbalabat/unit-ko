import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const getSupabaseConfigError = (): string | null => {
  const missingVars: string[] = []

  if (!supabaseUrl) {
    missingVars.push('NEXT_PUBLIC_SUPABASE_URL')
  }

  if (!supabaseAnonKey) {
    missingVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  if (missingVars.length === 0) {
    return null
  }

  return `Supabase configuration is missing: ${missingVars.join(', ')}. Set these values in .env.local.`
}

// Create a browser client with proper auth persistence
export const supabase = createBrowserClient(
  supabaseUrl ?? 'https://invalid-project-ref.supabase.co',
  supabaseAnonKey ?? 'invalid-anon-key'
)