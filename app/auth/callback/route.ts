import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Use NEXT_PUBLIC_SITE_URL if set, otherwise fall back to request origin
      // This ensures ngrok/tunnel URLs work in dev by setting NEXT_PUBLIC_SITE_URL to the tunnel URL
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || origin
      return NextResponse.redirect(`${baseUrl}${next}`)
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || origin
  return NextResponse.redirect(`${baseUrl}/login?error=auth`)
}
