import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyUser } from '@/lib/utils/notify'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      groupId,
      toUserId,
      amount,
    } = await request.json()

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment details' }, { status: 400 })
    }

    // Verify signature
    const secret = process.env.RAZORPAY_KEY_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex')

    if (expectedSignature !== razorpay_signature) {
      console.error('[Razorpay Verify] Signature mismatch')
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
    }

    // Payment verified — check if settlement already exists (e.g. webhook beat us)
    const { data: existing } = await supabase
      .from('settlements')
      .select('id')
      .eq('razorpay_order_id', razorpay_order_id)
      .maybeSingle()

    if (existing) {
      // Already created (by webhook), just ensure it's completed
      await (supabase.from('settlements') as any)
        .update({
          status: 'completed',
          razorpay_payment_id,
          settled_at: new Date().toISOString(),
        })
        .eq('id', (existing as any).id)
    } else {
      // Create settlement record directly as completed
      const { error: insertError } = await (supabase.from('settlements') as any)
        .insert({
          group_id: groupId,
          from_user: user.id,
          to_user: toUserId,
          amount,
          status: 'completed',
          payment_mode: 'razorpay',
          razorpay_order_id,
          razorpay_payment_id,
          settled_at: new Date().toISOString(),
        })

      if (insertError) {
        console.error('[Razorpay Verify] Failed to create settlement:', insertError)
        return NextResponse.json({ error: 'Payment verified but failed to create settlement' }, { status: 500 })
      }
    }

    // Send push notification to payee (best effort)
    try {
      const { data: payerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      const { data: groupData } = await supabase
        .from('groups')
        .select('name')
        .eq('id', groupId)
        .single()

      const payerName = (payerProfile as any)?.full_name || 'Someone'
      const groupName = (groupData as any)?.name || 'group'

      await notifyUser({
        supabase,
        userId: toUserId,
        fromUserId: user.id,
        type: 'settlement',
        title: 'Payment Received',
        message: `${payerName} paid you ₹${Math.round(amount)} in "${groupName}"`,
        groupId,
        url: `/groups/${groupId}`,
      })
    } catch { /* best effort */ }

    return NextResponse.json({ success: true, message: 'Payment verified and settlement completed' })
  } catch (error: any) {
    console.error('[Razorpay Verify] Error:', error)
    return NextResponse.json({ error: error.message || 'Verification failed' }, { status: 500 })
  }
}
