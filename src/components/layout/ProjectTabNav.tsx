"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, FileText, ShieldCheck, GitMerge, BarChart2,
  Database, Users, Settings, Link2, BookOpen, UserCheck,
  TrendingUp, Sword, FileCheck,
} from "lucide-react";

interface ProjectTabNavProps {
  projectId: string;
  isThesis?: boolean;
}

export function ProjectTabNav({ projectId, isThesis }: ProjectTabNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const researchTabs = [
    { href: `/projects/${projectId}/overview`,     label: "Overview",      icon: LayoutDashboard },
    { href: `/projects/${projectId}/team`,         label: "Team",          icon: Users },
    { href: `/projects/${projectId}/documents`,    label: "Documents",     icon: FileText },
    { href: `/projects/${projectId}/ethics`,       label: "Ethics",        icon: ShieldCheck },
    { href: `/projects/${projectId}/approvals`,    label: "Approvals",     icon: GitMerge },
    { href: `/projects/${projectId}/data`,         label: "Data",          icon: Database },
    { href: `/projects/${projectId}/analysis`,     label: "Analysis",      icon: BarChart2 },
    { href: `/projects/${projectId}/integrations`, label: "Integrations",  icon: Link2 },
    { href: `/projects/${projectId}/settings`,     label: "Settings",      icon: Settings },
  ];

  const thesisTabs = [
    { href: `/projects/${projectId}/chapters`,     label: "Chapters",      icon: BookOpen },
    { href: `/projects/${projectId}/committee`,    label: "Committee",     icon: UserCheck },
    { href: `/projects/${projectId}/progress`,     label: "Progress",      icon: TrendingUp },
    { href: `/projects/${projectId}/ethics`,       label: "Ethics",        icon: ShieldCheck },
    { href: `/projects/${projectId}/data`,         label: "Data",          icon: Database },
    { href: `/projects/${projectId}/analysis`,     label: "Analysis",      icon: BarChart2 },
    { href: `/projects/${projectId}/defense`,      label: "Defense",       icon: Sword },
    { href: `/projects/${projectId}/format-check`, label: "Format Check",  icon: FileCheck },
    { href: `/projects/${projectId}/activity`,     label: "Activity",      icon: GitMerge },
    { href: `/projects/${projectId}/settings`,     label: "Settings",      icon: Settings },
  ];

  const tabs = isThesis ? thesisTabs : researchTabs;

  // Alt+1–9 to switch tabs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < tabs.length) {
        e.preventDefault();
        router.push(tabs[idx].href);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tabs, router]);

  return (
    <div className="border-b border-[var(--border-default)] bg-[var(--bg-app)] px-6 overflow-x-auto">
      <nav className="flex gap-0.5 -mb-px min-w-max">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-all duration-150 whitespace-nowrap",
                active
                  ? "border-[var(--accent-blue)] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:border-[var(--border-default)]"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", active ? "text-[var(--accent-blue)]" : "text-current")} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
