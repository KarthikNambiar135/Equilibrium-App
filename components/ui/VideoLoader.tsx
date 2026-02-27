'use client'

import { useRef, useEffect, useState } from 'react'

export default function VideoLoader() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onCanPlay = () => {
      v.play().then(() => setReady(true)).catch(() => setReady(true))
    }
    v.addEventListener('canplay', onCanPlay, { once: true })
    // If already ready (cached)
    if (v.readyState >= 3) onCanPlay()
    return () => v.removeEventListener('canplay', onCanPlay)
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
      <video
        ref={videoRef}
        src="/loading.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        controlsList="nodownload nofullscreen noremoteplayback"
        className="h-full w-auto max-w-full object-contain"
        style={{
          pointerEvents: 'none',
          aspectRatio: '9/16',
          opacity: ready ? 1 : 0,
          transition: 'opacity 0.15s ease-in',
        }}
      />
    </div>
  )
}
