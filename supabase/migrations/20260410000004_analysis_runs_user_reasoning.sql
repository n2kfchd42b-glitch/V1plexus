-- Add user_reasoning field to analysis_runs
-- Stores the researcher's plain-language rationale for why they ran the analysis.
-- Written by the ReasoningPrompt component after each successful run.

alter table analysis_runs
  add column if not exists user_reasoning text;
