"use client"

import { useRouter } from 'next/navigation'
import { User, Building2 } from 'lucide-react'

interface WorkspaceChooserProps {
  userName: string
}

export function WorkspaceChooser({ userName }: WorkspaceChooserProps) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome to PLEXUS, {userName}!
          </h1>
          <p className="text-gray-600 mt-2">Let&apos;s set up your workspace.</p>
          <p className="text-gray-700 font-medium mt-4">How do you primarily work?</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Independent Researcher */}
          <button
            onClick={() => router.push('/setup/individual')}
            className="group bg-white rounded-xl border-2 border-gray-200 hover:border-blue-500 p-8 text-left transition-all duration-200 hover:shadow-lg"
          >
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-50 group-hover:bg-blue-100 mb-4 transition-colors">
              <User className="h-7 w-7 text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">INDEPENDENT RESEARCHER</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              I work on my own or with informal collaborators. I&apos;ll invite people to specific projects.
            </p>
            <div className="mt-6">
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 group-hover:text-blue-700">
                Choose →
              </span>
            </div>
          </button>

          {/* Institution Member */}
          <button
            onClick={() => router.push('/setup/institution/join')}
            className="group bg-white rounded-xl border-2 border-gray-200 hover:border-indigo-500 p-8 text-left transition-all duration-200 hover:shadow-lg"
          >
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-indigo-50 group-hover:bg-indigo-100 mb-4 transition-colors">
              <Building2 className="h-7 w-7 text-indigo-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">INSTITUTION MEMBER</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              I&apos;m part of a university, research center, or NGO. My institution has departments and supervisors.
            </p>
            <div className="mt-6">
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 group-hover:text-indigo-700">
                Choose →
              </span>
            </div>
          </button>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          You can always add an institution later, or create personal projects alongside institutional work.
        </p>
      </div>
    </div>
  )
}
