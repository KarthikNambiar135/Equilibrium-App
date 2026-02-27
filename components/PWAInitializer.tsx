'use client'

import { useEffect, useRef } from 'react'

// Convert base64 VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

async function subscribeToPush(registration: ServiceWorkerRegistration) {
  try {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      console.warn('[Push] No VAPID key configured — set NEXT_PUBLIC_VAPID_PUBLIC_KEY')
      return false
    }

    // Check notification API support
    if (!('Notification' in window)) {
      console.warn('[Push] Notifications not supported in this browser')
      return false
    }

    if (!('PushManager' in window)) {
      console.warn('[Push] PushManager not supported in this browser')
      return false
    }

    // Check if already subscribed
    const existing = await registration.pushManager.getSubscription()
    if (existing) {
      console.log('[Push] Existing subscription found, syncing to server...')
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: existing.toJSON() }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        console.warn('[Push] Failed to sync subscription to server:', res.status, errData)
        // If 401, user not logged in yet — will retry later
        return res.status !== 401
      }
      console.log('[Push] Subscription synced to server ✓')
      return true
    }

    // Request notification permission
    console.log('[Push] Requesting notification permission...')
    const permission = await Notification.requestPermission()
    console.log('[Push] Permission result:', permission)
    if (permission !== 'granted') {
      console.warn('[Push] Notification permission denied by user')
      return false
    }

    // Subscribe to push manager
    console.log('[Push] Creating push subscription...')
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
    console.log('[Push] Browser push subscription created:', subscription.endpoint.slice(0, 60) + '...')

    // Save to server
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      console.error('[Push] Failed to save subscription to server:', res.status, errData)
      return false
    }

    console.log('[Push] ✅ Push notifications fully set up!')
    return true
  } catch (err) {
    console.error('[Push] Subscription failed:', err)
    return false
  }
}

export default function PWAInitializer() {
  const subscribed = useRef(false)
  const swReady = useRef<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    // Skip Web Push entirely inside Capacitor — NativePushInitializer handles FCM
    const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.()

    let updateInterval: ReturnType<typeof setInterval>

    const init = async () => {
      try {
        // Register service worker (still needed for caching, but skip push in Capacitor)
        const registration = await navigator.serviceWorker.register('/sw.js')
        console.log('[PWA] Service Worker registered:', registration.scope)

        // Wait for SW to be ready
        const ready = await navigator.serviceWorker.ready
        swReady.current = ready
        console.log('[PWA] Service Worker ready')

        // Try subscribing to push (skip in Capacitor — handled by NativePushInitializer)
        if (!isCapacitor) {
          const success = await subscribeToPush(ready)
          subscribed.current = success
        } else {
          console.log('[PWA] Skipping Web Push in Capacitor — using native FCM')
          subscribed.current = true // Prevent retry loops
        }

        // Check for SW updates periodically
        updateInterval = setInterval(() => {
          registration.update()
        }, 60000)
      } catch (error) {
        console.warn('[PWA] Service Worker registration failed:', error)
      }
    }

    // Run immediately — don't wait for 'load' event (it may have already fired)
    init()

    // Retry push subscription when user navigates back to the app (e.g., after login)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && !subscribed.current && swReady.current && !isCapacitor) {
        console.log('[Push] Page visible — retrying push subscription...')
        const success = await subscribeToPush(swReady.current)
        subscribed.current = success
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Also retry after a delay (covers the case where user logs in on same page)
    const retryTimeout = setTimeout(async () => {
      if (!subscribed.current && swReady.current && !isCapacitor) {
        console.log('[Push] Delayed retry for push subscription...')
        const success = await subscribeToPush(swReady.current)
        subscribed.current = success
      }
    }, 5000)

    // Handle iOS standalone mode detection
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (window.navigator as any).standalone === true
    if (isStandalone) {
      document.body.classList.add('pwa-standalone')
    }

    // Handle install prompt
    const handleInstallPrompt = (e: Event) => {
      e.preventDefault()
      console.log('[PWA] Install prompt available')
    }
    window.addEventListener('beforeinstallprompt', handleInstallPrompt)

    const handleAppInstalled = () => {
      console.log('[PWA] App installed successfully')
    }
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      clearInterval(updateInterval)
      clearTimeout(retryTimeout)
    }
  }, [])

  return null
}
