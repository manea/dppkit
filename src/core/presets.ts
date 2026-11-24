import { ANNEX_XIII_CONTROLS, defaultAnnexXiiiControls } from './dppRules.ts';
import type { DppPreset } from './types.ts';

const ALL_CONTROL_IDS = ANNEX_XIII_CONTROLS.map((c) => c.id);

export const DPP_PRESETS: DppPreset[] = [
  {
    id: 'ev-nmc-pack',
    labelEn: 'EV Traction Pack 82 kWh (NMC-811 — Complete)',
    labelAr: 'حزمة بطارية سيارة كهربائية 82 kWh (NMC-811 — جاهزة)',
    descriptionEn:
      'Complete Annex XIII EV battery passport with valid GTIN-14, verified carbon footprint Class B, 2031-compliant recycled shares, and PLI/Authority links.',
    descriptionAr:
      'جواز بطارية مركبة كهربائية مكتمل وفق الملحق XIII برقم GTIN-14 صحيح، وبصمة كربونية فئة B، ونسب تدوير مستوفية لحدود 2031، وروابط ذوي المصلحة والسلطات.',
    operator: {
      manufacturerName: 'NordVolt Cell Assembly AB',
      euResponsibleOperator: 'NordVolt Mobility GmbH (Munich)',
      operatorEoriOrVat: 'DE819204512',
      manufacturingPlantLocation: 'Skelleftea Plant 02',
      manufacturingCountry: 'SE',
      gs1Domain: 'https://id.nordvolt-example.eu',
      contactEmail: 'compliance@nordvolt-example.eu',
      declarationOfConformityRef: 'EU-DOC-EV82-2026-09',
      dueDiligenceReportUrl: 'https://nordvolt-example.eu/docs/oecd-dd-2026.pdf',
    },
    battery: {
      modelName: 'NV-EV82 Traction Battery Pack',
      modelIdentifier: 'NV-82K-NMC811-R2',
      gtin14: '04012345000115',
      serialNumber: 'NV2026SE0094812',
      batchNumber: 'B26W44',
      category: 'ev',
      chemistry: 'NMC',
      ratedCapacityKwh: 82,
      nominalVoltageV: 400,
      massKg: 465,
      manufacturingDateIso: '2026-10-18',
      expectedLifetimeCycles: 1800,
      dismantlingManualUrl: 'https://nordvolt-example.eu/pli/nv82-dismantle',
      sparePartsUrl: 'https://nordvolt-example.eu/pli/spare-parts',
      safetyAndEolUrl: 'https://nordvolt-example.eu/safety/eol-ev82',
    },
    sustainability: {
      carbonFootprintKgCo2PerKwh: 61.4,
      carbonClass: 'B',
      notifiedBodyId: 'NB-0123',
      recycledCobaltPct: 18.5,
      recycledLeadPct: null,
      recycledLithiumPct: 7.2,
      recycledNickelPct: 8.1,
      hazardousSubstancesNote: 'Electrolyte carbonate solvents inside sealed IP67 enclosure; no Cd/Hg above limits.',
    },
    telemetry: {
      stateOfHealthPct: 100,
      stateOfCertifiedEnergyPct: 100,
      remainingCapacityKwh: 82,
      fullChargeCyclesCompleted: 2,
      negativeEventsCount: 0,
      lastUpdatedIso: '2026-11-20T09:00:00Z',
    },
    controls: defaultAnnexXiiiControls(ALL_CONTROL_IDS),
  },
  {
    id: 'lmt-ebike-import',
    labelEn: 'LMT E-Bike Pack 0.72 kWh (Import Gaps — Blocked)',
    labelAr: 'بطارية دراجة كهربائية خفيفة 0.72 kWh (نواقص استيراد — متعثرة)',
    descriptionEn:
      'In-scope LMT e-bike battery failing Art. 77 launch readiness: invalid GTIN-14 check digit, missing carbon footprint, and missing dismantling manual.',
    descriptionAr:
      'بطارية دراجة خفيفة LMT مشمولة بالإلزام تتعثر بسبب خطأ خانة تدقيق GTIN-14 وغياب إعلان البصمة الكربونية ودليل التفكيك.',
    operator: {
      manufacturerName: 'Shenzhen VeloCell Tech Co.',
      euResponsibleOperator: 'EuroRide Imports B.V. (Rotterdam)',
      operatorEoriOrVat: 'NL854120987B01',
      manufacturingPlantLocation: 'Baoan Line B',
      manufacturingCountry: 'CN',
      gs1Domain: 'https://id.euroride-example.eu',
      contactEmail: 'quality@euroride-example.eu',
      declarationOfConformityRef: '',
      dueDiligenceReportUrl: '',
    },
    battery: {
      modelName: 'VeloPack 36V 20Ah Frame Battery',
      modelIdentifier: 'VP-3620-LMT',
      gtin14: '04012345000229',
      serialNumber: 'VP26LMT00018',
      batchNumber: 'LOT-26-09',
      category: 'lmt',
      chemistry: 'NMC',
      ratedCapacityKwh: 0.72,
      nominalVoltageV: 36,
      massKg: 4.1,
      manufacturingDateIso: '2026-09-12',
      expectedLifetimeCycles: 900,
      dismantlingManualUrl: '',
      sparePartsUrl: '',
      safetyAndEolUrl: 'https://euroride-example.eu/battery-waste',
    },
    sustainability: {
      carbonFootprintKgCo2PerKwh: null,
      carbonClass: 'unset',
      notifiedBodyId: '',
      recycledCobaltPct: 8,
      recycledLeadPct: null,
      recycledLithiumPct: null,
      recycledNickelPct: 3.5,
      hazardousSubstancesNote: 'Pending full REACH/RoHS declaration review.',
    },
    telemetry: {
      stateOfHealthPct: 99,
      stateOfCertifiedEnergyPct: null,
      remainingCapacityKwh: 0.71,
      fullChargeCyclesCompleted: 0,
      negativeEventsCount: 0,
      lastUpdatedIso: '2026-11-10T12:00:00Z',
    },
    controls: defaultAnnexXiiiControls(['annex13-operator-eori', 'annex13-eol-collection']),
  },
  {
    id: 'bess-industrial-lfp',
    labelEn: 'Industrial LFP BESS Rack 15.4 kWh (2031 Li Gap)',
    labelAr: 'وحدة تخزين طاقة صناعية LFP 15.4 kWh (فجوة ليثيوم 2031)',
    descriptionEn:
      'Industrial BESS (>2 kWh) using Cobalt-free LFP chemistry: Co/Ni targets do not apply, while Lithium recovered share (4.2%) flags the August 2031 gap.',
    descriptionAr:
      'بطارية تخزين صناعية أكبر من 2 kWh بكيمياء LFP خالية من الكوبالت والنيكل؛ تعفي Co/Ni وتنبه لفجوة نسبة الليثيوم (4.2% < 6%) قبل 2031.',
    operator: {
      manufacturerName: 'SolStorage Grid Systems GmbH',
      euResponsibleOperator: 'SolStorage Grid Systems GmbH (Stuttgart)',
      operatorEoriOrVat: 'DE312098744',
      manufacturingPlantLocation: 'Ulm BESS Assembly',
      manufacturingCountry: 'DE',
      gs1Domain: 'https://id.solstorage-example.eu',
      contactEmail: 'dpp@solstorage-example.eu',
      declarationOfConformityRef: 'EU-DOC-BESS15-2026-03',
      dueDiligenceReportUrl: 'https://solstorage-example.eu/esg/dd-2026.pdf',
    },
    battery: {
      modelName: 'GridRack 15.4 kWh 48V LFP',
      modelIdentifier: 'GR-154-LFP-R1',
      gtin14: '04012345000337',
      serialNumber: 'GR26DE44019',
      batchNumber: 'DE26Q4',
      category: 'industrial_gt_2kwh',
      chemistry: 'LFP',
      ratedCapacityKwh: 15.4,
      nominalVoltageV: 51.2,
      massKg: 138,
      manufacturingDateIso: '2026-11-02',
      expectedLifetimeCycles: 6000,
      dismantlingManualUrl: 'https://solstorage-example.eu/pli/gr154-manual',
      sparePartsUrl: 'https://solstorage-example.eu/pli/spares',
      safetyAndEolUrl: 'https://solstorage-example.eu/safety/bess-eol',
    },
    sustainability: {
      carbonFootprintKgCo2PerKwh: 54.8,
      carbonClass: 'A',
      notifiedBodyId: 'NB-0765',
      recycledCobaltPct: null,
      recycledLeadPct: null,
      recycledLithiumPct: 4.2,
      recycledNickelPct: null,
      hazardousSubstancesNote: 'LFP phosphate cathode free of cobalt and elemental lead.',
    },
    telemetry: {
      stateOfHealthPct: 100,
      stateOfCertifiedEnergyPct: 99.8,
      remainingCapacityKwh: 15.4,
      fullChargeCyclesCompleted: 4,
      negativeEventsCount: 0,
      lastUpdatedIso: '2026-11-22T08:30:00Z',
    },
    controls: defaultAnnexXiiiControls(ALL_CONTROL_IDS),
  },
];

export const SAMPLE_BATCH_CSV = `modelName,category,chemistry,ratedCapacityKwh,gtin14,serialNumber,carbonKgPerKwh,gs1Domain
"NV-EV82 Traction Pack",ev,NMC,82,04012345000115,NV2026SE0094812,61.4,https://id.nordvolt-example.eu
"VeloPack 36V LMT",lmt,NMC,0.72,04012345000229,VP26LMT00018,,https://id.euroride-example.eu
"GridRack 15.4 LFP",industrial_gt_2kwh,LFP,15.4,04012345000337,GR26DE44019,54.8,https://id.solstorage-example.eu
"MiniUPS 1.5 kWh Industrial",industrial_lte_2kwh,PbA,1.5,04012345000443,MU26PL0091,72.0,https://id.miniups-example.eu
"AA Rechargeable Portable Pack",portable,Other,0.015,04012345000559,PT26EU1024,,https://id.portacell-example.eu
`;
