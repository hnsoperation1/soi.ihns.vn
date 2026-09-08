import type { Browser } from 'playwright-core';
import type { Reservation } from './format';

export interface LookupResult {
  status: boolean;
  message: string;
  reservation: Reservation;
}

// IMPORTANT (verified 2026-09-08, local dev on Windows):
// - Must launch the real installed Chrome via `channel: 'chrome'`. Playwright's bundled
//   headless Chromium gets blocked at the network layer (request fails with net::ERR_FAILED
//   on the /reservations call, never reaching our response listener) — almost certainly
//   fingerprint-based bot detection in front of vietjet-api.vietjetair.com.
// - headless: true works fine with the real Chrome channel — the earlier failure was about
//   the browser binary, not about headless vs headed.
// - The real endpoint is `PATCH /booking/api/v1/reservations`, not `/checkin` as first
//   assumed from a quick DevTools glance.
//
// Vercel has no installed "real Chrome" to point `channel: 'chrome'` at, so on Vercel we
// fall back to @sparticuz/chromium (a serverless-packaged Chromium binary) via playwright-core.
// UNTESTED against Vietjet's bot detection — it is still a "packaged" Chromium binary, just a
// different build than Playwright's own, so it may or may not get blocked the same way. If it
// gets blocked, only this function needs to change (e.g. call out to an external worker that
// runs real Chrome) — format.ts and the UI don't know or care how the browser is launched.
async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    const chromium = (await import('@sparticuz/chromium')).default;
    const { chromium: playwrightChromium } = await import('playwright-core');
    return playwrightChromium.launch({
      executablePath: await chromium.executablePath(),
      args: [...chromium.args, '--disable-blink-features=AutomationControlled'],
      headless: true,
    });
  }

  const { chromium: playwrightChromium } = await import('playwright');
  return playwrightChromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
  });
}

export async function lookupBooking(
  code: string,
  lastName: string,
  firstName: string
): Promise<LookupResult> {
  const browser = await launchBrowser();

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 850 },
      locale: 'vi-VN',
    });
    const page = await context.newPage();

    const resultPromise = new Promise<LookupResult>((resolve, reject) => {
      page.on('response', async (res) => {
        const req = res.request();
        if (res.url().includes('/booking/api/v1/reservations') && req.method() === 'PATCH') {
          try {
            resolve(await res.json());
          } catch (e) {
            reject(e);
          }
        }
      });
    });

    await page.goto('https://www.vietjetair.com/vi/my/search-booking', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForTimeout(3000);

    // Dismiss the promo dialog + cookie banner; they can appear staggered.
    for (let i = 0; i < 8; i++) {
      let dismissedAny = false;
      for (const sel of ['button:has-text("Để sau")', 'button:has-text("Từ chối tất cả")']) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible().catch(() => false)) {
          await btn.click({ timeout: 1500 }).catch(() => {});
          dismissedAny = true;
          await page.waitForTimeout(500);
        }
      }
      const dialogCount = await page.locator('.MuiDialog-root').count();
      const cookieVisible = await page
        .locator('button:has-text("Từ chối tất cả")')
        .first()
        .isVisible()
        .catch(() => false);
      if (dialogCount === 0 && !cookieVisible) break;
      if (!dismissedAny) await page.waitForTimeout(500);
    }

    await page.fill('input[name="reservationLocator"]', code);
    await page.fill('input[name="passengerFamilyName"]', lastName);
    await page.fill('input[name="passengerMiddleGivenName"]', firstName);
    await page.click('button[type="submit"]:has-text("Tìm kiếm")');

    const timeoutPromise = new Promise<LookupResult>((_, reject) =>
      setTimeout(() => reject(new Error('Timed out waiting for Vietjet response (20s)')), 20000)
    );

    return await Promise.race([resultPromise, timeoutPromise]);
  } finally {
    await browser.close();
  }
}
