const IS_VERCEL = !!process.env.VERCEL;

// Local dev singleton — avoids Chromium cold-start on every request
let browserInstance: any = null;
let launching: Promise<any> | null = null;

async function launchBrowser(): Promise<any> {
  if (IS_VERCEL) {
    // @sparticuz/chromium provides a serverless-compatible Chromium binary
    const { default: chromium } = await import("@sparticuz/chromium");
    const { default: puppeteerCore } = await import("puppeteer-core");
    return puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless as any,
    });
  }

  // Local — use bundled Chromium from the full puppeteer package
  const { default: puppeteer } = await import("puppeteer");
  return puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
    ],
    timeout: 60000,
  });
}

export async function getBrowser(): Promise<any> {
  // Vercel: no persistent process between invocations, launch fresh each time
  if (IS_VERCEL) return launchBrowser();

  if (browserInstance) {
    try {
      await browserInstance.version();
      return browserInstance;
    } catch {
      browserInstance = null;
      launching = null;
    }
  }

  if (!launching) {
    launching = launchBrowser().then((b) => {
      browserInstance = b;
      launching = null;
      b.on("disconnected", () => {
        browserInstance = null;
        launching = null;
      });
      return b;
    });
  }

  return launching;
}
