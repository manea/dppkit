import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  CheckSquare,
  Copy,
  Download,
  FileText,
  Printer,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import {
  ANNEX_XIII_CONTROLS,
  MANDATORY_DISCLAIMER_AR,
  MANDATORY_DISCLAIMER_EN,
} from '../core/dppRules.ts';
import type { AnnexXiiiControlState, Locale } from '../core/types.ts';
import {
  type BackendMode,
  type UiDppDossier,
  computeClientTieredArtifacts,
  getServerExportUrl,
  triggerBrowserDownload,
} from '../lib/api.ts';
import { accessTierLabel, categoryLabel, getCopy, metalLabel, readinessLabel } from '../lib/i18n.ts';

interface DossierPreviewAndPrintProps {
  dossier: UiDppDossier;
  locale: Locale;
  backendMode: BackendMode;
  isLocked: boolean;
  publicShareUrl?: string;
  onToggleControl?: (controlId: string) => void;
  onNotify: (msg: string) => void;
}

export function DossierPreviewAndPrint({
  dossier,
  locale,
  backendMode,
  isLocked,
  publicShareUrl,
  onToggleControl,
  onNotify,
}: DossierPreviewAndPrintProps) {
  const copy = getCopy(locale);
  const [qrSvg, setQrSvg] = useState('');
  const artifacts = useMemo(() => computeClientTieredArtifacts(dossier, locale), [dossier, locale]);
  const disclaimer = locale === 'ar' ? MANDATORY_DISCLAIMER_AR : MANDATORY_DISCLAIMER_EN;

  const gs1Uri = dossier.summary.gs1DigitalLinkUri;

  useEffect(() => {
    let cancelled = false;
    if (!gs1Uri) {
      setQrSvg('');
      return;
    }
    QRCode.toString(gs1Uri, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
    })
      .then((svg) => {
        if (!cancelled) setQrSvg(svg);
      })
      .catch(() => {
        if (!cancelled) setQrSvg('');
      });

    return () => {
      cancelled = true;
    };
  }, [gs1Uri]);

  const qrDataUri = useMemo(
    () => (qrSvg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}` : ''),
    [qrSvg],
  );

  const controlsById = useMemo(
    () => new Map<string, AnnexXiiiControlState>(dossier.controls.map((c) => [c.id, c])),
    [dossier.controls],
  );

  function handleDownloadMd() {
    if (backendMode === 'server') {
      window.open(
        getServerExportUrl(dossier.id, `annex-xiii.md?locale=${locale}`),
        '_blank',
        'noopener,noreferrer',
      );
      return;
    }
    const code = dossier.dossierCode || dossier.slug || dossier.id;
    triggerBrowserDownload(
      `dppkit-${code}-annex-xiii-${locale}.md`,
      artifacts.markdownReport,
      'text/markdown;charset=utf-8',
    );
  }

  function handleDownloadCsv() {
    if (backendMode === 'server') {
      window.open(getServerExportUrl(dossier.id, 'export.csv'), '_blank', 'noopener,noreferrer');
      return;
    }
    const code = dossier.dossierCode || dossier.slug || dossier.id;
    triggerBrowserDownload(
      `dppkit-${code}.csv`,
      artifacts.singleRowCsv,
      'text/csv;charset=utf-8',
    );
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } finally {
      onNotify(copy.copiedToast);
    }
  }

  return (
    <div className="space-y-6">
      {/* Interactive 12-Point Controls Checklist (Hidden in Print) */}
      <section className="dpp-card no-print rounded-2xl p-5">
        <div className="mb-4">
          <h2 className="dpp-display flex items-center gap-2 text-base font-bold">
            <CheckSquare className="h-4 w-4 text-[var(--accent-primary)]" />
            {copy.controlsHeading}
          </h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{copy.controlsSubtitle}</p>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {ANNEX_XIII_CONTROLS.map((def) => {
            const state = controlsById.get(def.id);
            const checked = Boolean(state?.completed);
            return (
              <label
                key={def.id}
                data-testid={`control-${def.id}`}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-xs transition ${
                  checked
                    ? 'border-[var(--accent-emerald)] bg-[var(--accent-emerald-soft)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)]'
                } ${isLocked || !onToggleControl ? 'cursor-default opacity-80' : ''}`}
              >
                <input
                  type="checkbox"
                  disabled={isLocked || !onToggleControl}
                  checked={checked}
                  onChange={() => onToggleControl?.(def.id)}
                  className="mt-0.5 h-4 w-4 accent-[var(--accent-primary)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="font-bold text-[var(--text-primary)]">
                      {locale === 'ar' ? def.titleAr : def.titleEn}
                    </span>
                    <span className="rounded-md bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                      {accessTierLabel(def.tier, locale)} · {def.articleRef}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                    {locale === 'ar' ? def.descriptionAr : def.descriptionEn}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </section>

      {/* Export Action Strip (Hidden in Print) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <h2 className="dpp-display flex items-center gap-2 text-base font-bold">
          <FileText className="h-4 w-4 text-[var(--accent-primary)]" />
          {copy.dossierHeading}
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3.5 py-2 text-xs font-semibold text-[var(--accent-primary-fg)] hover:bg-[var(--accent-primary-hover)]"
          >
            <Printer className="h-3.5 w-3.5" />
            {copy.printPdfBtn}
          </button>
          <button
            type="button"
            onClick={handleDownloadMd}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold hover:border-[var(--accent-primary)]"
          >
            <Download className="h-3.5 w-3.5" />
            {copy.downloadMdBtn}
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold hover:border-[var(--accent-primary)]"
          >
            <Download className="h-3.5 w-3.5" />
            {copy.downloadCsvBtn}
          </button>
          <button
            type="button"
            onClick={() => handleCopy(artifacts.summaryText)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold hover:border-[var(--accent-primary)]"
          >
            <Copy className="h-3.5 w-3.5" />
            {copy.copySummaryBtn}
          </button>
          {publicShareUrl && (
            <button
              type="button"
              onClick={() => handleCopy(publicShareUrl)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold hover:border-[var(--accent-primary)]"
            >
              <Share2 className="h-3.5 w-3.5" />
              {copy.copyShareUrlBtn}
            </button>
          )}
        </div>
      </div>

      {/* Formal Printable A4 Sheet */}
      <article className="dpp-card print-avoid-break rounded-2xl p-6 sm:p-8" data-testid="printable-dossier">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-[var(--border-subtle)] pb-6">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                dir="ltr"
                data-testid="dossier-code-badge"
                className="dpp-mono rounded-lg bg-[var(--accent-primary)] px-2.5 py-1 text-xs font-bold text-[var(--accent-primary-fg)]"
              >
                {dossier.dossierCode || 'DRAFT'}
              </span>
              <span className="rounded-full bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)]">
                {readinessLabel(dossier.summary.readinessTier, locale)}
              </span>
            </div>
            <h3 className="dpp-display text-xl font-extrabold text-[var(--text-primary)]" dir="auto">
              {dossier.battery.modelName} ({dossier.battery.modelIdentifier})
            </h3>
            <p className="text-xs text-[var(--text-secondary)]" dir="auto">
              {dossier.operator.manufacturerName} · {dossier.operator.euResponsibleOperator} (
              <span dir="ltr" className="dpp-mono">
                {dossier.operator.operatorEoriOrVat}
              </span>
              )
            </p>
            <div className="pt-1 text-xs text-[var(--text-secondary)]">
              <span>{categoryLabel(dossier.battery.category, locale)}</span>
              {' · '}
              <span className="dpp-mono font-semibold">{dossier.battery.chemistry}</span>
              {' · '}
              <span dir="ltr" className="dpp-mono num-tabular font-semibold">
                {dossier.battery.ratedCapacityKwh} kWh / {dossier.battery.nominalVoltageV} V
              </span>
            </div>
          </div>

          {qrDataUri && (
            <div className="flex flex-col items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-white p-2.5">
              <img src={qrDataUri} alt="GS1 QR" className="h-24 w-24" />
              <span dir="ltr" className="dpp-mono text-[10px] font-semibold text-slate-700">
                {dossier.battery.gtin14}
              </span>
            </div>
          )}
        </header>

        {/* Key Metadata Row */}
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5">
            <div className="text-[11px] font-semibold text-[var(--text-secondary)]">
              {copy.kpiScoreLabel}
            </div>
            <div className="dpp-display num-tabular mt-1 text-2xl font-extrabold text-[var(--accent-primary)]">
              {dossier.summary.overallScore}/100
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5">
            <div className="text-[11px] font-semibold text-[var(--text-secondary)]">
              {copy.carbonFootprint}
            </div>
            <div dir="ltr" className="dpp-mono num-tabular mt-1 text-lg font-bold text-[var(--text-primary)]">
              {dossier.sustainability.carbonFootprintKgCo2PerKwh ?? '—'} ({dossier.sustainability.carbonClass})
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5">
            <div className="text-[11px] font-semibold text-[var(--text-secondary)]">
              {copy.sha256Label}
            </div>
            <div
              dir="ltr"
              data-testid="dossier-sha256-digest"
              className="dpp-mono mt-1 break-all text-[11px] font-semibold text-[var(--text-primary)]"
            >
              {dossier.digestHex || 'PENDING FINALIZE'}
            </div>
          </div>
        </div>

        {/* Article 8 Recycled Content Readiness Table */}
        <div className="mt-6">
          <h4 className="dpp-display mb-3 text-sm font-bold">{copy.recycledTableHeading}</h4>
          <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
            <table className="w-full min-w-[540px] border-collapse text-start text-xs">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                  <th className="px-3.5 py-2.5 text-start font-semibold">{copy.metalCol}</th>
                  <th className="px-3.5 py-2.5 text-start font-semibold">{copy.applicableCol}</th>
                  <th className="px-3.5 py-2.5 text-start font-semibold">{copy.declaredCol}</th>
                  <th className="px-3.5 py-2.5 text-start font-semibold">{copy.target2031Col}</th>
                  <th className="px-3.5 py-2.5 text-start font-semibold">{copy.target2036Col}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {dossier.summary.recycledResults.map((row) => (
                  <tr key={row.metal}>
                    <td className="px-3.5 py-2.5 font-semibold">{metalLabel(row.metal, locale)}</td>
                    <td className="px-3.5 py-2.5">
                      {row.applicable
                        ? locale === 'ar'
                          ? 'نعم'
                          : 'Applicable'
                        : locale === 'ar'
                          ? 'غير منطبق'
                          : 'N/A'}
                    </td>
                    <td dir="ltr" className="px-3.5 py-2.5 dpp-mono num-tabular font-semibold">
                      {row.declaredPct !== null ? `${row.declaredPct}%` : '—'}
                    </td>
                    <td dir="ltr" className="px-3.5 py-2.5 dpp-mono num-tabular">
                      {row.target2031Pct}% {row.applicable ? (row.meets2031 ? '✅' : '⚠️') : ''}
                    </td>
                    <td dir="ltr" className="px-3.5 py-2.5 dpp-mono num-tabular">
                      {row.target2036Pct}% {row.applicable ? (row.meets2036 ? '✅' : '') : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mandatory Legal Disclaimer Banner (visible in Print / Public Share; studio renders shared global footer) */}
        <footer
          className={`mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 text-[11px] leading-relaxed text-[var(--text-secondary)] ${
            onToggleControl ? 'hidden print:block' : ''
          }`}
        >
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
            <span>{disclaimer}</span>
          </div>
        </footer>
      </article>
    </div>
  );
}
