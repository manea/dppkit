import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BatteryCharging,
  Building2,
  CheckCircle2,
  Leaf,
  Save,
  Sparkles,
  Trash2,
  UserPlus,
  Wrench,
} from 'lucide-react';
import { computeGtinCheckDigit, isValidGtin14 } from '../core/gs1DigitalLink.ts';
import { DPP_PRESETS } from '../core/presets.ts';
import type {
  BatteryCategory,
  BatteryChemistry,
  BatteryTechnicalSpec,
  CarbonPerformanceClass,
  DynamicTelemetry,
  Locale,
  OperatorProfile,
  SustainabilityMetrics,
} from '../core/types.ts';
import type { OperatorProfileRecord, UiDppDossier } from '../lib/api.ts';
import { categoryLabel, carbonClassLabel, getCopy } from '../lib/i18n.ts';

interface PassportEditorPanelProps {
  dossier: UiDppDossier;
  locale: Locale;
  isLocked: boolean;
  isSaving: boolean;
  profiles: OperatorProfileRecord[];
  onLoadPreset: (presetId: string) => void;
  onUpdateFields: (patch: {
    operator?: OperatorProfile;
    battery?: BatteryTechnicalSpec;
    sustainability?: SustainabilityMetrics;
    telemetry?: DynamicTelemetry;
  }) => void;
  onSaveProfile: (name: string, profile: OperatorProfile) => void;
  onDeleteProfile: (id: string) => void;
}

const CATEGORIES: BatteryCategory[] = [
  'ev',
  'lmt',
  'industrial_gt_2kwh',
  'industrial_lte_2kwh',
  'portable',
];

const CHEMISTRIES: BatteryChemistry[] = ['NMC', 'LFP', 'NCA', 'LTO', 'PbA', 'Other'];
const CARBON_CLASSES: CarbonPerformanceClass[] = ['A', 'B', 'C', 'D', 'E', 'unset'];

function parseNum(raw: string, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function parseNullableNum(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function PassportEditorPanel({
  dossier,
  locale,
  isLocked,
  isSaving,
  profiles,
  onLoadPreset,
  onUpdateFields,
  onSaveProfile,
  onDeleteProfile,
}: PassportEditorPanelProps) {
  const copy = getCopy(locale);
  const [profileName, setProfileName] = useState('');

  const { operator, battery, sustainability, telemetry, summary } = dossier;
  const gtinValid = isValidGtin14(battery.gtin14);

  const cobaltRelevant = battery.chemistry === 'NMC' || battery.chemistry === 'NCA';
  const nickelRelevant = battery.chemistry === 'NMC' || battery.chemistry === 'NCA';
  const leadRelevant = battery.chemistry === 'PbA';
  const lithiumRelevant =
    battery.chemistry === 'NMC' ||
    battery.chemistry === 'LFP' ||
    battery.chemistry === 'NCA' ||
    battery.chemistry === 'LTO';

  function handleAutoFixGtin() {
    const digits = battery.gtin14.replace(/\D+/g, '').padStart(14, '0').slice(0, 14);
    const check = computeGtinCheckDigit(digits.slice(0, 13));
    if (check === null) return;
    onUpdateFields({
      battery: {
        ...battery,
        gtin14: `${digits.slice(0, 13)}${check}`,
      },
    });
  }

  return (
    <div className="space-y-6">
      {/* Presets & Saved Operator Profiles */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="dpp-card min-w-0 rounded-2xl p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="dpp-display flex items-center gap-2 text-sm font-bold">
              <Sparkles className="h-4 w-4 text-[var(--accent-primary)]" />
              {copy.presetsHeading}
            </h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {DPP_PRESETS.map((preset) => {
              const active = dossier.presetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  data-testid={`preset-${preset.id}`}
                  onClick={() => onLoadPreset(preset.id)}
                  className={`rounded-xl border px-3 py-2.5 text-start text-xs transition ${
                    active
                      ? 'border-[var(--accent-primary)] bg-[var(--bg-soft)] font-semibold'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] hover:border-[var(--accent-primary)]'
                  }`}
                >
                  <div className="line-clamp-2 font-semibold text-[var(--text-primary)]">
                    {locale === 'ar' ? preset.labelAr : preset.labelEn}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="dpp-card min-w-0 rounded-2xl p-4 sm:p-5">
          <h2 className="dpp-display mb-3 flex items-center gap-2 text-sm font-bold">
            <UserPlus className="h-4 w-4 text-[var(--accent-teal)]" />
            {copy.profilesHeading}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              dir="auto"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder={copy.profileNamePlaceholder}
              className="dpp-input min-w-0 flex-1 sm:max-w-xs"
            />
            <button
              type="button"
              onClick={() => {
                onSaveProfile(profileName.trim() || operator.manufacturerName, operator);
                setProfileName('');
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3.5 py-2 text-xs font-semibold text-[var(--accent-primary-fg)] hover:bg-[var(--accent-primary-hover)]"
            >
              <Save className="h-3.5 w-3.5" />
              {copy.saveProfileBtn}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {profiles.length === 0 ? (
              <span className="text-xs text-[var(--text-secondary)]">{copy.noProfilesText}</span>
            ) : (
              profiles.map((prof) => (
                <div
                  key={prof.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs"
                >
                  <span className="font-medium text-[var(--text-primary)]">{prof.name}</span>
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => onUpdateFields({ operator: prof.profile })}
                    className="font-semibold text-[var(--accent-primary)] hover:underline disabled:opacity-40"
                  >
                    {copy.applyProfileBtn}
                  </button>
                  <button
                    type="button"
                    aria-label={copy.deleteProfileBtn}
                    onClick={() => onDeleteProfile(prof.id)}
                    className="text-[var(--accent-crimson)] hover:opacity-80"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Section 1: Economic Operator */}
      <section className="dpp-card rounded-2xl p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="dpp-display flex items-center gap-2 text-base font-bold">
            <Building2 className="h-4 w-4 text-[var(--accent-primary)]" />
            {copy.sectionOperatorTitle}
          </h3>
          {isSaving && (
            <span className="rounded-full bg-[var(--bg-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--accent-primary)]">
              {copy.savingText}
            </span>
          )}
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.manufacturerName}</span>
            <input
              type="text"
              dir="auto"
              disabled={isLocked}
              className="dpp-input"
              value={operator.manufacturerName}
              onChange={(e) => onUpdateFields({ operator: { ...operator, manufacturerName: e.target.value } })}
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.euResponsibleOperator}</span>
            <input
              type="text"
              dir="auto"
              disabled={isLocked}
              className="dpp-input"
              value={operator.euResponsibleOperator}
              onChange={(e) =>
                onUpdateFields({ operator: { ...operator, euResponsibleOperator: e.target.value } })
              }
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.operatorEoriOrVat}</span>
            <input
              type="text"
              dir="ltr"
              disabled={isLocked}
              className="dpp-input dpp-mono"
              value={operator.operatorEoriOrVat}
              onChange={(e) =>
                onUpdateFields({ operator: { ...operator, operatorEoriOrVat: e.target.value } })
              }
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.manufacturingPlantLocation}</span>
            <input
              type="text"
              dir="auto"
              disabled={isLocked}
              className="dpp-input"
              value={operator.manufacturingPlantLocation}
              onChange={(e) =>
                onUpdateFields({
                  operator: { ...operator, manufacturingPlantLocation: e.target.value },
                })
              }
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.manufacturingCountry}</span>
            <input
              type="text"
              dir="ltr"
              maxLength={2}
              disabled={isLocked}
              className="dpp-input dpp-mono uppercase"
              value={operator.manufacturingCountry}
              onChange={(e) =>
                onUpdateFields({
                  operator: { ...operator, manufacturingCountry: e.target.value.toUpperCase() },
                })
              }
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.gs1Domain}</span>
            <input
              type="url"
              dir="ltr"
              disabled={isLocked}
              className="dpp-input dpp-mono"
              value={operator.gs1Domain}
              onChange={(e) => onUpdateFields({ operator: { ...operator, gs1Domain: e.target.value } })}
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.contactEmail}</span>
            <input
              type="email"
              dir="ltr"
              disabled={isLocked}
              className="dpp-input dpp-mono"
              value={operator.contactEmail}
              onChange={(e) => onUpdateFields({ operator: { ...operator, contactEmail: e.target.value } })}
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.declarationOfConformityRef}</span>
            <input
              type="text"
              dir="ltr"
              disabled={isLocked}
              className="dpp-input dpp-mono"
              value={operator.declarationOfConformityRef}
              onChange={(e) =>
                onUpdateFields({
                  operator: { ...operator, declarationOfConformityRef: e.target.value },
                })
              }
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.dueDiligenceReportUrl}</span>
            <input
              type="url"
              dir="ltr"
              disabled={isLocked}
              className="dpp-input dpp-mono"
              value={operator.dueDiligenceReportUrl}
              onChange={(e) =>
                onUpdateFields({ operator: { ...operator, dueDiligenceReportUrl: e.target.value } })
              }
            />
          </label>
        </div>
      </section>

      {/* Section 2: Battery Specs & Identifiers */}
      <section className="dpp-card rounded-2xl p-5">
        <h3 className="dpp-display mb-4 flex items-center gap-2 text-base font-bold">
          <BatteryCharging className="h-4 w-4 text-[var(--accent-teal)]" />
          {copy.sectionBatteryTitle}
        </h3>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.modelName}</span>
            <input
              type="text"
              dir="auto"
              disabled={isLocked}
              className="dpp-input"
              value={battery.modelName}
              onChange={(e) => onUpdateFields({ battery: { ...battery, modelName: e.target.value } })}
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.modelIdentifier}</span>
            <input
              type="text"
              dir="ltr"
              disabled={isLocked}
              className="dpp-input dpp-mono"
              value={battery.modelIdentifier}
              onChange={(e) => onUpdateFields({ battery: { ...battery, modelIdentifier: e.target.value } })}
            />
          </label>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-[var(--text-secondary)]">{copy.gtin14}</span>
              {!gtinValid && !isLocked && (
                <button
                  type="button"
                  data-testid="auto-fix-gtin-btn"
                  onClick={handleAutoFixGtin}
                  className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-amber-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent-amber)] hover:opacity-85"
                >
                  <Wrench className="h-3 w-3" />
                  {copy.autoFixGtinBtn}
                </button>
              )}
            </div>
            <input
              type="text"
              dir="ltr"
              disabled={isLocked}
              data-testid="gtin14-input"
              className={`dpp-input dpp-mono num-tabular ${
                gtinValid ? '' : 'border-[var(--accent-crimson)]'
              }`}
              value={battery.gtin14}
              onChange={(e) => onUpdateFields({ battery: { ...battery, gtin14: e.target.value } })}
            />
          </div>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.serialNumber}</span>
            <input
              type="text"
              dir="ltr"
              disabled={isLocked}
              className="dpp-input dpp-mono"
              value={battery.serialNumber}
              onChange={(e) => onUpdateFields({ battery: { ...battery, serialNumber: e.target.value } })}
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.batchNumber}</span>
            <input
              type="text"
              dir="ltr"
              disabled={isLocked}
              className="dpp-input dpp-mono"
              value={battery.batchNumber}
              onChange={(e) => onUpdateFields({ battery: { ...battery, batchNumber: e.target.value } })}
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.categoryLabel}</span>
            <select
              disabled={isLocked}
              className="dpp-input"
              value={battery.category}
              onChange={(e) =>
                onUpdateFields({
                  battery: { ...battery, category: e.target.value as BatteryCategory },
                })
              }
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {categoryLabel(cat, locale)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.chemistryLabel}</span>
            <select
              disabled={isLocked}
              className="dpp-input"
              value={battery.chemistry}
              onChange={(e) =>
                onUpdateFields({
                  battery: { ...battery, chemistry: e.target.value as BatteryChemistry },
                })
              }
            >
              {CHEMISTRIES.map((chem) => (
                <option key={chem} value={chem}>
                  {chem}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.ratedCapacityKwh}</span>
            <input
              type="number"
              step="0.01"
              dir="ltr"
              disabled={isLocked}
              className="dpp-input dpp-mono num-tabular"
              value={battery.ratedCapacityKwh}
              onChange={(e) =>
                onUpdateFields({
                  battery: {
                    ...battery,
                    ratedCapacityKwh: parseNum(e.target.value, battery.ratedCapacityKwh),
                  },
                })
              }
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.nominalVoltageV}</span>
            <input
              type="number"
              step="0.1"
              dir="ltr"
              disabled={isLocked}
              className="dpp-input dpp-mono num-tabular"
              value={battery.nominalVoltageV}
              onChange={(e) =>
                onUpdateFields({
                  battery: {
                    ...battery,
                    nominalVoltageV: parseNum(e.target.value, battery.nominalVoltageV),
                  },
                })
              }
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.massKg}</span>
            <input
              type="number"
              step="0.1"
              dir="ltr"
              disabled={isLocked}
              className="dpp-input dpp-mono num-tabular"
              value={battery.massKg}
              onChange={(e) =>
                onUpdateFields({
                  battery: { ...battery, massKg: parseNum(e.target.value, battery.massKg) },
                })
              }
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.manufacturingDateIso}</span>
            <input
              type="date"
              dir="ltr"
              disabled={isLocked}
              className="dpp-input dpp-mono"
              value={battery.manufacturingDateIso}
              onChange={(e) =>
                onUpdateFields({ battery: { ...battery, manufacturingDateIso: e.target.value } })
              }
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.expectedLifetimeCycles}</span>
            <input
              type="number"
              dir="ltr"
              disabled={isLocked}
              className="dpp-input dpp-mono num-tabular"
              value={battery.expectedLifetimeCycles}
              onChange={(e) =>
                onUpdateFields({
                  battery: {
                    ...battery,
                    expectedLifetimeCycles: parseNum(e.target.value, battery.expectedLifetimeCycles),
                  },
                })
              }
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.safetyAndEolUrl}</span>
            <input
              type="url"
              dir="ltr"
              disabled={isLocked}
              className="dpp-input dpp-mono"
              value={battery.safetyAndEolUrl}
              onChange={(e) =>
                onUpdateFields({ battery: { ...battery, safetyAndEolUrl: e.target.value } })
              }
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.dismantlingManualUrl}</span>
            <input
              type="url"
              dir="ltr"
              disabled={isLocked}
              className="dpp-input dpp-mono"
              value={battery.dismantlingManualUrl}
              onChange={(e) =>
                onUpdateFields({ battery: { ...battery, dismantlingManualUrl: e.target.value } })
              }
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.sparePartsUrl}</span>
            <input
              type="url"
              dir="ltr"
              disabled={isLocked}
              className="dpp-input dpp-mono"
              value={battery.sparePartsUrl}
              onChange={(e) => onUpdateFields({ battery: { ...battery, sparePartsUrl: e.target.value } })}
            />
          </label>
        </div>
      </section>

      {/* Section 3: Carbon & Recycled Content */}
      <section className="dpp-card rounded-2xl p-5">
        <h3 className="dpp-display mb-4 flex items-center gap-2 text-base font-bold">
          <Leaf className="h-4 w-4 text-[var(--accent-emerald)]" />
          {copy.sectionSustainabilityTitle}
        </h3>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.carbonFootprint}</span>
            <input
              type="number"
              step="0.1"
              dir="ltr"
              disabled={isLocked}
              className="dpp-input dpp-mono num-tabular"
              value={sustainability.carbonFootprintKgCo2PerKwh ?? ''}
              onChange={(e) =>
                onUpdateFields({
                  sustainability: {
                    ...sustainability,
                    carbonFootprintKgCo2PerKwh: parseNullableNum(e.target.value),
                  },
                })
              }
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.carbonClassLabel}</span>
            <select
              disabled={isLocked}
              className="dpp-input"
              value={sustainability.carbonClass}
              onChange={(e) =>
                onUpdateFields({
                  sustainability: {
                    ...sustainability,
                    carbonClass: e.target.value as CarbonPerformanceClass,
                  },
                })
              }
            >
              {CARBON_CLASSES.map((cls) => (
                <option key={cls} value={cls}>
                  {carbonClassLabel(cls, locale)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.notifiedBodyId}</span>
            <input
              type="text"
              dir="ltr"
              disabled={isLocked}
              className="dpp-input dpp-mono"
              value={sustainability.notifiedBodyId}
              onChange={(e) =>
                onUpdateFields({
                  sustainability: { ...sustainability, notifiedBodyId: e.target.value },
                })
              }
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.recycledCobaltPct}</span>
            <input
              type="number"
              step="0.1"
              dir="ltr"
              disabled={isLocked}
              placeholder={!cobaltRelevant ? copy.notApplicableChemNote : ''}
              className="dpp-input dpp-mono num-tabular"
              value={sustainability.recycledCobaltPct ?? ''}
              onChange={(e) =>
                onUpdateFields({
                  sustainability: {
                    ...sustainability,
                    recycledCobaltPct: parseNullableNum(e.target.value),
                  },
                })
              }
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.recycledLithiumPct}</span>
            <input
              type="number"
              step="0.1"
              dir="ltr"
              disabled={isLocked}
              placeholder={!lithiumRelevant ? copy.notApplicableChemNote : ''}
              className="dpp-input dpp-mono num-tabular"
              value={sustainability.recycledLithiumPct ?? ''}
              onChange={(e) =>
                onUpdateFields({
                  sustainability: {
                    ...sustainability,
                    recycledLithiumPct: parseNullableNum(e.target.value),
                  },
                })
              }
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.recycledNickelPct}</span>
            <input
              type="number"
              step="0.1"
              dir="ltr"
              disabled={isLocked}
              placeholder={!nickelRelevant ? copy.notApplicableChemNote : ''}
              className="dpp-input dpp-mono num-tabular"
              value={sustainability.recycledNickelPct ?? ''}
              onChange={(e) =>
                onUpdateFields({
                  sustainability: {
                    ...sustainability,
                    recycledNickelPct: parseNullableNum(e.target.value),
                  },
                })
              }
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.recycledLeadPct}</span>
            <input
              type="number"
              step="0.1"
              dir="ltr"
              disabled={isLocked}
              placeholder={!leadRelevant ? copy.notApplicableChemNote : ''}
              className="dpp-input dpp-mono num-tabular"
              value={sustainability.recycledLeadPct ?? ''}
              onChange={(e) =>
                onUpdateFields({
                  sustainability: {
                    ...sustainability,
                    recycledLeadPct: parseNullableNum(e.target.value),
                  },
                })
              }
            />
          </label>
          <label className="block space-y-1 text-xs sm:col-span-2">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.hazardousSubstancesNote}</span>
            <input
              type="text"
              dir="auto"
              disabled={isLocked}
              className="dpp-input"
              value={sustainability.hazardousSubstancesNote}
              onChange={(e) =>
                onUpdateFields({
                  sustainability: { ...sustainability, hazardousSubstancesNote: e.target.value },
                })
              }
            />
          </label>
        </div>
      </section>

      {/* Section 4: Dynamic BMS Telemetry */}
      <section className="dpp-card rounded-2xl p-5">
        <h3 className="dpp-display mb-4 text-base font-bold">{copy.sectionTelemetryTitle}</h3>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.stateOfHealthPct}</span>
            <input
              type="number"
              step="0.1"
              dir="ltr"
              disabled={isLocked}
              className="dpp-input dpp-mono num-tabular"
              value={telemetry.stateOfHealthPct ?? ''}
              onChange={(e) =>
                onUpdateFields({
                  telemetry: { ...telemetry, stateOfHealthPct: parseNullableNum(e.target.value) },
                })
              }
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.stateOfCertifiedEnergyPct}</span>
            <input
              type="number"
              step="0.1"
              dir="ltr"
              disabled={isLocked}
              className="dpp-input dpp-mono num-tabular"
              value={telemetry.stateOfCertifiedEnergyPct ?? ''}
              onChange={(e) =>
                onUpdateFields({
                  telemetry: {
                    ...telemetry,
                    stateOfCertifiedEnergyPct: parseNullableNum(e.target.value),
                  },
                })
              }
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.remainingCapacityKwh}</span>
            <input
              type="number"
              step="0.01"
              dir="ltr"
              disabled={isLocked}
              className="dpp-input dpp-mono num-tabular"
              value={telemetry.remainingCapacityKwh ?? ''}
              onChange={(e) =>
                onUpdateFields({
                  telemetry: {
                    ...telemetry,
                    remainingCapacityKwh: parseNullableNum(e.target.value),
                  },
                })
              }
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.fullChargeCyclesCompleted}</span>
            <input
              type="number"
              dir="ltr"
              disabled={isLocked}
              className="dpp-input dpp-mono num-tabular"
              value={telemetry.fullChargeCyclesCompleted ?? ''}
              onChange={(e) =>
                onUpdateFields({
                  telemetry: {
                    ...telemetry,
                    fullChargeCyclesCompleted: parseNullableNum(e.target.value),
                  },
                })
              }
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.negativeEventsCount}</span>
            <input
              type="number"
              dir="ltr"
              disabled={isLocked}
              className="dpp-input dpp-mono num-tabular"
              value={telemetry.negativeEventsCount ?? ''}
              onChange={(e) =>
                onUpdateFields({
                  telemetry: {
                    ...telemetry,
                    negativeEventsCount: parseNullableNum(e.target.value),
                  },
                })
              }
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">{copy.lastUpdatedIso}</span>
            <input
              type="text"
              dir="ltr"
              disabled={isLocked}
              className="dpp-input dpp-mono"
              value={telemetry.lastUpdatedIso}
              onChange={(e) =>
                onUpdateFields({ telemetry: { ...telemetry, lastUpdatedIso: e.target.value } })
              }
            />
          </label>
        </div>
      </section>

      {/* Live Findings */}
      <section className="dpp-card rounded-2xl p-5">
        <h3 className="dpp-display mb-4 text-base font-bold">{copy.findingsHeading}</h3>
        <div className="space-y-2.5" data-testid="findings-list">
          {summary.findings.map((finding) => {
            const palette =
              finding.severity === 'blocker'
                ? 'border-[var(--accent-crimson)] bg-[var(--accent-crimson-soft)]'
                : finding.severity === 'warning'
                  ? 'border-[var(--accent-amber)] bg-[var(--accent-amber-soft)]'
                  : 'border-[var(--accent-emerald)] bg-[var(--accent-emerald-soft)]';

            const Icon =
              finding.severity === 'blocker'
                ? AlertCircle
                : finding.severity === 'warning'
                  ? AlertTriangle
                  : CheckCircle2;

            const iconColor =
              finding.severity === 'blocker'
                ? 'text-[var(--accent-crimson)]'
                : finding.severity === 'warning'
                  ? 'text-[var(--accent-amber)]'
                  : 'text-[var(--accent-emerald)]';

            return (
              <div key={finding.id} className={`rounded-xl border p-3.5 ${palette}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} />
                    <div>
                      <div className="text-sm font-bold text-[var(--text-primary)]">
                        {locale === 'ar' ? finding.titleAr : finding.titleEn}
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {locale === 'ar' ? finding.detailAr : finding.detailEn}
                      </p>
                      <p className="mt-1 text-xs font-medium text-[var(--text-primary)]">
                        {locale === 'ar' ? finding.remediationAr : finding.remediationEn}
                      </p>
                    </div>
                  </div>
                  <span
                    dir="ltr"
                    className="dpp-mono shrink-0 rounded-md bg-[var(--bg-surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]"
                  >
                    {finding.articleRef}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
