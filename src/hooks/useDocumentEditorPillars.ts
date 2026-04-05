/**
 * Integration hooks for document editor pillars
 */

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import type { DocumentAuthorRole } from '@/types/document-editor-pillars'
import type { DocumentVersion } from '@/types/document-editor-pillars'

/**
 * Hook for managing document authorship
 */
export function useDocumentAuthors(documentId: string) {
  const [authors, setAuthors] = useState<DocumentAuthorRole[]>([])
  const [loading, setLoading] = useState(false)

  const fetchAuthors = useCallback(async () => {
    setLoading(true)
    try {
      const { authors, error } = await fetch(
        `/api/documents/${documentId}/authors`
      ).then((r) => r.json())

      if (error) throw new Error(error)
      setAuthors(authors || [])
    } catch (err) {
      console.error('Failed to fetch authors:', err)
      toast.error('Failed to load authors')
    } finally {
      setLoading(false)
    }
  }, [documentId])

  const addAuthor = useCallback(
    async (authorData: Omit<DocumentAuthorRole, 'id' | 'created_at'>) => {
      try {
        const { data, error } = await fetch(
          `/api/documents/${documentId}/authors`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(authorData),
          }
        ).then((r) => r.json())

        if (error) throw new Error(error)
        setAuthors((prev) => [...prev, data.author])
        toast.success('Author added')
        return data.author
      } catch (err) {
        console.error('Failed to add author:', err)
        toast.error('Failed to add author')
        throw err
      }
    },
    [documentId]
  )

  const updateAuthor = useCallback(
    async (
      authorId: string,
      updates: Partial<DocumentAuthorRole>
    ) => {
      try {
        const { data, error } = await fetch(
          `/api/documents/${documentId}/authors/${authorId}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          }
        ).then((r) => r.json())

        if (error) throw new Error(error)
        setAuthors((prev) =>
          prev.map((a) => (a.id === authorId ? data.author : a))
        )
        return data.author
      } catch (err) {
        console.error('Failed to update author:', err)
        toast.error('Failed to update author')
        throw err
      }
    },
    [documentId]
  )

  const deleteAuthor = useCallback(
    async (authorId: string) => {
      if (!window.confirm('Remove this author?')) return

      try {
        const { error } = await fetch(
          `/api/documents/${documentId}/authors/${authorId}`,
          { method: 'DELETE' }
        ).then((r) => r.json())

        if (error) throw new Error(error)
        setAuthors((prev) => prev.filter((a) => a.id !== authorId))
        toast.success('Author removed')
      } catch (err) {
        console.error('Failed to delete author:', err)
        toast.error('Failed to delete author')
        throw err
      }
    },
    [documentId]
  )

  return {
    authors,
    loading,
    fetchAuthors,
    addAuthor,
    updateAuthor,
    deleteAuthor,
  }
}

/**
 * Hook for managing document versions
 */
export function useDocumentVersions(documentId: string) {
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [loading, setLoading] = useState(false)

  const fetchVersions = useCallback(
    async (includeAutoSave = false) => {
      setLoading(true)
      try {
        const { versions, error } = await fetch(
          `/api/documents/${documentId}/versions?includeAutoSave=${includeAutoSave}`
        ).then((r) => r.json())

        if (error) throw new Error(error)
        setVersions(versions || [])
      } catch (err) {
        console.error('Failed to fetch versions:', err)
        toast.error('Failed to load versions')
      } finally {
        setLoading(false)
      }
    },
    [documentId]
  )

  const saveVersion = useCallback(
    async (
      content: Record<string, unknown>,
      label?: string,
      changeSummary?: string
    ) => {
      try {
        const { data, error } = await fetch(
          `/api/documents/${documentId}/versions`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content,
              label,
              change_summary: changeSummary,
            }),
          }
        ).then((r) => r.json())

        if (error) throw new Error(error)
        setVersions((prev) => [data.version, ...prev])
        toast.success('Version saved')
        return data.version
      } catch (err) {
        console.error('Failed to save version:', err)
        toast.error('Failed to save version')
        throw err
      }
    },
    [documentId]
  )

  const restoreVersion = useCallback(
    async (versionId: string) => {
      try {
        const { data, error } = await fetch(
          `/api/documents/${documentId}/versions/${versionId}/restore`,
          { method: 'POST' }
        ).then((r) => r.json())

        if (error) throw new Error(error)
        toast.success('Version restored')
        return data.version
      } catch (err) {
        console.error('Failed to restore version:', err)
        toast.error('Failed to restore version')
        throw err
      }
    },
    [documentId]
  )

  return {
    versions,
    loading,
    fetchVersions,
    saveVersion,
    restoreVersion,
  }
}
