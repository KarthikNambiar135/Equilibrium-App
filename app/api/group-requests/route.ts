import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyUser } from '@/lib/utils/notify'

// GET — fetch join requests for groups where current user is admin
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get groups where user is admin
    const { data: adminGroups } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .is('left_at', null)

    if (!adminGroups || adminGroups.length === 0) {
      return NextResponse.json({ requests: [] })
    }

    const groupIds = adminGroups.map((g: any) => g.group_id)

    // Get pending requests for those groups
    const { data: requests } = await (supabase.from('group_join_requests') as any)
      .select('*')
      .in('group_id', groupIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (!requests || requests.length === 0) {
      return NextResponse.json({ requests: [] })
    }

    // Enrich with user profiles and group names
    const userIds = [...new Set(requests.map((r: any) => r.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds)

    const { data: groups } = await supabase
      .from('groups')
      .select('id, name, emoji')
      .in('id', groupIds)

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))
    const groupMap = new Map((groups || []).map((g: any) => [g.id, g]))

    const enriched = requests.map((r: any) => ({
      ...r,
      profile: profileMap.get(r.user_id) || null,
      group: groupMap.get(r.group_id) || null,
    }))

    return NextResponse.json({ requests: enriched })
  } catch (error: any) {
    console.error('[Group Requests] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH — accept or reject a join request
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { requestId, action } = await request.json()
    if (!requestId || !['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'requestId and valid action required' }, { status: 400 })
    }

    // Get the request
    const { data: joinReq } = await (supabase.from('group_join_requests') as any)
      .select('*')
      .eq('id', requestId)
      .eq('status', 'pending')
      .maybeSingle()

    if (!joinReq) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Verify current user is admin of the group
    const { data: membership } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', joinReq.group_id)
      .eq('user_id', user.id)
      .is('left_at', null)
      .maybeSingle()

    if (!membership || (membership as any).role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can handle join requests' }, { status: 403 })
    }

    if (action === 'accept') {
      // Check member limit
      const { data: groupData } = await supabase
        .from('groups')
        .select('member_limit, name')
        .eq('id', joinReq.group_id)
        .single()

      const memberLimit = (groupData as any)?.member_limit ?? 30
      const { count: memberCount } = await supabase
        .from('group_members')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', joinReq.group_id)
        .is('left_at', null)

      if ((memberCount || 0) >= memberLimit) {
        return NextResponse.json({ error: `Group is full (${memberLimit} member limit)` }, { status: 400 })
      }

      // Add to group
      const { error: addError } = await (supabase.from('group_members') as any).insert({
        group_id: joinReq.group_id,
        user_id: joinReq.user_id,
        role: 'member',
      })

      if (addError) {
        return NextResponse.json({ error: addError.message }, { status: 500 })
      }

      // Update request status
      await (supabase.from('group_join_requests') as any)
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', requestId)

      // Notify the requester
      const groupName = (groupData as any)?.name || 'the group'
      await notifyUser({
        supabase,
        userId: joinReq.user_id,
        fromUserId: user.id,
        type: 'group_added',
        title: 'Request Accepted',
        message: `Your request to join "${groupName}" was accepted!`,
        groupId: joinReq.group_id,
        url: `/groups/${joinReq.group_id}`,
      })

      return NextResponse.json({ success: true, groupId: joinReq.group_id })
    }

    if (action === 'reject') {
      // Update request status
      await (supabase.from('group_join_requests') as any)
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', requestId)

      // Get group name for notification
      const { data: groupData } = await supabase
        .from('groups')
        .select('name')
        .eq('id', joinReq.group_id)
        .single()

      // Notify the requester
      await notifyUser({
        supabase,
        userId: joinReq.user_id,
        fromUserId: user.id,
        type: 'group_invite',
        title: 'Request Declined',
        message: `Your request to join "${(groupData as any)?.name || 'the group'}" was declined.`,
        groupId: joinReq.group_id,
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('[Group Requests] PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
