import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH — edit a conflicted expense (only creator can edit, only if has open issues)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { expenseId, title, amount, category, splits, proof_url } = await request.json()

    if (!expenseId) return NextResponse.json({ error: 'expenseId required' }, { status: 400 })

    // Verify user is the creator
    const { data: expense } = await supabase
      .from('expenses')
      .select('paid_by, group_id')
      .eq('id', expenseId)
      .single()

    if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    if (expense.paid_by !== user.id) {
      return NextResponse.json({ error: 'Only the expense creator can edit it' }, { status: 403 })
    }

    // Verify expense has open issues (only conflicted expenses can be edited)
    const { data: issues } = await supabase
      .from('expense_issues')
      .select('id')
      .eq('expense_id', expenseId)
      .eq('status', 'open')

    if (!issues || issues.length === 0) {
      return NextResponse.json({ error: 'Only conflicted expenses can be edited' }, { status: 403 })
    }

    // Update expense
    const updateData: any = { updated_at: new Date().toISOString() }
    if (title) updateData.title = title.trim()
    if (amount) updateData.amount = parseFloat(amount)
    if (category) updateData.category = category
    if (proof_url !== undefined) updateData.proof_url = proof_url

    const { error: updateError } = await (supabase.from('expenses') as any)
      .update(updateData)
      .eq('id', expenseId)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    // Update splits if provided
    if (splits && Array.isArray(splits)) {
      // Delete old splits
      await supabase.from('expense_splits').delete().eq('expense_id', expenseId)

      // Insert new splits
      const splitInserts = splits.map((s: any) => ({
        expense_id: expenseId,
        user_id: s.user_id,
        amount: s.amount,
        percentage: s.percentage || null,
      }))

      const { error: splitError } = await (supabase.from('expense_splits') as any).insert(splitInserts)
      if (splitError) return NextResponse.json({ error: splitError.message }, { status: 500 })
    }

    // Send notification to issue raisers
    try {
      const { data: openIssues } = await supabase
        .from('expense_issues')
        .select('raised_by')
        .eq('expense_id', expenseId)
        .eq('status', 'open')

      if (openIssues) {
        const notifications = openIssues.map((issue: any) => ({
          user_id: issue.raised_by,
          type: 'issue_update',
          title: 'Expense Updated',
          message: `The expense "${title || 'you raised an issue on'}" has been edited by the creator. Review and resolve your issue if satisfied.`,
          group_id: expense.group_id,
        }))

        await (supabase.from('notifications') as any).insert(notifications)
      }
    } catch { /* notification is best-effort */ }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
