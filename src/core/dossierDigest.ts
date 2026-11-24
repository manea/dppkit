import {
  ANNEX_XIII_CONTROLS,
  MANDATORY_DISCLAIMER_AR,
  MANDATORY_DISCLAIMER_EN,
} from './dppRules.ts';
import { auditBatteryPassport } from './passportAuditor.ts';
import type { DppDossier, Locale } from './types.ts';

export type UnsealedDppDossier = Omit<
  DppDossier,
  'digestHex' | 'sealedAtIso' | 'updatedAtIso'
>;

export function formatDossierCode(sequenceNumber: number, dateIso: string): string {
  const parsed = new Date(dateIso);
  const year = Number.isFinite(parsed.getTime()) ? parsed.getUTCFullYear() : 2026;
  const normalizedSeq = Math.max(1, Math.floor(sequenceNumber));
  return `DPP-${year}-${String(normalizedSeq).padStart(4, '0')}`;
}

export function buildDossierCanonicalText(dossier: UnsealedDppDossier): string {
  const canonicalObject = {
    id: dossier.id,
    dossierCode: dossier.dossierCode,
    presetId: dossier.presetId,
    operator: {
      manufacturerName: dossier.operator.manufacturerName,
      euResponsibleOperator: dossier.operator.euResponsibleOperator,
      operatorEoriOrVat: dossier.operator.operatorEoriOrVat,
      manufacturingPlantLocation: dossier.operator.manufacturingPlantLocation,
      manufacturingCountry: dossier.operator.manufacturingCountry,
      gs1Domain: dossier.operator.gs1Domain,
      contactEmail: dossier.operator.contactEmail,
      declarationOfConformityRef: dossier.operator.declarationOfConformityRef,
      dueDiligenceReportUrl: dossier.operator.dueDiligenceReportUrl,
    },
    battery: {
      modelName: dossier.battery.modelName,
      modelIdentifier: dossier.battery.modelIdentifier,
      gtin14: dossier.battery.gtin14,
      serialNumber: dossier.battery.serialNumber,
      batchNumber: dossier.battery.batchNumber,
      category: dossier.battery.category,
      chemistry: dossier.battery.chemistry,
      ratedCapacityKwh: dossier.battery.ratedCapacityKwh,
      nominalVoltageV: dossier.battery.nominalVoltageV,
      massKg: dossier.battery.massKg,
      manufacturingDateIso: dossier.battery.manufacturingDateIso,
      expectedLifetimeCycles: dossier.battery.expectedLifetimeCycles,
      dismantlingManualUrl: dossier.battery.dismantlingManualUrl,
      sparePartsUrl: dossier.battery.sparePartsUrl,
      safetyAndEolUrl: dossier.battery.safetyAndEolUrl,
    },
    sustainability: {
      carbonFootprintKgCo2PerKwh: dossier.sustainability.carbonFootprintKgCo2PerKwh,
      carbonClass: dossier.sustainability.carbonClass,
      notifiedBodyId: dossier.sustainability.notifiedBodyId,
      recycledCobaltPct: dossier.sustainability.recycledCobaltPct,
      recycledLeadPct: dossier.sustainability.recycledLeadPct,
      recycledLithiumPct: dossier.sustainability.recycledLithiumPct,
      recycledNickelPct: dossier.sustainability.recycledNickelPct,
      hazardousSubstancesNote: dossier.sustainability.hazardousSubstancesNote,
    },
    telemetry: {
      stateOfHealthPct: dossier.telemetry.stateOfHealthPct,
      stateOfCertifiedEnergyPct: dossier.telemetry.stateOfCertifiedEnergyPct,
      remainingCapacityKwh: dossier.telemetry.remainingCapacityKwh,
      fullChargeCyclesCompleted: dossier.telemetry.fullChargeCyclesCompleted,
      negativeEventsCount: dossier.telemetry.negativeEventsCount,
      lastUpdatedIso: dossier.telemetry.lastUpdatedIso,
    },
    controls: [...dossier.controls]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((c) => ({
        id: c.id,
        completed: c.completed,
        evidenceNote: c.evidenceNote ?? '',
      })),
    summary: {
      passportMandatory: dossier.summary.passportMandatory,
      overallScore: dossier.summary.overallScore,
      identificationScore: dossier.summary.identificationScore,
      sustainabilityScore: dossier.summary.sustainabilityScore,
      circularityScore: dossier.summary.circularityScore,
      readinessTier: dossier.summary.readinessTier,
      gs1DigitalLinkUri: dossier.summary.gs1DigitalLinkUri,
      gtinValid: dossier.summary.gtinValid,
    },
  };

  return JSON.stringify(canonicalObject);
}

export async function computeDossierDigestHex(canonicalText: string): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalText);
  const digestBuffer = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digestBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sealDppDossier(
  input: Omit<UnsealedDppDossier, 'dossierCode' | 'summary'> & {
    dossierCode?: string;
    sequenceNumber?: number;
    sealedAtIso?: string;
    referenceDateIso?: string;
  },
): Promise<DppDossier> {
  const sealedAtIso = input.sealedAtIso ?? new Date().toISOString();
  const dossierCode =
    input.dossierCode?.trim() ||
    formatDossierCode(input.sequenceNumber ?? 1, sealedAtIso);

  const summary = auditBatteryPassport({
    presetId: input.presetId,
    operator: input.operator,
    battery: input.battery,
    sustainability: input.sustainability,
    telemetry: input.telemetry,
    controls: input.controls,
    referenceDateIso: input.referenceDateIso ?? sealedAtIso,
  });

  const unsealed: UnsealedDppDossier = {
    id: input.id,
    dossierCode,
    presetId: input.presetId,
    operator: input.operator,
    battery: input.battery,
    sustainability: input.sustainability,
    telemetry: input.telemetry,
    controls: input.controls,
    summary,
  };

  const canonicalText = buildDossierCanonicalText(unsealed);
  const digestHex = await computeDossierDigestHex(canonicalText);

  return {
    ...unsealed,
    digestHex,
    sealedAtIso,
    updatedAtIso: sealedAtIso,
  };
}

export async function verifyDppDossierIntegrity(dossier: DppDossier): Promise<boolean> {
  const canonicalText = buildDossierCanonicalText({
    id: dossier.id,
    dossierCode: dossier.dossierCode,
    presetId: dossier.presetId,
    operator: dossier.operator,
    battery: dossier.battery,
    sustainability: dossier.sustainability,
    telemetry: dossier.telemetry,
    controls: dossier.controls,
    summary: dossier.summary,
  });
  const recomputed = await computeDossierDigestHex(canonicalText);
  return recomputed === dossier.digestHex;
}

export function buildAnnexXiiiMarkdownReport(dossier: DppDossier, locale: Locale = 'en'): string {
  const controlDefById = new Map(ANNEX_XIII_CONTROLS.map((c) => [c.id, c]));
  const disclaimer = locale === 'ar' ? MANDATORY_DISCLAIMER_AR : MANDATORY_DISCLAIMER_EN;

  if (locale === 'ar') {
    const recycledRows = dossier.summary.recycledResults
      .map(
        (r) =>
          `| ${r.metal} | ${r.applicable ? 'نعم' : 'غير منطبق'} | ${r.declaredPct ?? '—'}% | ${r.target2031Pct}% (${r.meets2031 ? 'مستوفٍ' : 'نقص'}) | ${r.target2036Pct}% |`,
      )
      .join('\n');

    const controlRows = dossier.controls
      .map((c) => {
        const def = controlDefById.get(c.id);
        return `- [${c.completed ? 'x' : ' '}] **${def?.titleAr ?? c.id}** (\`${def?.articleRef ?? ''}\` · المستوى: \`${def?.tier ?? ''}\`)`;
      })
      .join('\n');

    return `# ملف جاهزية جواز البطارية الأوروبي — \`${dossier.dossierCode}\`

> **إخلاء مسؤولية إلزامي:** ${disclaimer}

- **المصنّع / المشغّل الأوروبي:** ${dossier.operator.manufacturerName} / ${dossier.operator.euResponsibleOperator} (\`${dossier.operator.operatorEoriOrVat}\`)
- **الطراز والفئة والكيمياء:** ${dossier.battery.modelName} (\`${dossier.battery.modelIdentifier}\`) — ${dossier.battery.category} / ${dossier.battery.chemistry} (${dossier.battery.ratedCapacityKwh} kWh)
- **المعرف ورابط GS1 Digital Link:** \`${dossier.battery.gtin14}\` · \`${dossier.summary.gs1DigitalLinkUri || 'غير صالح'}\`
- **الدرجة الكلية ومستوى الجاهزية:** **${dossier.summary.overallScore}/100** (\`${dossier.summary.readinessTier}\`)
- **البصمة الكربونية:** ${dossier.sustainability.carbonFootprintKgCo2PerKwh ?? '—'} kg CO2-eq/kWh (الفئة: \`${dossier.sustainability.carbonClass}\`)
- **بصمة SHA-256 المعيارية:** \`${dossier.digestHex}\`

## نسب المحتوى المعاد تدويره (المادة 8)
| المادة | منطبق على الكيمياء؟ | المعلن | هدف 2031-08-18 | هدف 2036-08-18 |
| :--- | :---: | :---: | :---: | :---: |
${recycledRows}

## ضوابط الملحق XIII الـ 12
${controlRows}
`;
  }

  const recycledRows = dossier.summary.recycledResults
    .map(
      (r) =>
        `| ${r.metal} | ${r.applicable ? 'Yes' : 'N/A'} | ${r.declaredPct ?? '—'}% | ${r.target2031Pct}% (${r.meets2031 ? 'Met' : 'Gap'}) | ${r.target2036Pct}% |`,
    )
    .join('\n');

  const controlRows = dossier.controls
    .map((c) => {
      const def = controlDefById.get(c.id);
      return `- [${c.completed ? 'x' : ' '}] **${def?.titleEn ?? c.id}** (\`${def?.articleRef ?? ''}\` · Tier: \`${def?.tier ?? ''}\`)`;
    })
    .join('\n');

  return `# EU Battery Passport Readiness Dossier — \`${dossier.dossierCode}\`

> **Mandatory Legal Disclaimer:** ${disclaimer}

- **Manufacturer / EU Operator:** ${dossier.operator.manufacturerName} / ${dossier.operator.euResponsibleOperator} (\`${dossier.operator.operatorEoriOrVat}\`)
- **Model, Category & Chemistry:** ${dossier.battery.modelName} (\`${dossier.battery.modelIdentifier}\`) — ${dossier.battery.category} / ${dossier.battery.chemistry} (${dossier.battery.ratedCapacityKwh} kWh)
- **GTIN-14 & GS1 Digital Link:** \`${dossier.battery.gtin14}\` · \`${dossier.summary.gs1DigitalLinkUri || 'Invalid'}\`
- **Overall Score & Tier:** **${dossier.summary.overallScore}/100** (\`${dossier.summary.readinessTier}\`)
- **Lifecycle Carbon Footprint:** ${dossier.sustainability.carbonFootprintKgCo2PerKwh ?? '—'} kg CO2-eq/kWh (Class: \`${dossier.sustainability.carbonClass}\`)
- **Canonical SHA-256 Digest:** \`${dossier.digestHex}\`

## Article 8 Recycled Content Shares
| Active Material | Chemistry Applicable | Declared % | 2031-08-18 Target | 2036-08-18 Target |
| :--- | :---: | :---: | :---: | :---: |
${recycledRows}

## Annex XIII 12-Point Control Checklist
${controlRows}
`;
}
