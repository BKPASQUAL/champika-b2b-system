import type { Browser } from "puppeteer";

let browserInstance: Browser | null = null;
let launching: Promise<Browser> | null = null;

async function launchBrowser(): Promise<Browser> {
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
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
  browser.on("disconnected", () => {
    browserInstance = null;
    launching = null;
  });
  return browser;
}

export async function getBrowser(): Promise<Browser> {
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
      return b;
    });
  }

  return launching;
}
