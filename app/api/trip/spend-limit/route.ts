import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET — get current user's spend limit for a group
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const groupId = request.nextUrl.searchParams.get('groupId')
    if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 })

    const { data } = await supabase
      .from('trip_spend_limits')
      .select('*')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json(data || null)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — set/update spend limit
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { groupId, spendLimit } = await request.json()

    if (!groupId || spendLimit === undefined) {
      return NextResponse.json({ error: 'groupId and spendLimit required' }, { status: 400 })
    }

    const { error } = await (supabase.from('trip_spend_limits') as any)
      .upsert({
        group_id: groupId,
        user_id: user.id,
        spend_limit: parseFloat(spendLimit),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'group_id,user_id',
      })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — remove spend limit
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Support both query param and body
    let groupId = request.nextUrl.searchParams.get('groupId')
    if (!groupId) {
      try { const body = await request.json(); groupId = body.groupId } catch {}
    }
    if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 })

    await supabase
      .from('trip_spend_limits')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
