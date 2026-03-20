'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Project } from '@/types/app'
import type { InsertTables, UpdateTables } from '@/types/database'

type ProjectInsert = InsertTables<'projects'>
type ProjectUpdate = UpdateTables<'projects'>

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)
    const { data, error: err } = await supabase
      .from('projects')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (err) setError(err.message)
    else setProjects((data as Project[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  async function createProject(input: Omit<ProjectInsert, 'owner_id'>) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error: err } = await supabase
      .from('projects')
      .insert({ ...input, owner_id: user.id })
      .select()
      .single()

    if (err) throw new Error(err.message)

    const project = data as Project
    await supabase.from('project_members').insert({
      project_id: project.id,
      user_id: user.id,
      role: 'pi' as const,
    })

    await fetchProjects()
    return project
  }

  async function updateProject(id: string, updates: ProjectUpdate) {
    const supabase = createClient()
    const { error: err } = await supabase
      .from('projects')
      .update(updates as Record<string, unknown>)
      .eq('id', id)

    if (err) throw new Error(err.message)
    await fetchProjects()
  }

  async function deleteProject(id: string) {
    const supabase = createClient()
    const { error: err } = await supabase
      .from('projects')
      .update({ deleted_at: new Date().toISOString() } as Record<string, unknown>)
      .eq('id', id)

    if (err) throw new Error(err.message)
    await fetchProjects()
  }

  return { projects, loading, error, createProject, updateProject, deleteProject, refetch: fetchProjects }
}

export function useProject(id: string) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProject() {
      const supabase = createClient()
      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single()
      setProject(data as Project | null)
      setLoading(false)
    }
    fetchProject()
  }, [id])

  async function updateProject(updates: ProjectUpdate) {
    const supabase = createClient()
    const { error: err } = await supabase
      .from('projects')
      .update(updates as Record<string, unknown>)
      .eq('id', id)
    if (err) throw new Error(err.message)
    setProject((prev) => prev ? { ...prev, ...updates } as Project : prev)
  }

  return { project, loading, updateProject }
}
