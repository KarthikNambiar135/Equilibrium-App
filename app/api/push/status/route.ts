import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET — check push subscription status for current user
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, created_at, type')
      .eq('user_id', user.id)

    if (error) {
      console.error('[Push] Status check error:', error)
      return NextResponse.json({ 
        subscribed: false, 
        count: 0, 
        error: error.message,
        hint: error.message.includes('does not exist') 
          ? 'Run supabase-migration-push.sql in your Supabase SQL Editor'
          : error.message
      })
    }

    const fcmCount = subscriptions?.filter(s => s.type === 'fcm').length || 0
    const webCount = subscriptions?.filter(s => s.type !== 'fcm').length || 0

    return NextResponse.json({
      subscribed: (subscriptions?.length || 0) > 0,
      count: subscriptions?.length || 0,
      fcmCount,
      webCount,
      subscriptions: subscriptions?.map(s => ({
        id: s.id,
        endpoint: s.endpoint?.slice(0, 80) + '...',
        type: s.type || 'web',
        created_at: s.created_at,
      })),
    })
  } catch (error: any) {
    console.error('[Push] Status error:', error)
    return NextResponse.json({ subscribed: false, count: 0, error: error.message })
  }
}

// DELETE — remove all old/stale web push subscriptions for current user
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete all web push subscriptions (stale ngrok, old browser ones)
    const { error, count } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .neq('type', 'fcm')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted: count })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
