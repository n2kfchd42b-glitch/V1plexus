import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNow, format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy')
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy h:mm a')
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function priorityColor(priority: string): string {
  switch (priority) {
    case 'urgent': return 'text-red-600 bg-red-50 border-red-200'
    case 'high': return 'text-orange-600 bg-orange-50 border-orange-200'
    case 'normal': return 'text-blue-600 bg-blue-50 border-blue-200'
    case 'low': return 'text-gray-600 bg-gray-50 border-gray-200'
    default: return 'text-gray-600 bg-gray-50 border-gray-200'
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case 'approved': return 'text-green-700 bg-green-50 border-green-200'
    case 'pending': return 'text-yellow-700 bg-yellow-50 border-yellow-200'
    case 'in_review': return 'text-blue-700 bg-blue-50 border-blue-200'
    case 'rejected': return 'text-red-700 bg-red-50 border-red-200'
    case 'revision_requested': return 'text-orange-700 bg-orange-50 border-orange-200'
    case 'feedback_given': return 'text-purple-700 bg-purple-50 border-purple-200'
    case 'revision_submitted': return 'text-indigo-700 bg-indigo-50 border-indigo-200'
    case 'blocked': return 'text-red-700 bg-red-50 border-red-200'
    case 'draft': return 'text-gray-700 bg-gray-50 border-gray-200'
    default: return 'text-gray-700 bg-gray-50 border-gray-200'
  }
}

export function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}
