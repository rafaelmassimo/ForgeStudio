/* npm run build

   Copies the site to dist/ and bakes content/*.json into the six pages:
   every data-cms* marker is applied (see scripts/cms-lib.mjs) and then
   stripped. A key missing from the JSON keeps the HTML's own content. */

import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import { basename } from 'node:path';
import { PAGES, renderPage, splitKey, getPath } from './cms-lib.mjs';

const OUT = 'dist';
const COPY = ['css', 'js', 'assets', 'data', 'admin', 'favicon.ico', 'robots.txt', 'sitemap.xml', 'site.webmanifest'];

const readJson = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {});

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const item of COPY) {
  if (existsSync(item)) cpSync(item, `${OUT}/${item}`, { recursive: true, filter: (src) => basename(src) !== '.DS_Store' });
}

const global = readJson('content/global.json');
for (const page of PAGES) {
  const content = readJson(`content/${page}.json`);
  const html = renderPage(readFileSync(`${page}.html`, 'utf8'), (key) => {
    const [scope, path] = splitKey(key);
    return getPath(scope === 'global' ? global : content, path);
  });
  if (html.includes('data-cms')) throw new Error(`${page}.html: a data-cms marker survived the build`);
  writeFileSync(`${OUT}/${page}.html`, html);
}

console.log(`Built ${PAGES.length} pages into ${OUT}/`);
