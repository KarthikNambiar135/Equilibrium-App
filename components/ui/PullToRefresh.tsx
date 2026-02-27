'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'

const THRESHOLD = 80   // px of effective pull needed to trigger reload
const MAX_PULL  = 112  // max translateY applied to content

type Phase = 'idle' | 'pulling' | 'releasing' | 'refreshing'

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [pullY, setPullY]   = useState(0)
  const [phase, setPhase]   = useState<Phase>('idle')

  // Refs so event handlers never have stale closures
  const pullRef  = useRef(0)
  const phaseRef = useRef<Phase>('idle')
  const startY   = useRef(0)

  function sync(p: Phase, y: number) {
    phaseRef.current = p
    pullRef.current  = y
    setPhase(p)
    setPullY(y)
  }

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (phaseRef.current !== 'idle') return
      if (window.scrollY > 0) return            // only from the very top
      startY.current = e.touches[0].clientY
    }

    const onTouchMove = (e: TouchEvent) => {
      if (phaseRef.current === 'releasing' || phaseRef.current === 'refreshing') return
      if (window.scrollY > 0) return            // guard: user may have scrolled between events

      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) return                       // swiping up — ignore

      e.preventDefault()                        // block native scroll / Chrome PTR

      // Rubber-band: resistance increases as you pull further
      const effective = Math.min(Math.pow(dy, 0.72), MAX_PULL)
      sync('pulling', effective)
    }

    const onTouchEnd = () => {
      if (phaseRef.current !== 'pulling') return

      if (pullRef.current >= THRESHOLD) {
        // Past threshold — commit to refresh
        sync('refreshing', Math.min(pullRef.current, THRESHOLD + 8))
        setTimeout(() => window.location.reload(), 420)
      } else {
        // Not enough — snap back
        sync('releasing', 0)
        setTimeout(() => sync('idle', 0), 320)
      }
    }

    window.addEventListener('touchstart',  onTouchStart, { passive: true  })
    window.addEventListener('touchmove',   onTouchMove,  { passive: false })
    window.addEventListener('touchend',    onTouchEnd,   { passive: true  })
    window.addEventListener('touchcancel', onTouchEnd,   { passive: true  })

    return () => {
      window.removeEventListener('touchstart',  onTouchStart)
      window.removeEventListener('touchmove',   onTouchMove)
      window.removeEventListener('touchend',    onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [])

  const isRefreshing   = phase === 'refreshing'
  const isReleasing    = phase === 'releasing'
  const progress       = Math.min(pullY / THRESHOLD, 1)
  const pastThreshold  = pullY >= THRESHOLD
  const showIndicator  = phase !== 'idle' && pullY > 6

  return (
    <>
      {/* ── Indicator pill — fixed so it's not affected by translateY ── */}
      {showIndicator && (
        <div
          className="fixed left-1/2 z-[999] flex items-center gap-1.5 rounded-full px-3 py-1.5 shadow-lg border border-border/40 bg-card pointer-events-none select-none"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 14px)',
            opacity: Math.min(progress * 1.4, 1),
            transform: `translateX(-50%) translateY(${(1 - Math.min(progress * 1.6, 1)) * -20}px)`,
            transition: isReleasing ? 'opacity 0.25s, transform 0.25s' : 'none',
          }}
        >
          {isRefreshing ? (
            <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
          ) : (
            <RefreshCw
              className="h-3.5 w-3.5 text-muted-foreground"
              style={{
                transform: `rotate(${progress * 360}deg)`,
                transition: isReleasing ? 'transform 0.3s' : 'none',
                color: pastThreshold ? 'var(--primary)' : undefined,
              }}
            />
          )}
          <span
            className="text-[11px] font-medium leading-none"
            style={{ color: pastThreshold || isRefreshing ? 'var(--primary)' : 'var(--muted-foreground)' }}
          >
            {isRefreshing ? 'Refreshing…' : pastThreshold ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        </div>
      )}

      {/* ── Page content slides down while pulling ── */}
      <div
        style={{
          transform: `translateY(${pullY}px)`,
          transition: isReleasing || isRefreshing
            ? 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            : 'none',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </>
  )
}
