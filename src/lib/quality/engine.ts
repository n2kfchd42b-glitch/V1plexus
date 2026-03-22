import type { DataQualityRule, DataQualityScore } from '@/types/database'

export interface QualityViolation {
  row_index: number
  row_data: Record<string, unknown>
  message: string
}

export interface RuleCheckResult {
  rule_id: string
  violations_count: number
  total_checked: number
  sample_violations: QualityViolation[]
}

type Row = Record<string, unknown>

// ─── Individual rule checkers ───────────────────────────────────────────────

function checkRangeRule(
  rows: Row[],
  rule: DataQualityRule
): RuleCheckResult {
  const { column_name, config } = rule
  if (!column_name) return { rule_id: rule.id, violations_count: 0, total_checked: 0, sample_violations: [] }

  const min = config.min as number | undefined
  const max = config.max as number | undefined
  const violations: QualityViolation[] = []
  let total = 0

  for (let i = 0; i < rows.length; i++) {
    const val = rows[i][column_name]
    if (val === null || val === undefined || val === '') continue
    const num = Number(val)
    if (isNaN(num)) continue
    total++
    const tooLow = min !== undefined && num < min
    const tooHigh = max !== undefined && num > max
    if (tooLow || tooHigh) {
      violations.push({
        row_index: i,
        row_data: rows[i],
        message: tooLow
          ? `${column_name} = ${num} is below minimum (${min})`
          : `${column_name} = ${num} exceeds maximum (${max})`,
      })
    }
  }

  return {
    rule_id: rule.id,
    violations_count: violations.length,
    total_checked: total,
    sample_violations: violations.slice(0, 20),
  }
}

function checkRequiredRule(rows: Row[], rule: DataQualityRule): RuleCheckResult {
  const { column_name } = rule
  if (!column_name) return { rule_id: rule.id, violations_count: 0, total_checked: rows.length, sample_violations: [] }
  const violations: QualityViolation[] = []

  for (let i = 0; i < rows.length; i++) {
    const val = rows[i][column_name]
    if (val === null || val === undefined || val === '') {
      violations.push({ row_index: i, row_data: rows[i], message: `${column_name} is missing` })
    }
  }

  return {
    rule_id: rule.id,
    violations_count: violations.length,
    total_checked: rows.length,
    sample_violations: violations.slice(0, 20),
  }
}

function checkUniqueRule(rows: Row[], rule: DataQualityRule): RuleCheckResult {
  const { column_name } = rule
  if (!column_name) return { rule_id: rule.id, violations_count: 0, total_checked: rows.length, sample_violations: [] }
  const seen = new Map<unknown, number>()
  const violations: QualityViolation[] = []

  for (let i = 0; i < rows.length; i++) {
    const val = rows[i][column_name]
    if (val === null || val === undefined) continue
    if (seen.has(val)) {
      violations.push({
        row_index: i,
        row_data: rows[i],
        message: `Duplicate value '${val}' in ${column_name} (first seen at row ${seen.get(val)})`,
      })
    } else {
      seen.set(val, i)
    }
  }

  return {
    rule_id: rule.id,
    violations_count: violations.length,
    total_checked: rows.length,
    sample_violations: violations.slice(0, 20),
  }
}

function checkOutlierRule(rows: Row[], rule: DataQualityRule): RuleCheckResult {
  const { column_name, config } = rule
  if (!column_name) return { rule_id: rule.id, violations_count: 0, total_checked: 0, sample_violations: [] }
  const sdThreshold = (config.sd_threshold as number) ?? 3

  const values = rows
    .map(r => r[column_name])
    .filter(v => v !== null && v !== undefined && v !== '')
    .map(Number)
    .filter(n => !isNaN(n))

  if (values.length < 3) return { rule_id: rule.id, violations_count: 0, total_checked: values.length, sample_violations: [] }

  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  const sd = Math.sqrt(variance)

  const violations: QualityViolation[] = []
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i][column_name]
    if (raw === null || raw === undefined) continue
    const num = Number(raw)
    if (isNaN(num)) continue
    if (Math.abs(num - mean) > sdThreshold * sd) {
      violations.push({
        row_index: i,
        row_data: rows[i],
        message: `${column_name} = ${num} is an outlier (${((num - mean) / sd).toFixed(1)} SD from mean ${mean.toFixed(2)})`,
      })
    }
  }

  return {
    rule_id: rule.id,
    violations_count: violations.length,
    total_checked: values.length,
    sample_violations: violations.slice(0, 20),
  }
}

function checkFormatRule(rows: Row[], rule: DataQualityRule): RuleCheckResult {
  const { column_name, config } = rule
  if (!column_name) return { rule_id: rule.id, violations_count: 0, total_checked: rows.length, sample_violations: [] }
  const pattern = config.pattern as string | undefined
  if (!pattern) return { rule_id: rule.id, violations_count: 0, total_checked: rows.length, sample_violations: [] }

  const re = new RegExp(pattern)
  const violations: QualityViolation[] = []

  for (let i = 0; i < rows.length; i++) {
    const val = rows[i][column_name]
    if (val === null || val === undefined || val === '') continue
    if (!re.test(String(val))) {
      violations.push({ row_index: i, row_data: rows[i], message: `${column_name} = "${val}" does not match expected format` })
    }
  }

  return {
    rule_id: rule.id,
    violations_count: violations.length,
    total_checked: rows.length,
    sample_violations: violations.slice(0, 20),
  }
}

function checkCrossFieldRule(rows: Row[], rule: DataQualityRule): RuleCheckResult {
  const { config } = rule
  const col1 = config.column1 as string
  const col2 = config.column2 as string
  const operator = config.operator as string // 'gte' | 'lte' | 'gt' | 'lt'

  if (!col1 || !col2) return { rule_id: rule.id, violations_count: 0, total_checked: rows.length, sample_violations: [] }

  const violations: QualityViolation[] = []

  for (let i = 0; i < rows.length; i++) {
    const v1 = Number(rows[i][col1])
    const v2 = Number(rows[i][col2])
    if (isNaN(v1) || isNaN(v2)) continue

    let violated = false
    if (operator === 'gte' && !(v1 >= v2)) violated = true
    if (operator === 'lte' && !(v1 <= v2)) violated = true
    if (operator === 'gt' && !(v1 > v2)) violated = true
    if (operator === 'lt' && !(v1 < v2)) violated = true

    if (violated) {
      violations.push({
        row_index: i,
        row_data: rows[i],
        message: `${col1} (${v1}) should be ${operator} ${col2} (${v2})`,
      })
    }
  }

  return {
    rule_id: rule.id,
    violations_count: violations.length,
    total_checked: rows.length,
    sample_violations: violations.slice(0, 20),
  }
}

// ─── Main runner ────────────────────────────────────────────────────────────

export function runQualityChecks(
  rows: Row[],
  rules: DataQualityRule[]
): RuleCheckResult[] {
  return rules
    .filter(r => r.is_active)
    .map(rule => {
      switch (rule.rule_type) {
        case 'range':        return checkRangeRule(rows, rule)
        case 'required':     return checkRequiredRule(rows, rule)
        case 'unique':       return checkUniqueRule(rows, rule)
        case 'outlier':      return checkOutlierRule(rows, rule)
        case 'format':       return checkFormatRule(rows, rule)
        case 'cross_field':  return checkCrossFieldRule(rows, rule)
        case 'completeness': return checkRequiredRule(rows, rule)
        default:             return { rule_id: rule.id, violations_count: 0, total_checked: rows.length, sample_violations: [] }
      }
    })
}

// ─── Score calculator ────────────────────────────────────────────────────────

export function calculateQualityScore(
  rows: Row[],
  results: RuleCheckResult[],
  rules: DataQualityRule[]
): Omit<DataQualityScore, 'id' | 'dataset_id' | 'version_id' | 'created_at'> {
  if (!rows.length || !results.length) {
    return { overall_score: 100, completeness: 100, validity: 100, uniqueness: 100, consistency: 100, errors_count: 0, warnings_count: 0 }
  }

  const ruleMap = new Map(rules.map(r => [r.id, r]))

  let errors = 0
  let warnings = 0
  let totalViolations = 0
  let totalChecked = 0

  for (const result of results) {
    const rule = ruleMap.get(result.rule_id)
    if (!rule) continue
    if (rule.severity === 'error') errors += result.violations_count
    if (rule.severity === 'warning') warnings += result.violations_count
    totalViolations += result.violations_count
    totalChecked += result.total_checked
  }

  // Completeness: fraction of non-null cells
  const totalCells = rows.length * Object.keys(rows[0] || {}).length
  const nullCells = rows.reduce((sum, row) => {
    return sum + Object.values(row).filter(v => v === null || v === undefined || v === '').length
  }, 0)
  const completeness = totalCells > 0 ? ((totalCells - nullCells) / totalCells) * 100 : 100

  // Validity: fraction of rows passing validation rules
  const validity = totalChecked > 0 ? Math.max(0, ((totalChecked - totalViolations) / totalChecked) * 100) : 100

  // Penalize score: errors = -3 pts each, warnings = -1 pt each
  const penalty = errors * 3 + warnings
  const overall = Math.max(0, Math.min(100, 100 - penalty))

  return {
    overall_score: Math.round(overall * 100) / 100,
    completeness: Math.round(completeness * 100) / 100,
    validity: Math.round(validity * 100) / 100,
    uniqueness: 100, // Simplified
    consistency: 100, // Simplified
    errors_count: errors,
    warnings_count: warnings,
  }
}

// ─── Auto-rule generator ─────────────────────────────────────────────────────

export interface ColumnInfo {
  name: string
  type: string
  sample_values?: unknown[]
}

export function generateAutoRules(columns: ColumnInfo[]): Omit<DataQualityRule, 'id' | 'dataset_id' | 'created_by' | 'created_at'>[] {
  const rules: Omit<DataQualityRule, 'id' | 'dataset_id' | 'created_by' | 'created_at'>[] = []

  for (const col of columns) {
    const name = col.name.toLowerCase()
    const type = col.type

    // Required / completeness check for all columns
    rules.push({
      name: `${col.name}: no missing values`,
      rule_type: 'completeness',
      column_name: col.name,
      config: {},
      severity: 'info',
      is_active: true,
      auto_generated: true,
    })

    if (type === 'numeric' || type === 'integer') {
      // Outlier detection
      rules.push({
        name: `${col.name}: outlier detection (3 SD)`,
        rule_type: 'outlier',
        column_name: col.name,
        config: { sd_threshold: 3 },
        severity: 'warning',
        is_active: true,
        auto_generated: true,
      })

      // Age columns
      if (name.includes('age')) {
        rules.push({
          name: `${col.name}: valid age range (0–120)`,
          rule_type: 'range',
          column_name: col.name,
          config: { min: 0, max: 120 },
          severity: 'error',
          is_active: true,
          auto_generated: true,
        })
      }

      // Hemoglobin
      if (name.includes('hemoglobin') || name.includes('hb') || name.includes('hgb')) {
        rules.push({
          name: `${col.name}: valid hemoglobin range (4–18 g/dL)`,
          rule_type: 'range',
          column_name: col.name,
          config: { min: 4, max: 18 },
          severity: 'warning',
          is_active: true,
          auto_generated: true,
        })
      }

      // Temperature
      if (name.includes('temp') || name.includes('temperature')) {
        rules.push({
          name: `${col.name}: valid temperature range (30–45°C)`,
          rule_type: 'range',
          column_name: col.name,
          config: { min: 30, max: 45 },
          severity: 'warning',
          is_active: true,
          auto_generated: true,
        })
      }

      // No negatives
      if (!name.includes('diff') && !name.includes('change') && !name.includes('delta')) {
        rules.push({
          name: `${col.name}: no negative values`,
          rule_type: 'range',
          column_name: col.name,
          config: { min: 0 },
          severity: 'warning',
          is_active: false, // off by default, user enables if appropriate
          auto_generated: true,
        })
      }
    }

    if (type === 'text' || type === 'categorical') {
      // Uniqueness check for ID/name columns
      if (name.includes('id') || name.endsWith('_id') || name === 'identifier') {
        rules.push({
          name: `${col.name}: unique values`,
          rule_type: 'unique',
          column_name: col.name,
          config: {},
          severity: 'error',
          is_active: true,
          auto_generated: true,
        })
      }
    }

    if (type === 'date') {
      rules.push({
        name: `${col.name}: not in future`,
        rule_type: 'format',
        column_name: col.name,
        config: { check: 'not_future' },
        severity: 'warning',
        is_active: true,
        auto_generated: true,
      })
    }
  }

  return rules
}
