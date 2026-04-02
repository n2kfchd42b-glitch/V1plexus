import React from 'react'

export default function QualityMethodologyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <article className="prose prose-sm max-w-none">
        <header className="mb-12">
          <h1 className="text-4xl font-bold mb-2">Data Quality Intelligence Methodology</h1>
          <p className="text-lg text-gray-600">
            PLEXUS Data Quality Index (DQI) v1.0: A comprehensive framework for assessing research dataset excellence
          </p>
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm font-mono text-gray-600 m-0">
              <strong>Citation:</strong> PLEXUS Collaborative Research Platform. (2026). Data Quality Intelligence Methodology v1.0. 
              Available at: https://plexus.health/quality-methodology
            </p>
          </div>
        </header>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">1. Overview</h2>
          <p>
            The PLEXUS Data Quality Index (DQI) v1.0 is an algorithmic framework designed to quantify dataset excellence across 
            five scientifically-validated dimensions. The DQI provides research teams with actionable intelligence for improving 
            data quality before analysis, ensuring robust and reproducible research outcomes.
          </p>
          <p>
            The framework is deterministic, versioned (v1.0), and designed for automated computation as datasets are imported 
            into the platform. Quality scores are immutable and auditable for full transparency.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">2. Five Dimensions of Data Quality</h2>
          
          <div className="mb-8">
            <h3 className="text-xl font-bold mb-3">2.1 Completeness (30 points)</h3>
            <p><strong>Definition:</strong> The proportion of non-missing values across all variables.</p>
            <p><strong>Formula:</strong></p>
            <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto">
{`completeness_score = 30 × (non_missing_cells / total_cells)

Penalty System:
- If overall_missingness_rate > 0.40: 0 points (critical data loss)
- If overall_missingness_rate > 0.30: 10 points
- If overall_missingness_rate > 0.20: 15 points
- If overall_missingness_rate > 0.10: 20 points
- Otherwise: 30 points (full score)`}
            </pre>
            <p>
              <strong>High Missingness Detection:</strong> For each enumerator, columns with {">"} 50% missingness 
              are flagged as "high_missingness_columns" for enumerator-focused quality review.
            </p>
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-bold mb-3">2.2 Uniqueness (20 points)</h3>
            <p><strong>Definition:</strong> The proportion of unique values in identifier fields and the absence of exact duplicates.</p>
            <p><strong>Formula:</strong></p>
            <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto">
{`uniqueness_score = 20 × (1 - duplicate_row_rate)

Detection:
- Count exact row duplicates (all columns identical)
- If duplicate_row_rate == 0: 20 points
- If duplicate_row_rate > 0.01: 0 points (critical issue)
- Otherwise: 20 × (1 - duplicate_row_rate)

Flag if: duplicate_row_rate > 0.005 (0.5% threshold)`}
            </pre>
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-bold mb-3">2.3 Validity (20 points)</h3>
            <p><strong>Definition:</strong> The proportion of values that conform to expected formats, ranges, and business rules.</p>
            <p><strong>Formula:</strong></p>
            <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto">
{`validity_score = 20 × (valid_cells / non_missing_cells)

Type Validation:
- Numeric fields: Parse as float, flag unparseable values
- Date fields: Parse ISO-8601 or common formats
- Categorical fields: Check against enumerated domain if available
- Email/Phone: Basic regex validation

Penalty Rules:
- If invalid_rate > 0.20: 0 points
- If invalid_rate > 0.10: 5 points
- If invalid_rate > 0.05: 10 points
- Otherwise: 20 points (full score)`}
            </pre>
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-bold mb-3">2.4 Consistency (15 points)</h3>
            <p><strong>Definition:</strong> The uniformity of values across repeated measurements and the absence of contradictory data.</p>
            <p><strong>Formula:</strong></p>
            <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto">
{`consistency_score = 15 × (1 - inconsistency_rate)

Checks:
1. Repeated Value Stability: If participant appears multiple times, 
   check key demographic fields (age, sex, etc.) remain unchanged
2. Referential Integrity: Foreign key references must exist
3. Logical Constraints: e.g., end_date ≥ start_date

FLAG Triggers:
- If inconsistency_rate > 0.10: Critical flag
- If inconsistency_rate > 0.05: Warning flag`}
            </pre>
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-bold mb-3">2.5 Structural Integrity (15 points)</h3>
            <p><strong>Definition:</strong> The adherence to expected schema, column presence, and data type consistency.</p>
            <p><strong>Formula:</strong></p>
            <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto">
{`structural_score = 15 × (schema_compliance_rate)

Checks:
1. All expected columns present: Yes/No
2. Data types match schema: Check type consistency per column
3. No unexpected columns added: Flag new columns
4. Unique constraints honored: id, version_id uniqueness

Scoring:
- If all checks pass: 15 points
- Missing expected column: -3 points each
- Type mismatch: -2 points per column
- Unexpected column: -1 point per column`}
            </pre>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">3. Overall Quality Index Calculation</h2>
          <p><strong>Formula:</strong></p>
          <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto">
{`DQI = (completeness_score + uniqueness_score + validity_score + 
         consistency_score + structural_score) / 100 × 100

Scale: 0–100 (100 = perfect quality)`}
          </pre>
          
          <h3 className="text-lg font-bold mb-3 mt-6">Readiness Assessment</h3>
          <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto">
{`if DQI >= 80 and no_critical_flags:
    status = "ready"
    summary = "Dataset is ready for analysis with confidence"
elif DQI >= 60:
    status = "caution"
    summary = "Dataset may be usable; address flagged issues first"
else:
    status = "not_ready"
    summary = "Dataset requires significant quality improvements before use"`}
          </pre>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">4. Enumerator Quality Metrics</h2>
          <p>In addition to dataset-wide quality, PLEXUS computes per-enumerator metrics to identify data collection patterns:</p>
          
          <h3 className="text-lg font-bold mb-3">4.1 Metrics Computed</h3>
          <ul>
            <li><strong>Overall Missingness Rate:</strong> Proportion of missing values in records contributed by this enumerator</li>
            <li><strong>High Missingness Columns:</strong> Variables with {">"}50% missingness for this enumerator only</li>
            <li><strong>Outlier Rate:</strong> Proportion of values marked as statistical outliers (IQR method)</li>
            <li><strong>Response Pattern Score:</strong> Entropy-based measure (0–1) of response diversity; low values indicate repetitive patterns</li>
            <li><strong>Average Completion Time:</strong> Mean time in minutes between first and last record entry</li>
            <li><strong>Fast Completion Flag:</strong> True if avg_completion_time {"<"} 10th percentile (rushed data entry)</li>
          </ul>

          <h3 className="text-lg font-bold mb-3 mt-6">4.2 Enumerator Flag Status</h3>
          <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto">
{`if fast_completion_flag or outlier_rate > 0.10:
    flag_status = "investigate"
    reason = "[Fast completion | High outlier rate]"
elif overall_missingness_rate > 0.15 or any_column_missingness > 0.40:
    flag_status = "review"
    reason = "Elevated missingness detected"
else:
    flag_status = "clean"`}
          </pre>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">5. Cross-Wave Consistency Analysis</h2>
          <p>
            For longitudinal studies with multiple data collection waves, PLEXUS provides automated cross-wave analysis 
            to detect participant inconsistencies and distribution shifts.
          </p>

          <h3 className="text-lg font-bold mb-3">5.1 Participant Matching</h3>
          <p>
            Participants are matched using the specified <code>participant_id_column</code>. The analysis reports:
          </p>
          <ul>
            <li>Count of participants in Wave A and Wave B</li>
            <li>Number of matched participants (present in both waves)</li>
            <li>Participants unique to Wave A</li>
            <li>Participants unique to Wave B</li>
          </ul>

          <h3 className="text-lg font-bold mb-3">5.2 Inconsistency Detection</h3>
          <p><strong>Checks:</strong></p>
          <ul>
            <li>
              <strong>Implausible Changes:</strong> Age decreased, or categorical fields (sex, ethnicity) changed between waves
            </li>
            <li>
              <strong>Category Mismatches:</strong> For known categorical domains, values in Wave B should be in the same set as Wave A
            </li>
            <li>
              <strong>Missing in Wave:</strong> If participant exists in Wave A but critical fields are missing in Wave B
            </li>
          </ul>

          <h3 className="text-lg font-bold mb-3">5.3 Distribution Shift Testing</h3>
          <p>
            For each numeric variable, PLEXUS applies the <strong>Kolmogorov-Smirnov (KS) test</strong> to detect 
            significant distribution shifts between Wave A and Wave B.
          </p>
          <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto">
{`KS Statistic: Maximum vertical distance between two CDFs
Null Hypothesis: Wave A and Wave B distributions are identical
Significance: p < 0.05 indicates significant distribution shift

Interpretation:
- If p < 0.05: Distribution has SIGNIFICANTLY changed
- If p ≥ 0.05: No significant shift detected`}
          </pre>

          <h3 className="text-lg font-bold mb-3">5.4 Consistency Score</h3>
          <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto">
{`consistency_score = 100 × (1 - (critical_count + 0.5 × warning_count) / matched_participants)

Where:
- critical_count: Implausible changes, missing critical fields
- warning_count: Category mismatches, minor inconsistencies
- Range: 0–100, higher is better consistency`}
          </pre>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">6. Quality Flags and Alerts</h2>
          <p>
            PLEXUS categorizes all quality findings into three severity levels to guide researcher action:
          </p>
          <ul>
            <li>
              <strong className="text-red-600">Critical:</strong> Severe data issues that may invalidate analysis. 
              Must be addressed before dataset marks "ready"
            </li>
            <li>
              <strong className="text-amber-600">Warning:</strong> Moderate data quality concerns that may impact interpretation. 
              Recommend review and mitigation
            </li>
            <li>
              <strong className="text-blue-600">Info:</strong> Informational findings for researcher awareness. 
              FYI only, does not block analysis
            </li>
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">7. Determinism and Versioning</h2>
          <p>
            The DQI v1.0 algorithm is <strong>deterministic</strong>: given the same dataset, the same quality score is 
            always computed. This ensures reproducibility and auditability.
          </p>
          <p>
            All quality reports are <strong>immutable</strong> and include:
          </p>
          <ul>
            <li>Computed timestamp</li>
            <li>Algorithm version (v1.0)</li>
            <li>Computed by (system user ID)</li>
            <li>All dimension scores and methodologies</li>
          </ul>
          <p>
            If the algorithm is improved in the future, a new version (e.g., v1.1) will be introduced, and historical 
            v1.0 scores remain preserved for audit trail completeness.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">8. Integration with Audit Trail</h2>
          <p>
            All quality computations are logged in the PLEXUS Immutable Audit Ledger (see {' '}
            <a href="/audit" className="text-blue-600 hover:underline">Audit Trail page</a>)
            with cryptographic hash chaining for tamper-evidence. This ensures full transparency and accountability for 
            quality assessments.
          </p>
        </section>

        <footer className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            <strong>Last Updated:</strong> April 2, 2026 | <strong>Status:</strong> Public Documentation | 
            <strong> License:</strong> CC BY 4.0
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Questions? Contact the PLEXUS research team at support@plexus.health
          </p>
        </footer>
      </article>
    </div>
  )
}
