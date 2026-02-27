'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import CategoryIcon from '@/components/ui/CategoryIcon'
import { ArrowUpRight, ArrowDownLeft, Users, UserPlus, Loader2, Check, X, Settings, User, Plane, Home, UtensilsCrossed, Car, Zap, Package, Plus } from 'lucide-react'
import { formatINR } from '@/lib/utils/settlement'
import type { Profile, Group } from '@/lib/types/database'
import Link from 'next/link'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [totalOwed, setTotalOwed] = useState(0)
  const [totalOwe, setTotalOwe] = useState(0)
  const [recentExpenses, setRecentExpenses] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pendingInvites, setPendingInvites] = useState<any[]>([])
  const [inviteActionLoading, setInviteActionLoading] = useState<string | null>(null)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [balanceCollapsed, setBalanceCollapsed] = useState(false)
  const balanceCardRef = useRef<HTMLDivElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showProfileMenu) return
    function handleClickOutside(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showProfileMenu])

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setBalanceCollapsed(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-80px 0px 0px 0px' }
    )
    const el = balanceCardRef.current
    if (el) observer.observe(el)
    return () => { if (el) observer.unobserve(el) }
  }, [isLoading])

  useEffect(() => {
    async function loadDashboard() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (profileData) setProfile(profileData)

      // Load groups (only active memberships — exclude groups the user has left)
      const { data: memberData, error: memberError } = await supabase
        .from('group_members')
        .select('group_id, left_at, groups(*)')
        .eq('user_id', user.id)
        .is('left_at', null)

      console.log('[Dashboard] Groups query:', { memberData, memberError })

      if (memberData) {
        const userGroups = (memberData as any[])
          .map((m: any) => m.groups)
          .filter(Boolean)
        setGroups(userGroups)

        // Exclude terminated/inactive groups from balance calculations
        const activeGroups = userGroups.filter((g: Group) => g.is_active && !g.terminated_at)

        // Load recent expenses across all groups
        const groupIds = activeGroups.map((g: Group) => g.id)
        if (groupIds.length > 0) {
          const { data: expenses } = await supabase
            .from('expenses')
            .select('*, profiles!expenses_paid_by_fkey(full_name, avatar_url)')
            .in('group_id', groupIds)
            .order('created_at', { ascending: false })
            .limit(5)

          if (expenses) setRecentExpenses(expenses)

          // Calculate balances
          const { data: splits } = await supabase
            .from('expense_splits')
            .select('*, expenses!inner(paid_by, group_id)')
            .in('expenses.group_id', groupIds)

          const { data: settlements } = await supabase
            .from('settlements')
            .select('*')
            .in('group_id', groupIds)
            .eq('status', 'completed')

          if (splits) {
            let owed = 0 // others owe me
            let owe = 0 // I owe others

            splits.forEach((split: any) => {
              if (split.expenses.paid_by === user.id && split.user_id !== user.id) {
                owed += Number(split.amount)
              }
              if (split.user_id === user.id && split.expenses.paid_by !== user.id) {
                owe += Number(split.amount)
              }
            })

            // Subtract settlements
            if (settlements) {
              settlements.forEach((s: any) => {
                if (s.from_user === user.id) owe -= Number(s.amount)
                if (s.to_user === user.id) owed -= Number(s.amount)
              })
            }

            setTotalOwed(Math.max(0, owed))
            setTotalOwe(Math.max(0, owe))
          }
        }
      }

      // Load pending group invites
      try {
        const invitesRes = await fetch('/api/group-invites')
        if (invitesRes.ok) {
          const invitesData = await invitesRes.json()
          setPendingInvites(invitesData.invites || [])
        }
      } catch {}

      setIsLoading(false)
    }

    loadDashboard()
  }, [supabase])

  }

  const netBalance = totalOwed - totalOwe

  async function handleInviteAction(inviteId: string, groupId: string, action: 'accept' | 'reject') {
    setInviteActionLoading(inviteId)
    try {
      const res = await fetch('/api/group-invites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId, action }),
      })
      if (res.ok) {
        setPendingInvites(prev => prev.filter(inv => inv.id !== inviteId))
        if (action === 'accept') {
          router.push(`/groups/${groupId}`)
        }
      }
    } finally {
      setInviteActionLoading(null)
    }
  }

  return (
    <div className="pb-4">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm px-5 pt-14 pb-3">
        <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-normal text-muted-foreground leading-tight">
            {getGreeting()},
          </p>
          <h1 className="text-4xl font-bold leading-tight">
            {profile?.full_name?.split(' ')[0] || 'there'}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {groups.length} active group{groups.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setShowProfileMenu(prev => !prev)}
            className="rounded-full ring-2 ring-transparent hover:ring-primary/30 transition-all"
          >
            <Avatar
              name={profile?.full_name || 'User'}
              imageUrl={profile?.avatar_url}
              size="md"
            />
          </button>
          {showProfileMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
              <div className="absolute right-0 top-12 z-50 w-44 bg-background border border-border rounded-xl shadow-lg overflow-hidden">
                <button
                  onClick={() => { setShowProfileMenu(false); router.push('/profile') }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-sm hover:bg-muted transition-colors"
                >
                  <User className="h-4 w-4 text-muted-foreground" /> Profile
                </button>
                <button
                  onClick={() => { setShowProfileMenu(false); router.push('/friends') }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-sm hover:bg-muted transition-colors border-t border-border"
                >
                  <UserPlus className="h-4 w-4 text-muted-foreground" /> Friends
                </button>
                <button
                  onClick={() => { setShowProfileMenu(false); router.push('/settings') }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-sm hover:bg-muted transition-colors border-t border-border"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" /> Settings
                </button>
              </div>
            </>
          )}
        </div>
      </div>

        {/* Compact balance bar (appears on scroll) */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${balanceCollapsed ? 'max-h-12 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="flex items-center justify-between bg-primary text-white rounded-xl px-4 py-2 mt-2">
            <span className="text-xs font-medium opacity-80">Net Balance</span>
            <span className="text-sm font-bold">{netBalance >= 0 ? '+' : ''}{formatINR(netBalance)}</span>
            <div className="flex gap-3 text-[10px]">
              <span className="opacity-70">Owed: <span className="font-semibold opacity-100">{formatINR(totalOwed)}</span></span>
              <span className="opacity-70">Owe: <span className="font-semibold opacity-100">{formatINR(totalOwe)}</span></span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5">
      {/* Balance Card */}
      <div ref={balanceCardRef}>
      <div className="flex gap-2 mb-4">
        {/* Main balance card */}
        <Card className="flex-1 bg-primary text-white border-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 pointer-events-none" aria-hidden>
            <Image src="/smol.png" alt="" width={130} height={130} className="opacity-15 object-contain" />
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-xs opacity-80 font-medium uppercase tracking-wide">
              Net Balance
            </p>
            <p className="text-3xl font-bold">
              {netBalance >= 0 ? '+' : ''}{formatINR(netBalance)}
            </p>
            <div className="flex gap-4 mt-1">
              <div className="flex items-center gap-1.5">
                <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center">
                  <ArrowDownLeft className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-[10px] opacity-70">You&apos;re owed</p>
                  <p className="text-sm font-semibold">{formatINR(totalOwed)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-[10px] opacity-70">You owe</p>
                  <p className="text-sm font-semibold">{formatINR(totalOwe)}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
        {/* Settlements sidebar */}
        <div
          onClick={() => router.push('/settlements')}
          className="w-9 flex flex-col items-center justify-center border-2 border-dashed border-primary rounded-xl bg-primary/20 cursor-pointer active:scale-95 transition-transform"
        >
          <span
            className="text-[11px] font-normal text-white tracking-[0.15em] uppercase"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Settlements
          </span>
        </div>
      </div>
      </div>



      {/* Pending Group Invites */}
      {pendingInvites.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-3">Pending Invites</h2>
          <div className="flex flex-col gap-2">
            {pendingInvites.map((invite: any) => (
              <Card key={invite.id} padding="md" className="border-primary/20 bg-primary/5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-lg">
                    {invite.group?.emoji?.startsWith('http') ? <img src={invite.group.emoji} alt="" className="h-5 w-5 rounded object-cover" /> : invite.group?.emoji ? <CategoryIcon name={invite.group.emoji} className="h-5 w-5 text-muted-foreground" /> : <Users className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{invite.group?.name || 'Group'}</p>
                    <p className="text-xs text-muted-foreground">
                      Invited by {invite.invitedBy?.full_name || 'someone'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleInviteAction(invite.id, invite.group_id, 'accept')}
                      disabled={inviteActionLoading === invite.id}
                      className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50"
                    >
                      {inviteActionLoading === invite.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleInviteAction(invite.id, invite.group_id, 'reject')}
                      disabled={inviteActionLoading === invite.id}
                      className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center disabled:opacity-50"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Groups */}
      {groups.length > 0 ? (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Your Groups</h2>
            </div>
            <Link href="/groups" className="text-xs text-primary font-medium">
              See all
            </Link>
          </div>
          {/* 2-col grid: image groups → row-span-2 (≈square), icon groups → 1 row (small rectangle) */}
          <div
            className="grid grid-cols-2 gap-2"
            style={{ gridAutoRows: '64px' }}
          >
            {groups.filter(g => g.is_active && !g.terminated_at).slice(0, 6).sort((a, b) => {
              const aImg = a.emoji?.startsWith('http') ? 0 : 1
              const bImg = b.emoji?.startsWith('http') ? 0 : 1
              return aImg - bImg
            }).map((group) => {
              const isImage = group.emoji?.startsWith('http')
              return (
                <button
                  key={group.id}
                  onClick={() => router.push(`/groups/${group.id}`)}
                  className={`relative rounded-xl overflow-hidden bg-muted flex flex-col items-center justify-center gap-1 px-2 ${isImage ? 'row-span-2' : ''}`}
                >
                  {isImage ? (
                    <>
                      <img src={group.emoji} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-2.5 pb-2 pt-5">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm text-white truncate flex-1 leading-tight">{group.name}</p>
                          {group.mode === 'trip'
                            ? <Plane className="h-3.5 w-3.5 text-white/80 shrink-0" />
                            : <Home className="h-3.5 w-3.5 text-white/80 shrink-0" />}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col justify-center w-full px-3">
                        <p className="text-base font-semibold text-foreground truncate leading-tight">{group.name}</p>
                      </div>
                      <div className="absolute bottom-1.5 right-2">
                        {group.mode === 'trip'
                          ? <Plane className="h-3.5 w-3.5 text-muted-foreground" />
                          : <Home className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <Card className="mb-6 text-center py-8">
          <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-semibold mb-1">No groups yet</p>
          <p className="text-xs text-muted-foreground mb-4">
            Create your first group to start splitting expenses
          </p>
          <Button size="sm" onClick={() => router.push('/groups/new')}>
            Create Group
          </Button>
        </Card>
      )}

      {/* Recent Activity */}
      {recentExpenses.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Recent Activity</h2>
            <Link href="/activity" className="text-xs text-primary font-medium">See all</Link>
          </div>
          <div className="flex flex-col gap-2">
            {recentExpenses.slice(0, 5).map((expense) => (
              <Card key={expense.id} padding="sm">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-sm">
                    {expense.category === 'food' ? <UtensilsCrossed className="h-4 w-4 text-primary" /> :
                     expense.category === 'transport' ? <Car className="h-4 w-4 text-primary" /> :
                     expense.category === 'rent' ? <Home className="h-4 w-4 text-primary" /> :
                     expense.category === 'utilities' ? <Zap className="h-4 w-4 text-primary" /> : <Package className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{expense.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {expense.profiles?.full_name || 'Someone'} paid
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{formatINR(expense.amount)}</p>
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
