import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST — save a push subscription for the current user
// Supports both Web Push (browser) and FCM (native Capacitor)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // === FCM token (from Capacitor native push) ===
    if (body.type === 'fcm' && body.token) {
      // Delete existing FCM subscription for this user+token, then insert
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('endpoint', body.token)

      const { error } = await (supabase.from('push_subscriptions') as any)
        .insert({
          user_id: user.id,
          endpoint: body.token,
          keys_p256dh: '',
          keys_auth: '',
          type: 'fcm',
        })

      if (error) {
        console.error('[Push] Failed to save FCM token:', error)
        return NextResponse.json({ error: 'Failed to save FCM token' }, { status: 500 })
      }

      console.log(`[Push] FCM token saved for user ${user.id}`)
      return NextResponse.json({ success: true, type: 'fcm' })
    }

    // === Web Push subscription (from browser) ===
    const { subscription } = body

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    // Delete existing subscription for this endpoint, then insert fresh
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', subscription.endpoint)

    const { error } = await (supabase.from('push_subscriptions') as any)
      .insert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        keys_p256dh: subscription.keys.p256dh,
        keys_auth: subscription.keys.auth,
        type: 'web',
      })

    if (error) {
      console.error('[Push] Failed to save subscription:', error)
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true, type: 'web' })
  } catch (error: any) {
    console.error('[Push] Subscribe error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — remove a push subscription
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { endpoint } = await request.json()

    if (endpoint) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('endpoint', endpoint)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Push] Unsubscribe error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
