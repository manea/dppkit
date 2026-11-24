export type Locale = 'en' | 'ar';

export type BatteryCategory =
  | 'ev'
  | 'lmt'
  | 'industrial_gt_2kwh'
  | 'industrial_lte_2kwh'
  | 'portable';

export type BatteryChemistry = 'NMC' | 'LFP' | 'NCA' | 'LTO' | 'PbA' | 'Other';

export type AccessTier = 'public' | 'pli' | 'authority';

export type CarbonPerformanceClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'unset';

export type PassportReadinessTier =
  | 'ready'
  | 'needs_work'
  | 'blocked'
  | 'exempt_from_full_dpp';

export type FindingSeverity = 'blocker' | 'warning' | 'pass';

export type FindingScope =
  | 'scope'
  | 'identification'
  | 'carbon'
  | 'recycled'
  | 'telemetry'
  | 'circularity';

export interface OperatorProfile {
  manufacturerName: string;
  euResponsibleOperator: string;
  operatorEoriOrVat: string;
  manufacturingPlantLocation: string;
  manufacturingCountry: string;
  gs1Domain: string;
  contactEmail: string;
  declarationOfConformityRef: string;
  dueDiligenceReportUrl: string;
}

export interface BatteryTechnicalSpec {
  modelName: string;
  modelIdentifier: string;
  gtin14: string;
  serialNumber: string;
  batchNumber: string;
  category: BatteryCategory;
  chemistry: BatteryChemistry;
  ratedCapacityKwh: number;
  nominalVoltageV: number;
  massKg: number;
  manufacturingDateIso: string;
  expectedLifetimeCycles: number;
  dismantlingManualUrl: string;
  sparePartsUrl: string;
  safetyAndEolUrl: string;
}

export interface SustainabilityMetrics {
  carbonFootprintKgCo2PerKwh: number | null;
  carbonClass: CarbonPerformanceClass;
  notifiedBodyId: string;
  recycledCobaltPct: number | null;
  recycledLeadPct: number | null;
  recycledLithiumPct: number | null;
  recycledNickelPct: number | null;
  hazardousSubstancesNote: string;
}

export interface DynamicTelemetry {
  stateOfHealthPct: number | null;
  stateOfCertifiedEnergyPct: number | null;
  remainingCapacityKwh: number | null;
  fullChargeCyclesCompleted: number | null;
  negativeEventsCount: number | null;
  lastUpdatedIso: string;
}

export interface AnnexXiiiControlState {
  id: string;
  completed: boolean;
  evidenceNote?: string;
}

export interface DppAuditInput {
  presetId?: string;
  operator: OperatorProfile;
  battery: BatteryTechnicalSpec;
  sustainability: SustainabilityMetrics;
  telemetry: DynamicTelemetry;
  controls: AnnexXiiiControlState[];
  referenceDateIso?: string;
}

export interface PassportFinding {
  id: string;
  scope: FindingScope;
  severity: FindingSeverity;
  articleRef: string;
  titleEn: string;
  titleAr: string;
  detailEn: string;
  detailAr: string;
  remediationEn: string;
  remediationAr: string;
}

export interface RecycledContentTargetResult {
  metal: 'cobalt' | 'lead' | 'lithium' | 'nickel';
  applicable: boolean;
  declaredPct: number | null;
  target2031Pct: number;
  target2036Pct: number;
  meets2031: boolean;
  meets2036: boolean;
}

export interface DppAuditSummary {
  passportMandatory: boolean;
  daysUntilFeb2027Deadline: number;
  deadlineIso: string;
  overallScore: number;
  identificationScore: number;
  sustainabilityScore: number;
  circularityScore: number;
  readinessTier: PassportReadinessTier;
  blockersCount: number;
  warningsCount: number;
  completedControlsCount: number;
  totalControlsCount: number;
  gs1DigitalLinkUri: string;
  gtinValid: boolean;
  recycledResults: RecycledContentTargetResult[];
  findings: PassportFinding[];
}

export interface TieredPassportExport {
  public: Record<string, unknown>;
  pli: Record<string, unknown>;
  authority: Record<string, unknown>;
}

export interface Gs1DigitalLinkBuildInput {
  gs1Domain: string;
  gtin14: string;
  serialNumber: string;
  batchNumber?: string;
}

export interface Gs1DigitalLinkResult {
  valid: boolean;
  gtin14: string;
  gtinCheckDigitExpected: number | null;
  gtinCheckDigitActual: number | null;
  serialNumber: string;
  batchNumber: string;
  uri: string;
  error?: string;
}

export interface BatchBatteryRow {
  rowNumber: number;
  modelName: string;
  category: BatteryCategory;
  chemistry: BatteryChemistry;
  ratedCapacityKwh: number;
  gtin14: string;
  serialNumber: string;
  carbonKgPerKwh: number | null;
  passportMandatory: boolean;
  gtinValid: boolean;
  gs1Uri: string;
  status: PassportReadinessTier;
  issues: string[];
}

export interface BatchAuditResult {
  totalRows: number;
  inScopeCount: number;
  readyCount: number;
  blockedCount: number;
  exemptCount: number;
  rows: BatchBatteryRow[];
}

export interface DppDossier {
  id: string;
  slug?: string;
  status?: 'draft' | 'locked';
  createdAt?: string;
  dossierCode: string;
  presetId: string;
  operator: OperatorProfile;
  battery: BatteryTechnicalSpec;
  sustainability: SustainabilityMetrics;
  telemetry: DynamicTelemetry;
  controls: AnnexXiiiControlState[];
  summary: DppAuditSummary;
  digestHex: string;
  sealedAtIso: string;
  updatedAtIso: string;
}

export interface DppPreset {
  id: string;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
  operator: OperatorProfile;
  battery: BatteryTechnicalSpec;
  sustainability: SustainabilityMetrics;
  telemetry: DynamicTelemetry;
  controls: AnnexXiiiControlState[];
}
