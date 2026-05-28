/**
 * Single source of truth for the "Institution" sidebar group, shared by
 * WorkspaceSidebar (desktop) and MobileSidebar. Previously the same array
 * was hand-copied into both; adding a sub-page meant editing two files,
 * and they had already drifted in PR G.
 *
 * Items are typed against lucide-react's component shape but kept lazy
 * (icon: () => Component) so this module stays icon-import-free — each
 * sidebar imports the icons it actually wants and resolves them via the
 * `iconName` key, keeping bundle size flat.
 */

import {
  LayoutDashboard, Users, GraduationCap, ClipboardList, Building2,
  Palette, ScrollText, UserPlus, FileSearch, Mail,
  type LucideIcon,
} from 'lucide-react'

export interface InstitutionNavItem {
  href: string
  icon: LucideIcon
  label: string
  /** When true the active matcher requires an exact path match. */
  exact?: boolean
}

export const INSTITUTION_NAV: readonly InstitutionNavItem[] = [
  { href: '/institution',                icon: LayoutDashboard, label: 'Overview',      exact: true },
  { href: '/institution/members',        icon: Users,           label: 'Members' },
  { href: '/institution/programmes',     icon: GraduationCap,   label: 'Programmes' },
  { href: '/institution/roster',         icon: ClipboardList,   label: 'Roster' },
  { href: '/institution/departments',    icon: Building2,       label: 'Departments' },
  { href: '/institution/branding',       icon: Palette,         label: 'Branding' },
  { href: '/institution/policy',         icon: ScrollText,      label: 'Thesis policy' },
  { href: '/institution/link-requests',  icon: UserPlus,        label: 'Link requests' },
  { href: '/institution/audit',          icon: FileSearch,      label: 'Audit' },
  { href: '/institution/inquiries',      icon: Mail,            label: 'Inquiries' },
]

export function isInstitutionNavActive(pathname: string, item: InstitutionNavItem): boolean {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + '/')
}
