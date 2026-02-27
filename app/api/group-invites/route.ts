import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyUser } from '@/lib/utils/notify'

// GET — get pending invites for current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: invites } = await supabase
      .from('group_invites')
      .select('*')
      .eq('invited_user', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    // Enrich with group and inviter info
    const groupIds = [...new Set((invites || []).map((i: any) => i.group_id))]
    const inviterIds = [...new Set((invites || []).map((i: any) => i.invited_by))]

    let groupMap = new Map<string, any>()
    let profileMap = new Map<string, any>()

    if (groupIds.length > 0) {
      const { data: groups } = await supabase
        .from('groups')
        .select('id, name, emoji')
        .in('id', groupIds)
      ;(groups || []).forEach((g: any) => groupMap.set(g.id, g))
    }

    if (inviterIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', inviterIds)
      ;(profiles || []).forEach((p: any) => profileMap.set(p.id, p))
    }

    const enriched = (invites || []).map((inv: any) => ({
      ...inv,
      group: groupMap.get(inv.group_id) || null,
      invitedBy: profileMap.get(inv.invited_by) || null,
    }))

    return NextResponse.json({ invites: enriched })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — send group invite to a friend, or directly add them
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { groupId, friendId, action } = await request.json()
    if (!groupId || !friendId) {
      return NextResponse.json({ error: 'groupId and friendId required' }, { status: 400 })
    }

    // Verify the inviter is a member of the group
    const { data: membership } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'You are not a member of this group' }, { status: 403 })
    }

    // Check if friend is already a member
    const { data: existingMember } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', friendId)
      .maybeSingle()

    if (existingMember) {
      return NextResponse.json({ error: 'Already a member' }, { status: 409 })
    }

    if (action === 'add') {
      // Directly add friend to group
      const { error: addError } = await (supabase.from('group_members') as any).insert({
        group_id: groupId,
        user_id: friendId,
        role: 'member',
      })

      if (addError) {
        console.error('[GroupInvites] Add error:', addError)
        return NextResponse.json({ error: addError.message }, { status: 500 })
      }

      // Notify the friend
      try {
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()

        const { data: groupData } = await supabase
          .from('groups')
          .select('name')
          .eq('id', groupId)
          .single()

        await notifyUser({
          supabase,
          userId: friendId,
          fromUserId: user.id,
          type: 'group_added',
          title: 'Added to Group',
          message: `${myProfile?.full_name || 'A friend'} added you to "${groupData?.name || 'a group'}"`,
          groupId,
          url: `/groups/${groupId}`,
        })
      } catch { /* best effort */ }

      return NextResponse.json({ success: true, action: 'added' })
    }

    // Send invite (for friends who have auto-add disabled)
    // Check if already invited
    const { data: existingInvite } = await supabase
      .from('group_invites')
      .select('id, status')
      .eq('group_id', groupId)
      .eq('invited_user', friendId)
      .maybeSingle()

    if (existingInvite) {
      if ((existingInvite as any).status === 'pending') {
        return NextResponse.json({ error: 'Invite already sent' }, { status: 409 })
      }
      // If previously rejected, allow re-invite by updating
      const { error: updateError } = await (supabase.from('group_invites') as any)
        .update({ status: 'pending', invited_by: user.id, updated_at: new Date().toISOString() })
        .eq('id', (existingInvite as any).id)

      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
    } else {
      const { error: insertError } = await (supabase.from('group_invites') as any)
        .insert({
          group_id: groupId,
          invited_by: user.id,
          invited_user: friendId,
        })

      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Notify
    try {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      const { data: groupData } = await supabase
        .from('groups')
        .select('name')
        .eq('id', groupId)
        .single()

      await notifyUser({
        supabase,
        userId: friendId,
        fromUserId: user.id,
        type: 'group_invite',
        title: 'Group Invitation',
        message: `${myProfile?.full_name || 'A friend'} invited you to join "${groupData?.name || 'a group'}"`,
        groupId,
        url: '/notifications',
      })
    } catch { /* best effort */ }

    return NextResponse.json({ success: true, action: 'invited' })
  } catch (error: any) {
    console.error('[GroupInvites] POST error:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}

// PATCH — accept or reject group invite
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { inviteId, action } = await request.json()
    if (!inviteId || !action) return NextResponse.json({ error: 'inviteId and action required' }, { status: 400 })

    // Get the invite
    const { data: invite } = await supabase
      .from('group_invites')
      .select('*')
      .eq('id', inviteId)
      .eq('invited_user', user.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })

    if (action === 'accept') {
      // Add to group
      const { error: addError } = await (supabase.from('group_members') as any).insert({
        group_id: (invite as any).group_id,
        user_id: user.id,
        role: 'member',
      })

      if (addError) return NextResponse.json({ error: addError.message }, { status: 500 })

      // Update invite status
      await (supabase.from('group_invites') as any)
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', inviteId)

      // Notify group members that someone joined
      try {
        const { data: joinerProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()

        const { data: groupData } = await supabase
          .from('groups')
          .select('name, personality')
          .eq('id', (invite as any).group_id)
          .single()

        const groupName = (groupData as any)?.name || 'group'
        const vibe = ((groupData as any)?.personality || 'chill') as 'chill' | 'formal' | 'roast'
        const joinerName = (joinerProfile as any)?.full_name || 'Someone'

        // Get other group members
        const { data: otherMembers } = await supabase
          .from('group_members')
          .select('user_id')
          .eq('group_id', (invite as any).group_id)
          .neq('user_id', user.id)

        const { getRandomAlertText } = await import('@/lib/utils/text-picker')
        const alertText = getRandomAlertText('group_joined', vibe, {
          member: joinerName,
          group: groupName,
        })

        for (const m of (otherMembers || [])) {
          await notifyUser({
            supabase,
            userId: (m as any).user_id,
            fromUserId: user.id,
            type: 'group_joined',
            title: 'New Member',
            message: alertText || `${joinerName} joined "${groupName}"`,
            groupId: (invite as any).group_id,
            url: `/groups/${(invite as any).group_id}`,
          })
        }
      } catch { /* best effort */ }

      return NextResponse.json({ success: true, groupId: (invite as any).group_id })
    }

    if (action === 'reject') {
      await (supabase.from('group_invites') as any)
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', inviteId)

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
