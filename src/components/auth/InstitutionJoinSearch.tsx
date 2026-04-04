"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Building2 } from 'lucide-react'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import type { Institution } from '@/types/database'

export function InstitutionJoinSearch() {
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<Institution[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    const { data } = await supabase
      .from('institutions')
      .select('*')
      .ilike('name', `%${searchQuery}%`)
      .limit(5)
    setResults(data ?? [])
    setSearchLoading(false)
  }

  const handleInviteCode = () => {
    if (!inviteCode.trim()) return
    router.push(`/invite/${inviteCode.trim()}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <BrandLogo variant="standalone" href="/dashboard" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Join or create an institution</h2>
        </div>

        {/* Join existing */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-4">
            <span className="h-4 w-4 rounded-full border-2 border-blue-600 flex-shrink-0 flex items-center justify-center">
              <span className="h-2 w-2 rounded-full bg-blue-600" />
            </span>
            My institution is already on PLEXUS
          </label>

          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Search by institution name…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button variant="outline" onClick={handleSearch} disabled={searchLoading}>
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {results.length > 0 && (
            <div className="space-y-2 mb-4">
              {results.map(inst => (
                <div
                  key={inst.id}
                  className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors cursor-pointer"
                  onClick={() => router.push(`/setup/institution/join?id=${inst.id}`)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">{inst.name}</span>
                  </div>
                  {inst.country && (
                    <p className="text-xs text-gray-500 ml-6">{inst.country}</p>
                  )}
                  <button
                    className="mt-2 ml-6 text-xs font-medium text-blue-600 hover:text-blue-700"
                    onClick={e => { e.stopPropagation(); router.push(`/setup/institution/join?id=${inst.id}`) }}
                  >
                    Request to Join →
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <div className="mt-4">
            <Label className="text-xs text-gray-600">Enter invitation code</Label>
            <div className="flex gap-2 mt-1">
              <Input
                placeholder="Invitation code…"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" onClick={handleInviteCode} disabled={!inviteCode.trim()}>
                Join
              </Button>
            </div>
          </div>
        </div>

        {/* Create new institution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-4">
            <span className="h-4 w-4 rounded-full border-2 border-gray-400" />
            My institution is NOT on PLEXUS yet — I&apos;ll set it up
          </label>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push('/setup/institution/new')}
          >
            Set Up New Institution →
          </Button>
        </div>

        <button
          onClick={() => router.push('/setup')}
          className="text-sm text-gray-500 hover:text-gray-700 w-full text-center"
        >
          ← Back
        </button>
      </div>
    </div>
  )
}
