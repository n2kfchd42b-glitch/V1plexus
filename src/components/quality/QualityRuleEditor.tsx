// Not yet deployed
import type { DataQualityRule } from '@/types/database'
export function QualityRuleEditor(_props: {
  datasetId: string
  columns: string[]
  existingRule?: DataQualityRule
  onSaved: () => void
  onCancel: () => void
}) { return null }
