import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET — get user settings
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabase
      .from('profiles')
      .select('allow_friends_add_to_group')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      allow_friends_add_to_group: data?.allow_friends_add_to_group ?? true,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH — update settings
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()

    const updates: Record<string, any> = {}

    if (typeof body.allow_friends_add_to_group === 'boolean') {
      updates.allow_friends_add_to_group = body.allow_friends_add_to_group
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid settings to update' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const { error } = await (supabase.from('profiles') as any)
      .update(updates)
      .eq('id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
