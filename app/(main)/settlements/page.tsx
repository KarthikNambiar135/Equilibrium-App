'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import Avatar from '@/components/ui/Avatar'
import Modal from '@/components/ui/Modal'
import { ArrowRight, ArrowLeft, Users, Calendar, Receipt } from 'lucide-react'
import { formatINR } from '@/lib/utils/settlement'
import { useRouter } from 'next/navigation'

import VideoLoader from '@/components/ui/VideoLoader'

export default function SettlementsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [settlements, setSettlements] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<any | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  useEffect(() => {
    async function loadSettlements() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      // Only settlements where the user is involved (as payer or receiver)
      const { data: sent } = await supabase
        .from('settlements')
        .select(`
          *,
          groups(name, emoji, terminated_at),
          from_profile:profiles!settlements_from_user_fkey(full_name, avatar_url),
          to_profile:profiles!settlements_to_user_fkey(full_name, avatar_url)
        `)
        .eq('from_user', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      const { data: received } = await supabase
        .from('settlements')
        .select(`
          *,
          groups(name, emoji, terminated_at),
          from_profile:profiles!settlements_from_user_fkey(full_name, avatar_url),
          to_profile:profiles!settlements_to_user_fkey(full_name, avatar_url)
        `)
        .eq('to_user', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      // Merge unique settlements sorted by date
      const allMap = new Map<string, any>()
      ;[...(sent || []), ...(received || [])].forEach((s) => allMap.set(s.id, s))
      const all = Array.from(allMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setSettlements(all)
      setIsLoading(false)
    }

    loadSettlements()
  }, [supabase])

  if (isLoading) {
    return <VideoLoader />
  }

  return (
    <div className="pb-4">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm px-5 pt-14 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-xl font-bold">Settlements</h1>
        </div>
      </div>

      <div className="px-5">
        {settlements.length === 0 ? (
          <EmptyState
            icon={<ArrowRight className="h-7 w-7" />}
            title="No settlements yet"
            description="Settlements you make or receive will appear here"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {settlements.map((item) => {
              const iSent = item.from_user === currentUserId
              return (
                <Card
                  key={item.id}
                  padding="sm"
                  onClick={() => setSelectedItem(item)}
                  className="cursor-pointer active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${iSent ? 'bg-destructive/10' : 'bg-success/10'}`}>
                      <ArrowRight className={`h-4 w-4 ${iSent ? 'text-destructive' : 'text-success'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {iSent
                          ? `You → ${item.to_profile?.full_name}`
                          : `${item.from_profile?.full_name} → You`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.groups?.name}
                        {item.groups?.terminated_at && (
                          <span className="ml-1 text-[9px] bg-destructive/10 text-destructive px-1 py-0.5 rounded-full font-medium">Terminated</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${iSent ? 'text-destructive' : 'text-success'}`}>
                        {iSent ? '-' : '+'}{formatINR(item.amount)}
                      </p>
                      <p className="text-[10px] text-muted-foreground capitalize">{item.status}</p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title="Settlement Details"
      >
        {selectedItem && (
          <div className="px-5 pb-6 flex flex-col gap-4">
            {/* Amount header */}
            <div className="flex items-center gap-3 pt-2">
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${selectedItem.from_user === currentUserId ? 'bg-destructive/10' : 'bg-success/10'}`}>
                <ArrowRight className={`h-5 w-5 ${selectedItem.from_user === currentUserId ? 'text-destructive' : 'text-success'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {selectedItem.from_user === currentUserId ? 'You paid' : 'You received'}
                </p>
                <p className={`text-2xl font-black ${selectedItem.from_user === currentUserId ? 'text-destructive' : 'text-success'}`}>
                  {formatINR(selectedItem.amount)}
                </p>
              </div>
            </div>

            {/* Transfer visual */}
            <div className="flex items-center gap-3 bg-muted/30 rounded-2xl p-4">
              <div className="flex-1 text-center">
                <Avatar
                  name={selectedItem.from_profile?.full_name || 'User'}
                  imageUrl={selectedItem.from_profile?.avatar_url}
                  size="sm"
                />
                <p className="text-xs font-medium mt-1 truncate">
                  {selectedItem.from_user === currentUserId ? 'You' : selectedItem.from_profile?.full_name}
                </p>
                <p className="text-[10px] text-muted-foreground">paid</p>
              </div>
              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <ArrowRight className="h-5 w-5 text-primary" />
                <p className="text-xs font-bold text-primary">{formatINR(selectedItem.amount)}</p>
              </div>
              <div className="flex-1 text-center">
                <Avatar
                  name={selectedItem.to_profile?.full_name || 'User'}
                  imageUrl={selectedItem.to_profile?.avatar_url}
                  size="sm"
                />
                <p className="text-xs font-medium mt-1 truncate">
                  {selectedItem.to_user === currentUserId ? 'You' : selectedItem.to_profile?.full_name}
                </p>
                <p className="text-[10px] text-muted-foreground">received</p>
              </div>
            </div>

            {/* Info rows */}
            <div className="flex flex-col gap-3 bg-muted/40 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center shrink-0">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Group</p>
                  <p className="text-sm font-medium">{selectedItem.groups?.name || 'Unknown'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center shrink-0">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Date</p>
                  <p className="text-sm font-medium">
                    {new Date(selectedItem.settled_at || selectedItem.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center shrink-0">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Status</p>
                  <p className={`text-sm font-medium capitalize ${selectedItem.status === 'completed' ? 'text-success' : 'text-warning'}`}>
                    {selectedItem.status}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
