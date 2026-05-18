import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SupervisorDatasetViewer } from '@/components/supervisor-student/SupervisorDatasetViewer'
import Link from 'next/link'
import { ArrowLeft, Database } from 'lucide-react'

export default async function SupervisorDatasetPage({
  params,
}: {
  params: Promise<{ id: string; datasetId: string }>
}) {
  const { id: projectId, datasetId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify supervisor access
  const { data: member } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) notFound()

  // Fetch dataset meta (only columns that exist on `datasets`)
  const { data: dataset } = await supabase
    .from('datasets')
    .select('id, name, description, project_id')
    .eq('id', datasetId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .single()

  if (!dataset) notFound()

  // Fetch project owner (student id)
  const { data: project } = await supabase
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .single()

  if (!project) notFound()

  // Get the latest version file path
  const { data: version } = await supabase
    .from('dataset_versions')
    .select('id, version_number, file_path, row_count')
    .eq('dataset_id', datasetId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link
            href={`/supervisor/projects/${projectId}`}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to project
          </Link>
          <span className="text-slate-200 select-none">·</span>
          <span className="text-sm font-semibold text-slate-800 truncate">{dataset.name}</span>
          {version && (
            <span className="ml-auto text-xs text-slate-400">
              {version.row_count?.toLocaleString() ?? '—'} rows · Version {version.version_number}
            </span>
          )}
        </div>
      </div>

      {!version?.file_path ? (
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <Database className="h-10 w-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500 mb-1">No data available yet</p>
          <p className="text-xs text-slate-400">The student has not uploaded a version of this dataset.</p>
        </div>
      ) : (
        <SupervisorDatasetViewer
          datasetId={datasetId}
          projectId={projectId}
          studentId={project.owner_id}
          filePath={version.file_path}
        />
      )}
    </div>
  )
}
