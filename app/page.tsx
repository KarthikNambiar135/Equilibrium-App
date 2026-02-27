import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SplashScreen from '@/components/SplashScreen'

export const dynamic = 'force-dynamic'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <SplashScreen>
      <div className="flex flex-col gap-3">
        <Link
          href="/signup"
          className="h-12 rounded-xl bg-primary text-primary-foreground font-medium flex items-center justify-center text-sm"
        >
          Get Started — It&apos;s Free
        </Link>
        <Link
          href="/login"
          className="h-12 rounded-xl bg-muted/80 backdrop-blur-sm text-white font-medium flex items-center justify-center text-sm"
        >
          I already have an account
        </Link>
      </div>
    </SplashScreen>
  )
}
