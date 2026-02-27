import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyUser } from '@/lib/utils/notify'

// GET — get issues for an expense or group
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const expenseId = request.nextUrl.searchParams.get('expenseId')
    const groupId = request.nextUrl.searchParams.get('groupId')

    if (expenseId) {
      const { data: issues, error } = await supabase
        .from('expense_issues')
        .select('*')
        .eq('expense_id', expenseId)
        .order('created_at', { ascending: false })

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Fetch profile names for each issue raiser
      const userIds = [...new Set((issues || []).map((i: any) => i.raised_by))]
      const { data: profiles } = userIds.length > 0
        ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds)
        : { data: [] }

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))
      const enriched = (issues || []).map((i: any) => ({
        ...i,
        profiles: profileMap.get(i.raised_by) || { full_name: 'Unknown' },
      }))

      return NextResponse.json({ issues: enriched })
    }

    if (groupId) {
      // Get expenses in this group first, then their issues
      const { data: groupExpenses } = await supabase
        .from('expenses')
        .select('id')
        .eq('group_id', groupId)

      const expenseIds = (groupExpenses || []).map((e: any) => e.id)
      if (expenseIds.length === 0) return NextResponse.json({ issues: [] })

      const { data: issues, error } = await supabase
        .from('expense_issues')
        .select('*')
        .in('expense_id', expenseIds)
        .order('created_at', { ascending: false })

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Fetch profile names
      const userIds = [...new Set((issues || []).map((i: any) => i.raised_by))]
      const { data: profiles } = userIds.length > 0
        ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds)
        : { data: [] }

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))
      const enriched = (issues || []).map((i: any) => ({
        ...i,
        profiles: profileMap.get(i.raised_by) || { full_name: 'Unknown' },
      }))

      return NextResponse.json({ issues: enriched })
    }

    return NextResponse.json({ error: 'expenseId or groupId required' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — raise an issue on an expense
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { expenseId, description } = await request.json()

    if (!expenseId || !description?.trim()) {
      return NextResponse.json({ error: 'expenseId and description required' }, { status: 400 })
    }

    // Check user didn't create this expense
    const { data: expense } = await supabase
      .from('expenses')
      .select('paid_by, title, group_id')
      .eq('id', expenseId)
      .single()

    if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    if (expense.paid_by === user.id) {
      return NextResponse.json({ error: 'Cannot raise issue on your own expense' }, { status: 403 })
    }

    const { data, error } = await (supabase.from('expense_issues') as any)
      .insert({
        expense_id: expenseId,
        raised_by: user.id,
        description: description.trim(),
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'You already raised an issue on this expense' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Send notification to expense creator
    try {
      const { data: raiserProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      await notifyUser({
        supabase,
        userId: expense.paid_by,
        fromUserId: user.id,
        type: 'issue',
        title: 'Issue Raised on Expense',
        message: `${raiserProfile?.full_name || 'Someone'} raised an issue on "${expense.title}": ${description.trim().slice(0, 100)}`,
        groupId: expense.group_id,
        url: `/groups/${expense.group_id}`,
      })
    } catch { /* notification is best-effort */ }

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH — resolve an issue (only by the person who raised it)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { issueId, action } = await request.json()

    if (!issueId) return NextResponse.json({ error: 'issueId required' }, { status: 400 })

    if (action === 'resolve') {
      const { error } = await (supabase.from('expense_issues') as any)
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', issueId)
        .eq('raised_by', user.id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — delete an issue (only by raiser) or delete expense (only by creator)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { issueId, expenseId } = await request.json()

    // Delete a specific issue
    if (issueId) {
      const { error } = await supabase
        .from('expense_issues')
        .delete()
        .eq('id', issueId)
        .eq('raised_by', user.id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // Delete entire expense (only creator can, and only if conflicted)
    if (expenseId) {
      const { data: expense } = await supabase
        .from('expenses')
        .select('paid_by')
        .eq('id', expenseId)
        .single()

      if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
      if (expense.paid_by !== user.id) {
        return NextResponse.json({ error: 'Only the expense creator can delete it' }, { status: 403 })
      }

      // Delete splits first, then expense (issues cascade)
      await supabase.from('expense_splits').delete().eq('expense_id', expenseId)
      await supabase.from('expense_reactions').delete().eq('expense_id', expenseId)
      const { error } = await supabase.from('expenses').delete().eq('id', expenseId)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'issueId or expenseId required' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
