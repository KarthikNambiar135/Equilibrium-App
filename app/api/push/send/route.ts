import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import webpush from 'web-push'

// Configure web-push with VAPID keys (for browser push)
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || ''

let vapidConfigured = false
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(
      'mailto:hello@equilibrium.app',
      VAPID_PUBLIC,
      VAPID_PRIVATE
    )
    vapidConfigured = true
    console.log('[Push] VAPID configured ✓')
  } catch (err) {
    console.error('[Push] VAPID configuration failed:', err)
  }
}

// ---------- Firebase Admin for FCM ----------
let firebaseApp: any = null
let fcmMessaging: any = null

async function initFirebase() {
  if (fcmMessaging) return fcmMessaging
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!serviceAccountJson) {
    console.warn('[Push] FIREBASE_SERVICE_ACCOUNT_JSON not set — FCM disabled')
    return null
  }
  try {
    const admin = await import('firebase-admin')
    const serviceAccount = JSON.parse(serviceAccountJson)
    if (!admin.apps?.length) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      })
    } else {
      firebaseApp = admin.apps[0]
    }
    fcmMessaging = admin.messaging()
    console.log('[Push] Firebase Admin initialized ✓')
    return fcmMessaging
  } catch (err) {
    console.error('[Push] Firebase Admin init failed:', err)
    return null
  }
}

// Send a single FCM notification
async function sendFcmNotification(
  token: string,
  title: string,
  body: string,
  url: string,
): Promise<{ success: boolean; error?: string }> {
  const messaging = await initFirebase()
  if (!messaging) return { success: false, error: 'FCM not configured' }

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
          color: '#F07F3C',
          sound: 'default',
        },
      },
    })
    return { success: true }
  } catch (err: any) {
    // Token is invalid/expired — will be cleaned up
    if (
      err.code === 'messaging/registration-token-not-registered' ||
      err.code === 'messaging/invalid-registration-token'
    ) {
      return { success: false, error: 'token-expired' }
    }
    return { success: false, error: err.message }
  }
}

// POST — send push notification to a user
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { toUserId, title, body, url } = await request.json()

    // If toUserId === 'self' or equals current user, send to self (test mode)
    const targetUserId = (toUserId === 'self') ? user.id : toUserId

    if (!targetUserId || !title || !body) {
      return NextResponse.json({ error: 'Missing required fields: toUserId, title, body' }, { status: 400 })
    }

    console.log(`[Push] Sending notification to user ${targetUserId} from ${user.id}`)
    console.log(`[Push] Title: "${title}", Body: "${body?.slice(0, 50)}..."`)

    // Get all push subscriptions for the target user
    const { data: subscriptions, error: queryError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', targetUserId)

    if (queryError) {
      console.error('[Push] DB query error:', queryError)
      return NextResponse.json({ 
        error: 'Database error', 
        details: queryError.message,
        hint: queryError.message.includes('does not exist')
          ? 'Table push_subscriptions does not exist. Run supabase-migration-push.sql'
          : queryError.hint || queryError.message
      }, { status: 500 })
    }

    console.log(`[Push] Found ${subscriptions?.length || 0} subscription(s) for user ${targetUserId}`)

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ 
        success: false, 
        sent: 0,
        message: 'User has no push subscriptions. They need to open the app and allow notifications first.' 
      })
    }

    const payload = JSON.stringify({
      title,
      body,
      url: url || '/notifications',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    })

    // Send to all subscriptions for this user (multiple devices)
    const results = await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        const subType = sub.type || 'web'

        // ---- FCM (native Android) ----
        if (subType === 'fcm') {
          console.log(`[Push] Sending FCM to token: ${sub.endpoint.slice(0, 30)}...`)
          const result = await sendFcmNotification(sub.endpoint, title, body, url)
          if (result.success) {
            console.log(`[Push] ✅ FCM sent successfully`)
          } else {
            console.error(`[Push] ❌ FCM failed: ${result.error}`)
            // Clean up expired tokens
            if (result.error === 'token-expired') {
              console.log(`[Push] Removing expired FCM token ${sub.id}`)
              await supabase.from('push_subscriptions').delete().eq('id', sub.id)
            }
          }
          return { success: result.success, endpoint: sub.endpoint, type: 'fcm', error: result.error }
        }

        // ---- Web Push (browser) ----
        if (!vapidConfigured) {
          return { success: false, endpoint: sub.endpoint, type: 'web', error: 'VAPID not configured' }
        }

        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys_p256dh,
            auth: sub.keys_auth,
          },
        }

        try {
          console.log(`[Push] Sending Web Push to endpoint: ${sub.endpoint.slice(0, 60)}...`)
          const result = await webpush.sendNotification(pushSubscription, payload)
          console.log(`[Push] ✅ Web Push sent, status: ${result.statusCode}`)
          return { success: true, endpoint: sub.endpoint, type: 'web' }
        } catch (err: any) {
          console.error(`[Push] ❌ Web Push failed:`, err.statusCode, err.body || err.message)
          // If subscription is expired/invalid, remove it
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log(`[Push] Removing expired subscription ${sub.id}`)
            await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          }
          return { success: false, endpoint: sub.endpoint, type: 'web', error: err.message, statusCode: err.statusCode }
        }
      })
    )

    const sent = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length
    const failed = results.filter(r => r.status === 'fulfilled' && !(r.value as any).success)
    const errors = failed.map(r => r.status === 'fulfilled' ? (r.value as any).error : 'unknown')

    console.log(`[Push] Result: ${sent}/${subscriptions.length} sent, ${failed.length} failed`)
    if (errors.length > 0) console.log(`[Push] Errors:`, errors)

    return NextResponse.json({ 
      success: sent > 0, 
      sent, 
      total: subscriptions.length,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error: any) {
    console.error('[Push] Send error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
