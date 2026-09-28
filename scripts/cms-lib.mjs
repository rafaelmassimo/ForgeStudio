/* Shared logic for scripts/extract.mjs and scripts/build.mjs.

   Editable content is marked in the page HTML with data-cms* attributes.
   Each one binds a key ("group.field", or "global.group.field" for
   content shared by every page) to part of the element:

     data-cms="k"          the element's leading text; line breaks in the
                           value become the element's own <br> markup
     data-cms-html="k"     the element's <p>/<ul>/<ol> children, edited as
                           markdown (marked children and anything else,
                           such as buttons, are left alone)
     data-cms-img="k"      src (srcset on <source>, href on a preload
                           <link>); a non-empty alt is
                           bound to "k_alt"
     data-cms-href="k"     href
     data-cms-attr="a=k"   any attribute; comma-separated pairs, and the
                           value can wrap the key in a template, e.g.
                           "href=mailto:{global.contact.email}". A filter
                           after "|" transforms it: tel, url
     data-cms-section="n"  bound to "n.show": false removes the element.
                           On a <template> the default is false (hidden)
                           and true unwraps its contents into the page.

   The HTML's current content is the default. Build only rewrites a spot
   when the stored value differs from that default, so an untouched page
   builds byte-for-byte identical apart from the stripped attributes. */

import { parse } from 'node-html-parser';

export const PAGES = ['index', 'who-we-are', 'our-space', 'services-and-plans', 'faq', 'contact'];

const MARKER_SELECTOR = ['data-cms', 'data-cms-html', 'data-cms-img', 'data-cms-href', 'data-cms-attr', 'data-cms-section']
  .map((a) => `[${a}]`).join(',');
const MARKER_ATTR_RE = /\s+data-cms(?:-[a-z]+)?="[^"]*"/g;
const KEY_RE = /^(global\.)?[a-z0-9_]+\.[a-z0-9_]+$/;
const TEXT = 3;
const ELEMENT = 1;

/* ---------- key/value helpers ---------- */

export function splitKey(key) {
  if (!KEY_RE.test(key)) throw new Error(`Bad content key "${key}" (expected group.field or global.group.field)`);
  return key.startsWith('global.') ? ['global', key.slice(7).split('.')] : ['page', key.split('.')];
}

export function getPath(obj, path) {
  return path.reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
}

export function setPath(obj, path, value) {
  let o = obj;
  for (const k of path.slice(0, -1)) o = o[k] ??= {};
  o[path.at(-1)] = value;
}

const escapeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s) => escapeText(s).replace(/"/g, '&quot;');
const collapse = (s) => s.replace(/\s*\n\s*/g, ' ');
const normText = (s) => s.replace(/\r/g, '').split('\n').map((l) => l.trim()).join('\n').trim();

/* Site images are stored as root paths (/assets/...) so the CMS can
   preview them, and written back relative like the rest of the HTML. */
const toStoredPath = (src) => (/^([a-z]+:|\/)/i.test(src) ? src : '/' + src);
const toPagePath = (src) => (src.startsWith('/') && !src.startsWith('//') ? src.slice(1) : src);

const FILTERS = {
  tel(v) {
    const d = v.replace(/\D/g, '');
    return d.length === 10 ? '+1' + d : '+' + d;
  },
  url: (v) => encodeURIComponent(v).replace(/%20/g, '+'),
};

/* ---------- text ---------- */

// The leading run of text and <br> nodes; a trailing element such as the
// hero's "." span or a button icon stays put.
function textRun(el) {
  const run = [];
  for (const n of el.childNodes) {
    if (n.nodeType === TEXT || (n.nodeType === ELEMENT && n.rawTagName.toLowerCase() === 'br')) run.push(n);
    else break;
  }
  return run;
}

function textDefault(el) {
  const segs = [''];
  for (const n of textRun(el)) {
    if (n.nodeType === TEXT) segs[segs.length - 1] += n.text;
    else segs.push('');
  }
  return segs.map((s) => collapse(s).trim()).join('\n').trim();
}

/* ---------- markdown ---------- */

const escapeMd = (s) => s.replace(/([\\`*_[\]])/g, '\\$1');

function inlineToMd(node) {
  return node.childNodes.map((n) => {
    if (n.nodeType === TEXT) return escapeMd(n.text);
    if (n.nodeType !== ELEMENT) return '';
    const tag = n.rawTagName.toLowerCase();
    if (tag === 'br') return '\u0000';
    if (tag === 'strong' || tag === 'b') return `**${inlineToMd(n)}**`;
    if (tag === 'em' || tag === 'i') return `*${inlineToMd(n)}*`;
    if (tag === 'a') return `[${inlineToMd(n)}](${n.getAttribute('href')})`;
    throw new Error(`<${tag}> inside a data-cms-html block can't be edited as markdown`);
  }).join('');
}

const cleanInline = (md) => collapse(md).trim().replace(/\s*\u0000\s*/g, '\n');

function isManaged(n) {
  return n.nodeType === ELEMENT && /^(p|ul|ol)$/i.test(n.rawTagName) &&
    !Object.keys(n.attributes).some((a) => a.startsWith('data-cms'));
}

function managedBlocks(el) {
  const blocks = el.childNodes.filter(isManaged);
  if (blocks.length) {
    const first = el.childNodes.indexOf(blocks[0]);
    const last = el.childNodes.indexOf(blocks.at(-1));
    const gap = el.childNodes.slice(first, last + 1).find((n) => n.nodeType === ELEMENT && !isManaged(n));
    if (gap) throw new Error(`data-cms-html block has a <${gap.rawTagName}> between its paragraphs`);
  }
  return blocks;
}

function htmlDefault(el) {
  return managedBlocks(el).map((b) => {
    const tag = b.rawTagName.toLowerCase();
    if (tag === 'p') return cleanInline(inlineToMd(b));
    return b.childNodes.filter((n) => n.nodeType === ELEMENT)
      .map((li, i) => `${tag === 'ol' ? `${i + 1}.` : '-'} ${cleanInline(inlineToMd(li))}`).join('\n');
  }).join('\n\n');
}

const normMd = (s) => s.replace(/\r/g, '').split('\n').map((l) => l.trimEnd()).join('\n').trim();

function renderInline(md) {
  const held = [];
  let s = md.replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, (_, c) => `\u0001${held.push(c) - 1}\u0002`);
  s = escapeText(s)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, href) => `<a href="${href.replace(/"/g, '&quot;')}">${t}</a>`)
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_, a, b) => `<strong>${a ?? b}</strong>`)
    .replace(/\*(?=\S)(.+?)\*|\b_(?=\S)(.+?)_\b/g, (_, a, b) => `<em>${a ?? b}</em>`);
  return s.replace(/\u0001(\d+)\u0002/g, (_, i) => escapeText(held[i]));
}

// Paragraphs, bullet and numbered lists, **bold**, *italic*, [links](url).
// A single line break inside a paragraph becomes <br>.
export function renderMarkdown(md) {
  const blocks = [];
  for (const chunk of normMd(md).split(/\n\s*\n/)) {
    let para = [];
    const flush = () => { if (para.length) blocks.push({ tag: 'p', html: para.map(renderInline).join('<br>') }); para = []; };
    for (const line of chunk.split('\n')) {
      const m = line.match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/);
      if (!m) { para.push(line.replace(/\\$/, '').trim()); continue; }
      flush();
      const tag = m[1] ? 'ul' : 'ol';
      if (blocks.at(-1)?.tag !== tag || blocks.at(-1).closed) blocks.push({ tag, items: [] });
      blocks.at(-1).items.push(renderInline(m[3]));
    }
    flush();
    if (blocks.length) blocks.at(-1).closed = true;
  }
  return blocks;
}

/* ---------- bindings ---------- */

// Every data-cms* attribute on the page, as { key, kind, el, ... }.
export function bindings(root) {
  const out = [];
  for (const el of root.querySelectorAll(MARKER_SELECTOR)) {
    const a = el.attributes;
    const tag = el.rawTagName.toLowerCase();
    if (a['data-cms']) out.push({ key: a['data-cms'], kind: 'text', el });
    if (a['data-cms-html']) out.push({ key: a['data-cms-html'], kind: 'html', el });
    if (a['data-cms-img']) {
      const key = a['data-cms-img'];
      const attr = { source: 'srcset', link: 'href' }[tag] ?? 'src';
      out.push({ key, kind: 'attr', attr, image: true, el });
      if (tag === 'img' && a.alt) out.push({ key: key + '_alt', kind: 'attr', attr: 'alt', alt: true, el });
    }
    if (a['data-cms-href']) out.push({ key: a['data-cms-href'], kind: 'attr', attr: 'href', el });
    if (a['data-cms-attr']) {
      for (const pair of a['data-cms-attr'].split(',')) {
        const eq = pair.indexOf('=');
        const attr = pair.slice(0, eq).trim();
        const spec = pair.slice(eq + 1).trim();
        const m = spec.match(/^(.*)\{([^}|]+)(?:\|(\w+))?\}(.*)$/);
        const b = m ? { key: m[2], prefix: m[1], filter: m[3], suffix: m[4] } : { key: spec };
        if (b.filter && !FILTERS[b.filter]) throw new Error(`Unknown filter "${b.filter}"`);
        out.push({ ...b, kind: 'attr', attr, templated: !!m, el });
      }
    }
    if (a['data-cms-section']) out.push({ key: a['data-cms-section'] + '.show', kind: 'section', el });
  }
  for (const b of out) splitKey(b.key);
  return out;
}

// The value the HTML currently shows for a binding, in stored form.
// undefined when it can't be read back (filtered templates).
export function defaultOf(b) {
  if (b.kind === 'text') return textDefault(b.el);
  if (b.kind === 'html') return htmlDefault(b.el);
  if (b.kind === 'section') return b.el.rawTagName.toLowerCase() !== 'template';
  const raw = b.el.getAttribute(b.attr) ?? '';
  let v = raw;
  if (b.templated) {
    if (b.filter || !raw.startsWith(b.prefix) || !raw.endsWith(b.suffix)) return undefined;
    v = raw.slice(b.prefix.length, raw.length - b.suffix.length);
  }
  return b.image ? toStoredPath(v) : v;
}

/* ---------- rendering ---------- */

function startTagEnd(src, start) {
  let q = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === '>') return i + 1;
  }
  throw new Error('Unterminated start tag at ' + start);
}

function closeTagStart(src, el) {
  const end = el.range[1];
  const close = `</${el.rawTagName}>`;
  return src.slice(end - close.length, end).toLowerCase() === close.toLowerCase() ? end - close.length : end;
}

function setAttr(tag, name, value) {
  const re = new RegExp(`(\\s${name}=)"[^"]*"`);
  const v = `"${escapeAttr(value)}"`;
  return re.test(tag) ? tag.replace(re, `$1${v}`) : tag.replace(/\s*\/?>$/, (end) => ` ${name}=${v}${end}`);
}

// Widens a range that spans whole lines to take the indent and newline
// too, so removing it leaves no blank line behind.
function wholeLines(src, start, end) {
  const lineStart = src.lastIndexOf('\n', start - 1) + 1;
  if (/^[ \t]*$/.test(src.slice(lineStart, start)) && src[end] === '\n') return { start: lineStart, end: end + 1 };
  return { start, end };
}

const indentBefore = (src, pos) => src.slice(src.lastIndexOf('\n', pos - 1) + 1, pos).match(/^\s*/)[0];

function attrsOf(src, el) {
  const tag = src.slice(el.range[0], startTagEnd(src, el.range[0]));
  return tag.replace(/^<[a-z0-9]+/i, '').replace(/>$/, '');
}

function renderHtmlBlocks(src, el, md) {
  const old = managedBlocks(el);
  const indent = indentBefore(src, old[0].range[0]);
  return renderMarkdown(md).map((blk, i) => {
    const prev = old[i]?.rawTagName.toLowerCase() === blk.tag ? attrsOf(src, old[i]) : '';
    if (blk.tag === 'p') return `<${blk.tag}${prev}>${blk.html}</${blk.tag}>`;
    const items = blk.items.map((li) => `${indent}  <li>${li}</li>`).join('\n');
    return `<${blk.tag}${prev}>\n${items}\n${indent}</${blk.tag}>`;
  }).join('\n' + indent);
}

function renderText(src, el, value) {
  const run = textRun(el);
  const br = run.find((n) => n.nodeType === ELEMENT);
  const brHtml = br ? src.slice(br.range[0], br.range[1]) : '<br>';
  const html = value.split('\n').map((s) => escapeText(s.trim())).join(brHtml);
  if (!run.length) {
    const at = startTagEnd(src, el.range[0]);
    return { start: at, end: at, text: html };
  }
  const start = run[0].range[0];
  const end = run.at(-1).range[1];
  const raw = src.slice(start, end);
  return { start, end, text: raw.match(/^\s*/)[0] + html + raw.match(/\s*$/)[0] };
}

// Returns the page's HTML with content applied and markers stripped.
// lookup(key) gives the stored value, or undefined to keep the default.
export function renderPage(src, lookup) {
  const root = parse(src, { comment: true });
  const all = bindings(root);
  const edits = [];

  // Page-level defaults, for templated attributes (their own default
  // can't always be read back).
  const pageDefault = {};
  for (const b of all) if (!b.templated) pageDefault[b.key] ??= defaultOf(b);

  const byEl = new Map();
  for (const b of all) byEl.set(b.el, [...(byEl.get(b.el) ?? []), b]);

  for (const [el, bs] of byEl) {
    const start = el.range[0];
    const tagEnd = startTagEnd(src, start);
    let tag = src.slice(start, tagEnd).replace(MARKER_ATTR_RE, '');
    let removed = false;

    for (const b of bs) {
      const value = lookup(b.key);
      if (b.kind === 'section') {
        const show = typeof value === 'boolean' ? value : defaultOf(b);
        if (!show) { edits.push({ ...wholeLines(src, start, el.range[1]), text: '', remove: true }); removed = true; }
        else if (el.rawTagName.toLowerCase() === 'template') {
          edits.push({ ...wholeLines(src, start, tagEnd), text: '' });
          edits.push({ ...wholeLines(src, closeTagStart(src, el), el.range[1]), text: '' });
          removed = true;
        }
        continue;
      }
      if (typeof value !== 'string' || value === '') continue;
      if (b.kind === 'text') {
        if (normText(value) !== defaultOf(b)) edits.push(renderText(src, el, normText(value)));
      } else if (b.kind === 'html') {
        if (normMd(value) !== normMd(defaultOf(b))) {
          const old = managedBlocks(el);
          edits.push({ start: old[0].range[0], end: old.at(-1).range[1], text: renderHtmlBlocks(src, el, value) });
        }
      } else if (b.templated) {
        if (value !== pageDefault[b.key]) {
          const v = b.filter ? FILTERS[b.filter](value) : value;
          tag = setAttr(tag, b.attr, b.prefix + v + b.suffix);
        }
      } else if (value !== defaultOf(b)) {
        tag = setAttr(tag, b.attr, b.image ? toPagePath(value) : value);
      }
    }
    if (!removed) edits.push({ start, end: tagEnd, text: tag });
  }

  const removals = edits.filter((e) => e.remove);
  const kept = edits
    .filter((e) => e.remove || !removals.some((r) => r.start <= e.start && e.end <= r.end))
    .filter((e) => !(e.remove && removals.some((r) => r !== e && r.start <= e.start && e.end <= r.end)))
    .sort((a, b) => b.start - a.start);
  let out = src;
  let floor = Infinity;
  for (const e of kept) {
    if (e.end > floor) throw new Error(`Overlapping edits at ${e.start}`);
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
    floor = e.start;
  }
  return out;
}

/* ---------- field metadata for the CMS config ---------- */

// Widget, and a hint for images, for every key on a page.
export function fieldInfo(root) {
  const info = {};
  for (const b of bindings(root)) {
    const f = (info[b.key] ??= { key: b.key, kinds: new Set() });
    f.kinds.add(b.kind === 'attr' ? (b.image ? 'image' : b.alt ? 'alt' : 'attr') : b.kind);
    const tag = b.el.rawTagName.toLowerCase();
    if (b.kind === 'text' && /^h[1-6]$/.test(tag)) f.heading = true;
    if (b.image && b.el.getAttribute('width')) f.size ??= `${b.el.getAttribute('width')}×${b.el.getAttribute('height')}`;
    if (b.kind === 'attr' && b.attr === 'href') f.link = true;
  }
  return info;
}
