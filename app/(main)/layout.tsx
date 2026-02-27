'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/ui/BottomNav'
import PullToRefresh from '@/components/ui/PullToRefresh'
import VideoLoader from '@/components/ui/VideoLoader'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [isReady, setIsReady] = useState(false)

  const isScanner = pathname === '/scanner'

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setIsReady(true)
    }
    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'SIGNED_OUT') {
          router.push('/login')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [router, supabase])

  if (!isReady) {
    return <VideoLoader />
  }

  return (
    <div className={`min-h-dvh ${isScanner ? '' : 'pb-24'}`}>
      {isScanner ? (
        children
      ) : (
        <PullToRefresh>{children}</PullToRefresh>
      )}
      <BottomNav />
    </div>
  )
}
