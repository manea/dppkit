import type {
  AccessTier,
  AnnexXiiiControlState,
  BatteryCategory,
  BatteryChemistry,
  RecycledContentTargetResult,
  SustainabilityMetrics,
} from './types.ts';

export const BATTERY_PASSPORT_DEADLINE_ISO = '2027-02-18T00:00:00Z';
export const RECYCLED_CONTENT_DEADLINE_2031_ISO = '2031-08-18T00:00:00Z';
export const RECYCLED_CONTENT_DEADLINE_2036_ISO = '2036-08-18T00:00:00Z';

export const RECYCLED_CONTENT_TARGETS = {
  cobalt: { pct2031: 16, pct2036: 26 },
  lead: { pct2031: 85, pct2036: 85 },
  lithium: { pct2031: 6, pct2036: 12 },
  nickel: { pct2031: 6, pct2036: 15 },
} as const;

export const MANDATORY_DISCLAIMER_EN =
  'Engineering Governance Tool Notice: DPPKit validates schemas, generates structured JSON-LD outputs, and builds GS1 Digital Link QR payloads aligned with Regulation (EU) 2023/1542 and DIN DKE SPEC 99100. It is NOT legal counsel, NOT an EU Notified Body, NOT an accredited ISO 14067 / LCA verifier, NOT a GS1 registrar, and does NOT submit live passports to the EU Commission registry or customs portals.';

export const MANDATORY_DISCLAIMER_AR =
  'تنبيه النطاق القانوني الإلزامي: أداة DPPKit مساحة هندسية للتحقق من مخطط البيانات، وتوليد ملفات JSON-LD، وبناء روابط وملصقات GS1 Digital Link المتوافقة هيكلياً مع لائحة البطاريات الأوروبية (EU) 2023/1542 ومعيار DIN DKE SPEC 99100 — وليست استشارة قانونية معتمدة، ولا جهة تقييم مطابقة أوروبية (Notified Body)، ولا مقيّماً معتمداً للبصمة الكربونية ISO 14067، ولا مسجّلاً لدى GS1، ولا ترسل جوازات حيّة إلى سجل المفوضية الأوروبية.';

export interface AnnexXiiiControlDefinition {
  id: string;
  articleRef: string;
  tier: AccessTier;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
}

export const ANNEX_XIII_CONTROLS: AnnexXiiiControlDefinition[] = [
  {
    id: 'annex13-operator-eori',
    articleRef: 'Art. 77 & Annex VI',
    tier: 'public',
    titleEn: 'Economic Operator & EU Representative Identity',
    titleAr: 'هوية المصنّع والمشغّل المسؤول داخل الاتحاد الأوروبي',
    descriptionEn: 'Manufacturer name, EU importer/representative, EORI or VAT identifier, and plant country.',
    descriptionAr: 'اسم المصنّع، المستورد أو الممثل المسؤول في الاتحاد الأوروبي، معرف EORI أو الضريبة، وبلد المصنع.',
  },
  {
    id: 'annex13-gtin-gs1-qr',
    articleRef: 'Art. 13 & ISO/IEC 15459',
    tier: 'public',
    titleEn: 'Unique Battery Identifier & GS1 Digital Link QR',
    titleAr: 'المعرّف الفريد للبطارية ورابط GS1 Digital Link QR',
    descriptionEn: 'Valid GTIN-14 check digit paired with unique ISO 15459 serial number resolved via HTTPS.',
    descriptionAr: 'رقم GTIN-14 بخانة تدقيق صحيحة مقترناً برقم تسلسلي فريد ISO 15459 عبر رابط HTTPS.',
  },
  {
    id: 'annex13-model-batch',
    articleRef: 'Annex XIII(1)',
    tier: 'public',
    titleEn: 'Model, Chemistry & Rated Capacity Metadata',
    titleAr: 'بيانات الطراز والكيمياء والسعة المقدرة',
    descriptionEn: 'Battery category, active chemistry, rated capacity (kWh), nominal voltage, mass, and manufacturing date.',
    descriptionAr: 'فئة البطارية والكيمياء النشطة والسعة المقدرة (kWh) والجهد الاسمي والوزن وتاريخ التصنيع.',
  },
  {
    id: 'annex13-carbon-footprint',
    articleRef: 'Art. 7 & Annex II',
    tier: 'public',
    titleEn: 'Lifecycle Carbon Footprint & Performance Class',
    titleAr: 'إعلان البصمة الكربونية لدورة الحياة وفئة الأداء',
    descriptionEn: 'Declared kg CO2-eq per kWh over total energy provided and performance class (A–E).',
    descriptionAr: 'إعلان انبعاثات kg CO2-eq/kWh عبر دورة الحياة الكاملة وفئة الأداء الكربوني (A–E).',
  },
  {
    id: 'annex13-recycled-content',
    articleRef: 'Art. 8',
    tier: 'public',
    titleEn: 'Active Material Recycled Content Shares',
    titleAr: 'نسب المحتوى المعاد تدويره في المواد النشطة',
    descriptionEn: 'Verified share of recovered cobalt, lead, lithium, and nickel tracked against 2031/2036 EU minimums.',
    descriptionAr: 'توثيق نسب الكوبالت والرصاص والليثيوم والنيكل المستردة ومقارنتها بحدود 2031 و2036.',
  },
  {
    id: 'annex13-doc-ce-mark',
    articleRef: 'Art. 18 & 20',
    tier: 'public',
    titleEn: 'EU Declaration of Conformity & CE Marking Ref',
    titleAr: 'إعلان المطابقة الأوروبي ومرجع علامة CE',
    descriptionEn: 'Signed EU Declaration of Conformity reference linked inside the public tier of the passport.',
    descriptionAr: 'إرفاق مرجع إعلان المطابقة الأوروبي الموقّع ضمن المستوى العام لجواز البطارية.',
  },
  {
    id: 'annex13-eol-collection',
    articleRef: 'Art. 13 & 74',
    tier: 'public',
    titleEn: 'End-of-Life Collection & Safety Instructions',
    titleAr: 'تعليمات التجميع وإعادة التدوير ونهاية العمر',
    descriptionEn: 'Publicly reachable URI covering separate collection symbol, waste handling, and consumer safety.',
    descriptionAr: 'رابط متاح للعموم يتضمن رموز الفرز المنفصل ومعالجة النفايات وتعليمات السلامة.',
  },
  {
    id: 'annex13-dismantling-manual',
    articleRef: 'Art. 11 & Annex XIII(2)',
    tier: 'pli',
    titleEn: 'Dismantling, Disassembly & Extinguishing Manual',
    titleAr: 'دليل التفكيك والفك الآمن وإطفاء الحرائق (PLI)',
    descriptionEn: 'Restricted access for repairers, second-life operators, and recyclers with disassembly steps.',
    descriptionAr: 'متاح لذوي المصلحة المشروعة (فنيي الصيانة والمُدوّرين) ويشمل خطوات التفكيك الآمن.',
  },
  {
    id: 'annex13-spare-parts',
    articleRef: 'Annex XIII(2)',
    tier: 'pli',
    titleEn: 'Spare Parts Ordering & Cell Replacement Contact',
    titleAr: 'قناة قطع الغيار واستبدال الخلايا والمكونات',
    descriptionEn: 'Postal/web contact or part-number portal enabling independent repair and repurposing.',
    descriptionAr: 'رابط أو قناة لطلب قطع الغيار لإتاحة الإصلاح المستقل وإعادة الاستخدام.',
  },
  {
    id: 'annex13-dynamic-bms',
    articleRef: 'Art. 14 & Annex VII',
    tier: 'pli',
    titleEn: 'Dynamic BMS State of Health (SoH / SOCE)',
    titleAr: 'بيانات نظام إدارة البطارية الديناميكية (SoH / SOCE)',
    descriptionEn: 'Dynamic state of health, remaining certified energy, cycle count, and negative event logs.',
    descriptionAr: 'تحديث نسبة الحالة الصحية والطاقة المتبقية المعتمدة وعدد الدورات وسجل الحوادث السلبية.',
  },
  {
    id: 'annex13-lca-notified-body',
    articleRef: 'Art. 7 & 22',
    tier: 'authority',
    titleEn: 'Notified Body LCA Verification Identifier',
    titleAr: 'معرف تحقق جهة الإخطار لدراسة البصمة الكربونية',
    descriptionEn: 'Four-digit EU Notified Body identifier and technical documentation trace for surveillance checks.',
    descriptionAr: 'معرف جهة الإخطار الأوروبية والوثائق الفنية لسلطات مراقبة السوق.',
  },
  {
    id: 'annex13-supply-due-diligence',
    articleRef: 'Art. 48–52 & OECD',
    tier: 'authority',
    titleEn: 'Raw Material Supply-Chain Due Diligence Report',
    titleAr: 'تقرير العناية الواجبة لسلاسل توريد المعادن الحرجة',
    descriptionEn: 'Third-party verified supply-chain policy covering cobalt, lithium, nickel, and natural graphite.',
    descriptionAr: 'تقرير العناية الواجبة المراجع لسلاسل توريد الكوبالت والليثيوم والنيكل والجرافيت.',
  },
];

export function defaultAnnexXiiiControls(completedIds: string[] = []): AnnexXiiiControlState[] {
  const set = new Set(completedIds);
  return ANNEX_XIII_CONTROLS.map((ctrl) => ({
    id: ctrl.id,
    completed: set.has(ctrl.id),
    evidenceNote: '',
  }));
}

export function isPassportMandatory(category: BatteryCategory, ratedCapacityKwh: number): boolean {
  if (category === 'ev' || category === 'lmt') {
    return true;
  }
  if (category === 'industrial_gt_2kwh') {
    return Number.isFinite(ratedCapacityKwh) && ratedCapacityKwh > 2;
  }
  return false;
}

export function computeDaysToDeadline(referenceDateIso?: string): number {
  const deadlineMs = Date.parse(BATTERY_PASSPORT_DEADLINE_ISO);
  const parsedRef = referenceDateIso ? Date.parse(referenceDateIso) : Date.now();
  const refMs = Number.isFinite(parsedRef) ? parsedRef : Date.now();
  return Math.ceil((deadlineMs - refMs) / 86_400_000);
}

export function evaluateRecycledContentReadiness(
  chemistry: BatteryChemistry,
  metrics: SustainabilityMetrics,
): RecycledContentTargetResult[] {
  const applicableByMetal: Record<'cobalt' | 'lead' | 'lithium' | 'nickel', boolean> = {
    cobalt: chemistry === 'NMC' || chemistry === 'NCA' || (chemistry === 'Other' && metrics.recycledCobaltPct !== null),
    lead: chemistry === 'PbA' || (chemistry === 'Other' && metrics.recycledLeadPct !== null),
    lithium:
      chemistry === 'NMC' ||
      chemistry === 'LFP' ||
      chemistry === 'NCA' ||
      chemistry === 'LTO' ||
      (chemistry === 'Other' && metrics.recycledLithiumPct !== null),
    nickel: chemistry === 'NMC' || chemistry === 'NCA' || (chemistry === 'Other' && metrics.recycledNickelPct !== null),
  };

  const declaredByMetal: Record<'cobalt' | 'lead' | 'lithium' | 'nickel', number | null> = {
    cobalt: metrics.recycledCobaltPct,
    lead: metrics.recycledLeadPct,
    lithium: metrics.recycledLithiumPct,
    nickel: metrics.recycledNickelPct,
  };

  return (['cobalt', 'lead', 'lithium', 'nickel'] as const).map((metal) => {
    const applicable = applicableByMetal[metal];
    const declaredPct = declaredByMetal[metal];
    const { pct2031, pct2036 } = RECYCLED_CONTENT_TARGETS[metal];
    const meets2031 = !applicable || (declaredPct !== null && Number.isFinite(declaredPct) && declaredPct >= pct2031);
    const meets2036 = !applicable || (declaredPct !== null && Number.isFinite(declaredPct) && declaredPct >= pct2036);

    return {
      metal,
      applicable,
      declaredPct,
      target2031Pct: pct2031,
      target2036Pct: pct2036,
      meets2031,
      meets2036,
    };
  });
}
