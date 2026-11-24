import type {
  AccessTier,
  BatteryCategory,
  CarbonPerformanceClass,
  Locale,
  PassportReadinessTier,
} from '../core/types.ts';

export interface DppCopy {
  brandTitle: string;
  brandSubtitle: string;
  modeServer: string;
  modeLocal: string;
  deadlinePill: string;
  themeLightLabel: string;
  themeDarkLabel: string;
  langToggleLabel: string;
  // Workspace toolbar
  savedDossiersLabel: string;
  newDraftBtn: string;
  finalizeSealBtn: string;
  duplicateBtn: string;
  deleteBtn: string;
  openShareBtn: string;
  backToStudioBtn: string;
  lockedBanner: string;
  publicShareBanner: string;
  draftStatusLabel: string;
  lockedStatusLabel: string;
  // KPI strip
  kpiScoreLabel: string;
  kpiCountdownLabel: string;
  kpiCountdownSub: string;
  kpiGs1Label: string;
  kpiControlsLabel: string;
  // Tabs
  tabBuilder: string;
  tabTiers: string;
  tabBatch: string;
  tabDossier: string;
  // Presets & Profiles
  presetsHeading: string;
  profilesHeading: string;
  profileNamePlaceholder: string;
  saveProfileBtn: string;
  applyProfileBtn: string;
  deleteProfileBtn: string;
  noProfilesText: string;
  // Editor sections
  sectionOperatorTitle: string;
  manufacturerName: string;
  euResponsibleOperator: string;
  operatorEoriOrVat: string;
  manufacturingPlantLocation: string;
  manufacturingCountry: string;
  gs1Domain: string;
  contactEmail: string;
  declarationOfConformityRef: string;
  dueDiligenceReportUrl: string;
  sectionBatteryTitle: string;
  modelName: string;
  modelIdentifier: string;
  gtin14: string;
  autoFixGtinBtn: string;
  serialNumber: string;
  batchNumber: string;
  categoryLabel: string;
  chemistryLabel: string;
  ratedCapacityKwh: string;
  nominalVoltageV: string;
  massKg: string;
  manufacturingDateIso: string;
  expectedLifetimeCycles: string;
  safetyAndEolUrl: string;
  dismantlingManualUrl: string;
  sparePartsUrl: string;
  sectionSustainabilityTitle: string;
  carbonFootprint: string;
  carbonClassLabel: string;
  notifiedBodyId: string;
  recycledCobaltPct: string;
  recycledLeadPct: string;
  recycledLithiumPct: string;
  recycledNickelPct: string;
  hazardousSubstancesNote: string;
  notApplicableChemNote: string;
  sectionTelemetryTitle: string;
  stateOfHealthPct: string;
  stateOfCertifiedEnergyPct: string;
  remainingCapacityKwh: string;
  fullChargeCyclesCompleted: string;
  negativeEventsCount: string;
  lastUpdatedIso: string;
  findingsHeading: string;
  saveChangesBtn: string;
  savingText: string;
  // Tiers & QR
  qrHeading: string;
  qrSubtitle: string;
  qrInvalidNotice: string;
  copyGs1UriBtn: string;
  downloadQrSvgBtn: string;
  tiersHeading: string;
  tiersSubtitle: string;
  tierPublicTitle: string;
  tierPliTitle: string;
  tierAuthorityTitle: string;
  tierIsolationProof: string;
  copyJsonLdBtn: string;
  downloadJsonLdBtn: string;
  qrLabelHeading: string;
  copyHtmlLabelBtn: string;
  downloadHtmlLabelBtn: string;
  // Batch CSV
  batchHeading: string;
  batchSubtitle: string;
  uploadCsvLabel: string;
  runBatchBtn: string;
  exportBatchCsvBtn: string;
  batchTotal: string;
  batchInScope: string;
  batchReady: string;
  batchBlocked: string;
  batchExempt: string;
  colModel: string;
  colCategory: string;
  colChemistry: string;
  colCapacity: string;
  colGtin: string;
  colStatus: string;
  colIssues: string;
  noIssuesLabel: string;
  // Dossier & Print
  controlsHeading: string;
  controlsSubtitle: string;
  dossierHeading: string;
  printPdfBtn: string;
  downloadMdBtn: string;
  downloadCsvBtn: string;
  copySummaryBtn: string;
  copyShareUrlBtn: string;
  sha256Label: string;
  recycledTableHeading: string;
  metalCol: string;
  applicableCol: string;
  declaredCol: string;
  target2031Col: string;
  target2036Col: string;
  // Notifications
  copiedToast: string;
  savedToast: string;
  sealedToast: string;
  duplicatedToast: string;
  profileSavedToast: string;
}

const EN_COPY: DppCopy = {
  brandTitle: 'DPPKit',
  brandSubtitle: 'EU Battery Regulation (EU) 2023/1542 & DIN DKE SPEC 99100 Studio',
  modeServer: 'SQLite WAL Server',
  modeLocal: 'Browser $0 Mode',
  deadlinePill: 'Mandatory Deadline: 18 Feb 2027',
  themeLightLabel: 'Graphite Cell Dark',
  themeDarkLabel: 'Voltaic Ivory Light',
  langToggleLabel: 'العربية (RTL)',
  savedDossiersLabel: 'Active Passport Dossier',
  newDraftBtn: 'New Draft',
  finalizeSealBtn: 'Finalize & Seal DPP',
  duplicateBtn: 'Duplicate Editable Copy',
  deleteBtn: 'Delete Draft',
  openShareBtn: 'Open Public Share',
  backToStudioBtn: 'Return to Studio',
  lockedBanner: 'Sealed & immutable passport dossier. Duplicate into a new draft to modify attributes.',
  publicShareBanner: 'Public Read-Only EU Battery Passport Verification View',
  draftStatusLabel: 'Editable Draft',
  lockedStatusLabel: 'Sealed',
  kpiScoreLabel: 'Annex XIII Readiness',
  kpiCountdownLabel: 'Days to 18 Feb 2027',
  kpiCountdownSub: 'Art. 77 EV / LMT / >2 kWh Industrial',
  kpiGs1Label: 'GS1 Digital Link Status',
  kpiControlsLabel: 'Annex XIII Controls',
  tabBuilder: 'Passport Builder & Audit',
  tabTiers: '3-Tier JSON-LD & QR',
  tabBatch: 'Fleet Batch CSV Auditor',
  tabDossier: 'Annex XIII & A4 PDF',
  presetsHeading: 'Load Industrial Preset',
  profilesHeading: 'Economic Operator Profiles',
  profileNamePlaceholder: 'Operator profile name...',
  saveProfileBtn: 'Save Operator',
  applyProfileBtn: 'Apply',
  deleteProfileBtn: 'Delete',
  noProfilesText: 'No saved operator profiles yet.',
  sectionOperatorTitle: '1. Economic Operator & EU Representative (Annex VI / XIII)',
  manufacturerName: 'Manufacturer Legal Name',
  euResponsibleOperator: 'EU Importer / Authorized Representative',
  operatorEoriOrVat: 'EU EORI / VAT Identifier',
  manufacturingPlantLocation: 'Manufacturing Plant Facility',
  manufacturingCountry: 'Manufacturing Country (ISO-2)',
  gs1Domain: 'GS1 Resolver Domain (HTTPS)',
  contactEmail: 'Compliance Contact Email',
  declarationOfConformityRef: 'EU Declaration of Conformity Ref (Art. 18)',
  dueDiligenceReportUrl: 'Authority Due Diligence Report URL (Art. 48–52)',
  sectionBatteryTitle: '2. Battery Identification, GS1 Digital Link & Specs',
  modelName: 'Battery Model Name',
  modelIdentifier: 'Model Identifier',
  gtin14: 'GTIN-14 (14 Digits)',
  autoFixGtinBtn: 'Fix Check Digit',
  serialNumber: 'ISO 15459 Serial Number (AI 21)',
  batchNumber: 'Batch / Lot Code (AI 10)',
  categoryLabel: 'Battery Category (Art. 77 Scope)',
  chemistryLabel: 'Electrochemistry System',
  ratedCapacityKwh: 'Rated Capacity (kWh)',
  nominalVoltageV: 'Nominal Voltage (V)',
  massKg: 'Battery Mass (kg)',
  manufacturingDateIso: 'Manufacturing Date',
  expectedLifetimeCycles: 'Expected Lifetime (Cycles)',
  safetyAndEolUrl: 'Public End-of-Life & Safety URL (Art. 13)',
  dismantlingManualUrl: 'PLI Dismantling Manual URL (Art. 11)',
  sparePartsUrl: 'PLI Spare Parts Portal URL (Annex XIII)',
  sectionSustainabilityTitle: '3. Carbon Footprint (Art. 7) & Recycled Content (Art. 8)',
  carbonFootprint: 'Carbon Footprint (kg CO2-eq / kWh)',
  carbonClassLabel: 'Carbon Performance Class',
  notifiedBodyId: 'Authority Notified Body ID',
  recycledCobaltPct: 'Recycled Cobalt Co (%) — 2031: 16% / 2036: 26%',
  recycledLeadPct: 'Recycled Lead Pb (%) — 2031: 85% / 2036: 85%',
  recycledLithiumPct: 'Recycled Lithium Li (%) — 2031: 6% / 2036: 12%',
  recycledNickelPct: 'Recycled Nickel Ni (%) — 2031: 6% / 2036: 15%',
  hazardousSubstancesNote: 'Hazardous Substances Note',
  notApplicableChemNote: 'Not required for this battery chemistry',
  sectionTelemetryTitle: '4. Dynamic BMS State of Health Telemetry (PLI Tier — Art. 14)',
  stateOfHealthPct: 'State of Health SoH (%)',
  stateOfCertifiedEnergyPct: 'State of Certified Energy SOCE (%)',
  remainingCapacityKwh: 'Remaining Capacity (kWh)',
  fullChargeCyclesCompleted: 'Full Charge Cycles Logged',
  negativeEventsCount: 'Negative / Deep-Discharge Events',
  lastUpdatedIso: 'Last Telemetry Sync Timestamp',
  findingsHeading: 'Live Compliance Findings & Remediations',
  saveChangesBtn: 'Save Draft Snapshot',
  savingText: 'Syncing...',
  qrHeading: 'ISO/IEC 18004 GS1 Digital Link QR Code',
  qrSubtitle: 'Direct physical battery casing QR payload routing to https://<domain>/01/<gtin14>/.../21/<serial>.',
  qrInvalidNotice: 'Cannot render compliant GS1 QR until GTIN-14 check digit, serial number, and HTTPS domain validate.',
  copyGs1UriBtn: 'Copy GS1 URI',
  downloadQrSvgBtn: 'Download QR (.svg)',
  tiersHeading: 'DIN DKE SPEC 99100 Three-Tier Access Explorer',
  tiersSubtitle: 'Inspect strict attribute partitioning between Public consumers, Legitimate Interest actors (PLI), and Authorities.',
  tierPublicTitle: 'Public Tier (No BMS / No Audit ID)',
  tierPliTitle: 'PLI Tier (Repairers & Recyclers)',
  tierAuthorityTitle: 'Authority Tier (Market Surveillance)',
  tierIsolationProof: 'Strict Tier Isolation Verified',
  copyJsonLdBtn: 'Copy JSON-LD',
  downloadJsonLdBtn: 'Download .jsonld',
  qrLabelHeading: 'XSS-Safe HTML + Schema.org JSON-LD QR Label Snippet',
  copyHtmlLabelBtn: 'Copy HTML Label',
  downloadHtmlLabelBtn: 'Download .html',
  batchHeading: 'Multi-SKU Battery Catalog Batch CSV Auditor',
  batchSubtitle: 'Audit entire EV, LMT, and BESS fleets client-side with zero uploads required.',
  uploadCsvLabel: 'Import .csv File',
  runBatchBtn: 'Run Batch Audit',
  exportBatchCsvBtn: 'Export Sanitized UTF-8 BOM CSV',
  batchTotal: 'Total Rows',
  batchInScope: 'Passport Mandatory',
  batchReady: 'Ready',
  batchBlocked: 'Blocked',
  batchExempt: 'Exempt (Art. 77)',
  colModel: 'Model',
  colCategory: 'Category',
  colChemistry: 'Chemistry',
  colCapacity: 'kWh',
  colGtin: 'GTIN-14',
  colStatus: 'Status',
  colIssues: 'Detected Issues',
  noIssuesLabel: 'Clean',
  controlsHeading: 'Annex XIII 12-Point Governance Checklist',
  controlsSubtitle: 'Toggle engineering controls in draft mode to update Annex XIII readiness live.',
  dossierHeading: 'Formal Annex XIII Readiness Dossier (A4 Print)',
  printPdfBtn: 'Print / Save A4 PDF',
  downloadMdBtn: 'Download Annex XIII (.md)',
  downloadCsvBtn: 'Download CSV',
  copySummaryBtn: 'Copy Summary',
  copyShareUrlBtn: 'Copy Share URL',
  sha256Label: 'Canonical SHA-256 Digest',
  recycledTableHeading: 'Article 8 Active Material Recycled Content Readiness',
  metalCol: 'Material',
  applicableCol: 'Chemistry Scope',
  declaredCol: 'Declared %',
  target2031Col: '2031 Target',
  target2036Col: '2036 Target',
  copiedToast: 'Copied to clipboard',
  savedToast: 'Draft saved & audited',
  sealedToast: 'Passport finalized and sealed with SHA-256',
  duplicatedToast: 'Editable duplicate draft created',
  profileSavedToast: 'Operator profile saved',
};

const AR_COPY: DppCopy = {
  brandTitle: 'DPPKit | جواز البطارية الأوروبي',
  brandSubtitle: 'أستوديو جاهزية لائحة البطاريات الأوروبية (EU) 2023/1542 ومعيار DIN DKE SPEC 99100',
  modeServer: 'خادم SQLite WAL',
  modeLocal: 'الوضع المحلي $0',
  deadlinePill: 'الموعد الإلزامي: 18 فبراير 2027',
  themeLightLabel: 'الوضع الداكن (Graphite Cell)',
  themeDarkLabel: 'الوضع الفاتح (Voltaic Ivory)',
  langToggleLabel: 'English (LTR)',
  savedDossiersLabel: 'ملف الجواز النشط',
  newDraftBtn: 'مسودة جديدة',
  finalizeSealBtn: 'اعتماد وختم الجواز',
  duplicateBtn: 'استنساخ نسخة قابلة للتعديل',
  deleteBtn: 'حذف المسودة',
  openShareBtn: 'فتح رابط المشاركة',
  backToStudioBtn: 'العودة إلى الأستوديو',
  lockedBanner: 'ملف جواز مختوم وغير قابل للتعديل. استنسخه إلى مسودة جديدة لإجراء تغييرات.',
  publicShareBanner: 'عرض التحقق العام المقروء فقط لجواز البطارية الأوروبي',
  draftStatusLabel: 'مسودة قابلة للتعديل',
  lockedStatusLabel: 'مختوم ومقفل',
  kpiScoreLabel: 'جاهزية الملحق XIII',
  kpiCountdownLabel: 'يوماً حتى 18 فبراير 2027',
  kpiCountdownSub: 'المادة 77: EV / LMT / الصناعية > 2 kWh',
  kpiGs1Label: 'حالة GS1 Digital Link',
  kpiControlsLabel: 'ضوابط الملحق XIII',
  tabBuilder: 'باني الجواز والتدقيق',
  tabTiers: 'مستويات النفاذ ورمز QR',
  tabBatch: 'مدقق جرد CSV الدفعي',
  tabDossier: 'تقرير الملحق XIII وPDF',
  presetsHeading: 'تحميل نموذج صناعي جاهز',
  profilesHeading: 'ملفات المشغّل الاقتصادي الأوروبي',
  profileNamePlaceholder: 'اسم ملف المشغّل...',
  saveProfileBtn: 'حفظ المشغّل',
  applyProfileBtn: 'تطبيق',
  deleteProfileBtn: 'حذف',
  noProfilesText: 'لا توجد ملفات مشغّلين محفوظة بعد.',
  sectionOperatorTitle: '1. المشغّل الاقتصادي والممثل الأوروبي (الملحق VI / XIII)',
  manufacturerName: 'الاسم القانوني للمصنّع',
  euResponsibleOperator: 'المستورد أو الممثل المسؤول في الاتحاد الأوروبي',
  operatorEoriOrVat: 'معرف EORI أو الضريبة الأوروبية',
  manufacturingPlantLocation: 'موقع مصنع التصنيع',
  manufacturingCountry: 'بلد التصنيع (ISO-2)',
  gs1Domain: 'نطاق محلل GS1 الآمن (HTTPS)',
  contactEmail: 'بريد مسؤول الامتثال',
  declarationOfConformityRef: 'مرجع إعلان المطابقة الأوروبي DoC (المادة 18)',
  dueDiligenceReportUrl: 'رابط تقرير العناية الواجبة للسلطات (المادة 48–52)',
  sectionBatteryTitle: '2. المعرفات ورابط GS1 Digital Link والمواصفات الفنية',
  modelName: 'اسم طراز البطارية',
  modelIdentifier: 'معرف الطراز',
  gtin14: 'رقم GTIN-14 (من 14 خانة)',
  autoFixGtinBtn: 'تصحيح خانة التدقيق',
  serialNumber: 'الرقم التسلسلي ISO 15459 (AI 21)',
  batchNumber: 'رمز الدفعة / التشغيلة (AI 10)',
  categoryLabel: 'فئة البطارية (نطاق المادة 77)',
  chemistryLabel: 'الكيمياء الكهروكيميائية',
  ratedCapacityKwh: 'السعة المقدرة (kWh)',
  nominalVoltageV: 'الجهد الاسمي (V)',
  massKg: 'كتلة البطارية (كجم)',
  manufacturingDateIso: 'تاريخ التصنيع',
  expectedLifetimeCycles: 'العمر المتوقع بالدورات',
  safetyAndEolUrl: 'رابط السلامة ونهاية العمر للعموم (المادة 13)',
  dismantlingManualUrl: 'رابط دليل التفكيك لذوي المصلحة (PLI)',
  sparePartsUrl: 'رابط بوابة قطع الغيار (PLI)',
  sectionSustainabilityTitle: '3. البصمة الكربونية (المادة 7) والمحتوى المعاد تدويره (المادة 8)',
  carbonFootprint: 'البصمة الكربونية (kg CO2-eq / kWh)',
  carbonClassLabel: 'فئة الأداء الكربوني',
  notifiedBodyId: 'معرف جهة الإخطار الأوروبية (للسلطات)',
  recycledCobaltPct: 'الكوبالت المعاد تدويره Co (%) — 2031: 16% / 2036: 26%',
  recycledLeadPct: 'الرصاص المعاد تدويره Pb (%) — 2031: 85% / 2036: 85%',
  recycledLithiumPct: 'الليثيوم المعاد تدويره Li (%) — 2031: 6% / 2036: 12%',
  recycledNickelPct: 'النيكل المعاد تدويره Ni (%) — 2031: 6% / 2036: 15%',
  hazardousSubstancesNote: 'بيان المواد الخطرة',
  notApplicableChemNote: 'غير مطلوب لهذه الكيمياء',
  sectionTelemetryTitle: '4. القياسات الديناميكية لنظام إدارة البطارية BMS (مستوى ذوي المصلحة PLI)',
  stateOfHealthPct: 'نسبة الحالة الصحية SoH (%)',
  stateOfCertifiedEnergyPct: 'نسبة الطاقة المعتمدة SOCE (%)',
  remainingCapacityKwh: 'السعة المتبقية الحالية (kWh)',
  fullChargeCyclesCompleted: 'دورات الشحن الكاملة المسجلة',
  negativeEventsCount: 'عدد الحوادث السلبية / التفريغ العميق',
  lastUpdatedIso: 'تاريخ آخر مزامنة لـ BMS',
  findingsHeading: 'ملاحظات التدقيق الحي وخطوات المعالجة',
  saveChangesBtn: 'حفظ المسودة وتحديث التدقيق',
  savingText: 'جارٍ الحفظ...',
  qrHeading: 'رمز الاستجابة السريعة GS1 Digital Link (ISO/IEC 18004)',
  qrSubtitle: 'الرمز المطبوع على جسم البطارية والموجَّه إلى https://<domain>/01/<gtin14>/.../21/<serial>.',
  qrInvalidNotice: 'لا يمكن توليد رمز QR متوافق قبل تصحيح رقم GTIN-14 والرقم التسلسلي ونطاق HTTPS.',
  copyGs1UriBtn: 'نسخ رابط GS1',
  downloadQrSvgBtn: 'تنزيل QR (.svg)',
  tiersHeading: 'مستكشف مستويات النفاذ الثلاثة (DIN DKE SPEC 99100)',
  tiersSubtitle: 'مقارنة عزل الحقول بين الجمهور العام وذوي المصلحة المشروعة (PLI) وسلطات مراقبة السوق.',
  tierPublicTitle: 'المستوى العام (بدون BMS أو جهة إخطار)',
  tierPliTitle: 'ذوو المصلحة المشروعة PLI (الصيانة والتدوير)',
  tierAuthorityTitle: 'السلطات الرقابية وجهات الإخطار',
  tierIsolationProof: 'تطبيق عزل المستويات الصارم مفعّل',
  copyJsonLdBtn: 'نسخ JSON-LD',
  downloadJsonLdBtn: 'تنزيل .jsonld',
  qrLabelHeading: 'مقتطف ملصق الويب HTML + Schema.org JSON-LD المحصّن من XSS',
  copyHtmlLabelBtn: 'نسخ كود HTML',
  downloadHtmlLabelBtn: 'تنزيل .html',
  batchHeading: 'مدقق جرد البطاريات الدفعي (CSV)',
  batchSubtitle: 'فحص كتالوج بطاريات EV وLMT وBESS بالكامل محلياً داخل المتصفح.',
  uploadCsvLabel: 'رفع ملف CSV',
  runBatchBtn: 'تشغيل التدقيق الدفعي',
  exportBatchCsvBtn: 'تصدير CSV منقّح (UTF-8 BOM)',
  batchTotal: 'إجمالي الصفوف',
  batchInScope: 'خاضع للجواز',
  batchReady: 'جاهز',
  batchBlocked: 'متعثر',
  batchExempt: 'مستثنى',
  colModel: 'الطراز',
  colCategory: 'الفئة',
  colChemistry: 'الكيمياء',
  colCapacity: 'السعة kWh',
  colGtin: 'GTIN-14',
  colStatus: 'الحالة',
  colIssues: 'الملاحظات المرصودة',
  noIssuesLabel: 'سليم',
  controlsHeading: 'قائمة ضوابط الملحق XIII الـ 12',
  controlsSubtitle: 'فعّل الضوابط في وضع المسودة لإعادة احتساب درجة الجاهزية فوراً.',
  dossierHeading: 'ملف جاهزية الملحق XIII الرسمي للطباعة (A4 PDF)',
  printPdfBtn: 'طباعة / حفظ A4 PDF',
  downloadMdBtn: 'تنزيل تقرير (.md)',
  downloadCsvBtn: 'تنزيل CSV',
  copySummaryBtn: 'نسخ الملخص',
  copyShareUrlBtn: 'نسخ رابط المشاركة',
  sha256Label: 'بصمة SHA-256 المعيارية',
  recycledTableHeading: 'جاهزية نسب المحتوى المعاد تدويره (المادة 8)',
  metalCol: 'المادة النشطة',
  applicableCol: 'ينطبق على الكيمياء؟',
  declaredCol: 'المعلن %',
  target2031Col: 'هدف 2031',
  target2036Col: 'هدف 2036',
  copiedToast: 'تم النسخ إلى الحافظة',
  savedToast: 'تم حفظ المسودة وإعادة التدقيق',
  sealedToast: 'تم اعتماد الجواز وختمه ببصمة SHA-256',
  duplicatedToast: 'تم إنشاء نسخة مسودة قابلة للتعديل',
  profileSavedToast: 'تم حفظ ملف المشغّل الأوروبي',
};

export function getCopy(locale: Locale): DppCopy {
  return locale === 'ar' ? AR_COPY : EN_COPY;
}

export function categoryLabel(category: BatteryCategory, locale: Locale): string {
  const labels: Record<BatteryCategory, { en: string; ar: string }> = {
    ev: { en: 'EV Traction Battery', ar: 'بطارية مركبة كهربائية (EV)' },
    lmt: { en: 'LMT Battery (E-Bike / Scooter)', ar: 'وسائل النقل الخفيفة (LMT)' },
    industrial_gt_2kwh: { en: 'Industrial Battery > 2 kWh (BESS)', ar: 'بطارية صناعية > 2 kWh (BESS)' },
    industrial_lte_2kwh: { en: 'Industrial Battery <= 2 kWh (Exempt)', ar: 'صناعية <= 2 kWh (مستثناة)' },
    portable: { en: 'Portable Battery (Exempt Art. 77)', ar: 'بطارية محمولة (مستثناة من الجواز)' },
  };
  return labels[category][locale];
}

export function readinessLabel(tier: PassportReadinessTier, locale: Locale): string {
  const map: Record<PassportReadinessTier, { en: string; ar: string }> = {
    ready: { en: 'Annex XIII Ready', ar: 'جاهز وفق الملحق XIII' },
    needs_work: { en: 'Needs Attention (2031 / Warnings)', ar: 'يحتاج استكمالاً / تنبيهات' },
    blocked: { en: 'Blocked for 2027 EU Launch', ar: 'محظور لطرح 2027' },
    exempt_from_full_dpp: { en: 'Exempt from Full Passport', ar: 'مستثنى من الجواز الكامل' },
  };
  return map[tier][locale];
}

export function carbonClassLabel(cls: CarbonPerformanceClass, locale: Locale): string {
  if (cls === 'unset') {
    return locale === 'ar' ? 'غير محددة' : 'Unset';
  }
  return locale === 'ar' ? `الفئة ${cls}` : `Class ${cls}`;
}

export function accessTierLabel(tier: AccessTier, locale: Locale): string {
  const map: Record<AccessTier, { en: string; ar: string }> = {
    public: { en: 'Public', ar: 'عام' },
    pli: { en: 'Legitimate Interest (PLI)', ar: 'ذوو المصلحة (PLI)' },
    authority: { en: 'Authority', ar: 'السلطات الرقابية' },
  };
  return map[tier][locale];
}

export function metalLabel(metal: 'cobalt' | 'lead' | 'lithium' | 'nickel', locale: Locale): string {
  const map = {
    cobalt: { en: 'Cobalt (Co)', ar: 'الكوبالت (Co)' },
    lead: { en: 'Lead (Pb)', ar: 'الرصاص (Pb)' },
    lithium: { en: 'Lithium (Li)', ar: 'الليثيوم (Li)' },
    nickel: { en: 'Nickel (Ni)', ar: 'النيكل (Ni)' },
  };
  return map[metal][locale];
}
