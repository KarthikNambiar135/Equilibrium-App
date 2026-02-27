import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET — Calculate the current user's settlement streak
// A streak = consecutive settlements completed without being reminded first
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get all completed settlements for this user (as payer), ordered newest first
    const { data: settlements } = await supabase
      .from('settlements')
      .select('id, created_at, settled_at, group_id, status')
      .eq('from_user', user.id)
      .order('settled_at', { ascending: false })
      .limit(100)

    if (!settlements || settlements.length === 0) {
      return NextResponse.json({ streak: 0 })
    }

    // Get reminders sent to this user
    const { data: reminders } = await supabase
      .from('notifications')
      .select('created_at, group_id')
      .eq('user_id', user.id)
      .eq('type', 'reminder')

    // Build a set of reminder timestamps per group for quick lookup
    const remindersByGroup = new Map<string, Date[]>()
    ;(reminders || []).forEach((r: any) => {
      const g = r.group_id || '__all__'
      if (!remindersByGroup.has(g)) remindersByGroup.set(g, [])
      remindersByGroup.get(g)!.push(new Date(r.created_at))
    })

    // Count streak: consecutive completed settlements where the user settled
    // BEFORE any reminder was sent for that group after the settlement was created
    let streak = 0
    for (const s of settlements) {
      if (s.status !== 'completed') {
        break // Pending/cancelled breaks streak
      }

      const created = new Date(s.created_at).getTime()
      const settled = new Date(s.settled_at || s.created_at).getTime()
      const hoursToSettle = (settled - created) / (1000 * 60 * 60)

      // Check if a reminder was sent for this group between creation and settlement
      const groupReminders = remindersByGroup.get(s.group_id) || []
      const wasReminded = groupReminders.some(r => {
        const rTime = r.getTime()
        return rTime >= created && rTime <= settled
      })

      if (!wasReminded && hoursToSettle <= 72) {
        streak++
      } else {
        break
      }
    }

    // Update profile settlement_streak
    await (supabase.from('profiles') as any)
      .update({ settlement_streak: streak })
      .eq('id', user.id)

    return NextResponse.json({ streak })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
