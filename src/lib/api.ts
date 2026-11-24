import {
  MANDATORY_DISCLAIMER_AR,
  MANDATORY_DISCLAIMER_EN,
} from '../core/dppRules.ts';
import { buildQrLabelHtmlSnippet } from '../core/gs1DigitalLink.ts';
import {
  auditBatteryBatchCsv,
  auditBatteryPassport,
  buildTieredJsonLdPassport,
  exportBatchCsv,
} from '../core/passportAuditor.ts';
import {
  buildAnnexXiiiMarkdownReport,
  sealDppDossier,
} from '../core/dossierDigest.ts';
import { DPP_PRESETS } from '../core/presets.ts';
import type {
  AnnexXiiiControlState,
  BatchAuditResult,
  BatteryTechnicalSpec,
  DppDossier,
  DppPreset,
  DynamicTelemetry,
  Locale,
  OperatorProfile,
  SustainabilityMetrics,
  TieredPassportExport,
} from '../core/types.ts';
import { withBase } from './basePath.ts';

export type UiDppDossier = DppDossier & {
  status: 'draft' | 'locked';
  slug: string;
  createdAt?: string;
};

export interface DossierListRecord {
  id: string;
  slug: string;
  dossierCode: string | null;
  status: 'draft' | 'locked';
  category: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  dossier: UiDppDossier;
}

export interface DossierBundle {
  dossier: UiDppDossier;
  status: 'draft' | 'locked';
  slug: string;
  viewCount: number;
  publicReportUrl?: string;
  tieredPassports?: TieredPassportExport;
  qrLabelHtmlEn?: string;
  qrLabelHtmlAr?: string;
  annexXiiiMarkdownEn?: string;
  annexXiiiMarkdownAr?: string;
  qrSvgUrl?: string | null;
}

export interface OperatorProfileRecord {
  id: string;
  name: string;
  profile: OperatorProfile;
  createdAt: string;
  updatedAt: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export type BackendMode = 'server' | 'local';

const LOCAL_STORE_KEY = 'dppkit_local_store_v1';

interface LocalStoreState {
  seqByYear: Record<string, number>;
  dossiers: Array<{ dossier: UiDppDossier; viewCount: number }>;
  profiles: OperatorProfileRecord[];
}

function slugifyLocal(input: string, fallback = 'passport'): string {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function makePresetDossier(preset: DppPreset = DPP_PRESETS[0]): UiDppDossier {
  const now = new Date().toISOString();
  const cloned = structuredClone(preset);
  const summary = auditBatteryPassport({
    presetId: cloned.id,
    operator: cloned.operator,
    battery: cloned.battery,
    sustainability: cloned.sustainability,
    telemetry: cloned.telemetry,
    controls: cloned.controls,
    referenceDateIso: now,
  });
  const suffix = Math.random().toString(36).slice(2, 6);
  const id = `dpp-local-${Date.now().toString(36)}-${suffix}`;
  return {
    id,
    slug: `${slugifyLocal(cloned.battery.modelIdentifier, 'passport')}-${suffix}`,
    status: 'draft',
    createdAt: now,
    dossierCode: '',
    presetId: cloned.id,
    operator: cloned.operator,
    battery: cloned.battery,
    sustainability: cloned.sustainability,
    telemetry: cloned.telemetry,
    controls: cloned.controls,
    summary,
    digestHex: '',
    sealedAtIso: '',
    updatedAtIso: now,
  };
}

function readLocalStore(): LocalStoreState {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalStoreState;
      if (parsed && Array.isArray(parsed.dossiers)) {
        return {
          seqByYear: parsed.seqByYear ?? {},
          dossiers: parsed.dossiers,
          profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
        };
      }
    }
  } catch {
    // ignore corrupted localStorage and recreate
  }

  const seeded = makePresetDossier(DPP_PRESETS[0]);
  const initial: LocalStoreState = {
    seqByYear: {},
    dossiers: [{ dossier: seeded, viewCount: 0 }],
    profiles: [],
  };
  writeLocalStore(initial);
  return initial;
}

function writeLocalStore(state: LocalStoreState): void {
  try {
    window.localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota limits
  }
}

function ensureLocalBundle(entry: { dossier: UiDppDossier; viewCount: number }): DossierBundle {
  const d = entry.dossier;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return {
    dossier: d,
    status: d.status,
    slug: d.slug,
    viewCount: entry.viewCount,
    publicReportUrl: `${origin}${withBase(`/r/${encodeURIComponent(d.dossierCode || d.slug)}`)}`,
  };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError('Unexpected non-JSON server response', res.status);
  }
  if (!res.ok) {
    const errObj = data as { error?: string; code?: string };
    throw new ApiError(errObj?.error || `HTTP ${res.status}`, res.status, errObj?.code);
  }
  return data as T;
}

let cachedMode: BackendMode | null = null;

export async function detectBackendMode(forceRefresh = false): Promise<BackendMode> {
  if (cachedMode && !forceRefresh) {
    return cachedMode;
  }
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 2000);
    const res = await fetch(withBase('/api/health'), { signal: controller.signal });
    window.clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as { ok?: boolean; service?: string };
      if (data?.ok && data.service === 'dppkit') {
        cachedMode = 'server';
        return 'server';
      }
    }
  } catch {
    // fallback to browser local mode
  }
  cachedMode = 'local';
  return 'local';
}

export async function listDossiers(mode: BackendMode): Promise<DossierListRecord[]> {
  if (mode === 'server') {
    const res = await fetchJson<{ dossiers: DossierListRecord[] }>(withBase('/api/dossiers'));
    return res.dossiers;
  }
  const store = readLocalStore();
  return store.dossiers.map(({ dossier, viewCount }) => ({
    id: dossier.id,
    slug: dossier.slug,
    dossierCode: dossier.dossierCode || null,
    status: dossier.status,
    category: dossier.battery.category,
    viewCount,
    createdAt: dossier.createdAt || dossier.updatedAtIso,
    updatedAt: dossier.updatedAtIso,
    dossier,
  }));
}

export async function getDossier(mode: BackendMode, id: string): Promise<DossierBundle> {
  if (mode === 'server') {
    return fetchJson<DossierBundle>(withBase(`/api/dossiers/${encodeURIComponent(id)}`));
  }
  const store = readLocalStore();
  const found = store.dossiers.find(
    (entry) =>
      entry.dossier.id === id ||
      entry.dossier.slug === id ||
      (entry.dossier.dossierCode && entry.dossier.dossierCode === id),
  );
  if (!found) throw new ApiError('Dossier not found', 404);
  return ensureLocalBundle(found);
}

export interface CreateDossierPayload {
  presetId?: string;
  slug?: string;
  operator?: Partial<OperatorProfile>;
  battery?: Partial<BatteryTechnicalSpec>;
  sustainability?: Partial<SustainabilityMetrics>;
  telemetry?: Partial<DynamicTelemetry>;
  controls?: AnnexXiiiControlState[];
}

export async function createDossier(
  mode: BackendMode,
  payload: CreateDossierPayload,
): Promise<DossierBundle> {
  if (mode === 'server') {
    return fetchJson<DossierBundle>(withBase('/api/dossiers'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  const preset = DPP_PRESETS.find((p) => p.id === payload.presetId) || DPP_PRESETS[0];
  const base = makePresetDossier(preset);
  const operator = { ...base.operator, ...(payload.operator ?? {}) };
  const battery = { ...base.battery, ...(payload.battery ?? {}) };
  const sustainability = { ...base.sustainability, ...(payload.sustainability ?? {}) };
  const telemetry = { ...base.telemetry, ...(payload.telemetry ?? {}) };
  const controls = payload.controls ?? base.controls;
  const summary = auditBatteryPassport({
    presetId: preset.id,
    operator,
    battery,
    sustainability,
    telemetry,
    controls,
  });

  const dossier: UiDppDossier = {
    ...base,
    slug: payload.slug ? slugifyLocal(payload.slug) : base.slug,
    operator,
    battery,
    sustainability,
    telemetry,
    controls,
    summary,
  };

  const store = readLocalStore();
  const entry = { dossier, viewCount: 0 };
  store.dossiers.unshift(entry);
  writeLocalStore(store);
  return ensureLocalBundle(entry);
}

export interface UpdateDossierPatch {
  slug?: string;
  operator?: Partial<OperatorProfile>;
  battery?: Partial<BatteryTechnicalSpec>;
  sustainability?: Partial<SustainabilityMetrics>;
  telemetry?: Partial<DynamicTelemetry>;
  controls?: AnnexXiiiControlState[];
}

export async function updateDossier(
  mode: BackendMode,
  id: string,
  patch: UpdateDossierPatch,
): Promise<DossierBundle> {
  if (mode === 'server') {
    return fetchJson<DossierBundle>(withBase(`/api/dossiers/${encodeURIComponent(id)}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  }

  const store = readLocalStore();
  const idx = store.dossiers.findIndex((e) => e.dossier.id === id);
  if (idx < 0) throw new ApiError('Dossier not found', 404);
  const current = store.dossiers[idx].dossier;
  if (current.status === 'locked') {
    throw new ApiError('Finalized passport dossier is locked against edits.', 409, 'DOSSIER_LOCKED');
  }

  const operator = { ...current.operator, ...(patch.operator ?? {}) };
  const battery = { ...current.battery, ...(patch.battery ?? {}) };
  const sustainability = { ...current.sustainability, ...(patch.sustainability ?? {}) };
  const telemetry = { ...current.telemetry, ...(patch.telemetry ?? {}) };
  const controls = patch.controls ?? current.controls;
  const now = new Date().toISOString();
  const summary = auditBatteryPassport({
    presetId: current.presetId,
    operator,
    battery,
    sustainability,
    telemetry,
    controls,
    referenceDateIso: now,
  });

  const next: UiDppDossier = {
    ...current,
    slug: patch.slug ? slugifyLocal(patch.slug) : current.slug,
    operator,
    battery,
    sustainability,
    telemetry,
    controls,
    summary,
    updatedAtIso: now,
  };

  store.dossiers[idx] = { ...store.dossiers[idx], dossier: next };
  writeLocalStore(store);
  return ensureLocalBundle(store.dossiers[idx]);
}

export async function deleteDossier(mode: BackendMode, id: string): Promise<void> {
  if (mode === 'server') {
    await fetchJson<{ deleted: boolean }>(withBase(`/api/dossiers/${encodeURIComponent(id)}`), {
      method: 'DELETE',
    });
    return;
  }

  const store = readLocalStore();
  const target = store.dossiers.find((e) => e.dossier.id === id);
  if (!target) throw new ApiError('Dossier not found', 404);
  if (target.dossier.status === 'locked') {
    throw new ApiError('Locked dossier cannot be deleted.', 409, 'DOSSIER_LOCKED');
  }
  store.dossiers = store.dossiers.filter((e) => e.dossier.id !== id);
  if (store.dossiers.length === 0) {
    store.dossiers.push({ dossier: makePresetDossier(DPP_PRESETS[0]), viewCount: 0 });
  }
  writeLocalStore(store);
}

export async function duplicateDossier(mode: BackendMode, id: string): Promise<DossierBundle> {
  if (mode === 'server') {
    return fetchJson<DossierBundle>(withBase(`/api/dossiers/${encodeURIComponent(id)}/duplicate`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  }

  const store = readLocalStore();
  const srcEntry = store.dossiers.find((e) => e.dossier.id === id);
  if (!srcEntry) throw new ApiError('Dossier not found', 404);
  const src = srcEntry.dossier;
  const now = new Date().toISOString();
  const suffix = Math.random().toString(36).slice(2, 6);
  const cloned: UiDppDossier = {
    ...structuredClone(src),
    id: `dpp-local-${Date.now().toString(36)}-${suffix}`,
    slug: `${slugifyLocal(src.slug, 'passport')}-copy-${suffix}`,
    status: 'draft',
    dossierCode: '',
    digestHex: '',
    sealedAtIso: '',
    createdAt: now,
    updatedAtIso: now,
    battery: {
      ...src.battery,
      modelName: `${src.battery.modelName} (Copy)`,
    },
  };
  const newEntry = { dossier: cloned, viewCount: 0 };
  store.dossiers.unshift(newEntry);
  writeLocalStore(store);
  return ensureLocalBundle(newEntry);
}

export async function finalizeDossier(mode: BackendMode, id: string): Promise<DossierBundle> {
  if (mode === 'server') {
    return fetchJson<DossierBundle>(withBase(`/api/dossiers/${encodeURIComponent(id)}/finalize`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  }

  const store = readLocalStore();
  const idx = store.dossiers.findIndex((e) => e.dossier.id === id);
  if (idx < 0) throw new ApiError('Dossier not found', 404);
  const current = store.dossiers[idx].dossier;
  if (current.status === 'locked') {
    throw new ApiError('Dossier is already finalized.', 409, 'ALREADY_LOCKED');
  }

  const now = new Date().toISOString();
  const year = String(new Date().getUTCFullYear());
  const nextSeq = (store.seqByYear[year] ?? 0) + 1;
  store.seqByYear[year] = nextSeq;

  const sealed = await sealDppDossier({
    id: current.id,
    presetId: current.presetId,
    sequenceNumber: nextSeq,
    operator: current.operator,
    battery: current.battery,
    sustainability: current.sustainability,
    telemetry: current.telemetry,
    controls: current.controls,
    sealedAtIso: now,
  });

  const locked: UiDppDossier = {
    ...sealed,
    slug: current.slug,
    status: 'locked',
    createdAt: current.createdAt || now,
  };

  store.dossiers[idx] = { ...store.dossiers[idx], dossier: locked };
  writeLocalStore(store);
  return ensureLocalBundle(store.dossiers[idx]);
}

export async function fetchPublicReport(
  mode: BackendMode,
  slugOrCode: string,
): Promise<DossierBundle> {
  if (mode === 'server') {
    return fetchJson<DossierBundle>(
      withBase(`/api/public/reports/${encodeURIComponent(slugOrCode)}`),
    );
  }

  const store = readLocalStore();
  const idx = store.dossiers.findIndex(
    (e) => e.dossier.slug === slugOrCode || e.dossier.dossierCode === slugOrCode || e.dossier.id === slugOrCode,
  );
  if (idx < 0) throw new ApiError('Battery passport report not found', 404);
  store.dossiers[idx].viewCount += 1;
  writeLocalStore(store);
  return ensureLocalBundle(store.dossiers[idx]);
}

export async function runBatchCsvAudit(
  mode: BackendMode,
  csvText: string,
): Promise<BatchAuditResult & { exportCsv: string }> {
  if (mode === 'server') {
    return fetchJson<BatchAuditResult & { exportCsv: string }>(withBase('/api/batch-csv'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: csvText }),
    });
  }

  const result = auditBatteryBatchCsv(csvText);
  return {
    ...result,
    exportCsv: exportBatchCsv(result.rows),
  };
}

export async function listProfiles(mode: BackendMode): Promise<OperatorProfileRecord[]> {
  if (mode === 'server') {
    const res = await fetchJson<{ profiles: OperatorProfileRecord[] }>(withBase('/api/profiles'));
    return res.profiles;
  }
  return readLocalStore().profiles;
}

export async function saveProfile(
  mode: BackendMode,
  input: { name: string } & OperatorProfile,
): Promise<OperatorProfileRecord> {
  if (mode === 'server') {
    const res = await fetchJson<{ profile: OperatorProfileRecord }>(withBase('/api/profiles'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return res.profile;
  }

  const store = readLocalStore();
  const now = new Date().toISOString();
  const { name, ...profile } = input;
  const rec: OperatorProfileRecord = {
    id: `op-local-${Date.now().toString(36)}`,
    name: name.trim() || profile.manufacturerName || 'EU Operator',
    profile,
    createdAt: now,
    updatedAt: now,
  };
  store.profiles.unshift(rec);
  writeLocalStore(store);
  return rec;
}

export async function deleteProfile(mode: BackendMode, id: string): Promise<void> {
  if (mode === 'server') {
    await fetchJson<{ deleted: boolean }>(withBase(`/api/profiles/${encodeURIComponent(id)}`), {
      method: 'DELETE',
    });
    return;
  }
  const store = readLocalStore();
  store.profiles = store.profiles.filter((p) => p.id !== id);
  writeLocalStore(store);
}

export function triggerBrowserDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function getServerExportUrl(id: string, suffix: string): string {
  return withBase(`/api/dossiers/${encodeURIComponent(id)}/${suffix}`);
}

export function computeClientTieredArtifacts(dossier: UiDppDossier, locale: Locale) {
  const target = { ...dossier, dossierCode: dossier.dossierCode || 'DRAFT' };
  const gs1Uri = dossier.summary.gs1DigitalLinkUri;
  const tiered = buildTieredJsonLdPassport(target, gs1Uri);
  const qrLabelHtml = buildQrLabelHtmlSnippet(target, gs1Uri, locale);
  const markdownReport = buildAnnexXiiiMarkdownReport(target, locale);
  const singleRowCsv = exportBatchCsv([
    {
      rowNumber: 1,
      modelName: dossier.battery.modelName,
      category: dossier.battery.category,
      chemistry: dossier.battery.chemistry,
      ratedCapacityKwh: dossier.battery.ratedCapacityKwh,
      gtin14: dossier.battery.gtin14,
      serialNumber: dossier.battery.serialNumber,
      carbonKgPerKwh: dossier.sustainability.carbonFootprintKgCo2PerKwh,
      passportMandatory: dossier.summary.passportMandatory,
      gtinValid: dossier.summary.gtinValid,
      gs1Uri,
      status: dossier.summary.readinessTier,
      issues: dossier.summary.findings
        .filter((f) => f.severity !== 'pass')
        .map((f) => `${f.articleRef}: ${f.titleEn}`),
    },
  ]);

  const code = dossier.dossierCode || 'DRAFT';
  const disclaimer = locale === 'ar' ? MANDATORY_DISCLAIMER_AR : MANDATORY_DISCLAIMER_EN;
  const summaryText =
    locale === 'ar'
      ? `ملخص جاهزية جواز البطارية الأوروبي — ${code}\nالطراز: ${dossier.battery.modelName} (${dossier.battery.ratedCapacityKwh} kWh)\nالنتيجة: ${dossier.summary.overallScore}/100 | GS1: ${gs1Uri || 'غير صالح'}\n${disclaimer}`
      : `EU Battery Passport Readiness Summary — ${code}\nModel: ${dossier.battery.modelName} (${dossier.battery.ratedCapacityKwh} kWh)\nScore: ${dossier.summary.overallScore}/100 | GS1: ${gs1Uri || 'Invalid'}\n${disclaimer}`;

  return { tiered, qrLabelHtml, markdownReport, singleRowCsv, summaryText };
}
