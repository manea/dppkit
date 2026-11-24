import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BatteryCharging,
  CalendarClock,
  CheckCircle2,
  CopyPlus,
  ExternalLink,
  FilePlus2,
  Languages,
  Lock,
  Moon,
  QrCode,
  ShieldCheck,
  Stamp,
  Sun,
  Trash2,
} from 'lucide-react';
import {
  MANDATORY_DISCLAIMER_AR,
  MANDATORY_DISCLAIMER_EN,
} from './core/dppRules.ts';
import { auditBatteryPassport } from './core/passportAuditor.ts';
import type {
  BatteryTechnicalSpec,
  DynamicTelemetry,
  Locale,
  OperatorProfile,
  SustainabilityMetrics,
} from './core/types.ts';
import { BatchCsvPanel } from './components/BatchCsvPanel.tsx';
import { DossierPreviewAndPrint } from './components/DossierPreviewAndPrint.tsx';
import { PassportEditorPanel } from './components/PassportEditorPanel.tsx';
import { TiersAndQrPanel } from './components/TiersAndQrPanel.tsx';
import {
  type BackendMode,
  type DossierBundle,
  type DossierListRecord,
  type OperatorProfileRecord,
  type UpdateDossierPatch,
  createDossier,
  deleteDossier,
  deleteProfile,
  detectBackendMode,
  duplicateDossier,
  fetchPublicReport,
  finalizeDossier,
  getDossier,
  listDossiers,
  listProfiles,
  saveProfile,
  updateDossier,
} from './lib/api.ts';
import { stripBase, withBase } from './lib/basePath.ts';
import { getCopy, readinessLabel } from './lib/i18n.ts';

type ThemeName = 'voltaic-ivory' | 'graphite-cell';
type TabId = 'builder' | 'tiers' | 'batch' | 'dossier';

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => {
    try {
      const saved = window.localStorage.getItem('dppkit_locale');
      return saved === 'ar' || saved === 'en' ? saved : 'en';
    } catch {
      return 'en';
    }
  });
  const [theme, setTheme] = useState<ThemeName>(() => {
    try {
      const saved = window.localStorage.getItem('dppkit_theme');
      return saved === 'graphite-cell' || saved === 'voltaic-ivory' ? saved : 'voltaic-ivory';
    } catch {
      return 'voltaic-ivory';
    }
  });
  const [activeTab, setActiveTab] = useState<TabId>('builder');
  const [backendMode, setBackendMode] = useState<BackendMode>('local');
  const [dossiers, setDossiers] = useState<DossierListRecord[]>([]);
  const [activeBundle, setActiveBundle] = useState<DossierBundle | null>(null);
  const [profiles, setProfiles] = useState<OperatorProfileRecord[]>([]);
  const [isPublicView, setIsPublicView] = useState(false);
  const [publicError, setPublicError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState('');

  const pendingPatchRef = useRef<UpdateDossierPatch | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

  const copy = getCopy(locale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem('dppkit_locale', locale);
      window.localStorage.setItem('dppkit_theme', theme);
    } catch {
      // ignore storage availability errors
    }
  }, [locale, theme]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? '' : prev));
    }, 2600);
  }, []);

  const refreshWorkspace = useCallback(
    async (mode: BackendMode, selectId?: string) => {
      let list = await listDossiers(mode);
      if (list.length === 0) {
        const seeded = await createDossier(mode, { presetId: 'ev-nmc-pack' });
        list = await listDossiers(mode);
        setDossiers(list);
        setActiveBundle(seeded);
      } else {
        setDossiers(list);
        const targetId = selectId || list[0].id;
        const bundle = await getDossier(mode, targetId);
        setActiveBundle(bundle);
      }
      const profList = await listProfiles(mode);
      setProfiles(profList);
    },
    [],
  );

  useEffect(() => {
    let active = true;
    async function init() {
      const mode = await detectBackendMode();
      if (!active) return;
      setBackendMode(mode);

      const relPath = stripBase(window.location.pathname);
      const reportMatch = relPath.match(/^\/r\/([^/]+)\/?$/);
      if (reportMatch) {
        const slugOrCode = decodeURIComponent(reportMatch[1] || '');
        setIsPublicView(true);
        try {
          const bundle = await fetchPublicReport(mode, slugOrCode);
          if (active) setActiveBundle(bundle);
        } catch (err) {
          if (active) setPublicError(err instanceof Error ? err.message : 'Report not found');
        }
        return;
      }

      await refreshWorkspace(mode);
    }

    init();
    return () => {
      active = false;
    };
  }, [refreshWorkspace]);

  const flushPendingPatch = useCallback(async () => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const patch = pendingPatchRef.current;
    if (!patch || !activeBundle || activeBundle.status === 'locked') {
      pendingPatchRef.current = null;
      return;
    }
    pendingPatchRef.current = null;
    setIsSaving(true);
    try {
      const updated = await updateDossier(backendMode, activeBundle.dossier.id, patch);
      setActiveBundle(updated);
      const list = await listDossiers(backendMode);
      setDossiers(list);
    } finally {
      setIsSaving(false);
    }
  }, [activeBundle, backendMode]);

  function queueDraftUpdate(patch: {
    operator?: OperatorProfile;
    battery?: BatteryTechnicalSpec;
    sustainability?: SustainabilityMetrics;
    telemetry?: DynamicTelemetry;
  }) {
    if (!activeBundle || activeBundle.status === 'locked') return;

    const current = activeBundle.dossier;
    const nextOperator = patch.operator ?? current.operator;
    const nextBattery = patch.battery ?? current.battery;
    const nextSustainability = patch.sustainability ?? current.sustainability;
    const nextTelemetry = patch.telemetry ?? current.telemetry;

    const nextSummary = auditBatteryPassport({
      presetId: current.presetId,
      operator: nextOperator,
      battery: nextBattery,
      sustainability: nextSustainability,
      telemetry: nextTelemetry,
      controls: current.controls,
    });

    setActiveBundle({
      ...activeBundle,
      dossier: {
        ...current,
        operator: nextOperator,
        battery: nextBattery,
        sustainability: nextSustainability,
        telemetry: nextTelemetry,
        summary: nextSummary,
      },
    });

    pendingPatchRef.current = {
      ...(pendingPatchRef.current ?? {}),
      ...(patch.operator ? { operator: patch.operator } : {}),
      ...(patch.battery ? { battery: patch.battery } : {}),
      ...(patch.sustainability ? { sustainability: patch.sustainability } : {}),
      ...(patch.telemetry ? { telemetry: patch.telemetry } : {}),
    };

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      const toSend = pendingPatchRef.current;
      pendingPatchRef.current = null;
      if (!toSend) return;
      setIsSaving(true);
      updateDossier(backendMode, current.id, toSend)
        .then(async (saved) => {
          setActiveBundle(saved);
          setDossiers(await listDossiers(backendMode));
        })
        .finally(() => setIsSaving(false));
    }, 220);
  }

  async function handleSelectDossier(id: string) {
    await flushPendingPatch();
    const bundle = await getDossier(backendMode, id);
    setActiveBundle(bundle);
  }

  async function handleNewDraft(presetId = 'ev-nmc-pack') {
    await flushPendingPatch();
    const created = await createDossier(backendMode, { presetId });
    await refreshWorkspace(backendMode, created.dossier.id);
    showToast(copy.savedToast);
  }

  async function handleFinalize() {
    if (!activeBundle || activeBundle.status === 'locked') return;
    await flushPendingPatch();
    const sealed = await finalizeDossier(backendMode, activeBundle.dossier.id);
    setActiveBundle(sealed);
    setDossiers(await listDossiers(backendMode));
    showToast(copy.sealedToast);
  }

  async function handleDuplicate() {
    if (!activeBundle) return;
    await flushPendingPatch();
    const cloned = await duplicateDossier(backendMode, activeBundle.dossier.id);
    setActiveBundle(cloned);
    setDossiers(await listDossiers(backendMode));
    showToast(copy.duplicatedToast);
  }

  async function handleDeleteDraft() {
    if (!activeBundle || activeBundle.status === 'locked') return;
    pendingPatchRef.current = null;
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    await deleteDossier(backendMode, activeBundle.dossier.id);
    await refreshWorkspace(backendMode);
  }

  async function handleToggleControl(controlId: string) {
    if (!activeBundle || activeBundle.status === 'locked') return;
    const nextControls = activeBundle.dossier.controls.map((c) =>
      c.id === controlId ? { ...c, completed: !c.completed } : c,
    );
    await flushPendingPatch();
    setIsSaving(true);
    try {
      const updated = await updateDossier(backendMode, activeBundle.dossier.id, {
        controls: nextControls,
      });
      setActiveBundle(updated);
      setDossiers(await listDossiers(backendMode));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveProfile(name: string, profile: OperatorProfile) {
    await saveProfile(backendMode, { name, ...profile });
    setProfiles(await listProfiles(backendMode));
    showToast(copy.profileSavedToast);
  }

  async function handleDeleteProfile(id: string) {
    await deleteProfile(backendMode, id);
    setProfiles(await listProfiles(backendMode));
  }

  const disclaimer = locale === 'ar' ? MANDATORY_DISCLAIMER_AR : MANDATORY_DISCLAIMER_EN;
  const dossier = activeBundle?.dossier ?? null;
  const isLocked = activeBundle?.status === 'locked';

  const readinessBadgeClass = useMemo(() => {
    if (!dossier) return '';
    switch (dossier.summary.readinessTier) {
      case 'ready':
        return 'bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)]';
      case 'blocked':
        return 'bg-[var(--accent-crimson-soft)] text-[var(--accent-crimson)]';
      case 'needs_work':
        return 'bg-[var(--accent-amber-soft)] text-[var(--accent-amber)]';
      default:
        return 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]';
    }
  }, [dossier]);

  if (isPublicView) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
        <header className="no-print border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-[var(--accent-primary-fg)]">
                <BatteryCharging className="h-5 w-5" />
              </div>
              <div>
                <div className="dpp-display text-sm font-extrabold">{copy.brandTitle}</div>
                <div className="text-[11px] text-[var(--text-secondary)]">{copy.publicShareBanner}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeBundle && (
                <span
                  data-testid="public-view-count"
                  className="rounded-full bg-[var(--bg-elevated)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]"
                >
                  {locale === 'ar' ? `المشاهدات: ${activeBundle.viewCount}` : `Views: ${activeBundle.viewCount}`}
                </span>
              )}
              <button
                type="button"
                data-testid="lang-toggle"
                onClick={() => setLocale((l) => (l === 'en' ? 'ar' : 'en'))}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] px-3 py-1.5 text-xs font-semibold"
              >
                <Languages className="h-3.5 w-3.5" />
                {copy.langToggleLabel}
              </button>
              <a
                href={withBase('/')}
                data-testid="back-to-studio-btn"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-primary-fg)]"
              >
                {copy.backToStudioBtn}
              </a>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          {publicError ? (
            <div className="dpp-card rounded-2xl p-6 text-center text-sm text-[var(--accent-crimson)]">
              {publicError}
            </div>
          ) : dossier ? (
            <DossierPreviewAndPrint
              dossier={dossier}
              locale={locale}
              backendMode={backendMode}
              isLocked={true}
              publicShareUrl={activeBundle?.publicReportUrl}
              onNotify={showToast}
            />
          ) : null}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Top Bar */}
      <header className="no-print z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur sm:sticky sm:top-0">
        <div className="mx-auto flex max-w-7xl flex-col gap-2.5 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:flex-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] shadow-sm">
              <BatteryCharging className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="dpp-display text-base font-extrabold tracking-tight sm:text-lg">
                  {copy.brandTitle}
                </h1>
                <span
                  data-testid="storage-mode-badge"
                  className="whitespace-nowrap rounded-full bg-[var(--accent-teal-soft)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--accent-teal)]"
                >
                  {backendMode === 'server' ? copy.modeServer : copy.modeLocal}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">{copy.brandSubtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1 text-xs font-semibold text-[var(--accent-amber)] md:inline-flex">
              <CalendarClock className="h-3.5 w-3.5" />
              {copy.deadlinePill}
            </span>
            <button
              type="button"
              data-testid="theme-toggle"
              onClick={() =>
                setTheme((t) => (t === 'voltaic-ivory' ? 'graphite-cell' : 'voltaic-ivory'))
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent-primary)]"
            >
              {theme === 'voltaic-ivory' ? (
                <>
                  <Moon className="h-3.5 w-3.5" />
                  {copy.themeLightLabel}
                </>
              ) : (
                <>
                  <Sun className="h-3.5 w-3.5" />
                  {copy.themeDarkLabel}
                </>
              )}
            </button>
            <button
              type="button"
              data-testid="lang-toggle"
              onClick={() => setLocale((l) => (l === 'en' ? 'ar' : 'en'))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent-primary)]"
            >
              <Languages className="h-3.5 w-3.5" />
              {copy.langToggleLabel}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {toast && (
          <div className="no-print fixed bottom-5 end-5 z-40 rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 text-xs font-semibold text-[var(--accent-primary-fg)] shadow-lg">
            {toast}
          </div>
        )}

        {/* Dossier Switcher & Actions Bar */}
        {dossier && (
          <section className="dpp-card no-print min-w-0 rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 w-full flex-wrap items-center gap-2.5 sm:w-auto">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  {copy.savedDossiersLabel}:
                </label>
                <select
                  data-testid="dossier-selector"
                  value={dossier.id}
                  onChange={(e) => handleSelectDossier(e.target.value)}
                  className="dpp-input min-w-0 w-full max-w-full py-1.5 text-xs font-semibold sm:w-auto sm:max-w-xs"
                >
                  {dossiers.map((rec) => (
                    <option key={rec.id} value={rec.id}>
                      {rec.dossierCode ? `[${rec.dossierCode}] ` : ''}
                      {rec.dossier.battery.modelName} ({rec.status === 'locked' ? copy.lockedStatusLabel : copy.draftStatusLabel})
                    </option>
                  ))}
                </select>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${readinessBadgeClass}`}>
                  {readinessLabel(dossier.summary.readinessTier, locale)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="new-draft-btn"
                  onClick={() => handleNewDraft('ev-nmc-pack')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent-primary)]"
                >
                  <FilePlus2 className="h-3.5 w-3.5" />
                  {copy.newDraftBtn}
                </button>
                {!isLocked ? (
                  <>
                    <button
                      type="button"
                      data-testid="finalize-dossier-btn"
                      onClick={handleFinalize}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-emerald)] px-3.5 py-1.5 text-xs font-semibold text-[var(--accent-emerald-fg)] hover:opacity-90"
                    >
                      <Stamp className="h-3.5 w-3.5" />
                      {copy.finalizeSealBtn}
                    </button>
                    {dossiers.length > 1 && (
                      <button
                        type="button"
                        onClick={handleDeleteDraft}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--accent-crimson)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-crimson)] hover:bg-[var(--accent-crimson-soft)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {copy.deleteBtn}
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    data-testid="duplicate-dossier-btn"
                    onClick={handleDuplicate}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3.5 py-1.5 text-xs font-semibold text-[var(--accent-primary-fg)] hover:bg-[var(--accent-primary-hover)]"
                  >
                    <CopyPlus className="h-3.5 w-3.5" />
                    {copy.duplicateBtn}
                  </button>
                )}
                {activeBundle?.publicReportUrl && (
                  <a
                    href={activeBundle.publicReportUrl}
                    data-testid="open-public-brief-btn"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent-primary)]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {copy.openShareBtn}
                  </a>
                )}
              </div>
            </div>

            {isLocked && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--accent-amber)] bg-[var(--accent-amber-soft)] px-3 py-2 text-xs font-medium text-[var(--accent-amber)]">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                <span>{copy.lockedBanner}</span>
              </div>
            )}
          </section>
        )}

        {/* KPI Cards */}
        {dossier && (
          <section className="no-print grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="dpp-card min-w-0 rounded-2xl p-4">
              <div className="text-xs font-semibold text-[var(--text-secondary)]">
                {copy.kpiScoreLabel}
              </div>
              <div
                data-testid="kpi-overall-score"
                className="dpp-display num-tabular mt-1 text-3xl font-extrabold text-[var(--accent-primary)]"
              >
                {dossier.summary.overallScore}%
              </div>
              <div className="mt-1 text-[11px] text-[var(--text-secondary)]">
                {readinessLabel(dossier.summary.readinessTier, locale)}
              </div>
            </div>

            <div className="dpp-card min-w-0 rounded-2xl p-4">
              <div className="text-xs font-semibold text-[var(--text-secondary)]">
                {copy.kpiCountdownLabel}
              </div>
              <div className="dpp-display num-tabular mt-1 text-3xl font-extrabold text-[var(--accent-amber)]">
                {dossier.summary.daysUntilFeb2027Deadline}
              </div>
              <div className="mt-1 text-[11px] text-[var(--text-secondary)]">
                {copy.kpiCountdownSub}
              </div>
            </div>

            <div className="dpp-card min-w-0 rounded-2xl p-4">
              <div className="text-xs font-semibold text-[var(--text-secondary)]">
                {copy.kpiGs1Label}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-lg font-extrabold">
                <QrCode
                  className={`h-5 w-5 shrink-0 ${
                    dossier.summary.gtinValid
                      ? 'text-[var(--accent-emerald)]'
                      : 'text-[var(--accent-crimson)]'
                  }`}
                />
                <span className="num-tabular" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                  {dossier.summary.gtinValid
                    ? locale === 'ar'
                      ? 'سليم MOD-10'
                      : 'VALID MOD-10'
                    : locale === 'ar'
                      ? 'خلل خانة التدقيق'
                      : 'INVALID CHECK DIGIT'}
                </span>
              </div>
              <div dir="ltr" className="dpp-mono mt-1 truncate text-[11px] text-[var(--text-secondary)]">
                {dossier.summary.gs1DigitalLinkUri || dossier.battery.gtin14}
              </div>
            </div>

            <div className="dpp-card min-w-0 rounded-2xl p-4">
              <div className="text-xs font-semibold text-[var(--text-secondary)]">
                {copy.kpiControlsLabel}
              </div>
              <div className="dpp-display num-tabular mt-1 flex items-baseline gap-1 text-3xl font-extrabold text-[var(--accent-teal)]">
                <span>
                  {dossier.summary.completedControlsCount} / {dossier.summary.totalControlsCount}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent-emerald)]" />
                <span>DIN DKE SPEC 99100</span>
              </div>
            </div>
          </section>
        )}

        {/* Navigation Tabs */}
        <nav className="no-print flex flex-wrap gap-2">
          {(
            [
              { id: 'builder', label: copy.tabBuilder },
              { id: 'tiers', label: copy.tabTiers },
              { id: 'batch', label: copy.tabBatch },
              { id: 'dossier', label: copy.tabDossier },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl border px-4 py-2 text-xs font-bold transition sm:text-sm ${
                  active
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] shadow-sm'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Active Panel */}
        {dossier && activeTab === 'builder' && (
          <PassportEditorPanel
            dossier={dossier}
            locale={locale}
            isLocked={isLocked}
            isSaving={isSaving}
            profiles={profiles}
            onLoadPreset={(presetId) => handleNewDraft(presetId)}
            onUpdateFields={queueDraftUpdate}
            onSaveProfile={handleSaveProfile}
            onDeleteProfile={handleDeleteProfile}
          />
        )}

        {dossier && activeTab === 'tiers' && (
          <TiersAndQrPanel
            dossier={dossier}
            locale={locale}
            backendMode={backendMode}
            onNotify={showToast}
          />
        )}

        {activeTab === 'batch' && (
          <BatchCsvPanel locale={locale} backendMode={backendMode} />
        )}

        {dossier && activeTab === 'dossier' && (
          <DossierPreviewAndPrint
            dossier={dossier}
            locale={locale}
            backendMode={backendMode}
            isLocked={isLocked}
            publicShareUrl={activeBundle?.publicReportUrl}
            onToggleControl={handleToggleControl}
            onNotify={showToast}
          />
        )}

        {/* Global Legal Disclaimer Footer */}
        <footer
          data-testid="mandatory-legal-disclaimer"
          className="no-print rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-xs leading-relaxed text-[var(--text-secondary)]"
        >
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
            <span>{disclaimer}</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
