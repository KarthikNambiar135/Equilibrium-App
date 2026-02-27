'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import VideoLoader from '@/components/ui/VideoLoader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import EmptyState from '@/components/ui/EmptyState'
import { Bell, Check, CheckCheck, Trash2, ArrowRight, Loader2, Coins, HandshakeIcon, UserPlus, Mail, PartyPopper, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Notification {
  id: string
  user_id: string
  from_user_id: string | null
  type: string
  title: string
  message: string
  group_id: string | null
  is_read: boolean
  created_at: string
  from_profile?: { full_name: string; avatar_url: string | null } | null
}

export default function NotificationsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fromNames, setFromNames] = useState<Map<string, { name: string; avatar: string | null }>>(new Map())
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadNotifications = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    const notifs = (data as Notification[] | null) || []
    setNotifications(notifs)

    // Load sender profiles
    const fromIds = [...new Set(notifs.filter(n => n.from_user_id).map(n => n.from_user_id!))]
    if (fromIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', fromIds)

      if (profiles) {
        const map = new Map<string, { name: string; avatar: string | null }>()
        profiles.forEach((p: any) => map.set(p.id, { name: p.full_name, avatar: p.avatar_url }))
        setFromNames(map)
      }
    }

    setIsLoading(false)
  }, [supabase])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    })
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  async function markRead(notifId: string) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationIds: [notifId] }),
    })
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n))
  }

  async function deleteNotification(notifId: string) {
    await supabase.from('notifications').delete().eq('id', notifId)
    setNotifications(prev => prev.filter(n => n.id !== notifId))
  }

  function getTimeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  function getTypeIcon(type: string): React.ReactNode {
    switch (type) {
      case 'reminder': return <Coins className="h-4 w-4 text-primary" />
      case 'payment': return <Check className="h-4 w-4 text-success" />
      case 'settlement': return <HandshakeIcon className="h-4 w-4 text-primary" />
      case 'friend_request': return <UserPlus className="h-4 w-4 text-primary" />
      case 'friend_accepted': return <HandshakeIcon className="h-4 w-4 text-success" />
      case 'group_invite': return <Mail className="h-4 w-4 text-primary" />
      case 'group_added': return <PartyPopper className="h-4 w-4 text-success" />
      case 'join_request': return <UserCheck className="h-4 w-4 text-primary" />
      default: return <Bell className="h-4 w-4 text-muted-foreground" />
    }
  }

  async function handleGroupInviteAction(notifId: string, groupId: string, action: 'accept' | 'reject') {
    setActionLoading(notifId)
    try {
      // Find invite by group_id for current user
      const invitesRes = await fetch('/api/group-invites')
      const invitesData = await invitesRes.json()
      const invite = invitesData.invites?.find((inv: any) => inv.group_id === groupId)
      if (!invite) return

      const res = await fetch('/api/group-invites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId: invite.id, action }),
      })
      if (res.ok) {
        await markRead(notifId)
        if (action === 'accept') {
          router.push(`/groups/${groupId}`)
        } else {
          setNotifications(prev => prev.map(n => 
            n.id === notifId ? { ...n, message: 'Invite declined', is_read: true } : n
          ))
        }
      }
    } finally {
      setActionLoading(null)
    }
  }

  async function handleFriendRequestAction(notifId: string, fromUserId: string, action: 'accept' | 'reject') {
    setActionLoading(notifId)
    try {
      // Find the friendship
      const friendsRes = await fetch('/api/friends')
      const friendsData = await friendsRes.json()
      const friendship = friendsData.incoming?.find((f: any) => f.friendId === fromUserId)
      if (!friendship) {
        // Already handled (accepted/declined elsewhere) — just mark as read
        await markRead(notifId)
        setNotifications(prev => prev.map(n =>
          n.id === notifId ? { ...n, is_read: true } : n
        ))
        return
      }

      if (action === 'accept') {
        await fetch('/api/friends', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ friendshipId: friendship.id, action: 'accept' }),
        })
      } else {
        await fetch('/api/friends', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ friendshipId: friendship.id }),
        })
      }
      await markRead(notifId)
      setNotifications(prev => prev.map(n => 
        n.id === notifId ? { ...n, message: action === 'accept' ? 'Friend request accepted!' : 'Friend request declined', is_read: true } : n
      ))
    } finally {
      setActionLoading(null)
    }
  }

  async function handleJoinRequestAction(notifId: string, groupId: string, fromUserId: string, action: 'accept' | 'reject') {
    setActionLoading(notifId)
    try {
      // Find pending join request for this user & group
      const res = await fetch('/api/group-requests')
      const data = await res.json()
      const joinReq = data.requests?.find((r: any) => r.group_id === groupId && r.user_id === fromUserId)
      if (!joinReq) {
        await markRead(notifId)
        setNotifications(prev => prev.map(n =>
          n.id === notifId ? { ...n, message: 'Request already handled', is_read: true } : n
        ))
        return
      }

      const patchRes = await fetch('/api/group-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: joinReq.id, action }),
      })

      if (patchRes.ok) {
        await markRead(notifId)
        setNotifications(prev => prev.map(n =>
          n.id === notifId ? {
            ...n,
            message: action === 'accept' ? 'Request accepted — member added!' : 'Request declined',
            is_read: true,
          } : n
        ))
      }
    } finally {
      setActionLoading(null)
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  if (isLoading) {
    return <VideoLoader />
  }

  return (
    <div className="pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm px-5 pt-14 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <Button size="sm" variant="secondary" onClick={markAllRead}>
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
        </div>
      </div>

      <div className="px-5">

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-7 w-7" />}
          title="No notifications"
          description="When someone sends you a reminder, it'll show up here"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((notif) => {
            const sender = notif.from_user_id ? fromNames.get(notif.from_user_id) : null
            return (
              <Card
                key={notif.id}
                padding="md"
                className={`transition-all ${!notif.is_read ? 'border-primary/30 bg-primary/5' : ''}`}
              >
                <div className="flex items-start gap-3">
                  {sender ? (
                    <Avatar name={sender.name} imageUrl={sender.avatar} size="sm" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm shrink-0">
                      {getTypeIcon(notif.type)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">{notif.title}</p>
                      {!notif.is_read && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                    
                    {/* Action buttons for group invites */}
                    {notif.type === 'group_invite' && !notif.is_read && notif.group_id && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => handleGroupInviteAction(notif.id, notif.group_id!, 'accept')}
                          disabled={actionLoading === notif.id}
                          className="text-xs font-medium px-3 py-1 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                        >
                          {actionLoading === notif.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Accept'}
                        </button>
                        <button
                          onClick={() => handleGroupInviteAction(notif.id, notif.group_id!, 'reject')}
                          disabled={actionLoading === notif.id}
                          className="text-xs font-medium px-3 py-1 rounded-lg bg-muted text-muted-foreground disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </div>
                    )}

                    {/* Action buttons for friend requests */}
                    {notif.type === 'friend_request' && !notif.is_read && notif.from_user_id && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => handleFriendRequestAction(notif.id, notif.from_user_id!, 'accept')}
                          disabled={actionLoading === notif.id}
                          className="text-xs font-medium px-3 py-1 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                        >
                          {actionLoading === notif.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Accept'}
                        </button>
                        <button
                          onClick={() => handleFriendRequestAction(notif.id, notif.from_user_id!, 'reject')}
                          disabled={actionLoading === notif.id}
                          className="text-xs font-medium px-3 py-1 rounded-lg bg-muted text-muted-foreground disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </div>
                    )}

                    {/* Action buttons for join requests (admin view) */}
                    {notif.type === 'join_request' && !notif.is_read && notif.group_id && notif.from_user_id && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => handleJoinRequestAction(notif.id, notif.group_id!, notif.from_user_id!, 'accept')}
                          disabled={actionLoading === notif.id}
                          className="text-xs font-medium px-3 py-1 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                        >
                          {actionLoading === notif.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Accept'}
                        </button>
                        <button
                          onClick={() => handleJoinRequestAction(notif.id, notif.group_id!, notif.from_user_id!, 'reject')}
                          disabled={actionLoading === notif.id}
                          className="text-xs font-medium px-3 py-1 rounded-lg bg-muted text-muted-foreground disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-2">
                      <p className="text-[10px] text-muted-foreground">{getTimeAgo(notif.created_at)}</p>
                      {sender && <p className="text-[10px] text-muted-foreground">from {sender.name}</p>}
                      {notif.group_id && (
                        <button
                          onClick={() => { markRead(notif.id); router.push(`/groups/${notif.group_id}`) }}
                          className="text-[10px] text-primary font-medium flex items-center gap-0.5"
                        >
                          View Group <ArrowRight className="h-2.5 w-2.5" />
                        </button>
                      )}
                      {(notif.type === 'friend_request' || notif.type === 'friend_accepted') && !notif.group_id && (
                        <button
                          onClick={() => { markRead(notif.id); router.push('/friends') }}
                          className="text-[10px] text-primary font-medium flex items-center gap-0.5"
                        >
                          View Friends <ArrowRight className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {!notif.is_read && (
                      <button onClick={() => markRead(notif.id)} className="p-1 rounded-lg hover:bg-muted transition-colors" title="Mark read">
                        <Check className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )}
                    <button onClick={() => deleteNotification(notif.id)} className="p-1 rounded-lg hover:bg-destructive/10 transition-colors" title="Delete">
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
      </div>
    </div>
  )
}
