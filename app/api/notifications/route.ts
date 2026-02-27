import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPushToUser } from '@/lib/utils/notify'

// GET — fetch current user's notifications
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*, from_profile:profiles!notifications_from_user_id_fkey(full_name, avatar_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      // Fallback: query without join if FK doesn't exist
      const { data: fallback } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      return NextResponse.json({ notifications: fallback || [] })
    }

    return NextResponse.json({ notifications: notifications || [] })
  } catch (error: any) {
    console.error('[Notifications] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — send a notification (e.g. reminder)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { toUserId, type, title, message, groupId } = await request.json()

    if (!toUserId || !title || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { error: insertError } = await (supabase.from('notifications') as any)
      .insert({
        user_id: toUserId,
        from_user_id: user.id,
        type: type || 'reminder',
        title,
        message,
        group_id: groupId || null,
      })

    if (insertError) {
      console.error('[Notifications] Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 })
    }

    // Send push notification (best effort)
    try {
      await sendPushToUser(toUserId, title, message, groupId ? `/groups/${groupId}` : '/notifications')
    } catch { /* best effort */ }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Notifications] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH — mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { notificationIds, markAllRead } = await request.json()

    if (markAllRead) {
      await (supabase.from('notifications') as any)
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
    } else if (notificationIds?.length) {
      await (supabase.from('notifications') as any)
        .update({ is_read: true })
        .in('id', notificationIds)
        .eq('user_id', user.id)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Notifications] PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
