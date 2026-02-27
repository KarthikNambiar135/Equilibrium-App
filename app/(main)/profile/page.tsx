'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import VideoLoader from '@/components/ui/VideoLoader'
import Avatar from '@/components/ui/Avatar'
import {
  LogOut,
  CreditCard,
  Shield,
  ChevronRight,
  AlertCircle,
  Check,
  Receipt,
  Bell,
  BellOff,
  Send,
  RefreshCw,
  ArrowLeft,
  Wallet,
  Zap,
  Smartphone,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import CategoryIcon from '@/components/ui/CategoryIcon'
import Link from 'next/link'
import type { Profile } from '@/lib/types/database'

const PAYMENT_APPS = [
  { id: 'gpay', label: 'Google Pay', icon: CreditCard },
  { id: 'phonepe', label: 'PhonePe', icon: Wallet },
  { id: 'paytm', label: 'Paytm', icon: Smartphone },
  { id: 'fampay', label: 'FamPay', icon: CreditCard },
  { id: 'cred', label: 'CRED', icon: Zap },
  { id: 'amazonpay', label: 'Amazon Pay', icon: CreditCard },
]

function validateUpiId(upi: string): boolean {
  return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(upi)
}

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('return')
  const isOnboarding = searchParams.get('onboarding') === 'true'

  const [profile, setProfile] = useState<Profile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editUpi, setEditUpi] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editCountryCode, setEditCountryCode] = useState('+91')
  const [editPaymentApp, setEditPaymentApp] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [upiError, setUpiError] = useState('')
  const [pushStatus, setPushStatus] = useState<{ subscribed: boolean; count: number; error?: string } | null>(null)
  const [pushLoading, setPushLoading] = useState(false)
  const [pushTestResult, setPushTestResult] = useState<string | null>(null)
  const [pushExpanded, setPushExpanded] = useState(false)

  const [honestyScore, setHonestyScore] = useState<number | null>(null)
  const [honestyProvisional, setHonestyProvisional] = useState(false)
  const [honestyTrulyNew, setHonestyTrulyNew] = useState(false)
  const [badges, setBadges] = useState<any[]>([])
  const [statsLoading, setStatsLoading] = useState(true)

  const [nameCollapsed, setNameCollapsed] = useState(false)
  const nameCardRef = useRef<HTMLDivElement>(null)

  const isProfileIncomplete = profile && (!profile.upi_id || !profile.preferred_payment_app)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setNameCollapsed(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-80px 0px 0px 0px' }
    )
    const el = nameCardRef.current
    if (el) observer.observe(el)
    return () => { if (el) observer.unobserve(el) }
  }, [profile])

  async function checkPushStatus() {
    setPushLoading(true)
    setPushTestResult(null)
    try {
      const res = await fetch('/api/push/status')
      const data = await res.json()
      setPushStatus(data)
    } catch {
      setPushStatus({ subscribed: false, count: 0, error: 'Failed to check' })
    }
    setPushLoading(false)
  }

  async function resubscribePush() {
    setPushLoading(true)
    setPushTestResult(null)
    try {
      const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.()
      if (isCapacitor) {
        const { PushNotifications } = await import('@capacitor/push-notifications')
        let perm = await PushNotifications.checkPermissions()
        if (perm.receive === 'prompt') perm = await PushNotifications.requestPermissions()
        if (perm.receive !== 'granted') {
          setPushTestResult('[ERROR] Permission denied')
          setPushLoading(false)
          return
        }
        PushNotifications.addListener('registration', async (token) => {
          const res = await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'fcm', token: token.value }),
          })
          setPushTestResult(res.ok ? '[OK] Native push enabled!' : '[ERROR] Failed to save FCM token')
          await checkPushStatus()
          setPushLoading(false)
        })
        PushNotifications.addListener('registrationError', (err) => {
          setPushTestResult(`[ERROR] ${err.error}`)
          setPushLoading(false)
        })
        await PushNotifications.register()
        return
      }
      if (!('serviceWorker' in navigator)) { setPushTestResult('[ERROR] Service workers not supported'); setPushLoading(false); return }
      if (!('PushManager' in window)) { setPushTestResult('[ERROR] Push not supported'); setPushLoading(false); return }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setPushTestResult('[ERROR] Permission denied'); setPushLoading(false); return }
      const registration = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) { setPushTestResult('[ERROR] VAPID key not configured'); setPushLoading(false); return }
      const existing = await registration.pushManager.getSubscription()
      if (existing) await existing.unsubscribe()
      const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4)
      const base64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/')
      const rawData = window.atob(base64)
      const applicationServerKey = new Uint8Array(rawData.length)
      for (let i = 0; i < rawData.length; ++i) applicationServerKey[i] = rawData.charCodeAt(i)
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setPushTestResult(`[ERROR] ${err.error || res.status}`)
        setPushLoading(false)
        return
      }
      setPushTestResult('[OK] Push subscription created!')
      await checkPushStatus()
    } catch (err: any) {
      setPushTestResult(`[ERROR] ${err.message}`)
    }
    setPushLoading(false)
  }

  async function sendTestPush() {
    setPushLoading(true)
    setPushTestResult(null)
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: 'self', title: 'Test Notification', body: 'Push notifications are working!', url: '/profile' }),
      })
      const data = await res.json()
      if (data.success && data.sent > 0) setPushTestResult('[OK] Push sent!')
      else if (data.error) setPushTestResult(`[ERROR] ${data.error}`)
      else setPushTestResult(`[WARN] Sent: ${data.sent}/${data.total}`)
    } catch (err: any) {
      setPushTestResult(`[ERROR] ${err.message}`)
    }
    setPushLoading(false)
  }

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      if (data) {
        setProfile(data)
        setEditName(data.full_name)
        setEditUpi(data.upi_id || '')
        const storedPhone = data.phone || ''
        if (storedPhone.startsWith('+')) {
          const match = storedPhone.match(/^(\+\d{1,4})\s*(.*)$/)
          if (match) { setEditCountryCode(match[1]); setEditPhone(match[2]) }
          else setEditPhone(storedPhone)
        } else setEditPhone(storedPhone)
        setEditPaymentApp(data.preferred_payment_app || '')
        if (!data.upi_id || !data.preferred_payment_app) setIsEditing(true)
      }
    }
    loadProfile()
    checkPushStatus()
    loadStats()
  }, [supabase])

  async function loadStats() {
    setStatsLoading(true)
    try {
      const [honestyRes, badgesRes] = await Promise.all([
        fetch('/api/honesty'), fetch('/api/badges?evaluate=true'),
      ])
      if (honestyRes.ok) { const d = await honestyRes.json(); setHonestyScore(d.score ?? null); setHonestyProvisional(d.isProvisional ?? false); setHonestyTrulyNew((d.stats?.totalSettlements === 0 && d.stats?.totalExpenses === 0) ?? false) }
      if (badgesRes.ok) { const d = await badgesRes.json(); setBadges(d.badges || []) }
    } catch {}
    setStatsLoading(false)
  }

  async function handleSave() {
    if (!profile) return
    if (!editUpi.trim()) { setUpiError('UPI ID is required'); return }
    if (!validateUpiId(editUpi.trim())) { setUpiError('Invalid UPI ID format'); return }
    if (!editPaymentApp) { setUpiError('Please select a payment app'); return }
    setUpiError('')
    setIsSaving(true)
    const fullPhone = editPhone ? `${editCountryCode} ${editPhone}` : null
    const { error } = await supabase.from('profiles').update({
      full_name: editName, upi_id: editUpi.trim(), phone: fullPhone,
      preferred_payment_app: editPaymentApp, updated_at: new Date().toISOString(),
    }).eq('id', profile.id)
    if (!error) {
      setProfile({ ...profile, full_name: editName, upi_id: editUpi.trim(), phone: fullPhone, preferred_payment_app: editPaymentApp })
      setIsEditing(false)
      if (returnTo) router.push(returnTo)
    }
    setIsSaving(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (!profile) {
    return <VideoLoader />
  }

  const selectedApp = PAYMENT_APPS.find((a) => a.id === (editPaymentApp || profile.preferred_payment_app))

  return (
    <div className="pb-24">
      {/* Sticky Title Bar */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm px-5 pt-14 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-xl font-bold">Profile</h1>
          </div>
          <button onClick={handleLogout} className="h-9 w-9 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        {/* Compact name bar on scroll */}
        <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${nameCollapsed ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
          <div className="flex items-center gap-3 mt-2 bg-muted rounded-xl px-3 py-2">
            <Avatar name={profile.full_name} imageUrl={profile.avatar_url} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{profile.full_name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{profile.email}</p>
            </div>
          </div>
          </div>
        </div>
      </div>

      <div className="px-5">
        {isProfileIncomplete && !isEditing && (
          <Card className="mb-4 bg-warning/10 border-warning/30" padding="md">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-warning shrink-0" />
              <div>
                <p className="text-sm font-semibold text-warning">Complete Your Profile</p>
                <p className="text-xs text-warning/80">Add your UPI ID & payment app to create or join groups</p>
              </div>
            </div>
          </Card>
        )}

        {/* Profile Card */}
        <div ref={nameCardRef}>
          <Card className="mb-4">
            <div className="flex items-center gap-4">
              <Avatar name={profile.full_name} imageUrl={profile.avatar_url} size="lg" />
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold">{profile.full_name}</h2>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
                {profile.upi_id && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs text-primary font-medium">{profile.upi_id}</span>
                    {selectedApp && <selectedApp.icon className="h-3 w-3 text-primary" />}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Honesty Score | Badges (one row) */}
        <Card className="mb-4" padding="md">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 shrink-0">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Honesty</p>
                {statsLoading ? (
                  <div className="h-6 w-10 bg-muted rounded animate-pulse" />
                ) : (
                  <div className="flex items-baseline gap-1">
                    {honestyTrulyNew ? (
                      <p className="text-xl font-bold text-muted-foreground">NA</p>
                    ) : (
                      <>
                        <p className="text-xl font-bold">{honestyScore ?? profile.honesty_score}%</p>
                        {honestyProvisional && <span className="text-[8px] text-muted-foreground">P</span>}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="w-px h-10 bg-border shrink-0" />
            <div className="flex-1 min-w-0 overflow-x-auto">
              {statsLoading ? (
                <div className="flex gap-2">
                  <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
                  <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
                </div>
              ) : badges.length > 0 ? (
                <div className="flex gap-2">
                  {badges.map((badge: any) => (
                    <div key={badge.badge_type} className="flex flex-col items-center gap-0.5 shrink-0">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <CategoryIcon name={badge.config?.icon || 'award'} className="h-4 w-4 text-primary" />
                      </div>
                      <p className="text-[8px] text-muted-foreground text-center max-w-[48px] leading-tight truncate">{badge.config?.name || badge.badge_type}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground">No badges yet</p>
              )}
            </div>
          </div>
        </Card>

        {/* Edit Profile */}
        {isEditing ? (
          <Card className="mb-4">
            <div className="flex flex-col gap-3">
              {isProfileIncomplete && (
                <div className="bg-primary/5 rounded-xl px-3 py-2 mb-1">
                  <p className="text-xs text-primary font-medium flex items-center gap-1"><Zap className="h-3 w-3" /> Setup required</p>
                </div>
              )}
              <Input label="Full Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <div>
                <Input label="UPI ID *" value={editUpi} onChange={(e) => { setEditUpi(e.target.value); setUpiError('') }} placeholder="yourname@oksbi" hint="Others will pay you at this UPI ID" error={upiError && !editUpi ? upiError : undefined} />
                {editUpi && !validateUpiId(editUpi) && <p className="text-xs text-destructive mt-1">Invalid format (e.g. rahul@okaxis)</p>}
                {editUpi && validateUpiId(editUpi) && <p className="text-xs text-success mt-1 flex items-center gap-1"><Check className="h-3 w-3" /> Valid</p>}
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Payment App *</p>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_APPS.map((app) => (
                    <button key={app.id} onClick={() => { setEditPaymentApp(app.id); setUpiError('') }}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${editPaymentApp === app.id ? 'bg-primary/10 border-primary ring-2 ring-primary/30' : 'bg-muted border-border hover:border-primary/30'}`}>
                      <app.icon className="h-5 w-5 text-muted-foreground" />
                      <span className="text-[10px] font-medium">{app.label}</span>
                    </button>
                  ))}
                </div>
                {upiError && !editPaymentApp && <p className="text-xs text-destructive mt-2">{upiError}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Phone (optional)</label>
                <div className="flex gap-2">
                  <select value={editCountryCode} onChange={(e) => setEditCountryCode(e.target.value)}
                    className="w-24 rounded-xl border border-border bg-transparent px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="+91">+91</option><option value="+1">+1</option><option value="+44">+44</option>
                    <option value="+971">+971</option><option value="+65">+65</option><option value="+61">+61</option>
                    <option value="+81">+81</option><option value="+49">+49</option><option value="+33">+33</option>
                    <option value="+86">+86</option><option value="+82">+82</option><option value="+966">+966</option>
                    <option value="+60">+60</option><option value="+977">+977</option><option value="+94">+94</option>
                    <option value="+880">+880</option>
                  </select>
                  <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value.replace(/[^0-9\s]/g, ''))}
                    placeholder="98765 43210" className="flex-1 rounded-xl border border-border bg-transparent px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                {!isProfileIncomplete && <Button variant="secondary" onClick={() => setIsEditing(false)} className="flex-1">Cancel</Button>}
                <Button onClick={handleSave} isLoading={isSaving} className="flex-1" disabled={!editUpi || !editPaymentApp || !validateUpiId(editUpi)}>
                  {isProfileIncomplete ? 'Complete Setup' : 'Save'}
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="mb-4" onClick={() => setIsEditing(true)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Edit Profile</p>
                  <p className="text-xs text-muted-foreground">{profile.upi_id ? `UPI: ${profile.upi_id}` : 'Add your UPI ID & payment app'}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Card>
        )}

        {/* Activity History */}
        <Link href="/activity">
          <Card className="mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Activity History</p>
                  <p className="text-xs text-muted-foreground">View all your expenses & settlements</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Card>
        </Link>

        {/* Push Notifications (minimal collapsible) */}
        <div className="mb-4 border border-border rounded-xl overflow-hidden">
          <button onClick={() => setPushExpanded(v => !v)} className="w-full flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2">
              {pushStatus?.subscribed ? <Bell className="h-3.5 w-3.5 text-success" /> : <BellOff className="h-3.5 w-3.5 text-muted-foreground" />}
              <span className="text-xs font-medium">Push Notifications</span>
              {pushStatus?.subscribed && <span className="text-[9px] bg-success/10 text-success px-1.5 py-0.5 rounded-full">Active</span>}
            </div>
            {pushExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          {pushExpanded && (
            <div className="px-4 pb-3 border-t border-border pt-2">
              <div className="flex flex-col gap-2">
                {pushStatus ? (
                  <>
                    <p className="text-[10px] text-muted-foreground">
                      {pushStatus.error ? `Warning: ${pushStatus.error}` : pushStatus.subscribed ? `${(pushStatus as any).fcmCount || 0} native, ${(pushStatus as any).webCount || 0} browser` : 'Not subscribed'}
                    </p>
                    <div className="flex gap-1.5">
                      <button onClick={resubscribePush} disabled={pushLoading}
                        className="flex-1 flex items-center justify-center gap-1 text-[10px] font-medium bg-primary/10 text-primary rounded-lg py-1.5 disabled:opacity-50">
                        <Bell className="h-3 w-3" />{pushStatus.subscribed ? 'Re-register' : 'Enable'}
                      </button>
                      {pushStatus.subscribed && (
                        <button onClick={sendTestPush} disabled={pushLoading}
                          className="flex-1 flex items-center justify-center gap-1 text-[10px] font-medium bg-muted text-foreground rounded-lg py-1.5 disabled:opacity-50">
                          <Send className="h-3 w-3" />Test
                        </button>
                      )}
                      <button onClick={checkPushStatus} disabled={pushLoading} className="flex items-center justify-center text-muted-foreground rounded-lg px-2 py-1.5 disabled:opacity-50">
                        <RefreshCw className={`h-3 w-3 ${pushLoading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                    {(pushStatus as any).webCount > 0 && (
                      <button onClick={async () => { setPushLoading(true); await fetch('/api/push/status', { method: 'DELETE' }); setPushTestResult('Old subscriptions cleaned!'); await checkPushStatus(); setPushLoading(false) }}
                        disabled={pushLoading} className="text-[10px] text-destructive/70 hover:text-destructive underline text-left">
                        Clean {(pushStatus as any).webCount} old sub(s)
                      </button>
                    )}
                  </>
                ) : <p className="text-[10px] text-muted-foreground">Checking...</p>}
                {pushTestResult && <p className="text-[10px] font-medium">{pushTestResult}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
