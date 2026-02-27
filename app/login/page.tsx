'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const passwordReset = searchParams.get('reset') === 'success'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Splash transition states
  const [fromSplash, setFromSplash] = useState(false)
  const [shrinkDone, setShrinkDone] = useState(false)
  const [reveal, setReveal] = useState(false)
  const [targetPos, setTargetPos] = useState({ top: 76, left: 24, width: 40, height: 40 })
  const logoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let splash = false
    try { splash = sessionStorage.getItem('eq-splash-transition') === '1'; sessionStorage.removeItem('eq-splash-transition') } catch {}
    if (splash) {
      setFromSplash(true)
      // After mount, start shrink. After shrink ends, reveal content.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Measure where the static logo actually is (works even if invisible)
          if (logoRef.current) {
            const rect = logoRef.current.getBoundingClientRect()
            setTargetPos({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
          }
          setShrinkDone(true)
          setTimeout(() => setReveal(true), 800)
        })
      })
    } else {
      setReveal(true)
    }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  async function handleGoogleLogin() {
    // In Capacitor, use custom scheme so Chrome redirects back to the app
    const isCapacitor = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.()
    const redirectTo = isCapacitor
      ? 'equilibrium://auth/callback'
      : `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback`
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: false,
      },
    })
  }

  return (
    <div className="min-h-dvh flex flex-col justify-between px-6 py-12 max-w-md mx-auto w-full">
      {/* Frame.png overlay — starts fullscreen, shrinks to logo position */}
      {fromSplash && (
        <div
          style={{
            position: 'fixed',
            zIndex: 50,
            top: shrinkDone ? `${targetPos.top}px` : '0',
            left: shrinkDone ? `${targetPos.left}px` : '0',
            width: shrinkDone ? `${targetPos.width}px` : '100vw',
            height: shrinkDone ? `${targetPos.height}px` : '100dvh',
            borderRadius: shrinkDone ? '12px' : '0',
            overflow: 'hidden',
            transition: 'all 0.75s cubic-bezier(0.4, 0, 0.2, 1)',
            pointerEvents: 'none',
          }}
        >
          <img
            src="/frame.png"
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: shrinkDone ? 'cover' : 'contain',
              background: shrinkDone ? 'transparent' : '#000',
            }}
          />
        </div>
      )}
      {/* Background overlay that fades from black */}
      {fromSplash && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 49,
            backgroundColor: '#000',
            opacity: shrinkDone ? 0 : 1,
            transition: 'opacity 0.75s cubic-bezier(0.4, 0, 0.2, 1)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Header */}
      <div className="pt-8">
        <div className="flex items-center gap-2 mb-2">
          {/* Hidden sizing ref for shrink target — only needed when fromSplash */}
          <div ref={logoRef} className={`h-10 w-10 rounded-xl shrink-0 ${fromSplash ? 'invisible' : 'overflow-hidden'}`}>
            {!fromSplash && <img src="/frame.png" alt="Equilibrium" className="h-full w-full object-cover" style={{ imageRendering: 'auto' }} />}
          </div>
          <span className={`text-xl font-bold transition-opacity duration-500 ${reveal ? 'opacity-100' : 'opacity-0'}`}>Equilibrium</span>
        </div>
        <div className={`transition-opacity duration-500 ${reveal ? 'opacity-100' : 'opacity-0'}`}>
          <h1 className="text-2xl font-bold mt-8 mb-1">Welcome back</h1>
          <p className="text-muted-foreground text-sm">
            Sign in to manage your group expenses
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleLogin} className={`flex flex-col gap-4 mt-8 transition-opacity duration-500 ${reveal ? 'opacity-100' : 'opacity-0'}`}>
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-xl">
            {error}
          </div>
        )}

        {passwordReset && (
          <div className="bg-primary/10 text-primary text-sm p-3 rounded-xl">
            Password reset successfully! Sign in with your new password.
          </div>
        )}

        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail className="h-4 w-4" />}
          required
        />

        <div className="relative">
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="h-4 w-4" />}
            required
          />
          <button
            type="button"
            className="absolute right-3 top-9 text-muted-foreground"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>

        <div className="flex justify-end -mt-1">
          <Link href="/forgot-password" className="text-xs text-primary font-medium">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" fullWidth isLoading={isLoading} size="lg">
          Sign In
        </Button>

        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <Button
          type="button"
          variant="secondary"
          fullWidth
          size="lg"
          onClick={handleGoogleLogin}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </Button>
      </form>

      {/* Footer */}
      <p className={`text-center text-sm text-muted-foreground mt-8 transition-opacity duration-500 ${reveal ? 'opacity-100' : 'opacity-0'}`}>
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-primary font-medium">
          Sign up
        </Link>
      </p>
    </div>
  )
}
