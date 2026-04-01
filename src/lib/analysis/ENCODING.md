# PLEXUS Analytics Engine: Automatic Categorical Encoding

## Overview

The analysis engine now transparently handles automatic categorical encoding. Variables are automatically classified as **continuous**, **binary**, **nominal**, or **ordinal**, and categorical variables are automatically encoded for analysis.

This eliminates the manual "Yes/No → 1/0" encoding requirement that researchers previously had to do externally.

## Variable Type Classification

### Automatic Detection Rules

Variables are classified by examining their unique values and patterns:

- **Continuous**: Numeric with >2 unique values (e.g., age, weight, lab values)
- **Binary**: Exactly 2 unique values, treated as binary (e.g., Yes/No, True/False, 0/1)
- **Nominal**: 3+ unique values, categorical without assumed ordering (e.g., blood type, treatment group)
- **Ordinal**: Currently treated as nominal; future enhancement for ordered metadata

## Automatic Encoding

### Binary Variables

Binary variables are encoded as 0/1:
- **Reference category (0)**: Selected by intelligent priority system
- **Comparison category (1)**: The other value

#### Reference Category Selection Priority

1. Known reference values (checked in order):
   - "No" / "False" / "Control" / "Unexposed" / "Placebo"
   - These are the natural control/baseline values in experimental design
2. If no known reference found: **alphabetically first value**

**Example:**
```
Input: Disease = ["Yes", "No", "No", "Yes", "No"]
Auto-detection: Binary with reference = "No"
Encoding: "No" → 0, "Yes" → 1
Output: [1, 0, 0, 1, 0]
```

### Nominal Variables

Nominal variables use **one-hot (dummy) encoding** with the **first category dropped** as reference:

- **Reference category**: Selected using same priority as binary
- **Non-reference categories**: Each gets its own 0/1 column
- **Why drop reference?**: Avoids multicollinearity in regression models

**Example:**
```
Input: Group = ["A", "B", "C", "A", "B", "C"]
Auto-detection: Nominal with 3 categories, reference = "A"
Encoding: Drop "A", create columns for "B" and "C"
Output:
  Group_B: [0, 1, 0, 0, 1, 0]
  Group_C: [0, 0, 1, 0, 0, 1]
```

## Using the Encoding System

### For Analysis Components

When running an analysis, use automatic encoding:

```typescript
import { classifyVariables, autoEncodeDataset } from '@/lib/analysis/engine'

// 1. Inspect the data first (optional UI feedback)
const classifications = classifyVariables(data)

// 2. Auto-encode everything
const { 
  encodedData,           // number[][]
  columnNames,           // string[]
  variableMetadata,      // VariableClassification[]
  encodingMap            // Record<string, EncodedVariable>
} = autoEncodeDataset(data)

// 3. Pass encodedData to analysis functions
// encodedData is ready for regression, tests, etc.
```

### For UI Components

Show users what encoding will be applied:

```typescript
import { inspectDataset, buildEncodingSummary } from '@/lib/analysis/encodingIntegration'

const { classifications, encodingConfig } = inspectDataset(data)
const summaries = buildEncodingSummary(classifications)

// Display to user:
// summaries.map(s => <p>{s}</p>)
```

Example output:
```
- age: continuous (47 values) — kept as-is
- treated: binary (No, Yes) — will encode to 0/1 with reference = "No"
- region: nominal (3 categories: Central, East, West) — will use one-hot encoding 
  with reference = "Central"
```

### For Custom Reference Categories

Allow users to override auto-selected reference categories:

```typescript
import { encodeBinary, encodeNominal } from '@/lib/analysis/engine'

// Override for binary
const customBinary = encodeBinary(data, 'treated', 'Yes')  // Yes becomes reference (0)

// Override for nominal  
const customNominal = encodeNominal(data, 'region', 'East')  // East becomes reference
```

## Integration with Analysis Modules

All analysis modules that handle categorical predictors now have access to the encoding system.

### Before (Manual Encoding)

Researcher had to pre-encode data:
```
Original: treated = ["No", "Yes", "No"]
Researcher manually: treated_encoded = [0, 1, 0]
Upload encoded data → Analysis engine
```

### After (Automatic Encoding)

```
Original: treated = ["No", "Yes", "No"]
Upload raw data → Analysis engine detects binary
Engine auto-encodes: [0, 1, 0]
Analysis runs with encoded data
```

## Reference Category Configurability

The system uses smart defaults but is fully configurable:

```typescript
import { createEncodingConfig } from '@/lib/analysis/engine'

const classifications = classifyVariables(data)

// Get auto-selected reference categories
const autoConfig = createEncodingConfig(classifications)

// Override specific ones
const customConfig = createEncodingConfig(classifications, {
  'treated': 'Yes',           // Override binary reference
  'region': 'South'           // Override nominal reference
})
```

## Output

Researchers see encoded variable names in results:

**If original data has categorical variable "treated":**
- As binary → output shows "treated" with 0/1 interpretation
- Reference category noted in results: *"Reference category: treated = 'No'"*

**If original data has categorical variable "region":**
- As nominal → output shows "region_East", "region_West" (if "Central" is reference)
- Reference category noted in results: *"Reference category: region = 'Central'"*

## Future Enhancements

- **Ordinal variables**: Support metadata hints for ordered categories (e.g., "Low" < "Medium" < "High")
- **Custom encoding schemes**: Allow users to specify non-standard encoding (e.g., contrast coding, helmert)
- **Automatic interaction detection**: Flag when interaction terms should be considered
- **Collinearity warnings**: Alert when categorical encoding creates problematic multicollinearity
