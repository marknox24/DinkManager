import { toCanvas, toPng } from 'html-to-image';

// html-to-image copies every element's on-screen size into the picture, so the
// picture has to be drawn in the font the page was laid out in. With
// skipFonts alone it falls back to a wider system font inside boxes sized for
// Inter: pills and short labels wrap onto two lines, and names that fit on
// screen get cut off with "…".
//
// It can't embed the brand fonts itself (reading the cross-origin Google
// Fonts stylesheet throws a SecurityError), so we fetch that stylesheet and
// its font files ourselves and hand it the result as fontEmbedCSS.

// Names and clubs are written in Latin script (ñ, é and the like), which
// these two subsets cover; the rest would add files nobody here needs.
const SUBSETS = new Set(['latin', 'latin-ext']);

// The page's <link> loads the stylesheet without CORS, and the service worker
// caches that opaque copy, which a CORS fetch of the same URL can't read. A
// different URL gets a readable copy of its own, cached for offline use too.
const EXPORT_PARAM = 'dm=export';

let fontCssPromise = null;

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function fetchOk(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res;
}

async function buildFontEmbedCss() {
  const href = document.querySelector('link[href*="fonts.googleapis.com/css2"]')?.href;
  if (!href) throw new Error('No font stylesheet on the page');
  const css = await (await fetchOk(`${href}&${EXPORT_PARAM}`)).text();

  // Google labels each @font-face with its subset in a comment just above it.
  const faces = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)]
    .filter(([, subset]) => SUBSETS.has(subset))
    .map(([, , face]) => face);
  if (faces.length === 0) throw new Error('No font faces found');

  // Inter and Space Grotesk are variable fonts: every weight of a subset
  // points at the same file, so this is a handful of downloads.
  const urls = [...new Set(faces.flatMap((face) => [...face.matchAll(/url\((https:[^)]+)\)/g)].map(([, url]) => url)))];
  const dataUrls = new Map(await Promise.all(urls.map(async (url) => [url, await blobToDataUrl(await (await fetchOk(url)).blob())])));
  return faces.map((face) => face.replace(/url\((https:[^)]+)\)/g, (_, url) => `url(${dataUrls.get(url)})`)).join('\n');
}

// Resolves to null when the fonts can't be had (offline before they were
// ever fetched, say), and tries again on the next export.
function fontEmbedCss() {
  if (!fontCssPromise) {
    fontCssPromise = buildFontEmbedCss().catch(() => {
      fontCssPromise = null;
      return null;
    });
  }
  return fontCssPromise;
}

// Without the brand fonts, lay the node out in the system font the picture
// will fall back to, so every box is sized for the text that ends up in it.
async function capture(render, node, options) {
  const css = await fontEmbedCss();
  if (css) return render(node, { ...options, fontEmbedCSS: css });
  node.classList.add('export-system-font');
  try {
    return await render(node, { ...options, skipFonts: true });
  } finally {
    node.classList.remove('export-system-font');
  }
}

export function exportPng(node, options) {
  return capture(toPng, node, options);
}

export function exportCanvas(node, options) {
  return capture(toCanvas, node, options);
}
