import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * ═══════════════════════════════════════════════════════════════
 * EQUILIBRIUM BADGES ALGORITHM
 * ═══════════════════════════════════════════════════════════════
 *
 * Badges are EARNED based on sustained behavior, not one-time events.
 * They can also be REVOKED when the user no longer meets the criteria.
 * Each badge uses a rolling window (last 90 days) for evaluation.
 *
 * ── BADGE DEFINITIONS (HACKATHON DEMO MODE) ─────────────────
 *
 * 🏋️ BACKBONE (Person who pays most often for the group)
 *   Requirements:
 *   - Must have paid for ≥30% of the group's total expenses
 *   - Must have ≥2 expenses paid in the group
 *   - Must have the HIGHEST expense count in at least one group
 *   Score = (yourExpenses / totalExpenses) × 100
 *   Threshold: ≥30 AND highest in at least one group
 *
 * ⏰ ON-TIME LEGEND (Always settles without reminders)
 *   Requirements:
 *   - ≥70% of settlements completed without prior reminder
 *   - ≥2 completed settlements total
 *   - No settlements pending >6 hours
 *   Score = onTimeRate × 100
 *   Threshold: ≥70
 *
 * 📊 SPLIT MASTER (Frequently adds and manages expenses)
 *   Requirements:
 *   - Created ≥3 expenses across all groups  
 *   - Active in ≥1 group
 *   - At least 1 expense in last 2 days (still active)
 *   Score = min(100, (totalExpenses / 3) × 50 + (recentExpenses / 1) × 50)
 *   Threshold: ≥80
 *
 * 💥 DEBT DESTROYER (Clears settlements quickly)
 *   Requirements:
 *   - Average settlement time ≤12 hours
 *   - ≥2 completed settlements
 *   - No pending settlements older than 6 hours
 *   Score = max(0, 100 - avgHoursToSettle × 4)
 *   Threshold: ≥52 (i.e., avg ≤12 hours)
 *
 * 🛡️ TRUSTED (High honesty score & low disputes)
 *   Requirements:
 *   - Honesty score ≥75
 *   - ≤2 valid disputes in rolling window
 *   - ≥2 total settlements
 *   - No pattern penalties
 *   Score = honestyScore adjusted by disputes
 *   Threshold: ≥75
 *
 * ── ANTI-INFLATION RULES (RELAXED FOR DEMO) ─────────────────
 * 
 * - Minimal activity thresholds for fast demo
 * - Rolling 2-day window for most metrics
 * - Badges re-evaluated on each check (can be revoked)
 * - No wait period to earn badge
 * - 1-hour cooldown after revocation before re-earning
 *
 * ═══════════════════════════════════════════════════════════════
 */

const BADGE_CONFIGS = {
  backbone: {
    name: 'Backbone',
    icon: 'dumbbell',
    description: 'Person who pays most often for the group',
    color: 'amber',
  },
  ontime_legend: {
    name: 'On-Time Legend',
    icon: 'clock',
    description: 'Always settles without reminders',
    color: 'emerald',
  },
  split_master: {
    name: 'Split Master',
    icon: 'bar-chart',
    description: 'Frequently adds and manages expenses',
    color: 'orange',
  },
  debt_destroyer: {
    name: 'Debt Destroyer',
    icon: 'bomb',
    description: 'Clears settlements quickly',
    color: 'purple',
  },
  trusted: {
    name: 'Trusted',
    icon: 'shield',
    description: 'High honesty score & low disputes',
    color: 'green',
  },
}

// GET — Get user's badges + evaluate eligibility
// ?userId=xxx (optional)
// ?evaluate=true to recalculate (default: just fetch)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const targetUserId = request.nextUrl.searchParams.get('userId') || user.id
    const evaluate = request.nextUrl.searchParams.get('evaluate') === 'true'

    if (evaluate && targetUserId === user.id) {
      // Full evaluation
      const results = await evaluateBadges(supabase, user.id)
      return NextResponse.json(results)
    }

    // Just fetch current badges
    const { data: badges } = await supabase
      .from('user_badges')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('is_active', true)

    const activeBadges = (badges || []).map((b: any) => ({
      ...b,
      config: BADGE_CONFIGS[b.badge_type as keyof typeof BADGE_CONFIGS],
    }))

    return NextResponse.json({ badges: activeBadges })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function evaluateBadges(supabase: any, userId: string) {
  const now = Date.now()
  // HACKATHON DEMO: Reduced windows (90d → 2d, 30d → 6h)
  const ninetyDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()  // 2 days
  const thirtyDaysAgo = new Date(now - 6 * 60 * 60 * 1000).toISOString()         // 6 hours

  // ── Load all data needed ───────────────────────────────────
  
  // User's group memberships
  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)
  const groupIds = (memberships || []).map((m: any) => m.group_id)

  // All expenses in user's groups
  let allGroupExpenses: any[] = []
  let userExpenses: any[] = []
  if (groupIds.length > 0) {
    const { data: ge } = await supabase
      .from('expenses')
      .select('id, paid_by, group_id, created_at, receipt_url, proof_url')
      .in('group_id', groupIds)
    allGroupExpenses = ge || []
    userExpenses = allGroupExpenses.filter((e: any) => e.paid_by === userId)
  }

  // All settlements where user is payer
  const { data: settlements } = await supabase
    .from('settlements')
    .select('*')
    .eq('from_user', userId)
  const allSettlements = settlements || []
  const completedSettlements = allSettlements.filter((s: any) => s.status === 'completed')

  // Reminders received
  const { data: reminders } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'reminder')
    .gte('created_at', ninetyDaysAgo)

  // Issues against user's expenses (within 90d)
  const userExpenseIds = userExpenses.map((e: any) => e.id)
  let issuesAgainst: any[] = []
  if (userExpenseIds.length > 0) {
    const { data } = await supabase
      .from('expense_issues')
      .select('*')
      .in('expense_id', userExpenseIds)
      .gte('created_at', ninetyDaysAgo)
    issuesAgainst = data || []
  }

  // Honesty score
  const { data: profile } = await supabase
    .from('profiles')
    .select('honesty_score')
    .eq('id', userId)
    .single()
  const honestyScore = (profile as any)?.honesty_score ?? 100

  // Honesty events (for pattern detection)
  const { data: patternEvents } = await supabase
    .from('honesty_events')
    .select('event_type')
    .eq('user_id', userId)
    .eq('event_type', 'dispute_pattern')
    .gte('created_at', ninetyDaysAgo)

  // Existing badges
  const { data: existingBadges } = await supabase
    .from('user_badges')
    .select('*')
    .eq('user_id', userId)

  const existingMap = new Map<string, any>((existingBadges || []).map((b: any) => [b.badge_type, b]))

  // ── Evaluate each badge ────────────────────────────────────

  const evaluations: Record<string, { eligible: boolean; score: number; reason: string }> = {};

  // 🏋️ BACKBONE
  (() => {
    if (groupIds.length === 0 || userExpenses.length < 2) {
      evaluations.backbone = { eligible: false, score: 0, reason: `Need ≥2 expenses paid (have ${userExpenses.length})` }
      return
    }
    // Check if user is the top payer in at least one group
    let isTopInAnyGroup = false
    let bestPct = 0
    for (const gid of groupIds) {
      const groupExp = allGroupExpenses.filter((e: any) => e.group_id === gid)
      if (groupExp.length < 1) continue // skip empty groups
      const mineInGroup = groupExp.filter((e: any) => e.paid_by === userId).length
      const pct = mineInGroup / groupExp.length
      bestPct = Math.max(bestPct, pct)
      
      // Check if highest in this group
      const payerCounts = new Map<string, number>()
      groupExp.forEach((e: any) => {
        payerCounts.set(e.paid_by, (payerCounts.get(e.paid_by) || 0) + 1)
      })
      const maxCount = Math.max(...payerCounts.values())
      if (mineInGroup === maxCount && mineInGroup >= 2) {
        isTopInAnyGroup = true
      }
    }
    const score = Math.round(bestPct * 100)
    evaluations.backbone = {
      eligible: isTopInAnyGroup && bestPct >= 0.30,
      score,
      reason: isTopInAnyGroup ? `Top payer at ${score}%` : 'Not the top payer in any group',
    }
  })();

  // ⏰ ON-TIME LEGEND
  (() => {
    if (completedSettlements.length < 2) {
      evaluations.ontime_legend = { eligible: false, score: 0, reason: `Need ≥2 completed settlements (have ${completedSettlements.length})` }
      return
    }
    const reminderGroupIds = new Set((reminders || []).map((r: any) => r.group_id))
    let onTimeCount = 0
    completedSettlements.forEach((s: any) => {
      const hadReminder = reminderGroupIds.has(s.group_id)
      const created = new Date(s.created_at).getTime()
      const settled = new Date(s.settled_at || s.created_at).getTime()
      const hours = (settled - created) / (1000 * 60 * 60)
      if (!hadReminder && hours <= 48) onTimeCount++
    })
    const rate = onTimeCount / completedSettlements.length
    const score = Math.round(rate * 100)
    
    // Check no old pending (6 hours for demo)
    const oldPending = allSettlements.filter((s: any) => {
      if (s.status !== 'pending') return false
      return (now - new Date(s.created_at).getTime()) > 6 * 60 * 60 * 1000
    })

    evaluations.ontime_legend = {
      eligible: score >= 70 && oldPending.length === 0,
      score,
      reason: score >= 70 
        ? (oldPending.length > 0 ? `${oldPending.length} old pending settlement(s)` : `${score}% on-time rate`)
        : `On-time rate ${score}% (need ≥70%)`,  
    }
  })();

  // 📊 SPLIT MASTER
  (() => {
    const recentExpenses = userExpenses.filter((e: any) => e.created_at >= thirtyDaysAgo)
    const activeGroups = new Set(userExpenses.map((e: any) => e.group_id)).size

    if (userExpenses.length < 3) {
      evaluations.split_master = { eligible: false, score: 0, reason: `Need ≥3 expenses (have ${userExpenses.length})` }
      return
    }
    if (activeGroups < 1) {
      evaluations.split_master = { eligible: false, score: 0, reason: `Active in ${activeGroups} group(s) (need ≥1)` }
      return
    }
    const score = Math.min(100, Math.round(
      (Math.min(userExpenses.length, 3) / 3) * 50 + 
      (Math.min(recentExpenses.length, 1) / 1) * 50
    ))
    evaluations.split_master = {
      eligible: score >= 80 && recentExpenses.length >= 1,
      score,
      reason: recentExpenses.length < 1 
        ? `No expenses in last 6 hours` 
        : `${userExpenses.length} total, ${recentExpenses.length} recent`,
    }
  })();

  // 💥 DEBT DESTROYER
  (() => {
    if (completedSettlements.length < 2) {
      evaluations.debt_destroyer = { eligible: false, score: 0, reason: `Need ≥2 completed settlements (have ${completedSettlements.length})` }
      return
    }
    let totalHours = 0
    completedSettlements.forEach((s: any) => {
      const hours = (new Date(s.settled_at || s.created_at).getTime() - new Date(s.created_at).getTime()) / (1000 * 60 * 60)
      totalHours += Math.max(0, hours)
    })
    const avgHours = totalHours / completedSettlements.length
    const score = Math.max(0, Math.round(100 - avgHours * 4))
    
    // No pending older than 6h (demo mode)
    const oldPending = allSettlements.filter((s: any) => {
      if (s.status !== 'pending') return false
      return (now - new Date(s.created_at).getTime()) > 6 * 60 * 60 * 1000
    })

    evaluations.debt_destroyer = {
      eligible: score >= 52 && oldPending.length === 0,
      score,
      reason: score >= 52 
        ? (oldPending.length > 0 ? `${oldPending.length} pending settlement(s) >24h` : `Avg ${Math.round(avgHours)}h to settle`)
        : `Avg ${Math.round(avgHours)}h (need ≤12h)`,
    }
  })();

  // 🛡️ TRUSTED
  (() => {
    if (completedSettlements.length < 2) {
      evaluations.trusted = { eligible: false, score: 0, reason: `Need ≥2 settlements (have ${completedSettlements.length})` }
      return
    }
    const recentValidDisputes = issuesAgainst.filter((i: any) => i.status === 'resolved').length
    const hasPattern = (patternEvents || []).length > 0
    
    let score = honestyScore
    if (recentValidDisputes > 2) score -= (recentValidDisputes - 2) * 5
    if (hasPattern) score -= 15

    evaluations.trusted = {
      eligible: score >= 75 && recentValidDisputes <= 2 && !hasPattern,
      score: Math.max(0, score),
      reason: score >= 75 
        ? (hasPattern ? 'Pattern penalty active' : `Honesty ${score}, ${recentValidDisputes} dispute(s)`)
        : `Score ${score} (need ≥75)`,
    }
  })();

  // ── Apply badge changes ────────────────────────────────────
  const activeBadges: any[] = []
  
  for (const [badgeType, evaluation] of Object.entries(evaluations)) {
    const existing = existingMap.get(badgeType)
    const config = BADGE_CONFIGS[badgeType as keyof typeof BADGE_CONFIGS]

    if (evaluation.eligible) {
      if (existing && existing.is_active) {
        // Already has badge — update score
        await (supabase.from('user_badges') as any)
          .update({ score: evaluation.score })
          .eq('id', existing.id)
        activeBadges.push({ ...existing, score: evaluation.score, config })
      } else if (existing && !existing.is_active) {
        // Was revoked — check cooldown (1 hour for demo)
        const revokedAt = existing.revoked_at ? new Date(existing.revoked_at).getTime() : 0
        if (now - revokedAt > 1 * 60 * 60 * 1000) {
          await (supabase.from('user_badges') as any)
            .update({ is_active: true, earned_at: new Date().toISOString(), revoked_at: null, score: evaluation.score })
            .eq('id', existing.id)
          activeBadges.push({ ...existing, is_active: true, score: evaluation.score, config })
        }
      } else {
        // New badge!
        const { data: newBadge } = await (supabase.from('user_badges') as any)
          .insert({ user_id: userId, badge_type: badgeType, score: evaluation.score })
          .select()
          .single()
        if (newBadge) {
          activeBadges.push({ ...newBadge, config })
          // Send notification
          await (supabase.from('notifications') as any).insert({
            user_id: userId,
            type: 'badge',
            title: `Badge Earned: ${config.name}!`,
            message: `You earned the "${config.name}" badge — ${config.description}`,
          })
        }
      }
    } else {
      // Not eligible — revoke if active
      if (existing && existing.is_active) {
        await (supabase.from('user_badges') as any)
          .update({ is_active: false, revoked_at: new Date().toISOString() })
          .eq('id', existing.id)
        // Notify revocation
        await (supabase.from('notifications') as any).insert({
          user_id: userId,
          type: 'badge',
          title: `Badge Lost: ${config.name}`,
          message: `Your "${config.name}" badge was revoked — ${evaluation.reason}`,
        })
      }
    }
  }

  return {
    badges: activeBadges,
    evaluations,
    allBadgeConfigs: BADGE_CONFIGS,
  }
}
