import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import {
  ANNEX_XIII_CONTROLS,
  MANDATORY_DISCLAIMER_AR,
  MANDATORY_DISCLAIMER_EN,
  defaultAnnexXiiiControls,
} from '../src/core/dppRules.ts';
import { buildGs1DigitalLink, buildQrLabelHtmlSnippet } from '../src/core/gs1DigitalLink.ts';
import {
  auditBatteryBatchCsv,
  auditBatteryPassport,
  buildTieredJsonLdPassport,
  exportBatchCsv,
} from '../src/core/passportAuditor.ts';
import { buildAnnexXiiiMarkdownReport, buildDossierCanonicalText } from '../src/core/dossierDigest.ts';
import { DPP_PRESETS, SAMPLE_BATCH_CSV } from '../src/core/presets.ts';
import { openDppDatabase, slugify } from './db.mjs';

const __serverDir = path.dirname(fileURLToPath(import.meta.url));
let APP_VERSION = '0.2.0';
try {
  const pkgJson = JSON.parse(
    fs.readFileSync(path.resolve(__serverDir, '../package.json'), 'utf8'),
  );
  if (typeof pkgJson.version === 'string' && pkgJson.version.trim()) {
    APP_VERSION = pkgJson.version.trim();
  }
} catch {
  // fallback version
}

const MAX_JSON_BODY = 5 * 1024 * 1024;
const VALID_CATEGORIES = new Set(['ev', 'lmt', 'industrial_gt_2kwh', 'industrial_lte_2kwh', 'portable']);
const VALID_CHEMISTRIES = new Set(['NMC', 'LFP', 'NCA', 'LTO', 'PbA', 'Other']);
const VALID_CARBON_CLASSES = new Set(['A', 'B', 'C', 'D', 'E', 'unset']);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

const MIME_BY_EXT = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jsonld': 'application/ld+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS,
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

function sendAttachment(res, contentType, filename, content) {
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS,
  });
  res.end(content);
}

function sendSvg(res, statusCode, svg) {
  res.writeHead(statusCode, {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS,
  });
  res.end(svg);
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_JSON_BODY) {
      const err = new Error('JSON payload exceeds 5 MB limit');
      err.statusCode = 413;
      err.code = 'PAYLOAD_TOO_LARGE';
      throw err;
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error('Invalid JSON payload');
    err.statusCode = 400;
    err.code = 'INVALID_JSON';
    throw err;
  }
}

function normalizeBasePath(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let trimmed = raw.trim();
  if (!trimmed || trimmed === '/') return '';
  if (!trimmed.startsWith('/')) trimmed = `/${trimmed}`;
  return trimmed.replace(/\/+$/, '');
}

function resolveBaseUrl(req, normalizedAppOrigin, normalizedBasePath = '') {
  if (normalizedAppOrigin) return normalizedAppOrigin;
  const protoHeader = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const proto = protoHeader || (req.socket?.encrypted ? 'https' : 'http');
  const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '127.0.0.1:4201')
    .split(',')[0]
    .trim();
  return `${proto}://${hostHeader}${normalizedBasePath}`;
}

function pickStr(srcVal, fallbackVal) {
  if (srcVal === undefined || srcVal === null) return String(fallbackVal ?? '').trim();
  return String(srcVal).trim();
}

function pickNumber(srcVal, fallbackVal) {
  if (srcVal === undefined || srcVal === null || srcVal === '') return fallbackVal;
  const n = Number(srcVal);
  return Number.isFinite(n) ? n : fallbackVal;
}

function pickNullableNumber(srcVal, fallbackVal) {
  if (srcVal === undefined) return fallbackVal ?? null;
  if (srcVal === null || srcVal === '') return null;
  const n = Number(srcVal);
  return Number.isFinite(n) ? n : fallbackVal ?? null;
}

function mergeOperator(patch, fallback) {
  const fb = fallback || DPP_PRESETS[0].operator;
  const src = patch && typeof patch === 'object' ? patch : {};
  return {
    manufacturerName: pickStr(src.manufacturerName, fb.manufacturerName),
    euResponsibleOperator: pickStr(src.euResponsibleOperator, fb.euResponsibleOperator),
    operatorEoriOrVat: pickStr(src.operatorEoriOrVat, fb.operatorEoriOrVat),
    manufacturingPlantLocation: pickStr(src.manufacturingPlantLocation, fb.manufacturingPlantLocation),
    manufacturingCountry: pickStr(src.manufacturingCountry, fb.manufacturingCountry),
    gs1Domain: pickStr(src.gs1Domain, fb.gs1Domain),
    contactEmail: pickStr(src.contactEmail, fb.contactEmail),
    declarationOfConformityRef: pickStr(src.declarationOfConformityRef, fb.declarationOfConformityRef),
    dueDiligenceReportUrl: pickStr(src.dueDiligenceReportUrl, fb.dueDiligenceReportUrl),
  };
}

function mergeBattery(patch, fallback) {
  const fb = fallback || DPP_PRESETS[0].battery;
  const src = patch && typeof patch === 'object' ? patch : {};
  const rawCat = String(src.category ?? fb.category).trim();
  const rawChem = String(src.chemistry ?? fb.chemistry).trim();
  return {
    modelName: pickStr(src.modelName, fb.modelName),
    modelIdentifier: pickStr(src.modelIdentifier, fb.modelIdentifier),
    gtin14: pickStr(src.gtin14, fb.gtin14).replace(/[\s-]+/g, ''),
    serialNumber: pickStr(src.serialNumber, fb.serialNumber),
    batchNumber: pickStr(src.batchNumber, fb.batchNumber),
    category: VALID_CATEGORIES.has(rawCat) ? rawCat : fb.category,
    chemistry: VALID_CHEMISTRIES.has(rawChem) ? rawChem : fb.chemistry,
    ratedCapacityKwh: pickNumber(src.ratedCapacityKwh, fb.ratedCapacityKwh),
    nominalVoltageV: pickNumber(src.nominalVoltageV, fb.nominalVoltageV),
    massKg: pickNumber(src.massKg, fb.massKg),
    manufacturingDateIso: pickStr(src.manufacturingDateIso, fb.manufacturingDateIso),
    expectedLifetimeCycles: pickNumber(src.expectedLifetimeCycles, fb.expectedLifetimeCycles),
    dismantlingManualUrl: pickStr(src.dismantlingManualUrl, fb.dismantlingManualUrl),
    sparePartsUrl: pickStr(src.sparePartsUrl, fb.sparePartsUrl),
    safetyAndEolUrl: pickStr(src.safetyAndEolUrl, fb.safetyAndEolUrl),
  };
}

function mergeSustainability(patch, fallback) {
  const fb = fallback || DPP_PRESETS[0].sustainability;
  const src = patch && typeof patch === 'object' ? patch : {};
  const rawClass = String(src.carbonClass ?? fb.carbonClass).trim();
  return {
    carbonFootprintKgCo2PerKwh: pickNullableNumber(
      src.carbonFootprintKgCo2PerKwh,
      fb.carbonFootprintKgCo2PerKwh,
    ),
    carbonClass: VALID_CARBON_CLASSES.has(rawClass) ? rawClass : fb.carbonClass,
    notifiedBodyId: pickStr(src.notifiedBodyId, fb.notifiedBodyId),
    recycledCobaltPct: pickNullableNumber(src.recycledCobaltPct, fb.recycledCobaltPct),
    recycledLeadPct: pickNullableNumber(src.recycledLeadPct, fb.recycledLeadPct),
    recycledLithiumPct: pickNullableNumber(src.recycledLithiumPct, fb.recycledLithiumPct),
    recycledNickelPct: pickNullableNumber(src.recycledNickelPct, fb.recycledNickelPct),
    hazardousSubstancesNote: pickStr(src.hazardousSubstancesNote, fb.hazardousSubstancesNote),
  };
}

function mergeTelemetry(patch, fallback) {
  const fb = fallback || DPP_PRESETS[0].telemetry;
  const src = patch && typeof patch === 'object' ? patch : {};
  return {
    stateOfHealthPct: pickNullableNumber(src.stateOfHealthPct, fb.stateOfHealthPct),
    stateOfCertifiedEnergyPct: pickNullableNumber(
      src.stateOfCertifiedEnergyPct,
      fb.stateOfCertifiedEnergyPct,
    ),
    remainingCapacityKwh: pickNullableNumber(src.remainingCapacityKwh, fb.remainingCapacityKwh),
    fullChargeCyclesCompleted: pickNullableNumber(
      src.fullChargeCyclesCompleted,
      fb.fullChargeCyclesCompleted,
    ),
    negativeEventsCount: pickNullableNumber(src.negativeEventsCount, fb.negativeEventsCount),
    lastUpdatedIso: pickStr(src.lastUpdatedIso, fb.lastUpdatedIso),
  };
}

function mergeControls(patchControls, fallbackControls) {
  const base = Array.isArray(fallbackControls) && fallbackControls.length > 0
    ? fallbackControls
    : defaultAnnexXiiiControls([]);
  const baseMap = new Map(base.map((c) => [c.id, c]));
  const patchMap = new Map(
    Array.isArray(patchControls)
      ? patchControls
          .filter((item) => item && typeof item === 'object' && typeof item.id === 'string')
          .map((item) => [item.id, item])
      : [],
  );

  return ANNEX_XIII_CONTROLS.map((def) => {
    const patchItem = patchMap.get(def.id);
    const fbItem = baseMap.get(def.id);
    if (patchItem) {
      return {
        id: def.id,
        completed: Boolean(patchItem.completed),
        evidenceNote:
          patchItem.evidenceNote !== undefined
            ? String(patchItem.evidenceNote).trim()
            : String(fbItem?.evidenceNote ?? '').trim(),
      };
    }
    return {
      id: def.id,
      completed: Boolean(fbItem?.completed),
      evidenceNote: String(fbItem?.evidenceNote ?? '').trim(),
    };
  });
}

function buildExecutiveSummaryText(dossier, locale = 'en') {
  const code = dossier.dossierCode || 'DRAFT';
  const disclaimer = locale === 'ar' ? MANDATORY_DISCLAIMER_AR : MANDATORY_DISCLAIMER_EN;
  const uri = dossier.summary?.gs1DigitalLinkUri || (locale === 'ar' ? 'غير صالح' : 'Invalid');

  if (locale === 'ar') {
    return [
      `ملخص جاهزية جواز البطارية الأوروبي — ${code}`,
      `الطراز: ${dossier.battery.modelName} (${dossier.battery.category} / ${dossier.battery.chemistry} / ${dossier.battery.ratedCapacityKwh} kWh)`,
      `النتيجة: ${dossier.summary.overallScore}/100 | المستوى: ${dossier.summary.readinessTier}`,
      `الأيام المتبقية لموعد 2027-02-18: ${dossier.summary.daysUntilFeb2027Deadline}`,
      `رابط GS1 Digital Link: ${uri}`,
      disclaimer,
    ].join('\n');
  }

  return [
    `EU Battery Passport Readiness Summary — ${code}`,
    `Model: ${dossier.battery.modelName} (${dossier.battery.category} / ${dossier.battery.chemistry} / ${dossier.battery.ratedCapacityKwh} kWh)`,
    `Score: ${dossier.summary.overallScore}/100 | Tier: ${dossier.summary.readinessTier}`,
    `Days until 2027-02-18 deadline: ${dossier.summary.daysUntilFeb2027Deadline}`,
    `GS1 Digital Link: ${uri}`,
    disclaimer,
  ].join('\n');
}

function dossierToBatchRow(dossier) {
  const d = dossier;
  return {
    rowNumber: 1,
    modelName: d.battery.modelName,
    category: d.battery.category,
    chemistry: d.battery.chemistry,
    ratedCapacityKwh: d.battery.ratedCapacityKwh,
    gtin14: d.battery.gtin14,
    serialNumber: d.battery.serialNumber,
    carbonKgPerKwh: d.sustainability.carbonFootprintKgCo2PerKwh,
    passportMandatory: d.summary.passportMandatory,
    gtinValid: d.summary.gtinValid,
    gs1Uri: d.summary.gs1DigitalLinkUri,
    status: d.summary.readinessTier,
    issues: (d.summary.findings || [])
      .filter((f) => f.severity !== 'pass')
      .map((f) => `${f.articleRef}: ${f.titleEn}`),
  };
}

function serveStaticAsset(res, pathname, resolvedDist, method = 'GET', normalizedBasePath = '') {
  if (!resolvedDist || !fs.existsSync(resolvedDist)) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  let decodedPath = '/';
  try {
    decodedPath = decodeURIComponent(pathname || '/');
  } catch {
    sendJson(res, 400, { error: 'Malformed path' });
    return;
  }

  const cleanRel = decodedPath.replace(/^\/+/, '');
  const candidate = path.resolve(resolvedDist, cleanRel || 'index.html');
  if (candidate !== resolvedDist && !candidate.startsWith(resolvedDist + path.sep)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  let fileToServe = null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    fileToServe = candidate;
  } else {
    const indexFallback = path.join(resolvedDist, 'index.html');
    if (fs.existsSync(indexFallback) && fs.statSync(indexFallback).isFile()) {
      fileToServe = indexFallback;
    }
  }

  if (!fileToServe) {
    sendJson(res, 404, { error: 'Static asset not found' });
    return;
  }

  const ext = path.extname(fileToServe).toLowerCase();
  const contentType = MIME_BY_EXT[ext] || 'application/octet-stream';

  if (ext === '.html' && normalizedBasePath) {
    let html = fs.readFileSync(fileToServe, 'utf8');
    html = html
      .replaceAll('href="/', `href="${normalizedBasePath}/`)
      .replaceAll('src="/', `src="${normalizedBasePath}/`);
    const baseScript = `<script>window.__DPPKIT_BASE__=${JSON.stringify(normalizedBasePath)};</script>`;
    html = html.includes('</head>') ? html.replace('</head>', `${baseScript}</head>`) : `${baseScript}${html}`;
    const bodyBuf = Buffer.from(html, 'utf8');
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': bodyBuf.byteLength,
      'Cache-Control': 'no-cache',
      ...SECURITY_HEADERS,
    });
    if (method === 'HEAD') {
      res.end();
      return;
    }
    res.end(bodyBuf);
    return;
  }

  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    ...SECURITY_HEADERS,
  });
  if (method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(fileToServe).pipe(res);
}

export function createDppKitServer({
  dataDir,
  distDir = '',
  appOrigin = '',
  basePath = '',
  maxMutationsPerMinute = 120,
}) {
  const db = openDppDatabase(dataDir);
  const resolvedDist = distDir ? path.resolve(distDir) : null;
  const normalizedAppOrigin = String(appOrigin || '').replace(/\/+$/, '');
  const normalizedBasePath = normalizeBasePath(basePath);
  const rateBuckets = new Map();

  function checkRateLimit(req, method) {
    if (method !== 'POST' && method !== 'PATCH' && method !== 'DELETE') {
      return true;
    }
    const now = Date.now();
    const ip =
      String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1')
        .split(',')[0]
        .trim() || '127.0.0.1';
    const windowMs = 60_000;
    const prev = rateBuckets.get(ip) || [];
    const recent = prev.filter((ts) => now - ts < windowMs);
    if (recent.length >= maxMutationsPerMinute) {
      rateBuckets.set(ip, recent);
      return false;
    }
    recent.push(now);
    rateBuckets.set(ip, recent);
    return true;
  }

  function buildPublicReportUrl(req, slugOrCode) {
    return `${resolveBaseUrl(req, normalizedAppOrigin, normalizedBasePath)}/r/${encodeURIComponent(slugOrCode)}`;
  }

  function buildQrSvgUrl(req, idOrSlug) {
    return `${resolveBaseUrl(req, normalizedAppOrigin, normalizedBasePath)}/api/dossiers/${encodeURIComponent(idOrSlug)}/qr.svg`;
  }

  function findStoredDossier(id) {
    return db.getDossierById(id) || db.getDossierBySlugOrCode(id);
  }

  async function renderQrSvg(uri) {
    return QRCode.toString(uri, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
    });
  }

  async function handleApiRequest(req, res, method, pathname, searchParams) {
    if (!checkRateLimit(req, method)) {
      return sendJson(res, 429, {
        error: 'Too many write requests; please slow down and try again shortly.',
        code: 'RATE_LIMITED',
      });
    }

    // 1. Health & Presets
    if (method === 'GET' && pathname === '/api/health') {
      const stats = db.getStats();
      return sendJson(res, 200, {
        ok: true,
        service: 'dppkit',
        version: APP_VERSION,
        basePath: normalizedBasePath || '/',
        ...stats,
        timestamp: new Date().toISOString(),
      });
    }

    if (method === 'GET' && pathname === '/api/presets') {
      return sendJson(res, 200, {
        presets: DPP_PRESETS,
        sampleBatchCsv: SAMPLE_BATCH_CSV,
        controls: ANNEX_XIII_CONTROLS,
      });
    }

    // 2. Stateless Passport Evaluation, Batch CSV Audit & GS1 QR Preview
    if (method === 'POST' && pathname === '/api/audit-passport') {
      const body = await readJsonBody(req);
      const basePreset =
        DPP_PRESETS.find((p) => p.id === body?.presetId) || DPP_PRESETS[0];
      const refIso =
        typeof body?.referenceDateIso === 'string' && body.referenceDateIso.trim()
          ? body.referenceDateIso.trim()
          : new Date().toISOString();

      const operator = mergeOperator(body?.operator, basePreset.operator);
      const battery = mergeBattery(body?.battery, basePreset.battery);
      const sustainability = mergeSustainability(body?.sustainability, basePreset.sustainability);
      const telemetry = mergeTelemetry(body?.telemetry, basePreset.telemetry);
      const controls = mergeControls(body?.controls, basePreset.controls);

      const gs1 = buildGs1DigitalLink({
        gs1Domain: operator.gs1Domain,
        gtin14: battery.gtin14,
        serialNumber: battery.serialNumber,
        batchNumber: battery.batchNumber,
      });

      const summary = auditBatteryPassport({
        presetId: basePreset.id,
        operator,
        battery,
        sustainability,
        telemetry,
        controls,
        referenceDateIso: refIso,
      });

      const previewDossier = {
        id: 'stateless-preview',
        dossierCode: 'PREVIEW',
        presetId: basePreset.id,
        operator,
        battery,
        sustainability,
        telemetry,
        controls,
        summary,
        digestHex: '',
        sealedAtIso: '',
        updatedAtIso: refIso,
      };

      const tieredPassports = buildTieredJsonLdPassport(
        previewDossier,
        summary.gs1DigitalLinkUri,
      );

      return sendJson(res, 200, {
        summary,
        tieredPassports,
        gs1,
      });
    }

    if (method === 'POST' && pathname === '/api/batch-csv') {
      const body = await readJsonBody(req);
      const csvText = String(body?.csv ?? body?.csvText ?? '');
      if (!csvText.trim()) {
        return sendJson(res, 400, { error: 'CSV payload is required' });
      }
      const result = auditBatteryBatchCsv(csvText);
      const exportCsv = exportBatchCsv(result.rows);
      return sendJson(res, 200, {
        ...result,
        exportCsv,
      });
    }

    if (method === 'POST' && pathname === '/api/qr-preview') {
      const body = await readJsonBody(req);
      const gs1 = buildGs1DigitalLink({
        gs1Domain: String(body?.gs1Domain ?? ''),
        gtin14: String(body?.gtin14 ?? ''),
        serialNumber: String(body?.serialNumber ?? ''),
        batchNumber: body?.batchNumber ? String(body.batchNumber) : undefined,
      });
      if (!gs1.valid) {
        return sendJson(res, 400, {
          valid: false,
          error: gs1.error || 'Invalid GS1 Digital Link parameters',
          gs1,
        });
      }
      const svg = await renderQrSvg(gs1.uri);
      return sendJson(res, 200, {
        valid: true,
        uri: gs1.uri,
        svg,
        gs1,
      });
    }

    // 3. Operator Profiles CRUD
    if (method === 'GET' && pathname === '/api/profiles') {
      return sendJson(res, 200, { profiles: db.listProfiles() });
    }

    if (method === 'POST' && pathname === '/api/profiles') {
      const body = await readJsonBody(req);
      const profile = db.saveProfile(body || {});
      return sendJson(res, 201, { profile });
    }

    const profDeleteMatch = pathname.match(/^\/api\/profiles\/([^/]+)$/);
    if (method === 'DELETE' && profDeleteMatch) {
      const id = decodeURIComponent(profDeleteMatch[1] || '');
      const del = db.deleteProfile(id);
      if (!del.deleted) return sendJson(res, 404, { error: 'Operator profile not found' });
      return sendJson(res, 200, { deleted: true });
    }

    // 4. Dossiers List & Create
    if (method === 'GET' && pathname === '/api/dossiers') {
      return sendJson(res, 200, { dossiers: db.listDossiers() });
    }

    if (method === 'POST' && pathname === '/api/dossiers') {
      const body = await readJsonBody(req);
      const basePreset =
        DPP_PRESETS.find((p) => p.id === body?.presetId) || DPP_PRESETS[0];
      const refIso =
        typeof body?.referenceDateIso === 'string' && body.referenceDateIso.trim()
          ? body.referenceDateIso.trim()
          : new Date().toISOString();
      const actor = String(body?.actor || 'engineering').trim() || 'engineering';

      const operator = mergeOperator(body?.operator, basePreset.operator);
      const battery = mergeBattery(body?.battery, basePreset.battery);
      const sustainability = mergeSustainability(body?.sustainability, basePreset.sustainability);
      const telemetry = mergeTelemetry(body?.telemetry, basePreset.telemetry);
      const controls = mergeControls(body?.controls, basePreset.controls);

      const summary = auditBatteryPassport({
        presetId: basePreset.id,
        operator,
        battery,
        sustainability,
        telemetry,
        controls,
        referenceDateIso: refIso,
      });

      const bundle = db.createDossier(
        {
          presetId: basePreset.id,
          slug: typeof body?.slug === 'string' ? body.slug : undefined,
          operator,
          battery,
          sustainability,
          telemetry,
          controls,
          summary,
          createdAt: refIso,
          updatedAtIso: refIso,
        },
        actor,
      );

      return sendJson(res, 201, {
        ...bundle,
        publicReportUrl: buildPublicReportUrl(req, bundle.dossier.slug),
      });
    }

    // 5. Dossier Actions: Duplicate & Finalize / Lock
    const dupMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/duplicate$/);
    if (method === 'POST' && dupMatch) {
      const id = decodeURIComponent(dupMatch[1] || '');
      const body = await readJsonBody(req);
      const actor = String(body?.actor || 'engineering').trim() || 'engineering';
      const cloned = db.duplicateDossier(id, actor);
      if (!cloned) return sendJson(res, 404, { error: 'Dossier not found' });
      return sendJson(res, 201, {
        ...cloned,
        publicReportUrl: buildPublicReportUrl(req, cloned.dossier.slug),
      });
    }

    const finalizeMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/(finalize|lock)$/);
    if (method === 'POST' && finalizeMatch) {
      const id = decodeURIComponent(finalizeMatch[1] || '');
      const body = await readJsonBody(req);
      const actor = String(body?.actor || 'engineering').trim() || 'engineering';
      const lockedBundle = db.finalizeDossier(id, buildDossierCanonicalText, actor);
      if (!lockedBundle) return sendJson(res, 404, { error: 'Dossier not found' });
      return sendJson(res, 200, {
        ...lockedBundle,
        publicReportUrl: buildPublicReportUrl(
          req,
          lockedBundle.dossier.dossierCode || lockedBundle.dossier.slug,
        ),
      });
    }

    // 6. Per-Dossier QR SVG & Annex XIII Tiered Exports
    const qrMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/qr\.svg$/);
    if (method === 'GET' && qrMatch) {
      const bundle = findStoredDossier(decodeURIComponent(qrMatch[1] || ''));
      if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
      const uri = bundle.dossier.summary?.gs1DigitalLinkUri;
      if (!uri) {
        return sendJson(res, 400, {
          error: 'Valid GS1 Digital Link URI is required before rendering QR SVG.',
          code: 'INVALID_GS1_LINK',
        });
      }
      const svg = await renderQrSvg(uri);
      return sendSvg(res, 200, svg);
    }

    const jsonLdMatch = pathname.match(
      /^\/api\/dossiers\/([^/]+)\/passport-(public|pli|authority)\.jsonld$/,
    );
    if (method === 'GET' && jsonLdMatch) {
      const bundle = findStoredDossier(decodeURIComponent(jsonLdMatch[1] || ''));
      if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
      const tier = jsonLdMatch[2];
      const d = bundle.dossier;
      const tiered = buildTieredJsonLdPassport(d, d.summary?.gs1DigitalLinkUri || '');
      const fname = slugify(d.dossierCode || d.slug || d.id, 'passport');
      return sendAttachment(
        res,
        'application/ld+json; charset=utf-8',
        `dppkit-${fname}-${tier}.jsonld`,
        JSON.stringify(tiered[tier], null, 2),
      );
    }

    const qrHtmlMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/qr-label\.html$/);
    if (method === 'GET' && qrHtmlMatch) {
      const bundle = findStoredDossier(decodeURIComponent(qrHtmlMatch[1] || ''));
      if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
      const locale = searchParams.get('locale') === 'ar' ? 'ar' : 'en';
      const d = bundle.dossier;
      const snippetTarget = {
        ...d,
        dossierCode: d.dossierCode || 'DRAFT',
      };
      const fname = slugify(d.dossierCode || d.slug || d.id, 'passport');
      return sendAttachment(
        res,
        'text/html; charset=utf-8',
        `dppkit-${fname}-qr-label-${locale}.html`,
        buildQrLabelHtmlSnippet(snippetTarget, d.summary?.gs1DigitalLinkUri || '', locale),
      );
    }

    const mdMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/annex-xiii\.md$/);
    if (method === 'GET' && mdMatch) {
      const bundle = findStoredDossier(decodeURIComponent(mdMatch[1] || ''));
      if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
      const locale = searchParams.get('locale') === 'ar' ? 'ar' : 'en';
      const d = bundle.dossier;
      const mdTarget = {
        ...d,
        dossierCode: d.dossierCode || 'DRAFT',
      };
      const fname = slugify(d.dossierCode || d.slug || d.id, 'passport');
      return sendAttachment(
        res,
        'text/markdown; charset=utf-8',
        `dppkit-${fname}-annex-xiii-${locale}.md`,
        buildAnnexXiiiMarkdownReport(mdTarget, locale),
      );
    }

    const csvMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/export\.csv$/);
    if (method === 'GET' && csvMatch) {
      const bundle = findStoredDossier(decodeURIComponent(csvMatch[1] || ''));
      if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
      const d = bundle.dossier;
      const fname = slugify(d.dossierCode || d.slug || d.id, 'passport');
      return sendAttachment(
        res,
        'text/csv; charset=utf-8',
        `dppkit-${fname}.csv`,
        exportBatchCsv([dossierToBatchRow(d)]),
      );
    }

    const summaryMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/summary$/);
    if (method === 'GET' && summaryMatch) {
      const bundle = findStoredDossier(decodeURIComponent(summaryMatch[1] || ''));
      if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
      const locale = searchParams.get('locale') === 'ar' ? 'ar' : 'en';
      const d = bundle.dossier;
      return sendJson(res, 200, {
        locale,
        dossierCode: d.dossierCode || null,
        status: bundle.status,
        readinessTier: d.summary.readinessTier,
        overallScore: d.summary.overallScore,
        gs1DigitalLinkUri: d.summary.gs1DigitalLinkUri,
        summaryText: buildExecutiveSummaryText(d, locale),
        disclaimer: locale === 'ar' ? MANDATORY_DISCLAIMER_AR : MANDATORY_DISCLAIMER_EN,
      });
    }

    // 7. Single Dossier Read, Update & Delete
    const dossierMatch = pathname.match(/^\/api\/dossiers\/([^/]+)$/);
    if (dossierMatch) {
      const id = decodeURIComponent(dossierMatch[1] || '');
      if (method === 'GET') {
        const bundle = findStoredDossier(id);
        if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
        return sendJson(res, 200, {
          ...bundle,
          publicReportUrl: buildPublicReportUrl(
            req,
            bundle.dossier.dossierCode || bundle.dossier.slug,
          ),
        });
      }
      if (method === 'PATCH') {
        const patch = await readJsonBody(req);
        const refIso =
          typeof patch?.referenceDateIso === 'string' && patch.referenceDateIso.trim()
            ? patch.referenceDateIso.trim()
            : new Date().toISOString();

        const updated = db.updateDossier(
          id,
          (current) => {
            const operator = patch?.operator
              ? mergeOperator(patch.operator, current.operator)
              : current.operator;
            const battery = patch?.battery
              ? mergeBattery(patch.battery, current.battery)
              : current.battery;
            const sustainability = patch?.sustainability
              ? mergeSustainability(patch.sustainability, current.sustainability)
              : current.sustainability;
            const telemetry = patch?.telemetry
              ? mergeTelemetry(patch.telemetry, current.telemetry)
              : current.telemetry;
            const controls =
              patch?.controls !== undefined
                ? mergeControls(patch.controls, current.controls)
                : current.controls;

            const summary = auditBatteryPassport({
              presetId: current.presetId,
              operator,
              battery,
              sustainability,
              telemetry,
              controls,
              referenceDateIso: refIso,
            });

            return {
              ...current,
              ...(typeof patch?.slug === 'string' && patch.slug.trim() ? { slug: patch.slug.trim() } : {}),
              operator,
              battery,
              sustainability,
              telemetry,
              controls,
              summary,
              updatedAtIso: refIso,
            };
          },
          String(patch?.actor || 'engineering').trim() || 'engineering',
        );

        if (!updated) return sendJson(res, 404, { error: 'Dossier not found' });
        return sendJson(res, 200, {
          ...updated,
          publicReportUrl: buildPublicReportUrl(req, updated.dossier.slug),
        });
      }
      if (method === 'DELETE') {
        const del = db.deleteDossier(id);
        if (!del.deleted) return sendJson(res, 404, { error: 'Dossier not found' });
        return sendJson(res, 200, { deleted: true, id: del.id });
      }
    }

    // 8. Public Shareable Report (/api/public/reports/:slugOrCode)
    const pubMatch = pathname.match(/^\/api\/public\/reports\/([^/]+)$/);
    if (method === 'GET' && pubMatch) {
      const slugOrCode = decodeURIComponent(pubMatch[1] || '');
      const bundle = db.getDossierBySlugOrCode(slugOrCode, { incrementView: true });
      if (!bundle) return sendJson(res, 404, { error: 'Battery passport dossier not found' });
      const d = bundle.dossier;
      const reportTarget = { ...d, dossierCode: d.dossierCode || 'DRAFT' };
      const uri = d.summary?.gs1DigitalLinkUri || '';
      const tieredPassports = buildTieredJsonLdPassport(reportTarget, uri);

      return sendJson(res, 200, {
        ...bundle,
        tieredPassports,
        qrLabelHtmlEn: buildQrLabelHtmlSnippet(reportTarget, uri, 'en'),
        qrLabelHtmlAr: buildQrLabelHtmlSnippet(reportTarget, uri, 'ar'),
        annexXiiiMarkdownEn: buildAnnexXiiiMarkdownReport(reportTarget, 'en'),
        annexXiiiMarkdownAr: buildAnnexXiiiMarkdownReport(reportTarget, 'ar'),
        qrSvgUrl: uri ? buildQrSvgUrl(req, d.dossierCode || d.slug) : null,
        publicReportUrl: buildPublicReportUrl(req, d.dossierCode || d.slug),
      });
    }

    return sendJson(res, 404, { error: 'API endpoint not found' });
  }

  async function handler(req, res) {
    try {
      const parsedUrl = new URL(req.url || '/', 'http://localhost');
      let pathname = parsedUrl.pathname;
      if (
        normalizedBasePath &&
        (pathname === normalizedBasePath || pathname.startsWith(`${normalizedBasePath}/`))
      ) {
        pathname = pathname.slice(normalizedBasePath.length) || '/';
      }
      const method = String(req.method || 'GET').toUpperCase();

      if (pathname.startsWith('/api/')) {
        await handleApiRequest(req, res, method, pathname, parsedUrl.searchParams);
        return;
      }

      if (method !== 'GET' && method !== 'HEAD') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
      }

      serveStaticAsset(res, pathname, resolvedDist, method, normalizedBasePath);
    } catch (err) {
      const statusCode = err?.statusCode || 500;
      const payload = {
        error: err?.message || 'Internal server error',
        ...(err?.code ? { code: err.code } : {}),
      };
      if (!res.headersSent) {
        sendJson(res, statusCode, payload);
      } else {
        res.end();
      }
    }
  }

  return {
    handler,
    close: () => db.close(),
  };
}
