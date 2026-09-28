/* npm run extract

   Reads every data-cms* marker in the six pages and
   1. merges the HTML's current values into content/<page>.json and
      content/global.json, keeping any key that already has a value;
   2. regenerates the collections part of admin/config.yml, so the CMS
      has one field per key.

   Run it again after adding new markers to the HTML. */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { parse } from 'node-html-parser';
import { PAGES, bindings, defaultOf, fieldInfo, splitKey, getPath, setPath } from './cms-lib.mjs';

const PAGE_LABELS = {
  index: 'Home',
  'who-we-are': 'Who We Are',
  'our-space': 'Our Space',
  'services-and-plans': 'Services & Plans',
  faq: 'FAQ',
  contact: 'Contact',
  global: 'Every page (footer, contact details, scrolling words)',
};

// Group names that don't read well on their own.
const GROUP_LABELS = {
  index: { our_space: 'Our space banner', meet: 'Meet Gabriela', stories: 'Community stories' },
  'who-we-are': {
    next_chapter: 'Next chapter (first row)', next_chapter_2: 'Next chapter (second row)',
    closing: 'Closing call to action', gallery: 'Scrolling photo strip',
  },
  'our-space': {
    breathe: 'More time to focus on you', calm: 'Calm by design', consistency: 'Consistency is key',
    equipment: 'Essentials done right', rental: 'Private gym space rentals',
  },
  'services-and-plans': {
    memberships: 'Membership exclusives', group_popup: 'Semi-private group training popup',
    training_popup: 'Personal training popup', rental: 'Private gym rental',
    rental_popup: 'Private gym rental popup', trainers: 'Studio rental for personal trainers',
    trainers_popup: 'Studio rental for personal trainers popup', programs: 'Custom workout programs',
    programs_popup: 'Custom workout programs popup', hotel: 'Hotel guests', hotel_popup: 'Hotel guests popup',
  },
  faq: { header: 'Page header' },
  contact: { intro: 'Page header', info: 'Opening hours box', help: 'Need some help? box' },
  global: { contact: 'Contact details', social: 'Social media', marquee: 'Scrolling words', footer: 'Footer' },
};

const humanize = (name) => {
  const s = name.replace(/_/g, ' ');
  return s[0].toUpperCase() + s.slice(1);
};

function fieldLabel(name) {
  if (name === 'show') return 'Show this section';
  if (name.endsWith('_alt')) return `${humanize(name.slice(0, -4))} description (for screen readers)`;
  if (name.endsWith('_mobile')) return `${humanize(name.slice(0, -7))} (phones)`;
  return humanize(name);
}

/* ---------- collect ---------- */

const stores = { global: {} };
const order = { global: [] };
const info = { global: {} };
const seen = {};

for (const page of PAGES) {
  const root = parse(readFileSync(`${page}.html`, 'utf8'), { comment: true });
  stores[page] = {};
  order[page] = [];
  info[page] = {};
  const fi = fieldInfo(root);
  for (const b of bindings(root)) {
    const [scope, path] = splitKey(b.key);
    const store = scope === 'global' ? 'global' : page;
    const id = `${store}:${b.key}`;
    const value = defaultOf(b);
    if (!order[store].includes(b.key)) order[store].push(b.key);
    const f = (info[store][b.key] ??= { ...fi[b.key], kinds: new Set() });
    for (const k of fi[b.key].kinds) f.kinds.add(k);
    if (value === undefined) continue;
    if (id in seen && seen[id].value !== value) {
      throw new Error(`"${b.key}" has different values in ${seen[id].page}.html and ${page}.html:\n` +
        `  ${JSON.stringify(seen[id].value)}\n  ${JSON.stringify(value)}\nGive them separate keys.`);
    }
    seen[id] ??= { value, page };
    if (getPath(stores[store], path) === undefined) setPath(stores[store], path, value);
    if (typeof value === 'string' && value.includes('\n')) f.multiline = true;
    if (typeof value === 'string' && value.length > 80) f.long = true;
  }
}

/* ---------- content/*.json ---------- */

function merge(into, from) {
  for (const [k, v] of Object.entries(from)) {
    if (v && typeof v === 'object') merge((into[k] ??= {}), v);
    else if (into[k] === undefined) into[k] = v;
  }
  return into;
}

mkdirSync('content', { recursive: true });
let added = 0;
for (const name of Object.keys(stores)) {
  const file = `content/${name}.json`;
  const current = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const before = JSON.stringify(current);
  merge(current, stores[name]);
  if (JSON.stringify(current) !== before) added++;
  writeFileSync(file, JSON.stringify(current, null, 2) + '\n');
}

/* ---------- admin/config.yml ---------- */

function widgetFor(f) {
  const k = f.kinds;
  if (k.has('section')) return { widget: 'boolean', required: false };
  if (k.has('image')) {
    // Double small slots so photos stay sharp on high-density screens.
    const [w, h] = (f.size ?? '').split('×').map(Number);
    const scale = w && w < 800 ? 2 : 1;
    const size = w ? ` at least ${w * scale}×${h * scale} px, same shape as the current one,` : '';
    return { widget: 'image', hint: `Use a JPG or PNG${size} under 500 KB.` };
  }
  if (k.has('html')) {
    return { widget: 'markdown', modes: ['rich_text'], buttons: ['bold', 'italic', 'link', 'bulleted-list', 'numbered-list'], editor_components: [] };
  }
  if (k.has('text') && (f.heading || f.multiline || f.long)) {
    return { widget: 'text', hint: 'Press Enter to start a new line.' };
  }
  if (f.link) return { widget: 'string', hint: 'A page on this site (like contact.html) or a full web address.' };
  return { widget: 'string' };
}

function fieldsFor(store) {
  const groups = new Map();
  for (const key of order[store]) {
    const [, path] = splitKey(key);
    const [group, name] = path;
    if (!groups.has(group)) groups.set(group, []);
    const list = groups.get(group);
    const field = { label: fieldLabel(name), name, ...widgetFor(info[store][key]) };
    if (order[store].includes(`${store === 'global' ? 'global.' : ''}${group}.${name}_mobile`)) {
      field.hint = [field.hint, 'Shown on tablets and computers; phones use the "(phones)" field.'].filter(Boolean).join(' ');
    }
    if (name === 'show') list.unshift(field); else list.push(field);
  }
  // A "(phones)" field sits right after the field it stands in for.
  for (const fields of groups.values()) {
    for (const f of [...fields]) {
      if (!fields.some((x) => x.name + '_mobile' === f.name)) continue;
      fields.splice(fields.indexOf(f), 1);
      fields.splice(fields.findIndex((x) => x.name + '_mobile' === f.name) + 1, 0, f);
    }
  }
  return [...groups].map(([group, fields]) => ({
    label: GROUP_LABELS[store]?.[group] ?? humanize(group),
    name: group,
    widget: 'object',
    collapsed: true,
    fields,
  }));
}

const q = JSON.stringify;
const yamlField = (f, ind) => {
  if (f.widget !== 'object' && f.widget !== 'list') return `${ind}- ${q(f)}\n`;
  const { fields, ...rest } = f;
  let s = `${ind}- ` + Object.entries(rest).map(([k, v], i) => `${i ? ind + '  ' : ''}${k}: ${q(v)}`).join('\n') + '\n';
  s += `${ind}  fields:\n` + fields.map((c) => yamlField(c, ind + '    ')).join('');
  return s;
};

const files = [...PAGES, 'global'].map((store) => ({
  name: store.replace(/-/g, '_'), label: PAGE_LABELS[store], file: `content/${store}.json`, format: 'json', fields: fieldsFor(store),
}));
files.push({
  name: 'community_stories',
  label: 'Community stories (testimonials)',
  file: 'data/community-stories.json',
  format: 'json',
  fields: [{
    label: 'Stories', name: 'stories', widget: 'list', summary: '{{fields.name}}',
    hint: 'Shown on the Home and Who We Are pages, in this order.',
    fields: [
      { label: 'Name or Instagram handle', name: 'name', widget: 'string' },
      { label: 'Message', name: 'message', widget: 'text' },
    ],
  }],
});

let yaml = 'collections:\n  - name: "pages"\n    label: "Pages"\n    editor: {"preview": false}\n    files:\n';
for (const f of files) {
  yaml += `      - name: ${q(f.name)}\n        label: ${q(f.label)}\n        file: ${q(f.file)}\n        format: "json"\n        fields:\n`;
  yaml += f.fields.map((x) => yamlField(x, '          ')).join('');
}

const MARKER = '# ---- Everything below is generated by `npm run extract`. Edits here are overwritten. ----\n';
const CONFIG = 'admin/config.yml';
const head = existsSync(CONFIG) ? readFileSync(CONFIG, 'utf8').split(MARKER)[0] : '';
if (!head) throw new Error(`${CONFIG} is missing its hand-written top part`);
writeFileSync(CONFIG, head + MARKER + yaml);

console.log(`Content keys: ${Object.values(order).reduce((n, o) => n + o.length, 0)} across ${files.length - 1} files` +
  ` (${added} file${added === 1 ? '' : 's'} gained new keys). Updated ${CONFIG}.`);
