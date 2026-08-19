/* ============================================================
   Regenerates the favicons and the og:image link-preview card.
   Run this after any change to the brand mark or the headline.

     npm install playwright-core
     node tools/render-brand-images.js

   Needs a Chromium binary. Either let playwright-core find one,
   or point CHROME_PATH at an existing install:

     CHROME_PATH=/path/to/chrome node tools/render-brand-images.js

   Writes into assets/brand/:
     favicon-32.png  favicon-180.png  favicon-192.png  favicon-512.png
     og-image.png
   ============================================================ */
const { chromium } = require('playwright-core');
const path = require('path');
const REPO = path.join(__dirname, '..');
const HERE = __dirname;

(async () => {
  // Use a system/pinned Chromium if one is set, otherwise let playwright find its own.
  const launchOpts = {
    args: ['--no-sandbox', '--force-color-profile=srgb', '--font-render-hinting=none']
  };
  if (process.env.CHROME_PATH) launchOpts.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launchOpts);

  // ---- og:image 1200x630 ----
  const p1 = await browser.newPage({ viewport: {width:1200,height:630}, deviceScaleFactor:1 });
  await p1.goto('file://' + path.join(HERE,'og-card.html'), { waitUntil:'networkidle' });
  try { await p1.evaluate(() => document.fonts.ready); } catch(e){}
  const fontOK = await p1.evaluate(() => document.fonts.check('40px "Fraunces"'));
  console.log('Fraunces loaded:', fontOK);
  await p1.waitForTimeout(600);
  await p1.screenshot({ path: path.join(REPO,'assets/brand/og-image.png') });
  console.log('og-image.png done');

  // ---- favicon PNGs from the SVG ----
  const svg = require('fs').readFileSync(path.join(REPO,'assets/brand/favicon.svg'),'utf8');
  for (const size of [32,180,192,512]) {
    const p = await browser.newPage({ viewport:{width:size,height:size}, deviceScaleFactor:1 });
    await p.setContent(`<style>*{margin:0;padding:0}html,body{width:${size}px;height:${size}px;overflow:hidden}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await p.waitForTimeout(120);
    await p.screenshot({ path: path.join(REPO,`assets/brand/favicon-${size}.png`), omitBackground:true });
    await p.close();
    console.log(`favicon-${size}.png done`);
  }

  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
