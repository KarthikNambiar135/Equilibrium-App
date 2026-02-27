'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import { ArrowLeft, Copy, Check, Search, UserPlus, Loader2, Users, Home, Plane, Briefcase, Smile, Flame, Send, ImagePlus, Info, X } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import { generateInviteCode } from '@/lib/utils/formatters'

const MODES = [
  { id: 'regular' as const, label: 'Regular', desc: 'Ongoing expenses (flat, roommates)', Icon: Home },
  { id: 'trip' as const, label: 'Trip', desc: 'Temporary, auto-closes after settlement', Icon: Plane },
]
const PERSONALITIES = [
  { id: 'chill' as const, label: 'Chill', desc: 'Hinglish, friendly vibes', Icon: Smile },
  { id: 'formal' as const, label: 'Formal', desc: 'Professional, polite reminders', Icon: Briefcase },
  { id: 'roast' as const, label: 'Roast', desc: 'Savage but fun reminders', Icon: Flame },
]

const NUDGE_VIBE_INFO = `Nudge Vibe controls the tone of automated reminders and notifications sent to group members.

• Chill — Casual Hinglish messages, friendly and light. Great for close friend groups.
• Formal — Polite, professional tone. Ideal for work or acquaintance groups.
• Roast — Savage and funny reminders that poke fun. Perfect for groups that enjoy banter.`

const GROUP_TYPE_INFO = `Group Type determines how the group lifecycle works.

• Regular — For ongoing shared expenses like rent, groceries, utilities. The group stays active indefinitely.
• Trip — For temporary travel groups. Once everyone settles up, members can close & exit. Trip-specific expense categories are available.`

export default function NewGroupPage() {
  return (
    <Suspense fallback={null}>
      <NewGroupContent />
    </Suspense>
  )
}

function NewGroupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Flow: Step 1 = Select friends, Step 2 = Name/Desc/Image, Step 3 = Type/Vibe, Step 4 = Success
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [mode, setMode] = useState<'regular' | 'trip'>('regular')
  const [personality, setPersonality] = useState<'chill' | 'formal' | 'roast'>('chill')
  const [isCreating, setIsCreating] = useState(false)
  const [createdGroup, setCreatedGroup] = useState<any>(null)
  const [copied, setCopied] = useState(false)
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null)

  // Join group state
  const [joinMode, setJoinMode] = useState(searchParams.get('join') === 'true')
  const [inviteCode, setInviteCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [isJoining, setIsJoining] = useState(false)

  // Image upload
  const imageFileRef = useRef<HTMLInputElement>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  // Friends selection state (Step 1)
  const [friendsList, setFriendsList] = useState<any[]>([])
  const [friendSearch, setFriendSearch] = useState('')
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set())

  // Info popup state
  const [showNudgeInfo, setShowNudgeInfo] = useState(false)
  const [showTypeInfo, setShowTypeInfo] = useState(false)

  // Check profile completeness on mount + load friends
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('upi_id, preferred_payment_app')
        .eq('id', user.id)
        .maybeSingle()
      if (!data?.upi_id || !data?.preferred_payment_app) {
        setProfileComplete(false)
        router.push('/profile?return=/groups/new')
      } else {
        setProfileComplete(true)
        loadFriends()
      }
    }
    init()
  }, [supabase, router])

  async function loadFriends() {
    setFriendsLoading(true)
    try {
      const res = await fetch('/api/friends')
      if (res.ok) {
        const data = await res.json()
        const friendProfiles = (data.friends || []).map((f: any) => f.profile).filter(Boolean)
        const profileIds = friendProfiles.map((p: any) => p.id)

        if (profileIds.length > 0) {
          const { data: settings } = await supabase
            .from('profiles')
            .select('id, allow_friends_add_to_group')
            .in('id', profileIds)

          const settingsMap = new Map((settings || []).map((s: any) => [s.id, s.allow_friends_add_to_group ?? true]))

          setFriendsList((data.friends || []).map((f: any) => ({
            ...f,
            allowDirectAdd: settingsMap.get(f.friendId) ?? true,
          })))
        } else {
          setFriendsList([])
        }
      }
    } catch { /* silent */ }
    setFriendsLoading(false)
  }

  function toggleFriendSelection(friendId: string) {
    setSelectedFriends(prev => {
      const next = new Set(prev)
      if (next.has(friendId)) next.delete(friendId)
      else next.add(friendId)
      return next
    })
  }

  async function handleCreate() {
    if (!name.trim()) return
    setIsCreating(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Upload image if provided
    let emojiValue = 'users' // default icon when no image
    if (imageFile) {
      try {
        const fd = new FormData()
        fd.append('file', imageFile)
        const upRes = await fetch('/api/upload', { method: 'POST', body: fd })
        if (upRes.ok) {
          const upData = await upRes.json()
          emojiValue = upData.url
        }
      } catch { /* fallback to default */ }
    }

    const code = generateInviteCode()

    const { data: group, error } = await (supabase
      .from('groups') as any)
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        emoji: emojiValue,
        mode,
        personality,
        invite_code: code,
        invite_code_expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        created_by: user.id,
      })
      .select()
      .single()

    if (error || !group) {
      setIsCreating(false)
      return
    }

    // Add creator as admin
    await (supabase.from('group_members') as any).insert({
      group_id: (group as any).id,
      user_id: user.id,
      role: 'admin',
    })

    // Add/invite selected friends
    for (const friendId of selectedFriends) {
      const friend = friendsList.find((f: any) => f.friendId === friendId)
      if (!friend) continue
      try {
        await fetch('/api/group-invites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupId: (group as any).id,
            friendId,
            action: friend.allowDirectAdd ? 'add' : 'invite',
          }),
        })
      } catch { /* silent */ }
    }

    setCreatedGroup(group)
    setStep(4)
    setIsCreating(false)
  }

  async function handleJoin() {
    if (!inviteCode.trim()) return
    setIsJoining(true)
    setJoinError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const codeToSearch = inviteCode.trim().toUpperCase()

    // Find group by invite code
    let targetGroup: any = null
    const { data: group } = await supabase
      .from('groups')
      .select('*')
      .eq('invite_code', codeToSearch)
      .maybeSingle()

    if (group) {
      targetGroup = group
    } else {
      // Also try without uppercase
      const { data: group2 } = await supabase
        .from('groups')
        .select('*')
        .eq('invite_code', inviteCode.trim())
        .maybeSingle()
      if (group2) targetGroup = group2
    }

    if (!targetGroup) {
      setJoinError('Invalid invite code. Check and try again.')
      setIsJoining(false)
      return
    }

    // Check if invite code is expired
    if (targetGroup.invite_code_expires_at && new Date(targetGroup.invite_code_expires_at) <= new Date()) {
      setJoinError('This invite code has expired. Ask the group admin for a new one.')
      setIsJoining(false)
      return
    }

    // Check if already member
    const { data: existing } = await (supabase
      .from('group_members') as any)
      .select('id')
      .eq('group_id', targetGroup.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      router.push(`/groups/${targetGroup.id}`)
      return
    }

    // Check member limit
    const memberLimit = targetGroup.member_limit ?? 30
    const { count: memberCount } = await supabase
      .from('group_members')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', targetGroup.id)
      .is('left_at', null)
    if ((memberCount || 0) >= memberLimit) {
      setJoinError(`This group is full (${memberLimit} member limit).`)
      setIsJoining(false)
      return
    }

    // Check join mode — if 'request', send a join request instead
    if (targetGroup.join_mode === 'request') {
      // Check existing request
      const { data: existingReq } = await (supabase.from('group_join_requests') as any)
        .select('id, status')
        .eq('group_id', targetGroup.id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingReq) {
        if (existingReq.status === 'pending') {
          setJoinError('You already have a pending request for this group.')
        } else if (existingReq.status === 'rejected') {
          setJoinError('Your previous request was declined.')
        }
        setIsJoining(false)
        return
      }

      const { error: reqError } = await (supabase.from('group_join_requests') as any).insert({
        group_id: targetGroup.id,
        user_id: user.id,
      })

      if (reqError) {
        setJoinError('Failed to send join request. Try again.')
        setIsJoining(false)
        return
      }

      // Notify group admin
      try {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
        await fetch('/api/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupId: targetGroup.id,
            type: 'join_request',
            title: 'Join Request',
            message: `${profile?.full_name || 'Someone'} wants to join ${targetGroup.name}`,
          }),
        })
      } catch { /* silent */ }

      setJoinError('Request sent! The group admin will review it.')
      setIsJoining(false)
      return
    }

    // Join group
    const { error } = await (supabase.from('group_members') as any).insert({
      group_id: targetGroup.id,
      user_id: user.id,
      role: 'member',
    })

    if (error) {
      setJoinError('Failed to join group. Try again.')
      setIsJoining(false)
      return
    }

    router.push(`/groups/${targetGroup.id}`)
  }

  function copyInviteCode() {
    if (createdGroup) {
      navigator.clipboard.writeText(createdGroup.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Wait for profile check
  if (profileComplete === null || profileComplete === false) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Step 4: Success
  if (step === 4 && createdGroup) {
    return (
      <div className="px-5 pt-14 pb-4">
        <div className="flex flex-col items-center text-center pt-8">
          <div className="h-16 w-16 rounded-2xl bg-success/10 flex items-center justify-center mb-4">
            <Check className="h-8 w-8 text-success" />
          </div>
          <h2 className="text-xl font-bold mb-1">Group Created!</h2>
          <p className="text-sm text-muted-foreground mb-2 max-w-[280px]">
            &quot;{createdGroup.name}&quot; is ready.
            {selectedFriends.size > 0 && ` ${selectedFriends.size} friend${selectedFriends.size > 1 ? 's' : ''} added/invited.`}
          </p>

          {/* Invite Code */}
          <Card className="w-full mb-4">
            <p className="text-xs text-muted-foreground mb-2">Invite Code</p>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-mono font-bold tracking-[0.3em]">
                {createdGroup.invite_code}
              </p>
              <Button size="sm" variant="secondary" onClick={copyInviteCode}>
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </Card>

          <div className="flex flex-col gap-2 w-full">
            <Button fullWidth onClick={() => router.push(`/groups/${createdGroup.id}`)}>
              Go to Group
            </Button>
            <Button
              variant="ghost"
              fullWidth
              onClick={() => {
                const text = `Join my group "${createdGroup.name}" on Equilibrium! Code: ${createdGroup.invite_code}`
                if (navigator.share) {
                  navigator.share({ text })
                } else {
                  navigator.clipboard.writeText(text)
                }
              }}
            >
              Share Invite
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const stepCount = joinMode ? 0 : 3
  const filteredFriends = friendsList.filter((f: any) =>
    !friendSearch.trim() ||
    f.profile?.full_name?.toLowerCase().includes(friendSearch.toLowerCase()) ||
    f.profile?.email?.toLowerCase().includes(friendSearch.toLowerCase())
  )

  return (
    <div className="px-5 pt-14 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => {
            if (joinMode) setJoinMode(false)
            else if (step > 1) setStep(step - 1)
            else router.back()
          }}
          className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-bold">
          {joinMode ? 'Join Group' : 'New Group'}
        </h1>
      </div>

      {/* Step Indicator */}
      {!joinMode && (
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map(s => (
            <div key={s} className={`flex-1 h-1 rounded-full ${step >= s ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>
      )}

      {/* Toggle (only on step 1) */}
      {!joinMode && step === 1 && (
        <div className="flex gap-2 mb-6">
          <Button variant="primary" size="sm" className="flex-1" onClick={() => setJoinMode(false)}>
            Create New
          </Button>
          <Button variant="secondary" size="sm" className="flex-1" onClick={() => setJoinMode(true)}>
            Join Existing
          </Button>
        </div>
      )}

      {/* Join Mode */}
      {joinMode ? (
        <div className="flex flex-col gap-4">
          <Input
            label="Invite Code"
            placeholder="E.g. ABC123"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            error={joinError}
            className="text-center text-lg tracking-[0.2em] font-mono"
          />
          <Button fullWidth size="lg" onClick={handleJoin} isLoading={isJoining} disabled={inviteCode.length < 4}>
            Join Group
          </Button>
        </div>
      ) : (
        <>
          {/* ═══ Step 1: Select Friends ═══ */}
          {step === 1 && (
            <div className="flex flex-col gap-4 animate-fade-in">
              <div>
                <p className="text-sm font-medium mb-1">Select Members</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Choose at least one friend to add to this group.
                </p>
              </div>

              {friendsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : friendsList.length > 0 ? (
                <>
                  {friendsList.length > 3 && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={friendSearch}
                        onChange={(e) => setFriendSearch(e.target.value)}
                        placeholder="Search friends..."
                        className="w-full rounded-xl border border-border bg-muted pl-9 pr-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  )}

                  {selectedFriends.size > 0 && (
                    <p className="text-xs text-primary font-medium">
                      {selectedFriends.size} friend{selectedFriends.size > 1 ? 's' : ''} selected
                    </p>
                  )}

                  <div className="flex flex-col gap-1.5 max-h-[50vh] overflow-y-auto">
                    {filteredFriends.map((friend: any) => {
                      const isSelected = selectedFriends.has(friend.friendId)
                      return (
                        <button
                          key={friend.friendId}
                          onClick={() => toggleFriendSelection(friend.friendId)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                            isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-muted/50 hover:bg-muted'
                          }`}
                        >
                          <div className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-primary border-primary' : 'border-border'
                          }`}>
                            {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                          </div>
                          <Avatar name={friend.profile?.full_name || '?'} imageUrl={friend.profile?.avatar_url} size="sm" />
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-medium truncate">{friend.profile?.full_name}</p>
                          </div>
                          {!friend.allowDirectAdd && (
                            <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">Invite only</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : (
                <Card className="text-center py-6" padding="md">
                  <Users className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium mb-1">No friends yet</p>
                  <p className="text-xs text-muted-foreground mb-3">Add friends first to include them in your group</p>
                  <Button size="sm" onClick={() => router.push('/friends')}>
                    <UserPlus className="h-3.5 w-3.5" /> Add Friends
                  </Button>
                </Card>
              )}

              <Button fullWidth size="lg" onClick={() => setStep(2)} disabled={selectedFriends.size === 0}>
                {`Next — ${selectedFriends.size} selected`}
              </Button>
            </div>
          )}

          {/* ═══ Step 2: Name, Description, Image ═══ */}
          {step === 2 && (
            <div className="flex flex-col gap-5 animate-fade-in">
              {/* Image Upload Banner */}
              <div>
                <p className="text-sm font-medium mb-3">Group Image <span className="text-muted-foreground font-normal">(optional)</span></p>
                <button
                  onClick={() => imageFileRef.current?.click()}
                  className="w-full h-32 rounded-2xl border-2 border-dashed border-border bg-muted/50 flex flex-col items-center justify-center gap-2 overflow-hidden transition-all hover:border-primary/50"
                >
                  {imagePreview ? (
                    <div className="relative w-full h-full">
                      <img src={imagePreview} alt="Group" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <p className="text-xs text-white font-medium">Change Image</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <ImagePlus className="h-6 w-6 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Tap to add a group image</p>
                    </>
                  )}
                </button>
                <input
                  ref={imageFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImagePick}
                />
                {imagePreview && (
                  <button
                    onClick={() => { setImageFile(null); setImagePreview(null) }}
                    className="text-xs text-destructive mt-2"
                  >
                    Remove image
                  </button>
                )}
              </div>

              <Input
                label="Group Name"
                placeholder="e.g. Flat 402, Goa Trip Jan'26"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <Input
                label="Description (optional)"
                placeholder="What's this group for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <Button fullWidth size="lg" onClick={() => setStep(3)} disabled={!name.trim()}>
                Next
              </Button>
            </div>
          )}

          {/* ═══ Step 3: Group Type & Nudge Vibe ═══ */}
          {step === 3 && (
            <div className="flex flex-col gap-5 animate-fade-in">
              {/* Group Type */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-sm font-medium">Group Type</p>
                  <button
                    onClick={() => setShowTypeInfo(!showTypeInfo)}
                    className="h-4 w-4 rounded-full bg-muted flex items-center justify-center"
                  >
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
                {showTypeInfo && (
                  <Card className="mb-3 bg-muted/50" padding="sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-muted-foreground whitespace-pre-line">{GROUP_TYPE_INFO}</p>
                      <button onClick={() => setShowTypeInfo(false)} className="shrink-0 mt-0.5">
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </Card>
                )}
                <div className="flex flex-col gap-2">
                  {MODES.map((m) => {
                    const ModeIcon = m.Icon
                    return (
                      <Card
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        className={`${mode === m.id ? 'ring-2 ring-primary border-primary' : ''}`}
                        padding="md"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                            <ModeIcon className={`h-4 w-4 ${mode === m.id ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{m.label}</p>
                            <p className="text-xs text-muted-foreground">{m.desc}</p>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </div>

              {/* Nudge Vibe */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-sm font-medium">Nudge Vibe</p>
                  <button
                    onClick={() => setShowNudgeInfo(!showNudgeInfo)}
                    className="h-4 w-4 rounded-full bg-muted flex items-center justify-center"
                  >
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
                {showNudgeInfo && (
                  <Card className="mb-3 bg-muted/50" padding="sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-muted-foreground whitespace-pre-line">{NUDGE_VIBE_INFO}</p>
                      <button onClick={() => setShowNudgeInfo(false)} className="shrink-0 mt-0.5">
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </Card>
                )}
                <div className="flex flex-col gap-2">
                  {PERSONALITIES.map((p) => {
                    const PIcon = p.Icon
                    return (
                      <Card
                        key={p.id}
                        onClick={() => setPersonality(p.id)}
                        className={`${personality === p.id ? 'ring-2 ring-primary border-primary' : ''}`}
                        padding="md"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                            <PIcon className={`h-4 w-4 ${personality === p.id ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{p.label}</p>
                            <p className="text-xs text-muted-foreground">{p.desc}</p>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </div>

              <Button fullWidth size="lg" onClick={handleCreate} isLoading={isCreating}>
                Create Group
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
