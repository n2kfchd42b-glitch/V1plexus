import Link from 'next/link'
import {
  FlaskConical, ArrowRight, CheckCircle, BarChart3, FileText,
  Shield, Users, BookOpen, Globe, Layers, Zap, Star
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const features = [
  {
    icon: BookOpen,
    title: 'Protocol Builder',
    description: 'Design structured research protocols with templates for ethics, consent, and methodology.',
    color: 'text-blue-600 bg-blue-50',
  },
  {
    icon: BarChart3,
    title: 'Analytics Engine',
    description: 'Run statistical analyses directly in the platform with R and Python support.',
    color: 'text-purple-600 bg-purple-50',
  },
  {
    icon: Zap,
    title: 'AI Writing Assistant',
    description: 'Get intelligent suggestions, improve clarity, and auto-generate sections.',
    color: 'text-amber-600 bg-amber-50',
  },
  {
    icon: Shield,
    title: 'Ethics Tracking',
    description: 'Track ethics approvals, expiry dates, and compliance status automatically.',
    color: 'text-green-600 bg-green-50',
  },
  {
    icon: Users,
    title: 'Supervisor Reviews',
    description: 'Structured review workflows with inline comments and approval gating.',
    color: 'text-rose-600 bg-rose-50',
  },
  {
    icon: Globe,
    title: 'Institutional Dashboard',
    description: 'Compliance reporting and oversight for departments and institutions.',
    color: 'text-indigo-600 bg-indigo-50',
  },
]

const audiences = [
  {
    role: 'Students',
    icon: '🎓',
    points: ['Guided protocol creation', 'Real-time feedback from supervisors', 'Track project milestones'],
  },
  {
    role: 'Supervisors',
    icon: '👩‍🏫',
    points: ['Review queue management', 'Inline annotation tools', 'Manage multiple student projects'],
  },
  {
    role: 'Departments',
    icon: '🏛️',
    points: ['Department-wide compliance view', 'Ethics approval tracking', 'Aggregate reporting'],
  },
  {
    role: 'Institutions',
    icon: '🌍',
    points: ['SSO integration', 'Multi-department oversight', 'Export for regulatory bodies'],
  },
]

const tools = ['Protocol Builder', 'Ethics Tracker', 'AI Writing', 'Analytics Engine', 'Review Workflows', 'Version Control']

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b bg-white/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-blue-600" />
            <span className="font-bold text-lg text-gray-900">PLEXUS</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/login?mode=signup">
              <Button size="sm">Get Started Free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 sm:py-32 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <Badge className="mb-6 bg-blue-100 text-blue-700 border-blue-200 text-xs px-3 py-1">
            Built for Global Health Research
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 leading-tight mb-6">
            The Research Platform for{' '}
            <span className="text-blue-600">Global Health</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            PLEXUS connects your entire research lifecycle — from protocol design to publication — in one collaborative platform built for institutions.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login?mode=signup">
              <Button size="lg" className="h-12 px-8 text-base">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline" className="h-12 px-8 text-base">
                See How It Works
              </Button>
            </Link>
          </div>
          <p className="text-sm text-gray-400 mt-4">No credit card required · Free for researchers</p>
        </div>
      </section>

      {/* Problem */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Researchers use <span className="text-red-500">6+ tools</span> to complete one project
            </h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              Google Docs, email, Dropbox, Zotero, SPSS, ethics portals… each with their own login, format, and version chaos.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {tools.map(tool => (
              <div key={tool} className="flex items-center gap-2 bg-white border rounded-full px-4 py-2 text-sm font-medium text-gray-700 shadow-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                {tool}
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <p className="text-sm text-blue-600 font-medium">All of these, unified in PLEXUS ↓</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Everything your research needs
            </h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              From ethics approval to final report — manage the full lifecycle without switching tabs.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(f => {
              const Icon = f.icon
              return (
                <Card key={f.title} className="border hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-4 ${f.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{f.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* For Whom */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Built for every role</h2>
            <p className="text-gray-600">Whether you&apos;re a student or a provost, PLEXUS fits your workflow.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {audiences.map(a => (
              <div key={a.role} className="bg-white rounded-xl border p-6 hover:shadow-md transition-shadow">
                <div className="text-3xl mb-3">{a.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-3">{a.role}</h3>
                <ul className="space-y-2">
                  {a.points.map(pt => (
                    <li key={pt} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-16 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex justify-center gap-1 mb-4">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-5 w-5 text-yellow-300 fill-yellow-300" />
            ))}
          </div>
          <blockquote className="text-xl sm:text-2xl font-medium text-white mb-4">
            &ldquo;PLEXUS reduced our ethics review cycle from 3 weeks to 4 days. The integrated workflow is a game-changer for our department.&rdquo;
          </blockquote>
          <p className="text-blue-200 text-sm">Dr. Amara Mensah · Head of Research, Korle-Bu Teaching Hospital</p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Up and running in minutes</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Create an account', desc: 'Sign up free and join or create your institution.' },
              { step: '02', title: 'Start a project', desc: 'Set up your research protocol with guided templates.' },
              { step: '03', title: 'Collaborate & submit', desc: 'Invite supervisors, get reviews, and export for submission.' },
            ].map(s => (
              <div key={s.step} className="text-center">
                <div className="text-5xl font-black text-blue-100 mb-4">{s.step}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <Layers className="h-12 w-12 text-blue-600 mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Start your research on PLEXUS
          </h2>
          <p className="text-gray-600 mb-8 text-lg">
            Join thousands of researchers from leading institutions across Africa and beyond.
          </p>
          <Link href="/login?mode=signup">
            <Button size="lg" className="h-12 px-10 text-base">
              Create Free Account
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-blue-600" />
              <span className="font-bold text-gray-900">PLEXUS</span>
              <span className="text-gray-400 text-sm ml-2">Research Lab Platform</span>
            </div>
            <div className="flex gap-6 text-sm text-gray-500">
              <Link href="/login" className="hover:text-gray-900 transition-colors">Sign in</Link>
              <Link href="/login?mode=signup" className="hover:text-gray-900 transition-colors">Register</Link>
              <span>© 2025 PLEXUS</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
