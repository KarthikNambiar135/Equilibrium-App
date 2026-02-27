'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import { ArrowLeft, Users, Loader2 } from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()

  const [allowFriendsAdd, setAllowFriendsAdd] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    setIsLoading(true)
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        setAllowFriendsAdd(data.allow_friends_add_to_group ?? true)
      }
    } catch { /* silent */ }
    setIsLoading(false)
  }

  async function toggleAllowFriendsAdd() {
    const newValue = !allowFriendsAdd
    setAllowFriendsAdd(newValue)
    setIsSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allow_friends_add_to_group: newValue }),
      })
    } catch {
      // Revert on error
      setAllowFriendsAdd(!newValue)
    }
    setIsSaving(false)
  }

  if (isLoading) {
    return (
      <div className="px-5 pt-14 pb-4 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm px-5 pt-14 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </div>

      <div className="px-5">

      {/* Groups & Privacy */}
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Groups & Privacy</p>

      <Card padding="md">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Let friends add you to groups</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {allowFriendsAdd
                ? 'Friends can directly add you to their groups'
                : 'Friends must send an invite — you approve before joining'}
            </p>
          </div>
          <button
            onClick={toggleAllowFriendsAdd}
            disabled={isSaving}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0 ${allowFriendsAdd ? 'bg-primary' : 'bg-muted-foreground/30'}`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${allowFriendsAdd ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>
      </Card>
      </div>
    </div>
  )
}
