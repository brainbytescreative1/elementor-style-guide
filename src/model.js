export const REPORT_VERSION = 1;
export const VIEWPORTS = { desktop: 1440, tablet: 768, mobile: 390 };
export const MAX_PAGES = 2000;
export const FALLBACK_SIZES = [64, 48, 40, 32, 24, 20];

export function publicUrl(value, origin) {
  try {
    const u = new URL(value, origin);
    if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) return null;
    if (origin && u.origin !== new URL(origin).origin) return null;
    if (/^(localhost|127\.|0\.0\.0\.0|\[?::1\]?)/i.test(u.hostname)) return null;
    if (/\.(?:pdf|png|jpe?g|gif|svg|webp|zip|mp4|mp3|woff2?|ttf|css|js|xml)$/i.test(u.pathname)) return null;
    if (/(?:^|\/)(?:wp-admin|wp-json|wp-login\.php|xmlrpc\.php|logout|signout|cart|checkout)(?:\/|$)/i.test(u.pathname)) return null;
    if (['action', 'add-to-cart', 'preview', 'nonce', '_wpnonce'].some(key => u.searchParams.has(key))) return null;
    for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) u.searchParams.delete(key);
    u.hash = '';
    return u.href;
  } catch { return null; }
}

export function canonicalColor(value) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (/^#[\da-f]{6}$/i.test(s)) return s.toUpperCase();
  if (/^#[\da-f]{3}$/i.test(s)) return '#'+[...s.slice(1)].map(c=>c+c).join('').toUpperCase();
  const match = s.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (!match || (match[4] != null && Number(match[4]) < .98)) return null;
  const rgb = match.slice(1,4).map(Number);
  if (rgb.some(v=>v<0||v>255)) return null;
  return '#'+rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase();
}

export function safeFont(value) {
  if (typeof value !== 'string') return 'Arial';
  const first=value.split(',')[0].trim().replace(/^['"]|['"]$/g,'');
  return /^[\p{L}\p{N} _-]{1,100}$/u.test(first) ? first : 'Arial';
}

export function finite(value, min, max, fallback) {
  const n=Number(value); return Number.isFinite(n)&&n>=min&&n<=max?n:fallback;
}

export function safeGradient(value) {
  return typeof value==='string' && value.length<=700 && /^linear-gradient\([a-z\d\s.,()%#-]+\)$/i.test(value)
    && !/url|expression|var|javascript/i.test(value) ? value : null;
}

export function safeShadow(value) {
  return typeof value==='string' && value.length<=250 && /^[\da-z\s.,()#%-]+$/i.test(value)
    && !/url|expression|var|javascript|none/i.test(value) ? value : null;
}

export function normalizeReport(input) {
  if (!input || input.version!==REPORT_VERSION || !publicUrl(input.sourceUrl)) throw new Error('This is not a supported Style Kit collection report.');
  if (!Array.isArray(input.pages)||input.pages.length>MAX_PAGES) throw new Error('Invalid page collection.');
  const sourceUrl=publicUrl(input.sourceUrl);
  const pages=input.pages.map(p=>{
    const url=publicUrl(p.url,sourceUrl);
    if (!url) throw new Error('Report contains a page outside the source site.');
    if (!Array.isArray(p.typography)||p.typography.length>3000) throw new Error('Invalid typography observations.');
    return {
      url, title:String(p.title||'').slice(0,200),
      typography:p.typography.filter(t=>['desktop','tablet','mobile'].includes(t.viewport)&&/^(h[1-6]|body|link|button)$/.test(t.role)).map(t=>({
        role:t.role,viewport:t.viewport,family:safeFont(t.family),size:finite(t.size,6,300,16),weight:String(finite(t.weight,100,900,400)),
        lineHeight:finite(t.lineHeight,.7,4,1.5),color:canonicalColor(t.color)||'#222222',count:finite(t.count,1,10000,1),
      })),
      colors:(Array.isArray(p.colors)?p.colors:[]).slice(0,500).map(c=>({value:canonicalColor(c.value),role:['text','background','border','button'].includes(c.role)?c.role:'background',count:finite(c.count,1,100000,1)})).filter(c=>c.value),
      gradients:(p.gradients||[]).slice(0,40).map(safeGradient).filter(Boolean),
      radii:(p.radii||[]).slice(0,40).filter(r=>typeof r==='string'&&/^\d+(?:\.\d+)?(?:px|%)$/.test(r)),
      shadows:(p.shadows||[]).slice(0,40).map(safeShadow).filter(Boolean),
      widths:(p.widths||[]).slice(0,40).map(n=>finite(n,300,1800,null)).filter(Boolean),
      buttons:(p.buttons||[]).slice(0,40).map(b=>({background:canonicalColor(b.background),color:canonicalColor(b.color),radius:finite(b.radius,0,200,0)})),
    };
  });
  return {
    version:REPORT_VERSION,sourceUrl,siteName:String(input.siteName||new URL(sourceUrl).hostname).slice(0,100),
    capturedAt:String(input.capturedAt||new Date().toISOString()).slice(0,40),pages,
    coverage:{discovered:finite(input.coverage?.discovered,0,100000,pages.length),limit:finite(input.coverage?.limit,1,MAX_PAGES,100),
      complete:Boolean(input.coverage?.complete),cancelled:Boolean(input.coverage?.cancelled),
      issues:(input.coverage?.issues||[]).slice(0,MAX_PAGES).map(i=>({url:String(i.url||'').slice(0,2000),reason:String(i.reason||'').slice(0,300)})),
      warnings:(input.coverage?.warnings||[]).slice(0,30).map(x=>String(x).slice(0,300))},
    example:Boolean(input.example),
  };
}

function votes(items,keyFn) {
  const values=new Map();
  for (const {item,page} of items) {
    const key=keyFn(item);
    if (!values.has(key)) values.set(key,{value:item,score:0,pages:new Set()});
    const entry=values.get(key);entry.score+=Math.min(item.count||1,10);entry.pages.add(page);
  }
  return [...values.values()].sort((a,b)=>(b.pages.size*20+b.score)-(a.pages.size*20+a.score));
}

export function luminance(hex) {
  const rgb=hex.slice(1).match(/../g).map(h=>parseInt(h,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
  return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
}
export function contrast(a,b) {const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function readableInk(bg) {return contrast(bg,'#FFFFFF')>=contrast(bg,'#000000')?'#FFFFFF':'#000000';}

export function deriveTheme(raw) {
  const report=normalizeReport(raw);
  if (!report.pages.length) throw new Error('No pages were collected. Run the collector on a public site first.');
  const observations=report.pages.flatMap((p,page)=>p.typography.map(item=>({item,page})));
  const best=(role,viewport='desktop')=>votes(observations.filter(x=>x.item.role===role&&x.item.viewport===viewport),t=>JSON.stringify([t.family,t.size,t.weight,t.lineHeight,t.color]))[0];
  const body=best('body')?.value||{family:'Arial',size:16,weight:'400',lineHeight:1.5,color:'#222222'};
  const headingFamily=best('h1')?.value.family||best('h2')?.value.family||body.family;
  const headings=Array.from({length:6},(_,i)=>{
    const role=`h${i+1}`, observed=best(role), value=observed?.value;
    return {tag:role,family:value?.family||headingFamily,size:value?.size||FALLBACK_SIZES[i],weight:value?.weight||'400',lineHeight:value?.lineHeight||1.2,
      tablet:best(role,'tablet')?.value.size||value?.size||FALLBACK_SIZES[i],mobile:best(role,'mobile')?.value.size||value?.size||FALLBACK_SIZES[i],
      inferred:!value,evidence:observed?.pages.size||0};
  });
  const colorVotes=votes(report.pages.flatMap((p,page)=>p.colors.map(item=>({item,page}))),c=>c.value);
  const entries=colorVotes.map(v=>({value:v.value.value,pages:v.pages.size,score:v.score}));
  const chromatic=entries.filter(c=>{const rgb=c.value.slice(1).match(/../g).map(x=>parseInt(x,16));return Math.max(...rgb)-Math.min(...rgb)>35&&luminance(c.value)>.008&&luminance(c.value)<.85;});
  const buttonColors=votes(report.pages.flatMap((p,page)=>p.colors.filter(c=>c.role==='button').map(item=>({item,page}))),c=>c.value);
  const primary=buttonColors.find(v=>chromatic.some(c=>c.value===v.value.value))?.value.value||chromatic[0]?.value||'#254CE7';
  const secondary=chromatic.find(c=>c.value!==primary)?.value||'#6A5ACD';
  const accent=chromatic.find(c=>![primary,secondary].includes(c.value))?.value||secondary;
  const palette=[];const used=new Set();
  for (const [id,title,value] of [['primary','Primary',primary],['secondary','Secondary',secondary],['text','Text',body.color],['accent','Accent',accent]]) {
    palette.push({id,title,value,pages:entries.find(c=>c.value===value)?.pages||0,system:true});used.add(value);
  }
  for (const c of entries.slice(0,40)) if (!used.has(c.value)&&palette.length<24) {
    palette.push({id:`sgc${String(palette.length).padStart(4,'0')}`,title: c.value==='#FFFFFF'?'White':c.value==='#000000'?'Black':`Color ${palette.length-3}`,value:c.value,pages:c.pages,system:false});used.add(c.value);
  }
  for (const value of ['#FFFFFF','#000000']) if (!used.has(value)) {palette.push({id:`sgc${String(palette.length).padStart(4,'0')}`,title:value==='#FFFFFF'?'White':'Black',value,pages:0,system:false});used.add(value);}
  const freq=key=>votes(report.pages.flatMap((p,page)=>(p[key]||[]).map(value=>({item:{value},page}))),i=>i.value).map(v=>v.value.value);
  const buttons=report.pages.flatMap(p=>p.buttons);
  const buttonRadius=votes(buttons.map(item=>({item:{value:item.radius},page:0})),i=>i.value)[0]?.value.value??6;
  return {name:report.siteName,sourceUrl:report.sourceUrl,palette,headings,body:{...body},button:{family:best('button')?.value.family||body.family,weight:best('button')?.value.weight||'600',size:best('button')?.value.size||16,radius:buttonRadius},
    link:best('link')?.value.color||primary,contentWidth:freq('widths')[0]||1140,
    gradients:freq('gradients').slice(0,3),radii:freq('radii').slice(0,5),shadows:freq('shadows').slice(0,3)};
}

export function validateTheme(input) {
  if (!input||!Array.isArray(input.palette)||input.palette.length<4||input.palette.length>32) throw new Error('Choose 4–32 global colors.');
  const ids=new Set();
  const palette=input.palette.map((c,i)=>{
    const value=canonicalColor(c.value);
    if (!value) throw new Error(`Invalid color for ${c.title||i+1}.`);
    const id=i<4?['primary','secondary','text','accent'][i]:`sgc${String(i).padStart(4,'0')}`;
    ids.add(id);return {id,title:String(c.title||`Color ${i+1}`).slice(0,70),value,system:i<4};
  });
  if (!Array.isArray(input.headings)||input.headings.length!==6) throw new Error('All six heading styles are required.');
  const headings=input.headings.map((h,i)=>{
    const size=finite(h.size,8,200,null),tablet=finite(h.tablet,8,200,size),mobile=finite(h.mobile,8,200,size);
    if (!size||!tablet||!mobile) throw new Error(`H${i+1} needs a size between 8 and 200px.`);
    return {tag:`h${i+1}`,family:safeFont(h.family),size,tablet,mobile,weight:String(finite(h.weight,100,900,400)),lineHeight:finite(h.lineHeight,.7,3,1.2)};
  });
  return {name:String(input.name||'Website').slice(0,100),sourceUrl:publicUrl(input.sourceUrl)||'https://example.com/',palette,headings,
    body:{family:safeFont(input.body?.family),size:finite(input.body?.size,8,48,16),weight:String(finite(input.body?.weight,100,900,400)),lineHeight:finite(input.body?.lineHeight,.9,3,1.5)},
    button:{family:safeFont(input.button?.family||input.body?.family),size:finite(input.button?.size,8,48,16),weight:String(finite(input.button?.weight,100,900,600)),radius:finite(input.button?.radius,0,200,6)},
    link:canonicalColor(input.link)||palette[0].value,contentWidth:finite(input.contentWidth,300,1800,1140),
    gradients:(input.gradients||[]).slice(0,3).map(safeGradient).filter(Boolean),radii:(input.radii||[]).slice(0,5).filter(r=>typeof r==='string'&&/^\d+(?:\.\d+)?(?:px|%)$/.test(r)),shadows:(input.shadows||[]).slice(0,3).map(safeShadow).filter(Boolean)};
}
