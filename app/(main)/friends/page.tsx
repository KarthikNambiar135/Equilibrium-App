'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import Input from '@/components/ui/Input'
import { ArrowLeft, Search, UserPlus, Check, X, Clock, Users, Loader2, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface FriendEntry {
  id: string
  friendId: string
  profile: { id: string; full_name: string; email: string; avatar_url: string | null } | null
  since?: string
  sentAt?: string
}

interface SearchResult {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  friendStatus: 'friends' | 'sent' | 'received' | null
}

export default function FriendsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<'friends' | 'add'>('friends')
  const [friends, setFriends] = useState<FriendEntry[]>([])
  const [incoming, setIncoming] = useState<FriendEntry[]>([])
  const [outgoing, setOutgoing] = useState<FriendEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [sendingTo, setSendingTo] = useState<string | null>(null)

  // Action states
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  useEffect(() => {
    loadFriends()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 3) {
        searchUsers(searchQuery.trim())
      } else {
        setSearchResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  async function loadFriends() {
    setIsLoading(true)
    try {
      const res = await fetch('/api/friends')
      if (res.ok) {
        const data = await res.json()
        setFriends(data.friends || [])
        setIncoming(data.incoming || [])
        setOutgoing(data.outgoing || [])
      }
    } catch { /* silent */ }
    setIsLoading(false)
  }

  async function searchUsers(query: string) {
    setIsSearching(true)
    try {
      const res = await fetch(`/api/friends?action=search&q=${encodeURIComponent(query)}`)
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.users || [])
      }
    } catch { /* silent */ }
    setIsSearching(false)
  }

  async function sendRequest(addresseeId: string) {
    setSendingTo(addresseeId)
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresseeId }),
      })
      if (res.ok) {
        // Update search results to reflect sent status
        setSearchResults(prev => prev.map(u =>
          u.id === addresseeId ? { ...u, friendStatus: 'sent' as const } : u
        ))
        loadFriends() // Refresh outgoing
      }
    } catch { /* silent */ }
    setSendingTo(null)
  }

  async function acceptRequest(friendshipId: string) {
    setAcceptingId(friendshipId)
    try {
      const res = await fetch('/api/friends', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendshipId, action: 'accept' }),
      })
      if (res.ok) {
        loadFriends()
      }
    } catch { /* silent */ }
    setAcceptingId(null)
  }

  async function rejectOrCancel(friendshipId: string) {
    setRejectingId(friendshipId)
    try {
      const res = await fetch('/api/friends', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendshipId }),
      })
      if (res.ok) {
        loadFriends()
      }
    } catch { /* silent */ }
    setRejectingId(null)
  }

  if (isLoading) {
    return (
      <div className="px-5 pt-14 pb-4 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm px-5 pt-14 pb-3">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-xl font-bold">Friends</h1>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-1 bg-muted rounded-xl p-1">
        <button
          onClick={() => setTab('friends')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === 'friends' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
        >
          <Users className="h-4 w-4 inline mr-1" />
          Friends {friends.length > 0 && `(${friends.length})`}
        </button>
        <button
          onClick={() => setTab('add')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === 'add' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
        >
          <UserPlus className="h-4 w-4 inline mr-1" />
          Add Friend
        </button>
      </div>
      </div>

      <div className="px-5">
      {tab === 'friends' && (
        <div className="flex flex-col gap-4">
          {/* Pending Incoming Requests */}
          {incoming.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Incoming Requests ({incoming.length})
              </p>
              <div className="flex flex-col gap-2">
                {incoming.map((req) => (
                  <Card key={req.id} padding="md">
                    <div className="flex items-center gap-3">
                      <Avatar name={req.profile?.full_name || '?'} imageUrl={req.profile?.avatar_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{req.profile?.full_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground truncate">{req.profile?.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => acceptRequest(req.id)}
                          disabled={acceptingId === req.id}
                          className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center text-success hover:bg-success/20 transition-colors disabled:opacity-50"
                        >
                          {acceptingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => rejectOrCancel(req.id)}
                          disabled={rejectingId === req.id}
                          className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                        >
                          {rejectingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Pending Outgoing Requests */}
          {outgoing.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Pending Sent ({outgoing.length})
              </p>
              <div className="flex flex-col gap-2">
                {outgoing.map((req) => (
                  <Card key={req.id} padding="sm">
                    <div className="flex items-center gap-3">
                      <Avatar name={req.profile?.full_name || '?'} imageUrl={req.profile?.avatar_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{req.profile?.full_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground truncate">{req.profile?.email}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-warning" />
                        <span className="text-[10px] text-warning font-medium">Pending</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Friends List */}
          <div>
            {(incoming.length > 0 || outgoing.length > 0) && friends.length > 0 && (
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Your Friends ({friends.length})
              </p>
            )}
            {friends.length > 0 ? (
              <div className="flex flex-col gap-2">
                {friends.map((friend) => (
                  <Card key={friend.id} padding="md">
                    <div className="flex items-center gap-3">
                      <Avatar name={friend.profile?.full_name || '?'} imageUrl={friend.profile?.avatar_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{friend.profile?.full_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground truncate">{friend.profile?.email}</p>
                      </div>
                      <button
                        onClick={() => rejectOrCancel(friend.id)}
                        disabled={rejectingId === friend.id}
                        className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50 shrink-0"
                        title="Remove friend"
                      >
                        {rejectingId === friend.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : incoming.length === 0 && outgoing.length === 0 ? (
              <Card className="text-center py-8">
                <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-semibold mb-1">No friends yet</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Search by email to add your first friend
                </p>
                <Button size="sm" onClick={() => setTab('add')}>
                  <UserPlus className="h-4 w-4" /> Add Friend
                </Button>
              </Card>
            ) : null}
          </div>
        </div>
      )}

      {tab === 'add' && (
        <div className="flex flex-col gap-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="email"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by email (min 3 chars)..."
              className="w-full rounded-xl border border-border bg-background pl-10 pr-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              autoFocus
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="flex flex-col gap-2">
              {searchResults.map((u) => (
                <Card key={u.id} padding="md">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.full_name} imageUrl={u.avatar_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{u.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <div className="shrink-0">
                      {u.friendStatus === 'friends' ? (
                        <span className="text-[10px] bg-success/10 text-success px-2 py-1 rounded-full font-medium">Friends</span>
                      ) : u.friendStatus === 'sent' ? (
                        <span className="text-[10px] bg-warning/10 text-warning px-2 py-1 rounded-full font-medium">Sent</span>
                      ) : u.friendStatus === 'received' ? (
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">Accept?</span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => sendRequest(u.id)}
                          isLoading={sendingTo === u.id}
                          disabled={!!sendingTo}
                        >
                          <UserPlus className="h-3.5 w-3.5" /> Add
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {searchQuery.trim().length >= 3 && !isSearching && searchResults.length === 0 && (
            <Card className="text-center py-6">
              <p className="text-sm text-muted-foreground">No users found with that email</p>
            </Card>
          )}

          {searchQuery.trim().length < 3 && searchQuery.trim().length > 0 && (
            <p className="text-xs text-center text-muted-foreground">Type at least 3 characters to search</p>
          )}
        </div>
      )}
      </div>
    </div>
  )
}
