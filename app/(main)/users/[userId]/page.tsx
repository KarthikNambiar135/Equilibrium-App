'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import {
  ArrowLeft,
  Shield,
  Users,
  UserPlus,
  Loader2,
  Award,
} from 'lucide-react'
import CategoryIcon from '@/components/ui/CategoryIcon'

interface PublicProfile {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  honesty_score: number
}

interface EarnedBadge {
  id: string
  badge_type: string
  earned_at: string
  score: number
}

interface MutualGroup {
  id: string
  name: string
  emoji: string
}

interface MutualFriend {
  id: string
  full_name: string
  avatar_url: string | null
}

// Friendly display names for badge types
const BADGE_DISPLAY: Record<string, { name: string; icon: string }> = {
  EARLY_SETTLER: { name: 'Early Settler', icon: 'zap' },
  HONEST_100: { name: 'Full Honesty', icon: 'shield' },
  FIRST_SETTLE: { name: 'First Settlement', icon: 'check' },
  GROUP_CREATOR: { name: 'Group Creator', icon: 'users' },
  EXPENSE_ADDER: { name: 'Expense Master', icon: 'receipt' },
  CHARITY: { name: 'Generous Soul', icon: 'gift' },
  QUICK_SETTLER: { name: 'Quick Settler', icon: 'clock' },
  PERFECT_MONTH: { name: 'Perfect Month', icon: 'award' },
}

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [badges, setBadges] = useState<EarnedBadge[]>([])
  const [mutualGroups, setMutualGroups] = useState<MutualGroup[]>([])
  const [mutualFriends, setMutualFriends] = useState<MutualFriend[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [friendStatus, setFriendStatus] = useState<'friends' | 'sent' | 'received' | 'none'>('none')
  const [friendActionLoading, setFriendActionLoading] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [honestyTrulyNew, setHonestyTrulyNew] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [userId])

  async function loadProfile() {
    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUserId(user.id)

      // If viewing own profile, redirect to /profile
      if (user.id === userId) { router.replace('/profile'); return }

      // Fetch target profile
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, honesty_score')
        .eq('id', userId)
        .maybeSingle()

      if (!targetProfile) { setIsLoading(false); return }
      setProfile(targetProfile as PublicProfile)

      // Run all fetches in parallel
      await Promise.all([
        fetchBadges(),
        fetchMutualGroups(user.id),
        fetchMutualFriends(user.id),
        fetchFriendStatus(user.id),
        fetchHonestyInfo(),
      ])
    } catch { /* silent */ }
    setIsLoading(false)
  }

  async function fetchHonestyInfo() {
    try {
      const res = await fetch(`/api/honesty?userId=${userId}`)
      if (res.ok) {
        const d = await res.json()
        setHonestyTrulyNew((d.stats?.totalSettlements === 0 && d.stats?.totalExpenses === 0) ?? false)
      }
    } catch { /* silent */ }
  }

  async function fetchBadges() {
    const { data } = await supabase
      .from('user_badges')
      .select('id, badge_type, earned_at, score')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false })
    setBadges((data as EarnedBadge[]) || [])
  }

  async function fetchMutualGroups(myId: string) {
    const [{ data: myGroups }, { data: theirGroups }] = await Promise.all([
      supabase.from('group_members').select('group_id').eq('user_id', myId),
      supabase.from('group_members').select('group_id').eq('user_id', userId),
    ])
    if (!myGroups || !theirGroups) return
    const mySet = new Set((myGroups as any[]).map(g => g.group_id))
    const mutual = (theirGroups as any[]).filter(g => mySet.has(g.group_id)).map(g => g.group_id)
    if (mutual.length === 0) return
    const { data: groups } = await supabase
      .from('groups')
      .select('id, name, emoji')
      .in('id', mutual)
      .eq('is_active', true)
    setMutualGroups((groups as MutualGroup[]) || [])
  }

  async function fetchMutualFriends(myId: string) {
    const [{ data: myF }, { data: theirF }] = await Promise.all([
      supabase.from('friendships').select('requester_id, addressee_id').or(`requester_id.eq.${myId},addressee_id.eq.${myId}`).eq('status', 'accepted'),
      supabase.from('friendships').select('requester_id, addressee_id').or(`requester_id.eq.${userId},addressee_id.eq.${userId}`).eq('status', 'accepted'),
    ])
    if (!myF || !theirF) return
    const myFriendIds = new Set((myF as any[]).map(f => f.requester_id === myId ? f.addressee_id : f.requester_id))
    const theirFriendIds = new Set((theirF as any[]).map(f => f.requester_id === userId ? f.addressee_id : f.requester_id))
    const mutualIds = [...myFriendIds].filter(id => theirFriendIds.has(id) && id !== userId)
    if (mutualIds.length === 0) return
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', mutualIds)
    setMutualFriends((profiles as MutualFriend[]) || [])
  }

  async function fetchFriendStatus(myId: string) {
    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(requester_id.eq.${myId},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${myId})`)
      .maybeSingle()
    if (!data) { setFriendStatus('none'); return }
    if ((data as any).status === 'accepted') { setFriendStatus('friends'); return }
    if ((data as any).requester_id === myId) { setFriendStatus('sent') } else { setFriendStatus('received') }
  }

  async function sendFriendRequest() {
    setFriendActionLoading(true)
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresseeId: userId }),
      })
      if (res.ok) setFriendStatus('sent')
    } catch { /* silent */ }
    setFriendActionLoading(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="px-5 pt-14 pb-4 flex flex-col items-center gap-3 text-center">
        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center">
          <Users className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="text-base font-semibold">User not found</p>
        <Button variant="secondary" size="sm" onClick={() => router.back()}>Go Back</Button>
      </div>
    )
  }

  return (
    <div className="pb-24">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm px-5 pt-14 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-xl font-bold">Profile</h1>
        </div>
      </div>

      <div className="px-5 flex flex-col gap-4">
        {/* Avatar + name + email */}
        <div className="flex flex-col items-center text-center pt-4 pb-2">
          <div className="mb-3 h-20 w-20">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="h-20 w-20 rounded-full object-cover" />
            ) : (
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                {profile.full_name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <h2 className="text-xl font-bold">{profile.full_name}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{profile.email}</p>

        </div>

        {/* Friend action */}
        <div className="flex justify-center">
          {friendStatus === 'friends' ? (
            <span className="text-sm bg-success/10 text-success px-4 py-1.5 rounded-full font-medium flex items-center gap-1.5">
              <Users className="h-4 w-4" /> Friends
            </span>
          ) : friendStatus === 'sent' ? (
            <span className="text-sm bg-warning/10 text-warning px-4 py-1.5 rounded-full font-medium">Request Sent</span>
          ) : friendStatus === 'received' ? (
            <Button size="sm" onClick={sendFriendRequest} isLoading={friendActionLoading}>
              <UserPlus className="h-4 w-4" /> Accept Request
            </Button>
          ) : (
            <Button size="sm" onClick={sendFriendRequest} isLoading={friendActionLoading}>
              <UserPlus className="h-4 w-4" /> Add Friend
            </Button>
          )}
        </div>

        {/* Honesty score + badges row */}
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Honesty</p>
                <p className="text-xl font-bold">{honestyTrulyNew ? <span className="text-muted-foreground">NA</span> : `${profile.honesty_score ?? 0}%`}</p>
              </div>
            </div>
            {badges.length > 0 && (
              <>
                <div className="w-px h-10 bg-border shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Badges</p>
                  <div className="flex gap-1.5 overflow-x-auto">
                    {badges.slice(0, 6).map(badge => {
                      const config = BADGE_DISPLAY[badge.badge_type]
                      return (
                        <div
                          key={badge.id}
                          title={config?.name || badge.badge_type}
                          className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0"
                        >
                          <CategoryIcon name={config?.icon || 'award'} className="h-4 w-4 text-primary" />
                        </div>
                      )
                    })}
                    {badges.length > 6 && (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-muted-foreground">+{badges.length - 6}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
            {badges.length === 0 && (
              <>
                <div className="w-px h-10 bg-border shrink-0" />
                <div className="flex-1 flex items-center gap-2 text-muted-foreground/60">
                  <Award className="h-5 w-5" />
                  <p className="text-xs">No badges yet</p>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Earned badges list */}
        {badges.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Badges Earned</p>
            <div className="flex flex-col gap-2">
              {badges.map(badge => {
                const config = BADGE_DISPLAY[badge.badge_type]
                return (
                  <Card key={badge.id} padding="sm" className="border-primary/10 bg-primary/5">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <CategoryIcon name={config?.icon || 'award'} className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{config?.name || badge.badge_type}</p>
                      </div>
                      <p className="text-sm font-bold text-primary">{badge.score}</p>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* Mutual groups */}
        {mutualGroups.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Mutual Groups ({mutualGroups.length})
            </p>
            <div className="flex flex-col gap-2">
              {mutualGroups.map(group => (
                <Card
                  key={group.id}
                  padding="sm"
                  onClick={() => router.push(`/groups/${group.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      {group.emoji?.startsWith('http')
                        ? <img src={group.emoji} alt="" className="h-full w-full rounded-xl object-cover" />
                        : <CategoryIcon name={group.emoji} className="h-4 w-4 text-muted-foreground" />
                      }
                    </div>
                    <p className="text-sm font-medium truncate flex-1">{group.name}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Mutual friends */}
        {mutualFriends.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Mutual Friends ({mutualFriends.length})
            </p>
            <div className="flex flex-col gap-2">
              {mutualFriends.map(friend => (
                <Card key={friend.id} padding="sm" onClick={() => router.push(`/users/${friend.id}`)}>
                  <div className="flex items-center gap-3">
                    <Avatar name={friend.full_name} imageUrl={friend.avatar_url} size="sm" />
                    <p className="text-sm font-medium truncate flex-1">{friend.full_name}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
