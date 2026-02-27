import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST — Upload a proof file to Supabase Storage
// Accepts multipart/form-data with a "file" field
// Returns { url: string } — the public URL
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'File type not allowed. Use JPEG, PNG, WebP, HEIC, or PDF.' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum 10MB.' }, { status: 400 })
    }

    // Generate unique file path
    const ext = file.name.split('.').pop() || 'jpg'
    const timestamp = Date.now()
    const filePath = `${user.id}/${timestamp}.${ext}`

    // Read file as ArrayBuffer
    const fileBuffer = await file.arrayBuffer()

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('proofs')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error('[Upload] Supabase storage error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('proofs')
      .getPublicUrl(data.path)

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (error: any) {
    console.error('[Upload] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
