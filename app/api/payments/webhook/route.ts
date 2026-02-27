import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import crypto from 'crypto'

// Webhook endpoint — no auth required, Razorpay sends events here
// This is the fallback: if client-side verify fails, webhook catches it

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-razorpay-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET not configured')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex')

    if (expectedSignature !== signature) {
      console.error('[Razorpay Webhook] Signature mismatch')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const event = JSON.parse(body)

    // Handle payment captured / authorized events
    if (event.event === 'payment.captured' || event.event === 'payment.authorized') {
      const payment = event.payload?.payment?.entity
      if (!payment) {
        return NextResponse.json({ error: 'No payment entity' }, { status: 400 })
      }

      const orderId = payment.order_id
      const paymentId = payment.id

      if (!orderId) {
        return NextResponse.json({ ok: true, message: 'No order_id, skipping' })
      }

      // Use service role or direct connection — webhook has no user session
      // We use the anon key here but with the settlement matched by razorpay_order_id
      const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      const supabaseUrl = raw.startsWith('http') ? raw : 'https://placeholder.supabase.co'
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

      const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
          getAll() { return [] },
          setAll() { /* webhook has no cookies */ },
        },
      })

      // Find the settlement by order ID
      const { data: settlement } = await supabase
        .from('settlements')
        .select('id, status')
        .eq('razorpay_order_id', orderId)
        .maybeSingle()

      if (settlement && (settlement as any).status !== 'completed') {
        await (supabase.from('settlements') as any)
          .update({
            status: 'completed',
            razorpay_payment_id: paymentId,
            settled_at: new Date().toISOString(),
          })
          .eq('id', (settlement as any).id)

        console.log(`[Razorpay Webhook] Settlement ${(settlement as any).id} auto-completed via webhook`)
      } else if (!settlement) {
        // Settlement doesn't exist yet (verify endpoint hasn't created it)
        // Create it from the order notes
        const notes = payment.notes || {}
        if (notes.group_id && notes.from_user && notes.to_user && notes.amount) {
          await (supabase.from('settlements') as any)
            .insert({
              group_id: notes.group_id,
              from_user: notes.from_user,
              to_user: notes.to_user,
              amount: Number(notes.amount),
              status: 'completed',
              payment_mode: 'razorpay',
              razorpay_order_id: orderId,
              razorpay_payment_id: paymentId,
              settled_at: new Date().toISOString(),
            })

          console.log(`[Razorpay Webhook] Settlement created and completed via webhook for order ${orderId}`)
        }
      }

      return NextResponse.json({ ok: true, message: 'Settlement updated' })
    }

    // Other events — acknowledge but don't process
    return NextResponse.json({ ok: true, message: `Event ${event.event} acknowledged` })
  } catch (error: any) {
    console.error('[Razorpay Webhook] Error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
