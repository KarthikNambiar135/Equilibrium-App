import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRazorpayInstance } from '@/lib/razorpay'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { amount, toUserId, groupId, fromName, toName, toUpiId } = await request.json()

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const razorpay = getRazorpayInstance()

    // Amount in paise (smallest currency unit)
    const amountInPaise = Math.round(amount * 100)

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `settlement_${Date.now()}`,
      notes: {
        group_id: groupId,
        from_user: user.id,
        to_user: toUserId,
        from_name: fromName,
        to_name: toName,
        amount: String(amount),
      },
    })

    // DO NOT create a settlement record here.
    // Settlement is only created AFTER payment is verified (in /api/payments/verify).
    // This prevents orphan "pending" records when the user cancels mid-payment.

    return NextResponse.json({
      orderId: order.id,
      amount: amountInPaise,
      currency: 'INR',
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      toUpiId: toUpiId || null,
      // Pass metadata so the client can send it to /verify
      meta: { groupId, toUserId, amount },
    })
  } catch (error: any) {
    console.error('[Razorpay] Create order error:', error)
    return NextResponse.json({ error: error.message || 'Failed to create payment order' }, { status: 500 })
  }
}
