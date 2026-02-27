import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyUser } from '@/lib/utils/notify'
import { getRandomReminderText } from '@/lib/utils/text-picker'

// Minimum interval between reminders to the same user for the same group (in hours)
const MIN_REMINDER_INTERVAL_HOURS = 12

/**
 * POST — Send a debt reminder to a user, using the group's personality vibe.
 *
 * Body: { debtorId, groupId, amount }
 *
 * The reminder text is picked from the vibe-specific pool with weighted random
 * selection. If a reminder was sent recently, it returns 429.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { debtorId, groupId, amount } = await request.json()
    if (!debtorId || !groupId || !amount) {
      return NextResponse.json({ error: 'debtorId, groupId, amount required' }, { status: 400 })
    }

    // Check reminder interval — don't spam
    const intervalAgo = new Date(Date.now() - MIN_REMINDER_INTERVAL_HOURS * 60 * 60 * 1000).toISOString()
    const { data: recentReminder } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', debtorId)
      .eq('from_user_id', user.id)
      .eq('type', 'reminder')
      .eq('group_id', groupId)
      .gte('created_at', intervalAgo)
      .limit(1)

    if (recentReminder && recentReminder.length > 0) {
      return NextResponse.json({
        error: `Reminder already sent in the last ${MIN_REMINDER_INTERVAL_HOURS} hours`,
        retryAfterHours: MIN_REMINDER_INTERVAL_HOURS,
      }, { status: 429 })
    }

    // Count how many reminders have been sent to this debtor for this group
    const { count: reminderCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', debtorId)
      .eq('from_user_id', user.id)
      .eq('type', 'reminder')
      .eq('group_id', groupId)

    // Get group personality
    const { data: groupData } = await supabase
      .from('groups')
      .select('personality, name')
      .eq('id', groupId)
      .single()

    const vibe = ((groupData as any)?.personality || 'chill') as 'chill' | 'formal' | 'roast'
    const groupName = (groupData as any)?.name || 'group'

    // Get names
    const { data: creditorProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const { data: debtorProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', debtorId)
      .single()

    const creditorName = (creditorProfile as any)?.full_name || 'Someone'
    const debtorName = (debtorProfile as any)?.full_name || 'Friend'

    // Calculate days pending
    const { data: settlement } = await supabase
      .from('settlements')
      .select('created_at')
      .eq('from_user', debtorId)
      .eq('to_user', user.id)
      .eq('group_id', groupId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const daysPending = settlement
      ? Math.floor((Date.now() - new Date((settlement as any).created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0

    // Generate reminder text using weighted random
    const reminderText = getRandomReminderText(vibe, {
      debtor: debtorName,
      creditor: creditorName,
      amount: Math.round(Number(amount)),
      group: groupName,
      reminder_count: (reminderCount || 0) + 1,
      days_pending: daysPending,
    })

    // Send notification + push
    await notifyUser({
      supabase,
      userId: debtorId,
      fromUserId: user.id,
      type: 'reminder',
      title: 'Payment Reminder',
      message: reminderText,
      groupId,
      url: `/groups/${groupId}`,
    })

    return NextResponse.json({
      success: true,
      message: reminderText,
      vibe,
      reminderNumber: (reminderCount || 0) + 1,
    })
  } catch (error: any) {
    console.error('[Reminder] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
