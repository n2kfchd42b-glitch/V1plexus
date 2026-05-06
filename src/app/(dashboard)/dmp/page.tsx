'use client'

import { FileText, Zap, FileCheck2, Download, RefreshCw, Building2 } from 'lucide-react'
import { NETWORK_COMPLIANCE_ENABLED } from '@/lib/flags'
import { useLocale } from '@/i18n/LocaleProvider'

const FEATURES = [
  { icon: Zap,        labelKey: 'dmp.feature.aiLabel',       descKey: 'dmp.feature.aiDesc',       color: 'text-amber-500',   bg: 'bg-amber-50' },
  { icon: Building2,  labelKey: 'dmp.feature.funderLabel',   descKey: 'dmp.feature.funderDesc',   color: 'text-blue-500',    bg: 'bg-blue-50' },
  { icon: FileCheck2, labelKey: 'dmp.feature.editableLabel', descKey: 'dmp.feature.editableDesc', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { icon: Download,   labelKey: 'dmp.feature.pdfLabel',      descKey: 'dmp.feature.pdfDesc',      color: 'text-violet-500',  bg: 'bg-violet-50' },
  { icon: RefreshCw,  labelKey: 'dmp.feature.livingLabel',   descKey: 'dmp.feature.livingDesc',   color: 'text-cyan-500',    bg: 'bg-cyan-50' },
]

export default function DMPPage() {
  const { t } = useLocale()
  if (NETWORK_COMPLIANCE_ENABLED) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[var(--text-secondary)]" />
            <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">{t('dmp.title')}</h1>
          </div>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
            {t('dmp.subtitle')}
          </p>
        </div>
        <div className="flex items-center justify-center h-64 text-[var(--text-tertiary)] text-sm">
          {t('dmp.comingSoon')}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-amber-50 mb-4">
          <FileText className="h-6 w-6 text-amber-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{t('dmp.title')}</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
          {t('dmp.subtitle2')}
        </p>
      </div>

      <div className="space-y-3">
        {FEATURES.map(f => {
          const Icon = f.icon
          return (
            <div
              key={f.labelKey}
              className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl bg-white"
            >
              <div className={`flex-shrink-0 h-9 w-9 rounded-lg ${f.bg} flex items-center justify-center`}>
                <Icon className={`h-4 w-4 ${f.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">{t(f.labelKey)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t(f.descKey)}</p>
              </div>
              <span className="ml-auto flex-shrink-0 text-[11px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full h-fit mt-0.5">
                {t('dmp.soon')}
              </span>
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-gray-400 mt-8">
        {t('dmp.fundersNote')}
      </p>
    </div>
  )
}
