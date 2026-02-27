import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyUser } from '@/lib/utils/notify'
import { getRandomAlertText } from '@/lib/utils/text-picker'

/**
 * POST — Notify group members about a new expense.
 * Called client-side after creating the expense.
 *
 * Body: { groupId, title, amount, splits: string[] }
 * splits = list of user IDs who are part of this expense split
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { groupId, title, amount, splits } = await request.json()
    if (!groupId || !title || !amount) {
      return NextResponse.json({ error: 'groupId, title, amount required' }, { status: 400 })
    }

    // Get group info
    const { data: group } = await supabase
      .from('groups')
      .select('name, personality')
      .eq('id', groupId)
      .single()
        
    const groupName = (group as any)?.name || 'group'
    const vibe = ((group as any)?.personality || 'chill') as 'chill' | 'formal' | 'roast'

    // Get payer name
    const { data: payerProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const payerName = (payerProfile as any)?.full_name || 'Someone'

    // Get members to notify (everyone in splits except the payer)
    const membersToNotify: string[] = (splits || []).filter((id: string) => id !== user.id)

    if (membersToNotify.length === 0) {
      return NextResponse.json({ success: true, notified: 0 })
    }

    // Generate vibe-based text
    const alertText = getRandomAlertText('expense_added', vibe, {
      payer: payerName,
      title,
      amount: Math.round(Number(amount)),
      group: groupName,
    })

    const message = alertText || `${payerName} added "${title}" for ₹${Math.round(Number(amount))} in ${groupName}`

    // Notify each member (best effort, don't block)
    const results = await Promise.allSettled(
      membersToNotify.map((memberId: string) =>
        notifyUser({
          supabase,
          userId: memberId,
          fromUserId: user.id,
          type: 'expense',
          title: 'New Expense',
          message,
          groupId,
          url: `/groups/${groupId}`,
        })
      )
    )

    const notified = results.filter(r => r.status === 'fulfilled').length
    return NextResponse.json({ success: true, notified })
  } catch (error: any) {
    console.error('[Expense Notify] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
