"use client"

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { AnalysisType } from '@/types/database'
import {
  BarChart2, PieChart, CheckSquare, Columns, TestTube2,
  TrendingUp, Network, Activity, GitBranch, Layers,
  Map, Microscope, Calculator, Sigma, Target, Shapes,
  GitMerge, Box, Minus, ArrowRight, ChevronLeft,
} from 'lucide-react'

export interface AnalysisTypeInfo {
  type: AnalysisType
  label: string
  description: string
  icon: React.ReactNode
  category: string
  chartType: string
  /** True-browser engine uses an approximation; real implementation needs MLE/IRLS */
  approximation?: boolean
  approximationNote?: string
  /** Not yet implemented — disabled in the picker */
  unavailable?: boolean
}

export const ANALYSIS_TYPES: AnalysisTypeInfo[] = [
  {
    type: 'descriptive', label: 'Descriptive Statistics', category: 'Basic',
    description: 'Mean, SD, median, IQR, skewness, kurtosis for all variables',
    icon: <BarChart2 className="h-5 w-5" />, chartType: 'Histogram + Box plot'
  },
  {
    type: 'frequency', label: 'Frequency Tables', category: 'Basic',
    description: 'Frequency distribution, cross-tabulation, percentages',
    icon: <PieChart className="h-5 w-5" />, chartType: 'Bar chart + Mosaic'
  },
  {
    type: 'chi_square', label: 'Chi-Square Test', category: 'Basic',
    description: 'Association between two categorical variables, Fisher\'s exact',
    icon: <CheckSquare className="h-5 w-5" />, chartType: 'Mosaic plot'
  },
  {
    type: 't_test', label: 'T-Test', category: 'Basic',
    description: 'Compare means: independent, paired, or one-sample',
    icon: <Columns className="h-5 w-5" />, chartType: 'Box plot + jitter'
  },
  {
    type: 'anova', label: 'ANOVA', category: 'Basic',
    description: 'One-way or two-way ANOVA with post-hoc tests (Tukey, Bonferroni)',
    icon: <Sigma className="h-5 w-5" />, chartType: 'Box plot with brackets'
  },
  {
    type: 'correlation', label: 'Correlation', category: 'Basic',
    description: 'Pearson or Spearman correlation matrix with p-values',
    icon: <Network className="h-5 w-5" />, chartType: 'Heatmap + Scatter matrix'
  },
  {
    type: 'simple_regression', label: 'Simple Linear Regression', category: 'Regression',
    description: 'Regression with one predictor: slope, R², F-test',
    icon: <TrendingUp className="h-5 w-5" />, chartType: 'Scatter + regression line'
  },
  {
    type: 'multiple_regression', label: 'Multiple Linear Regression', category: 'Regression',
    description: 'Multiple predictors, VIF, residual diagnostics',
    icon: <GitBranch className="h-5 w-5" />, chartType: 'Coefficient plot + Residuals'
  },
  {
    type: 'logistic_regression', label: 'Binary Logistic Regression', category: 'Regression',
    description: 'Binary outcome: odds ratios, AUC, ROC curve, Hosmer-Lemeshow',
    icon: <Target className="h-5 w-5" />, chartType: 'Forest plot (OR) + ROC curve'
  },
  {
    type: 'multinomial_regression', label: 'Multinomial Logistic', category: 'Regression',
    description: 'Categorical outcome with 3+ levels, relative risk ratios',
    icon: <Layers className="h-5 w-5" />, chartType: 'Coefficient plot per level',
    approximation: true,
    approximationNote: 'Uses one-vs-rest binary logistic regressions. True MNL requires simultaneous MLE across all categories.'
  },
  {
    type: 'ordinal_regression', label: 'Ordinal Logistic', category: 'Regression',
    description: 'Proportional odds model for ordinal outcomes',
    icon: <ArrowRight className="h-5 w-5" />, chartType: 'Cumulative probability',
    approximation: true,
    approximationNote: 'Approximated with binary logistic regression. True proportional odds model requires IRLS and threshold parameters.'
  },
  {
    type: 'poisson_regression', label: 'Poisson Regression', category: 'Regression',
    description: 'Count outcomes: incidence rate ratios, overdispersion test',
    icon: <Activity className="h-5 w-5" />, chartType: 'IRR forest plot'
  },
  {
    type: 'negbinomial_regression', label: 'Negative Binomial', category: 'Regression',
    description: 'Overdispersed count data with dispersion parameter',
    icon: <Activity className="h-5 w-5" />, chartType: 'IRR forest plot',
    approximation: true,
    approximationNote: 'Uses Poisson regression (θ=∞). True negative binomial requires dispersion parameter estimation via MLE.'
  },
  {
    type: 'kaplan_meier', label: 'Kaplan-Meier Survival', category: 'Survival',
    description: 'Survival curves, median survival, log-rank test',
    icon: <Activity className="h-5 w-5" />, chartType: 'KM curves + risk table'
  },
  {
    type: 'cox_regression', label: 'Cox Proportional Hazards', category: 'Survival',
    description: 'Hazard ratios, concordance index, PH assumption test',
    icon: <Activity className="h-5 w-5" />, chartType: 'Forest plot (HR)'
  },
  {
    type: 'time_series', label: 'Time Series', category: 'Advanced',
    description: 'Decomposition (trend/seasonal/residual), ACF/PACF',
    icon: <TrendingUp className="h-5 w-5" />, chartType: 'Decomposition panel + ACF'
  },
  {
    type: 'pca', label: 'Principal Component Analysis', category: 'Advanced',
    description: 'Eigenvalues, variance explained, loadings, biplot',
    icon: <Shapes className="h-5 w-5" />, chartType: 'Scree plot + Biplot'
  },
  {
    type: 'factor_analysis', label: 'Factor Analysis', category: 'Advanced',
    description: 'Factor loadings with varimax/promax rotation, communalities',
    icon: <GitMerge className="h-5 w-5" />, chartType: 'Loading heatmap + Scree',
    approximation: true,
    approximationNote: 'Uses PCA as a proxy. True EFA requires iterated principal axis factoring with varimax/promax rotation and communality convergence.'
  },
  {
    type: 'cluster_analysis', label: 'Cluster Analysis', category: 'Advanced',
    description: 'K-means or hierarchical clustering with silhouette scores',
    icon: <Box className="h-5 w-5" />, chartType: 'Cluster scatter plot'
  },
  {
    type: 'meta_analysis', label: 'Meta-Analysis', category: 'Advanced',
    description: 'Fixed/random effects, I², Egger\'s test, publication bias',
    icon: <Layers className="h-5 w-5" />, chartType: 'Forest plot + Funnel plot'
  },
  {
    type: 'spatial_analysis', label: 'Spatial Analysis', category: 'Epidemiology',
    description: 'Disease mapping, rates by location, choropleth visualization',
    icon: <Map className="h-5 w-5" />, chartType: 'Choropleth map',
    unavailable: true,
  },
  {
    type: 'outbreak_investigation', label: 'Outbreak Investigation', category: 'Epidemiology',
    description: 'Epidemic curve, attack rates, 2×2 tables, RR/OR',
    icon: <Microscope className="h-5 w-5" />, chartType: 'Epidemic curve + attack rates'
  },
  {
    type: 'sample_size', label: 'Sample Size / Power', category: 'Design',
    description: 'Calculate required sample size for 5 study designs',
    icon: <Calculator className="h-5 w-5" />, chartType: 'Power curve'
  },
]

// ── Goal-to-methods mapping ───────────────────────────────────────────────────

interface GoalGroup {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  types: AnalysisType[]
}

const GOAL_GROUPS: GoalGroup[] = [
  {
    id: 'describe',
    label: 'Describe my data',
    description: 'Summarise variables, distributions, and frequencies',
    icon: <BarChart2 className="h-6 w-6" />,
    types: ['descriptive', 'frequency'],
  },
  {
    id: 'compare',
    label: 'Compare groups',
    description: 'Test for differences between two or more groups',
    icon: <Columns className="h-6 w-6" />,
    types: ['t_test', 'anova', 'chi_square'],
  },
  {
    id: 'relate',
    label: 'Find relationships',
    description: 'Explore associations and correlations between variables',
    icon: <Network className="h-6 w-6" />,
    types: ['correlation', 'simple_regression'],
  },
  {
    id: 'predict',
    label: 'Predict an outcome',
    description: 'Model a continuous, binary, or count outcome from predictors',
    icon: <TrendingUp className="h-6 w-6" />,
    types: ['multiple_regression', 'logistic_regression', 'multinomial_regression', 'ordinal_regression', 'poisson_regression', 'negbinomial_regression'],
  },
  {
    id: 'survive',
    label: 'Analyse time-to-event',
    description: 'Survival curves, hazard ratios, and time series trends',
    icon: <Activity className="h-6 w-6" />,
    types: ['kaplan_meier', 'cox_regression', 'time_series'],
  },
  {
    id: 'cluster',
    label: 'Classify or reduce',
    description: 'Find hidden groups or reduce dimensionality',
    icon: <Shapes className="h-6 w-6" />,
    types: ['pca', 'factor_analysis', 'cluster_analysis'],
  },
  {
    id: 'epi',
    label: 'Epidemiology & synthesis',
    description: 'Outbreak analysis, disease mapping, or meta-analysis',
    icon: <Microscope className="h-6 w-6" />,
    types: ['outbreak_investigation', 'spatial_analysis', 'meta_analysis'],
  },
  {
    id: 'design',
    label: 'Plan my study',
    description: 'Calculate required sample size and statistical power',
    icon: <Calculator className="h-6 w-6" />,
    types: ['sample_size'],
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  selected: AnalysisType | null
  onSelect: (type: AnalysisType) => void
}

export function AnalysisTypePicker({ selected, onSelect }: Props) {
  const [activeGoal, setActiveGoal] = useState<string | null>(() => {
    if (!selected) return null
    return GOAL_GROUPS.find(g => g.types.includes(selected))?.id ?? null
  })

  const filteredTypes = activeGoal
    ? ANALYSIS_TYPES.filter(t => GOAL_GROUPS.find(g => g.id === activeGoal)?.types.includes(t.type))
    : []

  // ── Step 1: Goal selection ─────────────────────────────────────────
  if (!activeGoal) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-[#52525B] mb-4">What is your research goal?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {GOAL_GROUPS.map(goal => (
            <button
              key={goal.id}
              onClick={() => setActiveGoal(goal.id)}
              className="group text-left rounded-xl border border-[rgba(0,82,204,0.15)] bg-white p-4 hover:bg-[#003d9b] hover:border-[#003d9b] hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start gap-3">
                <span className="text-[#0040a2] group-hover:text-white transition-colors duration-200 mt-0.5 flex-shrink-0">
                  {goal.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#18181B] group-hover:text-white transition-colors duration-200 leading-tight">
                    {goal.label}
                  </p>
                  <p className="text-[11px] text-[#71717A] group-hover:text-white/70 transition-colors duration-200 mt-0.5 leading-snug">
                    {goal.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Step 2: Method selection ───────────────────────────────────────
  const goal = GOAL_GROUPS.find(g => g.id === activeGoal)!

  return (
    <div className="space-y-4">
      {/* Back + goal label */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveGoal(null)}
          className="flex items-center gap-1 text-xs font-medium text-[#52525B] hover:text-[#18181B] transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          All goals
        </button>
        <span className="text-[#c3c6d6]">·</span>
        <span className="text-xs font-semibold text-[#0040a2]">{goal.label}</span>
      </div>

      {/* Methods grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {filteredTypes.map(info => (
          <button
            key={info.type}
            onClick={() => !info.unavailable && onSelect(info.type)}
            disabled={info.unavailable}
            className={cn(
              'group text-left rounded-lg border p-3 transition-all duration-200',
              'bg-white border-[rgba(0,82,204,0.18)]',
              info.unavailable
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-[#003d9b] hover:border-[#003d9b] hover:shadow-md',
              selected === info.type ? 'ring-2 ring-[#0052cc] shadow-sm' : ''
            )}
          >
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-[#0040a2] group-hover:text-white transition-colors duration-200 flex-shrink-0">
                {info.icon}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-medium leading-tight text-[#18181B] group-hover:text-white transition-colors duration-200">
                    {info.label}
                  </p>
                  {info.approximation && (
                    <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 group-hover:bg-white/20 group-hover:text-white group-hover:border-white/30 transition-colors duration-200">
                      approx
                    </span>
                  )}
                  {info.unavailable && (
                    <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">
                      coming soon
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#71717A] mt-0.5 leading-tight group-hover:text-white/75 transition-colors duration-200">
                  {info.description}
                </p>
                {info.approximation && info.approximationNote && (
                  <p className="text-[10px] text-amber-600 mt-0.5 leading-tight italic group-hover:text-white/70 transition-colors duration-200">
                    {info.approximationNote}
                  </p>
                )}
                <p className="text-[10px] mt-1 font-medium text-[#0040a2] group-hover:text-white/80 transition-colors duration-200">
                  {info.chartType}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
