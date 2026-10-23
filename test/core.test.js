import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import { canonicalColor, publicUrl, normalizeReport, deriveTheme, validateTheme, contrast, readableInk, safeGradient } from '../src/model.js';
import { robotsPolicy, sitemapLocations } from '../src/robots.js';
import { buildKitFiles, buildKitZip, validateKitFiles, buildSiteSettings } from '../src/elementor.js';

const fixture=JSON.parse(await readFile(new URL('../examples/aloha-report.json',import.meta.url),'utf8'));
const theme=()=>deriveTheme(structuredClone(fixture));
const walk=(nodes,fn)=>{for(const node of nodes){fn(node);walk(node.elements||[],fn);}};

test('normalizes opaque colors without flattening translucent colors to false palette entries',()=>{
  assert.equal(canonicalColor('rgb(4, 38, 152)'),'#042698');assert.equal(canonicalColor('#abc'),'#AABBCC');
  assert.equal(canonicalColor('rgba(0,0,0,0)'),null);assert.equal(canonicalColor('rgb(999,0,0)'),null);
  assert.ok(contrast('#042698','#FFFFFF')>12);assert.equal(readableInk('#E7128F'),'#000000');
});
test('canonicalizes public URLs and excludes credentials, admin routes and state-changing query links',()=>{
  assert.equal(publicUrl('/about/?utm_source=x#hello','https://example.com/'),'https://example.com/about/');
  for(const url of ['javascript:alert(1)','https://u:p@example.com/','https://example.com/wp-admin/','https://example.com/?add-to-cart=2','https://other.com/','http://localhost/'])assert.equal(publicUrl(url,'https://example.com/'),null);
});
test('robots rules respect longest matches, Allow ties and specific agent groups',()=>{
  const p=robotsPolicy('User-agent: *\nDisallow: /private\nAllow: /private/open\nDisallow: /*?secret=\nCrawl-delay: 1\nSitemap: https://example.com/sitemap.xml');
  assert.equal(p.allows('https://example.com/private/'),false);assert.equal(p.allows('https://example.com/private/open/'),true);assert.equal(p.allows('https://example.com/a?secret=x'),false);assert.equal(p.delay,1000);
  assert.equal(robotsPolicy('User-agent: *\nDisallow: /\nUser-agent: ElementorStyleGuide\nAllow: /').allows('https://example.com/a'),true);
  assert.equal(robotsPolicy('User-agent: *\nDisallow: /same\nAllow: /same').allows('https://example.com/same'),true);
});
test('sitemaps support namespaces, CDATA and entity decoding without external entities',()=>{
  assert.deepEqual(sitemapLocations('<sm:sitemapindex><sm:loc><![CDATA[https://example.com/a.xml]]></sm:loc></sm:sitemapindex>'),{index:true,urls:['https://example.com/a.xml']});
  assert.deepEqual(sitemapLocations('<urlset><url><loc>https://example.com/?p=1&amp;x=2</loc></url></urlset>').urls,['https://example.com/?p=1&x=2']);
  assert.throws(()=>sitemapLocations('<!DOCTYPE foo [<!ENTITY evil SYSTEM "file:///etc/passwd">]>'));
});
test('keeps the approved Aloha desktop, tablet and mobile heading sizes',()=>{
  const t=theme();assert.deepEqual(t.headings.map(h=>h.size),[64,48,45,32,24,16]);assert.deepEqual(t.headings.map(h=>h.mobile),[64,48,45,32,24,16]);assert.equal(t.body.family,'Montserrat');assert.equal(t.button.radius,50);assert.equal(t.contentWidth,1140);
});
test('styles repeated across pages outweigh repeated navigation or one unusually dense page',()=>{
  const r=structuredClone(fixture);const common={role:'h1',viewport:'desktop',family:'Common Font',size:60,weight:'400',lineHeight:1.2,color:'#111111',count:1};
  r.pages=[{...r.pages[0],url:'https://aloha-orthodontics.com/a/',typography:[common]},{...r.pages[0],url:'https://aloha-orthodontics.com/b/',typography:[common]},{...r.pages[0],url:'https://aloha-orthodontics.com/c/',typography:[{...common,family:'Rare Font',size:90,count:10000}]}];
  assert.equal(deriveTheme(r).headings[0].family,'Common Font');
});
test('missing headings are flagged as inferred, not reported as detected',()=>{
  const r=structuredClone(fixture);r.pages[0].typography=r.pages[0].typography.filter(t=>t.role!=='h6');
  assert.equal(deriveTheme(r).headings[5].inferred,true);assert.equal(deriveTheme(r).headings[5].evidence,0);
});
test('rejects malformed and cross-site reports and invalid heading overrides',()=>{
  assert.throws(()=>normalizeReport({}));const r=structuredClone(fixture);r.pages[0].url='https://other.com/';assert.throws(()=>normalizeReport(r));
  const t=theme();t.headings[0].size=NaN;assert.throws(()=>validateTheme(t));
});
test('combined kit manifest resolves the settings and native page payload using Elementor paths',()=>{
  const files=buildKitFiles(theme());assert.deepEqual(Object.keys(files).sort(),['content/page/1.json','manifest.json','site-settings.json']);
  const m=files['manifest.json'];assert.equal(m.version,'3.0');assert.equal(m.content.page['1'].doc_type,'wp-page');assert.equal(m.content.page['1'].show_on_front,undefined);
  assert.equal(m['site-settings'].globalColors,true);assert.equal(m['site-settings'].theme,false);assert.equal(m['site-settings'].experiments,false);assert.deepEqual(m.plugins,[]);
  assert.equal(files['content/page/1.json'].settings.page_layout,'elementor_canvas');assert.ok(validateKitFiles(files));
});
test('ZIP round-trips as UTF-8 JSON with root files and no enclosing directory',()=>{
  const zip=buildKitZip(theme()),files=unzipSync(zip);
  assert.equal(zip[0],0x50);assert.equal(zip[1],0x4b);assert.equal(Object.keys(files).length,3);
  for(const [path,data] of Object.entries(files)){assert.equal(data[0],0x7b,path);assert.ok(JSON.parse(strFromU8(data)));assert.ok(!path.includes('\\'));}
});
test('page references only included globals; validator catches missing references',()=>{
  const files=buildKitFiles(theme());let links=0;walk(files['content/page/1.json'].content,n=>{links+=Object.keys(n.settings.__globals__||{}).length;});assert.ok(links>100);
  files['content/page/1.json'].content[0].settings.__globals__={background_color:'globals/colors?id=does-not-exist'};assert.throws(()=>validateKitFiles(files),/missing global/);
});
test('only the guide root is a top-level container and layout CSS needs no Pro custom CSS control',()=>{
  const page=buildKitFiles(theme())['content/page/1.json'];let roots=0,styleWidgets=0;
  walk(page.content,n=>{if(n.elType==='container'&&!n.isInner)roots++;if(n.widgetType==='html'&&n.settings.html.startsWith('<style>'))styleWidgets++;assert.equal(n.settings.custom_css,undefined);});
  assert.equal(roots,1);assert.equal(styleWidgets,1);assert.equal(page.settings.custom_css,undefined);
});
test('noindex SEO metadata is explicit, optional, and carried by the page import document',()=>{
  const page=buildKitFiles(theme())['content/page/1.json'];assert.equal(page.metadata['_yoast_wpseo_meta-robots-noindex'],'1');assert.deepEqual(page.metadata.rank_math_robots,['noindex','follow']);
  const off=buildKitFiles(theme(),{noindex:false})['content/page/1.json'];assert.equal(off.metadata['_yoast_wpseo_meta-robots-noindex'],undefined);
});
test('escapes untrusted site names and discards CSS payloads that could load remote content',()=>{
  const t=theme();t.name='<img src=x onerror=alert(1)>';t.headings[0].family='Bad Font";color:red';t.gradients=['linear-gradient(red,blue);background:url(https://evil.test)'];
  const files=buildKitFiles(t);let html='';walk(files['content/page/1.json'].content,n=>{html+=n.settings.title||n.settings.editor||n.settings.html||'';});
  assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('evil.test'));assert.equal(files['site-settings.json'].settings.h1_typography_font_family,'Arial');assert.equal(safeGradient('url(https://evil.test)'),null);
});
test('global IDs are stable within a source site and namespaced between source sites',()=>{
  const a=buildSiteSettings(theme()),b=buildSiteSettings(theme()),t=theme();t.sourceUrl='https://another-example.com/';const c=buildSiteSettings(t);
  assert.deepEqual(a.fontIds,b.fontIds);assert.notDeepEqual(a.fontIds,c.fontIds);assert.notEqual(a.document.settings.custom_colors[0]._id,c.document.settings.custom_colors[0]._id);
});
