import Razorpay from 'razorpay'

// Server-side only — do not import in client components
export function getRazorpayInstance() {
  const key_id = process.env.RAZORPAY_KEY_ID
  const key_secret = process.env.RAZORPAY_KEY_SECRET

  if (!key_id || !key_secret) {
    throw new Error('Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.local')
  }

  return new Razorpay({ key_id, key_secret })
}
