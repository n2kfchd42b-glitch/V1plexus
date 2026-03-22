"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, FileText, ShieldCheck } from "lucide-react";

export function ProjectTabNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const tabs = [
    {
      href: `/projects/${projectId}/overview`,
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      href: `/projects/${projectId}/documents`,
      label: "Documents",
      icon: FileText,
    },
    {
      href: `/projects/${projectId}/ethics`,
      label: "Ethics",
      icon: ShieldCheck,
    },
  ];

  // Alt+1/2/3 to switch tabs
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
    <div className="bg-white border-b border-gray-200 px-8">
      <nav className="flex gap-1">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                active
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
