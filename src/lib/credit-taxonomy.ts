/**
 * CRediT (Contributor Roles Taxonomy)
 * https://casrai.org/credit/
 */

export const CREDIT_TAXONOMY = {
  conceptualization: {
    label: 'Conceptualization',
    description: 'Ideas; formulation or evolution of overarching research goals and aims',
  },
  data_curation: {
    label: 'Data Curation',
    description: 'Management activities to annotate (produce metadata), scrub data and maintain research data (including software code, where it is necessary for interpreting the data itself) for initial use and later reuse',
  },
  formal_analysis: {
    label: 'Formal Analysis',
    description: 'Application of statistical, mathematical, computational, or other formal techniques to analyze or synthesize study data',
  },
  funding_acquisition: {
    label: 'Funding Acquisition',
    description: 'Acquisition of the financial support for the project leading to this publication',
  },
  investigation: {
    label: 'Investigation',
    description: 'Conducting a research and investigation process, specifically performing the experiments, or data/evidence collection',
  },
  methodology: {
    label: 'Methodology',
    description: 'Development or design of methodology; creation of models',
  },
  project_administration: {
    label: 'Project Administration',
    description: 'Management and coordination responsibility for the research activity planning and execution',
  },
  resources: {
    label: 'Resources',
    description: 'Provision of study materials, reagents, materials, patients, laboratory samples, animals, instrumentation, computing resources, or other analysis tools',
  },
  software: {
    label: 'Software',
    description: 'Programming, software development; designing computer programs; implementation of the computer code and supporting algorithms; testing of existing code components',
  },
  supervision: {
    label: 'Supervision',
    description: 'Oversight and leadership responsibility for the research activity planning and execution, including mentorship external to the core team',
  },
  validation: {
    label: 'Validation',
    description: 'Verification, whether as a part of the activity or separate, of the overall replication/reproducibility of results/experiments and other research outputs',
  },
  visualization: {
    label: 'Visualization',
    description: 'Preparation, creation and/or presentation of the published work, specifically visualization/data presentation',
  },
  writing_original_draft: {
    label: 'Writing – Original Draft',
    description: 'Preparation, creation and/or presentation of the published work, specifically writing the initial draft (including substantive translations)',
  },
  writing_review_editing: {
    label: 'Writing – Review & Editing',
    description: 'Preparation, creation and/or presentation of the published work by those from the original research group, specifically critical review, commentary or revision – including pre- or post-publication stages',
  },
} as const;

export type CreditRole = keyof typeof CREDIT_TAXONOMY;

export const CREDIT_ROLES_ARRAY = Object.keys(CREDIT_TAXONOMY) as CreditRole[];

export function getCreditLabel(role: CreditRole): string {
  return CREDIT_TAXONOMY[role]?.label || role;
}

export function getCreditDescription(role: CreditRole): string {
  return CREDIT_TAXONOMY[role]?.description || '';
}

/**
 * Group CRediT roles by category for UI presentation
 */
export const CREDIT_CATEGORIES = {
  'Conceptualization & Design': ['conceptualization', 'methodology', 'project_administration'],
  'Data & Analysis': ['investigation', 'data_curation', 'formal_analysis', 'validation'],
  'Resources & Support': ['resources', 'funding_acquisition', 'software'],
  'Oversight': ['supervision'],
  'Writing & Communication': ['visualization', 'writing_original_draft', 'writing_review_editing'],
} as const;
