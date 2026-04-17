import { getDB, now } from './db'
import type { AnalysisJob } from './db'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunAnalysisFn = (payload: any) => Promise<{ run_id: string } | null>

export async function queueAnalysis(config: {
  project_id: string
  dataset_id: string
  version_id: string
  analysis_type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any
  created_by: string | null
}): Promise<string> {
  const id = crypto.randomUUID()
  const job: AnalysisJob = {
    id,
    project_id: config.project_id,
    dataset_id: config.dataset_id,
    version_id: config.version_id,
    analysis_type: config.analysis_type,
    config: config.payload,
    status: 'queued',
    run_id: null,
    error: null,
    queued_at: now(),
    dispatched_at: null,
    completed_at: null,
    created_by: config.created_by,
  }
  const db = getDB()
  await db.analysis_jobs.add(job)
  return id
}

export async function dispatchQueuedJobs(
  runAnalysisFn: RunAnalysisFn
): Promise<{ dispatched: number; failed: number }> {
  if (!navigator.onLine) return { dispatched: 0, failed: 0 }

  const db = getDB()
  const queued = await db.analysis_jobs
    .where('status')
    .equals('queued')
    .sortBy('queued_at')

  let dispatched = 0
  let failed = 0

  for (const job of queued) {
    try {
      await db.analysis_jobs.update(job.id, {
        status: 'dispatching',
        dispatched_at: now(),
      })

      const result = await runAnalysisFn(job.config)

      if (result?.run_id) {
        await db.analysis_jobs.update(job.id, {
          status: 'running',
          run_id: result.run_id,
        })
        dispatched++
      } else {
        throw new Error('No run_id from analysis engine')
      }
    } catch (err) {
      await db.analysis_jobs.update(job.id, {
        status: 'failed',
        error: String(err),
      })
      failed++
    }
  }

  return { dispatched, failed }
}

export async function getProjectJobs(project_id: string): Promise<AnalysisJob[]> {
  const db = getDB()
  const jobs = await db.analysis_jobs
    .where('project_id')
    .equals(project_id)
    .toArray()
  return jobs.sort(
    (a, b) => new Date(b.queued_at).getTime() - new Date(a.queued_at).getTime()
  )
}

export async function getPendingJobCount(): Promise<number> {
  const db = getDB()
  return db.analysis_jobs.where('status').anyOf(['queued', 'dispatching']).count()
}

export async function clearCompletedJobs(): Promise<void> {
  const db = getDB()
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  await db.analysis_jobs
    .where('status')
    .equals('completed')
    .and(j => j.queued_at < cutoff)
    .delete()
}
