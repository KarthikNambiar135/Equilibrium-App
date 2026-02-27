'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Mail, Lock, Eye, EyeOff, ArrowLeft, ShieldCheck } from 'lucide-react'

type Step = 'email' | 'otp' | 'reset'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', '', '', ''])
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [cooldown, setCooldown] = useState(0)

  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  // Cooldown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  // Auto-focus first OTP input when entering OTP step
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    }
  }, [step])

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email)

    if (error) {
      setError(error.message)
      setIsLoading(false)
      return
    }

    setCooldown(60)
    setStep('otp')
    setIsLoading(false)
  }

  async function handleResendCode() {
    if (cooldown > 0) return
    setError('')
    setSuccess('')

    const { error } = await supabase.auth.resetPasswordForEmail(email)

    if (error) {
      setError(error.message)
      return
    }

    setCooldown(60)
    setSuccess('Code resent! Check your email.')
    setTimeout(() => setSuccess(''), 3000)
  }

  function handleOtpChange(index: number, value: string) {
    if (value.length > 1) {
      // Handle paste of full code
      const digits = value.replace(/\D/g, '').slice(0, 8).split('')
      const newOtp = [...otp]
      digits.forEach((d, i) => {
        if (index + i < 8) newOtp[index + i] = d
      })
      setOtp(newOtp)
      const nextIndex = Math.min(index + digits.length, 7)
      otpRefs.current[nextIndex]?.focus()
      return
    }

    if (value && !/^\d$/.test(value)) return

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    if (value && index < 7) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    const token = otp.join('')
    if (token.length !== 8) {
      setError('Please enter the 8-digit code')
      return
    }

    setIsLoading(true)
    setError('')

    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'recovery',
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
      return
    }

    setStep('reset')
    setIsLoading(false)
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)
    setError('')

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setIsLoading(false)
      return
    }

    await supabase.auth.signOut()
    router.push('/login?reset=success')
  }

  return (
    <div className="min-h-dvh flex flex-col justify-between px-6 py-12 max-w-md mx-auto w-full">
      {/* Header */}
      <div className="pt-8">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground mb-6 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>

        {step === 'email' && (
          <>
            <h1 className="text-2xl font-bold mb-1">Forgot password?</h1>
            <p className="text-muted-foreground text-sm">
              Enter your email and we&apos;ll send you an 8-digit code to reset your password.
            </p>
          </>
        )}

        {step === 'otp' && (
          <>
            <h1 className="text-2xl font-bold mb-1">Check your email</h1>
            <p className="text-muted-foreground text-sm">
              We sent an 8-digit code to <span className="text-foreground font-medium">{email}</span>
            </p>
          </>
        )}

        {step === 'reset' && (
          <>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Set new password</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Create a strong password for your account.
            </p>
          </>
        )}
      </div>

      {/* Forms */}
      <div className="flex-1 flex flex-col justify-center -mt-12">
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-primary/10 text-primary text-sm p-3 rounded-xl mb-4">
            {success}
          </div>
        )}

        {/* Step 1: Email */}
        {step === 'email' && (
          <form onSubmit={handleSendCode} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="h-4 w-4" />}
              required
            />

            <Button type="submit" fullWidth isLoading={isLoading} size="lg">
              Send Code
            </Button>
          </form>
        )}

        {/* Step 2: OTP */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">Verification Code</label>
              <div className="flex gap-2 justify-between">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-10 h-12 rounded-lg border border-border bg-background text-center text-lg font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    required
                  />
                ))}
              </div>
            </div>

            <Button type="submit" fullWidth isLoading={isLoading} size="lg">
              Verify Code
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Didn&apos;t receive the code?{' '}
              <button
                type="button"
                onClick={handleResendCode}
                disabled={cooldown > 0}
                className={`font-medium ${cooldown > 0 ? 'text-muted-foreground' : 'text-primary'}`}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}
              </button>
            </p>
          </form>
        )}

        {/* Step 3: New Password */}
        {step === 'reset' && (
          <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
            <div className="relative">
              <Input
                label="New Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 6 characters"
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
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="relative">
              <Input
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leftIcon={<Lock className="h-4 w-4" />}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-9 text-muted-foreground"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <Button type="submit" fullWidth isLoading={isLoading} size="lg">
              Reset Password
            </Button>
          </form>
        )}
      </div>

      {/* Footer spacing */}
      <div />
    </div>
  )
}
