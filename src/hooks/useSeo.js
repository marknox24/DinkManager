import { useEffect } from 'react';

export const SITE_URL = 'https://dinkmanager.com';

// Must match the static tags in index.html — that's what crawlers that don't
// run JavaScript (Facebook, Viber, Messenger link previews) will see.
const DEFAULTS = {
  title: 'Pickleball Tournament Software & Bracket Maker | DinkManager',
  description:
    'Run pickleball tournaments in one place — online registration, automatic brackets, match scheduling, live scores and results. Pay per event, no monthly fees.',
  image: `${SITE_URL}/og-image.png`,
};

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!content) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(url) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

function setJsonLd(data) {
  const id = 'page-jsonld';
  let el = document.getElementById(id);
  if (!data) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('script');
    el.id = id;
    el.type = 'application/ld+json';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function apply({ title, description, path, image, noindex, jsonLd }) {
  const fullTitle = title || DEFAULTS.title;
  const desc = description || DEFAULTS.description;
  const url = `${SITE_URL}${path ?? window.location.pathname}`;
  const img = image || DEFAULTS.image;

  document.title = fullTitle;
  setMeta('name', 'description', desc);
  setMeta('name', 'robots', noindex ? 'noindex, nofollow' : null);
  setCanonical(url);
  setMeta('property', 'og:title', fullTitle);
  setMeta('property', 'og:description', desc);
  setMeta('property', 'og:url', url);
  setMeta('property', 'og:image', img);
  setMeta('name', 'twitter:title', fullTitle);
  setMeta('name', 'twitter:description', desc);
  setMeta('name', 'twitter:image', img);
  setJsonLd(jsonLd);
}

// Per-page <head> tags for Google. Resets to the site defaults on unmount so
// the next page never inherits a stale title, noindex or structured data.
export default function useSeo({ title, description, path, image, noindex = false, jsonLd = null } = {}) {
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : '';
  useEffect(() => {
    apply({ title, description, path, image, noindex, jsonLd: jsonLdKey ? JSON.parse(jsonLdKey) : null });
    return () => apply({ path: '/' });
  }, [title, description, path, image, noindex, jsonLdKey]);
}
