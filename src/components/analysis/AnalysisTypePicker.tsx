"use client"

import { cn } from '@/lib/utils'
import type { AnalysisType } from '@/types/database'
import {
  BarChart2, PieChart, CheckSquare, Columns, TestTube2,
  TrendingUp, Network, Activity, GitBranch, Layers,
  Map, Microscope, Calculator, Sigma, Target, Shapes,
  GitMerge, Box, Minus, ArrowRight
} from 'lucide-react'

export interface AnalysisTypeInfo {
  type: AnalysisType
  label: string
  description: string
  icon: React.ReactNode
  category: string
  chartType: string
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
    icon: <Layers className="h-5 w-5" />, chartType: 'Coefficient plot per level'
  },
  {
    type: 'ordinal_regression', label: 'Ordinal Logistic', category: 'Regression',
    description: 'Proportional odds model for ordinal outcomes',
    icon: <ArrowRight className="h-5 w-5" />, chartType: 'Cumulative probability'
  },
  {
    type: 'poisson_regression', label: 'Poisson Regression', category: 'Regression',
    description: 'Count outcomes: incidence rate ratios, overdispersion test',
    icon: <Activity className="h-5 w-5" />, chartType: 'IRR forest plot'
  },
  {
    type: 'negbinomial_regression', label: 'Negative Binomial', category: 'Regression',
    description: 'Overdispersed count data with dispersion parameter',
    icon: <Activity className="h-5 w-5" />, chartType: 'IRR forest plot'
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
    icon: <GitMerge className="h-5 w-5" />, chartType: 'Loading heatmap + Scree'
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
    icon: <Map className="h-5 w-5" />, chartType: 'Choropleth map'
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

const categoryColors: Record<string, string> = {
  Basic: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
  Regression: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800',
  Survival: 'bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800',
  Advanced: 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800',
  Epidemiology: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
  Design: 'bg-gray-50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-700',
}

const categoryTextColors: Record<string, string> = {
  Basic: 'text-blue-700 dark:text-blue-300',
  Regression: 'text-green-700 dark:text-green-300',
  Survival: 'text-purple-700 dark:text-purple-300',
  Advanced: 'text-orange-700 dark:text-orange-300',
  Epidemiology: 'text-red-700 dark:text-red-300',
  Design: 'text-gray-700 dark:text-gray-300',
}

interface Props {
  selected: AnalysisType | null
  onSelect: (type: AnalysisType) => void
}

export function AnalysisTypePicker({ selected, onSelect }: Props) {
  const categories = ['Basic', 'Regression', 'Survival', 'Advanced', 'Epidemiology', 'Design']

  return (
    <div className="space-y-6">
      {categories.map(category => {
        const types = ANALYSIS_TYPES.filter(t => t.category === category)
        return (
          <div key={category}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{category}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {types.map(info => (
                <button
                  key={info.type}
                  onClick={() => onSelect(info.type)}
                  className={cn(
                    'text-left rounded-lg border p-3 transition-all hover:shadow-sm',
                    categoryColors[category],
                    selected === info.type ? 'ring-2 ring-primary shadow-sm' : 'hover:border-opacity-80'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className={cn('mt-0.5', categoryTextColors[category])}>{info.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">{info.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{info.description}</p>
                      <p className={cn('text-[10px] mt-1 font-medium', categoryTextColors[category])}>{info.chartType}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
