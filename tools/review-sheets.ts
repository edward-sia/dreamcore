import { readFileSync, existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { findChromium } from './browser.mjs';

const browser = await chromium.launch({ executablePath: findChromium(), headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1020 } });
const views = ['front', 'left', 'right', 'back'];
const groups = Array.from({ length: 5 }, (_, group) => ({
  name: `rooms-${group * 4 + 1}-${group * 4 + 4}`,
  rows: Array.from({ length: 4 }, (_, row) => [group * 4 + row + 1, 'night']),
}));
for (let id = 16; id <= 20; id++) groups.push({ name: `hours-${id}`, rows: ['night', 'morning', 'evening'].map(hour => [id, hour]) });
try {
  for (const group of groups) {
    const cells = group.rows.flatMap(([id, hour]) => views.map(view => {
      const name = `${String(id).padStart(2, '0')}-${hour}-${view}`;
      const path = `shots/review/${name}.png`;
      return existsSync(path) ? `<figure><figcaption>${name}</figcaption><img src="data:image/png;base64,${readFileSync(path).toString('base64')}"></figure>` : '';
    }));
    await page.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:#111;color:#eee;font:14px system-ui;display:grid;grid-template-columns:repeat(4,1fr)}figure{margin:0;padding:4px}img{width:100%}figcaption{height:22px}</style>${cells.join('')}`);
    await page.screenshot({ path: `shots/review/${group.name}.png`, fullPage: true });
  }
} finally { await browser.close(); }
