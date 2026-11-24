import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  Code2,
  Copy,
  Download,
  Lock,
  QrCode,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { AccessTier, Locale } from '../core/types.ts';
import {
  type BackendMode,
  type UiDppDossier,
  computeClientTieredArtifacts,
  getServerExportUrl,
  triggerBrowserDownload,
} from '../lib/api.ts';
import { getCopy } from '../lib/i18n.ts';

interface TiersAndQrPanelProps {
  dossier: UiDppDossier;
  locale: Locale;
  backendMode: BackendMode;
  onNotify: (msg: string) => void;
}

export function TiersAndQrPanel({
  dossier,
  locale,
  backendMode,
  onNotify,
}: TiersAndQrPanelProps) {
  const copy = getCopy(locale);
  const [selectedTier, setSelectedTier] = useState<AccessTier>('public');
  const [qrSvg, setQrSvg] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string>('');

  const gs1Uri = dossier.summary.gs1DigitalLinkUri;
  const artifacts = useMemo(() => computeClientTieredArtifacts(dossier, locale), [dossier, locale]);

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

  const qrDataUri = useMemo(() => {
    if (!qrSvg) return '';
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`;
  }, [qrSvg]);

  const selectedJsonLdText = useMemo(
    () => JSON.stringify(artifacts.tiered[selectedTier], null, 2),
    [artifacts.tiered, selectedTier],
  );

  async function handleCopy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      onNotify(copy.copiedToast);
      window.setTimeout(() => setCopiedKey(''), 1800);
    } catch {
      onNotify(copy.copiedToast);
    }
  }

  function handleDownloadQrSvg() {
    if (!gs1Uri) return;
    if (backendMode === 'server') {
      window.open(getServerExportUrl(dossier.id, 'qr.svg'), '_blank', 'noopener,noreferrer');
      return;
    }
    if (qrSvg) {
      const code = dossier.dossierCode || dossier.slug || dossier.id;
      triggerBrowserDownload(`dppkit-${code}-qr.svg`, qrSvg, 'image/svg+xml;charset=utf-8');
    }
  }

  function handleDownloadJsonLd(tier: AccessTier) {
    if (backendMode === 'server') {
      window.open(
        getServerExportUrl(dossier.id, `passport-${tier}.jsonld`),
        '_blank',
        'noopener,noreferrer',
      );
      return;
    }
    const code = dossier.dossierCode || dossier.slug || dossier.id;
    triggerBrowserDownload(
      `dppkit-${code}-${tier}.jsonld`,
      JSON.stringify(artifacts.tiered[tier], null, 2),
      'application/ld+json;charset=utf-8',
    );
  }

  function handleDownloadHtmlLabel() {
    if (backendMode === 'server') {
      window.open(
        getServerExportUrl(dossier.id, `qr-label.html?locale=${locale}`),
        '_blank',
        'noopener,noreferrer',
      );
      return;
    }
    const code = dossier.dossierCode || dossier.slug || dossier.id;
    triggerBrowserDownload(
      `dppkit-${code}-qr-label-${locale}.html`,
      artifacts.qrLabelHtml,
      'text/html;charset=utf-8',
    );
  }

  const tierTitle =
    selectedTier === 'public'
      ? copy.tierPublicTitle
      : selectedTier === 'pli'
        ? copy.tierPliTitle
        : copy.tierAuthorityTitle;

  return (
    <div className="space-y-6">
      {/* Top Grid: GS1 QR Card & 3-Tier JSON-LD Explorer */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* GS1 QR Code */}
        <section className="dpp-card min-w-0 rounded-2xl p-5 lg:col-span-5">
          <h2 className="dpp-display flex items-center gap-2 text-base font-bold">
            <QrCode className="h-4 w-4 text-[var(--accent-primary)]" />
            {copy.qrHeading}
          </h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{copy.qrSubtitle}</p>

          <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6">
            {qrDataUri ? (
              <img
                src={qrDataUri}
                alt="GS1 Digital Link QR Code"
                data-testid="gs1-qr-image"
                className="h-48 w-48 rounded-xl bg-white p-2 shadow-sm"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-xs text-[var(--accent-crimson)]">
                <ShieldAlert className="h-8 w-8" />
                <p className="max-w-xs font-medium">{copy.qrInvalidNotice}</p>
              </div>
            )}

            <div className="mt-4 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-center">
              <div
                dir="ltr"
                data-testid="gs1-uri-text"
                className="dpp-mono break-all text-xs font-semibold text-[var(--accent-primary)]"
              >
                {gs1Uri || '—'}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                disabled={!gs1Uri}
                onClick={() => handleCopy('uri', gs1Uri)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold hover:border-[var(--accent-primary)] disabled:opacity-45"
              >
                {copiedKey === 'uri' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copy.copyGs1UriBtn}
              </button>
              <button
                type="button"
                disabled={!gs1Uri}
                onClick={handleDownloadQrSvg}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3.5 py-2 text-xs font-semibold text-[var(--accent-primary-fg)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-45"
              >
                <Download className="h-3.5 w-3.5" />
                {copy.downloadQrSvgBtn}
              </button>
            </div>
          </div>
        </section>

        {/* Three-Tier Access Explorer */}
        <section className="dpp-card min-w-0 rounded-2xl p-5 lg:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="dpp-display flex items-center gap-2 text-base font-bold">
                <Lock className="h-4 w-4 text-[var(--accent-teal)]" />
                {copy.tiersHeading}
              </h2>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">{copy.tiersSubtitle}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-emerald-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-emerald)]">
              <ShieldCheck className="h-3.5 w-3.5" />
              {copy.tierIsolationProof}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(['public', 'pli', 'authority'] as const).map((tier) => {
              const active = selectedTier === tier;
              const label =
                tier === 'public'
                  ? copy.tierPublicTitle
                  : tier === 'pli'
                    ? copy.tierPliTitle
                    : copy.tierAuthorityTitle;
              return (
                <button
                  key={tier}
                  type="button"
                  data-testid={`tier-tab-${tier}`}
                  onClick={() => setSelectedTier(tier)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    active
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-primary-fg)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">{tierTitle}</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleCopy('jsonld', selectedJsonLdText)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-semibold hover:border-[var(--accent-primary)]"
              >
                {copiedKey === 'jsonld' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copy.copyJsonLdBtn}
              </button>
              <button
                type="button"
                onClick={() => handleDownloadJsonLd(selectedTier)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-teal)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                <Download className="h-3.5 w-3.5" />
                {copy.downloadJsonLdBtn}
              </button>
            </div>
          </div>

          <pre
            dir="ltr"
            data-testid="tier-jsonld-preview"
            className="dpp-mono mt-3 max-h-96 overflow-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3.5 text-xs leading-relaxed text-[var(--text-primary)]"
          >
            <code>{selectedJsonLdText}</code>
          </pre>
        </section>
      </div>

      {/* XSS-Safe HTML + JSON-LD Snippet */}
      <section className="dpp-card rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="dpp-display flex items-center gap-2 text-base font-bold">
            <Code2 className="h-4 w-4 text-[var(--accent-primary)]" />
            {copy.qrLabelHeading}
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleCopy('html', artifacts.qrLabelHtml)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent-primary)]"
            >
              {copiedKey === 'html' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copy.copyHtmlLabelBtn}
            </button>
            <button
              type="button"
              onClick={handleDownloadHtmlLabel}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-primary-fg)] hover:bg-[var(--accent-primary-hover)]"
            >
              <Download className="h-3.5 w-3.5" />
              {copy.downloadHtmlLabelBtn}
            </button>
          </div>
        </div>
        <pre
          dir="ltr"
          className="dpp-mono mt-3 max-h-72 overflow-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3.5 text-xs leading-relaxed text-[var(--text-primary)]"
        >
          <code>{artifacts.qrLabelHtml}</code>
        </pre>
      </section>
    </div>
  );
}
