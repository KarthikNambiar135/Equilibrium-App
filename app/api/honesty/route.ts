import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * ═══════════════════════════════════════════════════════════════
 * EQUILIBRIUM HONESTY SCORE ALGORITHM
 * ═══════════════════════════════════════════════════════════════
 * 
 * The honesty score is a composite metric (0-100) measuring a user's
 * financial reliability across all groups.
 * 
 * ── SCORE COMPONENTS (weighted) ──────────────────────────────
 * 
 * 1. ON-TIME PAYMENT RATE (weight: 0.40)
 *    - Settlements completed without any reminder sent = on-time
 *    - Settlements completed within 24h of creation = near-on-time
 *    - Score = (onTime * 1.0 + nearOnTime * 0.8) / totalSettlements
 * 
 * 2. SETTLEMENT COMPLETION RATE (weight: 0.30)
 *    - Total completed settlements / total settlements (including pending)
 *    - Pending settlements older than 7 days count against you
 * 
 * 3. DISPUTE PENALTY FACTOR (weight: 0.15)
 *    - Starts at 1.0 (no penalty)
 *    - Valid disputes (issues raised against your expenses that were resolved):
 *      - Each valid dispute: -0.05 from factor
 *      - If you fix quickly (within 1h): only -0.02
 *      - Repeated corrections (3+): additional -0.1 pattern penalty
 *    - Invalid/spam disputes (you raised issues marked resolved with no change):
 *      - Each: -0.03 from factor
 * 
 * 4. PROOF & TRANSPARENCY (weight: 0.15)
 *    - Percentage of expenses with receipts/proof attached
 *    - Bonus for consistent proof uploads
 * 
 * ── EVENT-BASED POINT ADJUSTMENTS ────────────────────────────
 * 
 * These are logged as honesty_events and affect the composite:
 * 
 *  +10 → Pays settlement on time (no reminder needed)
 *  +5  → Pays within 24 hours of creation  
 *  +3  → Confirms payment with proof/receipt
 *  −8  → Late payment (after reminder sent)
 *  −15 → Dispute raised against expense & corrected (valid dispute)
 *  −5  → Frequent partial unpaid balances (checked weekly)
 *  −10 → Invalid/spam dispute raised by user
 *  −20 → Repeated pattern of inaccurate expenses (3+ corrections)
 *  +2  → Expense created with proof attached
 *  +1  → Clean settlement (no disputes on related expenses)
 * 
 * ── FINAL SCORE CALCULATION ──────────────────────────────────
 * 
 * rawScore = (0.40 × onTimeRate) + (0.30 × completionRate) 
 *          + (0.15 × disputeFactor) + (0.15 × proofRate)
 * 
 * eventBonus = sum(honesty_events points) / scaleFactor
 *   - scaleFactor grows with total events to prevent inflation
 *   - Capped at ±15 points influence on final score
 * 
 * finalScore = clamp(rawScore × 100 + eventBonus, 0, 100)
 * 
 * New users start at 100 (benefit of the doubt) and the score
 * adjusts as they accumulate activity. Minimum 5 settlements
 * before the score becomes "active" (shown vs hidden).
 * 
 * ═══════════════════════════════════════════════════════════════
 */

// GET — Calculate and return honesty score for a user
// ?userId=xxx (optional, defaults to current user)
// ?groupId=xxx (optional, filter to specific group)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const targetUserId = request.nextUrl.searchParams.get('userId') || user.id
    const groupId = request.nextUrl.searchParams.get('groupId')

    // ── Gather all data ──────────────────────────────────────
    
    // 1a. All settlements where this user is the PAYER (from_user) — used for honesty calc
    let settlementsAsPayerQuery = supabase
      .from('settlements')
      .select('*')
      .eq('from_user', targetUserId)
    if (groupId) settlementsAsPayerQuery = settlementsAsPayerQuery.eq('group_id', groupId)
    const { data: settlementsAsPayer } = await settlementsAsPayerQuery

    // 1b. All settlements where this user is the RECEIVER (to_user) — for complete stats
    let settlementsAsReceiverQuery = supabase
      .from('settlements')
      .select('*')
      .eq('to_user', targetUserId)
    if (groupId) settlementsAsReceiverQuery = settlementsAsReceiverQuery.eq('group_id', groupId)
    const { data: settlementsAsReceiver } = await settlementsAsReceiverQuery

    // Merge all settlements for stats (deduped)
    const allSettlementsMap = new Map<string, any>()
    ;(settlementsAsPayer || []).forEach(s => allSettlementsMap.set(s.id, s))
    ;(settlementsAsReceiver || []).forEach(s => allSettlementsMap.set(s.id, s))
    const settlements = settlementsAsPayer // Keep payer-only for honesty calc
    const allUserSettlements = Array.from(allSettlementsMap.values()) // Both directions for stats

    // 2. All expenses created by this user
    let expensesQuery = supabase
      .from('expenses')
      .select('id, created_at, receipt_url, proof_url, group_id')
      .eq('paid_by', targetUserId)
    if (groupId) expensesQuery = expensesQuery.eq('group_id', groupId)
    const { data: expenses } = await expensesQuery

    // 3. Issues raised AGAINST this user's expenses
    const expenseIds = (expenses || []).map(e => e.id)
    let issuesAgainst: any[] = []
    if (expenseIds.length > 0) {
      const { data } = await supabase
        .from('expense_issues')
        .select('*')
        .in('expense_id', expenseIds)
      issuesAgainst = data || []
    }

    // 4. Issues raised BY this user
    let issuesByQuery = supabase
      .from('expense_issues')
      .select('*')
      .eq('raised_by', targetUserId)
    const { data: issuesBy } = await issuesByQuery

    // 5. Notifications (to detect reminders sent to this user)
    const { data: reminders } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('type', 'reminder')

    // 6. Honesty events log
    let eventsQuery = supabase
      .from('honesty_events')
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (groupId) eventsQuery = eventsQuery.eq('group_id', groupId)
    const { data: events } = await eventsQuery

    // ── Calculate Components ─────────────────────────────────
    
    const allSettlements = settlements || []
    const completedSettlements = allSettlements.filter(s => s.status === 'completed')
    const totalSettlements = allSettlements.length

    // === Component 1: On-Time Payment Rate (40%) ===
    let onTimeCount = 0
    let nearOnTimeCount = 0
    const reminderSet = new Set((reminders || []).map((r: any) => r.group_id))
    
    completedSettlements.forEach(s => {
      const created = new Date(s.created_at).getTime()
      const settled = new Date(s.settled_at || s.created_at).getTime()
      const hoursToSettle = (settled - created) / (1000 * 60 * 60)
      
      // Check if a reminder was sent for this group around this time
      const hadReminder = reminderSet.has(s.group_id)
      
      if (!hadReminder && hoursToSettle <= 48) {
        onTimeCount++ // No reminder needed, settled within 48h
      } else if (hoursToSettle <= 24) {
        nearOnTimeCount++ // Settled within 24h even if reminded
      }
    })
    
    const onTimeRate = totalSettlements > 0 
      ? (onTimeCount * 1.0 + nearOnTimeCount * 0.8) / Math.max(totalSettlements, 1)
      : 0.5 // neutral when no settlements — not perfect

    // === Component 2: Settlement Completion Rate (30%) ===
    const oldPending = allSettlements.filter(s => {
      if (s.status !== 'pending') return false
      const age = Date.now() - new Date(s.created_at).getTime()
      return age > 7 * 24 * 60 * 60 * 1000 // older than 7 days
    })
    
    const completionRate = totalSettlements > 0
      ? (completedSettlements.length) / (totalSettlements + oldPending.length * 0.5)
      : 0.5 // neutral when no settlements — not perfect

    // === Component 3: Dispute Penalty Factor (15%) ===
    let disputeFactor = 1.0
    
    // Valid disputes against my expenses (I made mistakes)
    const validDisputes = issuesAgainst.filter(i => i.status === 'resolved')
    validDisputes.forEach(issue => {
      const created = new Date(issue.created_at).getTime()
      const resolved = issue.resolved_at ? new Date(issue.resolved_at).getTime() : Date.now()
      const hoursToFix = (resolved - created) / (1000 * 60 * 60)
      
      if (hoursToFix <= 1) {
        disputeFactor -= 0.02 // Quick fix — small penalty
      } else {
        disputeFactor -= 0.05 // Slow fix — normal penalty
      }
    })
    
    // Pattern penalty: 3+ corrections = careless pattern
    if (validDisputes.length >= 3) {
      disputeFactor -= 0.1
    }
    if (validDisputes.length >= 6) {
      disputeFactor -= 0.15 // serious pattern
    }

    // Invalid disputes I raised (abuse/spam)
    const myResolvedIssues = (issuesBy || []).filter((i: any) => i.status === 'resolved')
    // If issue was resolved but the expense wasn't changed — it was likely invalid
    // Simplified: count resolved issues I raised as slight penalty
    const invalidDisputePenalty = Math.min(myResolvedIssues.length * 0.03, 0.2)
    disputeFactor -= invalidDisputePenalty
    
    disputeFactor = Math.max(0, Math.min(1, disputeFactor))

    // === Component 4: Proof & Transparency Rate (15%) ===
    const allExpenses = expenses || []
    const withProof = allExpenses.filter(e => e.receipt_url || (e as any).proof_url)
    const proofRate = allExpenses.length > 0
      ? withProof.length / allExpenses.length
      : 0.5 // neutral when no expenses

    // ── Combine Components ───────────────────────────────────
    const rawScore = (0.40 * onTimeRate) + (0.30 * completionRate) 
                   + (0.15 * disputeFactor) + (0.15 * proofRate)

    // Event bonus/penalty (capped at ±15)
    const eventPoints = (events || []).reduce((sum: number, e: any) => sum + (e.points || 0), 0)
    const scaleFactor = Math.max(10, (events || []).length * 2)
    const eventBonus = Math.max(-15, Math.min(15, eventPoints / scaleFactor * 15))

    let finalScore = Math.floor(Math.max(0, Math.min(100, rawScore * 100 + eventBonus)))

    // If less than 5 settlements, score is provisional (shown but marked)
    const isProvisional = totalSettlements < 5
    const isTrulyNew = totalSettlements === 0 && allExpenses.length === 0 && (events || []).length === 0
    if (isTrulyNew) {
      finalScore = 75 // Neutral default for brand-new users with zero activity
    }

    // Update profile honesty_score
    if (targetUserId === user.id) {
      await (supabase.from('profiles') as any)
        .update({ honesty_score: finalScore })
        .eq('id', user.id)
    }

    // ── Breakdown for UI ─────────────────────────────────────
    return NextResponse.json({
      score: finalScore,
      isProvisional,
      breakdown: {
        onTimeRate: Math.round(onTimeRate * 100),
        completionRate: Math.round(Math.min(1, completionRate) * 100),
        disputeFactor: Math.round(disputeFactor * 100),
        proofRate: Math.round(proofRate * 100),
      },
      stats: {
        totalSettlements: allUserSettlements.length,
        completedSettlements: allUserSettlements.filter(s => s.status === 'completed').length,
        onTimePayments: onTimeCount,
        nearOnTimePayments: nearOnTimeCount,
        totalExpenses: allExpenses.length,
        expensesWithProof: withProof.length,
        disputesAgainst: validDisputes.length,
        disputesRaised: (issuesBy || []).length,
        oldPendingSettlements: oldPending.length,
      },
      debug: {
        rawOnTimeRate: onTimeRate,
        rawCompletionRate: completionRate,
        rawDisputeFactor: disputeFactor,
        rawProofRate: proofRate,
        rawScore,
        eventPoints,
        scaleFactor,
        eventBonus: Math.round(eventBonus * 100) / 100,
        formula: isTrulyNew
          ? `final = 75 (default — no activity yet)`
          : `final = clamp(${(rawScore * 100).toFixed(1)} + ${eventBonus.toFixed(1)}, 0, 100) = ${finalScore}`,
        overridden: isTrulyNew ? 'Yes — brand-new user default (75)' : null,
        weights: '0.40×onTime + 0.30×completion + 0.15×dispute + 0.15×proof',
        componentCalc: `0.40×${onTimeRate.toFixed(3)} + 0.30×${completionRate.toFixed(3)} + 0.15×${disputeFactor.toFixed(3)} + 0.15×${proofRate.toFixed(3)} = ${rawScore.toFixed(4)}`,
      },
      recentEvents: (events || []).slice(0, 20),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — Log a honesty event (called from settlement/expense flows)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { eventType, groupId, targetUserId, metadata } = await request.json()
    if (!eventType) return NextResponse.json({ error: 'eventType required' }, { status: 400 })

    const userId = targetUserId || user.id

    // Determine points based on event type
    const EVENT_POINTS: Record<string, { points: number; description: string }> = {
      'settlement_ontime':       { points: +10, description: 'Settled on time — no reminder needed' },
      'settlement_within_24h':   { points: +5,  description: 'Settled within 24 hours' },
      'settlement_with_proof':   { points: +3,  description: 'Settlement confirmed with proof' },
      'settlement_late':         { points: -8,  description: 'Late payment — after reminder' },
      'dispute_valid':           { points: -15, description: 'Dispute raised & expense corrected' },
      'dispute_invalid':         { points: -10, description: 'Invalid dispute raised' },
      'dispute_creator_quick_fix': { points: -5, description: 'Expense corrected quickly' },
      'partial_unpaid':          { points: -5,  description: 'Partial unpaid balance lingering' },
      'expense_with_proof':      { points: +2,  description: 'Expense created with receipt' },
      'clean_settlement':        { points: +1,  description: 'Clean settlement — no disputes' },
      'dispute_pattern':         { points: -20, description: 'Pattern of inaccurate expenses' },
    }

    const config = EVENT_POINTS[eventType]
    if (!config) return NextResponse.json({ error: 'Invalid eventType' }, { status: 400 })

    // Prevent duplicate events (same type + user + group within last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: recentDup } = await supabase
      .from('honesty_events')
      .select('id')
      .eq('user_id', userId)
      .eq('event_type', eventType)
      .gte('created_at', oneHourAgo)
      .limit(1)
    
    if (recentDup && recentDup.length > 0 && !['settlement_ontime', 'settlement_within_24h'].includes(eventType)) {
      return NextResponse.json({ logged: false, reason: 'duplicate' })
    }

    await (supabase.from('honesty_events') as any).insert({
      user_id: userId,
      group_id: groupId || null,
      event_type: eventType,
      points: config.points,
      description: config.description,
      metadata: metadata || {},
    })

    return NextResponse.json({ logged: true, points: config.points, description: config.description })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
