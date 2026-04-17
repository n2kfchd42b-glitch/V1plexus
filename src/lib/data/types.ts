export type DataResult<T> = {
  data: T | null
  error: string | null
  status: 'success' | 'error'
}

export type DataListResult<T> = {
  data: T[]
  error: string | null
  status: 'success' | 'error'
  count?: number
}

export function ok<T>(data: T): DataResult<T> {
  return { data, error: null, status: 'success' }
}

export function okList<T>(data: T[], count?: number): DataListResult<T> {
  return { data, error: null, status: 'success', count }
}

export function err<T>(message: string): DataResult<T> {
  return { data: null, error: message, status: 'error' }
}

export function errList<T>(message: string): DataListResult<T> {
  return { data: [], error: message, status: 'error' }
}
