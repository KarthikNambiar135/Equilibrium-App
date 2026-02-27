'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import { ArrowLeft, Check, Paperclip, X, AlertTriangle, ChevronDown } from 'lucide-react'
import CategoryIcon from '@/components/ui/CategoryIcon'
import VideoLoader from '@/components/ui/VideoLoader'
import { EXPENSE_CATEGORIES, QUICK_PRESETS, TRIP_CATEGORIES, TRIP_QUICK_PRESETS, CURRENCIES, EXCHANGE_RATES_TO_INR, convertToINR, formatCurrency, type CurrencyCode } from '@/lib/utils/formatters'
import { buildDebtEdges, getOptimalSettlements, formatINR } from '@/lib/utils/settlement'
import type { Profile } from '@/lib/types/database'

type SplitType = 'equal' | 'percentage' | 'exact'

export default function NewExpensePage() {
  const { id: groupId } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [members, setMembers] = useState<Profile[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('food')
  const [paidBy, setPaidBy] = useState('')
  const [splitType, setSplitType] = useState<SplitType>('equal')
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const [customSplits, setCustomSplits] = useState<Map<string, string>>(new Map())
  const [step, setStep] = useState(1) // 1: details, 2: split
  const [proofFile, setProofFile] = useState<File | null>(null)
  // Currency (trip mode only)
  const [isTrip, setIsTrip] = useState(false)
  const [currency, setCurrency] = useState<CurrencyCode>('INR')
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)
  // Debt limit
  const [debtLimit, setDebtLimit] = useState<number | null>(null)
  const [memberDebts, setMemberDebts] = useState<Map<string, number>>(new Map()) // userId -> how much they owe (positive = owes)

  useEffect(() => {
    async function loadMembers() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)
      setPaidBy(user.id)

      const { data: memberData } = await supabase
        .from('group_members')
        .select('user_id, left_at, profiles(*)')
        .eq('group_id', groupId)
        .is('left_at', null)

      if (memberData) {
        const m = memberData.map((md: any) => md.profiles).filter(Boolean)
        setMembers(m)
        setSelectedMembers(new Set(m.map((p: Profile) => p.id)))
      }

      // Load group data (debt_limit + mode)
      const { data: groupData } = await supabase
        .from('groups')
        .select('debt_limit, mode')
        .eq('id', groupId)
        .single()

      const limit = (groupData as any)?.debt_limit ?? null
      setDebtLimit(limit)
      const tripMode = (groupData as any)?.mode === 'trip'
      setIsTrip(tripMode)

      // Calculate member debts if limit is set
      if (limit) {
        const { data: expenses } = await supabase
          .from('expenses')
          .select('id, paid_by, amount')
          .eq('group_id', groupId)
        const { data: splits } = await supabase
          .from('expense_splits')
          .select('expense_id, user_id, amount')
          .in('expense_id', (expenses || []).map((e: any) => e.id))
        const { data: settlements } = await supabase
          .from('settlements')
          .select('from_user, to_user, amount, status')
          .eq('group_id', groupId)
          .eq('status', 'completed')

        // Build net balances: positive = is owed, negative = owes
        const balanceMap = new Map<string, number>()
        ;(expenses || []).forEach((exp: any) => {
          balanceMap.set(exp.paid_by, (balanceMap.get(exp.paid_by) || 0) + exp.amount)
        })
        ;(splits || []).forEach((sp: any) => {
          balanceMap.set(sp.user_id, (balanceMap.get(sp.user_id) || 0) - sp.amount)
        })
        ;(settlements || []).forEach((s: any) => {
          balanceMap.set(s.from_user, (balanceMap.get(s.from_user) || 0) + s.amount)
          balanceMap.set(s.to_user, (balanceMap.get(s.to_user) || 0) - s.amount)
        })

        // Convert: debt = abs(negative balance)
        const debts = new Map<string, number>()
        balanceMap.forEach((bal, uid) => {
          if (bal < 0) debts.set(uid, Math.abs(bal))
        })
        setMemberDebts(debts)
      }

      setIsLoading(false)
    }

    loadMembers()
  }, [groupId, supabase])

  // When paidBy or debtLimit changes, remove debt-blocked members from selection
  useEffect(() => {
    if (!debtLimit) return
    setSelectedMembers(prev => {
      const next = new Set<string>()
      prev.forEach(uid => {
        if (!isMemberDebtBlocked(uid)) next.add(uid)
      })
      // Ensure at least the payer is selected
      if (next.size === 0 && paidBy) next.add(paidBy)
      return next
    })
  }, [paidBy, debtLimit, memberDebts])

  function applyPreset(preset: { label: string; category: string; icon: string }) {
    setTitle(preset.label)
    setCategory(preset.category)
  }

  function toggleMember(id: string) {
    // Don't allow toggling on a member blocked by debt limit (unless they're the payer)
    if (isMemberDebtBlocked(id) && !selectedMembers.has(id)) return
    const next = new Set(selectedMembers)
    if (next.has(id)) {
      if (next.size > 1) next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedMembers(next)
  }

  // Check if a member is blocked from being added as debtor due to debt limit
  function isMemberDebtBlocked(userId: string): boolean {
    if (!debtLimit) return false
    if (userId === paidBy) return false // payer is never blocked — paying reduces their debt
    const debt = memberDebts.get(userId) || 0
    return debt >= debtLimit
  }

  function getPerPersonAmount(): number {
    const total = parseFloat(amount) || 0
    const count = selectedMembers.size
    if (count === 0) return 0
    return Math.round((total / count) * 100) / 100
  }

  function getSplitAmount(userId: string): number {
    const total = parseFloat(amount) || 0
    if (splitType === 'equal') {
      return getPerPersonAmount()
    }
    if (splitType === 'percentage') {
      const pct = parseFloat(customSplits.get(userId) || '0')
      return Math.round((total * pct) / 100 * 100) / 100
    }
    if (splitType === 'exact') {
      return parseFloat(customSplits.get(userId) || '0')
    }
    return 0
  }

  function isSplitValid(): boolean {
    const total = parseFloat(amount) || 0
    if (total <= 0) return false

    if (splitType === 'equal') return selectedMembers.size > 0

    if (splitType === 'percentage') {
      let sum = 0
      selectedMembers.forEach((id) => {
        sum += parseFloat(customSplits.get(id) || '0')
      })
      return Math.abs(sum - 100) < 0.01
    }

    if (splitType === 'exact') {
      let sum = 0
      selectedMembers.forEach((id) => {
        sum += parseFloat(customSplits.get(id) || '0')
      })
      return Math.abs(sum - total) < 0.01
    }

    return false
  }

  async function handleSave() {
    if (!title.trim() || !amount || !isSplitValid()) return
    setIsSaving(true)

    const total = parseFloat(amount)
    const amountInINR = currency !== 'INR' ? convertToINR(total, currency) : total

    // Create expense
    const { data: expense, error } = await (supabase
      .from('expenses') as any)
      .insert({
        group_id: groupId,
        paid_by: paidBy,
        title: title.trim(),
        amount: amountInINR,
        category,
        split_type: splitType,
        date: new Date().toISOString().split('T')[0],
        ...(currency !== 'INR' ? { original_currency: currency, original_amount: total } : {}),
      })
      .select()
      .single()

    if (error || !expense) {
      setIsSaving(false)
      return
    }

    // Create splits
    const splits = Array.from(selectedMembers).map((userId) => ({
      expense_id: (expense as any).id,
      user_id: userId,
      amount: getSplitAmount(userId),
      percentage: splitType === 'percentage'
        ? parseFloat(customSplits.get(userId) || '0')
        : null,
    }))

    const { error: splitError } = await (supabase
      .from('expense_splits') as any)
      .insert(splits)

    if (splitError) {
      // Rollback expense
      await supabase.from('expenses').delete().eq('id', expense.id)
      setIsSaving(false)
      return
    }

    // Upload proof if provided
    if (proofFile && expense.id) {
      try {
        const formData = new FormData()
        formData.append('file', proofFile)

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })
        if (uploadRes.ok) {
          const { url } = await uploadRes.json()
          // Save proof URL to expense
          await fetch('/api/expenses/proof', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expenseId: expense.id, proofUrl: url }),
          })
        }
      } catch { /* proof upload failed silently */ }
    }

    // Log honesty event for expense with proof
    if (proofFile) {
      try {
        await fetch('/api/honesty', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventType: 'expense_with_proof', groupId, description: `Added proof to expense: ${title}` }),
        })
      } catch { /* silent */ }
    }

    // Try earning equipoints for large expenses
    if (total >= 2000) {
      try {
        await fetch('/api/equipoints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'expense', amount: total }),
        })
      } catch { /* silent */ }
    }

    // Notify group members about the new expense (best effort)
    try {
      await fetch('/api/expenses/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          title: title.trim(),
          amount: total,
          splits: Array.from(selectedMembers),
        }),
      })
    } catch { /* silent */ }

    router.push(`/groups/${groupId}`)
    router.refresh()
  }

  if (isLoading) {
    return <VideoLoader />
  }

  return (
    <div className="px-5 pt-14 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => {
            if (step > 1) setStep(step - 1)
            else router.back()
          }}
          className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-bold">Add Expense</h1>
      </div>

      {/* Step Indicator */}
      <div className="flex gap-2 mb-6">
        <div className={`flex-1 h-1 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
        <div className={`flex-1 h-1 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
      </div>

      {/* Step 1: Expense Details */}
      {step === 1 && (
        <div className="flex flex-col gap-5 animate-fade-in">
          {/* Quick Presets */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Quick Add
            </p>
            <div className="flex flex-wrap gap-2">
              {(isTrip ? TRIP_QUICK_PRESETS : QUICK_PRESETS).map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    title === preset.label
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  <CategoryIcon name={preset.icon} className="h-3.5 w-3.5" />
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <Input
            label="What's this for?"
            placeholder="e.g. Dinner at Barbeque Nation"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          {/* Amount */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Amount{isTrip && currency !== 'INR' ? ` (${currency})` : ''}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">
                {CURRENCIES.find(c => c.code === currency)?.symbol || '₹'}
              </span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full h-14 rounded-xl border border-border bg-background pl-10 pr-4 text-2xl font-bold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                required
              />
            </div>
            {isTrip && currency !== 'INR' && amount && (
              <p className="text-xs text-muted-foreground mt-1">
                ≈ {formatINR(convertToINR(parseFloat(amount), currency))} INR
              </p>
            )}
          </div>

          {/* Currency Picker (Trip mode only) */}
          {isTrip && (
            <div>
              <p className="text-sm font-medium mb-2">Currency</p>
              <button
                onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-background hover:bg-muted/50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="text-lg">{CURRENCIES.find(c => c.code === currency)?.flag}</span>
                  <span className="text-sm font-medium">{CURRENCIES.find(c => c.code === currency)?.label}</span>
                  <span className="text-xs text-muted-foreground">({currency})</span>
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showCurrencyPicker ? 'rotate-180' : ''}`} />
              </button>
              {showCurrencyPicker && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-border bg-background shadow-lg">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => {
                        setCurrency(c.code as CurrencyCode)
                        setShowCurrencyPicker(false)
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors ${
                        currency === c.code ? 'bg-primary/10 text-primary' : ''
                      }`}
                    >
                      <span className="text-lg">{c.flag}</span>
                      <span className="text-sm font-medium flex-1">{c.label}</span>
                      <span className="text-xs text-muted-foreground">{c.code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Category */}
          <div>
            <p className="text-sm font-medium mb-2">Category</p>
            <div className="flex flex-wrap gap-2">
              {(isTrip ? TRIP_CATEGORIES : EXPENSE_CATEGORIES).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    category === cat.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  <CategoryIcon name={cat.icon} className="h-3.5 w-3.5" />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Paid By */}
          <div>
            <p className="text-sm font-medium mb-2">Paid by</p>
            <div className="flex flex-wrap gap-2">
              {members.map((member) => (
                <button
                  key={member.id}
                  onClick={() => setPaidBy(member.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    paidBy === member.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  <Avatar name={member.full_name} imageUrl={member.avatar_url} size="sm" />
                  <span>
                    {member.id === currentUserId ? 'You' : member.full_name.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Proof / Receipt Upload */}
          <div>
            <p className="text-sm font-medium mb-2">Proof (optional)</p>
            {proofFile ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-xl">
                <Paperclip className="h-4 w-4 text-primary shrink-0" />
                <p className="text-xs flex-1 truncate">{proofFile.name}</p>
                <button onClick={() => setProofFile(null)} className="shrink-0">
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 px-3 py-3 border border-dashed border-border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Attach receipt or proof image</p>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) setProofFile(file)
                  }}
                />
              </label>
            )}
          </div>

          <Button
            fullWidth
            size="lg"
            onClick={() => setStep(2)}
            disabled={!title.trim() || !amount || parseFloat(amount) <= 0}
          >
            Next — Split
          </Button>
        </div>
      )}

      {/* Step 2: Split Configuration */}
      {step === 2 && (
        <div className="flex flex-col gap-5 animate-fade-in">
          {/* Amount Summary */}
          <Card className="bg-primary/5 border-primary/20" padding="md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{title}</p>
                {currency !== 'INR' ? (
                  <>
                    <p className="text-xl font-bold">{formatCurrency(parseFloat(amount), currency)}</p>
                    <p className="text-xs text-muted-foreground">≈ {formatINR(convertToINR(parseFloat(amount), currency))}</p>
                  </>
                ) : (
                  <p className="text-xl font-bold">₹{parseFloat(amount).toLocaleString('en-IN')}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Paid by</p>
                <p className="text-sm font-semibold">
                  {paidBy === currentUserId
                    ? 'You'
                    : members.find((m) => m.id === paidBy)?.full_name.split(' ')[0]}
                </p>
              </div>
            </div>
          </Card>

          {/* Split Type */}
          <div>
            <p className="text-sm font-medium mb-2">Split Type</p>
            <div className="flex gap-1 bg-muted rounded-xl p-1">
              {([
                { id: 'equal' as SplitType, label: '= Equal' },
                { id: 'percentage' as SplitType, label: '% Percent' },
                { id: 'exact' as SplitType, label: '# Exact' },
              ]).map((st) => (
                <button
                  key={st.id}
                  onClick={() => {
                    setSplitType(st.id)
                    setCustomSplits(new Map())
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                    splitType === st.id
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Member Selection / Split Config */}
          <div>
            <p className="text-sm font-medium mb-2">
              Split between
              {splitType === 'equal' && (
                <span className="text-muted-foreground font-normal">
                  {' '}— ₹{getPerPersonAmount().toLocaleString('en-IN')} each
                </span>
              )}
            </p>

            <div className="flex flex-col gap-2">
              {members.map((member) => {
                const isSelected = selectedMembers.has(member.id)
                const isBlocked = isMemberDebtBlocked(member.id)
                return (
                  <Card
                    key={member.id}
                    padding="sm"
                    className={`${isBlocked ? 'opacity-40 border-destructive/30' : isSelected ? 'ring-1 ring-primary/30' : 'opacity-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleMember(member.id)}
                        disabled={isBlocked}
                        className={`h-5 w-5 rounded-md border flex items-center justify-center transition-all ${
                          isBlocked
                            ? 'border-destructive/40 bg-destructive/10 cursor-not-allowed'
                            : isSelected
                            ? 'bg-primary border-primary'
                            : 'border-border'
                        }`}
                      >
                        {isSelected && !isBlocked && <Check className="h-3 w-3 text-primary-foreground" />}
                        {isBlocked && <X className="h-3 w-3 text-destructive" />}
                      </button>
                      <Avatar name={member.full_name} imageUrl={member.avatar_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {member.id === currentUserId ? 'You' : member.full_name.split(' ')[0]}
                        </p>
                        {isBlocked && (
                          <p className="text-[10px] text-destructive flex items-center gap-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" /> Debt limit reached ({`₹${(memberDebts.get(member.id) || 0).toLocaleString('en-IN')}`})
                          </p>
                        )}
                      </div>

                      {splitType === 'equal' && isSelected && (
                        <p className="text-sm font-semibold text-primary">
                          ₹{getPerPersonAmount().toLocaleString('en-IN')}
                        </p>
                      )}

                      {splitType === 'percentage' && isSelected && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            inputMode="decimal"
                            value={customSplits.get(member.id) || ''}
                            onChange={(e) => {
                              const next = new Map(customSplits)
                              next.set(member.id, e.target.value)
                              setCustomSplits(next)
                            }}
                            placeholder="0"
                            className="w-16 h-8 rounded-lg border border-border bg-background px-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      )}

                      {splitType === 'exact' && isSelected && (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">₹</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={customSplits.get(member.id) || ''}
                            onChange={(e) => {
                              const next = new Map(customSplits)
                              next.set(member.id, e.target.value)
                              setCustomSplits(next)
                            }}
                            placeholder="0"
                            className="w-20 h-8 rounded-lg border border-border bg-background px-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>

            {/* Validation hint + Auto-adjust */}
            {splitType !== 'equal' && (
              <div className="mt-2 flex items-center justify-between">
                <div>
                  {splitType === 'percentage' && (
                    <p className={`text-xs ${isSplitValid() ? 'text-success' : 'text-muted-foreground'}`}>
                      Total:{' '}
                      {Array.from(selectedMembers).reduce(
                        (sum, id) => sum + (parseFloat(customSplits.get(id) || '0')),
                        0
                      ).toFixed(1)}
                      % / 100%
                    </p>
                  )}
                  {splitType === 'exact' && (
                    <p className={`text-xs ${isSplitValid() ? 'text-success' : 'text-muted-foreground'}`}>
                      Total: ₹
                      {Array.from(selectedMembers)
                        .reduce(
                          (sum, id) => sum + (parseFloat(customSplits.get(id) || '0')),
                          0
                        )
                        .toLocaleString('en-IN')}{' '}
                      / ₹{parseFloat(amount).toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
                {!isSplitValid() && (() => {
                  const filled = Array.from(selectedMembers).filter(id => parseFloat(customSplits.get(id) || '0') > 0)
                  const empty = Array.from(selectedMembers).filter(id => !parseFloat(customSplits.get(id) || '0'))
                  if (empty.length === 0) return null
                  const filledSum = filled.reduce((s, id) => s + parseFloat(customSplits.get(id) || '0'), 0)
                  const target = splitType === 'percentage' ? 100 : parseFloat(amount)
                  const remaining = target - filledSum
                  if (remaining <= 0) return null
                  return (
                    <button
                      onClick={() => {
                        const perPerson = remaining / empty.length
                        const next = new Map(customSplits)
                        empty.forEach(id => {
                          next.set(id, splitType === 'percentage'
                            ? perPerson.toFixed(1)
                            : perPerson.toFixed(2))
                        })
                        setCustomSplits(next)
                      }}
                      className="text-xs text-primary font-medium px-2 py-1 rounded-lg bg-primary/10"
                    >
                      Auto-adjust
                    </button>
                  )
                })()}
              </div>
            )}
          </div>

          <Button
            fullWidth
            size="lg"
            onClick={handleSave}
            isLoading={isSaving}
            disabled={!isSplitValid()}
          >
            Add Expense
          </Button>
        </div>
      )}
    </div>
  )
}
