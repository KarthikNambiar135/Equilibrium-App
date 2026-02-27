import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyUser } from '@/lib/utils/notify'

// POST — send a notification to group admin(s)
// Used for join requests, etc.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { groupId, type, title, message } = await request.json()
    if (!groupId || !title || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get group admin(s)
    const { data: admins } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId)
      .eq('role', 'admin')
      .is('left_at', null)

    if (!admins || admins.length === 0) {
      return NextResponse.json({ error: 'No admins found' }, { status: 404 })
    }

    // Notify each admin
    for (const admin of admins) {
      await notifyUser({
        supabase,
        userId: (admin as any).user_id,
        fromUserId: user.id,
        type: type || 'join_request',
        title,
        message,
        groupId,
        url: `/groups/${groupId}`,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Notifications/Send] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
