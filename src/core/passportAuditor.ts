import {
  ANNEX_XIII_CONTROLS,
  BATTERY_PASSPORT_DEADLINE_ISO,
  MANDATORY_DISCLAIMER_EN,
  computeDaysToDeadline,
  evaluateRecycledContentReadiness,
  isPassportMandatory,
} from './dppRules.ts';
import {
  buildGs1DigitalLink,
  isSafeOptionalHttpsUrl,
  isValidGtin14,
} from './gs1DigitalLink.ts';
import type {
  AnnexXiiiControlState,
  BatchAuditResult,
  BatchBatteryRow,
  BatteryCategory,
  BatteryChemistry,
  DppAuditInput,
  DppAuditSummary,
  DppDossier,
  PassportFinding,
  PassportReadinessTier,
  TieredPassportExport,
} from './types.ts';

function mergeControls(controls: AnnexXiiiControlState[]): AnnexXiiiControlState[] {
  const byId = new Map(controls.map((c) => [c.id, c]));
  return ANNEX_XIII_CONTROLS.map((def) => {
    const existing = byId.get(def.id);
    return {
      id: def.id,
      completed: Boolean(existing?.completed),
      evidenceNote: existing?.evidenceNote?.trim() ?? '',
    };
  });
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function auditBatteryPassport(input: DppAuditInput): DppAuditSummary {
  const { operator, battery, sustainability, telemetry } = input;
  const passportMandatory = isPassportMandatory(battery.category, battery.ratedCapacityKwh);
  const daysUntilFeb2027Deadline = computeDaysToDeadline(input.referenceDateIso);
  const gs1 = buildGs1DigitalLink({
    gs1Domain: operator.gs1Domain,
    gtin14: battery.gtin14,
    serialNumber: battery.serialNumber,
    batchNumber: battery.batchNumber,
  });
  const recycledResults = evaluateRecycledContentReadiness(battery.chemistry, sustainability);
  const mergedControls = mergeControls(input.controls);
  const completedControlsCount = mergedControls.filter((c) => c.completed).length;
  const totalControlsCount = mergedControls.length;

  const findings: PassportFinding[] = [];
  let idScore = 100;
  let sustScore = 100;
  let circScore = 100;

  if (!passportMandatory) {
    findings.push({
      id: 'scope-exempt',
      scope: 'scope',
      severity: 'pass',
      articleRef: 'Art. 77 & Art. 13',
      titleEn: 'Exempt from full Annex XIII Digital Battery Passport',
      titleAr: 'مستثناة من جواز البطارية الرقمي الكامل (الملحق XIII)',
      detailEn: `Category "${battery.category}" at ${battery.ratedCapacityKwh} kWh is outside EV, LMT, and Industrial > 2 kWh passport scope (Art. 13 QR label rules still apply from 18 Feb 2027).`,
      detailAr: `الفئة "${battery.category}" بسعة ${battery.ratedCapacityKwh} kWh خارج نطاق الإلزام الكامل (EV / LMT / الصناعية > 2 kWh)، مع بقاء التزامات رمز QR للمادة 13.`,
      remediationEn: 'Keep safety, waste-collection, and declaration of conformity links ready for Article 13 QR label.',
      remediationAr: 'احتفظ بروابط السلامة والفرز وإعلان المطابقة لرمز الاستجابة السريعة وفق المادة 13.',
    });
  } else {
    findings.push({
      id: 'scope-mandatory',
      scope: 'scope',
      severity: 'pass',
      articleRef: 'Art. 77 & Annex XIII',
      titleEn: 'Digital Battery Passport Mandatory (18 Feb 2027)',
      titleAr: 'جواز البطارية الرقمي إلزامي اعتباراً من 18 فبراير 2027',
      detailEn: `Battery "${battery.modelName}" (${battery.category}, ${battery.ratedCapacityKwh} kWh) falls under mandatory EU Battery Passport rules.`,
      detailAr: `البطارية "${battery.modelName}" (${battery.category}، ${battery.ratedCapacityKwh} kWh) تخضع لإلزامية جواز البطارية الأوروبي.`,
      remediationEn: 'Ensure all Public, PLI, and Authority attributes are verified prior to placing units on the EU market.',
      remediationAr: 'تحقق من اكتمال حقول المستويات الثلاثة (العام وذوي المصلحة والسلطات) قبل طرحها في السوق الأوروبية.',
    });
  }

  if (battery.category === 'industrial_gt_2kwh' && battery.ratedCapacityKwh <= 2) {
    idScore -= 10;
    findings.push({
      id: 'scope-capacity-mismatch',
      scope: 'scope',
      severity: 'warning',
      articleRef: 'Art. 77(1)',
      titleEn: 'Industrial category set to > 2 kWh while capacity is <= 2 kWh',
      titleAr: 'الفئة محددة كبطارية صناعية > 2 kWh رغم أن السعة المدخلة <= 2 kWh',
      detailEn: `Rated capacity ${battery.ratedCapacityKwh} kWh does not exceed the 2 kWh threshold; verify category classification.`,
      detailAr: `السعة المدخلة ${battery.ratedCapacityKwh} kWh لا تتجاوز عتبة 2 kWh؛ يُرجى مراجعة تصنيف الفئة.`,
      remediationEn: 'Switch category to industrial_lte_2kwh or verify pack energy rating in kWh.',
      remediationAr: 'عدّل الفئة إلى industrial_lte_2kwh أو راجع السعة المقدرة لحزمة البطاريات.',
    });
  }

  const missingOperator =
    !operator.manufacturerName.trim() ||
    !operator.euResponsibleOperator.trim() ||
    !operator.operatorEoriOrVat.trim();
  if (missingOperator) {
    idScore -= 30;
    findings.push({
      id: 'id-operator-missing',
      scope: 'identification',
      severity: passportMandatory ? 'blocker' : 'warning',
      articleRef: 'Annex VI & Annex XIII(1)',
      titleEn: 'Missing Economic Operator or EU EORI/VAT Identity',
      titleAr: 'نقص بيانات المصنّع أو المشغّل المسؤول في الاتحاد الأوروبي / EORI',
      detailEn: 'Manufacturer name, EU responsible economic operator, and EORI/VAT ID are required for EU market surveillance traceability.',
      detailAr: 'اسم المصنّع والمشغّل المسؤول داخل الاتحاد الأوروبي ومعرف EORI أو الضريبة إلزامية لتتبع مراقبة السوق.',
      remediationEn: 'Provide manufacturer, EU importer/authorized representative, and valid EU EORI/VAT number.',
      remediationAr: 'أدخل بيانات المصنّع والمستورد أو الممثل المفوض ومعرف EORI الأوروبي.',
    });
  }

  if (!gs1.valid) {
    idScore -= 40;
    findings.push({
      id: 'id-gs1-invalid',
      scope: 'identification',
      severity: 'blocker',
      articleRef: 'Art. 13 & ISO/IEC 15459',
      titleEn: 'Invalid GTIN-14, Serial Number, or HTTPS GS1 Digital Link Domain',
      titleAr: 'خلل في رقم GTIN-14 أو الرقم التسلسلي أو نطاق GS1 Digital Link الآمن',
      detailEn: gs1.error ?? 'GS1 Digital Link failed validation.',
      detailAr: `فشل التحقق من رابط GS1 الرقمي: ${gs1.error ?? 'مدخلات غير صالحة.'}`,
      remediationEn: 'Fix the 14-digit GTIN check digit (Mod-10), ISO 15459 serial token, and HTTPS resolver hostname.',
      remediationAr: 'صحح خانة التدقيق الأخيرة في GTIN-14 والرقم التسلسلي ونطاق HTTPS الآمن.',
    });
  }

  if (
    !battery.modelIdentifier.trim() ||
    !operator.declarationOfConformityRef.trim() ||
    !Number.isFinite(battery.ratedCapacityKwh) ||
    battery.ratedCapacityKwh <= 0
  ) {
    idScore -= 25;
    findings.push({
      id: 'id-model-doc-missing',
      scope: 'identification',
      severity: passportMandatory ? 'blocker' : 'warning',
      articleRef: 'Art. 18 & Annex XIII(1)',
      titleEn: 'Missing Model Identifier, Positive kWh Rating, or EU DoC Reference',
      titleAr: 'نقص معرف الطراز أو السعة الموجبة أو مرجع إعلان المطابقة الأوروبي DoC',
      detailEn: 'Every passport requires an exact model identifier, rated energy capacity > 0, and EU Declaration of Conformity reference.',
      detailAr: 'يتطلب الجواز معرف طراز دقيقاً وسعة طاقة موجبة ومرجع إعلان المطابقة الأوروبي.',
      remediationEn: 'Populate modelIdentifier, ratedCapacityKwh (> 0), and declarationOfConformityRef.',
      remediationAr: 'أكمل معرف الطراز والسعة المقدرة ومرجع إعلان المطابقة الأوروبي.',
    });
  }

  if (
    sustainability.carbonFootprintKgCo2PerKwh === null ||
    !Number.isFinite(sustainability.carbonFootprintKgCo2PerKwh) ||
    sustainability.carbonFootprintKgCo2PerKwh <= 0
  ) {
    sustScore -= 35;
    findings.push({
      id: 'carbon-missing',
      scope: 'carbon',
      severity: passportMandatory ? 'blocker' : 'warning',
      articleRef: 'Art. 7 & Annex II',
      titleEn: 'Missing Lifecycle Carbon Footprint Declaration (kg CO2-eq / kWh)',
      titleAr: 'غياب إعلان البصمة الكربونية لدورة الحياة (kg CO2-eq / kWh)',
      detailEn: 'In-scope EV, LMT, and Industrial (> 2 kWh) batteries require a declared lifecycle carbon footprint value.',
      detailAr: 'بطاريات EV وLMT والصناعية (> 2 kWh) تستلزم قيمة موثّقة للبصمة الكربونية لكل kWh.',
      remediationEn: 'Attach verified LCA cradle-to-gate/lifecycle kg CO2-eq/kWh and performance class (A–E).',
      remediationAr: 'أرفق قيمة البصمة الكربونية المعتمدة وفئة الأداء الكربوني (A–E).',
    });
  } else if (
    sustainability.carbonClass === 'unset' ||
    !sustainability.notifiedBodyId.trim()
  ) {
    sustScore -= 15;
    findings.push({
      id: 'carbon-class-or-nb-missing',
      scope: 'carbon',
      severity: 'warning',
      articleRef: 'Art. 7 & Art. 22',
      titleEn: 'Carbon Performance Class or Notified Body ID Pending',
      titleAr: 'فئة الأداء الكربوني أو معرف جهة الإخطار بانتظار الاستكمال',
      detailEn: 'Carbon footprint value is declared, but performance class (A–E) or Authority Notified Body ID is missing.',
      detailAr: 'تم إدخال البصمة الكربونية، لكن فئة الأداء (A–E) أو معرف جهة الإخطار للسلطات غير مكتمل.',
      remediationEn: 'Record performance class A–E and 4-digit Notified Body identifier in the Authority section.',
      remediationAr: 'سجّل فئة الأداء الكربوني ومعرف جهة الإخطار المعتمد في قسم السلطات.',
    });
  }

  const missingApplicableMetals = recycledResults.filter((r) => r.applicable && r.declaredPct === null);
  const below2031Metals = recycledResults.filter((r) => r.applicable && r.declaredPct !== null && !r.meets2031);
  if (missingApplicableMetals.length > 0) {
    sustScore -= 25;
    const names = missingApplicableMetals.map((m) => m.metal).join(', ');
    findings.push({
      id: 'recycled-shares-missing',
      scope: 'recycled',
      severity: 'warning',
      articleRef: 'Art. 8',
      titleEn: `Missing Recycled Content Declarations (${names})`,
      titleAr: `نقص إفصاح نسب المحتوى المعاد تدويره (${names})`,
      detailEn: `Chemistry "${battery.chemistry}" uses active materials (${names}) without declared recovered content percentages.`,
      detailAr: `كيمياء "${battery.chemistry}" تتطلب توثيق نسب المواد النشطة المستردة (${names}).`,
      remediationEn: 'Declare exact recovered manufacturing/post-consumer shares (%) for each active metal.',
      remediationAr: 'أدخل النسب الموثقة للمعادن المستردة لكل عنصر نشط ينطبق على كيمياء البطارية.',
    });
  } else if (below2031Metals.length > 0) {
    sustScore -= 15;
    const summaryList = below2031Metals
      .map((m) => `${m.metal} ${m.declaredPct}% < ${m.target2031Pct}%`)
      .join('; ');
    findings.push({
      id: 'recycled-below-2031',
      scope: 'recycled',
      severity: 'warning',
      articleRef: 'Art. 8 (18 Aug 2031 Target)',
      titleEn: `Below 2031 EU Recycled Content Minimums (${summaryList})`,
      titleAr: `دون الحد الأدنى الأوروبي لعام 2031 للمحتوى المعاد تدويره (${summaryList})`,
      detailEn: 'Permitted for 2027 passport launch disclosure, but must reach August 2031 thresholds before the statutory cutoff.',
      detailAr: 'مقبول للإفصاح في إطلاق 2027، لكنه يتطلب رفع نسب الاسترداد قبل موعد أغسطس 2031 الإلزامي.',
      remediationEn: 'Qualify recycled precursor suppliers to close the gap ahead of 18 August 2031.',
      remediationAr: 'اعمل على تأهيل موردي المواد المعاد تدويرها لسد الفجوة قبل 18 أغسطس 2031.',
    });
  }

  if (
    telemetry.remainingCapacityKwh !== null &&
    Number.isFinite(telemetry.remainingCapacityKwh) &&
    Number.isFinite(battery.ratedCapacityKwh) &&
    telemetry.remainingCapacityKwh > battery.ratedCapacityKwh * 1.05
  ) {
    circScore -= 30;
    findings.push({
      id: 'telemetry-capacity-anomaly',
      scope: 'telemetry',
      severity: 'blocker',
      articleRef: 'Art. 14 & DIN DKE SPEC 99100',
      titleEn: 'BMS Remaining Capacity Exceeds Rated Capacity (+5% Tolerance)',
      titleAr: 'السعة المتبقية المسجلة من BMS تتجاوز السعة الاسمية للبطارية',
      detailEn: `Remaining ${telemetry.remainingCapacityKwh} kWh exceeds rated ${battery.ratedCapacityKwh} kWh beyond calibration tolerance.`,
      detailAr: `السعة المتبقية ${telemetry.remainingCapacityKwh} kWh تفوق السعة المقدرة ${battery.ratedCapacityKwh} kWh خارج هامش المعايرة.`,
      remediationEn: 'Re-check BMS SoH calibration and rated pack energy before sealing dynamic passport.',
      remediationAr: 'راجع معايرة نظام إدارة البطارية (BMS) وقيمة السعة المقدرة قبل الاعتماد.',
    });
  } else if (
    passportMandatory &&
    (telemetry.stateOfHealthPct === null || telemetry.stateOfCertifiedEnergyPct === null)
  ) {
    circScore -= 15;
    findings.push({
      id: 'telemetry-bms-pending',
      scope: 'telemetry',
      severity: 'warning',
      articleRef: 'Art. 14 & Annex VII',
      titleEn: 'Dynamic BMS SoH / SOCE Fields Incomplete for PLI Tier',
      titleAr: 'حقول حالة الصحة الديناميكية SoH / SOCE غير مكتملة لمستوى PLI',
      detailEn: 'Repairers and second-life operators rely on dynamic SoH % and SOCE % exposed via the PLI access tier.',
      detailAr: 'يعتمد فنيو الصيانة وإعادة التدوير على نسبة الحالة الصحية والطاقة المعتمدة ضمن مستوى PLI.',
      remediationEn: 'Populate baseline BMS SoH (100% at factory gate) and certified energy state.',
      remediationAr: 'أدخل القيم الابتدائية لحالة الصحة والطاقة المعتمدة عند الخروج من المصنع.',
    });
  }

  const unsafeUrls = [
    operator.dueDiligenceReportUrl,
    battery.safetyAndEolUrl,
    battery.dismantlingManualUrl,
    battery.sparePartsUrl,
  ].some((u) => !isSafeOptionalHttpsUrl(u));

  if (unsafeUrls) {
    circScore -= 35;
    findings.push({
      id: 'circularity-unsafe-urls',
      scope: 'circularity',
      severity: 'blocker',
      articleRef: 'Art. 11 & Annex XIII',
      titleEn: 'Unsafe or Non-HTTPS External URL Detected in Passport Links',
      titleAr: 'تم رصد رابط غير آمن أو لا يستخدم بروتوكول HTTPS في مراجع الجواز',
      detailEn: 'All dismantling, spare-parts, EoL safety, and due-diligence URIs must use valid HTTPS origins.',
      detailAr: 'يجب أن تستخدم جميع روابط التفكيك وقطع الغيار والسلامة والعناية الواجبة بروتوكول HTTPS الآمن.',
      remediationEn: 'Replace non-HTTPS or script URIs with verified HTTPS documentation links.',
      remediationAr: 'استبدل أي روابط غير مشفرة أو غير صالحة بروابط HTTPS موثقة.',
    });
  } else if (
    passportMandatory &&
    (!battery.safetyAndEolUrl.trim() || !battery.dismantlingManualUrl.trim() || !battery.sparePartsUrl.trim())
  ) {
    circScore -= 30;
    findings.push({
      id: 'circularity-pli-urls-missing',
      scope: 'circularity',
      severity: 'blocker',
      articleRef: 'Art. 11, 13 & Annex XIII(2)',
      titleEn: 'Missing End-of-Life Safety URL, Dismantling Manual, or Spare Parts URI',
      titleAr: 'نقص رابط تعليمات نهاية العمر أو دليل التفكيك (PLI) أو قناة قطع الغيار',
      detailEn: 'Mandated EV, LMT, and industrial (>2 kWh) passports must expose public EoL safety instructions and PLI dismantling/spare-parts URIs.',
      detailAr: 'يتطلب الجواز الإلزامي إتاحة تعليمات السلامة للعموم ودليل التفكيك وقناة قطع الغيار لذوي المصلحة.',
      remediationEn: 'Supply HTTPS URLs for Public EoL safety, PLI dismantling manual, and spare-parts contact.',
      remediationAr: 'أضف روابط HTTPS المعتمدة لتعليمات السلامة ودليل التفكيك وقطع الغيار.',
    });
  }

  if (passportMandatory && !operator.dueDiligenceReportUrl.trim()) {
    sustScore -= 15;
    findings.push({
      id: 'authority-due-diligence-missing',
      scope: 'circularity',
      severity: 'warning',
      articleRef: 'Art. 48–52 & OECD',
      titleEn: 'Supply-Chain Due Diligence Report Link Missing for Authority Tier',
      titleAr: 'رابط تقرير العناية الواجبة لسلاسل التوريد غير مدرج لقسم السلطات',
      detailEn: 'Third-party audited raw material due-diligence summary URI strengthens Authority readiness.',
      detailAr: 'إدراج رابط تقرير العناية الواجبة المراجع يعزز جاهزية ملف السلطات التنظيمية.',
      remediationEn: 'Attach the verified HTTPS URL to your OECD battery minerals due-diligence report.',
      remediationAr: 'أرفق رابط HTTPS لتقرير العناية الواجبة الخاص بسلاسل توريد المعادن.',
    });
  }

  const controlRatio = totalControlsCount > 0 ? completedControlsCount / totalControlsCount : 1;
  circScore = clampScore(circScore * 0.75 + controlRatio * 100 * 0.25);

  const identificationScore = clampScore(idScore);
  const sustainabilityScore = clampScore(sustScore);
  const circularityScore = clampScore(circScore);
  const overallScore = clampScore(
    identificationScore * 0.35 + sustainabilityScore * 0.35 + circularityScore * 0.3,
  );

  const blockersCount = findings.filter((f) => f.severity === 'blocker').length;
  const warningsCount = findings.filter((f) => f.severity === 'warning').length;

  let readinessTier: PassportReadinessTier = 'ready';
  if (!passportMandatory) {
    readinessTier = 'exempt_from_full_dpp';
  } else if (blockersCount > 0) {
    readinessTier = 'blocked';
  } else if (warningsCount > 0 || completedControlsCount < totalControlsCount || overallScore < 90) {
    readinessTier = 'needs_work';
  }

  return {
    passportMandatory,
    daysUntilFeb2027Deadline,
    deadlineIso: BATTERY_PASSPORT_DEADLINE_ISO,
    overallScore,
    identificationScore,
    sustainabilityScore,
    circularityScore,
    readinessTier,
    blockersCount,
    warningsCount,
    completedControlsCount,
    totalControlsCount,
    gs1DigitalLinkUri: gs1.uri,
    gtinValid: gs1.valid,
    recycledResults,
    findings,
  };
}

export function buildTieredJsonLdPassport(
  dossier: Pick<DppDossier, 'dossierCode' | 'operator' | 'battery' | 'sustainability' | 'telemetry' | 'controls' | 'summary' | 'digestHex'>,
  gs1Uri: string,
): TieredPassportExport {
  const publicTier: Record<string, unknown> = {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://schema.org/',
    ],
    '@type': ['DigitalBatteryPassport', 'BatteryPassportPublicView'],
    accessTier: 'public',
    regulatoryFramework: 'Regulation (EU) 2023/1542',
    standardReference: 'DIN DKE SPEC 99100',
    dossierCode: dossier.dossierCode,
    gs1DigitalLink: gs1Uri || null,
    batteryIdentifier: {
      gtin14: dossier.battery.gtin14,
      serialNumber: dossier.battery.serialNumber,
      batchNumber: dossier.battery.batchNumber,
    },
    economicOperator: {
      manufacturerName: dossier.operator.manufacturerName,
      euResponsibleOperator: dossier.operator.euResponsibleOperator,
      manufacturingCountry: dossier.operator.manufacturingCountry,
      declarationOfConformityRef: dossier.operator.declarationOfConformityRef,
    },
    batteryModel: {
      modelName: dossier.battery.modelName,
      modelIdentifier: dossier.battery.modelIdentifier,
      category: dossier.battery.category,
      chemistry: dossier.battery.chemistry,
      ratedCapacityKwh: dossier.battery.ratedCapacityKwh,
      nominalVoltageV: dossier.battery.nominalVoltageV,
      massKg: dossier.battery.massKg,
      manufacturingDateIso: dossier.battery.manufacturingDateIso,
      expectedLifetimeCycles: dossier.battery.expectedLifetimeCycles,
      safetyAndEolUrl: dossier.battery.safetyAndEolUrl,
    },
    sustainabilityPublic: {
      carbonFootprintKgCo2PerKwh: dossier.sustainability.carbonFootprintKgCo2PerKwh,
      carbonPerformanceClass: dossier.sustainability.carbonClass,
      recycledContentDeclaredPct: {
        cobalt: dossier.sustainability.recycledCobaltPct,
        lead: dossier.sustainability.recycledLeadPct,
        lithium: dossier.sustainability.recycledLithiumPct,
        nickel: dossier.sustainability.recycledNickelPct,
      },
      hazardousSubstancesNote: dossier.sustainability.hazardousSubstancesNote,
    },
    legalDisclaimer: MANDATORY_DISCLAIMER_EN,
  };

  const pliTier: Record<string, unknown> = {
    ...publicTier,
    '@type': ['DigitalBatteryPassport', 'BatteryPassportLegitimateInterestView'],
    accessTier: 'pli',
    circularityPli: {
      dismantlingManualUrl: dossier.battery.dismantlingManualUrl,
      sparePartsUrl: dossier.battery.sparePartsUrl,
    },
    dynamicTelemetry: {
      stateOfHealthPct: dossier.telemetry.stateOfHealthPct,
      stateOfCertifiedEnergyPct: dossier.telemetry.stateOfCertifiedEnergyPct,
      remainingCapacityKwh: dossier.telemetry.remainingCapacityKwh,
      fullChargeCyclesCompleted: dossier.telemetry.fullChargeCyclesCompleted,
      negativeEventsCount: dossier.telemetry.negativeEventsCount,
      lastUpdatedIso: dossier.telemetry.lastUpdatedIso,
    },
  };

  const completedControls = dossier.controls.filter((c) => c.completed).map((c) => c.id);

  const authorityTier: Record<string, unknown> = {
    ...pliTier,
    '@type': ['DigitalBatteryPassport', 'BatteryPassportAuthorityView'],
    accessTier: 'authority',
    authorityVerification: {
      operatorEoriOrVat: dossier.operator.operatorEoriOrVat,
      manufacturingPlantLocation: dossier.operator.manufacturingPlantLocation,
      contactEmail: dossier.operator.contactEmail,
      notifiedBodyId: dossier.sustainability.notifiedBodyId,
      dueDiligenceReportUrl: dossier.operator.dueDiligenceReportUrl,
      completedAnnexXiiiControls: completedControls,
      auditSummary: {
        readinessTier: dossier.summary.readinessTier,
        overallScore: dossier.summary.overallScore,
        passportMandatory: dossier.summary.passportMandatory,
      },
      canonicalSha256Digest: dossier.digestHex,
    },
  };

  return {
    public: publicTier,
    pli: pliTier,
    authority: authorityTier,
  };
}

function parseCsvMatrix(csvText: string): string[][] {
  const clean = csvText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

function parseCategory(raw: string): BatteryCategory {
  const norm = raw.trim().toLowerCase();
  if (norm === 'ev') return 'ev';
  if (norm === 'lmt') return 'lmt';
  if (norm === 'industrial_gt_2kwh' || norm === 'bess' || norm === 'industrial') return 'industrial_gt_2kwh';
  if (norm === 'industrial_lte_2kwh') return 'industrial_lte_2kwh';
  if (norm === 'portable') return 'portable';
  return 'industrial_gt_2kwh';
}

function parseChemistry(raw: string): BatteryChemistry {
  const norm = raw.trim().toUpperCase();
  if (norm === 'NMC' || norm === 'LFP' || norm === 'NCA' || norm === 'LTO' || norm === 'PBA') {
    return norm === 'PBA' ? 'PbA' : norm;
  }
  return 'Other';
}

export function auditBatteryBatchCsv(csvText: string): BatchAuditResult {
  const matrix = parseCsvMatrix(csvText);
  if (matrix.length <= 1) {
    return {
      totalRows: 0,
      inScopeCount: 0,
      readyCount: 0,
      blockedCount: 0,
      exemptCount: 0,
      rows: [],
    };
  }

  const headers = matrix[0].map((h) => h.trim().toLowerCase());
  const idx = (names: string[]): number => headers.findIndex((h) => names.includes(h));

  const modelIdx = idx(['modelname', 'model', 'model_name']);
  const catIdx = idx(['category', 'battery_category']);
  const chemIdx = idx(['chemistry', 'battery_chemistry']);
  const capIdx = idx(['ratedcapacitykwh', 'capacity_kwh', 'kwh']);
  const gtinIdx = idx(['gtin14', 'gtin', 'gtin_14']);
  const serialIdx = idx(['serialnumber', 'serial', 'serial_number']);
  const carbonIdx = idx(['carbonkgperkwh', 'carbon_footprint', 'kg_co2_kwh']);
  const domainIdx = idx(['gs1domain', 'gs1_domain', 'domain']);

  const rows: BatchBatteryRow[] = [];

  for (let r = 1; r < matrix.length; r += 1) {
    const cols = matrix[r];
    const get = (i: number, fallback = ''): string => (i >= 0 && i < cols.length ? cols[i].trim() : fallback);

    const modelName = get(modelIdx, `Battery Row ${r}`);
    const category = parseCategory(get(catIdx, 'industrial_gt_2kwh'));
    const chemistry = parseChemistry(get(chemIdx, 'LFP'));
    const rawCap = Number(get(capIdx, '0'));
    const ratedCapacityKwh = Number.isFinite(rawCap) ? rawCap : 0;
    const gtin14 = get(gtinIdx).replace(/[\s-]+/g, '');
    const serialNumber = get(serialIdx);
    const rawCarbon = get(carbonIdx);
    const parsedCarbon = rawCarbon ? Number(rawCarbon) : null;
    const carbonKgPerKwh = parsedCarbon !== null && Number.isFinite(parsedCarbon) ? parsedCarbon : null;
    const gs1Domain = get(domainIdx, 'id.voltgrid-example.eu');

    const passportMandatory = isPassportMandatory(category, ratedCapacityKwh);
    const gtinValid = isValidGtin14(gtin14);
    const gs1 = buildGs1DigitalLink({ gs1Domain, gtin14, serialNumber });
    const issues: string[] = [];

    if (!gtinValid) issues.push('Invalid GTIN-14 check digit');
    if (!gs1.valid && gs1.error) issues.push(gs1.error);
    if (passportMandatory && (carbonKgPerKwh === null || carbonKgPerKwh <= 0)) {
      issues.push('Missing carbon footprint (kg CO2-eq/kWh)');
    }

    let status: PassportReadinessTier = 'ready';
    if (!passportMandatory) {
      status = 'exempt_from_full_dpp';
    } else if (!gtinValid || !gs1.valid || carbonKgPerKwh === null || carbonKgPerKwh <= 0) {
      status = 'blocked';
    }

    rows.push({
      rowNumber: r,
      modelName,
      category,
      chemistry,
      ratedCapacityKwh,
      gtin14,
      serialNumber,
      carbonKgPerKwh,
      passportMandatory,
      gtinValid,
      gs1Uri: gs1.uri,
      status,
      issues,
    });
  }

  return {
    totalRows: rows.length,
    inScopeCount: rows.filter((x) => x.passportMandatory).length,
    readyCount: rows.filter((x) => x.status === 'ready').length,
    blockedCount: rows.filter((x) => x.status === 'blocked').length,
    exemptCount: rows.filter((x) => x.status === 'exempt_from_full_dpp').length,
    rows,
  };
}

export function sanitizeCsvCell(value: string | number | boolean | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  const escaped = neutralized.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function exportBatchCsv(rows: BatchBatteryRow[]): string {
  const header = [
    'rowNumber',
    'modelName',
    'category',
    'chemistry',
    'ratedCapacityKwh',
    'gtin14',
    'serialNumber',
    'carbonKgPerKwh',
    'passportMandatory',
    'gtinValid',
    'gs1Uri',
    'status',
    'issues',
  ].join(',');

  const lines = rows.map((row) =>
    [
      row.rowNumber,
      row.modelName,
      row.category,
      row.chemistry,
      row.ratedCapacityKwh,
      row.gtin14,
      row.serialNumber,
      row.carbonKgPerKwh ?? '',
      row.passportMandatory,
      row.gtinValid,
      row.gs1Uri,
      row.status,
      row.issues.join(' | '),
    ]
      .map((cell) => sanitizeCsvCell(cell))
      .join(','),
  );

  return `\uFEFF${[header, ...lines].join('\r\n')}\r\n`;
}
