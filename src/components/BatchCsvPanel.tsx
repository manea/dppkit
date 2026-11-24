import { useState, type ChangeEvent } from 'react';
import { Download, FileSpreadsheet, Play, Upload } from 'lucide-react';
import { SAMPLE_BATCH_CSV } from '../core/presets.ts';
import type { BatchAuditResult, Locale } from '../core/types.ts';
import { type BackendMode, runBatchCsvAudit, triggerBrowserDownload } from '../lib/api.ts';
import { categoryLabel, getCopy, readinessLabel } from '../lib/i18n.ts';

interface BatchCsvPanelProps {
  locale: Locale;
  backendMode: BackendMode;
}

export function BatchCsvPanel({ locale, backendMode }: BatchCsvPanelProps) {
  const copy = getCopy(locale);
  const [csvText, setCsvText] = useState(SAMPLE_BATCH_CSV);
  const [result, setResult] = useState<(BatchAuditResult & { exportCsv: string }) | null>(null);
  const [running, setRunning] = useState(false);

  async function handleRunAudit() {
    if (!csvText.trim()) return;
    setRunning(true);
    try {
      const res = await runBatchCsvAudit(backendMode, csvText);
      setResult(res);
    } finally {
      setRunning(false);
    }
  }

  function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCsvText(reader.result);
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  return (
    <div className="space-y-6">
      <section className="dpp-card rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="dpp-display flex items-center gap-2 text-base font-bold">
              <FileSpreadsheet className="h-4 w-4 text-[var(--accent-primary)]" />
              {copy.batchHeading}
            </h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{copy.batchSubtitle}</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold hover:border-[var(--accent-primary)]">
            <Upload className="h-3.5 w-3.5" />
            <span>{copy.uploadCsvLabel}</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>

        <textarea
          dir="ltr"
          rows={7}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          className="dpp-input dpp-mono mt-4 text-xs leading-relaxed"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={running}
            data-testid="run-batch-csv-btn"
            onClick={handleRunAudit}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-semibold text-[var(--accent-primary-fg)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            {copy.runBatchBtn}
          </button>
          {result && (
            <button
              type="button"
              data-testid="download-batch-csv-btn"
              onClick={() =>
                triggerBrowserDownload(
                  'dppkit-batch-audit.csv',
                  result.exportCsv,
                  'text/csv;charset=utf-8',
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-semibold hover:border-[var(--accent-primary)]"
            >
              <Download className="h-3.5 w-3.5" />
              {copy.exportBatchCsvBtn}
            </button>
          )}
        </div>
      </section>

      {result && (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: copy.batchTotal, val: result.totalRows, tone: 'text-[var(--text-primary)]' },
              { label: copy.batchInScope, val: result.inScopeCount, tone: 'text-[var(--accent-primary)]' },
              { label: copy.batchReady, val: result.readyCount, tone: 'text-[var(--accent-emerald)]' },
              { label: copy.batchBlocked, val: result.blockedCount, tone: 'text-[var(--accent-crimson)]' },
              { label: copy.batchExempt, val: result.exemptCount, tone: 'text-[var(--text-secondary)]' },
            ].map((kpi) => (
              <div key={kpi.label} className="dpp-card rounded-2xl p-4">
                <div className="text-xs font-medium text-[var(--text-secondary)]">{kpi.label}</div>
                <div className={`dpp-display num-tabular mt-1 text-2xl font-extrabold ${kpi.tone}`}>
                  {kpi.val}
                </div>
              </div>
            ))}
          </div>

          <div className="dpp-card overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table data-testid="csv-results-table" className="w-full min-w-[680px] border-collapse text-start text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                    <th className="px-4 py-3 text-start font-semibold">{copy.colModel}</th>
                    <th className="px-4 py-3 text-start font-semibold">{copy.colCategory}</th>
                    <th className="px-4 py-3 text-start font-semibold">{copy.colChemistry}</th>
                    <th className="px-4 py-3 text-start font-semibold">{copy.colCapacity}</th>
                    <th className="px-4 py-3 text-start font-semibold">{copy.colGtin}</th>
                    <th className="px-4 py-3 text-start font-semibold">{copy.colStatus}</th>
                    <th className="px-4 py-3 text-start font-semibold">{copy.colIssues}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {result.rows.map((row) => {
                    const badgeClass =
                      row.status === 'ready'
                        ? 'bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)]'
                        : row.status === 'blocked'
                          ? 'bg-[var(--accent-crimson-soft)] text-[var(--accent-crimson)]'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]';
                    return (
                      <tr key={row.rowNumber} className="hover:bg-[var(--bg-elevated)]/60">
                        <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                          <span dir="auto">{row.modelName}</span>
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">
                          {categoryLabel(row.category, locale)}
                        </td>
                        <td className="px-4 py-3 dpp-mono">{row.chemistry}</td>
                        <td className="px-4 py-3 dpp-mono num-tabular" dir="ltr">
                          {row.ratedCapacityKwh}
                        </td>
                        <td className="px-4 py-3 dpp-mono num-tabular" dir="ltr">
                          {row.gtin14}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badgeClass}`}
                          >
                            {readinessLabel(row.status, locale)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">
                          {row.issues.length > 0 ? row.issues.join(' · ') : copy.noIssuesLabel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
