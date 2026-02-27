'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Scale } from 'lucide-react'

function NativeAuthCallback() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState('Signing you in...')

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get('code')
      if (!code) {
        setStatus('No auth code found. Redirecting...')
        setTimeout(() => router.replace('/login'), 2000)
        return
      }

      try {
        const supabase = createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        
        if (error) {
          console.warn('Exchange returned error (may still have session):', error.message)
        }

        // Always check if we actually have a session — the exchange
        // might report an error but Supabase can still set the session
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setStatus('Welcome back!')
          router.replace('/dashboard')
          return
        }

        // No session at all — genuine failure
        setStatus('Login failed. Redirecting...')
        setTimeout(() => router.replace('/login?error=auth'), 2000)
      } catch (err) {
        console.error('Auth callback error:', err)
        // Even on exception, check for session
        try {
          const supabase = createClient()
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            router.replace('/dashboard')
            return
          }
        } catch {}
        setStatus('Something went wrong. Redirecting...')
        setTimeout(() => router.replace('/login?error=auth'), 2000)
      }
    }

    handleCallback()
  }, [searchParams, router])

  return (
    <div className="text-center">
      <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-sm text-muted-foreground">{status}</p>
    </div>
  )
}

export default function NativeAuthCallbackPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-6">
      <div className="text-center">
        <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
          <Scale className="h-6 w-6 text-primary-foreground" />
        </div>
        <Suspense fallback={
          <div>
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        }>
          <NativeAuthCallback />
        </Suspense>
      </div>
    </div>
  )
}
