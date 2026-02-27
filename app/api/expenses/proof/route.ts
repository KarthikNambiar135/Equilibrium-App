import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST — upload proof URL for an expense
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { expenseId, proofUrl } = await request.json()

    if (!expenseId || !proofUrl) {
      return NextResponse.json({ error: 'expenseId and proofUrl required' }, { status: 400 })
    }

    // Verify user is the creator
    const { data: expense } = await supabase
      .from('expenses')
      .select('paid_by')
      .eq('id', expenseId)
      .single()

    if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    if (expense.paid_by !== user.id) {
      return NextResponse.json({ error: 'Only the expense creator can add proof' }, { status: 403 })
    }

    const { error } = await (supabase.from('expenses') as any)
      .update({ proof_url: proofUrl })
      .eq('id', expenseId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
