import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Reward chance configuration (like GPay — not every time)
const SETTLEMENT_REWARD_CHANCE = 0.35 // 35% chance on settlement
const SETTLEMENT_MIN_POINTS = 2
const SETTLEMENT_MAX_POINTS = 15
const LARGE_EXPENSE_THRESHOLD = 2000 // ₹2000+
const LARGE_EXPENSE_CHANCE = 0.25 // 25% chance on large expense
const LARGE_EXPENSE_MIN_POINTS = 5
const LARGE_EXPENSE_MAX_POINTS = 25
const AD_WATCH_POINTS = 10

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// GET — get user's points and recent log
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get current points
    const { data: profile } = await supabase
      .from('profiles')
      .select('equipoints')
      .eq('id', user.id)
      .single()

    // Get recent log
    const { data: log } = await supabase
      .from('equipoints_log')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    return NextResponse.json({
      points: (profile as any)?.equipoints || 0,
      log: log || [],
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — award points (called after settlement/expense/ad watch)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { action, metadata } = await request.json()

    if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 })

    let points = 0
    let reason = ''
    let awarded = false

    switch (action) {
      case 'settlement': {
        // Random chance to earn points on settlement
        if (Math.random() < SETTLEMENT_REWARD_CHANCE) {
          points = randomInt(SETTLEMENT_MIN_POINTS, SETTLEMENT_MAX_POINTS)
          reason = 'Settlement reward'
          awarded = true
        }
        break
      }
      case 'expense': {
        const amount = metadata?.amount || 0
        // Only large expenses have a chance
        if (amount >= LARGE_EXPENSE_THRESHOLD && Math.random() < LARGE_EXPENSE_CHANCE) {
          points = randomInt(LARGE_EXPENSE_MIN_POINTS, LARGE_EXPENSE_MAX_POINTS)
          reason = `Big expense reward (₹${amount})`
          awarded = true
        }
        break
      }
      case 'ad_watch': {
        points = AD_WATCH_POINTS
        reason = 'Watched an ad'
        awarded = true
        break
      }
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    if (!awarded) {
      return NextResponse.json({ awarded: false, points: 0, message: 'Better luck next time!' })
    }

    // Insert log entry
    const { error: logError } = await (supabase.from('equipoints_log') as any).insert({
      user_id: user.id,
      points,
      reason,
      metadata: metadata || null,
    })

    if (logError) {
      console.error('[EquiPoints] Log insert error:', logError)
      return NextResponse.json({ error: logError.message }, { status: 500 })
    }

    // Update profile points
    const { data: profile } = await supabase
      .from('profiles')
      .select('equipoints')
      .eq('id', user.id)
      .single()

    const currentPoints = (profile as any)?.equipoints || 0
    await (supabase.from('profiles') as any)
      .update({ equipoints: currentPoints + points })
      .eq('id', user.id)

    // Send notification about earning points
    try {
      await (supabase.from('notifications') as any).insert({
        user_id: user.id,
        type: 'points',
        title: '🎉 EquiPoints Earned!',
        message: `You earned ${points} EquiPoints! ${reason}. Total: ${currentPoints + points} EP`,
      })
    } catch { /* best-effort */ }

    return NextResponse.json({
      awarded: true,
      points,
      reason,
      total: currentPoints + points,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
