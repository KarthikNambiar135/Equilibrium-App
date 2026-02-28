'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import {
  ArrowLeft,
  Plus,
  Users,
  Receipt,
  TrendingUp,
  Copy,
  Check,
  Crown,
  Bell,
  Send,
  Calendar,
  Image as ImageIcon,
  PartyPopper,
  LogOut,
  AlertTriangle,
  Edit3,
  Trash2,
  Target,
  ShieldCheck,
  FileText,
  Paperclip,
  X,
  Settings,
  UserPlus,
  Loader2,
  Search,
  Ban,
  ToggleLeft,
  ToggleRight,
  Scale,
  CreditCard,
  Zap,
  Pencil,
  Lightbulb,
  CircleDot,
  CheckCircle2,
  Package,
  Home,
  Plane,
  MoreVertical,
  UserCircle,
  UserMinus,
  Clock,
  ChevronDown,
  ImagePlus,
  Smile,
  Briefcase,
  Flame,
  QrCode,
  Download,
  Share2,
  RefreshCw,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Capacitor } from '@capacitor/core'
import WhatsAppIcon from '@/components/icons/WhatsAppIcon'
import CategoryIcon from '@/components/ui/CategoryIcon'
import { formatINR } from '@/lib/utils/settlement'
import {
  buildDebtEdges,
  getOptimalSettlements,
  getCheapestSettlements,
} from '@/lib/utils/settlement'
import { formatRelativeDate, EXPENSE_CATEGORIES, TRIP_CATEGORIES, formatCurrency, generateInviteCode } from '@/lib/utils/formatters'
import type { Profile, Group, Settlement, SettlementSuggestion, ExpenseIssue } from '@/lib/types/database'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { getContributorText } from '@/lib/utils/text-picker-client'

const REACTION_EMOJIS = ['👍', '😂', '💀', '🔥', '😤', '❤️']

type Tab = 'expenses' | 'balances' | 'members'

import VideoLoader from '@/components/ui/VideoLoader'

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<(Profile & { role: string; left_at?: string | null })[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [reactions, setReactions] = useState<Map<string, { emoji: string; user_id: string; id: string }[]>>(new Map())
  const [currentUser, setCurrentUser] = useState<string>('')
  const [activeTab, setActiveTab] = useState<Tab>('expenses')
  const [isLoading, setIsLoading] = useState(true)
  const [showSettleModal, setShowSettleModal] = useState(false)
  const [showCloseTripModal, setShowCloseTripModal] = useState(false)
  const [showRecapModal, setShowRecapModal] = useState(false)
  const [showReactPicker, setShowReactPicker] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [fastestSettlements, setFastestSettlements] = useState<SettlementSuggestion[]>([])
  const [cheapestResult, setCheapestResult] = useState<{
    settlements: SettlementSuggestion[]
    carriedForward: number
  } | null>(null)
  const [settleMode, setSettleMode] = useState<'all' | 'custom'>('all')
  const [customSelected, setCustomSelected] = useState<Set<number>>(new Set()) // indices of selected suggestions
  const [reminderText, setReminderText] = useState('')
  const [contributorText, setContributorText] = useState('')
  const [reminderSent, setReminderSent] = useState<string | null>(null)
  const [reminderLoading, setReminderLoading] = useState<string | null>(null)
  const [isPayingId, setIsPayingId] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState('')
  const [showBalanceDetail, setShowBalanceDetail] = useState<string | null>(null) // user id

  // Expense issues / conflicts
  const [expenseIssues, setExpenseIssues] = useState<(ExpenseIssue & { profiles?: { full_name: string } })[]>([])
  const [showIssueModal, setShowIssueModal] = useState<string | null>(null) // expense id
  const [showIssueDetailModal, setShowIssueDetailModal] = useState<string | null>(null) // expense id
  const [issueDescription, setIssueDescription] = useState('')
  const [issueSaving, setIssueSaving] = useState(false)
  // Edit conflicted expense
  const [showEditExpenseModal, setShowEditExpenseModal] = useState<any | null>(null) // expense object
  const [editForm, setEditForm] = useState({ title: '', amount: '', category: '' })
  const [editProofFile, setEditProofFile] = useState<File | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  // Trip spend limit
  const [spendLimit, setSpendLimit] = useState<number | null>(null)
  const [showSpendLimitModal, setShowSpendLimitModal] = useState(false)
  const [spendLimitInput, setSpendLimitInput] = useState('')
  const [spendLimitSaving, setSpendLimitSaving] = useState(false)
  // Invite friends to group
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteFriends, setInviteFriends] = useState<any[]>([])
  const [inviteFriendsLoading, setInviteFriendsLoading] = useState(false)
  const [inviteSearch, setInviteSearch] = useState('')
  const [invitingFriendId, setInvitingFriendId] = useState<string | null>(null)
  const [invitedFriends, setInvitedFriends] = useState<Set<string>>(new Set())
  // Group settings
  const [showGroupSettings, setShowGroupSettings] = useState(false)
  const [debtLimit, setDebtLimit] = useState<number | null>(null)
  const [debtLimitInput, setDebtLimitInput] = useState('')
  const [debtLimitSaving, setDebtLimitSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  // Member limit & Join mode
  const [memberLimit, setMemberLimit] = useState<number>(30)
  const [memberLimitInput, setMemberLimitInput] = useState('30')
  const [memberLimitSaving, setMemberLimitSaving] = useState(false)
  const [joinMode, setJoinMode] = useState<'open' | 'request'>('open')
  const [joinModeSaving, setJoinModeSaving] = useState(false)
  // Group edit state (owner only)
  const [editGroupName, setEditGroupName] = useState('')
  const [editGroupPersonality, setEditGroupPersonality] = useState<'chill' | 'formal' | 'roast'>('chill')
  const [editGroupImageFile, setEditGroupImageFile] = useState<File | null>(null)
  const [editGroupImagePreview, setEditGroupImagePreview] = useState<string | null>(null)
  const [editGroupSaving, setEditGroupSaving] = useState(false)
  // Terminate & Leave
  const [showTerminateModal, setShowTerminateModal] = useState(false)
  const [terminateConfirmName, setTerminateConfirmName] = useState('')
  const [isTerminating, setIsTerminating] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState('')
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferToId, setTransferToId] = useState<string>('')
  const [isTransferring, setIsTransferring] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleteLeaving, setIsDeleteLeaving] = useState(false)
  // Trip ended toggle
  const [tripEndedToggle, setTripEndedToggle] = useState(false)
  const [tripEndedSaving, setTripEndedSaving] = useState(false)
  // Member triple-dot menu
  const [openMemberMenu, setOpenMemberMenu] = useState<string | null>(null)
  const [memberFriendStatuses, setMemberFriendStatuses] = useState<Record<string, 'friends' | 'sent' | 'none'>>({})
  const [memberActionLoading, setMemberActionLoading] = useState<string | null>(null)
  const [showPastMembers, setShowPastMembers] = useState(false)
  // QR code modal
  const [showQrModal, setShowQrModal] = useState(false)
  const [qrRefreshing, setQrRefreshing] = useState(false)
  // Scroll tracking for banner
  const [scrollY, setScrollY] = useState(0)
  const BANNER_HEIGHT = 280

  const isTrip = group?.mode === 'trip'
  const isImage = group?.emoji?.startsWith('http')
  const categories = isTrip ? TRIP_CATEGORIES : EXPENSE_CATEGORIES
  const activeMembers = members.filter(m => !m.left_at)
  const pastMembers = members.filter(m => !!m.left_at)
  const myMembership = members.find(m => m.id === currentUser)
  const myLeftAt = myMembership?.left_at || null

  // Load Razorpay checkout script
  useEffect(() => {
    if (document.getElementById('razorpay-script')) return
    const script = document.createElement('script')
    script.id = 'razorpay-script'
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    document.body.appendChild(script)
  }, [])

  // Track scroll for banner header transition
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const loadGroupData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUser(user.id)

    const { data: groupData } = await supabase.from('groups').select('*').eq('id', id).single()
    if (groupData) setGroup(groupData)

    const { data: memberData } = await supabase
      .from('group_members')
      .select('role, user_id, left_at, profiles(*)')
      .eq('group_id', id)

    if (memberData) {
      setMembers(memberData.map((md: any) => ({ ...md.profiles, role: md.role, left_at: md.left_at })))
    }

    // Check if current user has left the group (for filtering data)
    const myMemberRow = memberData?.find((md: any) => md.user_id === user.id)
    const userLeftAt = myMemberRow?.left_at || null

    let expenseQuery = supabase
      .from('expenses')
      .select('*, profiles!expenses_paid_by_fkey(full_name, avatar_url), expense_splits(user_id, amount)')
      .eq('group_id', id)
    if (userLeftAt) {
      expenseQuery = expenseQuery.lte('created_at', userLeftAt)
    }
    const { data: expenseData } = await expenseQuery
      .order('date', { ascending: true })
      .order('created_at', { ascending: false })

    if (expenseData) setExpenses(expenseData)

    // Load reactions
    if (expenseData && expenseData.length > 0) {
      const { data: reactionData } = await supabase
        .from('expense_reactions')
        .select('*')
        .in('expense_id', expenseData.map((e: any) => e.id))

      if (reactionData) {
        const rMap = new Map<string, any[]>()
        reactionData.forEach((r: any) => {
          const arr = rMap.get(r.expense_id) || []
          arr.push(r)
          rMap.set(r.expense_id, arr)
        })
        setReactions(rMap)
      }
    }

    let settlementQuery = supabase.from('settlements').select('*').eq('group_id', id)
    if (userLeftAt) {
      settlementQuery = settlementQuery.lte('created_at', userLeftAt)
    }
    const { data: settlementData } = await settlementQuery
    if (settlementData) setSettlements(settlementData)

    // Load expense issues
    try {
      const issuesRes = await fetch(`/api/expenses/issues?groupId=${id}`)
      if (issuesRes.ok) {
        const issuesData = await issuesRes.json()
        setExpenseIssues(issuesData.issues || [])
      }
    } catch { /* silent */ }

    // Load trip spend limit
    try {
      const limitRes = await fetch(`/api/trip/spend-limit?groupId=${id}`)
      if (limitRes.ok) {
        const limitData = await limitRes.json()
        setSpendLimit(limitData?.spend_limit ?? null)
      }
    } catch { /* silent */ }

    // Settlement suggestions — exclude conflicted expenses
    if (expenseData && memberData) {
      // Get ids of conflicted expenses (expenses with open issues)
      let conflictedIds = new Set<string>()
      try {
        const issuesRes2 = await fetch(`/api/expenses/issues?groupId=${id}`)
        if (issuesRes2.ok) {
          const issData = await issuesRes2.json()
          const openIssues = (issData.issues || []).filter((i: any) => i.status === 'open')
          openIssues.forEach((i: any) => conflictedIds.add(i.expense_id))
        }
      } catch { /* silent */ }

      const nonConflictedExpenses = expenseData.filter((e: any) => !conflictedIds.has(e.id))
      const users = memberData.map((md: any) => ({ id: md.profiles.id, name: md.profiles.full_name }))
      const { edges: debtEdges, expenseAges } = buildDebtEdges(
        nonConflictedExpenses.map((e: any) => ({ paid_by: e.paid_by, amount: e.amount, splits: e.expense_splits || [], created_at: e.created_at })),
        ((settlementData || []) as any[]).map((s) => ({ from_user: s.from_user, to_user: s.to_user, amount: s.amount, status: s.status }))
      )
      setFastestSettlements(getOptimalSettlements(debtEdges, users))
      setCheapestResult(getCheapestSettlements(debtEdges, users, 50, expenseAges))
    }

    setIsLoading(false)
  }, [id, supabase])

  useEffect(() => { loadGroupData() }, [loadGroupData])

  // Generate varied contributor text whenever expenses/members/group change
  useEffect(() => {
    if (group && expenses.length > 0 && members.length > 0) {
      const totals = new Map<string, number>()
      expenses.forEach((e) => {
        totals.set(e.paid_by, (totals.get(e.paid_by) || 0) + Number(e.amount))
      })
      let max = 0, topId = ''
      totals.forEach((total, uid) => { if (total > max) { max = total; topId = uid } })
      const member = members.find((m) => m.id === topId)
      if (member) {
        const vibe = (group as any).personality || 'chill'
        const text = getContributorText(vibe, {
          name: member.full_name,
          amount: formatINR(max),
        })
        setContributorText(text)
      }
    }
  }, [expenses, members, group])

  // ── Helpers ──

  function getUserBalances() {
    const balances = new Map<string, number>()
    members.forEach((m) => balances.set(m.id, 0))

    // Get set of conflicted expense IDs (those with open issues)
    const conflictedIds = new Set(
      expenseIssues.filter((i) => i.status === 'open').map((i) => i.expense_id)
    )

    expenses.forEach((exp) => {
      // Skip conflicted expenses
      if (conflictedIds.has(exp.id)) return
      ;(exp.expense_splits || []).forEach((split: any) => {
        if (split.user_id !== exp.paid_by) {
          balances.set(split.user_id, (balances.get(split.user_id) || 0) - Number(split.amount))
          balances.set(exp.paid_by, (balances.get(exp.paid_by) || 0) + Number(split.amount))
        }
      })
    })

    settlements.filter((s) => s.status === 'completed').forEach((s) => {
      balances.set(s.from_user, (balances.get(s.from_user) || 0) + Number(s.amount))
      balances.set(s.to_user, (balances.get(s.to_user) || 0) - Number(s.amount))
    })

    return members.map((m) => ({
      userId: m.id,
      name: m.full_name,
      avatarUrl: m.avatar_url || undefined,
      net: Math.round((balances.get(m.id) || 0) * 100) / 100,
    }))
  }

  function getTopContributor() {
    const totals = new Map<string, number>()
    let grandTotal = 0
    expenses.forEach((e) => {
      const amt = Number(e.amount)
      totals.set(e.paid_by, (totals.get(e.paid_by) || 0) + amt)
      grandTotal += amt
    })
    let max = 0, topId = ''
    totals.forEach((total, uid) => { if (total > max) { max = total; topId = uid } })
    if (!topId) return null
    const member = members.find((m) => m.id === topId)
    return member ? { name: member.full_name, total: max, percentage: grandTotal > 0 ? Math.round((max / grandTotal) * 100) : 0 } : null
  }

  function getTripTotal() {
    return expenses.reduce((s, e) => s + Number(e.amount), 0)
  }

  function getCategoryBreakdown() {
    const catMap = new Map<string, number>()
    expenses.forEach((e) => catMap.set(e.category || 'other', (catMap.get(e.category || 'other') || 0) + Number(e.amount)))
    const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16']
    return Array.from(catMap.entries())
      .map(([catId, value], i) => {
        const cat = [...TRIP_CATEGORIES, ...EXPENSE_CATEGORIES].find((c) => c.id === catId)
        return { name: cat?.label || catId, icon: cat?.icon || 'package', value: Math.round(value), color: COLORS[i % COLORS.length] }
      })
      .sort((a, b) => b.value - a.value)
  }

  function getExpensesByDay() {
    if (!expenses.length) return []
    const grouped = new Map<string, any[]>()
    expenses.forEach((e) => {
      const dk = e.date || e.created_at?.split('T')[0] || 'unknown'
      grouped.set(dk, [...(grouped.get(dk) || []), e])
    })
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, exps], i) => ({
        date,
        label: new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        dayNum: i + 1,
        expenses: exps,
      }))
  }

  function getTripStats() {
    const catCounts = new Map<string, number>()
    expenses.forEach((e) => catCounts.set(e.category || 'other', (catCounts.get(e.category || 'other') || 0) + 1))
    return {
      totalSpent: getTripTotal(),
      totalExpenses: expenses.length,
      totalDays: getExpensesByDay().length,
      perPerson: members.length > 0 ? Math.round(getTripTotal() / members.length) : 0,
      categoryCounts: catCounts,
    }
  }

  // ── Actions ──

  async function handleSettle(s: SettlementSuggestion) {
    setIsPayingId(`${s.from}-${s.to}`)
    setPaymentError('')

    try {
      // Get payee UPI ID
      const payeeProfile = members.find((m) => m.id === s.to)
      const payerProfile = members.find((m) => m.id === s.from)

      // Create Razorpay order via API (no settlement record created yet)
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: s.amount,
          toUserId: s.to,
          groupId: id,
          fromName: payerProfile?.full_name || s.fromName,
          toName: payeeProfile?.full_name || s.toName,
          toUpiId: (payeeProfile as any)?.upi_id || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create order')

      // Open Razorpay checkout
      const options: any = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'Equilibrium',
        description: `Settlement: ${s.fromName} → ${s.toName}`,
        order_id: data.orderId,
        prefill: {
          name: payerProfile?.full_name || '',
          email: (payerProfile as any)?.email || '',
          contact: (payerProfile as any)?.phone || '',
        },
        theme: { color: '#F07F3C' },
        handler: async function (response: any) {
          // Payment successful — verify signature & create settlement
          try {
            const verifyRes = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                groupId: id,
                toUserId: s.to,
                amount: s.amount,
              }),
            })

            const verifyData = await verifyRes.json()
            if (verifyRes.ok && verifyData.success) {
              // Settlement created & completed! Refresh data
              setShowSettleModal(false)
              loadGroupData()
              // Try earning equipoints for settlement
              try {
                await fetch('/api/equipoints', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'settlement' }),
                })
              } catch { /* silent */ }
              // Log honesty events — on-time settlement (paid immediately via Razorpay)
              try {
                await fetch('/api/honesty', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ eventType: 'settlement_ontime', groupId: id, description: `Settled ₹${s.amount} to ${s.toName} on time` }),
                })
                await fetch('/api/honesty', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ eventType: 'clean_settlement', groupId: id, description: `Clean settlement of ₹${s.amount}` }),
                })
              } catch { /* silent */ }
            } else {
              setPaymentError('Payment received but verification failed. It will auto-update shortly.')
              loadGroupData()
            }
          } catch {
            setPaymentError('Verification failed. Payment will auto-confirm via webhook.')
            loadGroupData()
          }
          setIsPayingId(null)
        },
        modal: {
          ondismiss: function () {
            // User cancelled — no settlement was created, so nothing to clean up
            setIsPayingId(null)
          },
        },
      }

      // Pre-fill payer's own UPI ID (so they can pay from it)
      const payerUpi = (payerProfile as any)?.upi_id
      if (payerUpi) {
        options.prefill.vpa = payerUpi
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.on('payment.failed', function (response: any) {
        console.error('[Razorpay] Payment failed:', response.error)
        setPaymentError(`Payment failed: ${response.error?.description || 'Unknown error'}`)
        setIsPayingId(null)
      })
      rzp.open()
    } catch (error: any) {
      console.error('[Settlement] Error:', error)
      setPaymentError(error.message || 'Failed to initiate payment')
      setIsPayingId(null)
    }
  }

  // Only payee (to_user) can manually confirm — fallback for failed callbacks
  async function markSettlementComplete(sid: string) {
    await (supabase.from('settlements') as any).update({ status: 'completed', settled_at: new Date().toISOString() }).eq('id', sid)
    loadGroupData()
    // Log honesty event for the payer
    try {
      await fetch('/api/honesty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: 'clean_settlement', groupId: id, description: 'Settlement manually confirmed' }),
      })
    } catch { /* silent */ }
  }

  async function toggleReaction(expenseId: string, emoji: string) {
    const existing = reactions.get(expenseId)?.find((r) => r.emoji === emoji && r.user_id === currentUser)
    if (existing) {
      await supabase.from('expense_reactions').delete().eq('id', existing.id)
    } else {
      await (supabase.from('expense_reactions') as any).insert({ expense_id: expenseId, user_id: currentUser, emoji })
    }
    setShowReactPicker(null)
    loadGroupData()
  }

  async function handleCloseTrip() {
    await (supabase.from('group_members') as any).update({ left_at: new Date().toISOString() }).eq('group_id', id).eq('user_id', currentUser)
    const { data: remaining } = await supabase.from('group_members').select('id').eq('group_id', id).is('left_at', null)
    if (!remaining || remaining.length === 0) {
      await (supabase.from('groups') as any).update({ is_active: false }).eq('id', id)
    }
    setShowCloseTripModal(false)
    router.push('/groups')
  }

  function copyInviteCode() {
    if (!group) return
    navigator.clipboard.writeText(group.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function shareViaWhatsApp() {
    if (!group) return
    const msg = `Hey! Join my group "${group.name}" on Equilibrium\n\nInvite Code: ${group.invite_code}\n\nOpen the app → Groups → Join Group → Paste this code!`
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  // ── Member friend status ──
  useEffect(() => {
    if (!currentUser || members.length === 0) return
    const otherIds = members.filter(m => m.id !== currentUser).map(m => m.id)
    if (otherIds.length === 0) return
    const orFilter = otherIds.map(id =>
      `and(requester_id.eq.${currentUser},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${currentUser})`
    ).join(',')
    supabase.from('friendships').select('*').or(orFilter).then(({ data }) => {
      if (!data) return
      const statuses: Record<string, 'friends' | 'sent' | 'none'> = {}
      for (const id of otherIds) {
        const f = (data as any[]).find(f =>
          (f.requester_id === currentUser && f.addressee_id === id) ||
          (f.requester_id === id && f.addressee_id === currentUser)
        )
        statuses[id] = !f ? 'none' : f.status === 'accepted' ? 'friends' : 'sent'
      }
      setMemberFriendStatuses(statuses)
    })
  }, [members, currentUser])

  async function addFriendFromGroup(memberId: string) {
    setMemberActionLoading(memberId)
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresseeId: memberId }),
      })
      if (res.ok) setMemberFriendStatuses(prev => ({ ...prev, [memberId]: 'sent' }))
    } catch { /* silent */ }
    setMemberActionLoading(null)
    setOpenMemberMenu(null)
  }

  async function removeFriendFromGroup(memberId: string) {
    setMemberActionLoading(memberId)
    try {
      const { data } = await supabase
        .from('friendships').select('id')
        .or(`and(requester_id.eq.${currentUser},addressee_id.eq.${memberId}),and(requester_id.eq.${memberId},addressee_id.eq.${currentUser})`)
        .eq('status', 'accepted').maybeSingle()
      if (!data) return
      const res = await fetch('/api/friends', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendshipId: (data as any).id }),
      })
      if (res.ok) setMemberFriendStatuses(prev => ({ ...prev, [memberId]: 'none' }))
    } catch { /* silent */ }
    setMemberActionLoading(null)
    setOpenMemberMenu(null)
  }

  // ── Invite friends to group ──
  async function loadFriendsForGroup() {
    setInviteFriendsLoading(true)
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
          const memberIds = new Set(members.map(m => m.id))

          setInviteFriends((data.friends || []).filter((f: any) => !memberIds.has(f.friendId)).map((f: any) => ({
            ...f,
            allowDirectAdd: settingsMap.get(f.friendId) ?? true,
          })))
        } else {
          setInviteFriends([])
        }
      }
    } catch { /* silent */ }
    setInviteFriendsLoading(false)
  }

  async function addOrInviteFriendToGroup(friendId: string, allowDirectAdd: boolean) {
    setInvitingFriendId(friendId)
    try {
      const res = await fetch('/api/group-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: id,
          friendId,
          action: allowDirectAdd ? 'add' : 'invite',
        }),
      })
      if (res.ok || res.status === 409) {
        setInvitedFriends(prev => new Set(prev).add(friendId))
        if (allowDirectAdd) loadGroupData() // reload members
      }
    } catch { /* silent */ }
    setInvitingFriendId(null)
  }

  // ── Group settings ──
  async function loadGroupSettings() {
    try {
      const { data } = await supabase
        .from('groups')
        .select('debt_limit, trip_ended, name, personality, emoji, member_limit, join_mode')
        .eq('id', id)
        .single()
      if (data) {
        setDebtLimit((data as any).debt_limit || null)
        setDebtLimitInput((data as any).debt_limit ? String((data as any).debt_limit) : '')
        setTripEndedToggle((data as any).trip_ended ?? false)
        setEditGroupName((data as any).name || '')
        setEditGroupPersonality(((data as any).personality as 'chill' | 'formal' | 'roast') || 'chill')
        setEditGroupImagePreview((data as any).emoji?.startsWith('http') ? (data as any).emoji : null)
        setEditGroupImageFile(null)
        setMemberLimit((data as any).member_limit ?? 30)
        setMemberLimitInput(String((data as any).member_limit ?? 30))
        setJoinMode(((data as any).join_mode as 'open' | 'request') || 'open')
      }
    } catch { /* silent */ }
  }

  async function saveGroupDetails() {
    if (!editGroupName.trim()) return
    setEditGroupSaving(true)
    try {
      let emojiValue: string | undefined = undefined
      if (editGroupImageFile) {
        const fd = new FormData()
        fd.append('file', editGroupImageFile)
        const upRes = await fetch('/api/upload', { method: 'POST', body: fd })
        if (upRes.ok) {
          const upData = await upRes.json()
          emojiValue = upData.url
        }
      }
      const updates: any = {
        name: editGroupName.trim(),
        personality: editGroupPersonality,
      }
      if (emojiValue !== undefined) updates.emoji = emojiValue
      await (supabase.from('groups') as any).update(updates).eq('id', id)
      setShowGroupSettings(false)
      loadGroupData()
    } catch { /* silent */ }
    setEditGroupSaving(false)
  }

  async function saveDebtLimit() {
    setDebtLimitSaving(true)
    const val = debtLimitInput.trim() ? parseInt(debtLimitInput) : null
    try {
      await (supabase.from('groups') as any)
        .update({ debt_limit: val })
        .eq('id', id)
      setDebtLimit(val)
      setShowGroupSettings(false)
    } catch { /* silent */ }
    setDebtLimitSaving(false)
  }

  async function saveMemberLimit() {
    setMemberLimitSaving(true)
    const val = Math.min(Math.max(parseInt(memberLimitInput) || 30, 2), 30)
    try {
      await (supabase.from('groups') as any)
        .update({ member_limit: val })
        .eq('id', id)
      setMemberLimit(val)
      setMemberLimitInput(String(val))
    } catch { /* silent */ }
    setMemberLimitSaving(false)
  }

  async function toggleJoinMode() {
    setJoinModeSaving(true)
    const newMode = joinMode === 'open' ? 'request' : 'open'
    try {
      await (supabase.from('groups') as any)
        .update({ join_mode: newMode })
        .eq('id', id)
      setJoinMode(newMode)
    } catch { /* silent */ }
    setJoinModeSaving(false)
  }

  async function refreshInviteCode() {
    if (!group) return
    setQrRefreshing(true)
    try {
      const newCode = generateInviteCode()
      const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
      await (supabase.from('groups') as any)
        .update({ invite_code: newCode, invite_code_expires_at: expiresAt })
        .eq('id', id)
      setGroup((prev: any) => prev ? { ...prev, invite_code: newCode, invite_code_expires_at: expiresAt } : prev)
    } catch { /* silent */ }
    setQrRefreshing(false)
  }

  function qrSvgToBlob(svg: SVGSVGElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('No canvas context'))
      const svgData = new XMLSerializer().serializeToString(svg)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      const img = new Image()
      img.onload = () => {
        canvas.width = 280
        canvas.height = 280
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, 280, 280)
        ctx.drawImage(img, 30, 30, 220, 220)
        URL.revokeObjectURL(url)
        canvas.toBlob((blob) => {
          if (blob) resolve(blob)
          else reject(new Error('toBlob failed'))
        }, 'image/png')
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG load failed')) }
      img.src = url
    })
  }

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        resolve(result.split(',')[1])
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  async function openQrModal() {
    // Auto-refresh if expired or no expiry set
    const expiresAt = (group as any)?.invite_code_expires_at
    if (!expiresAt || new Date(expiresAt) <= new Date()) {
      setShowQrModal(true)
      await refreshInviteCode()
    } else {
      setShowQrModal(true)
    }
  }

  async function terminateGroup() {
    if (!group || terminateConfirmName.trim() !== group.name) return
    setIsTerminating(true)
    try {
      await (supabase.from('groups') as any).update({
        terminated_at: new Date().toISOString(),
        is_active: false,
      }).eq('id', id)

      // Notify all members about termination
      try {
        await fetch('/api/groups/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId: id, event: 'terminated' }),
        })
      } catch { /* silent */ }

      setShowTerminateModal(false)
      setTerminateConfirmName('')
      loadGroupData()
    } catch {
      setIsTerminating(false)
    }
  }

  async function transferOwnershipAndLeave() {
    if (!transferToId) return
    setIsTransferring(true)
    try {
      // Promote new owner
      await (supabase.from('group_members') as any)
        .update({ role: 'admin' })
        .eq('group_id', id)
        .eq('user_id', transferToId)
      // Update group created_by
      await (supabase.from('groups') as any)
        .update({ created_by: transferToId })
        .eq('id', id)
      setShowTransferModal(false)
      setShowLeaveModal(true)
    } catch {
      setLeaveError('Failed to transfer ownership. Try again.')
    }
    setIsTransferring(false)
  }

  async function deleteGroupAndLeave() {
    setIsDeleteLeaving(true)
    try {
      // Soft-delete own membership
      await (supabase.from('group_members') as any).update({ left_at: new Date().toISOString() }).eq('group_id', id).eq('user_id', currentUser)
      // Deactivate the group
      await (supabase.from('groups') as any).update({ is_active: false, terminated_at: new Date().toISOString() }).eq('id', id)
      setShowDeleteModal(false)
      router.replace('/groups')
    } catch {
      setIsDeleteLeaving(false)
    }
  }

  async function leaveGroup() {
    setLeaveError('')
    setIsLeaving(true)
    try {
      // Check if user has settled all debts (net balance must be ~0)
      const balances = getUserBalances()
      const myBal = balances.find((b) => b.userId === currentUser)
      if (myBal && Math.abs(myBal.net) > 0.5) {
        setLeaveError(myBal.net < 0
          ? `You still owe ${formatINR(Math.abs(myBal.net))}. Settle your debts before leaving.`
          : `Others still owe you ${formatINR(myBal.net)}. Collect or forgive before leaving.`)
        setIsLeaving(false)
        return
      }

      // Soft-delete membership
      const { error: deleteError } = await (supabase.from('group_members') as any).update({ left_at: new Date().toISOString() }).eq('group_id', id).eq('user_id', currentUser)
      if (deleteError) {
        console.error('[LeaveGroup] Update failed:', deleteError)
        setLeaveError('Failed to leave group: ' + deleteError.message)
        setIsLeaving(false)
        return
      }

      // If no active members left, deactivate the group
      const { data: remaining } = await supabase.from('group_members').select('id').eq('group_id', id).is('left_at', null)
      if (!remaining || remaining.length === 0) {
        await (supabase.from('groups') as any).update({ is_active: false }).eq('id', id)
      }

      // Notify remaining members about leaving
      try {
        const { data: myProfile } = await supabase.from('profiles').select('full_name').eq('id', currentUser).single()
        await fetch('/api/groups/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId: id, event: 'left', extra: { memberName: (myProfile as any)?.full_name || 'A member' } }),
        })
      } catch { /* silent */ }

      setShowLeaveModal(false)
      router.replace('/groups')
    } catch (err) {
      console.error('[LeaveGroup] Error:', err)
      setLeaveError('Failed to leave group. Try again.')
      setIsLeaving(false)
    }
  }

  async function toggleTripEnded() {
    if (!group) return
    setTripEndedSaving(true)
    const newVal = !tripEndedToggle
    try {
      await (supabase.from('groups') as any).update({ trip_ended: newVal }).eq('id', id)
      setTripEndedToggle(newVal)
      loadGroupData()
    } catch { /* silent */ }
    setTripEndedSaving(false)
  }

  // ── Issue/Conflict helpers ──

  // Get detailed breakdown of what a user owes/is owed, per expense
  function getBalanceBreakdown(userId: string) {
    const conflictedIds = new Set(
      expenseIssues.filter((i) => i.status === 'open').map((i) => i.expense_id)
    )

    // Track per-person debts with expense details
    const owesTo = new Map<string, { total: number; items: { title: string; amount: number; date: string; category: string }[] }>()
    const owedBy = new Map<string, { total: number; items: { title: string; amount: number; date: string; category: string }[] }>()

    expenses.forEach((exp) => {
      if (conflictedIds.has(exp.id)) return
      const splits = exp.expense_splits || []

      splits.forEach((split: any) => {
        if (split.user_id === exp.paid_by) return
        const splitAmount = Number(split.amount)

        if (split.user_id === userId) {
          // This user owes the payer
          const entry = owesTo.get(exp.paid_by) || { total: 0, items: [] }
          entry.total += splitAmount
          entry.items.push({ title: exp.title, amount: splitAmount, date: exp.date || exp.created_at?.split('T')[0] || '', category: exp.category || 'other' })
          owesTo.set(exp.paid_by, entry)
        }

        if (exp.paid_by === userId) {
          // Someone owes this user
          const entry = owedBy.get(split.user_id) || { total: 0, items: [] }
          entry.total += splitAmount
          entry.items.push({ title: exp.title, amount: splitAmount, date: exp.date || exp.created_at?.split('T')[0] || '', category: exp.category || 'other' })
          owedBy.set(split.user_id, entry)
        }
      })
    })

    // Factor in completed settlements
    settlements.filter((s) => s.status === 'completed').forEach((s) => {
      if (s.from_user === userId) {
        // This user paid someone — reduce what they owe
        const entry = owesTo.get(s.to_user)
        if (entry) entry.total = Math.max(0, entry.total - Number(s.amount))
      }
      if (s.to_user === userId) {
        // Someone paid this user — reduce what they are owed
        const entry = owedBy.get(s.from_user)
        if (entry) entry.total = Math.max(0, entry.total - Number(s.amount))
      }
    })

    return { owesTo, owedBy }
  }

  // ── Issue/Conflict helpers (continued) ──

  function hasOpenIssues(expenseId: string) {
    return expenseIssues.some((i) => i.expense_id === expenseId && i.status === 'open')
  }

  function hasMyIssue(expenseId: string) {
    return expenseIssues.some((i) => i.expense_id === expenseId && i.raised_by === currentUser && i.status === 'open')
  }

  function hasMyResolvedIssue(expenseId: string) {
    return expenseIssues.some((i) => i.expense_id === expenseId && i.raised_by === currentUser && i.status === 'resolved')
  }

  function getExpenseIssues(expenseId: string) {
    return expenseIssues.filter((i) => i.expense_id === expenseId)
  }

  async function raiseIssue(expenseId: string) {
    if (!issueDescription.trim()) return
    setIssueSaving(true)
    try {
      const res = await fetch('/api/expenses/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenseId, description: issueDescription.trim() }),
      })
      if (res.ok) {
        setShowIssueModal(null)
        setIssueDescription('')
        loadGroupData()
      }
    } catch { /* silent */ }
    setIssueSaving(false)
  }

  async function resolveIssue(issueId: string) {
    try {
      // Find the issue to check timing and who raised it
      const issue = expenseIssues.find(i => i.id === issueId)
      await fetch('/api/expenses/issues', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId, action: 'resolve' }),
      })
      loadGroupData()
      // Log honesty event for dispute resolution
      if (issue) {
        const createdAt = new Date(issue.created_at).getTime()
        const resolveTime = Date.now() - createdAt
        const withinOneHour = resolveTime < 3600000
        // If resolved quickly, lighter penalty for expense creator
        const eventType = withinOneHour ? 'dispute_creator_quick_fix' : 'dispute_valid'
        try {
          await fetch('/api/honesty', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventType, groupId: id, description: withinOneHour ? 'Dispute resolved within 1 hour' : 'Dispute resolved — expense had a valid issue' }),
          })
        } catch { /* silent */ }
      }
    } catch { /* silent */ }
  }

  async function deleteConflictedExpense(expenseId: string) {
    if (!confirm('Delete this expense? This cannot be undone.')) return
    try {
      await fetch(`/api/expenses/issues?expenseId=${expenseId}&deleteExpense=true`, { method: 'DELETE' })
      loadGroupData()
    } catch { /* silent */ }
  }

  async function saveEditExpense() {
    if (!showEditExpenseModal) return
    setEditSaving(true)
    try {
      const res = await fetch('/api/expenses/edit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expenseId: showEditExpenseModal.id,
          title: editForm.title || undefined,
          amount: editForm.amount ? Number(editForm.amount) : undefined,
          category: editForm.category || undefined,
        }),
      })
      if (res.ok) {
        // Upload proof if a new file was selected
        if (editProofFile) {
          try {
            const formData = new FormData()
            formData.append('file', editProofFile)
            const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
            if (uploadRes.ok) {
              const { url } = await uploadRes.json()
              await fetch('/api/expenses/proof', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ expenseId: showEditExpenseModal.id, proofUrl: url }),
              })
            }
          } catch { /* proof upload failed silently */ }
        }
        setShowEditExpenseModal(null)
        setEditProofFile(null)
        loadGroupData()
      }
    } catch { /* silent */ }
    setEditSaving(false)
  }

  // ── Spend limit helpers ──

  async function saveSpendLimit() {
    if (!spendLimitInput.trim()) return
    setSpendLimitSaving(true)
    try {
      const res = await fetch('/api/trip/spend-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: id, spendLimit: Number(spendLimitInput) }),
      })
      if (res.ok) {
        setSpendLimit(Number(spendLimitInput))
        setShowSpendLimitModal(false)
      }
    } catch { /* silent */ }
    setSpendLimitSaving(false)
  }

  async function removeSpendLimit() {
    try {
      await fetch(`/api/trip/spend-limit?groupId=${id}`, { method: 'DELETE' })
      setSpendLimit(null)
      setShowSpendLimitModal(false)
    } catch { /* silent */ }
  }

  function getMySpending() {
    return expenses
      .filter((e) => (e.expense_splits || []).some((s: any) => s.user_id === currentUser))
      .reduce((total, e) => {
        const mySplit = (e.expense_splits || []).find((s: any) => s.user_id === currentUser)
        return total + Number(mySplit?.amount || 0)
      }, 0)
  }

  // ── Render helpers ──

  function renderReactions(expenseId: string) {
    const expReactions = reactions.get(expenseId) || []
    const grouped = expReactions.reduce((acc: Record<string, number>, r: any) => {
      acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc
    }, {} as Record<string, number>)

    return (
      <div className="flex items-center gap-1 mt-2 flex-wrap">
        {Object.entries(grouped).map(([emoji, count]) => {
          const iMine = expReactions.some((r: any) => r.emoji === emoji && r.user_id === currentUser)
          return (
            <button
              key={emoji}
              onClick={() => toggleReaction(expenseId, emoji)}
              className={`text-xs px-1.5 py-0.5 rounded-full border transition-all ${iMine ? 'bg-primary/10 border-primary/30' : 'bg-muted border-border'}`}
            >
              {emoji} {(count as number) > 1 ? count : ''}
            </button>
          )
        })}
        <div className="relative">
          <button
            onClick={() => setShowReactPicker(showReactPicker === expenseId ? null : expenseId)}
            className="text-xs px-1.5 py-0.5 rounded-full bg-muted border border-border text-muted-foreground hover:text-foreground transition-all"
          >
            +
          </button>
          {showReactPicker === expenseId && (
            <div className="absolute bottom-full left-0 mb-1 flex gap-1 bg-card border border-border rounded-xl p-1.5 shadow-lg z-10">
              {REACTION_EMOJIS.map((em) => (
                <button key={em} onClick={() => toggleReaction(expenseId, em)} className="text-base hover:scale-125 transition-transform px-0.5">
                  {em}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Loading / Not Found ──

  if (isLoading) {
    return <VideoLoader />
  }

  if (!group) {
    return <div className="px-5 pt-14"><p className="text-center text-muted-foreground">Group not found</p></div>
  }

  const balances = getUserBalances()
  // Sort balances: current user first, then by absolute net descending
  const sortedBalances = [...balances].sort((a, b) => {
    if (a.userId === currentUser) return -1
    if (b.userId === currentUser) return 1
    return Math.abs(b.net) - Math.abs(a.net)
  })
  const topContributor = getTopContributor()
  const activeSuggestions = fastestSettlements
  const pendingSettlements = settlements.filter((s) => s.status === 'pending')
  const categoryBreakdown = getCategoryBreakdown()
  const expensesByDay = getExpensesByDay()
  const tripTotal = getTripTotal()
  const myBalance = balances.find((b) => b.userId === currentUser)
  const iOweMoney = activeSuggestions.some((s) => s.from === currentUser)
  // My debts: settlements where I'm the debtor
  const myDebts = activeSuggestions.filter((s) => s.from === currentUser)
  // My credits: settlements where I'm the creditor
  const myCredits = activeSuggestions.filter((s) => s.to === currentUser)
  // Group lifecycle
  const isTerminated = !!group.terminated_at
  const isOwner = group.created_by === currentUser

  // MVP label based on vibe
  const vibe = (group as any).personality || 'chill'
  const mvpLabel = vibe === 'formal' ? 'Primary Contributor' : vibe === 'roast' ? 'Walking ATM' : 'MVP'

  return (
    <div className="pb-4">
      {isImage ? (
        <>
          {/* ── Sticky Header (transparent → black on scroll) ── */}
          <div
            className="sticky top-0 z-30 px-5 pt-14 pb-3 transition-colors"
            style={{ backgroundColor: `rgba(0,0,0,${Math.min(1, scrollY / (isTrip ? 340 : 200))})` }}
          >
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/groups')} className="h-9 w-9 rounded-xl bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <ArrowLeft className="h-4 w-4 text-white" />
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold truncate text-white">{group.name}</h1>
                <p className="text-[11px] text-white/60">
                  {activeMembers.length} member{activeMembers.length !== 1 ? 's' : ''} · {group.personality}
                </p>
              </div>
              <button onClick={() => openQrModal()} className="h-9 w-9 rounded-xl bg-black/40 backdrop-blur-sm flex items-center justify-center shrink-0">
                <QrCode className="h-4 w-4 text-white" />
              </button>
              <button onClick={copyInviteCode} className="h-9 w-9 rounded-xl bg-black/40 backdrop-blur-sm flex items-center justify-center shrink-0">
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4 text-white" />}
              </button>
              <button onClick={() => { setShowGroupSettings(true); loadGroupSettings() }} className="h-9 w-9 rounded-xl bg-black/40 backdrop-blur-sm flex items-center justify-center shrink-0">
                <Settings className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>

          {/* ── Fixed Hero Banner Image ── */}
          <div className="fixed left-1/2 -translate-x-1/2 top-0 z-0 w-full max-w-[428px]" style={{ height: `${BANNER_HEIGHT}px` }}>
            <img src={group.emoji!} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/30" />
            {/* MVP / Top contributor showcase */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-5 pb-6 pt-16">
              <div className="flex items-center gap-2 mb-2">
                {isTrip && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium backdrop-blur-sm">TRIP</span>}
                {isTerminated && <span className="text-[10px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full font-medium backdrop-blur-sm">TERMINATED</span>}
                {myLeftAt && <span className="text-[10px] bg-white/20 text-white/80 px-1.5 py-0.5 rounded-full font-medium backdrop-blur-sm">LEFT</span>}
              </div>
              {topContributor ? (
                <>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">{mvpLabel}</p>
                  <p className="text-2xl font-black text-white leading-tight">{topContributor.name}</p>
                </>
              ) : (
                <p className="text-lg font-bold text-white/70">No expenses yet</p>
              )}
            </div>
          </div>
          {/* Spacer to push content below fixed banner */}
          <div style={{ height: `${BANNER_HEIGHT - 68}px` }} />
        </>
      ) : (
        /* ── Simple Sticky Header (non-image groups) ── */
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm px-5 pt-14 pb-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/groups')} className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary shrink-0" />
                <h1 className="text-lg font-bold truncate">{group.name}</h1>
                {isTrip && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium shrink-0">TRIP</span>}
                {isTerminated && <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-medium shrink-0">TERMINATED</span>}
                {myLeftAt && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium shrink-0">LEFT</span>}
              </div>
              <p className="text-xs text-muted-foreground">
                {activeMembers.length} member{activeMembers.length !== 1 ? 's' : ''}{pastMembers.length > 0 ? ` · ${pastMembers.length} left` : ''} · {group.personality}
              </p>
            </div>
            <button onClick={() => openQrModal()} className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <QrCode className="h-4 w-4" />
            </button>
            <button onClick={copyInviteCode} className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </button>
            <button onClick={() => { setShowGroupSettings(true); loadGroupSettings() }} className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div className={isImage ? 'relative bg-background -mt-5 pt-5 px-5' : 'px-5'} style={isImage ? { minHeight: 'calc(100dvh - 220px)' } : undefined}>

      {/* ── Terminated Banner ── */}
      {isTerminated && (
        <Card className="mb-4 bg-destructive/5 border-destructive/20" padding="md">
          <div className="flex items-center gap-3">
            <Ban className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-semibold text-destructive">Group Terminated</p>
              <p className="text-xs text-muted-foreground">
                This group was terminated on {new Date(group.terminated_at!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. No further operations allowed.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ── Left Group Banner ── */}
      {myLeftAt && !isTerminated && (
        <Card className="mb-4 bg-muted/50 border-border" padding="md">
          <div className="flex items-center gap-3">
            <LogOut className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-semibold text-muted-foreground">You left this group</p>
              <p className="text-xs text-muted-foreground">
                You left on {new Date(myLeftAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. You&apos;re viewing a snapshot of this group — all data shown is from before you left. Any activity after that is not visible to you.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ── Trip Dashboard Card ── */}
      {isTrip && expenses.length > 0 && (
        <Card className="mb-4 bg-linear-to-br from-primary/10 via-primary/5 to-transparent border-primary/20" padding="md">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Spent</p>
              <p className="text-2xl font-black">{formatINR(tripTotal)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Your Spend</p>
              <p className="text-lg font-bold">{formatINR(getMySpending())}</p>
            </div>
          </div>
          {spendLimit !== null && (() => {
            const mySpent = getMySpending()
            const pct = Math.min(100, Math.round((mySpent / spendLimit) * 100))
            const isClose = pct >= 80
            const isOver = pct >= 100
            return (
              <div className="pt-3 border-t border-primary/10">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5 text-primary" />
                    <p className="text-[11px] font-semibold">Your Spend Limit</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] text-muted-foreground">{formatINR(mySpent)} / {formatINR(spendLimit)}</p>
                    <p className={`text-[11px] font-bold ${isOver ? 'text-destructive' : isClose ? 'text-warning' : 'text-success'}`}>{pct}%</p>
                    <button onClick={() => { setShowSpendLimitModal(true); setSpendLimitInput(spendLimit?.toString() || '') }} className="text-[10px] text-muted-foreground underline underline-offset-2">Edit</button>
                  </div>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${isOver ? 'bg-destructive' : isClose ? 'bg-warning' : 'bg-success'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </div>
            )
          })()}
          {spendLimit === null && !myLeftAt && !isTerminated && (
            <div className="pt-2 border-t border-primary/10">
              <button onClick={() => { setShowSpendLimitModal(true); setSpendLimitInput('') }} className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors">
                <Target className="h-3.5 w-3.5" /> Set spend limit
              </button>
            </div>
          )}
        </Card>
      )}

      {/* ── Tabs + Add Expense (single sticky block) ── */}
      <div className="sticky top-[110px] z-20 bg-background -mx-5 px-5 pt-1 pb-3">
        <div className="flex gap-1 bg-muted rounded-xl p-1 mb-3">
          {([
            { id: 'expenses' as Tab, label: 'Expenses', icon: Receipt },
            { id: 'balances' as Tab, label: 'Balances', icon: TrendingUp },
            { id: 'members' as Tab, label: 'Members', icon: Users },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
        {activeTab === 'expenses' && !isTerminated && !myLeftAt && (
          <Button fullWidth onClick={() => router.push(`/groups/${id}/expenses/new`)}>
            <Plus className="h-4 w-4" /> Add Expense
          </Button>
        )}
      </div>

      {/* ═══ EXPENSES TAB ═══ */}
      {activeTab === 'expenses' && (
        <div>
          {myLeftAt && (
            <p className="text-[11px] text-muted-foreground text-center mb-3 italic">
              Frozen view — expenses up to {new Date(myLeftAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}

          {expenses.length === 0 ? (
            <EmptyState icon={<Receipt className="h-7 w-7" />} title="No expenses yet" description="Start adding expenses to track who owes what" />
          ) : isTrip ? (
            /* ── Trip Day Timeline ── */
            <div className="flex flex-col gap-4">
              {expensesByDay.map((day) => (
                <div key={day.date}>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <p className="text-xs font-bold text-primary">Day {day.dayNum}</p>
                    <p className="text-xs text-muted-foreground">({day.label})</p>
                    <div className="flex-1 h-px bg-border" />
                    <p className="text-xs font-semibold shrink-0">
                      {formatINR(day.expenses.reduce((s: number, e: any) => s + Number(e.amount), 0))}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 pl-2 border-l-2 border-primary/20 ml-1.5">
                    {day.expenses.map((expense: any) => {
                      const cat = categories.find((c) => c.id === expense.category)
                      const isConflicted = hasOpenIssues(expense.id)
                      const isExpenseCreator = expense.paid_by === currentUser
                      const iRaisedIssue = hasMyIssue(expense.id)
                      return (
                        <Card
                          key={expense.id}
                          padding="sm"
                          className={isConflicted ? 'border-warning/50 bg-warning/5' : ''}
                        >
                          {/* Clickable top area — opens detail modal */}
                          <div
                            className="flex items-center gap-3 cursor-pointer active:opacity-70 transition-opacity"
                            onClick={() => setShowIssueDetailModal(expense.id)}
                          >
                            <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0"><CategoryIcon name={cat?.icon || 'package'} className="h-4 w-4 text-muted-foreground" /></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">{expense.title}</p>
                              <p className="text-[11px] text-muted-foreground">{expense.profiles?.full_name} paid</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <p className={`text-sm font-bold ${isConflicted ? 'line-through text-muted-foreground' : ''}`}>{formatINR(expense.amount)}</p>
                              {expense.original_currency && expense.original_currency !== 'INR' && (
                                <p className="text-[10px] text-muted-foreground">{formatCurrency(expense.original_amount, expense.original_currency)}</p>
                              )}
                              {isConflicted && (
                                <span className="text-[9px] bg-warning/20 text-warning px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                                  <AlertTriangle className="h-2.5 w-2.5" /> Conflicted
                                </span>
                              )}
                            </div>
                          </div>
                          {expense.proof_url && (
                            <a href={expense.proof_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary mt-2">
                              <FileText className="h-3 w-3" /> View Proof
                            </a>
                          )}
                          {expense.receipt_url && (
                            <a href={expense.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary mt-2">
                              <ImageIcon className="h-3 w-3" /> View Receipt
                            </a>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            {renderReactions(expense.id)}
                            {!isExpenseCreator && (
                              iRaisedIssue ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium ml-auto">
                                  <AlertTriangle className="h-2.5 w-2.5 inline mr-0.5" />Issue Raised
                                </span>
                              ) : hasMyResolvedIssue(expense.id) ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success font-medium ml-auto">
                                  <Check className="h-2.5 w-2.5 inline mr-0.5" />Issue Solved
                                </span>
                              ) : (
                                <button
                                  onClick={() => { setShowIssueModal(expense.id); setIssueDescription('') }}
                                  className="text-[10px] px-2 py-1 rounded-full border border-warning/30 text-warning hover:bg-warning/10 transition-all ml-auto"
                                >
                                  <AlertTriangle className="h-2.5 w-2.5 inline mr-0.5" />Raise Issue
                                </button>
                              )
                            )}
                            {isExpenseCreator && isConflicted && (
                              <div className="flex items-center gap-2 ml-auto">
                                <button
                                  onClick={() => { setShowEditExpenseModal(expense); setEditForm({ title: expense.title, amount: String(expense.amount), category: expense.category || '' }); setEditProofFile(null) }}
                                  className="text-[10px] px-2 py-1 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-all"
                                >
                                  <Edit3 className="h-2.5 w-2.5 inline mr-0.5" />Edit
                                </button>
                                <button
                                  onClick={() => deleteConflictedExpense(expense.id)}
                                  className="text-[10px] px-2 py-1 rounded-full border border-destructive/30 text-destructive hover:bg-destructive/10 transition-all"
                                >
                                  <Trash2 className="h-2.5 w-2.5 inline mr-0.5" />Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Pie Chart */}
              {categoryBreakdown.length > 0 && (
                <Card className="mt-2" padding="md">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Category Breakdown</p>
                  <div className="flex items-center gap-4">
                    <div className="w-28 h-28 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={categoryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={25} outerRadius={50} paddingAngle={2}>
                            {categoryBreakdown.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                          </Pie>
                          <Tooltip formatter={(value: any) => formatINR(Number(value ?? 0))} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 flex flex-col gap-1.5">
                      {categoryBreakdown.slice(0, 5).map((cat) => (
                        <div key={cat.name} className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: cat.color }} />
                          <p className="text-xs flex-1 truncate flex items-center gap-1"><CategoryIcon name={cat.icon} className="h-3 w-3" /> {cat.name}</p>
                          <p className="text-xs font-semibold shrink-0">{formatINR(cat.value)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}
            </div>
          ) : (
            /* ── Regular List ── */
            <div className="flex flex-col gap-2">
              {expenses.map((expense) => {
                const cat = categories.find((c) => c.id === expense.category)
                const isConflicted = hasOpenIssues(expense.id)
                const isExpenseCreator = expense.paid_by === currentUser
                const iRaisedIssue = hasMyIssue(expense.id)
                return (
                  <Card
                    key={expense.id}
                    padding="md"
                    className={isConflicted ? 'border-warning/50 bg-warning/5' : ''}
                  >
                    {/* Clickable top area — opens detail modal */}
                    <div
                      className="flex items-center gap-3 cursor-pointer active:opacity-70 transition-opacity"
                      onClick={() => setShowIssueDetailModal(expense.id)}
                    >
                      <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0"><CategoryIcon name={cat?.icon || 'package'} className="h-5 w-5 text-muted-foreground" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{expense.title}</p>
                        <p className="text-xs text-muted-foreground">{expense.profiles?.full_name} paid · {formatRelativeDate(expense.created_at)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <p className={`text-sm font-bold ${isConflicted ? 'line-through text-muted-foreground' : ''}`}>{formatINR(expense.amount)}</p>
                        {expense.original_currency && expense.original_currency !== 'INR' && (
                          <p className="text-[10px] text-muted-foreground">{formatCurrency(expense.original_amount, expense.original_currency)}</p>
                        )}
                        {isConflicted ? (
                          <span className="text-[9px] bg-warning/20 text-warning px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" /> Conflicted
                          </span>
                        ) : (
                          <p className="text-[10px] text-muted-foreground">{expense.split_type}</p>
                        )}
                      </div>
                    </div>
                    {expense.proof_url && (
                      <a href={expense.proof_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary mt-2">
                        <FileText className="h-3 w-3" /> View Proof
                      </a>
                    )}
                    {expense.receipt_url && (
                      <a href={expense.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary mt-2">
                        <ImageIcon className="h-3 w-3" /> View Receipt
                      </a>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      {renderReactions(expense.id)}
                      {!isExpenseCreator && (
                        iRaisedIssue ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium ml-auto">
                            <AlertTriangle className="h-2.5 w-2.5 inline mr-0.5" />Issue Raised
                          </span>
                        ) : hasMyResolvedIssue(expense.id) ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success font-medium ml-auto">
                            <Check className="h-2.5 w-2.5 inline mr-0.5" />Issue Solved
                          </span>
                        ) : (
                          <button
                            onClick={() => { setShowIssueModal(expense.id); setIssueDescription('') }}
                            className="text-[10px] px-2 py-1 rounded-full border border-warning/30 text-warning hover:bg-warning/10 transition-all ml-auto"
                          >
                            <AlertTriangle className="h-2.5 w-2.5 inline mr-0.5" />Raise Issue
                          </button>
                        )
                      )}
                      {isExpenseCreator && isConflicted && (
                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            onClick={() => { setShowEditExpenseModal(expense); setEditForm({ title: expense.title, amount: String(expense.amount), category: expense.category || '' }); setEditProofFile(null) }}
                            className="text-[10px] px-2 py-1 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-all"
                          >
                            <Edit3 className="h-2.5 w-2.5 inline mr-0.5" />Edit
                          </button>
                          <button
                            onClick={() => deleteConflictedExpense(expense.id)}
                            className="text-[10px] px-2 py-1 rounded-full border border-destructive/30 text-destructive hover:bg-destructive/10 transition-all"
                          >
                            <Trash2 className="h-2.5 w-2.5 inline mr-0.5" />Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ BALANCES TAB ═══ */}
      {activeTab === 'balances' && (
        <div>
          {myLeftAt && (
            <p className="text-[11px] text-muted-foreground text-center mb-3 italic">
              Frozen view — balances as of {new Date(myLeftAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
          <div className="flex flex-col gap-2 mb-4">
            {sortedBalances.map((b) => {
              const isMe = b.userId === currentUser
              return (
                <Card
                  key={b.userId}
                  padding="md"
                  className={`cursor-pointer active:opacity-70 transition-opacity ${isMe ? 'border-primary/30 bg-primary/5' : ''}`}
                  onClick={() => setShowBalanceDetail(b.userId)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={b.name} imageUrl={b.avatarUrl} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{b.name}</p>
                        {isMe && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">you</span>}
                      </div>
                      {isMe && b.net < -0.01 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">Tap to see who you owe</p>
                      )}
                      {isMe && b.net > 0.01 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">Tap to see who owes you</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <p className={`text-sm font-bold whitespace-nowrap ${b.net > 0 ? 'text-success' : b.net < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {b.net > 0 ? '+' : ''}{formatINR(b.net)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{b.net > 0 ? 'gets back' : b.net < 0 ? 'owes' : 'settled'}</p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Trip category breakdown in balances */}
          {isTrip && categoryBreakdown.length > 0 && (
            <Card className="mb-4" padding="md">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Spending Breakdown</p>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryBreakdown} dataKey="value" cx="50%" cy="50%" innerRadius={20} outerRadius={40} paddingAngle={2}>
                        {categoryBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  {categoryBreakdown.slice(0, 4).map((cat) => (
                    <div key={cat.name} className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ background: cat.color }} />
                      <p className="text-[11px] flex-1 truncate flex items-center gap-1"><CategoryIcon name={cat.icon} className="h-3 w-3" /> {cat.name}</p>
                      <p className="text-[11px] font-semibold shrink-0">{formatINR(cat.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Pending Settlements */}
          {pendingSettlements.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Pending Settlements</p>
              {pendingSettlements.map((s) => {
                const fromName = members.find((m) => m.id === s.from_user)?.full_name || 'Unknown'
                const toName = members.find((m) => m.id === s.to_user)?.full_name || 'Unknown'
                const isPayee = s.to_user === currentUser
                return (
                  <Card key={s.id} padding="md" className="mb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{fromName} → {toName}</p>
                        <p className="text-xs text-muted-foreground">{formatINR(s.amount)}</p>
                      </div>
                      {/* Only payee sees "Done" — fallback if payment callback didn't auto-complete */}
                      {isPayee && (
                        <Button size="sm" variant="secondary" onClick={() => markSettlementComplete(s.id)}>
                          <Check className="h-3.5 w-3.5" /> Received
                        </Button>
                      )}
                      {s.from_user === currentUser && (
                        <span className="text-xs text-warning font-medium">Confirming...</span>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}

          {activeSuggestions.length > 0 && !isTerminated && !myLeftAt && (
            <Button fullWidth onClick={() => setShowSettleModal(true)} className="mt-2">
              <TrendingUp className="h-4 w-4" />
              {iOweMoney ? 'Settle Up' : 'View Who Owes You'}
            </Button>
          )}

          {/* Close Trip: only when trip is marked as over by creator AND user has no debt */}
          {isTrip && group.is_active && !isTerminated && !myLeftAt && group.trip_ended && !iOweMoney && (
            <Button fullWidth variant="secondary" onClick={() => setShowCloseTripModal(true)} className="mt-2">
              <LogOut className="h-4 w-4" /> Close Trip & Exit
            </Button>
          )}

          {/* Leave Group: for regular (non-trip) active groups */}
          {!isTrip && group.is_active && !isTerminated && !myLeftAt && (
            <Button
              fullWidth
              variant="secondary"
              className="mt-2"
              onClick={() => {
                setLeaveError('')
                const otherMembers = members.filter(m => m.id !== currentUser)
                if (otherMembers.length === 0) {
                  setShowDeleteModal(true)
                } else if (isOwner) {
                  setTransferToId('')
                  setShowTransferModal(true)
                } else {
                  setShowLeaveModal(true)
                }
              }}
            >
              <LogOut className="h-4 w-4" /> Leave Group
            </Button>
          )}
        </div>
      )}

      {/* ═══ MEMBERS TAB ═══ */}
      {activeTab === 'members' && (
        <div className="flex flex-col gap-2">
          {/* ── Top Contributor Card ── */}
          {topContributor && contributorText && (
            <Card className="mb-2 bg-linear-to-br from-primary/10 via-primary/5 to-transparent border-primary/20" padding="md">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-warning shrink-0" />
                <p className="text-xs">{contributorText}</p>
              </div>
            </Card>
          )}
          {/* Close menu on outside click */}
          {openMemberMenu && (
            <div className="fixed inset-0 z-20" onClick={() => setOpenMemberMenu(null)} />
          )}
          {activeMembers.map((member) => (
            <Card key={member.id} padding="md">
              <div className="flex items-center gap-3">
                <Avatar name={member.full_name} imageUrl={member.avatar_url} size="md" />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold">{member.full_name}</p>
                    {member.role === 'admin' && <Crown className="h-3.5 w-3.5 text-warning" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{member.upi_id || member.email || 'No UPI ID set'}</p>
                </div>
                {member.id === currentUser ? (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">You</span>
                ) : (
                  <div className="relative z-30">
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenMemberMenu(openMemberMenu === member.id ? null : member.id) }}
                      className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center"
                    >
                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </button>
                    {openMemberMenu === member.id && (
                      <div className="absolute right-0 top-9 bg-background border border-border rounded-xl shadow-lg z-40 min-w-40 overflow-hidden">
                        <button
                          onClick={() => { router.push(`/users/${member.id}`); setOpenMemberMenu(null) }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors"
                        >
                          <UserCircle className="h-4 w-4 text-muted-foreground" /> View Profile
                        </button>
                        {(!memberFriendStatuses[member.id] || memberFriendStatuses[member.id] === 'none') && (
                          <button
                            onClick={() => addFriendFromGroup(member.id)}
                            disabled={memberActionLoading === member.id}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-primary disabled:opacity-50"
                          >
                            {memberActionLoading === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                            Add Friend
                          </button>
                        )}
                        {memberFriendStatuses[member.id] === 'sent' && (
                          <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-warning">
                            <Clock className="h-4 w-4" /> Pending
                          </div>
                        )}
                        {memberFriendStatuses[member.id] === 'friends' && (
                          <button
                            onClick={() => removeFriendFromGroup(member.id)}
                            disabled={memberActionLoading === member.id}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-destructive disabled:opacity-50"
                          >
                            {memberActionLoading === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                            Remove Friend
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}

          {/* Past Members Collapsible */}
          {pastMembers.length > 0 && (
            <>
              <button
                onClick={() => setShowPastMembers(!showPastMembers)}
                className="flex items-center gap-2 mt-3 px-1 py-1.5"
              >
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showPastMembers ? 'rotate-180' : ''}`} />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Past Members ({pastMembers.length})
                </p>
              </button>
              {showPastMembers && pastMembers.map((member) => (
                <Card key={member.id} padding="md" className="opacity-50">
                  <div className="flex items-center gap-3">
                    <Avatar name={member.full_name} imageUrl={member.avatar_url} size="md" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{member.full_name}</p>
                      <p className="text-[11px] text-muted-foreground">Left {formatRelativeDate(member.left_at!)}</p>
                    </div>
                    {member.id === currentUser && (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">You</span>
                    )}
                  </div>
                </Card>
              ))}
            </>
          )}

          {/* Add / Invite Friends */}
          {!isTerminated && !myLeftAt && (
            <Button
              fullWidth
              variant="secondary"
              className="mt-1"
              onClick={() => { setShowInviteModal(true); loadFriendsForGroup() }}
            >
              <UserPlus className="h-4 w-4" /> Add / Invite Friends
            </Button>
          )}

          {/* Transfer ownership button for owner */}
          {!isTerminated && !myLeftAt && isOwner && members.filter(m => m.id !== currentUser).length > 0 && (
            <Button
              fullWidth
              variant="secondary"
              className="mt-1 text-warning border-warning/30"
              onClick={() => { setTransferToId(''); setShowTransferModal(true) }}
            >
              <Crown className="h-4 w-4" /> Transfer Ownership
            </Button>
          )}

          {!isTerminated && (
            <Card className="mt-2" padding="md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Invite Code</p>
                  <p className="text-lg font-mono font-bold tracking-[0.2em]">{group.invite_code}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={shareViaWhatsApp} title="Share via WhatsApp">
                    <WhatsAppIcon className="h-4 w-4 text-green-500" />
                  </Button>
                  <Button size="sm" variant="secondary" onClick={copyInviteCode}>
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {isTrip && expenses.length > 0 && (group.trip_ended || tripEndedToggle) && (
            <Button fullWidth className="mt-3" onClick={() => setShowRecapModal(true)}>
              <PartyPopper className="h-4 w-4" /> View Trip Recap
            </Button>
          )}
        </div>
      )}

      </div>{/* ── end content wrapper ── */}

      {/* ═══ SETTLEMENT MODAL ═══ */}
      <Modal isOpen={showSettleModal} onClose={() => { setShowSettleModal(false); setReminderSent(null); setReminderText(''); setCustomSelected(new Set()) }} title={iOweMoney ? 'Settle Up' : 'Who Owes You'}>
        {iOweMoney && myDebts.length > 0 && (
          <>
            {/* Mode toggle: Settle All vs Custom */}
            <div className="flex gap-1 bg-muted rounded-xl p-1 mb-4">
              <button onClick={() => { setSettleMode('all'); setCustomSelected(new Set()) }} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${settleMode === 'all' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                <Zap className="inline h-3 w-3" /> Settle All
              </button>
              <button onClick={() => setSettleMode('custom')} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${settleMode === 'custom' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                <Pencil className="inline h-3 w-3" /> Custom
              </button>
            </div>

            {settleMode === 'all' ? (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  {myDebts.length} payment{myDebts.length !== 1 ? 's' : ''} to clear all your debts
                </p>
                <div className="flex flex-col gap-3">
                  {myDebts.map((s, i) => (
                    <Card key={i} padding="md">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={s.fromName} size="sm" />
                          <div>
                            <p className="text-xs text-muted-foreground">you pay</p>
                            <p className="text-sm font-semibold">You</p>
                          </div>
                        </div>
                        <p className="text-lg font-bold text-primary">{formatINR(s.amount)}</p>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">to</p>
                            <p className="text-sm font-semibold">{s.toName}</p>
                          </div>
                          <Avatar name={s.toName} size="sm" />
                        </div>
                      </div>
                      <Button
                        fullWidth
                        size="sm"
                        onClick={() => handleSettle(s)}
                        isLoading={isPayingId === `${s.from}-${s.to}`}
                        disabled={!!isPayingId}
                      >
                        <CreditCard className="h-3.5 w-3.5" /> Pay {formatINR(s.amount)}
                      </Button>
                      {paymentError && isPayingId === null && (
                        <p className="text-xs text-destructive text-center mt-1">{paymentError}</p>
                      )}
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  Select which debts to settle now
                </p>
                <div className="flex flex-col gap-2 mb-4">
                  {myDebts.map((s, i) => {
                    const idx = activeSuggestions.findIndex(a => a.from === s.from && a.to === s.to)
                    const isSelected = customSelected.has(idx)
                    return (
                      <Card
                        key={i}
                        padding="sm"
                        className={`cursor-pointer transition-all ${isSelected ? 'border-primary bg-primary/5' : 'opacity-70'}`}
                        onClick={() => {
                          const next = new Set(customSelected)
                          if (isSelected) next.delete(idx); else next.add(idx)
                          setCustomSelected(next)
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
                            {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                          </div>
                          <Avatar name={s.toName} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">Pay {s.toName}</p>
                          </div>
                          <p className="text-sm font-bold text-primary shrink-0">{formatINR(s.amount)}</p>
                        </div>
                      </Card>
                    )
                  })}
                </div>

                {customSelected.size > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{customSelected.size} selected</span>
                      <span className="font-bold">
                        {formatINR(Array.from(customSelected).reduce((sum, idx) => sum + (activeSuggestions[idx]?.amount || 0), 0))}
                      </span>
                    </div>
                    {Array.from(customSelected).map((idx) => {
                      const s = activeSuggestions[idx]
                      if (!s) return null
                      return (
                        <Button
                          key={idx}
                          fullWidth
                          size="sm"
                          onClick={() => handleSettle(s)}
                          isLoading={isPayingId === `${s.from}-${s.to}`}
                          disabled={!!isPayingId}
                        >
                          <CreditCard className="h-3.5 w-3.5" /> Pay {s.toName} {formatINR(s.amount)}
                        </Button>
                      )
                    })}
                    {paymentError && isPayingId === null && (
                      <p className="text-xs text-destructive text-center">{paymentError}</p>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Carried forward note */}
            {cheapestResult && cheapestResult.carriedForward > 0 && (
              <Card className="mt-4 bg-muted/50 border-dashed" padding="sm">
                <p className="text-xs text-muted-foreground text-center">
                  <Lightbulb className="inline h-3 w-3" /> {formatINR(cheapestResult.carriedForward)} in small recent debts ({'<'}7 days) can be carried forward to reduce transactions
                </p>
              </Card>
            )}
          </>
        )}

        {/* Creditor section — people who owe you */}
        {myCredits.length > 0 && (
          <div className={iOweMoney && myDebts.length > 0 ? 'mt-6 pt-4 border-t border-border' : ''}>
            {iOweMoney && myDebts.length > 0 && <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">People who owe you</p>}

            {/* Remind All button */}
            {myCredits.length > 1 && (
              <Button
                fullWidth
                size="sm"
                variant="secondary"
                className="mb-3"
                isLoading={reminderLoading === 'all'}
                disabled={!!reminderLoading || reminderSent === 'all'}
                onClick={async () => {
                  setReminderLoading('all')
                  let successCount = 0
                  for (const s of myCredits) {
                    try {
                      const res = await fetch('/api/reminders', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ debtorId: s.from, groupId: id, amount: s.amount }),
                      })
                      if (res.ok) successCount++
                    } catch { /* skip */ }
                  }
                  setReminderLoading(null)
                  if (successCount > 0) {
                    setReminderSent('all')
                    setTimeout(() => setReminderSent(null), 3000)
                  }
                }}
              >
                {reminderSent === 'all' ? <><Check className="h-3.5 w-3.5" /> Reminded {myCredits.length}!</> : <><Bell className="h-3.5 w-3.5" /> Remind All ({myCredits.length})</>}
              </Button>
            )}

            <div className="flex flex-col gap-3">
              {myCredits.map((s, i) => (
                <Card key={i} padding="md">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={s.fromName} size="sm" />
                      <div>
                        <p className="text-xs text-muted-foreground">pays</p>
                        <p className="text-sm font-semibold">{s.fromName}</p>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-success">{formatINR(s.amount)}</p>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">to you</p>
                        <p className="text-sm font-semibold">You</p>
                      </div>
                      <Avatar name={s.toName} size="sm" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-center text-success font-medium">{s.fromName} owes you {formatINR(s.amount)}</p>
                    <input
                      type="text"
                      value={reminderSent === s.from ? '' : reminderText}
                      onChange={(e) => setReminderText(e.target.value)}
                      placeholder="Custom message (or leave empty for vibe text)..."
                      className="w-full rounded-lg border border-border bg-transparent px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <div className="flex gap-2">
                      <Button
                        fullWidth
                        size="sm"
                        variant="secondary"
                        isLoading={reminderLoading === s.from}
                        disabled={!!reminderLoading}
                        onClick={async () => {
                          setReminderLoading(s.from)
                          const customMsg = reminderText.trim()
                          if (customMsg) {
                            // Custom message — use direct notification
                            try {
                              await fetch('/api/notifications', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  toUserId: s.from,
                                  type: 'reminder',
                                  title: 'Payment Reminder',
                                  message: customMsg,
                                  groupId: id,
                                }),
                              })
                            } catch { /* silent */ }
                          } else {
                            // No custom message — use vibe-based reminder API
                            try {
                              const res = await fetch('/api/reminders', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ debtorId: s.from, groupId: id, amount: s.amount }),
                              })
                              if (!res.ok) {
                                const data = await res.json()
                                if (res.status === 429) {
                                  setReminderLoading(null)
                                  return // already sent recently
                                }
                              }
                            } catch { /* silent */ }
                          }
                          setReminderLoading(null)
                          setReminderSent(s.from)
                          setReminderText('')
                          setTimeout(() => setReminderSent(null), 3000)
                        }}
                      >
                        {reminderSent === s.from ? <><Check className="h-3.5 w-3.5" /> Sent!</> : <><Bell className="h-3.5 w-3.5" /> Remind</>}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => {
                        const msg = reminderText.trim() || `Hey ${s.fromName}, you owe me ${formatINR(s.amount)} for our group expenses. Please settle up!`
                        const debtorProfile = members.find(m => m.id === s.from)
                        const phone = (debtorProfile as any)?.phone?.replace(/[^0-9+]/g, '')
                        const waUrl = phone ? `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`
                        window.open(waUrl, '_blank')
                      }} title="Send via WhatsApp">
                        <WhatsAppIcon className="h-3.5 w-3.5 text-green-500" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Third party settlements (neither debtor nor creditor) */}
        {activeSuggestions.filter(s => s.from !== currentUser && s.to !== currentUser).length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Other settlements</p>
            <div className="flex flex-col gap-2">
              {activeSuggestions.filter(s => s.from !== currentUser && s.to !== currentUser).map((s, i) => (
                <Card key={i} padding="sm">
                  <p className="text-xs text-center text-muted-foreground">{s.fromName} → {s.toName}: {formatINR(s.amount)}</p>
                </Card>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* ═══ BALANCE DETAIL MODAL ═══ */}
      <Modal isOpen={!!showBalanceDetail} onClose={() => setShowBalanceDetail(null)} title={(() => {
        const u = members.find(m => m.id === showBalanceDetail)
        const isMe = showBalanceDetail === currentUser
        return isMe ? 'Your Balance Breakdown' : `${u?.full_name || 'Member'}'s Balance`
      })()}>
        {showBalanceDetail && (() => {
          const breakdown = getBalanceBreakdown(showBalanceDetail)
          const isMe = showBalanceDetail === currentUser
          const userName = members.find(m => m.id === showBalanceDetail)?.full_name || 'Member'

          return (
            <div className="flex flex-col gap-4">
              {/* Owes To section */}
              {breakdown.owesTo.size > 0 && (
                <div>
                  <p className="text-xs font-medium text-destructive uppercase tracking-wider mb-2">
                    {isMe ? 'You owe' : `${userName} owes`}
                  </p>
                  <div className="flex flex-col gap-2">
                    {Array.from(breakdown.owesTo.entries()).map(([personId, data]) => {
                      const person = members.find(m => m.id === personId)
                      return (
                        <Card key={personId} padding="sm">
                          <div className="flex items-center gap-2 mb-2">
                            <Avatar name={person?.full_name || '?'} imageUrl={person?.avatar_url} size="sm" />
                            <div className="flex-1">
                              <p className="text-sm font-semibold">{personId === currentUser ? 'You' : person?.full_name || 'Unknown'}</p>
                            </div>
                            <p className="text-sm font-bold text-destructive">{formatINR(data.total)}</p>
                          </div>
                          <div className="flex flex-col gap-1 pl-8">
                            {data.items.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="truncate flex-1">{item.category} {item.title}</span>
                                <span className="shrink-0 ml-2 font-medium">{formatINR(item.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Owed By section */}
              {breakdown.owedBy.size > 0 && (
                <div>
                  <p className="text-xs font-medium text-success uppercase tracking-wider mb-2">
                    {isMe ? 'Owed to you' : `Owed to ${userName}`}
                  </p>
                  <div className="flex flex-col gap-2">
                    {Array.from(breakdown.owedBy.entries()).map(([personId, data]) => {
                      const person = members.find(m => m.id === personId)
                      return (
                        <Card key={personId} padding="sm">
                          <div className="flex items-center gap-2 mb-2">
                            <Avatar name={person?.full_name || '?'} imageUrl={person?.avatar_url} size="sm" />
                            <div className="flex-1">
                              <p className="text-sm font-semibold">{personId === currentUser ? 'You' : person?.full_name || 'Unknown'}</p>
                            </div>
                            <p className="text-sm font-bold text-success">+{formatINR(data.total)}</p>
                          </div>
                          <div className="flex flex-col gap-1 pl-8">
                            {data.items.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="truncate flex-1">{item.category} {item.title}</span>
                                <span className="shrink-0 ml-2 font-medium">{formatINR(item.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )}

              {breakdown.owesTo.size === 0 && breakdown.owedBy.size === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">All settled up! No pending balances.</p>
              )}
            </div>
          )
        })()}
      </Modal>

      {/* ═══ CLOSE TRIP MODAL ═══ */}
      <Modal isOpen={showCloseTripModal} onClose={() => setShowCloseTripModal(false)} title="Close Trip & Exit">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">You have no pending debts. Closing the trip will:</p>
          <ul className="text-sm space-y-2">
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> Mark all your settlements as done</li>
            <li className="flex items-center gap-2"><LogOut className="h-4 w-4 text-warning" /> Remove you from the group</li>
          </ul>
          {myBalance && myBalance.net > 0 && (
            <Card className="bg-warning/5 border-warning/20" padding="sm">
              <p className="text-xs text-warning"><AlertTriangle className="inline h-3 w-3" /> People still owe you {formatINR(myBalance.net)}. Send reminders before leaving!</p>
            </Card>
          )}
          <div className="flex gap-2">
            <Button fullWidth variant="secondary" onClick={() => setShowCloseTripModal(false)}>Cancel</Button>
            <Button fullWidth onClick={handleCloseTrip}>Close & Exit</Button>
          </div>
        </div>
      </Modal>

      {/* ═══ TRIP RECAP MODAL ═══ */}
      <Modal isOpen={showRecapModal} onClose={() => setShowRecapModal(false)} title="">
        {(() => {
          const stats = getTripStats()
          const top = getTopContributor()
          return (
            <div className="flex flex-col items-center text-center gap-5 py-2">
              <div>
                <PartyPopper className="h-10 w-10 text-primary mx-auto mb-2" />
                <h2 className="text-xl font-black">{group.name} Recap</h2>
                <p className="text-xs text-muted-foreground mt-1">What a trip!</p>
              </div>

              <div className="w-full grid grid-cols-2 gap-3">
                <Card className="bg-primary/5" padding="sm">
                  <p className="text-xl font-black">{formatINR(stats.totalSpent)}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Total Spent</p>
                </Card>
                <Card className="bg-primary/5" padding="sm">
                  <p className="text-xl font-black">{formatINR(getMySpending())}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Your Spend</p>
                </Card>
              </div>

              <div className="w-full flex flex-col gap-2">
                {top && (
                  <div className="flex items-center gap-3 bg-warning/5 rounded-xl p-3">
                    <Crown className="h-6 w-6 text-warning" />
                    <div className="text-left">
                      <p className="text-sm font-bold">{top.name}</p>
                      <p className="text-xs text-muted-foreground">Top Spender · Covered {top.percentage}%</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 bg-muted rounded-xl p-3">
                  <Calendar className="h-6 w-6 text-primary" />
                  <div className="text-left">
                    <p className="text-sm font-bold">{stats.totalDays} Days</p>
                    <p className="text-xs text-muted-foreground">of adventure</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-muted rounded-xl p-3">
                  <Receipt className="h-6 w-6 text-primary" />
                  <div className="text-left">
                    <p className="text-sm font-bold">{stats.totalExpenses} Expenses</p>
                    <p className="text-xs text-muted-foreground">tracked</p>
                  </div>
                </div>
                {Array.from(stats.categoryCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([catId, count]) => {
                  const cat = [...TRIP_CATEGORIES, ...EXPENSE_CATEGORIES].find((c) => c.id === catId)
                  return (
                    <div key={catId} className="flex items-center gap-3 bg-muted rounded-xl p-3">
                      <Package className="h-6 w-6 text-primary" />
                      <div className="text-left">
                        <p className="text-sm font-bold">{count} {cat?.label || catId}</p>
                        <p className="text-xs text-muted-foreground">expenses</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <Button fullWidth onClick={() => {
                const text = `${group.name} Recap\nTotal: ${formatINR(stats.totalSpent)}\n${members.length} people\n${stats.totalDays} days\n${stats.totalExpenses} expenses\nTop Spender: ${top?.name || 'N/A'}\n\nTracked with Equilibrium`
                if (navigator.share) { navigator.share({ text }) } else { navigator.clipboard.writeText(text) }
              }}>
                <Send className="h-4 w-4" /> Share Recap
              </Button>
            </div>
          )
        })()}
      </Modal>

      {/* ═══ RAISE ISSUE MODAL ═══ */}
      <Modal isOpen={!!showIssueModal} onClose={() => setShowIssueModal(null)} title="Raise an Issue">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">What&apos;s wrong with this expense? The creator will be notified and the expense will be excluded from balances until resolved.</p>
          <textarea
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            placeholder="Describe the issue... (e.g., wrong amount, not part of this expense, duplicate entry)"
            rows={3}
            className="w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
          <Button
            fullWidth
            onClick={() => showIssueModal && raiseIssue(showIssueModal)}
            isLoading={issueSaving}
            disabled={!issueDescription.trim()}
          >
            <AlertTriangle className="h-4 w-4" /> Raise Issue
          </Button>
        </div>
      </Modal>

      {/* ═══ ISSUE DETAIL MODAL ═══ */}
      <Modal isOpen={!!showIssueDetailModal} onClose={() => setShowIssueDetailModal(null)} title="Expense Details">
        {showIssueDetailModal && (() => {
          const expense = expenses.find((e: any) => e.id === showIssueDetailModal)
          const issues = getExpenseIssues(showIssueDetailModal)
          const isCreator = expense?.paid_by === currentUser
          const openCount = issues.filter((i) => i.status === 'open').length
          const cat = categories.find((c) => c.id === expense?.category)
          return (
            <div className="flex flex-col gap-3">
              {expense && (
                <Card className={openCount > 0 ? 'bg-warning/5 border-warning/20' : 'bg-muted/50'} padding="md">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0"><CategoryIcon name={cat?.icon || 'package'} className="h-5 w-5 text-muted-foreground" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{expense.title}</p>
                      <p className="text-xs text-muted-foreground">{expense.profiles?.full_name} paid · {formatRelativeDate(expense.created_at)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <p className={`text-sm font-bold ${openCount > 0 ? 'line-through text-muted-foreground' : ''}`}>{formatINR(expense.amount)}</p>
                      {expense.original_currency && expense.original_currency !== 'INR' && (
                        <p className="text-[10px] text-muted-foreground">{formatCurrency(expense.original_amount, expense.original_currency)}</p>
                      )}
                      {openCount > 0 && (
                        <span className="text-[9px] bg-warning/20 text-warning px-1.5 py-0.5 rounded-full font-bold">
                          {openCount} open issue{openCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Split details */}
                  {expense.expense_splits && expense.expense_splits.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Split between</p>
                      <div className="flex flex-col gap-1.5">
                        {expense.expense_splits.map((split: any) => {
                          const member = members.find((m) => m.id === split.user_id)
                          return (
                            <div key={split.user_id} className="flex items-center justify-between">
                              <p className="text-xs">{member?.full_name || 'Unknown'}{split.user_id === currentUser ? ' (You)' : ''}</p>
                              <div className="text-right">
                                <p className="text-xs font-semibold">{formatINR(split.amount)}</p>
                                {expense.original_currency && expense.original_currency !== 'INR' && expense.amount > 0 && (
                                  <p className="text-[10px] text-muted-foreground">
                                    {formatCurrency(Math.round(split.amount / expense.amount * expense.original_amount * 100) / 100, expense.original_currency)}
                                  </p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {/* Issues list */}
              {issues.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Issues</p>
                  {issues.map((issue) => (
                    <Card key={issue.id} padding="sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-xs font-semibold">{(issue as any).profiles?.full_name || 'Member'}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{issue.description}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {issue.status === 'open' ? <><CircleDot className="inline h-3 w-3 text-destructive" /> Open</> : <><CheckCircle2 className="inline h-3 w-3 text-success" /> Resolved</>}
                          </p>
                        </div>
                        {issue.raised_by === currentUser && issue.status === 'open' && (
                          <Button size="sm" variant="secondary" onClick={() => resolveIssue(issue.id)}>
                            <ShieldCheck className="h-3.5 w-3.5" /> Resolve
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </>
              )}

              {/* No issues — show raise option if not creator */}
              {issues.length === 0 && !isCreator && (
                <Button fullWidth variant="secondary" onClick={() => {
                  setShowIssueDetailModal(null)
                  setShowIssueModal(expense?.id || null)
                  setIssueDescription('')
                }}>
                  <AlertTriangle className="h-4 w-4" /> Raise an Issue
                </Button>
              )}

              {/* Creator actions on conflicted expense */}
              {isCreator && openCount > 0 && (
                <div className="flex gap-2 mt-2">
                  <Button fullWidth variant="secondary" onClick={() => {
                    setShowIssueDetailModal(null)
                    setShowEditExpenseModal(expense)
                    setEditForm({ title: expense.title, amount: String(expense.amount), category: expense.category || '' })
                    setEditProofFile(null)
                  }}>
                    <Edit3 className="h-4 w-4" /> Edit Expense
                  </Button>
                  <Button fullWidth variant="secondary" onClick={() => { setShowIssueDetailModal(null); deleteConflictedExpense(showIssueDetailModal) }}>
                    <Trash2 className="h-4 w-4 text-destructive" /> Delete
                  </Button>
                </div>
              )}
            </div>
          )
        })()}
      </Modal>

      {/* ═══ EDIT CONFLICTED EXPENSE MODAL ═══ */}
      <Modal isOpen={!!showEditExpenseModal} onClose={() => setShowEditExpenseModal(null)} title="Edit Expense">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">Edit this conflicted expense. Issue raisers will be notified of changes.</p>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
            <input
              type="text"
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              className="w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Amount (₹)</label>
            <input
              type="number"
              value={editForm.amount}
              onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
              className="w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
            <div className="grid grid-cols-4 gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setEditForm({ ...editForm, category: cat.id })}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${editForm.category === cat.id ? 'bg-primary/10 border-primary/50' : 'border-border'}`}
                >
                  <CategoryIcon name={cat.icon} className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[9px]">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
          {/* Proof / Receipt Upload */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Proof (optional)</label>
            {showEditExpenseModal?.proof_url && !editProofFile && (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-xl mb-2">
                <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                <a href={showEditExpenseModal.proof_url} target="_blank" rel="noreferrer" className="text-[11px] text-primary truncate flex-1">
                  View existing proof
                </a>
              </div>
            )}
            {editProofFile ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-xl">
                <Paperclip className="h-4 w-4 text-primary shrink-0" />
                <p className="text-xs flex-1 truncate">{editProofFile.name}</p>
                <button onClick={() => setEditProofFile(null)} className="shrink-0">
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 px-3 py-3 border border-dashed border-border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{showEditExpenseModal?.proof_url ? 'Replace proof' : 'Attach receipt or proof'}</p>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) setEditProofFile(file)
                  }}
                />
              </label>
            )}
          </div>

          <Button fullWidth onClick={saveEditExpense} isLoading={editSaving}>
            <Check className="h-4 w-4" /> Save Changes
          </Button>
        </div>
      </Modal>

      {/* ═══ SPEND LIMIT MODAL ═══ */}
      <Modal isOpen={showSpendLimitModal} onClose={() => setShowSpendLimitModal(false)} title="Trip Spend Limit">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">Set a personal spending limit for this trip. Only you can see this.</p>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Limit Amount (₹)</label>
            <input
              type="number"
              value={spendLimitInput}
              onChange={(e) => setSpendLimitInput(e.target.value)}
              placeholder="e.g. 5000"
              className="w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <Button fullWidth onClick={saveSpendLimit} isLoading={spendLimitSaving} disabled={!spendLimitInput.trim()}>
            <Target className="h-4 w-4" /> {spendLimit !== null ? 'Update Limit' : 'Set Limit'}
          </Button>
          {spendLimit !== null && (
            <Button fullWidth variant="secondary" onClick={removeSpendLimit}>
              Remove Limit
            </Button>
          )}
        </div>
      </Modal>

      {/* ═══ INVITE FRIENDS MODAL ═══ */}
      <Modal isOpen={showInviteModal} onClose={() => { setShowInviteModal(false); setInviteSearch('') }} title="Add Friends to Group">
        {inviteFriends.length > 3 && (
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={inviteSearch}
              onChange={(e) => setInviteSearch(e.target.value)}
              placeholder="Search friends..."
              className="w-full rounded-lg border border-border bg-transparent pl-9 pr-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        )}

        {inviteFriendsLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : inviteFriends.length > 0 ? (
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {inviteFriends
              .filter((f: any) =>
                !inviteSearch.trim() ||
                f.profile?.full_name?.toLowerCase().includes(inviteSearch.toLowerCase()) ||
                f.profile?.email?.toLowerCase().includes(inviteSearch.toLowerCase())
              )
              .map((friend: any) => {
                const isDone = invitedFriends.has(friend.friendId)
                return (
                  <div key={friend.friendId} className="flex items-center gap-2.5">
                    <Avatar name={friend.profile?.full_name || '?'} imageUrl={friend.profile?.avatar_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{friend.profile?.full_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{friend.profile?.email}</p>
                    </div>
                    {isDone ? (
                      <span className="text-[10px] bg-success/10 text-success px-2 py-1 rounded-full font-medium">
                        {friend.allowDirectAdd ? '✓ Added' : 'Invited'}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant={friend.allowDirectAdd ? 'primary' : 'secondary'}
                        onClick={() => addOrInviteFriendToGroup(friend.friendId, friend.allowDirectAdd)}
                        isLoading={invitingFriendId === friend.friendId}
                        disabled={!!invitingFriendId}
                      >
                        {friend.allowDirectAdd ? (
                          <><UserPlus className="h-3 w-3" /> Add</>
                        ) : (
                          <><Send className="h-3 w-3" /> Invite</>
                        )}
                      </Button>
                    )}
                  </div>
                )
              })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">
            No friends available to add. Add friends from the Friends page first!
          </p>
        )}
      </Modal>

      {/* ═══ GROUP SETTINGS MODAL ═══ */}
      <Modal isOpen={showGroupSettings} onClose={() => setShowGroupSettings(false)} title="Group Settings">
        <div className="flex flex-col gap-4">
          {/* Edit Group Details — owner only */}
          {isOwner && !isTerminated && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Edit Group</p>

              {/* Group Image */}
              <div className="mb-3">
                <button
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'image/*'
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0]
                      if (file) {
                        setEditGroupImageFile(file)
                        setEditGroupImagePreview(URL.createObjectURL(file))
                      }
                    }
                    input.click()
                  }}
                  className="w-full h-24 rounded-xl border-2 border-dashed border-border bg-muted/50 flex flex-col items-center justify-center gap-1 overflow-hidden"
                >
                  {editGroupImagePreview ? (
                    <img src={editGroupImagePreview} alt="Group" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <ImagePlus className="h-5 w-5 text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground">Change group image</p>
                    </>
                  )}
                </button>
              </div>

              {/* Group Name */}
              <div className="mb-3">
                <label className="text-xs text-muted-foreground mb-1 block">Group Name</label>
                <input
                  type="text"
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Nudge Vibe */}
              <div className="mb-3">
                <label className="text-xs text-muted-foreground mb-2 block">Nudge Vibe</label>
                <div className="flex gap-2">
                  {([
                    { id: 'chill' as const, label: 'Chill', Icon: Smile },
                    { id: 'formal' as const, label: 'Formal', Icon: Briefcase },
                    { id: 'roast' as const, label: 'Roast', Icon: Flame },
                  ]).map(p => (
                    <button
                      key={p.id}
                      onClick={() => setEditGroupPersonality(p.id)}
                      className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all ${
                        editGroupPersonality === p.id
                          ? 'border-primary bg-primary/10 ring-1 ring-primary'
                          : 'border-border bg-muted/50'
                      }`}
                    >
                      <p.Icon className={`h-4 w-4 ${editGroupPersonality === p.id ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-[10px] font-medium">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Button fullWidth size="sm" onClick={saveGroupDetails} isLoading={editGroupSaving} disabled={!editGroupName.trim()}>
                Save Changes
              </Button>
            </div>
          )}

          {/* Debt Limit */}
          {!isTerminated && isOwner && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Debt Limit</p>
              <p className="text-xs text-muted-foreground mb-3">
                If set, members who owe ≥ this amount can&apos;t be added as debtors in new expenses until they settle some debt.
              </p>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium">₹</span>
                <input
                  type="number"
                  value={debtLimitInput}
                  onChange={(e) => setDebtLimitInput(e.target.value)}
                  placeholder="e.g. 5000"
                  className="flex-1 rounded-xl border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" size="sm" onClick={saveDebtLimit} isLoading={debtLimitSaving}>
                  {debtLimit ? 'Update' : 'Set'} Limit
                </Button>
                {debtLimit && (
                  <Button size="sm" variant="secondary" onClick={() => { setDebtLimitInput(''); saveDebtLimit() }}>
                    Remove
                  </Button>
                )}
              </div>
              {debtLimit && (
                <p className="text-xs text-primary mt-2">Current limit: {formatINR(debtLimit)}</p>
              )}
            </div>
          )}

          {/* Member Limit */}
          {!isTerminated && isOwner && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Member Limit</p>
              <p className="text-xs text-muted-foreground mb-3">
                Maximum members allowed in this group (2–30).
              </p>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="number"
                  min={2}
                  max={30}
                  value={memberLimitInput}
                  onChange={(e) => setMemberLimitInput(e.target.value)}
                  placeholder="30"
                  className="flex-1 rounded-xl border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <span className="text-xs text-muted-foreground">/ 30 max</span>
              </div>
              <Button fullWidth size="sm" onClick={saveMemberLimit} isLoading={memberLimitSaving}>
                {memberLimit !== 30 ? 'Update' : 'Set'} Limit
              </Button>
              <p className="text-xs text-primary mt-2">Current: {memberLimit} members · {members.length} joined</p>
            </div>
          )}

          {/* Join Mode Toggle */}
          {!isTerminated && isOwner && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Join Mode</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{joinMode === 'open' ? 'Open Join' : 'Request to Join'}</p>
                  <p className="text-xs text-muted-foreground">
                    {joinMode === 'open'
                      ? 'Anyone with the invite code can join directly'
                      : 'New members must request and wait for approval'}
                  </p>
                </div>
                <button
                  onClick={toggleJoinMode}
                  disabled={joinModeSaving}
                  className="shrink-0"
                >
                  {joinModeSaving ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : joinMode === 'request' ? (
                    <ToggleRight className="h-8 w-8 text-primary" />
                  ) : (
                    <ToggleLeft className="h-8 w-8 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Trip Ended Toggle (trip mode only, creator only) */}
          {isTrip && isOwner && !isTerminated && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Trip Status</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Trip is over</p>
                  <p className="text-xs text-muted-foreground">
                    {tripEndedToggle
                      ? 'Members can now Close & Exit once settled'
                      : 'Toggle when the trip ends to allow members to close & exit'}
                  </p>
                </div>
                <button
                  onClick={toggleTripEnded}
                  disabled={tripEndedSaving}
                  className="shrink-0"
                >
                  {tripEndedSaving ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : tripEndedToggle ? (
                    <ToggleRight className="h-8 w-8 text-success" />
                  ) : (
                    <ToggleLeft className="h-8 w-8 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Danger Zone */}
          <div className="pt-3 border-t border-border">
            <p className="text-xs font-medium text-destructive uppercase tracking-wider mb-2">Danger Zone</p>
            <div className="flex flex-col gap-2">
              {/* Terminate — owner only, not already terminated */}
              {isOwner && !isTerminated && (
                <Button fullWidth variant="secondary" onClick={() => setShowTerminateModal(true)} className="text-destructive border-destructive/30">
                  <Ban className="h-4 w-4" /> Terminate Group
                </Button>
              )}
              {/* Leave — everyone, not terminated */}
              {!isTerminated && !isTrip && (
                <Button
              fullWidth
              variant="secondary"
              className="text-warning border-warning/30"
              onClick={() => {
                setLeaveError('')
                const otherMembers = members.filter(m => m.id !== currentUser)
                if (otherMembers.length === 0) {
                  setShowDeleteModal(true)
                } else if (isOwner) {
                  setTransferToId('')
                  setShowTransferModal(true)
                } else {
                  setShowLeaveModal(true)
                }
              }}
            >
                  <LogOut className="h-4 w-4" /> Leave Group
                </Button>
              )}
              {isTerminated && (
                <p className="text-xs text-muted-foreground text-center py-2">This group has been terminated. No actions available.</p>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* ═══ TERMINATE GROUP MODAL ═══ */}
      <Modal isOpen={showTerminateModal} onClose={() => { setShowTerminateModal(false); setTerminateConfirmName('') }} title="Terminate Group">
        <div className="flex flex-col gap-4">
          <Card className="bg-destructive/5 border-destructive/20" padding="md">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive">This action is permanent</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Terminating will permanently freeze this group. No more expenses, settlements, or any operations will be possible. Data will be preserved but balances will be excluded from your dashboard.
                </p>
              </div>
            </div>
          </Card>
          <div>
            <p className="text-sm mb-2">
              Type <span className="font-bold">{group.name}</span> to confirm:
            </p>
            <input
              type="text"
              value={terminateConfirmName}
              onChange={(e) => setTerminateConfirmName(e.target.value)}
              placeholder={group.name}
              className="w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-destructive/50"
            />
          </div>
          <div className="flex gap-2">
            <Button fullWidth variant="secondary" onClick={() => { setShowTerminateModal(false); setTerminateConfirmName('') }}>
              Cancel
            </Button>
            <Button
              fullWidth
              onClick={terminateGroup}
              isLoading={isTerminating}
              disabled={terminateConfirmName.trim() !== group.name}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              <Ban className="h-4 w-4" /> Terminate
            </Button>
          </div>
        </div>
      </Modal>

      {/* ═══ TRANSFER OWNERSHIP MODAL ═══ */}
      <Modal isOpen={showTransferModal} onClose={() => setShowTransferModal(false)} title="Transfer Ownership">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">You are the owner. Choose a member to hand ownership to before leaving.</p>
          <div className="flex flex-col gap-2">
            {members.filter(m => m.id !== currentUser).map(m => (
              <button
                key={m.id}
                onClick={() => setTransferToId(m.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  transferToId === m.id ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <Avatar name={m.full_name} imageUrl={m.avatar_url} size="sm" />
                <p className="text-sm font-medium flex-1 text-left">{m.full_name}</p>
                {transferToId === m.id && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
          {leaveError && <p className="text-xs text-destructive">{leaveError}</p>}
          <div className="flex gap-2">
            <Button fullWidth variant="secondary" onClick={() => setShowTransferModal(false)}>Cancel</Button>
            <Button fullWidth onClick={transferOwnershipAndLeave} isLoading={isTransferring} disabled={!transferToId}>
              <Crown className="h-4 w-4" /> Transfer & Leave
            </Button>
          </div>
        </div>
      </Modal>

      {/* ═══ DELETE GROUP MODAL (alone in group) ═══ */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Group">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            There are no other members in this group. Would you like to delete it instead?
          </p>
          <div className="flex gap-2">
            <Button fullWidth variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button fullWidth onClick={deleteGroupAndLeave} isLoading={isDeleteLeaving} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              <Trash2 className="h-4 w-4" /> Delete Group
            </Button>
          </div>
        </div>
      </Modal>

      {/* ═══ LEAVE GROUP MODAL ═══ */}
      <Modal isOpen={showLeaveModal} onClose={() => setShowLeaveModal(false)} title="Leave Group">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Leaving will remove you from this group. Your past expenses and settlements will be preserved in the group&apos;s history.
          </p>
          <ul className="text-sm space-y-2">
            <li className="flex items-center gap-2"><LogOut className="h-4 w-4 text-warning" /> You&apos;ll be removed from the group</li>
            <li className="flex items-center gap-2"><Receipt className="h-4 w-4 text-muted-foreground" /> Your expense history stays</li>
            <li className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /> You must have zero balance to leave</li>
          </ul>
          {leaveError && (
            <Card className="bg-destructive/5 border-destructive/20" padding="sm">
              <p className="text-xs text-destructive">{leaveError}</p>
            </Card>
          )}
          <div className="flex gap-2">
            <Button fullWidth variant="secondary" onClick={() => setShowLeaveModal(false)}>Cancel</Button>
            <Button fullWidth onClick={leaveGroup} isLoading={isLeaving}>
              <LogOut className="h-4 w-4" /> Leave
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── QR Code Modal ── */}
      <Modal isOpen={showQrModal} onClose={() => setShowQrModal(false)} title="Group QR Code">
        <div className="flex flex-col items-center gap-5">
          {qrRefreshing ? (
            <div className="bg-white p-4 rounded-2xl w-[252px] h-[252px] flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="qr-modal-svg bg-white p-4 rounded-2xl">
              <QRCodeSVG
                value={`equilibrium://join/${group?.invite_code}`}
                size={220}
                level="H"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
          )}
          <div className="text-center space-y-1">
            <p className="text-base font-semibold">{group?.name}</p>
            <p className="text-xs text-muted-foreground">Scan this QR code to join the group</p>
            <p className="text-xs font-mono text-muted-foreground tracking-widest mt-2">{group?.invite_code}</p>
            {(() => {
              const expiresAt = (group as any)?.invite_code_expires_at
              if (!expiresAt) return null
              const diff = new Date(expiresAt).getTime() - Date.now()
              if (diff <= 0) return <p className="text-[11px] text-red-400 mt-1">Code expired — refreshing…</p>
              const hours = Math.floor(diff / 3600000)
              const mins = Math.floor((diff % 3600000) / 60000)
              return <p className="text-[11px] text-muted-foreground mt-1">Expires in {hours > 0 ? `${hours}h ` : ''}{mins}m</p>
            })()}
          </div>
          <button
            onClick={() => refreshInviteCode()}
            disabled={qrRefreshing}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${qrRefreshing ? 'animate-spin' : ''}`} />
            Refresh Code
          </button>
          <div className="flex gap-3 w-full">
            <Button
              fullWidth
              variant="secondary"
              onClick={async () => {
                const svg = document.querySelector('.qr-modal-svg svg') as SVGSVGElement
                if (!svg) return
                try {
                  const blob = await qrSvgToBlob(svg)
                  const base64 = await blobToBase64(blob)
                  const fileName = `${group?.name || 'group'}-qr.png`
                  const cap = (window as any).Capacitor
                  if (cap?.isNativePlatform?.()) {
                    const Filesystem = cap.Plugins?.Filesystem
                    if (Filesystem) {
                      await Filesystem.writeFile({ path: fileName, data: base64, directory: 'CACHE', recursive: true })
                      const uri = (await Filesystem.getUri({ path: fileName, directory: 'CACHE' })).uri
                      // Use share to let user save to gallery/files
                      const Share = cap.Plugins?.Share
                      if (Share) {
                        await Share.share({ title: fileName, url: uri, dialogTitle: 'Save QR Code' })
                      } else {
                        alert('QR saved to app cache')
                      }
                    }
                  } else {
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = fileName
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                    setTimeout(() => URL.revokeObjectURL(url), 1000)
                  }
                } catch (e) {
                  console.error('Save QR failed:', e)
                }
              }}
            >
              <Download className="h-4 w-4" /> Save
            </Button>
            <Button
              fullWidth
              onClick={async () => {
                const svg = document.querySelector('.qr-modal-svg svg') as SVGSVGElement
                if (!svg) return
                const shareText = `Join my group "${group?.name}" on Equilibrium!\nInvite code: ${group?.invite_code}`
                try {
                  const blob = await qrSvgToBlob(svg)
                  const base64 = await blobToBase64(blob)
                  const cap = (window as any).Capacitor
                  if (cap?.isNativePlatform?.()) {
                    const Filesystem = cap.Plugins?.Filesystem
                    const Share = cap.Plugins?.Share
                    if (Filesystem && Share) {
                      const tmpFile = `qr-share-${Date.now()}.png`
                      await Filesystem.writeFile({ path: tmpFile, data: base64, directory: 'CACHE', recursive: true })
                      const uri = (await Filesystem.getUri({ path: tmpFile, directory: 'CACHE' })).uri
                      await Share.share({ title: `Join ${group?.name} on Equilibrium`, text: shareText, url: uri, dialogTitle: 'Share QR Code' })
                    } else {
                      await navigator.clipboard.writeText(shareText)
                    }
                  } else {
                    const file = new File([blob], `${group?.name || 'group'}-qr.png`, { type: 'image/png' })
                    if (navigator.canShare?.({ files: [file] })) {
                      await navigator.share({ title: `Join ${group?.name} on Equilibrium`, text: shareText, files: [file] })
                    } else if (navigator.share) {
                      await navigator.share({ title: `Join ${group?.name} on Equilibrium`, text: shareText })
                    } else {
                      await navigator.clipboard.writeText(shareText)
                    }
                  }
                } catch (e) {
                  if ((e as Error)?.name !== 'AbortError') console.error('Share QR failed:', e)
                }
              }}
            >
              <Share2 className="h-4 w-4" /> Share
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
