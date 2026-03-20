"use client"

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Save, FileText } from 'lucide-react'
import { OutputTable } from './OutputTable'
import { OutputFigure } from './OutputFigure'
import { OutputLog } from './OutputLog'
import type { ExecutionResult } from '@/lib/analysisEngine'

interface OutputPanelProps {
  result: ExecutionResult | null
  running: boolean
  onSaveOutput?: (type: 'table' | 'log', index: number) => void
}

export function OutputPanel({ result, running, onSaveOutput }: OutputPanelProps) {
  const [activeTab, setActiveTab] = useState('tables')

  if (running) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <div className="text-center">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Running analysis…</p>
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] text-muted-foreground text-sm">
        Run a script to see output here.
      </div>
    )
  }

  const tableCount = result.tables.length
  const figureCount = result.figures.length

  return (
    <div className="h-full flex flex-col">
      {result.error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 font-mono">
          <strong>Error:</strong> {result.error}
        </div>
      )}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="shrink-0">
          <TabsTrigger value="tables">Tables {tableCount > 0 && `(${tableCount})`}</TabsTrigger>
          <TabsTrigger value="figures">Figures {figureCount > 0 && `(${figureCount})`}</TabsTrigger>
          <TabsTrigger value="log">Log</TabsTrigger>
        </TabsList>

        <TabsContent value="tables" className="flex-1 overflow-auto space-y-4 mt-3">
          {tableCount === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm flex flex-col items-center gap-2">
              <FileText className="h-8 w-8 opacity-30" />
              No tables in output
            </div>
          ) : (
            result.tables.map((t, i) => (
              <div key={i} className="space-y-2">
                <OutputTable headers={t.headers} rows={t.rows} title={t.title} />
                {onSaveOutput && (
                  <Button size="sm" variant="outline" onClick={() => onSaveOutput('table', i)}>
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    Save Table
                  </Button>
                )}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="figures" className="flex-1 overflow-auto space-y-4 mt-3">
          {figureCount === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No figures in output</div>
          ) : (
            result.figures.map((f, i) => (
              <OutputFigure key={i} src={f.dataUrl} title={f.title} />
            ))
          )}
        </TabsContent>

        <TabsContent value="log" className="flex-1 mt-3">
          <OutputLog log={result.log} />
          {result.log && onSaveOutput && (
            <Button size="sm" variant="outline" className="mt-2" onClick={() => onSaveOutput('log', 0)}>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save Log
            </Button>
          )}
        </TabsContent>
      </Tabs>

      {result && !result.error && (
        <p className="text-xs text-muted-foreground mt-2 shrink-0">
          Completed in {result.durationMs}ms
        </p>
      )}
    </div>
  )
}
