import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

async function assertNoHorizontalOverflow(page: Page) {
  const dims = await page.evaluate(() => {
    const main = document.querySelector('main');
    const header = document.querySelector('header');
    const mainRect = main?.getBoundingClientRect();
    const headerRect = header?.getBoundingClientRect();
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      mainWidth: mainRect ? Math.ceil(mainRect.width) : 0,
      headerWidth: headerRect ? Math.ceil(headerRect.width) : 0,
    };
  });
  expect(dims.scrollWidth).toBeLessThanOrEqual(dims.innerWidth);
  expect(dims.mainWidth).toBeLessThanOrEqual(dims.innerWidth);
  expect(dims.headerWidth).toBeLessThanOrEqual(dims.innerWidth);
}

test.describe('DPPKit — EU Battery Passport Studio E2E', () => {
  test('defaults to EN LTR / Voltaic Ivory, toggles AR RTL / Graphite Cell Dark, and persists across reload', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await expect(page.getByTestId('storage-mode-badge')).toContainText('SQLite WAL Server');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'voltaic-ivory');
    await expect(page.getByTestId('mandatory-legal-disclaimer')).toContainText('NOT legal counsel');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/01-workspace-en-ivory.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.getByTestId('lang-toggle').click();
    await page.getByTestId('theme-toggle').click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'graphite-cell');
    await expect(page.getByTestId('mandatory-legal-disclaimer')).toContainText('ليست استشارة قانونية');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/02-workspace-ar-graphite.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.reload();
    await expect(page.getByTestId('storage-mode-badge')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'graphite-cell');

    // Restore defaults cleanly
    await page.getByTestId('lang-toggle').click();
    await page.getByTestId('theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'voltaic-ivory');

    expect(errors).toEqual([]);
  });

  test('fixes GTIN-14 check digit, inspects GS1 QR & 3-tier isolation, runs BOM CSV batch download, seals DPP-YYYY-0001, and verifies public route', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const year = new Date().getUTCFullYear();
    const expectedCode = `DPP-${year}-0001`;

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.getByTestId('kpi-overall-score')).toHaveText('100%');

    // 1. Load blocked LMT preset and use 1-click Auto-Fix GTIN Check Digit
    await page.getByTestId('preset-lmt-ebike-import').click();
    await expect(page.getByTestId('gtin14-input')).toHaveValue('04012345000229');
    await page.getByTestId('auto-fix-gtin-btn').click();
    await expect(page.getByTestId('gtin14-input')).toHaveValue('04012345000221');

    // 2. Load ready EV NMC preset and capture desktop screenshot
    await page.getByTestId('preset-ev-nmc-pack').click();
    await expect(page.getByTestId('kpi-overall-score')).toHaveText('100%');
    await expect(page.getByTestId('gtin14-input')).toHaveValue('04012345000115');

    await page.screenshot({
      path: 'test-results/qa-screenshots/03-builder-ev-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });

    // 3. Verify 3-Tier JSON-LD Isolation & QR image
    await page.getByTestId('tab-tiers').click();
    await expect(page.getByTestId('gs1-qr-image')).toBeVisible();
    await expect(page.getByTestId('gs1-uri-text')).toContainText('04012345000115');

    const publicJson = await page.getByTestId('tier-jsonld-preview').textContent();
    expect(publicJson).toContain('"accessTier": "public"');
    expect(publicJson).not.toContain('stateOfHealthPct');
    expect(publicJson).not.toContain('notifiedBodyId');

    await page.getByTestId('tier-tab-pli').click();
    const pliJson = await page.getByTestId('tier-jsonld-preview').textContent();
    expect(pliJson).toContain('stateOfHealthPct');
    expect(pliJson).not.toContain('notifiedBodyId');

    await page.getByTestId('tier-tab-authority').click();
    const authJson = await page.getByTestId('tier-jsonld-preview').textContent();
    expect(authJson).toContain('NB-0123');

    // 4. Verify Fleet Batch CSV Audit & BOM download
    await page.getByTestId('tab-batch').click();
    await page.getByTestId('run-batch-csv-btn').click();
    const table = page.getByTestId('csv-results-table');
    await expect(table).toContainText('NV-EV82 Traction Pack');
    await expect(table).toContainText('VeloPack 36V LMT');
    await expect(table).toContainText('GridRack 15.4 LFP');
    await expect(table).toContainText('MiniUPS 1.5 kWh Industrial');
    await expect(table).toContainText('AA Rechargeable Portable Pack');

    const dlPromise = page.waitForEvent('download');
    await page.getByTestId('download-batch-csv-btn').click();
    const csvDownload = await dlPromise;
    expect(csvDownload.suggestedFilename()).toContain('.csv');
    const dlPath = await csvDownload.path();
    expect(dlPath).toBeTruthy();
    if (dlPath) {
      const bytes = fs.readFileSync(dlPath);
      expect(bytes[0]).toBe(0xef);
      expect(bytes[1]).toBe(0xbb);
      expect(bytes[2]).toBe(0xbf);
    }

    // 5. Finalize & seal DPP-YYYY-0001 with SHA-256 and inspect public share route
    await page.getByTestId('tab-dossier').click();
    await page.getByTestId('finalize-dossier-btn').click();
    await expect(page.getByTestId('dossier-code-badge')).toHaveText(expectedCode);
    await expect(page.getByTestId('dossier-sha256-digest')).toHaveText(/^[0-9a-f]{64}$/);
    await expect(page.getByTestId('finalize-dossier-btn')).toHaveCount(0);
    await expect(page.getByTestId('duplicate-dossier-btn')).toBeVisible();

    await page.screenshot({
      path: 'test-results/qa-screenshots/04-sealed-dossier-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.getByTestId('open-public-brief-btn').click();
    await expect(page).toHaveURL(new RegExp(`/r/${expectedCode}$`));
    await expect(page.getByTestId('dossier-sha256-digest')).toHaveText(/^[0-9a-f]{64}$/);
    await expect(page.getByTestId('public-view-count')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('dossier-sha256-digest')).toHaveText(/^[0-9a-f]{64}$/);

    await page.getByTestId('back-to-studio-btn').click();
    await expect(page).toHaveURL(/\/$/);

    expect(errors).toEqual([]);
  });

  test('verifies mobile 390x844 responsiveness across all tabs in EN light and AR dark with zero horizontal overflow', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByTestId('kpi-overall-score')).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/05-mobile-en-ivory.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.getByTestId('tab-tiers').click();
    await expect(page.getByTestId('gs1-qr-image')).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.getByTestId('tab-batch').click();
    await page.getByTestId('run-batch-csv-btn').click();
    await expect(page.getByTestId('csv-results-table')).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.getByTestId('tab-dossier').click();
    await expect(page.getByTestId('printable-dossier')).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.getByTestId('tab-builder').click();
    await page.getByTestId('lang-toggle').click();
    await page.getByTestId('theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'graphite-cell');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/06-mobile-ar-graphite.png',
      fullPage: true,
      animations: 'disabled',
    });

    expect(errors).toEqual([]);
  });
});
