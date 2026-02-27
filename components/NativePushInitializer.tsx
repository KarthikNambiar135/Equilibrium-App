'use client'

import { useEffect, useRef } from 'react'

export default function NativePushInitializer() {
  const registered = useRef(false)

  useEffect(() => {
    // Only run inside Capacitor native app
    const isNative = typeof window !== 'undefined' &&
      !!(window as any).Capacitor?.isNativePlatform?.()
    if (!isNative || registered.current) return

    async function initNativePush() {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications')

        // Check / request permission
        let permResult = await PushNotifications.checkPermissions()
        if (permResult.receive === 'prompt') {
          permResult = await PushNotifications.requestPermissions()
        }
        if (permResult.receive !== 'granted') {
          console.warn('[NativePush] Permission denied')
          return
        }

        // Listen for registration success — sends FCM token to our server
        PushNotifications.addListener('registration', async (token) => {
          console.log('[NativePush] FCM token:', token.value.slice(0, 30) + '...')
          try {
            const res = await fetch('/api/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'fcm',
                token: token.value,
              }),
            })
            if (res.ok) {
              console.log('[NativePush] ✅ FCM token saved to server')
              registered.current = true
            } else {
              const err = await res.json().catch(() => ({}))
              console.warn('[NativePush] Failed to save token:', err)
            }
          } catch (err) {
            console.error('[NativePush] Failed to send token:', err)
          }
        })

        // Listen for registration errors
        PushNotifications.addListener('registrationError', (err) => {
          console.error('[NativePush] Registration error:', err)
        })

        // Listen for incoming notifications when app is in foreground
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('[NativePush] Foreground notification:', notification)
          // Show a local notification or toast here if desired
        })

        // Listen for notification tap (action)
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('[NativePush] Notification tapped:', action)
          const url = action.notification.data?.url
          if (url && typeof window !== 'undefined') {
            window.location.href = url
          }
        })

        // Register with FCM
        await PushNotifications.register()
        console.log('[NativePush] Registration initiated')
      } catch (err) {
        console.error('[NativePush] Init failed:', err)
      }
    }

    initNativePush()
  }, [])

  return null
}
