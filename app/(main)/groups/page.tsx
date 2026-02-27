'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import { Plus, Users, ChevronRight, ChevronDown, Ban, Plane, Home, LogOut, Search, UserCheck, Loader2 } from 'lucide-react'
import CategoryIcon from '@/components/ui/CategoryIcon'
import Avatar from '@/components/ui/Avatar'
import type { Group } from '@/lib/types/database'

import VideoLoader from '@/components/ui/VideoLoader'

export default function GroupsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [groups, setGroups] = useState<Group[]>([])
  const [pastGroups, setPastGroups] = useState<(Group & { left_at: string })[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showPastGroups, setShowPastGroups] = useState(false)
  const [showTerminated, setShowTerminated] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'groups' | 'requests'>('groups')
  const [joinRequests, setJoinRequests] = useState<any[]>([])
  const [requestActionLoading, setRequestActionLoading] = useState<string | null>(null)

  useEffect(() => {
    async function loadGroups() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: memberData } = await supabase
        .from('group_members')
        .select('group_id, left_at, groups(*)')
        .eq('user_id', user.id)

      if (memberData) {
        const active = (memberData as any[])
          .filter((m: any) => !m.left_at && m.groups)
          .map((m: any) => m.groups)
        setGroups(active)

        const past = (memberData as any[])
          .filter((m: any) => !!m.left_at && m.groups)
          .map((m: any) => ({ ...m.groups, left_at: m.left_at }))
        setPastGroups(past)
      }
      setIsLoading(false)

      // Load join requests (for admin groups)
      try {
        const res = await fetch('/api/group-requests')
        if (res.ok) {
          const data = await res.json()
          setJoinRequests(data.requests || [])
        }
      } catch { /* silent */ }
    }

    loadGroups()
  }, [supabase])

  async function handleJoinRequest(requestId: string, action: 'accept' | 'reject') {
    setRequestActionLoading(requestId)
    try {
      const res = await fetch('/api/group-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      })
      if (res.ok) {
        setJoinRequests(prev => prev.filter(r => r.id !== requestId))
      }
    } catch { /* silent */ }
    setRequestActionLoading(null)
  }

  if (isLoading) {
    return <VideoLoader />
  }

  return (
    <div className="pb-4">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm px-5 pt-14 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold">Groups</h1>
          <Button size="sm" onClick={() => router.push('/groups/new')}>
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-muted text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        {/* Tabs */}
        <div className="flex gap-1 mt-2 bg-muted rounded-xl p-1">
          <button
            onClick={() => setActiveTab('groups')}
            className={`flex-1 text-xs font-medium py-2 rounded-lg transition-colors ${
              activeTab === 'groups' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            My Groups
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 text-xs font-medium py-2 rounded-lg transition-colors relative ${
              activeTab === 'requests' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            Requests
            {joinRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {joinRequests.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="px-5">

      {activeTab === 'requests' ? (
        /* ── Requests Tab ── */
        joinRequests.length === 0 ? (
          <EmptyState
            icon={<UserCheck className="h-7 w-7" />}
            title="No join requests"
            description="When someone requests to join your groups, it will appear here"
          />
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium text-primary uppercase tracking-wide flex items-center gap-1">
              <UserCheck className="h-3 w-3" /> Pending Requests ({joinRequests.length})
            </p>
            {joinRequests.map((req: any) => (
              <Card key={req.id} padding="md" className="border-primary/20 bg-primary/5">
                <div className="flex items-center gap-3">
                  <Avatar name={req.profile?.full_name || '?'} imageUrl={req.profile?.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{req.profile?.full_name || 'Unknown'}</p>
                    <p className="text-[11px] text-muted-foreground">wants to join <span className="font-medium text-foreground">{req.group?.name}</span></p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleJoinRequest(req.id, 'accept')}
                      disabled={requestActionLoading === req.id}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                    >
                      {requestActionLoading === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Accept'}
                    </button>
                    <button
                      onClick={() => handleJoinRequest(req.id, 'reject')}
                      disabled={requestActionLoading === req.id}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg bg-muted text-muted-foreground disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
      /* ── My Groups Tab ── */
      groups.length === 0 && pastGroups.length === 0 ? (
        <EmptyState
          icon={<Users className="h-7 w-7" />}
          title="No groups yet"
          description="Create a group with your friends, roommates, or travel buddies"
          action={
            <Button onClick={() => router.push('/groups/new')}>
              <Plus className="h-4 w-4" />
              Create Group
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {/* Join Requests banner (quick peek in groups tab) */}
          {joinRequests.length > 0 && (
            <button
              onClick={() => setActiveTab('requests')}
              className="w-full text-left"
            >
              <Card padding="sm" className="border-primary/20 bg-primary/5">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-primary" />
                  <p className="text-xs font-medium text-primary">{joinRequests.length} pending join request{joinRequests.length !== 1 ? 's' : ''}</p>
                  <ChevronRight className="h-3 w-3 text-primary ml-auto" />
                </div>
              </Card>
            </button>
          )}

          {/* Active groups (not terminated) */}
          {groups.filter(g => g.is_active && !g.terminated_at && g.name.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Active
              </p>
              {groups
                .filter((g) => g.is_active && !g.terminated_at && g.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((group) => (
                  <Card
                    key={group.id}
                    onClick={() => router.push(`/groups/${group.id}`)}
                    padding="md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                        {group.emoji?.startsWith('http') ? <img src={group.emoji} alt="" className="h-full w-full rounded-xl object-cover" /> : <CategoryIcon name={group.emoji} className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {group.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {group.mode === 'trip' ? <><Plane className="inline h-3 w-3" /> Trip</> : <><Home className="inline h-3 w-3" /> Regular</>}
                          </span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground capitalize">
                            {group.personality}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Card>
                ))}
            </>
          )}

          {/* Terminated groups (collapsible) */}
          {groups.filter(g => !!g.terminated_at && g.name.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 && (
            <>
              <button
                onClick={() => setShowTerminated(!showTerminated)}
                className="flex items-center gap-2 mt-4 px-1 py-1.5"
              >
                <ChevronDown className={`h-4 w-4 text-destructive/60 transition-transform ${showTerminated ? 'rotate-180' : ''}`} />
                <p className="text-xs font-medium text-destructive uppercase tracking-wide flex items-center gap-1">
                  <Ban className="h-3 w-3" /> Terminated ({groups.filter(g => !!g.terminated_at && g.name.toLowerCase().includes(searchQuery.toLowerCase())).length})
                </p>
              </button>
              {showTerminated && groups
                .filter((g) => !!g.terminated_at && g.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((group) => (
                  <Card
                    key={group.id}
                    onClick={() => router.push(`/groups/${group.id}`)}
                    padding="md"
                    className="opacity-60 border-destructive/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                        {group.emoji?.startsWith('http') ? <img src={group.emoji} alt="" className="h-full w-full rounded-xl object-cover" /> : <CategoryIcon name={group.emoji} className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {group.name}
                        </p>
                        <p className="text-xs text-destructive">Terminated</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Card>
                ))}
            </>
          )}

          {/* Past groups (user left) */}
          {pastGroups.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 && (
            <>
              <button
                onClick={() => setShowPastGroups(!showPastGroups)}
                className="flex items-center gap-2 mt-4 px-1 py-1.5"
              >
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showPastGroups ? 'rotate-180' : ''}`} />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <LogOut className="h-3 w-3" /> Past Groups ({pastGroups.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase())).length})
                </p>
              </button>
              {showPastGroups && pastGroups.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase())).map((group) => (
                <Card
                  key={group.id}
                  onClick={() => router.push(`/groups/${group.id}`)}
                  padding="md"
                  className="opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                      {group.emoji?.startsWith('http') ? <img src={group.emoji} alt="" className="h-full w-full rounded-xl object-cover" /> : <CategoryIcon name={group.emoji} className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {group.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Left · {group.mode === 'trip' ? <><Plane className="inline h-3 w-3" /> Trip</> : <><Home className="inline h-3 w-3" /> Regular</>}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Card>
              ))}
            </>
          )}        </div>
      )
      )}
      </div>
    </div>
  )
}
