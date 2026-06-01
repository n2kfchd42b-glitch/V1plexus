import type { DataRow, AnalysisResult, ResultTable } from './types'
import { getCategoricalValues, countFrequencies, fmt, chiSqP, cramersV, formatPValue } from './utils'

export interface FrequencyConfig {
  rowVariable: string
  colVariable?: string
  showRowPct: boolean
  showColPct: boolean
  showTotalPct: boolean
}

export function runFrequency(data: DataRow[], config: FrequencyConfig): AnalysisResult {
  const { rowVariable, colVariable } = config

  if (!colVariable) {
    // Simple frequency table
    const vals = getCategoricalValues(data, rowVariable)
    const freq = countFrequencies(vals)
    const total = vals.length
    // Cumulative % must accumulate in the SAME (descending) order the rows are
    // displayed in — accumulating over Map insertion order gave a meaningless
    // running total that didn't match the visible rows.
    let cumulativeCount = 0
    const rows: (string | number | null)[][] = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => {
        cumulativeCount += count
        return [value, count, fmt(count / total * 100, 1) + '%', fmt(cumulativeCount / total * 100, 1) + '%']
      })
    rows.push(['Total', total, '100.0%', '100.0%'])

    const tables: ResultTable[] = [{
      id: 'frequency',
      title: `Frequency Distribution: ${rowVariable}`,
      headers: ['Value', 'Frequency', 'Percent', 'Cumulative %'],
      rows
    }]

    const chartData = [...freq.entries()].map(([value, count]) => ({
      value, count, percent: count / total * 100
    })).sort((a, b) => b.count - a.count)

    return {
      type: 'frequency',
      summary: { n: total, variable: rowVariable, categories: freq.size },
      tables,
      charts: [{ type: 'bar', title: `Frequency: ${rowVariable}`, data: chartData, config: {} }],
      interpretation: `${rowVariable} has ${freq.size} categories across ${total.toLocaleString()} observations. ` +
        `Most common: ${[...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]} (${fmt([...freq.values()].sort((a, b) => b - a)[0] / total * 100, 1)}%).`
    }
  }

  // Cross-tabulation. Build the contingency table row-by-row, keeping only rows
  // where BOTH variables are present — extracting each column separately and
  // pairing by index would misalign the pairs whenever either column has missing
  // values, corrupting the table and the chi-square test.
  const pairs: [string, string][] = []
  const rowCatsSet = new Set<string>()
  const colCatsSet = new Set<string>()
  for (const row of data) {
    const rv = row[rowVariable]
    const cv2 = row[colVariable]
    if (rv === null || rv === undefined || rv === '' || cv2 === null || cv2 === undefined || cv2 === '') continue
    const rs = String(rv)
    const cs = String(cv2)
    rowCatsSet.add(rs)
    colCatsSet.add(cs)
    pairs.push([rs, cs])
  }
  const rowCats = [...rowCatsSet].sort()
  const colCats = [...colCatsSet].sort()

  // Build contingency table
  const table: number[][] = rowCats.map(() => new Array(colCats.length).fill(0))
  for (const [rs, cs] of pairs) {
    table[rowCats.indexOf(rs)][colCats.indexOf(cs)]++
  }

  const rowTotals = table.map(row => row.reduce((a, b) => a + b, 0))
  const colTotals = colCats.map((_, ci) => table.reduce((sum, row) => sum + row[ci], 0))
  const grandTotal = rowTotals.reduce((a, b) => a + b, 0)

  // Chi-square test
  let chiSq = 0
  const expected: number[][] = rowCats.map((_, ri) =>
    colCats.map((_, ci) => rowTotals[ri] * colTotals[ci] / grandTotal)
  )
  for (let ri = 0; ri < rowCats.length; ri++)
    for (let ci = 0; ci < colCats.length; ci++)
      if (expected[ri][ci] > 0)
        chiSq += (table[ri][ci] - expected[ri][ci]) ** 2 / expected[ri][ci]

  const df = (rowCats.length - 1) * (colCats.length - 1)
  const pValue = chiSqP(chiSq, df)
  const cv = cramersV(chiSq, grandTotal, rowCats.length, colCats.length)

  // Format cross-tab table
  const headers = ['', ...colCats, 'Total']
  const tableRows: (string | number | null)[][] = rowCats.map((rCat, ri) => {
    const cells: (string | number | null)[] = [rCat]
    colCats.forEach((_, ci) => {
      const count = table[ri][ci]
      const rowPct = rowTotals[ri] > 0 ? (count / rowTotals[ri] * 100).toFixed(1) : '0.0'
      cells.push(`${count} (${rowPct}%)`)
    })
    cells.push(rowTotals[ri])
    return cells
  })
  const totalRow: (string | number | null)[] = ['Total', ...colTotals.map(t => t), grandTotal]
  tableRows.push(totalRow)

  const tables: ResultTable[] = [
    {
      id: 'crosstab',
      title: `Cross-tabulation: ${rowVariable} × ${colVariable}`,
      headers,
      rows: tableRows,
      footnotes: [
        `χ²(${df}) = ${fmt(chiSq)}, p ${formatPValue(pValue)}, Cramér's V = ${fmt(cv, 3)}`
      ]
    }
  ]

  // Chart data
  const chartData = rowCats.flatMap(rCat => colCats.map(cCat => {
    const ri = rowCats.indexOf(rCat)
    const ci = colCats.indexOf(cCat)
    return { row: rCat, col: cCat, count: table[ri][ci] }
  }))

  return {
    type: 'frequency',
    summary: { n: grandTotal, rows: rowCats.length, cols: colCats.length, chiSq: fmt(chiSq), pValue: formatPValue(pValue), cramersV: fmt(cv, 3) },
    tables,
    charts: [{ type: 'grouped_bar', title: `${rowVariable} by ${colVariable}`, data: chartData, config: { rowCats, colCats } }],
    interpretation: `Chi-square test of association between ${rowVariable} and ${colVariable}: χ²(${df}) = ${fmt(chiSq)}, p ${formatPValue(pValue)}. ` +
      `Cramér's V = ${fmt(cv, 3)}, indicating ${cv < 0.1 ? 'negligible' : cv < 0.3 ? 'small' : cv < 0.5 ? 'moderate' : 'strong'} association.`
  }
}
