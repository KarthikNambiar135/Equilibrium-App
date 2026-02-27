import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRandomAlertText } from '@/lib/utils/text-picker'
import { sendPushToUser } from '@/lib/utils/notify'

/**
 * Cron endpoint: Auto-send settlement reminders every 12 hours.
 *
 * For every active (non-terminated) group, finds pending settlements
 * and sends vibe-based reminders to debtors — but only if no
 * reminder was sent in the last 12 hours for that debtor+group pair.
 *
 * Secured via CRON_SECRET header (set in Vercel env vars).
 */

const MIN_REMINDER_INTERVAL_MS = 12 * 60 * 60 * 1000 // 12 hours

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const intervalAgo = new Date(Date.now() - MIN_REMINDER_INTERVAL_MS).toISOString()

    // 1. Get all active groups (not terminated)
    const { data: groups, error: groupsErr } = await supabase
      .from('groups')
      .select('id, name, personality')
      .or('terminated.is.null,terminated.eq.false')

    if (groupsErr || !groups) {
      console.error('[Cron Reminders] Failed to fetch groups:', groupsErr)
      return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 })
    }

    let totalSent = 0
    let totalSkipped = 0

    for (const group of groups) {
      const vibe = (group.personality || 'chill') as 'chill' | 'formal' | 'roast'

      // 2. Get pending settlements for this group
      const { data: pendingSettlements } = await supabase
        .from('settlements')
        .select('from_user, to_user, amount')
        .eq('group_id', group.id)
        .eq('status', 'pending')

      if (!pendingSettlements || pendingSettlements.length === 0) continue

      // Aggregate amounts per debtor→creditor pair
      const debtMap = new Map<string, { debtorId: string; creditorId: string; amount: number }>()
      for (const s of pendingSettlements) {
        const key = `${s.from_user}->${s.to_user}`
        const existing = debtMap.get(key)
        if (existing) {
          existing.amount += s.amount
        } else {
          debtMap.set(key, { debtorId: s.from_user, creditorId: s.to_user, amount: s.amount })
        }
      }

      // 3. For each debtor→creditor pair, check anti-spam and send reminder
      for (const [, debt] of debtMap) {
        // Check if a reminder was already sent recently (by system, from_user_id = null)
        const { data: recentReminder } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', debt.debtorId)
          .is('from_user_id', null)
          .eq('type', 'auto_reminder')
          .eq('group_id', group.id)
          .gte('created_at', intervalAgo)
          .limit(1)

        if (recentReminder && recentReminder.length > 0) {
          totalSkipped++
          continue
        }

        // Get creditor name
        const { data: creditorProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', debt.creditorId)
          .single()

        const creditorName = creditorProfile?.full_name || 'someone'
        const amount = Math.round(debt.amount)

        // Generate vibe text
        const message = getRandomAlertText('settlement_reminder', vibe, {
          creditor: creditorName,
          amount,
          group: group.name,
        })

        if (!message) continue

        // Insert notification (no from_user_id — it's system-generated)
        await supabase.from('notifications').insert({
          user_id: debt.debtorId,
          from_user_id: null,
          type: 'auto_reminder',
          title: '⏰ Settlement Reminder',
          message,
          group_id: group.id,
        })

        // Send push (best effort)
        sendPushToUser(debt.debtorId, '⏰ Settlement Reminder', message, `/groups/${group.id}`).catch(() => {})

        totalSent++
      }
    }

    console.log(`[Cron Reminders] Sent: ${totalSent}, Skipped: ${totalSkipped}`)
    return NextResponse.json({ success: true, sent: totalSent, skipped: totalSkipped })
  } catch (error: any) {
    console.error('[Cron Reminders] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
