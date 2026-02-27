'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface SplashScreenProps {
  children: React.ReactNode
}

export default function SplashScreen({ children }: SplashScreenProps) {
  const router = useRouter()
  const [phase, setPhase] = useState<'video' | 'frame'>('video')
  const [showButtons, setShowButtons] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (phase === 'video') setPhase('frame')
    }, 15000)
    return () => clearTimeout(timeout)
  }, [phase])

  useEffect(() => {
    if (phase === 'frame') {
      const t = setTimeout(() => setShowButtons(true), 600)
      return () => clearTimeout(t)
    }
  }, [phase])

  const handleVideoEnd = () => setPhase('frame')
  const handleVideoError = () => setPhase('frame')

  const handleChildClick = (e: React.MouseEvent) => {
    const link = (e.target as HTMLElement).closest('a')
    const href = link?.getAttribute('href')
    if (!href) return
    e.preventDefault()
    e.stopPropagation()
    // Set flag so destination page plays the shrink animation
    try { sessionStorage.setItem('eq-splash-transition', '1') } catch {}
    router.push(href)
  }

  return (
    <div className="fixed inset-0 bg-black">
      {/* Video */}
      {phase === 'video' && (
        <video
          ref={videoRef}
          src="/Equilibrium.mp4"
          poster="/frame.png"
          autoPlay
          muted
          playsInline
          onEnded={handleVideoEnd}
          onError={handleVideoError}
          className="absolute inset-0 w-full h-full object-contain bg-black"
        />
      )}

      {/* Frame */}
      {phase !== 'video' && (
        <img
          src="/frame.png"
          alt="Equilibrium"
          className="absolute inset-0 w-full h-full object-contain"
        />
      )}

      {/* Buttons */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        onClick={handleChildClick}
        className={`absolute inset-x-0 bottom-0 px-6 pb-12 pt-6 flex justify-center transition-opacity duration-700 ${
          showButtons ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  )
}
