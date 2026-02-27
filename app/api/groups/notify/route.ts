import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyUser } from '@/lib/utils/notify'
import { getRandomAlertText } from '@/lib/utils/text-picker'

/**
 * POST — Notify all group members about a group event.
 *
 * Body: { groupId, event, extra? }
 * event: 'terminated' | 'left' | 'joined'
 * extra: { memberName? } for left/joined events
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { groupId, event, extra } = await request.json()
    if (!groupId || !event) {
      return NextResponse.json({ error: 'groupId and event required' }, { status: 400 })
    }

    // Get group info
    const { data: group } = await supabase
      .from('groups')
      .select('name, personality, created_by')
      .eq('id', groupId)
      .single()

    const groupName = (group as any)?.name || 'group'
    const vibe = ((group as any)?.personality || 'chill') as 'chill' | 'formal' | 'roast'

    // Get actor name
    const { data: actorProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const actorName = (actorProfile as any)?.full_name || 'Someone'

    // Get all group members to notify (except the actor)
    const { data: members } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId)

    const membersToNotify = (members || [])
      .map((m: any) => m.user_id)
      .filter((id: string) => id !== user.id)

    if (membersToNotify.length === 0) {
      return NextResponse.json({ success: true, notified: 0 })
    }

    let type = ''
    let title = ''
    let message = ''

    switch (event) {
      case 'terminated': {
        type = 'group_terminated'
        title = 'Group Terminated'
        const alertText = getRandomAlertText('group_terminated', vibe, {
          group: groupName,
          owner: actorName,
        })
        message = alertText || `${actorName} has terminated "${groupName}"`
        break
      }
      case 'left': {
        type = 'group_left'
        title = 'Member Left'
        const memberName = extra?.memberName || actorName
        const alertText = getRandomAlertText('group_left', vibe, {
          member: memberName,
          group: groupName,
        })
        message = alertText || `${memberName} has left "${groupName}"`
        break
      }
      case 'joined': {
        type = 'group_joined'
        title = 'New Member'
        const memberName = extra?.memberName || actorName
        const alertText = getRandomAlertText('group_joined', vibe, {
          member: memberName,
          group: groupName,
        })
        message = alertText || `${memberName} joined "${groupName}"`
        break
      }
      default:
        return NextResponse.json({ error: 'Unknown event' }, { status: 400 })
    }

    // Notify all members
    const results = await Promise.allSettled(
      membersToNotify.map((memberId: string) =>
        notifyUser({
          supabase,
          userId: memberId,
          fromUserId: user.id,
          type,
          title,
          message,
          groupId,
          url: `/groups/${groupId}`,
        })
      )
    )

    const notified = results.filter(r => r.status === 'fulfilled').length
    return NextResponse.json({ success: true, notified })
  } catch (error: any) {
    console.error('[Group Notify] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
