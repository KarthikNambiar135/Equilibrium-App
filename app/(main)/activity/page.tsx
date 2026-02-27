'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import Avatar from '@/components/ui/Avatar'
import Modal from '@/components/ui/Modal'
import CategoryIcon from '@/components/ui/CategoryIcon'
import { Receipt, ArrowRight, ArrowLeft, Users, Calendar, Banknote, Tag } from 'lucide-react'
import VideoLoader from '@/components/ui/VideoLoader'
import { formatINR } from '@/lib/utils/settlement'
import { formatRelativeDate } from '@/lib/utils/formatters'

export default function ActivityPage() {
  const supabase = createClient()
  const [activities, setActivities] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<any | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  useEffect(() => {
    async function loadActivity() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      const { data: memberData } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)

      if (!memberData || memberData.length === 0) {
        setIsLoading(false)
        return
      }

      const groupIds = (memberData as any[]).map((m: any) => m.group_id)

      const { data: expenses } = await supabase
        .from('expenses')
        .select('*, profiles!expenses_paid_by_fkey(full_name, avatar_url), groups(name, emoji, terminated_at), expense_splits(user_id, amount, profiles(full_name, avatar_url))')
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })
        .limit(30)

      const { data: settlements } = await supabase
        .from('settlements')
        .select(`
          *,
          groups(name, emoji, terminated_at),
          from_profile:profiles!settlements_from_user_fkey(full_name, avatar_url),
          to_profile:profiles!settlements_to_user_fkey(full_name, avatar_url)
        `)
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })
        .limit(20)

      const allActivities = [
        ...(expenses || []).map((e: any) => ({ ...e, type: 'expense' })),
        ...(settlements || []).map((s: any) => ({ ...s, type: 'settlement' })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setActivities(allActivities)
      setIsLoading(false)
    }

    loadActivity()
  }, [supabase])

  const router = useRouter()

  if (isLoading) {
    return <VideoLoader />
  }

  return (
    <div className="pb-4">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm px-5 pt-14 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1 -ml-1 rounded-lg hover:bg-muted active:scale-95 transition-all">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold">Activity</h1>
        </div>
      </div>

      <div className="px-5">
        {activities.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-7 w-7" />}
            title="No activity yet"
            description="Start adding expenses in your groups to see activity here"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {activities.map((item) => (
              <Card
                key={`${item.type}-${item.id}`}
                padding="sm"
                onClick={() => setSelectedItem(item)}
                className="cursor-pointer active:scale-[0.98] transition-transform"
              >
                {item.type === 'expense' ? (
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={item.profiles?.full_name || 'User'}
                      imageUrl={item.profiles?.avatar_url}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.profiles?.full_name} · {item.groups?.name}
                        {item.groups?.terminated_at && (
                          <span className="ml-1 text-[9px] bg-destructive/10 text-destructive px-1 py-0.5 rounded-full font-medium">Terminated</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatINR(item.amount)}</p>
                      <p className="text-[10px] text-muted-foreground">{formatRelativeDate(item.created_at)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                      <ArrowRight className="h-3.5 w-3.5 text-success" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {item.from_profile?.full_name} → {item.to_profile?.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Settlement · {item.groups?.name}
                        {item.groups?.terminated_at && (
                          <span className="ml-1 text-[9px] bg-destructive/10 text-destructive px-1 py-0.5 rounded-full font-medium">Terminated</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-success">{formatINR(item.amount)}</p>
                      <p className="text-[10px] text-muted-foreground">{formatRelativeDate(item.created_at)}</p>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.type === 'expense' ? 'Expense Details' : 'Settlement Details'}
      >
        {selectedItem?.type === 'expense' && (
          <div className="px-5 pb-6 flex flex-col gap-4">
            <div className="flex items-center gap-3 pt-2">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <CategoryIcon name={selectedItem.category || 'package'} className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold">{selectedItem.title}</p>
                <p className="text-2xl font-black text-primary">{formatINR(selectedItem.amount)}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 bg-muted/40 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center shrink-0">
                  <Banknote className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Paid by</p>
                  <p className="text-sm font-medium">{selectedItem.profiles?.full_name || 'Unknown'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center shrink-0">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Group</p>
                  <p className="text-sm font-medium">{selectedItem.groups?.name || 'Unknown'}</p>
                </div>
              </div>
              {selectedItem.category && (
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center shrink-0">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Category</p>
                    <p className="text-sm font-medium capitalize">{selectedItem.category}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center shrink-0">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Date</p>
                  <p className="text-sm font-medium">
                    {new Date(selectedItem.date || selectedItem.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>

            {selectedItem.expense_splits?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Split Between</p>
                <div className="flex flex-col gap-0.5">
                  {selectedItem.expense_splits.map((split: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
                      <div className="flex items-center gap-2">
                        <Avatar
                          name={split.profiles?.full_name || 'User'}
                          imageUrl={split.profiles?.avatar_url}
                          size="sm"
                        />
                        <p className="text-sm">
                          {split.profiles?.full_name || 'Unknown'}
                          {split.user_id === currentUserId && (
                            <span className="ml-1 text-[10px] text-primary font-medium">(you)</span>
                          )}
                        </p>
                      </div>
                      <p className="text-sm font-semibold">{formatINR(split.amount)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {selectedItem?.type === 'settlement' && (
          <div className="px-5 pb-6 flex flex-col gap-4">
            <div className="flex items-center gap-3 pt-2">
              <div className="h-12 w-12 rounded-2xl bg-success/10 flex items-center justify-center shrink-0">
                <ArrowRight className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Settlement</p>
                <p className="text-2xl font-black text-success">{formatINR(selectedItem.amount)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-success/5 border border-success/20 rounded-2xl p-4">
              <div className="flex-1 text-center">
                <Avatar
                  name={selectedItem.from_profile?.full_name || 'User'}
                  imageUrl={selectedItem.from_profile?.avatar_url}
                  size="sm"
                />
                <p className="text-xs font-medium mt-1">{selectedItem.from_profile?.full_name}</p>
                <p className="text-[10px] text-muted-foreground">paid</p>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <ArrowRight className="h-5 w-5 text-success" />
                <p className="text-xs font-bold text-success">{formatINR(selectedItem.amount)}</p>
              </div>
              <div className="flex-1 text-center">
                <Avatar
                  name={selectedItem.to_profile?.full_name || 'User'}
                  imageUrl={selectedItem.to_profile?.avatar_url}
                  size="sm"
                />
                <p className="text-xs font-medium mt-1">{selectedItem.to_profile?.full_name}</p>
                <p className="text-[10px] text-muted-foreground">received</p>
              </div>
            </div>

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
