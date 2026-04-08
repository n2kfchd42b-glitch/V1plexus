export interface DAGEdge {
  from: string
  to: string
  confidence: number           // 0.0 – 1.0 from algorithm
  direction_certain: boolean
  involves_exposure: boolean
  involves_outcome: boolean
  // Set by UI after researcher interaction
  user_action?: 'accepted' | 'reversed' | 'removed' | 'added'
}

export interface DAGNode {
  id: string
  label: string
  role: 'exposure' | 'outcome' | 'covariate' | 'unknown'
  x?: number
  y?: number
}

export interface CausalDAG {
  id: string
  project_id: string
  dataset_id: string
  status: 'pending' | 'suggested' | 'confirmed' | 'rejected'
  exposure_variable: string
  outcome_variable: string
  suggested_edges: DAGEdge[]
  confirmed_edges: DAGEdge[] | null
  adjustment_set: string[] | null
  mediators: string[] | null
  colliders: string[] | null
  instruments: string[] | null
  algorithm_used: string | null
  algorithm_params: {
    alpha: number
    cit_used: string
    n_samples: number
    warnings: string[]
    error?: string
  } | null
  confirmed_by: string | null
  confirmed_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AdjustmentSetResult {
  adjustment_set: string[]
  mediators: string[]
  colliders: string[]
  instruments: string[]
  causal_paths: string[][]
  backdoor_paths: string[][]
  is_identified: boolean
  warnings: string[]
}
