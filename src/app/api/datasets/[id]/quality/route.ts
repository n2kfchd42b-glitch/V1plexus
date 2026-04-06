import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { QualityReport, QualityFlag, QualityDimensions } from '@/types/qualityIntelligence'
import type { DataRow, ColumnSchema } from '@/types/database'

// ── In-process quality computation ──────────────────────────────────────────

function computeReport(
  rows: DataRow[],
  columns: ColumnSchema[]
): Omit<QualityReport, 'id' | 'dataset_id' | 'version_id' | 'computed_at' | 'computed_by'> {
  const n = rows.length
  const totalCells = n * columns.length

  // Completeness: ratio of non-null/non-empty cells
  let nullCount = 0
  for (const row of rows) {
    for (const col of columns) {
      const v = row[col.name]
      if (v === null || v === undefined || v === '') nullCount++
    }
  }
  const completenessScore = totalCells > 0
    ? Math.round(100 - (nullCount / totalCells) * 100)
    : 100

  // Uniqueness: exact duplicate row detection
  const serialized = rows.map(r => JSON.stringify(r))
  const uniqueCount = new Set(serialized).size
  const dupeCount = n - uniqueCount
  const uniquenessScore = n > 0 ? Math.round((uniqueCount / n) * 100) : 100

  // Validity: type mismatch detection for declared numeric columns
  let invalidCount = 0
  for (const col of columns) {
    if (col.type === 'number' || col.type === 'integer') {
      for (const row of rows) {
        const v = row[col.name]
        if (v !== null && v !== undefined && v !== '' && isNaN(Number(v))) invalidCount++
      }
    }
  }
  const validityScore = totalCells > 0
    ? Math.round(100 - (invalidCount / totalCells) * 100)
    : 100

  // Consistency: IQR outlier detection on numeric columns
  let outlierCount = 0
  let numericCols = 0
  for (const col of columns) {
    if (col.type === 'number' || col.type === 'integer') {
      numericCols++
      const vals = rows
        .map(r => Number(r[col.name]))
        .filter(v => !isNaN(v))
        .sort((a, b) => a - b)
      if (vals.length >= 4) {
        const q1 = vals[Math.floor(vals.length * 0.25)]
        const q3 = vals[Math.floor(vals.length * 0.75)]
        const iqr = q3 - q1
        const lo = q1 - 1.5 * iqr
        const hi = q3 + 1.5 * iqr
        for (const row of rows) {
          const v = Number(row[col.name])
          if (!isNaN(v) && (v < lo || v > hi)) outlierCount++
        }
      }
    }
  }
  const consistencyScore = numericCols > 0
    ? Math.round(Math.max(0, 100 - (outlierCount / Math.max(n * numericCols, 1)) * 100))
    : 100

  // Structural integrity: entirely empty columns
  let emptyColCount = 0
  for (const col of columns) {
    const allEmpty = rows.every(r => {
      const v = r[col.name]
      return v === null || v === undefined || v === ''
    })
    if (allEmpty) emptyColCount++
  }
  const structuralScore = columns.length > 0
    ? Math.round(100 - (emptyColCount / columns.length) * 100)
    : 100

  // Weighted overall score
  const overallScore = Math.min(100, Math.max(0, Math.round(
    completenessScore * 0.30 +
    uniquenessScore   * 0.25 +
    validityScore     * 0.20 +
    consistencyScore  * 0.15 +
    structuralScore   * 0.10
  )))

  const dimensions: QualityDimensions = {
    completeness: {
      score: completenessScore,
      max_score: 100,
      findings: nullCount > 0
        ? [`${nullCount} missing values (${((nullCount / totalCells) * 100).toFixed(1)}% of all cells)`]
        : ['No missing values detected'],
      methodology: 'Non-null ratio across all cells',
    },
    uniqueness: {
      score: uniquenessScore,
      max_score: 100,
      findings: dupeCount > 0
        ? [`${dupeCount} exact duplicate rows detected`]
        : ['All rows are unique'],
      methodology: 'Unique row ratio via exact-match serialization',
    },
    validity: {
      score: validityScore,
      max_score: 100,
      findings: invalidCount > 0
        ? [`${invalidCount} type violations in numeric columns`]
        : ['All values match declared types'],
      methodology: 'Type consistency against declared column schema',
    },
    consistency: {
      score: consistencyScore,
      max_score: 100,
      findings: outlierCount > 0
        ? [`${outlierCount} outliers detected via IQR method`]
        : ['No statistical outliers detected'],
      methodology: '1.5× IQR outlier detection on numeric columns',
    },
    structural_integrity: {
      score: structuralScore,
      max_score: 100,
      findings: emptyColCount > 0
        ? [`${emptyColCount} entirely empty column(s)`]
        : ['All columns contain data'],
      methodology: 'Column completeness and schema stability',
    },
  }

  const flags: QualityFlag[] = []
  if (completenessScore < 80) {
    flags.push({
      severity: completenessScore < 60 ? 'critical' : 'warning',
      category: 'completeness',
      variable: null,
      message: `${nullCount} missing values across the dataset`,
      detail: `${((nullCount / totalCells) * 100).toFixed(1)}% missingness rate may affect analysis reliability`,
      auto_resolved: false,
    })
  }
  if (dupeCount > 0) {
    flags.push({
      severity: uniquenessScore < 90 ? 'critical' : 'warning',
      category: 'uniqueness',
      variable: null,
      message: `${dupeCount} exact duplicate rows detected`,
      detail: 'Duplicate records can introduce bias in statistical analysis',
      auto_resolved: false,
    })
  }
  if (outlierCount > 0 && consistencyScore < 85) {
    flags.push({
      severity: 'warning',
      category: 'consistency',
      variable: null,
      message: `${outlierCount} potential outliers in numeric columns`,
      detail: 'Values outside the 1.5× interquartile range',
      auto_resolved: false,
    })
  }
  if (emptyColCount > 0) {
    flags.push({
      severity: 'warning',
      category: 'structural',
      variable: null,
      message: `${emptyColCount} completely empty column(s)`,
      detail: 'Columns with no data may indicate collection failures',
      auto_resolved: false,
    })
  }

  let readiness_status: 'ready' | 'caution' | 'not_ready'
  let readiness_summary: string
  if (overallScore >= 80) {
    readiness_status = 'ready'
    readiness_summary = 'Dataset meets quality thresholds for analysis.'
  } else if (overallScore >= 60) {
    readiness_status = 'caution'
    readiness_summary = 'Quality issues detected. Review flagged items before proceeding with analysis.'
  } else {
    readiness_status = 'not_ready'
    readiness_summary = 'Significant quality problems found. Address all critical flags before analysis.'
  }

  return {
    overall_score: overallScore,
    dimensions,
    flags,
    enumerator_metrics: null,
    readiness_status,
    readiness_summary,
    algorithm_version: 'v1.0',
  }
}

// ── Shared access check ──────────────────────────────────────────────────────
// Returns the project_id if the user can access the dataset (owner OR member),
// or null if not found, or 'forbidden' if access denied.

async function resolveAccess(
  datasetId: string,
  userId: string
): Promise<{ projectId: string } | 'not_found' | 'forbidden'> {
  const service = createServiceClient()

  const { data: dataset } = await service
    .from('datasets')
    .select('project_id')
    .eq('id', datasetId)
    .single()
  if (!dataset) return 'not_found'

  // Check ownership first (project owner is always allowed)
  const { data: project } = await service
    .from('projects')
    .select('owner_id')
    .eq('id', dataset.project_id)
    .single()

  if (project?.owner_id === userId) return { projectId: dataset.project_id }

  // Fall back to project_members table
  const { data: member } = await service
    .from('project_members')
    .select('id')
    .eq('project_id', dataset.project_id)
    .eq('user_id', userId)
    .single()

  if (member) return { projectId: dataset.project_id }

  return 'forbidden'
}

// ── GET /api/datasets/[id]/quality ──────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: datasetId } = await params
    const url = new URL(request.url)
    const versionId = url.searchParams.get('version_id')

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const access = await resolveAccess(datasetId, user.id)
    if (access === 'not_found') return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
    if (access === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Fetch from DB — no FastAPI dependency
    const service = createServiceClient()
    let query = service
      .from('dataset_quality_reports')
      .select('*')
      .eq('dataset_id', datasetId)

    if (versionId) {
      query = query.eq('version_id', versionId)
    } else {
      query = query.order('computed_at', { ascending: false }).limit(1)
    }

    const { data: report, error: reportError } = await query.single()

    if (reportError || !report) {
      return NextResponse.json({ error: 'No quality report found' }, { status: 404 })
    }

    return NextResponse.json(report)
  } catch (error) {
    console.error('[GET /api/datasets/[id]/quality]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── POST /api/datasets/[id]/quality ─────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: datasetId } = await params
    const body = await request.json()
    const { version_id } = body

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const access = await resolveAccess(datasetId, user.id)
    if (access === 'not_found') return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
    if (access === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Resolve the version to compute for
    const service = createServiceClient()
    let versionQuery = service
      .from('dataset_versions')
      .select('id, file_path')
      .eq('dataset_id', datasetId)

    if (version_id) {
      versionQuery = versionQuery.eq('id', version_id)
    } else {
      versionQuery = versionQuery.order('version_number', { ascending: false }).limit(1)
    }

    const { data: version, error: versionError } = await versionQuery.single()
    if (versionError || !version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    // Download dataset file from Supabase Storage
    const { data: fileData, error: downloadError } = await service.storage
      .from('datasets')
      .download(version.file_path)

    if (downloadError || !fileData) {
      console.error('[quality compute] storage download error', downloadError)
      return NextResponse.json({ error: 'Failed to load dataset file' }, { status: 500 })
    }

    // Parse rows and columns
    const text = await fileData.text()
    let rows: DataRow[]
    let columns: ColumnSchema[]
    try {
      const parsed = JSON.parse(text) as { rows: DataRow[]; columns: ColumnSchema[] }
      rows = parsed.rows
      columns = parsed.columns
    } catch {
      return NextResponse.json({ error: 'Failed to parse dataset file' }, { status: 500 })
    }

    // Guard against datasets too large for synchronous in-process computation
    if (rows.length > 50_000) {
      return NextResponse.json(
        { error: `Dataset has ${rows.length.toLocaleString()} rows, which exceeds the 50,000-row limit for synchronous quality checks. Please reduce dataset size before running quality analysis.` },
        { status: 422 }
      )
    }

    // Compute quality metrics in-process
    const metrics = computeReport(rows, columns)

    // Upsert into dataset_quality_reports (unique on version_id)
    const { data: saved, error: saveError } = await service
      .from('dataset_quality_reports')
      .upsert(
        {
          dataset_id: datasetId,
          version_id: version.id,
          computed_by: user.id,
          ...metrics,
        },
        { onConflict: 'version_id' }
      )
      .select('*')
      .single()

    if (saveError || !saved) {
      console.error('[quality compute] save error', saveError)
      return NextResponse.json({ error: 'Failed to save quality report' }, { status: 500 })
    }

    return NextResponse.json(saved)
  } catch (error) {
    console.error('[POST /api/datasets/[id]/quality]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
