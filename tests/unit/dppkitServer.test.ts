import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createDppKitServer } from '../../server/app.mjs';
import { verifyDppDossierIntegrity } from '../../src/core/dossierDigest.ts';
import { SAMPLE_BATCH_CSV } from '../../src/core/presets.ts';
import type { DppDossier } from '../../src/core/types.ts';

interface RunningTestServer {
  baseUrl: string;
  dataDir: string;
  distDir: string;
  stop: () => Promise<void>;
}

const activeServers: RunningTestServer[] = [];

async function startTestServer(
  options: { basePath?: string; withFakeDist?: boolean; maxMutationsPerMinute?: number } = {},
): Promise<RunningTestServer> {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dppkit-test-'));
  const dataDir = path.join(tempRoot, 'data');
  const distDir = options.withFakeDist ? path.join(tempRoot, 'dist') : '';
  if (options.withFakeDist) {
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(
      path.join(distDir, 'index.html'),
      '<!doctype html><html><head><title>DPPKit</title><link rel="stylesheet" href="/assets/app.css"></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>',
      'utf8',
    );
  }

  const { handler, close } = createDppKitServer({
    dataDir,
    distDir,
    basePath: options.basePath ?? '',
    maxMutationsPerMinute: options.maxMutationsPerMinute ?? 120,
  });
  const server = http.createServer(handler);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  const handle: RunningTestServer = {
    baseUrl,
    dataDir,
    distDir,
    stop: async () => {
      close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      fs.rmSync(tempRoot, { recursive: true, force: true });
    },
  };
  activeServers.push(handle);
  return handle;
}

afterEach(async () => {
  while (activeServers.length > 0) {
    const srv = activeServers.pop();
    if (srv) {
      await srv.stop();
    }
  }
});

async function apiJson<T>(
  url: string,
  init?: RequestInit,
): Promise<{ status: number; headers: Headers; data: T }> {
  const res = await fetch(url, init);
  const data = (await res.json()) as T;
  return { status: res.status, headers: res.headers, data };
}

describe('DPPKit Node 22 + SQLite WAL HTTP API integration', () => {
  it('serves /api/health with security headers and /api/presets', async () => {
    const srv = await startTestServer();
    const pkg = JSON.parse(
      fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as { version: string };

    const health = await apiJson<{
      ok: boolean;
      service: string;
      version: string;
      basePath: string;
      totalDossiers: number;
    }>(`${srv.baseUrl}/api/health`);

    expect(health.status).toBe(200);
    expect(health.headers.get('x-content-type-options')).toBe('nosniff');
    expect(health.headers.get('referrer-policy')).toBe('same-origin');
    expect(health.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(health.data.ok).toBe(true);
    expect(health.data.service).toBe('dppkit');
    expect(health.data.version).toBe(pkg.version);
    expect(health.data.basePath).toBe('/');
    expect(health.data.totalDossiers).toBe(0);

    const presets = await apiJson<{ presets: Array<{ id: string }>; controls: unknown[] }>(
      `${srv.baseUrl}/api/presets`,
    );
    expect(presets.status).toBe(200);
    expect(presets.data.presets).toHaveLength(3);
    expect(presets.data.controls).toHaveLength(12);
  });

  it('supports stateless /api/audit-passport, /api/batch-csv, and /api/qr-preview SVG', async () => {
    const srv = await startTestServer();

    const audit = await apiJson<{
      summary: { overallScore: number; readinessTier: string };
      tieredPassports: { public: Record<string, unknown>; pli: Record<string, unknown> };
    }>(`${srv.baseUrl}/api/audit-passport`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId: 'bess-industrial-lfp' }),
    });
    expect(audit.status).toBe(200);
    expect(audit.data.summary.readinessTier).toBe('needs_work');
    expect(audit.data.tieredPassports.public.accessTier).toBe('public');

    const batch = await apiJson<{
      totalRows: number;
      inScopeCount: number;
      blockedCount: number;
      exportCsv: string;
    }>(`${srv.baseUrl}/api/batch-csv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csv: `${SAMPLE_BATCH_CSV}"=CMD()",ev,NMC,60,04012345000115,+SUM(1;2),61,https://id.voltgrid-example.eu\n`,
      }),
    });
    expect(batch.status).toBe(200);
    expect(batch.data.totalRows).toBe(6);
    expect(batch.data.exportCsv.startsWith('\uFEFF')).toBe(true);
    expect(batch.data.exportCsv).toContain('"\'=CMD()"');

    const qrValid = await apiJson<{ valid: boolean; uri: string; svg: string }>(
      `${srv.baseUrl}/api/qr-preview`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gs1Domain: 'id.nordvolt-example.eu',
          gtin14: '04012345000115',
          serialNumber: 'NV2026SE0094812',
        }),
      },
    );
    expect(qrValid.status).toBe(200);
    expect(qrValid.data.valid).toBe(true);
    expect(qrValid.data.uri).toBe('https://id.nordvolt-example.eu/01/04012345000115/21/NV2026SE0094812');
    expect(qrValid.data.svg).toContain('<svg');

    const qrInvalid = await apiJson<{ valid: boolean }>(`${srv.baseUrl}/api/qr-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gs1Domain: 'javascript:alert(1)',
        gtin14: '04012345000115',
        serialNumber: 'SN0001',
      }),
    });
    expect(qrInvalid.status).toBe(400);
    expect(qrInvalid.data.valid).toBe(false);
  });

  it('persists drafts, seals atomic DPP-YYYY-0001 SHA-256, enforces 409 locks, and duplicates cleanly', async () => {
    const srv = await startTestServer();

    const created = await apiJson<{
      dossier: DppDossier;
      status: string;
      slug: string;
    }>(`${srv.baseUrl}/api/dossiers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        presetId: 'ev-nmc-pack',
        actor: 'manea',
      }),
    });
    expect(created.status).toBe(201);
    expect(created.data.status).toBe('draft');
    const id = created.data.dossier.id;

    const patched = await apiJson<{ dossier: DppDossier }>(`${srv.baseUrl}/api/dossiers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sustainability: { carbonFootprintKgCo2PerKwh: 58.9 },
      }),
    });
    expect(patched.status).toBe(200);
    expect(patched.data.dossier.sustainability.carbonFootprintKgCo2PerKwh).toBe(58.9);

    const finalized = await apiJson<{ dossier: DppDossier; status: string }>(
      `${srv.baseUrl}/api/dossiers/${id}/finalize`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: 'qa-lead' }),
      },
    );
    expect(finalized.status).toBe(200);
    expect(finalized.data.status).toBe('locked');
    expect(finalized.data.dossier.dossierCode).toMatch(/^DPP-\d{4}-0001$/);
    expect(await verifyDppDossierIntegrity(finalized.data.dossier)).toBe(true);

    const mutateLocked = await apiJson<{ code: string }>(`${srv.baseUrl}/api/dossiers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ battery: { massKg: 470 } }),
    });
    expect(mutateLocked.status).toBe(409);
    expect(mutateLocked.data.code).toBe('DOSSIER_LOCKED');

    const deleteLocked = await apiJson<{ code: string }>(`${srv.baseUrl}/api/dossiers/${id}`, {
      method: 'DELETE',
    });
    expect(deleteLocked.status).toBe(409);
    expect(deleteLocked.data.code).toBe('DOSSIER_LOCKED');

    const reFinalize = await apiJson<{ code: string }>(
      `${srv.baseUrl}/api/dossiers/${id}/finalize`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    );
    expect(reFinalize.status).toBe(409);
    expect(reFinalize.data.code).toBe('ALREADY_LOCKED');

    const duplicated = await apiJson<{ dossier: DppDossier; status: string }>(
      `${srv.baseUrl}/api/dossiers/${id}/duplicate`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    );
    expect(duplicated.status).toBe(201);
    expect(duplicated.data.status).toBe('draft');
    expect(duplicated.data.dossier.dossierCode).toBe('');

    const deletedDraft = await apiJson<{ deleted: boolean }>(
      `${srv.baseUrl}/api/dossiers/${duplicated.data.dossier.id}`,
      { method: 'DELETE' },
    );
    expect(deletedDraft.status).toBe(200);
    expect(deletedDraft.data.deleted).toBe(true);
  });

  it('serves QR SVG and tiered public / PLI / authority JSON-LD, HTML, MD, CSV, and summary exports', async () => {
    const srv = await startTestServer();

    const evCreated = await apiJson<{ dossier: DppDossier }>(`${srv.baseUrl}/api/dossiers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId: 'ev-nmc-pack' }),
    });
    const evId = evCreated.data.dossier.id;

    await fetch(`${srv.baseUrl}/api/dossiers/${evId}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    const qrRes = await fetch(`${srv.baseUrl}/api/dossiers/${evId}/qr.svg`);
    expect(qrRes.status).toBe(200);
    expect(qrRes.headers.get('content-type')).toContain('image/svg+xml');
    const qrSvgText = await qrRes.text();
    expect(qrSvgText).toContain('<svg');

    const pubText = await (await fetch(`${srv.baseUrl}/api/dossiers/${evId}/passport-public.jsonld`)).text();
    expect(pubText).toContain('"accessTier": "public"');
    expect(pubText).not.toContain('stateOfHealthPct');
    expect(pubText).not.toContain('notifiedBodyId');
    expect(pubText).not.toContain('dueDiligenceReportUrl');

    const pliText = await (await fetch(`${srv.baseUrl}/api/dossiers/${evId}/passport-pli.jsonld`)).text();
    expect(pliText).toContain('stateOfHealthPct');
    expect(pliText).not.toContain('notifiedBodyId');

    const authText = await (await fetch(`${srv.baseUrl}/api/dossiers/${evId}/passport-authority.jsonld`)).text();
    expect(authText).toContain('NB-0123');
    expect(authText).toContain('dueDiligenceReportUrl');

    const htmlAr = await (await fetch(`${srv.baseUrl}/api/dossiers/${evId}/qr-label.html?locale=ar`)).text();
    expect(htmlAr).toContain('dir="rtl"');
    expect(htmlAr).toContain('DPP-');

    const mdEn = await (await fetch(`${srv.baseUrl}/api/dossiers/${evId}/annex-xiii.md?locale=en`)).text();
    expect(mdEn).toContain('# EU Battery Passport Readiness Dossier');

    const csvRes = await fetch(`${srv.baseUrl}/api/dossiers/${evId}/export.csv`);
    const csvBytes = new Uint8Array(await csvRes.arrayBuffer());
    expect(Array.from(csvBytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const csvText = Buffer.from(csvBytes).toString('utf8');
    expect(csvText).toContain('04012345000115');

    const sumRes = await apiJson<{ dossierCode: string; disclaimer: string }>(
      `${srv.baseUrl}/api/dossiers/${evId}/summary?locale=en`,
    );
    expect(sumRes.status).toBe(200);
    expect(sumRes.data.dossierCode).toMatch(/^DPP-\d{4}-0001$/);
    expect(sumRes.data.disclaimer).toContain('NOT legal counsel');

    const blockedCreated = await apiJson<{ dossier: DppDossier }>(`${srv.baseUrl}/api/dossiers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId: 'lmt-ebike-import' }),
    });
    const blockedQr = await fetch(`${srv.baseUrl}/api/dossiers/${blockedCreated.data.dossier.id}/qr.svg`);
    expect(blockedQr.status).toBe(400);
  });

  it('supports operator profiles CRUD and increments viewCount on public report shares', async () => {
    const srv = await startTestServer();

    const saved = await apiJson<{ profile: { id: string; name: string } }>(`${srv.baseUrl}/api/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'NordVolt AB',
        manufacturerName: 'NordVolt AB',
        euResponsibleOperator: 'NordVolt GmbH',
        operatorEoriOrVat: 'DE819204512',
      }),
    });
    expect(saved.status).toBe(201);
    const profId = saved.data.profile.id;

    const listProf = await apiJson<{ profiles: Array<{ id: string }> }>(`${srv.baseUrl}/api/profiles`);
    expect(listProf.status).toBe(200);
    expect(listProf.data.profiles).toHaveLength(1);

    const created = await apiJson<{ dossier: DppDossier }>(`${srv.baseUrl}/api/dossiers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId: 'bess-industrial-lfp', slug: 'gridrack-share' }),
    });
    const pub1 = await apiJson<{ viewCount: number; qrSvgUrl: string }>(
      `${srv.baseUrl}/api/public/reports/gridrack-share`,
    );
    const pub2 = await apiJson<{ viewCount: number }>(
      `${srv.baseUrl}/api/public/reports/gridrack-share`,
    );
    expect(pub1.status).toBe(200);
    expect(pub1.data.viewCount).toBe(1);
    expect(pub2.data.viewCount).toBe(2);
    expect(pub1.data.qrSvgUrl).toContain('/qr.svg');
    expect(created.data.dossier.slug).toBe('gridrack-share');

    const delProf = await apiJson<{ deleted: boolean }>(`${srv.baseUrl}/api/profiles/${profId}`, {
      method: 'DELETE',
    });
    expect(delProf.status).toBe(200);
    expect(delProf.data.deleted).toBe(true);
  });

  it('handles BASE_PATH prefixing, SPA __DPPKIT_BASE__ injection, and rate limits', async () => {
    const srv = await startTestServer({
      basePath: '/dppkit',
      withFakeDist: true,
      maxMutationsPerMinute: 3,
    });

    const health = await apiJson<{ ok: boolean; basePath: string }>(
      `${srv.baseUrl}/dppkit/api/health`,
    );
    expect(health.status).toBe(200);
    expect(health.data.basePath).toBe('/dppkit');

    const spaRes = await fetch(`${srv.baseUrl}/dppkit/r/any-slug`);
    expect(spaRes.status).toBe(200);
    const spaHtml = await spaRes.text();
    expect(spaHtml).toContain('window.__DPPKIT_BASE__="/dppkit"');
    expect(spaHtml).toContain('href="/dppkit/assets/app.css"');
    expect(spaHtml).toContain('src="/dppkit/assets/app.js"');

    for (let i = 0; i < 3; i += 1) {
      const r = await fetch(`${srv.baseUrl}/dppkit/api/audit-passport`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(r.status).toBe(200);
    }

    const limited = await apiJson<{ code: string }>(`${srv.baseUrl}/dppkit/api/audit-passport`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(limited.status).toBe(429);
    expect(limited.data.code).toBe('RATE_LIMITED');
  });
});
