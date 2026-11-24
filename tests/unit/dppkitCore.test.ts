import { describe, expect, it } from 'vitest';
import {
  MANDATORY_DISCLAIMER_AR,
  MANDATORY_DISCLAIMER_EN,
  RECYCLED_CONTENT_TARGETS,
  computeDaysToDeadline,
  evaluateRecycledContentReadiness,
  isPassportMandatory,
} from '../../src/core/dppRules.ts';
import {
  buildGs1DigitalLink,
  buildQrLabelHtmlSnippet,
  computeGtinCheckDigit,
  isValidGtin14,
  parseGs1DigitalLink,
} from '../../src/core/gs1DigitalLink.ts';
import {
  auditBatteryBatchCsv,
  auditBatteryPassport,
  buildTieredJsonLdPassport,
  exportBatchCsv,
} from '../../src/core/passportAuditor.ts';
import {
  buildAnnexXiiiMarkdownReport,
  formatDossierCode,
  sealDppDossier,
  verifyDppDossierIntegrity,
} from '../../src/core/dossierDigest.ts';
import { DPP_PRESETS, SAMPLE_BATCH_CSV } from '../../src/core/presets.ts';

describe('DPPKit Core Domain Engine (EU 2023/1542 & DIN DKE SPEC 99100)', () => {
  it('enforces Article 77 scope rules and computes days to 18 Feb 2027 deadline', () => {
    expect(isPassportMandatory('ev', 45)).toBe(true);
    expect(isPassportMandatory('lmt', 0.5)).toBe(true);
    expect(isPassportMandatory('industrial_gt_2kwh', 2.1)).toBe(true);
    expect(isPassportMandatory('industrial_gt_2kwh', 2.0)).toBe(false);
    expect(isPassportMandatory('industrial_lte_2kwh', 1.8)).toBe(false);
    expect(isPassportMandatory('portable', 0.02)).toBe(false);

    expect(computeDaysToDeadline('2026-11-24T00:00:00Z')).toBe(86);
    expect(computeDaysToDeadline('2027-02-18T00:00:00Z')).toBe(0);
  });

  it('validates GTIN-14 Mod-10 check digits and builds/parses GS1 Digital Link URIs', () => {
    expect(computeGtinCheckDigit('0401234500011')).toBe(5);
    expect(computeGtinCheckDigit('0401234500033')).toBe(7);
    expect(isValidGtin14('04012345000115')).toBe(true);
    expect(isValidGtin14('04012345000229')).toBe(false);

    const built = buildGs1DigitalLink({
      gs1Domain: 'id.nordvolt-example.eu',
      gtin14: '04012345000115',
      serialNumber: 'NV2026SE0094812',
      batchNumber: 'B26W44',
    });
    expect(built.valid).toBe(true);
    expect(built.uri).toBe('https://id.nordvolt-example.eu/01/04012345000115/10/B26W44/21/NV2026SE0094812');

    const parsed = parseGs1DigitalLink(built.uri);
    expect(parsed.valid).toBe(true);
    expect(parsed.gtinValid).toBe(true);
    expect(parsed.gtin14).toBe('04012345000115');
    expect(parsed.batchNumber).toBe('B26W44');
    expect(parsed.serialNumber).toBe('NV2026SE0094812');
  });

  it('rejects insecure javascript:, data:, and non-HTTPS schemes in GS1 Digital Link builder', () => {
    for (const unsafeDomain of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'http://id.insecure-example.eu',
    ]) {
      const res = buildGs1DigitalLink({
        gs1Domain: unsafeDomain,
        gtin14: '04012345000115',
        serialNumber: 'SN0001',
      });
      expect(res.valid).toBe(false);
      expect(res.uri).toBe('');
    }
  });

  it('evaluates Article 8 recycled content thresholds aware of active battery chemistry', () => {
    expect(RECYCLED_CONTENT_TARGETS.cobalt.pct2031).toBe(16);
    expect(RECYCLED_CONTENT_TARGETS.lead.pct2031).toBe(85);
    expect(RECYCLED_CONTENT_TARGETS.lithium.pct2031).toBe(6);
    expect(RECYCLED_CONTENT_TARGETS.nickel.pct2031).toBe(6);

    const lfpResults = evaluateRecycledContentReadiness('LFP', {
      carbonFootprintKgCo2PerKwh: 54.8,
      carbonClass: 'A',
      notifiedBodyId: 'NB-0765',
      recycledCobaltPct: null,
      recycledLeadPct: null,
      recycledLithiumPct: 4.2,
      recycledNickelPct: null,
      hazardousSubstancesNote: 'None',
    });

    const cobalt = lfpResults.find((r) => r.metal === 'cobalt');
    const nickel = lfpResults.find((r) => r.metal === 'nickel');
    const lithium = lfpResults.find((r) => r.metal === 'lithium');

    expect(cobalt?.applicable).toBe(false);
    expect(cobalt?.meets2031).toBe(true);
    expect(nickel?.applicable).toBe(false);
    expect(lithium?.applicable).toBe(true);
    expect(lithium?.meets2031).toBe(false);
  });

  it('audits all three industrial presets into ready, blocked, and needs_work tiers accurately', () => {
    const ev = auditBatteryPassport(DPP_PRESETS[0]);
    expect(ev.passportMandatory).toBe(true);
    expect(ev.gtinValid).toBe(true);
    expect(ev.blockersCount).toBe(0);
    expect(ev.readinessTier).toBe('ready');
    expect(ev.overallScore).toBe(100);

    const lmt = auditBatteryPassport(DPP_PRESETS[1]);
    expect(lmt.passportMandatory).toBe(true);
    expect(lmt.gtinValid).toBe(false);
    expect(lmt.blockersCount).toBeGreaterThanOrEqual(3);
    expect(lmt.readinessTier).toBe('blocked');

    const bess = auditBatteryPassport(DPP_PRESETS[2]);
    expect(bess.passportMandatory).toBe(true);
    expect(bess.gtinValid).toBe(true);
    expect(bess.blockersCount).toBe(0);
    expect(bess.readinessTier).toBe('needs_work');
    expect(bess.findings.some((f) => f.id === 'recycled-below-2031')).toBe(true);
  });

  it('strictly isolates public, PLI, and authority attributes in Tiered JSON-LD exports', async () => {
    const sealed = await sealDppDossier({
      id: 'dpp-test-1',
      sequenceNumber: 1,
      presetId: DPP_PRESETS[0].id,
      operator: DPP_PRESETS[0].operator,
      battery: DPP_PRESETS[0].battery,
      sustainability: DPP_PRESETS[0].sustainability,
      telemetry: DPP_PRESETS[0].telemetry,
      controls: DPP_PRESETS[0].controls,
      sealedAtIso: '2026-11-24T10:00:00Z',
    });

    const tiered = buildTieredJsonLdPassport(sealed, sealed.summary.gs1DigitalLinkUri);
    const pubJson = JSON.stringify(tiered.public);
    const pliJson = JSON.stringify(tiered.pli);
    const authJson = JSON.stringify(tiered.authority);

    expect(pubJson).toContain('"accessTier":"public"');
    expect(pubJson).not.toContain('stateOfHealthPct');
    expect(pubJson).not.toContain('dismantlingManualUrl');
    expect(pubJson).not.toContain('notifiedBodyId');
    expect(pubJson).not.toContain('dueDiligenceReportUrl');

    expect(pliJson).toContain('stateOfHealthPct');
    expect(pliJson).toContain('dismantlingManualUrl');
    expect(pliJson).not.toContain('notifiedBodyId');
    expect(pliJson).not.toContain('dueDiligenceReportUrl');

    expect(authJson).toContain('NB-0123');
    expect(authJson).toContain('dueDiligenceReportUrl');
    expect(authJson).toContain(sealed.digestHex);
  });

  it('escapes HTML & script breakouts in QR Label HTML+JSON-LD snippets and enforces disclaimer', async () => {
    const malicious = structuredClone(DPP_PRESETS[0]);
    malicious.battery.modelName = 'EV Pack </script><img src=x onerror=alert(1)>';
    const sealed = await sealDppDossier({
      id: 'dpp-xss-1',
      sequenceNumber: 2,
      presetId: malicious.id,
      operator: malicious.operator,
      battery: malicious.battery,
      sustainability: malicious.sustainability,
      telemetry: malicious.telemetry,
      controls: malicious.controls,
      sealedAtIso: '2026-11-24T10:05:00Z',
    });

    const htmlEn = buildQrLabelHtmlSnippet(sealed, 'javascript:alert(9)', 'en');
    expect(htmlEn).not.toContain('<img src=x');
    expect(htmlEn).toContain('&lt;img src=x');
    expect(htmlEn).toContain('\\u003c/script>');
    expect(htmlEn).not.toContain('href="javascript:alert(9)"');
    expect(htmlEn).toContain('href="#invalid-gs1-link"');
    expect(htmlEn).toContain(MANDATORY_DISCLAIMER_EN);

    const htmlAr = buildQrLabelHtmlSnippet(sealed, sealed.summary.gs1DigitalLinkUri, 'ar');
    expect(htmlAr).toContain('dir="rtl"');
    expect(htmlAr).toContain(MANDATORY_DISCLAIMER_AR);
  });

  it('parses BOM CSV catalogs and neutralizes spreadsheet formula injection on export', () => {
    const result = auditBatteryBatchCsv(`\uFEFF${SAMPLE_BATCH_CSV}`);
    expect(result.totalRows).toBe(5);
    expect(result.inScopeCount).toBe(3);
    expect(result.readyCount).toBe(2);
    expect(result.blockedCount).toBe(1);
    expect(result.exemptCount).toBe(2);

    const dirtyCsv = `modelName,category,chemistry,ratedCapacityKwh,gtin14,serialNumber,carbonKgPerKwh,gs1Domain
"=CMD('calc')",ev,NMC,50,04012345000115,+SUM(1;2),60,https://id.voltgrid-example.eu`;
    const dirtyAudit = auditBatteryBatchCsv(dirtyCsv);
    const exported = exportBatchCsv(dirtyAudit.rows);

    expect(exported.startsWith('\uFEFF')).toBe(true);
    expect(exported).toContain('"\'=CMD(\'calc\')"');
    expect(exported).toContain('"\'+SUM(1;2)"');
  });

  it('seals DPP-YYYY-0001 with deterministic SHA-256 and detects post-seal tampering', async () => {
    expect(formatDossierCode(7, '2026-11-24T00:00:00Z')).toBe('DPP-2026-0007');

    const sealed = await sealDppDossier({
      id: 'dpp-seal-1',
      sequenceNumber: 12,
      presetId: DPP_PRESETS[2].id,
      operator: DPP_PRESETS[2].operator,
      battery: DPP_PRESETS[2].battery,
      sustainability: DPP_PRESETS[2].sustainability,
      telemetry: DPP_PRESETS[2].telemetry,
      controls: DPP_PRESETS[2].controls,
      sealedAtIso: '2026-11-24T11:00:00Z',
    });

    expect(sealed.dossierCode).toBe('DPP-2026-0012');
    expect(sealed.digestHex).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifyDppDossierIntegrity(sealed)).toBe(true);

    const tampered = structuredClone(sealed);
    tampered.sustainability.recycledLithiumPct = 99;
    expect(await verifyDppDossierIntegrity(tampered)).toBe(false);
  });

  it('generates bilingual EN and AR Annex XIII Markdown readiness reports with disclaimer', async () => {
    const sealed = await sealDppDossier({
      id: 'dpp-md-1',
      sequenceNumber: 3,
      presetId: DPP_PRESETS[0].id,
      operator: DPP_PRESETS[0].operator,
      battery: DPP_PRESETS[0].battery,
      sustainability: DPP_PRESETS[0].sustainability,
      telemetry: DPP_PRESETS[0].telemetry,
      controls: DPP_PRESETS[0].controls,
      sealedAtIso: '2026-11-24T11:15:00Z',
    });

    const mdEn = buildAnnexXiiiMarkdownReport(sealed, 'en');
    const mdAr = buildAnnexXiiiMarkdownReport(sealed, 'ar');

    expect(mdEn).toContain('DPP-2026-0003');
    expect(mdEn).toContain(MANDATORY_DISCLAIMER_EN);
    expect(mdEn).toContain(sealed.digestHex);

    expect(mdAr).toContain('ملف جاهزية جواز البطارية الأوروبي');
    expect(mdAr).toContain(MANDATORY_DISCLAIMER_AR);
    expect(mdAr).toContain('18%'.replace('18', '18.5'));
  });
});
