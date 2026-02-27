import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'

// Configure VAPID
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || ''

let vapidConfigured = false
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails('mailto:hello@equilibrium.app', VAPID_PUBLIC, VAPID_PRIVATE)
    vapidConfigured = true
  } catch { /* ignore */ }
}

// ---------- Firebase Admin for FCM (server-side) ----------
let fcmMessaging: any = null

async function initFirebase() {
  if (fcmMessaging) return fcmMessaging
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!serviceAccountJson) return null
  try {
    const admin = await import('firebase-admin')
    const serviceAccount = JSON.parse(serviceAccountJson)
    if (!admin.apps?.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
    }
    fcmMessaging = admin.messaging()
    return fcmMessaging
  } catch {
    return null
  }
}

async function sendFcmNotification(
  token: string,
  title: string,
  body: string,
  url: string,
): Promise<boolean> {
  const messaging = await initFirebase()
  if (!messaging) return false
  try {
    await messaging.send({
      token,
      notification: { title, body },
      data: { url: url || '/notifications' },
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'equilibrium_default',
          icon: 'ic_notification',
          color: '#2563eb',
          sound: 'default',
        },
      },
    })
    return true
  } catch (err: any) {
    if (
      err.code === 'messaging/registration-token-not-registered' ||
      err.code === 'messaging/invalid-registration-token'
    ) {
      return false // token expired, will be cleaned below
    }
    return false
  }
}

/**
 * Send a push notification to a user's registered devices.
 * Handles BOTH web push (VAPID) and FCM (native Android).
 */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  url?: string
): Promise<{ sent: number; total: number }> {
  try {
    const supabase = await createClient()
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)

    if (!subscriptions || subscriptions.length === 0) {
      return { sent: 0, total: 0 }
    }

    const payload = JSON.stringify({
      title,
      body,
      url: url || '/notifications',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    })

    const results = await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        const subType = sub.type || 'web'

        // ---- FCM (native Android) ----
        if (subType === 'fcm') {
          const success = await sendFcmNotification(sub.endpoint, title, body, url || '/notifications')
          if (!success) {
            // Clean up expired token
            try { await supabase.from('push_subscriptions').delete().eq('id', sub.id) } catch {}
          }
          return success
        }

        // ---- Web Push (browser) ----
        if (!vapidConfigured) return false
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
            payload
          )
          return true
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            try { await supabase.from('push_subscriptions').delete().eq('id', sub.id) } catch {}
          }
          return false
        }
      })
    )

    const sent = results.filter(r => r.status === 'fulfilled' && r.value === true).length
    return { sent, total: subscriptions.length }
  } catch {
    return { sent: 0, total: 0 }
  }
}

/**
 * Insert a notification + send push in one call.
 * This is the unified way to notify a user.
 */
export async function notifyUser(opts: {
  supabase: any
  userId: string
  fromUserId?: string
  type: string
  title: string
  message: string
  groupId?: string | null
  url?: string
}) {
  const { supabase, userId, fromUserId, type, title, message, groupId, url } = opts

  // Insert into notifications table
  await (supabase.from('notifications') as any).insert({
    user_id: userId,
    from_user_id: fromUserId || null,
    type,
    title,
    message,
    group_id: groupId || null,
  })

  // Send push notification (best effort, don't await in critical path)
  sendPushToUser(userId, title, message, url).catch(() => {})
}
