/**
 * Portfolio Initialization Hook
 * Auto-generates username on first portfolio visit if not set
 * Silent operation - no UI action required from user
 */

'use client'

import { useEffect, useRef } from 'react'

interface UsePortfolioInitProps {
  userId: string | undefined
  currentUsername: string | null
  onUsernameGenerated?: (newUsername: string) => void
}

export function usePortfolioInit({
  userId,
  currentUsername,
  onUsernameGenerated,
}: UsePortfolioInitProps) {
  const hasInitialized = useRef(false)

  useEffect(() => {
    // Skip if already has username or no user ID
    if (currentUsername || !userId || hasInitialized.current) {
      return
    }

    hasInitialized.current = true

    const initializePortfolio = async () => {
      try {
        // Fetch user's full name to generate username
        const userResponse = await fetch('/api/auth/me')
        if (!userResponse.ok) return

        const { user } = await userResponse.json()
        if (!user?.user_metadata?.full_name) return

        // Generate and save username
        const fullName = user.user_metadata.full_name
        const generateUsername = (name: string): string => {
          return name
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .substring(0, 25)
        }

        const newUsername = generateUsername(fullName)

        // Check if username is available
        const checkResponse = await fetch(
          `/api/portfolio/username/check?username=${encodeURIComponent(newUsername)}`
        )
        if (!checkResponse.ok) return

        const { available } = await checkResponse.json()
        if (!available) return // Username taken, skip auto-generation

        // Save username silently
        const updateResponse = await fetch('/api/portfolio/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: newUsername }),
        })

        if (updateResponse.ok) {
          const { profile } = await updateResponse.json()
          onUsernameGenerated?.(profile.username)
        }
      } catch (error) {
        console.debug('Portfolio initialization: username already set or skipped')
      }
    }

    initializePortfolio()
  }, [userId, currentUsername, onUsernameGenerated])
}

/**
 * Alternative: Direct initialization function for use in components
 */
export async function initializePortfolioUsername(
  userId: string,
  fullName: string
): Promise<string | null> {
  try {
    const generateUsername = (name: string): string => {
      return name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .substring(0, 25)
    }

    const newUsername = generateUsername(fullName)

    // Check availability
    const checkResponse = await fetch(
      `/api/portfolio/username/check?username=${encodeURIComponent(newUsername)}`
    )
    if (!checkResponse.ok) return null

    const { available } = await checkResponse.json()
    if (!available) return null

    // Updates username
    const updateResponse = await fetch('/api/portfolio/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUsername }),
    })

    if (updateResponse.ok) {
      const { profile } = await updateResponse.json()
      return profile.username
    }

    return null
  } catch (error) {
    console.error('Failed to initialize portfolio username:', error)
    return null
  }
}
