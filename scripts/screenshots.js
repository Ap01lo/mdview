// scripts/screenshots.js
// Generates demo screenshots for the README using headless Chromium.
// Prereq: `mdview` running on http://127.0.0.1:4173 mounted at the project
// root (or any directory containing examples/sample.md).
//
// Usage:
//   1) Start mdview in another terminal:
//        node bin/mdview.js . --no-open --port 4173
//   2) Run this script:
//        node scripts/screenshots.js
//   3) Find PNGs under docs/screenshots/

const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const CHROME = [
  'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe',
  'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium-1140\\chrome-win\\chrome.exe',
  'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium-1200\\chrome-win64\\chrome.exe',
];
function findChrome() {
  for (const p of CHROME) if (fs.existsSync(p)) return p;
  throw new Error('no chrome binary found');
}

const OUT = path.join(__dirname, '..', 'docs', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

async function shoot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log('  saved', file);
}

async function goto(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: findChrome(),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('  [pageerror]', e.message));

  // ---------------- 1. main view: open sample.md ----------------
  await goto(page, 'http://127.0.0.1:4173/');
  // open examples/sample.md via the file tree
  await page.evaluate(async () => {
    const nodes = Array.from(document.querySelectorAll('.node.file'));
    const t = nodes.find(n => (n.querySelector('.name')||{}).textContent === 'sample.md');
    if (t) t.click();
  });
  await page.waitForTimeout(800);
  // scroll to top
  await page.evaluate(() => document.querySelector('#md-body').scrollTop = 0);
  await page.waitForTimeout(200);
  await shoot(page, 'screenshot-main.png');

  // ---------------- 2. settings panel open ----------------
  await page.evaluate(() => document.querySelector('#md-body').scrollTop = 0);
  await page.click('#settings-btn');
  await page.waitForTimeout(500);
  await shoot(page, 'screenshot-settings.png');
  // close settings
  await page.evaluate(() => document.querySelector('#settings-panel').classList.add('hidden'));

  // ---------------- 3. LaTeX section close-up ----------------
  await page.evaluate(() => {
    const h = Array.from(document.querySelectorAll('#md-body h2'))
      .find(n => n.textContent.includes('LaTeX'));
    if (h) h.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(300);
  await shoot(page, 'screenshot-latex.png');

  // ---------------- 4. table section close-up ----------------
  await page.evaluate(() => {
    const h = Array.from(document.querySelectorAll('#md-body h2'))
      .find(n => n.textContent.includes('三线表'));
    if (h) h.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(300);
  await shoot(page, 'screenshot-table.png');

  // ---------------- 5. themes comparison ----------------
  // Switch back to github-dark
  await page.evaluate(() => document.querySelector('#md-body').scrollTop = 0);
  await page.waitForTimeout(200);
  await shoot(page, 'theme-github-dark.png');

  // Switch theme via localStorage and reload
  for (const theme of ['github-light', 'serif-light', 'noir']) {
    await page.evaluate((id) => {
      localStorage.setItem('mdview.theme', id);
    }, theme);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    // re-open the sample file
    await page.evaluate(async () => {
      const nodes = Array.from(document.querySelectorAll('.node.file'));
      const t = nodes.find(n => (n.querySelector('.name')||{}).textContent === 'sample.md');
      if (t) t.click();
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => document.querySelector('#md-body').scrollTop = 0);
    await page.waitForTimeout(200);
    await shoot(page, `theme-${theme}.png`);
  }

  // ---------------- 6. demo.gif (record a short walkthrough) ----------------
  // Reset theme to github-dark
  await page.evaluate(() => {
    localStorage.setItem('mdview.theme', 'github-dark');
    localStorage.removeItem('mdview.directory');
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Open sample.md
  await page.evaluate(async () => {
    const nodes = Array.from(document.querySelectorAll('.node.file'));
    const t = nodes.find(n => (n.querySelector('.name')||{}).textContent === 'sample.md');
    if (t) t.click();
  });
  await page.waitForTimeout(700);

  // Build the gif by capturing each step
  const framesDir = path.join(OUT, 'frames');
  fs.mkdirSync(framesDir, { recursive: true });

  async function snap(name) {
    const f = path.join(framesDir, name);
    await page.screenshot({ path: f });
    return f;
  }
  const step = async (name, fn, dwell = 700) => {
    await fn();
    await page.waitForTimeout(dwell);
    await snap(name);
  };

  const frameFiles = [];
  frameFiles.push(await snap('00-start.png'));

  await step('01-scroll-math.png', async () => {
    await page.evaluate(() => {
      const h = Array.from(document.querySelectorAll('#md-body h2'))
        .find(n => n.textContent.includes('LaTeX'));
      if (h) h.scrollIntoView({ block: 'start' });
    });
  });

  await step('02-scroll-table.png', async () => {
    await page.evaluate(() => {
      const h = Array.from(document.querySelectorAll('#md-body h2'))
        .find(n => n.textContent.includes('三线表'));
      if (h) h.scrollIntoView({ block: 'start' });
    });
  });

  await step('03-scroll-top.png', async () => {
    await page.evaluate(() => document.querySelector('#md-body').scrollTop = 0);
  });

  await step('04-open-settings.png', async () => {
    // first make sure it's closed
    await page.evaluate(() => {
      document.querySelector('#settings-panel').classList.add('hidden');
    });
    await page.waitForTimeout(200);
    await page.click('#settings-btn');
  }, 900);

  await step('05-close-settings.png', async () => {
    // close via the close button (avoid panel intercepting)
    await page.evaluate(() => {
      document.querySelector('#settings-panel').classList.add('hidden');
    });
    await page.waitForTimeout(300);
  });

  await step('06-collapse-sidebar.png', async () => {
    await page.click('#toggle-tree');
  }, 700);

  await step('07-expand-sidebar.png', async () => {
    await page.click('#toggle-tree');
  }, 700);

  await step('08-theme-serif.png', async () => {
    // The theme-select only exists when settings panel is open.
    // Re-open it via the API rather than clicking (avoids flakiness).
    await page.evaluate(() => {
      localStorage.setItem('mdview.theme', 'serif-light');
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await page.evaluate(async () => {
      const nodes = Array.from(document.querySelectorAll('.node.file'));
      const t = nodes.find(n => (n.querySelector('.name')||{}).textContent === 'sample.md');
      if (t) t.click();
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => document.querySelector('#md-body').scrollTop = 0);
  }, 900);

  frameFiles.push(await snap('09-end.png'));

  console.log('frames:', framesDir);

  await browser.close();
  console.log('DONE. Run: ffmpeg -framerate 1 -i docs/screenshots/frames/%02d-*.png -vf "palettegen" ...');
})();