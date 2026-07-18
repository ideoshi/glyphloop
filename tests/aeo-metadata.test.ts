import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const homepage = readFileSync(resolve('site/index.html'), 'utf8');
const studio = readFileSync(resolve('index.html'), 'utf8');
const privacy = readFileSync(resolve('site/privacy.html'), 'utf8');
const sitemap = readFileSync(resolve('site/sitemap.xml'), 'utf8');

describe('public discovery metadata', () => {
  it('declares canonical URLs for every indexable page', () => {
    expect(homepage).toContain('<link rel="canonical" href="https://glyphloop.art/">');
    expect(studio).toContain('<link rel="canonical" href="https://glyphloop.art/studio/" />');
    expect(privacy).toContain('<link rel="canonical" href="https://glyphloop.art/privacy.html">');
  });

  it('publishes valid, factual software application JSON-LD', () => {
    const match = homepage.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
    expect(match).not.toBeNull();

    const data = JSON.parse(match![1]);
    expect(data).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Glyphloop',
      url: 'https://glyphloop.art/',
      softwareVersion: '0.1.0-beta.0',
      isAccessibleForFree: true,
    });
    expect(data.sameAs).toEqual([
      'https://github.com/ideoshi/glyphloop',
      'https://www.npmjs.com/package/glyphloop',
    ]);
  });

  it('lists every indexable page in the sitemap', () => {
    expect(sitemap).toContain('<loc>https://glyphloop.art/</loc>');
    expect(sitemap).toContain('<loc>https://glyphloop.art/studio/</loc>');
    expect(sitemap).toContain('<loc>https://glyphloop.art/privacy.html</loc>');
  });
});
