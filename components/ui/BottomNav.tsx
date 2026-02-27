'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Home, Users, Bell, Coins } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/* ── Notch SVG path ─────────────────────────────────────────
   viewBox = "0 0 430 88"
   Bar top sits at y = 32.  Notch peak at y = 0.
   Smooth cubic-bezier shoulders transition into the arc.    */
const NOTCH_PATH =
  'M 0 32 H 156 C 162 32 170 32 180 24 C 190 16 200 12 215 12 C 230 12 240 16 250 24 C 260 32 268 32 274 32 H 430 V 88 H 0 Z'
const NOTCH_STROKE =
  'M 0 32 H 156 C 162 32 170 32 180 24 C 190 16 200 12 215 12 C 230 12 240 16 250 24 C 260 32 268 32 274 32 H 430'

const LEFT_ITEMS = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/groups', icon: Users, label: 'Groups' },
]
const RIGHT_ITEMS = [
  { href: '/equipoints', icon: Coins, label: 'Points' },
  { href: '/notifications', icon: Bell, label: 'Alerts' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    async function fetchUnread() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
      setUnreadCount(count || 0)
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    return () => clearInterval(interval)
  }, [pathname])

  const renderItem = (item: (typeof LEFT_ITEMS)[0]) => {
    const isActive =
      pathname === item.href ||
      (item.href !== '/dashboard' && pathname.startsWith(item.href))
    const showBadge = item.href === '/notifications' && unreadCount > 0

    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 transition-colors ${
          isActive ? 'text-primary' : 'text-muted-foreground'
        }`}
      >
        <div className="relative">
          <item.icon
            className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : ''}`}
          />
          {showBadge && (
            <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-black text-[9px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-medium">{item.label}</span>
      </Link>
    )
  }

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50">
      <div className="relative" style={{ height: 88 }}>
        {/* ── SVG background with curved notch ── */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 430 88"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path d={NOTCH_PATH} fill="var(--card)" />
          <path
            d={NOTCH_STROKE}
            stroke="rgba(240,127,60,0.3)"
            fill="none"
            strokeWidth="0.8"
            filter="url(#glow)"
          />
        </svg>

        {/* ── Floating center FAB ── */}
        <Link
          href="/scanner"
          className="absolute left-1/2 -translate-x-1/2 top-[20px] z-10 flex items-center justify-center w-[54px] h-[54px] rounded-full bg-black shadow-[0_0_16px_rgba(240,127,60,0.35)] ring-1 ring-primary/20 active:scale-95 transition-transform overflow-hidden"
        >
          <Image src="/equi-logo.png" alt="Equilibrium" width={54} height={54} className="w-full h-full object-cover" />
        </Link>

        {/* ── Nav items (positioned inside the bar area below notch) ── */}
        <div className="absolute left-0 right-0 bottom-0 flex items-center h-[56px] px-4">
          <div className="flex-1 flex justify-evenly">
            {LEFT_ITEMS.map(renderItem)}
          </div>
          {/* spacer for center button */}
          <div className="w-16" />
          <div className="flex-1 flex justify-evenly">
            {RIGHT_ITEMS.map(renderItem)}
          </div>
        </div>
      </div>

      {/* ── Safe-area fill for notch devices ── */}
      <div
        className="bg-[var(--card)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      />
    </nav>
  )
}
