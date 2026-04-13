"use client"

// useAuth is a thin context reader — all subscription logic lives in AuthProvider.
// One subscription for the entire app instead of one per component, which was
// causing Supabase auth lock contention (the 5 s lock warning).
import { useAuthContext } from '@/components/auth/AuthProvider'

export function useAuth() {
  return useAuthContext()
}
