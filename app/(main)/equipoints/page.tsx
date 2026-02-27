'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import { 
  Coins, Gift, Play, TrendingUp, Star, Zap, ShoppingBag, Coffee, Palette, Crown,
  Shield, Award, ChevronRight, AlertTriangle, CheckCircle, Clock, FileText,
  Loader2, RefreshCw, Bug, Receipt
} from 'lucide-react'
import CategoryIcon from '@/components/ui/CategoryIcon'
import { formatINR } from '@/lib/utils/settlement'

const GOODIES = [
  { id: 'theme_dark_gold', name: 'Gold Theme', desc: 'Exclusive gold UI accent', cost: 500, icon: Palette },
  { id: 'badge_og', name: 'OG Badge', desc: 'Show off as an early adopter', cost: 200, icon: Crown },
  { id: 'badge_whale', name: 'Whale Badge', desc: 'For big spenders', cost: 1000, icon: Star },
  { id: 'sticker_pack', name: 'Sticker Pack', desc: 'Extra reaction stickers', cost: 300, icon: Gift },
  { id: 'coffee', name: 'Virtual Coffee', desc: 'Send a coffee to a friend', cost: 150, icon: Coffee },
  { id: 'double_points', name: '2x Points (24hr)', desc: 'Double earning for a day', cost: 800, icon: Zap },
]

type PointsLog = {
  id: string
  points: number
  reason: string
  created_at: string
}

type HonestyBreakdown = {
  onTimeRate: number
  completionRate: number
  disputeFactor: number
  proofRate: number
}

type HonestyStats = {
  totalSettlements: number
  completedSettlements: number
  onTimePayments: number
  totalExpenses: number
  expensesWithProof: number
  disputesAgainst: number
  oldPendingSettlements: number
}

type BadgeConfig = {
  name: string
  icon: string
  description: string
  color: string
}

type Badge = {
  id: string
  badge_type: string
  is_active: boolean
  score: number
  earned_at: string
  config: BadgeConfig
}

type BadgeEvaluation = {
  eligible: boolean
  score: number
  reason: string
}

import VideoLoader from '@/components/ui/VideoLoader'

type ActiveTab = 'overview' | 'honesty' | 'badges' | 'shop'

export default function EquiPointsPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview')
  
  // Points state
  const [points, setPoints] = useState(0)
  const [log, setLog] = useState<PointsLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [watchingAd, setWatchingAd] = useState(false)
  const [rewardResult, setRewardResult] = useState<string | null>(null)

  // Honesty state
  const [honestyScore, setHonestyScore] = useState<number | null>(null)
  const [honestyProvisional, setHonestyProvisional] = useState(false)
  const [honestyBreakdown, setHonestyBreakdown] = useState<HonestyBreakdown | null>(null)
  const [honestyStats, setHonestyStats] = useState<HonestyStats | null>(null)
  const [honestyEvents, setHonestyEvents] = useState<any[]>([])
  const [honestyLoading, setHonestyLoading] = useState(false)
  const [honestyDebug, setHonestyDebug] = useState<any>(null)
  const [showDebug, setShowDebug] = useState(false)

  // Badges state
  const [badges, setBadges] = useState<Badge[]>([])
  const [badgeEvaluations, setBadgeEvaluations] = useState<Record<string, BadgeEvaluation>>({})
  const [allBadgeConfigs, setAllBadgeConfigs] = useState<Record<string, BadgeConfig>>({})
  const [badgesLoading, setBadgesLoading] = useState(false)

  useEffect(() => {
    loadPoints()
  }, [])

  useEffect(() => {
    if (activeTab === 'honesty' && honestyScore === null) loadHonesty()
    if (activeTab === 'badges' && Object.keys(allBadgeConfigs).length === 0 && !badgesLoading) loadBadges()
  }, [activeTab])

  async function loadPoints() {
    try {
      const res = await fetch('/api/equipoints')
      const data = await res.json()
      setPoints(data.points || 0)
      setLog(data.log || [])
    } catch { /* silent */ }
    setIsLoading(false)
  }

  async function loadHonesty() {
    setHonestyLoading(true)
    try {
      const res = await fetch('/api/honesty')
      const data = await res.json()
      setHonestyScore(data.score)
      setHonestyProvisional(data.isProvisional)
      setHonestyBreakdown(data.breakdown)
      setHonestyStats(data.stats)
      setHonestyEvents(data.recentEvents || [])
      setHonestyDebug(data.debug || null)
    } catch { /* silent */ }
    setHonestyLoading(false)
  }

  async function loadBadges() {
    setBadgesLoading(true)
    try {
      const res = await fetch('/api/badges?evaluate=true')
      const data = await res.json()
      setBadges(data.badges || [])
      setBadgeEvaluations(data.evaluations || {})
      setAllBadgeConfigs(data.allBadgeConfigs || {})
    } catch { /* silent */ }
    setBadgesLoading(false)
  }

  async function watchAd() {
    setWatchingAd(true)
    setRewardResult(null)
    await new Promise((r) => setTimeout(r, 3000))

    try {
      const res = await fetch('/api/equipoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ad_watch' }),
      })
      const data = await res.json()
      if (data.awarded) {
        setRewardResult(`🎉 You earned ${data.points} EP!`)
        setPoints(data.total)
        loadPoints()
      }
    } catch {
      setRewardResult('❌ Failed to earn points')
    }
    setWatchingAd(false)
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  function getScoreColor(score: number): string {
    if (score >= 85) return 'text-success'
    if (score >= 70) return 'text-amber-400'
    if (score >= 50) return 'text-warning'
    return 'text-destructive'
  }

  function getScoreLabel(score: number): string {
    if (score >= 90) return 'Excellent'
    if (score >= 80) return 'Very Good'
    if (score >= 70) return 'Good'
    if (score >= 50) return 'Fair'
    if (score >= 30) return 'Poor'
    return 'Critical'
  }

  if (isLoading) {
    return <VideoLoader />
  }

  const TABS: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Points', icon: <Coins className="h-3.5 w-3.5" /> },
    { id: 'honesty', label: 'Honesty', icon: <Shield className="h-3.5 w-3.5" /> },
    { id: 'badges', label: 'Badges', icon: <Award className="h-3.5 w-3.5" /> },
    { id: 'shop', label: 'Shop', icon: <ShoppingBag className="h-3.5 w-3.5" /> },
  ]

  return (
    <div className="pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm px-5 pt-14 pb-3">
        <h1 className="text-xl font-bold mb-1">EquiPoints</h1>
        <p className="text-xs text-muted-foreground mb-3">Points, reputation & badges</p>

        {/* Tab Bar */}
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      </div>

      <div className="px-5">
      {/* ═══ OVERVIEW TAB ═══ */}
      {activeTab === 'overview' && (
        <>
          {/* Points Balance Card */}
          <Card className="mb-4 bg-linear-to-br from-amber-500/20 via-yellow-500/10 to-transparent border-amber-500/30" padding="md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-amber-200/80 uppercase tracking-wider font-medium">Your Balance</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-black text-amber-400">{points.toLocaleString()}</p>
                  <p className="text-sm font-semibold text-amber-300/70">EP</p>
                </div>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                <Coins className="h-7 w-7 text-amber-400" />
              </div>
            </div>
          </Card>

          {/* Earn Section */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" /> Earn Points
            </h2>
            <div className="flex flex-col gap-2">
              <Card padding="md">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Play className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Watch an Ad</p>
                    <p className="text-xs text-muted-foreground">Earn 10 EP per ad</p>
                  </div>
                  <Button size="sm" onClick={watchAd} isLoading={watchingAd} disabled={watchingAd}>
                    {watchingAd ? 'Watching...' : '+10 EP'}
                  </Button>
                </div>
                {rewardResult && (
                  <p className="text-xs font-medium mt-2 text-center">{rewardResult}</p>
                )}
              </Card>
              <Card padding="sm" className="bg-muted/50">
                <div className="flex items-center gap-3">
                  <Coins className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs font-semibold">Settle Debts</p>
                    <p className="text-[10px] text-muted-foreground">~35% chance to earn 2-15 EP on each settlement</p>
                  </div>
                </div>
              </Card>
              <Card padding="sm" className="bg-muted/50">
                <div className="flex items-center gap-3">
                  <Receipt className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs font-semibold">Add Big Expenses (₹2,000+)</p>
                    <p className="text-[10px] text-muted-foreground">~25% chance to earn 5-25 EP on large expenses</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Points History */}
          {log.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Star className="h-4 w-4 text-warning" /> Recent Earnings
              </h2>
              <div className="flex flex-col gap-1.5">
                {log.map((entry) => (
                  <Card key={entry.id} padding="sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium">{entry.reason}</p>
                        <p className="text-[10px] text-muted-foreground">{timeAgo(entry.created_at)}</p>
                      </div>
                      <p className={`text-sm font-bold ${entry.points > 0 ? 'text-success' : 'text-destructive'}`}>
                        {entry.points > 0 ? '+' : ''}{entry.points} EP
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {log.length === 0 && (
            <EmptyState
              icon={<Coins className="h-7 w-7" />}
              title="No activity yet"
              description="Start settling debts or creating expenses to earn points"
            />
          )}
        </>
      )}

      {/* ═══ HONESTY TAB ═══ */}
      {activeTab === 'honesty' && (
        <>
          {honestyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : honestyScore !== null ? (
            <>
              {/* Main Score Card */}
              <Card className="mb-4 relative overflow-hidden" padding="lg">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Honesty Score</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <p className={`text-4xl font-black ${getScoreColor(honestyScore)}`}>{honestyScore}</p>
                      <p className="text-sm text-muted-foreground">/100</p>
                    </div>
                    <p className={`text-xs font-semibold mt-1 ${getScoreColor(honestyScore)}`}>
                      {getScoreLabel(honestyScore)}
                      {honestyProvisional && <span className="text-muted-foreground ml-1">(Provisional)</span>}
                    </p>
                  </div>
                  <div className="relative h-20 w-20">
                    <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
                      <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3"
                        className={getScoreColor(honestyScore)}
                        strokeDasharray={`${honestyScore * 0.942} 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Shield className={`h-6 w-6 ${getScoreColor(honestyScore)}`} />
                    </div>
                  </div>
                </div>

                <button onClick={loadHonesty} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${honestyLoading ? 'animate-spin' : ''}`} />
                </button>

                {honestyProvisional && (
                  <div className="flex items-center gap-2 bg-amber-500/10 rounded-lg px-3 py-2 mt-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <p className="text-[10px] text-amber-300">Score is provisional — complete 5+ settlements for a definitive score</p>
                  </div>
                )}
              </Card>

              {/* Breakdown */}
              {honestyBreakdown && (
                <div className="mb-4">
                  <h2 className="text-sm font-semibold mb-3">Score Breakdown</h2>
                  <div className="flex flex-col gap-2">
                    <BreakdownRow
                      icon={<Clock className="h-4 w-4" />}
                      label="On-Time Payments"
                      value={honestyBreakdown.onTimeRate}
                      weight="40%"
                      description="Settlements without reminders"
                    />
                    <BreakdownRow
                      icon={<CheckCircle className="h-4 w-4" />}
                      label="Completion Rate"
                      value={honestyBreakdown.completionRate}
                      weight="30%"
                      description="Settlements completed vs total"
                    />
                    <BreakdownRow
                      icon={<AlertTriangle className="h-4 w-4" />}
                      label="Dispute Factor"
                      value={honestyBreakdown.disputeFactor}
                      weight="15%"
                      description="Lower with more valid disputes"
                    />
                    <BreakdownRow
                      icon={<FileText className="h-4 w-4" />}
                      label="Proof & Transparency"
                      value={honestyBreakdown.proofRate}
                      weight="15%"
                      description="Expenses with receipts attached"
                    />
                  </div>
                </div>
              )}

              {/* Stats */}
              {honestyStats && (
                <div className="mb-4">
                  <h2 className="text-sm font-semibold mb-3">Activity Stats</h2>
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard label="Settlements" value={`${honestyStats.completedSettlements}/${honestyStats.totalSettlements}`} icon="coins" />
                    <StatCard label="On-Time" value={`${honestyStats.onTimePayments}`} icon="clock" />
                    <StatCard label="Expenses" value={`${honestyStats.totalExpenses}`} icon="receipt" />
                    <StatCard label="With Proof" value={`${honestyStats.expensesWithProof}`} icon="paperclip" />
                    <StatCard label="Disputes Against" value={`${honestyStats.disputesAgainst}`} icon="alert-triangle" />
                    <StatCard label="Pending >7d" value={`${honestyStats.oldPendingSettlements}`} icon="hourglass" />
                  </div>
                </div>
              )}

              {/* How scoring works */}
              <Card padding="md" className="mb-4 bg-muted/30">
                <h3 className="text-xs font-semibold mb-2">How Scoring Works</h3>
                <div className="flex flex-col gap-1.5">
                  <ScoreRule icon="clock" text="+10 Pay on time (no reminders)" positive />
                  <ScoreRule icon="zap" text="+5 Pay within 24 hours" positive />
                  <ScoreRule icon="receipt" text="+3 Confirm payment with proof" positive />
                  <ScoreRule icon="paperclip" text="+2 Create expense with receipt" positive />
                  <ScoreRule icon="hourglass" text="−8 Late payment (after reminder)" positive={false} />
                  <ScoreRule icon="alert-triangle" text="−15 Valid dispute on your expense" positive={false} />
                  <ScoreRule icon="ban" text="−10 Invalid/spam dispute raised" positive={false} />
                  <ScoreRule icon="coins" text="−5 Partial unpaid balances" positive={false} />
                  <ScoreRule icon="circle-dot" text="−20 Pattern of inaccurate expenses" positive={false} />
                </div>
              </Card>

              {/* Debug Panel */}
              {honestyDebug && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowDebug(v => !v)}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
                  >
                    <Bug className="h-3 w-3" />
                    <span className="font-medium">{showDebug ? 'Hide' : 'Show'} Debug Calculation</span>
                    <span className="text-[10px]">{showDebug ? '▲' : '▼'}</span>
                  </button>
                  {showDebug && (
                    <Card padding="md" className="bg-zinc-900/80 border-zinc-700 font-mono text-[11px] leading-relaxed">
                      <p className="text-amber-400 font-semibold mb-2">RAW CALCULATION</p>
                      <div className="flex flex-col gap-1 text-zinc-300">
                        <p><span className="text-zinc-500">weights:</span> {honestyDebug.weights}</p>
                        <p className="mt-1"><span className="text-zinc-500">onTimeRate:</span> <span className="text-emerald-400">{honestyDebug.rawOnTimeRate?.toFixed(4)}</span></p>
                        <p><span className="text-zinc-500">completionRate:</span> <span className="text-emerald-400">{honestyDebug.rawCompletionRate?.toFixed(4)}</span></p>
                        <p><span className="text-zinc-500">disputeFactor:</span> <span className="text-emerald-400">{honestyDebug.rawDisputeFactor?.toFixed(4)}</span></p>
                        <p><span className="text-zinc-500">proofRate:</span> <span className="text-emerald-400">{honestyDebug.rawProofRate?.toFixed(4)}</span></p>
                        <p className="mt-1"><span className="text-zinc-500">componentCalc:</span></p>
                        <p className="text-primary break-all">{honestyDebug.componentCalc}</p>
                        <p className="mt-1"><span className="text-zinc-500">rawScore:</span> <span className="text-amber-300">{honestyDebug.rawScore?.toFixed(4)}</span></p>
                        <p><span className="text-zinc-500">eventPoints:</span> {honestyDebug.eventPoints} <span className="text-zinc-500">/ scaleFactor:</span> {honestyDebug.scaleFactor}</p>
                        <p><span className="text-zinc-500">eventBonus:</span> <span className={honestyDebug.eventBonus >= 0 ? 'text-emerald-400' : 'text-red-400'}>{honestyDebug.eventBonus >= 0 ? '+' : ''}{honestyDebug.eventBonus}</span> <span className="text-zinc-500">(capped ±15)</span></p>
                        <p className="mt-2 text-white font-semibold border-t border-zinc-700 pt-2">
                          <span className="text-zinc-500">formula:</span> {honestyDebug.formula}
                        </p>
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* Honesty Events */}
              {honestyEvents.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold mb-3">Recent Events</h2>
                  <div className="flex flex-col gap-1.5">
                    {honestyEvents.map((event: any) => (
                      <Card key={event.id} padding="sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium">{event.description}</p>
                            <p className="text-[10px] text-muted-foreground">{timeAgo(event.created_at)}</p>
                          </div>
                          <p className={`text-sm font-bold ${event.points > 0 ? 'text-success' : 'text-destructive'}`}>
                            {event.points > 0 ? '+' : ''}{event.points}
                          </p>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}


            </>
          ) : (
            <EmptyState
              icon={<Shield className="h-7 w-7" />}
              title="Score unavailable"
              description="Create some expenses or settle debts to generate your honesty score"
            />
          )}
        </>
      )}

      {/* ═══ BADGES TAB ═══ */}
      {activeTab === 'badges' && (
        <>
          {badgesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Active Badges */}
              {badges.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-sm font-semibold mb-3">Your Badges</h2>
                  <div className="flex flex-col gap-2">
                    {badges.map(badge => (
                      <Card key={badge.id} padding="md" className="border-primary/20 bg-primary/5">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <CategoryIcon name={badge.config?.icon || 'award'} className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold">{badge.config?.name}</p>
                            <p className="text-xs text-muted-foreground">{badge.config?.description}</p>
                            <p className="text-[10px] text-primary mt-0.5">Earned {timeAgo(badge.earned_at)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-primary">{badge.score}</p>
                            <p className="text-[10px] text-muted-foreground">score</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* All Badges Progress */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold">
                    {badges.length > 0 ? 'All Badges' : 'Earn Badges'}
                  </h2>
                  <button onClick={loadBadges} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${badgesLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {Object.entries(allBadgeConfigs).map(([type, config]) => {
                    const evaluation = badgeEvaluations[type]
                    const isEarned = badges.some(b => b.badge_type === type)
                    return (
                      <Card key={type} padding="md" className={isEarned ? 'border-primary/20' : 'opacity-80'}>
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                            isEarned ? 'bg-primary/10' : 'bg-muted'
                          }`}>
                            <CategoryIcon name={config.icon || 'award'} className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold">{config.name}</p>
                              {isEarned && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">EARNED</span>}
                            </div>
                            <p className="text-xs text-muted-foreground">{config.description}</p>
                            {evaluation && !isEarned && (
                              <p className="text-[10px] text-muted-foreground mt-1">{evaluation.reason}</p>
                            )}
                          </div>
                          {evaluation && (
                            <div className="text-right shrink-0">
                              <p className={`text-sm font-bold ${evaluation.eligible ? 'text-success' : 'text-muted-foreground'}`}>
                                {evaluation.score}%
                              </p>
                            </div>
                          )}
                        </div>
                        {evaluation && !isEarned && (
                          <div className="mt-2">
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all ${
                                  evaluation.score >= 80 ? 'bg-success' : evaluation.score >= 50 ? 'bg-amber-400' : 'bg-muted-foreground'
                                }`}
                                style={{ width: `${Math.min(100, evaluation.score)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </Card>
                    )
                  })}

                  {Object.keys(allBadgeConfigs).length === 0 && !badgesLoading && (
                    <EmptyState
                      icon={<Award className="h-7 w-7" />}
                      title="No badge data"
                      description="Start settling debts and adding expenses to earn badges"
                    />
                  )}
                </div>
              </div>

              {/* How badges work */}
              <Card padding="md" className="bg-muted/30">
                <h3 className="text-xs font-semibold mb-2">How Badges Work</h3>
                <ul className="flex flex-col gap-1">
                  <li className="text-[10px] text-muted-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">•</span>
                    Badges are earned through sustained behavior, not one-time events
                  </li>
                  <li className="text-[10px] text-muted-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">•</span>
                    Evaluated on a rolling 90-day window
                  </li>
                  <li className="text-[10px] text-muted-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">•</span>
                    Badges can be revoked if you no longer meet criteria
                  </li>
                  <li className="text-[10px] text-muted-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">•</span>
                    30-day cooldown before re-earning a revoked badge
                  </li>
                  <li className="text-[10px] text-muted-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">•</span>
                    Minimum activity thresholds prevent easy earning
                  </li>
                </ul>
              </Card>
            </>
          )}
        </>
      )}

      {/* ═══ SHOP TAB ═══ */}
      {activeTab === 'shop' && (
        <>
          <Card className="mb-4 bg-linear-to-br from-amber-500/20 via-yellow-500/10 to-transparent border-amber-500/30" padding="sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-amber-300">Your Balance</p>
              <p className="text-sm font-bold text-amber-400">{points.toLocaleString()} EP</p>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-2 mb-4">
            {GOODIES.map((goodie) => {
              const canAfford = points >= goodie.cost
              return (
                <Card key={goodie.id} padding="sm" className={!canAfford ? 'opacity-60' : ''}>
                  <div className="flex flex-col items-center text-center gap-2 py-2">
                    <goodie.icon className="h-7 w-7 text-primary" />
                    <div>
                      <p className="text-xs font-semibold">{goodie.name}</p>
                      <p className="text-[10px] text-muted-foreground">{goodie.desc}</p>
                    </div>
                    <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${canAfford ? 'bg-amber-500/20 text-amber-400' : 'bg-muted text-muted-foreground'}`}>
                      {goodie.cost} EP
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
          <p className="text-[10px] text-muted-foreground text-center">Goodies shop coming soon! Keep earning points</p>
        </>
      )}
      </div>
    </div>
  )
}

// ── Helper Components ──────────────────────────────────────

function BreakdownRow({ icon, label, value, weight, description }: {
  icon: React.ReactNode
  label: string
  value: number
  weight: string
  description: string
}) {
  const color = value >= 80 ? 'bg-success' : value >= 60 ? 'bg-amber-400' : value >= 40 ? 'bg-warning' : 'bg-destructive'
  return (
    <Card padding="sm">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold">{label}</p>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">{weight}</span>
              <span className="text-xs font-bold">{value}%</span>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${value}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
    </Card>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <Card padding="sm">
      <div className="flex items-center gap-2">
        <CategoryIcon name={icon} className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-bold">{value}</p>
          <p className="text-[10px] text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  )
}

function ScoreRule({ icon, text, positive }: { icon: string; text: string; positive: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <CategoryIcon name={icon} className="h-3.5 w-3.5 text-muted-foreground" />
      <p className={`text-[10px] ${positive ? 'text-success' : 'text-destructive'}`}>{text}</p>
    </div>
  )
}
