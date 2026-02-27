import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyUser } from '@/lib/utils/notify'

// GET — list friends, pending incoming, pending outgoing, or search users
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const action = request.nextUrl.searchParams.get('action')

    // Search users by email (for sending friend requests)
    if (action === 'search') {
      const query = request.nextUrl.searchParams.get('q')?.trim().toLowerCase()
      if (!query || query.length < 3) return NextResponse.json({ users: [] })

      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .ilike('email', `%${query}%`)
        .neq('id', user.id)
        .limit(8)

      // Get existing friendships to mark status
      const { data: friendships } = await supabase
        .from('friendships')
        .select('*')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

      const friendMap = new Map<string, string>() // userId -> status
      ;(friendships || []).forEach((f: any) => {
        const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id
        if (f.status === 'accepted') {
          friendMap.set(otherId, 'friends')
        } else if (f.requester_id === user.id) {
          friendMap.set(otherId, 'sent')
        } else {
          friendMap.set(otherId, 'received')
        }
      })

      const enriched = (users || []).map((u: any) => ({
        ...u,
        friendStatus: friendMap.get(u.id) || null,
      }))

      return NextResponse.json({ users: enriched })
    }

    // Get all friendships for current user
    const { data: friendships } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .order('updated_at', { ascending: false })

    const allFriendIds = new Set<string>()
    const friends: any[] = []
    const incoming: any[] = []
    const outgoing: any[] = []

    ;(friendships || []).forEach((f: any) => {
      const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id
      allFriendIds.add(otherId)
      if (f.status === 'accepted') {
        friends.push({ ...f, friendId: otherId })
      } else if (f.addressee_id === user.id) {
        incoming.push({ ...f, friendId: f.requester_id })
      } else {
        outgoing.push({ ...f, friendId: f.addressee_id })
      }
    })

    // Fetch profiles for all related users
    const ids = Array.from(allFriendIds)
    let profileMap = new Map<string, any>()
    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', ids)
      ;(profiles || []).forEach((p: any) => profileMap.set(p.id, p))
    }

    return NextResponse.json({
      friends: friends.map((f: any) => ({
        id: f.id,
        friendId: f.friendId,
        profile: profileMap.get(f.friendId) || null,
        since: f.updated_at,
      })),
      incoming: incoming.map((f: any) => ({
        id: f.id,
        friendId: f.friendId,
        profile: profileMap.get(f.friendId) || null,
        sentAt: f.created_at,
      })),
      outgoing: outgoing.map((f: any) => ({
        id: f.id,
        friendId: f.friendId,
        profile: profileMap.get(f.friendId) || null,
        sentAt: f.created_at,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — send friend request
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { addresseeId } = await request.json()
    if (!addresseeId) return NextResponse.json({ error: 'addresseeId required' }, { status: 400 })
    if (addresseeId === user.id) return NextResponse.json({ error: 'Cannot add yourself' }, { status: 400 })

    // Check if friendship already exists (in either direction)
    const { data: existing } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${user.id})`)
      .maybeSingle()

    if (existing) {
      if (existing.status === 'accepted') return NextResponse.json({ error: 'Already friends' }, { status: 409 })
      return NextResponse.json({ error: 'Request already pending' }, { status: 409 })
    }

    const { data, error } = await (supabase.from('friendships') as any)
      .insert({ requester_id: user.id, addressee_id: addresseeId })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Send notification + push
    try {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      await notifyUser({
        supabase,
        userId: addresseeId,
        fromUserId: user.id,
        type: 'friend_request',
        title: 'Friend Request',
        message: `${myProfile?.full_name || 'Someone'} sent you a friend request`,
        url: '/friends',
      })
    } catch { /* best effort */ }

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH — accept friend request
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { friendshipId, action } = await request.json()
    if (!friendshipId) return NextResponse.json({ error: 'friendshipId required' }, { status: 400 })

    if (action === 'accept') {
      const { error } = await (supabase.from('friendships') as any)
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', friendshipId)
        .eq('addressee_id', user.id)
        .eq('status', 'pending')

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Send notification to requester
      try {
        const { data: friendship } = await supabase
          .from('friendships')
          .select('requester_id')
          .eq('id', friendshipId)
          .single()

        const { data: myProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()

        if (friendship) {
          await notifyUser({
            supabase,
            userId: (friendship as any).requester_id,
            fromUserId: user.id,
            type: 'friend_accepted',
            title: 'Friend Request Accepted',
            message: `${myProfile?.full_name || 'Someone'} accepted your friend request!`,
            url: '/friends',
          })
        }
      } catch { /* best effort */ }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — reject/cancel friend request, or unfriend
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { friendshipId } = await request.json()
    if (!friendshipId) return NextResponse.json({ error: 'friendshipId required' }, { status: 400 })

    // Only participants can delete
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
