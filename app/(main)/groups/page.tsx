'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import { Plus, Users, ChevronRight, ChevronDown, Ban, Plane, Home, LogOut, Search } from 'lucide-react'
import CategoryIcon from '@/components/ui/CategoryIcon'
import type { Group } from '@/lib/types/database'

import VideoLoader from '@/components/ui/VideoLoader'

export default function GroupsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [groups, setGroups] = useState<Group[]>([])
  const [pastGroups, setPastGroups] = useState<(Group & { left_at: string })[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showPastGroups, setShowPastGroups] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

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
    }

    loadGroups()
  }, [supabase])

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
      </div>

      <div className="px-5">

      {groups.length === 0 && pastGroups.length === 0 ? (
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

          {/* Terminated groups */}
          {groups.filter(g => !!g.terminated_at && g.name.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 && (
            <>
              <p className="text-xs font-medium text-destructive uppercase tracking-wide mt-4 flex items-center gap-1">
                <Ban className="h-3 w-3" /> Terminated
              </p>
              {groups
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
      )}
      </div>
    </div>
  )
}
