'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'
import { X, ImagePlus, Keyboard, Users, Loader2, Flashlight, FlashlightOff } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'

export default function ScannerPage() {
  const router = useRouter()
  const supabase = createClient()
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isScanning, setIsScanning] = useState(false)
  const [torch, setTorch] = useState(false)
  const [scannedCode, setScannedCode] = useState<string | null>(null)
  const [groupPreview, setGroupPreview] = useState<any>(null)
  const [previewMembers, setPreviewMembers] = useState(0)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState('')
  const [joinSuccess, setJoinSuccess] = useState(false)
  const [alreadyMember, setAlreadyMember] = useState(false)
  const [isPastMember, setIsPastMember] = useState(false)
  const [pastMembershipId, setPastMembershipId] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false)
  const [requestSent, setRequestSent] = useState(false)

  const processedRef = useRef(false)

  // Get current user + check profile completeness
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setCurrentUser(user.id)
        // If new account (no UPI ID set), redirect to profile to complete setup
        const { data: profile } = await supabase
          .from('profiles')
          .select('upi_id')
          .eq('id', user.id)
          .maybeSingle()
        if (profile && !profile.upi_id) {
          router.replace('/profile?onboarding=true')
        }
      }
    })
  }, [])

  const handleCodeScanned = useCallback(async (code: string) => {
    if (processedRef.current) return
    processedRef.current = true

    // Extract invite code from QR content
    // QR might contain: just the code, or a URL like "equilibrium://join/CODE" or "https://app.../join/CODE"  
    let inviteCode = code.trim()
    const joinMatch = inviteCode.match(/join\/([A-Za-z0-9]+)/)
    if (joinMatch) {
      inviteCode = joinMatch[1]
    }

    setScannedCode(inviteCode)
    setIsLoadingPreview(true)
    setError('')
    setAlreadyMember(false)
    setIsPastMember(false)
    setPastMembershipId(null)

    // Stop scanner
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop()
      }
    } catch {}

    // Look up group
    const { data: group } = await supabase
      .from('groups')
      .select('*')
      .eq('invite_code', inviteCode.toUpperCase())
      .maybeSingle()

    if (!group) {
      // Try without uppercase
      const { data: group2 } = await supabase
        .from('groups')
        .select('*')
        .eq('invite_code', inviteCode)
        .maybeSingle()

      if (!group2) {
        setError('Invalid QR code. No group found.')
        setIsLoadingPreview(false)
        return
      }
      setGroupPreview(group2)

      // Check QR code expiry
      if (group2.invite_code_expires_at && new Date(group2.invite_code_expires_at) <= new Date()) {
        setError('This QR code has expired. Ask the group admin for a new one.')
        setIsLoadingPreview(false)
        return
      }

      // Get member count
      const { count } = await supabase
        .from('group_members')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', group2.id)
        .is('left_at', null)
      setPreviewMembers(count || 0)

      // Check if already member (active or past)
      if (currentUser) {
        const { data: existing } = await (supabase.from('group_members') as any)
          .select('id, left_at')
          .eq('group_id', group2.id)
          .eq('user_id', currentUser)
          .maybeSingle()
        if (existing) {
          if (!existing.left_at) {
            setAlreadyMember(true)
          } else {
            setIsPastMember(true)
            setPastMembershipId(existing.id)
          }
        }
      }

      setIsLoadingPreview(false)
      return
    }

    setGroupPreview(group)

    // Check QR code expiry
    if (group.invite_code_expires_at && new Date(group.invite_code_expires_at) <= new Date()) {
      setError('This QR code has expired. Ask the group admin for a new one.')
      setIsLoadingPreview(false)
      return
    }

    // Get member count
    const { count } = await supabase
      .from('group_members')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', group.id)
      .is('left_at', null)
    setPreviewMembers(count || 0)

    // Check if already member (active or past)
    if (currentUser) {
      const { data: existing } = await (supabase.from('group_members') as any)
        .select('id, left_at')
        .eq('group_id', group.id)
        .eq('user_id', currentUser)
        .maybeSingle()
      if (existing) {
        if (!existing.left_at) {
          setAlreadyMember(true)
        } else {
          setIsPastMember(true)
          setPastMembershipId(existing.id)
        }
      }
    }

    setIsLoadingPreview(false)
  }, [currentUser, supabase])

  // Start camera scanner
  useEffect(() => {
    let mounted = true

    async function startScanner() {
      try {
        // Explicitly request camera permission — triggers native OS dialog on mobile
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        // Stop the temporary stream so Html5Qrcode can claim the camera
        stream.getTracks().forEach(t => t.stop())

        const scanner = new Html5Qrcode('qr-reader', { verbose: false })
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          (decodedText) => {
            if (mounted) handleCodeScanned(decodedText)
          },
          () => {} // ignore errors (no QR in frame)
        )

        if (mounted) setIsScanning(true)
      } catch (err) {
        console.error('Scanner error:', err)
        if (mounted) {
          setCameraPermissionDenied(true)
          setError('Camera access denied. Please allow camera permission in your device settings.')
        }
      }
    }

    startScanner()

    return () => {
      mounted = false
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [handleCodeScanned])

  // Toggle torch
  async function toggleTorch() {
    try {
      const track = scannerRef.current?.getRunningTrackCameraCapabilities()
      if (track?.torchFeature()?.isSupported()) {
        const newState = !torch
        await track.torchFeature().apply(newState)
        setTorch(newState)
      }
    } catch {}
  }

  // Handle image upload for QR scan
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')

    try {
      // Stop camera scanner first
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop()
        setIsScanning(false)
      }

      const scanner = new Html5Qrcode('qr-reader-hidden', { verbose: false })
      const result = await scanner.scanFile(file, true)
      scanner.clear()
      handleCodeScanned(result)
    } catch {
      setError('No QR code found in the image. Try again.')
    }

    // Clear the file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Join group
  async function handleJoinGroup() {
    if (!groupPreview || !currentUser) return

    setIsJoining(true)
    setError('')

    if (alreadyMember) {
      router.push(`/groups/${groupPreview.id}`)
      return
    }

    // Past member — rejoin by clearing left_at (skip member limit & join mode checks)
    if (isPastMember && pastMembershipId) {
      const { error: rejoinError } = await (supabase.from('group_members') as any)
        .update({ left_at: null })
        .eq('id', pastMembershipId)
      if (rejoinError) {
        setError('Failed to rejoin group. Try again.')
        setIsJoining(false)
        return
      }
      setJoinSuccess(true)
      setTimeout(() => {
        router.push(`/groups/${groupPreview.id}`)
      }, 800)
      return
    }

    // Check member limit
    const memberLimit = groupPreview.member_limit ?? 30
    if (previewMembers >= memberLimit) {
      setError(`This group is full (${memberLimit} member limit).`)
      setIsJoining(false)
      return
    }

    // Check join mode — if 'request', send a join request instead
    if (groupPreview.join_mode === 'request') {
      // Check if already requested
      const { data: existingReq } = await (supabase.from('group_join_requests') as any)
        .select('id, status')
        .eq('group_id', groupPreview.id)
        .eq('user_id', currentUser)
        .maybeSingle()

      if (existingReq) {
        if (existingReq.status === 'pending') {
          setError('You already have a pending request for this group.')
        } else if (existingReq.status === 'rejected') {
          setError('Your previous request was declined.')
        } else {
          // Accepted — shouldn't reach here, but handle gracefully
          router.push(`/groups/${groupPreview.id}`)
        }
        setIsJoining(false)
        return
      }

      // Create join request
      const { error: reqError } = await (supabase.from('group_join_requests') as any).insert({
        group_id: groupPreview.id,
        user_id: currentUser,
      })

      if (reqError) {
        setError('Failed to send join request. Try again.')
        setIsJoining(false)
        return
      }

      // Notify group admin
      try {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', currentUser).single()
        await fetch('/api/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupId: groupPreview.id,
            type: 'join_request',
            title: 'Join Request',
            message: `${profile?.full_name || 'Someone'} wants to join ${groupPreview.name}`,
          }),
        })
      } catch { /* silent */ }

      setRequestSent(true)
      setIsJoining(false)
      return
    }

    const { error } = await (supabase.from('group_members') as any).insert({
      group_id: groupPreview.id,
      user_id: currentUser,
      role: 'member',
    })

    if (error) {
      setError('Failed to join group. Try again.')
      setIsJoining(false)
      return
    }

    setJoinSuccess(true)
    setTimeout(() => {
      router.push(`/groups/${groupPreview.id}`)
    }, 800)
  }

  // Reset / scan again
  function resetScanner() {
    setScannedCode(null)
    setGroupPreview(null)
    setError('')
    setIsPastMember(false)
    setPastMembershipId(null)
    setAlreadyMember(false)
    setJoinSuccess(false)
    setRequestSent(false)
    setCameraPermissionDenied(false)
    processedRef.current = false

    // Restart camera
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then((stream) => {
      stream.getTracks().forEach(t => t.stop())
      const scanner = new Html5Qrcode('qr-reader', { verbose: false })
      scannerRef.current = scanner
      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        (decodedText) => handleCodeScanned(decodedText),
        () => {}
      ).then(() => setIsScanning(true)).catch(() => {})
    }).catch(() => {
      setCameraPermissionDenied(true)
      setError('Camera access denied. Please allow camera permission in your device settings.')
    })
  }

  // Get group display icon  
  const groupEmoji = groupPreview?.emoji
  const isImage = groupEmoji?.startsWith('http')

  return (
    <div className="min-h-dvh bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-14 pb-3 z-10">
        <button onClick={() => router.back()} className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center">
          <X className="h-5 w-5 text-white" />
        </button>
        <h1 className="text-lg font-bold text-white">Scan QR Code</h1>
        <button onClick={toggleTorch} className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center">
          {torch ? <FlashlightOff className="h-5 w-5 text-primary" /> : <Flashlight className="h-5 w-5 text-white" />}
        </button>
      </div>

      {/* Scanner viewport */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="relative w-full max-w-[300px] aspect-square">
          {/* Scanner container */}
          <div id="qr-reader" className={`w-full h-full rounded-2xl overflow-hidden [&>video]:object-cover ${isScanning ? '' : '[&>video]:opacity-0'}`} />

          {/* Corner brackets overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Top-left */}
            <div className="absolute top-0 left-0 w-10 h-10 border-t-[3px] border-l-[3px] border-primary rounded-tl-2xl" />
            {/* Top-right */}
            <div className="absolute top-0 right-0 w-10 h-10 border-t-[3px] border-r-[3px] border-primary rounded-tr-2xl" />
            {/* Bottom-left */}
            <div className="absolute bottom-0 left-0 w-10 h-10 border-b-[3px] border-l-[3px] border-primary rounded-bl-2xl" />
            {/* Bottom-right */}
            <div className="absolute bottom-0 right-0 w-10 h-10 border-b-[3px] border-r-[3px] border-primary rounded-br-2xl" />
          </div>

          {/* Scan line animation */}
          {isScanning && !scannedCode && (
            <div className="absolute left-4 right-4 h-0.5 bg-primary/80 animate-scan-line" />
          )}
        </div>

        <p className="text-white/50 text-sm text-center mt-4">
          {cameraPermissionDenied ? '' : 'Point your camera at a group QR code'}
        </p>

        {error && !groupPreview && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-xl mt-4 w-full max-w-[300px] text-center">
            {error}
            {cameraPermissionDenied ? (
              <p className="text-white/40 text-xs mt-2">
                Go to Settings → Apps → Equilibrium → Permissions → Camera → Allow
              </p>
            ) : (
              <button onClick={resetScanner} className="block mx-auto mt-2 text-primary text-xs font-medium">
                Try Again
              </button>
            )}
          </div>
        )}

        {/* Actions below scanner */}
        <div className="flex gap-3 mt-5 w-full max-w-[300px]">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-white/10 text-white text-sm font-medium"
          >
            <ImagePlus className="h-4 w-4" />
            Upload Image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <button
            onClick={() => router.push('/groups/new?join=true')}
            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-white/10 text-white text-sm font-medium"
          >
            <Keyboard className="h-4 w-4" />
            Enter Code
          </button>
        </div>
      </div>

      {/* Hidden scanner for image uploads */}
      <div id="qr-reader-hidden" className="hidden" />

      {/* Group Preview Modal */}
      <Modal isOpen={!!groupPreview} onClose={resetScanner} title="Group Found">
        {isLoadingPreview ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : groupPreview ? (
          <div className="flex flex-col items-center gap-4">
            {/* Group icon */}
            <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center overflow-hidden">
              {isImage ? (
                <img src={groupEmoji} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl">{groupEmoji || '👥'}</span>
              )}
            </div>

            {/* Group info */}
            <div className="text-center">
              <h2 className="text-xl font-bold">{groupPreview.name}</h2>
              {groupPreview.description && (
                <p className="text-sm text-muted-foreground mt-1">{groupPreview.description}</p>
              )}
              <div className="flex items-center justify-center gap-3 mt-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {previewMembers} member{previewMembers !== 1 ? 's' : ''}
                </span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground capitalize">{groupPreview.personality}</span>
                {groupPreview.mode === 'trip' && (
                  <>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">TRIP</span>
                  </>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-xl w-full text-center">
                {error}
              </div>
            )}

            {joinSuccess ? (
              <div className="bg-primary/10 text-primary text-sm p-3 rounded-xl w-full text-center font-medium">
                Joined successfully! Redirecting...
              </div>
            ) : requestSent ? (
              <div className="bg-primary/10 text-primary text-sm p-3 rounded-xl w-full text-center font-medium">
                Request sent! The group admin will review it.
              </div>
            ) : (
              <Button
                fullWidth
                size="lg"
                onClick={handleJoinGroup}
                isLoading={isJoining}
              >
                {alreadyMember ? 'Open Group' : isPastMember ? 'Rejoin Group' : groupPreview.join_mode === 'request' ? 'Request to Join' : 'Join Group'}
              </Button>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
