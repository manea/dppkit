import { MANDATORY_DISCLAIMER_AR, MANDATORY_DISCLAIMER_EN } from './dppRules.ts';
import type {
  DppDossier,
  Gs1DigitalLinkBuildInput,
  Gs1DigitalLinkResult,
  Locale,
} from './types.ts';

const SAFE_TOKEN_REGEX = /^[A-Za-z0-9._-]{1,40}$/;

/**
 * Compute GS1 Mod-10 check digit for a 13-digit GTIN-14 prefix (or any GS1 base digits).
 */
export function computeGtinCheckDigit(digits13: string): number | null {
  const clean = digits13.replace(/[\s-]+/g, '');
  if (!/^\d{13}$/.test(clean)) {
    return null;
  }

  let sum = 0;
  for (let i = 0; i < clean.length; i += 1) {
    const digit = Number(clean[i]);
    const weight = (clean.length - 1 - i) % 2 === 0 ? 3 : 1;
    sum += digit * weight;
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidGtin14(gtin: string): boolean {
  const clean = gtin.replace(/[\s-]+/g, '');
  if (!/^\d{14}$/.test(clean)) {
    return false;
  }
  const expected = computeGtinCheckDigit(clean.slice(0, 13));
  return expected !== null && expected === Number(clean[13]);
}

export function normalizeSafeHttpsBase(domainOrUrl: string): string | null {
  const raw = domainOrUrl.trim();
  if (!raw || /[\s?#]/.test(raw)) {
    return null;
  }
  if (/^(javascript|data|vbscript|file|http):/i.test(raw)) {
    return null;
  }

  const candidate = raw.includes('://') ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
      return null;
    }
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return null;
    }
    const cleanPath = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.origin}${cleanPath}`;
  } catch {
    return null;
  }
}

export function isSafeOptionalHttpsUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) {
    return true;
  }
  return normalizeSafeHttpsBase(trimmed) !== null;
}

export function buildGs1DigitalLink(input: Gs1DigitalLinkBuildInput): Gs1DigitalLinkResult {
  const cleanGtin = input.gtin14.replace(/[\s-]+/g, '');
  const serial = input.serialNumber.trim();
  const batch = (input.batchNumber ?? '').trim();
  const safeBase = normalizeSafeHttpsBase(input.gs1Domain);

  const expected = cleanGtin.length === 14 && /^\d{14}$/.test(cleanGtin)
    ? computeGtinCheckDigit(cleanGtin.slice(0, 13))
    : null;
  const actual = cleanGtin.length === 14 && /^\d{14}$/.test(cleanGtin)
    ? Number(cleanGtin[13])
    : null;

  if (!safeBase) {
    return {
      valid: false,
      gtin14: cleanGtin,
      gtinCheckDigitExpected: expected,
      gtinCheckDigitActual: actual,
      serialNumber: serial,
      batchNumber: batch,
      uri: '',
      error: 'GS1 resolver domain must use HTTPS without credentials, query, or script schemes.',
    };
  }

  if (expected === null || actual === null || expected !== actual) {
    return {
      valid: false,
      gtin14: cleanGtin,
      gtinCheckDigitExpected: expected,
      gtinCheckDigitActual: actual,
      serialNumber: serial,
      batchNumber: batch,
      uri: '',
      error: expected !== null
        ? `Invalid GTIN-14 check digit: expected ${expected}, got ${actual}.`
        : 'GTIN-14 must contain exactly 14 numeric digits.',
    };
  }

  if (serial.length < 3 || !SAFE_TOKEN_REGEX.test(serial)) {
    return {
      valid: false,
      gtin14: cleanGtin,
      gtinCheckDigitExpected: expected,
      gtinCheckDigitActual: actual,
      serialNumber: serial,
      batchNumber: batch,
      uri: '',
      error: 'Serial number (AI 21) must be 3–40 characters using [A-Za-z0-9._-].',
    };
  }

  if (batch && !SAFE_TOKEN_REGEX.test(batch)) {
    return {
      valid: false,
      gtin14: cleanGtin,
      gtinCheckDigitExpected: expected,
      gtinCheckDigitActual: actual,
      serialNumber: serial,
      batchNumber: batch,
      uri: '',
      error: 'Batch number (AI 10) must be 1–40 characters using [A-Za-z0-9._-].',
    };
  }

  const batchSegment = batch ? `/10/${encodeURIComponent(batch)}` : '';
  const uri = `${safeBase}/01/${cleanGtin}${batchSegment}/21/${encodeURIComponent(serial)}`;

  return {
    valid: true,
    gtin14: cleanGtin,
    gtinCheckDigitExpected: expected,
    gtinCheckDigitActual: actual,
    serialNumber: serial,
    batchNumber: batch,
    uri,
  };
}

export function parseGs1DigitalLink(uri: string): {
  valid: boolean;
  domain: string;
  gtin14: string;
  batchNumber: string;
  serialNumber: string;
  gtinValid: boolean;
} {
  try {
    const parsed = new URL(uri.trim());
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
      return { valid: false, domain: '', gtin14: '', batchNumber: '', serialNumber: '', gtinValid: false };
    }

    const segments = parsed.pathname.split('/').filter(Boolean).map((s) => decodeURIComponent(s));
    let gtin14 = '';
    let batchNumber = '';
    let serialNumber = '';

    for (let i = 0; i + 1 < segments.length; i += 2) {
      const ai = segments[i];
      const val = segments[i + 1];
      if (ai === '01') gtin14 = val;
      else if (ai === '10') batchNumber = val;
      else if (ai === '21') serialNumber = val;
    }

    const gtinValid = isValidGtin14(gtin14);
    const serialValid = serialNumber.length >= 3 && SAFE_TOKEN_REGEX.test(serialNumber);
    const batchValid = !batchNumber || SAFE_TOKEN_REGEX.test(batchNumber);
    const valid = gtinValid && serialValid && batchValid;

    return {
      valid,
      domain: parsed.origin,
      gtin14,
      batchNumber,
      serialNumber,
      gtinValid,
    };
  } catch {
    return { valid: false, domain: '', gtin14: '', batchNumber: '', serialNumber: '', gtinValid: false };
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildQrLabelHtmlSnippet(
  dossier: Pick<DppDossier, 'dossierCode' | 'operator' | 'battery' | 'sustainability' | 'summary' | 'digestHex'>,
  gs1Uri: string,
  locale: Locale = 'en',
): string {
  const safeHref = normalizeSafeHttpsBase(gs1Uri) ? escapeHtml(gs1Uri) : '#invalid-gs1-link';
  const disclaimer = locale === 'ar' ? MANDATORY_DISCLAIMER_AR : MANDATORY_DISCLAIMER_EN;
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const heading =
    locale === 'ar'
      ? `ملصق جواز البطارية الرقمي الأوروبي (${escapeHtml(dossier.dossierCode)})`
      : `EU Battery Passport Digital Link Label (${escapeHtml(dossier.dossierCode)})`;

  const jsonLdObj = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: dossier.battery.modelName,
    model: dossier.battery.modelIdentifier,
    gtin14: dossier.battery.gtin14,
    serialNumber: dossier.battery.serialNumber,
    category: `EU-2023-1542:${dossier.battery.category}`,
    manufacturer: {
      '@type': 'Organization',
      name: dossier.operator.manufacturerName,
    },
    url: normalizeSafeHttpsBase(gs1Uri) ? gs1Uri : undefined,
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'chemistry', value: dossier.battery.chemistry },
      { '@type': 'PropertyValue', name: 'ratedCapacityKwh', value: dossier.battery.ratedCapacityKwh },
      {
        '@type': 'PropertyValue',
        name: 'carbonFootprintKgCo2PerKwh',
        value: dossier.sustainability.carbonFootprintKgCo2PerKwh,
      },
      { '@type': 'PropertyValue', name: 'carbonClass', value: dossier.sustainability.carbonClass },
      { '@type': 'PropertyValue', name: 'euDocRef', value: dossier.operator.declarationOfConformityRef },
    ],
  };

  const safeJsonLd = JSON.stringify(jsonLdObj, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/-->/g, '--\\u003e');

  return `<article class="dppkit-qr-label" dir="${dir}" lang="${locale}">
  <header>
    <h2>${heading}</h2>
    <p><strong>${escapeHtml(dossier.battery.modelName)}</strong> (${escapeHtml(dossier.battery.modelIdentifier)})</p>
  </header>
  <dl>
    <dt>Manufacturer / EU Operator</dt>
    <dd>${escapeHtml(dossier.operator.manufacturerName)} — ${escapeHtml(dossier.operator.euResponsibleOperator)}</dd>
    <dt>GTIN-14 / Serial (ISO 15459)</dt>
    <dd>${escapeHtml(dossier.battery.gtin14)} / ${escapeHtml(dossier.battery.serialNumber)}</dd>
    <dt>Chemistry &amp; Rated Capacity</dt>
    <dd>${escapeHtml(dossier.battery.chemistry)} · ${escapeHtml(String(dossier.battery.ratedCapacityKwh))} kWh</dd>
    <dt>GS1 Digital Link</dt>
    <dd><a href="${safeHref}" rel="noopener noreferrer">${safeHref}</a></dd>
  </dl>
  <p class="dppkit-disclaimer"><small>${escapeHtml(disclaimer)}</small></p>
  <script type="application/ld+json">
${safeJsonLd}
  </script>
</article>`;
}
