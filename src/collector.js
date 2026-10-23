import { publicUrl, canonicalColor, safeFont, safeGradient, safeShadow, finite, VIEWPORTS, MAX_PAGES } from './model.js';
import { robotsPolicy, sitemapLocations } from './robots.js';

const script=document.currentScript;
let config;
try { config=JSON.parse(script?.dataset.esg||'{}'); } catch { config={}; }
if (config.toolUrl && !document.getElementById('esg-collector')) launchCollector(config);

export function extractDocument(doc, viewport) {
  const win=doc.defaultView, typography=new Map(),colors=new Map(),gradients=new Set(),radii=new Set(),shadows=new Set(),buttons=[],widths=new Set();
  const countColor=(value,role)=>{const hex=canonicalColor(value);if(!hex)return;const key=hex+role;if(!colors.has(key)) colors.set(key,{value:hex,role,count:0});colors.get(key).count++;};
  const nodes=[doc.body,...doc.querySelectorAll('body *')].filter(Boolean).slice(0,10000);
  for (const e of nodes) {
    if (e.closest('#wpadminbar,#esg-collector,script,style,noscript,iframe,svg')) continue;
    const s=win.getComputedStyle(e),rect=e.getBoundingClientRect();
    if (s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0||rect.width<1||rect.height<1) continue;
    countColor(s.backgroundColor,'background');
    if (parseFloat(s.borderTopWidth)>0) countColor(s.borderTopColor,'border');
    const gradient=safeGradient(s.backgroundImage);if(gradient)gradients.add(gradient);
    const radius=s.borderTopLeftRadius;if(parseFloat(radius)>0&&/^\d+(?:\.\d+)?(?:px|%)$/.test(radius)) radii.add(radius);
    const shadow=safeShadow(s.boxShadow);if(shadow)shadows.add(shadow);
    const tag=e.tagName.toLowerCase();
    let role=/^h[1-6]$/.test(tag)?tag:null;
    const isButton=e.matches('button,.elementor-button,[role="button"],input[type="submit"]');
    if (isButton) role='button'; else if(tag==='a'&&e.textContent.trim())role='link';else if(['p','li','body'].includes(tag)&&e.textContent.trim())role='body';
    if (role) {
      const size=parseFloat(s.fontSize),lineHeight=parseFloat(s.lineHeight)/size;
      const value={role,viewport,family:safeFont(s.fontFamily),size:Math.round(size*100)/100,weight:s.fontWeight==='bold'?'700':s.fontWeight==='normal'?'400':s.fontWeight,
        lineHeight:Number.isFinite(lineHeight)?Math.round(lineHeight*100)/100:1.5,color:canonicalColor(s.color)||'#222222',count:0};
      const key=JSON.stringify(value);
      if(!typography.has(key)) typography.set(key,value);
      typography.get(key).count++;countColor(s.color,'text');
      if(isButton) {countColor(s.backgroundColor,'button');if(buttons.length<30) buttons.push({background:canonicalColor(s.backgroundColor),color:canonicalColor(s.color),radius:parseFloat(radius)||0});}
    }
  }
  if(viewport==='desktop') for(const e of doc.querySelectorAll('main,.container,.e-con-inner,.elementor-section-boxed>.elementor-container')) {
    const s=win.getComputedStyle(e),max=parseFloat(s.maxWidth),width=Math.round(e.getBoundingClientRect().width);
    const n=Number.isFinite(max)&&max>300?max:width;
    if(n>=390&&n<=1600&&n<VIEWPORTS.desktop-40)widths.add(n);
  }
  return {typography:[...typography.values()].slice(0,700),colors:[...colors.values()].slice(0,500),gradients:[...gradients].slice(0,30),radii:[...radii].slice(0,30),shadows:[...shadows].slice(0,30),buttons,widths:[...widths].slice(0,30)};
}

async function launchCollector(input) {
  let tool;
  try { tool=new URL(input.toolUrl);if(!['https:','http:'].includes(tool.protocol))return; }catch{return;}
  const origin=location.origin,start=publicUrl(location.href,origin);
  if(!start){alert('Open a public website page before running Style Kit.');return;}
  const limit=finite(input.maxPages,1,MAX_PAGES,100),delay=finite(input.delay,100,10000,400);
  const viewports=input.responsive===false?['desktop']:Object.keys(VIEWPORTS);
  let target=window.opener,cancelled=false,running=false,frames=[],report=null;
  const host=document.createElement('div');host.id='esg-collector';
  const shadow=host.attachShadow({mode:'closed'});
  shadow.innerHTML=`<style>:host{all:initial;position:fixed;right:20px;bottom:20px;z-index:2147483647;width:min(400px,calc(100vw - 40px));font:14px/1.6 system-ui,sans-serif;color:#eaf0ff}*{box-sizing:border-box}.panel{background:#111b31;border:1px solid #4d648b;border-radius:20px;padding:24px;box-shadow:0 16px 64px #0005}h2{font-size:22px;color:white;margin:0 0 8px}p{margin:8px 0 16px}button,a{font:600 14px system-ui;border:0;border-radius:8px;padding:11px 15px;cursor:pointer;display:inline-block;text-decoration:none;margin:4px 5px 0 0}button{background:#bde8a6;color:#14231b}button.secondary,a{background:#24344e;color:white}button:disabled{opacity:.5;cursor:default}.small{font-size:12px;color:#abb9d1}.close{float:right;padding:0;background:none;color:white;font-size:20px}progress{width:100%;height:8px;margin:8px 0}.actions{display:flex;flex-wrap:wrap}.status{overflow-wrap:anywhere}</style><section class="panel"><button class="close" aria-label="Close collector">×</button><h2>Style Kit collector</h2><p class="intro"></p><p class="small">Reads public page styles, not form entries or page content. Keep this tab open. Crawling respects robots.txt.</p><progress max="${limit}" value="0"></progress><p class="status">Ready when you are.</p><div class="actions"><button class="start">Start collection</button><button class="stop secondary" hidden>Stop & keep results</button><button class="send" hidden>Send to builder</button><a class="download" hidden>Save report JSON</a></div></section>`;
  document.body.appendChild(host);
  const $=q=>shadow.querySelector(q);
  $('.intro').textContent=`${new URL(start).hostname} · up to ${limit} pages · ${viewports.length} viewport${viewports.length>1?'s':''}`;
  const status=s=>{$('.status').textContent=s;};
  const message=(type,data)=>{try{target?.postMessage({type,session:input.session,...data},tool.origin);}catch{/* Manual export remains available. */}};
  $('.close').onclick=()=>{cancelled=true;frames.forEach(f=>f.remove());host.remove();};
  $('.stop').onclick=()=>{cancelled=true;status('Stopping after the current page…');};
  $('.send').onclick=()=>{
    if(!report)return;
    if(!target||target.closed){const u=new URL(tool);u.searchParams.set('session',input.session);u.searchParams.set('source',origin);target=window.open(u.href,'esg-builder');}
    message('esg-report',{report});status('Results sent. If the builder did not receive them, save the JSON report and import it there.');
    if(target) {let tries=0;const id=setInterval(()=>{message('esg-report',{report});if(++tries>=8)clearInterval(id);},750);}
  };
  $('.start').onclick=async()=>{
    if(running)return;running=true;$('.start').hidden=true;$('.stop').hidden=false;
    const issues=[],warnings=[],pages=[],queue=[start],discovered=new Set([start]),visited=new Set(),started=Date.now();let reportBytes=0;
    report={version:1,sourceUrl:start,siteName:document.querySelector('meta[property="og:site_name"]')?.content||document.title.split(/\s[|–-]\s/)[0]||new URL(start).hostname,capturedAt:new Date().toISOString(),pages,coverage:{discovered:1,limit,complete:false,cancelled:false,issues,warnings}};
    const fetchText=async(url,max=5_000_000)=>{
      const response=await fetch(url,{credentials:'omit',redirect:'follow',signal:AbortSignal.timeout(15000),headers:{Accept:'text/html,application/xml,text/xml,text/plain'}});
      if(new URL(response.url).origin!==origin)throw new Error('Redirected outside the source site.');
      if(!response.ok)throw Object.assign(new Error(`HTTP ${response.status}`),{status:response.status});
      const reader=response.body?.getReader();if(!reader)return '';const chunks=[];let size=0;
      try {while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>max)throw new Error('Response exceeds collection size limit.');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
      const body=new Uint8Array(size);let at=0;for(const c of chunks){body.set(c,at);at+=c.length;}return new TextDecoder().decode(body);
    };
    let policy=robotsPolicy('');
    try {status('Reading robots.txt and sitemaps…');policy=robotsPolicy(await fetchText(origin+'/robots.txt'));}
    catch(e){
      if(e.status>=400&&e.status<500&&e.status!==429)warnings.push('robots.txt is unavailable (HTTP '+e.status+'); public same-origin links will be used.');
      else {policy=robotsPolicy('User-agent: *\nDisallow: /');warnings.push('Collection paused because robots.txt could not be verified after a network or server error. Try again later.');}
    }
    const add=url=>{const u=publicUrl(url,origin);if(u&&!discovered.has(u)&&discovered.size<50000){discovered.add(u);queue.push(u);}};
    const sitemapQueue=[...policy.sitemaps,origin+'/sitemap.xml',origin+'/wp-sitemap.xml'],seenMaps=new Set();
    for(let i=0;i<sitemapQueue.length&&seenMaps.size<30&&!cancelled;i++) {
      let u;try{u=new URL(sitemapQueue[i],origin);if(u.origin!==origin||seenMaps.has(u.href))continue;}catch{continue;}
      seenMaps.add(u.href);
      try {const parsed=sitemapLocations(await fetchText(u.href));for(const loc of parsed.urls){if(parsed.index)sitemapQueue.push(loc);else add(loc);}}
      catch{/* Common missing sitemap paths are normal; links remain discoverable. */}
    }
    if(sitemapQueue.length>30)warnings.push('Sitemap discovery was capped at 30 sitemap files.');
    const loadFrame=async(url,width)=>{
      const frame=document.createElement('iframe');frame.className='esg-scan-frame';frame.setAttribute('sandbox','allow-same-origin allow-scripts');frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
      Object.assign(frame.style,{position:'fixed',left:'-20000px',top:'0',width:`${width}px`,height:'1000px',opacity:'0',pointerEvents:'none',border:'0'});
      frames.push(frame);
      await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Page frame timed out or was blocked by site policy.')),20000);frame.onload=()=>{clearTimeout(timeout);resolve();};frame.onerror=()=>{clearTimeout(timeout);reject(new Error('Page could not be framed.'));};frame.src=url;document.body.appendChild(frame);});
      if(!frame.contentDocument?.body||frame.contentWindow.location.origin!==origin)throw new Error('Site policy or redirect blocked page rendering.');
      await Promise.race([frame.contentDocument.fonts?.ready,new Promise(resolve=>setTimeout(resolve,2500))]);
      await new Promise(resolve=>setTimeout(resolve,400));
      return frame;
    };
    try {
      while(queue.length&&visited.size<limit&&!cancelled) {
        if(Date.now()-started>3_600_000){warnings.push('Collection stopped at the one-hour time limit.');break;}
        const url=queue.shift();if(visited.has(url))continue;visited.add(url);
        if(!policy.allows(url)){issues.push({url,reason:'Disallowed by robots.txt'});continue;}
        status(`Page ${visited.size} of ${Math.min(discovered.size,limit)} · ${new URL(url).pathname}`);
        message('esg-progress',{scanned:pages.length,discovered:discovered.size,url});
        try {
          const html=await fetchText(url,3_000_000),parsed=new DOMParser().parseFromString(html,'text/html');
          if(!parsed.body||!/<(?:html|body|head|!doctype)/i.test(html))throw new Error('Not an HTML page.');
          for(const a of parsed.querySelectorAll('a[href]')) {try{add(new URL(a.getAttribute('href'),url).href);}catch{/* Invalid link. */}}
          const page={url,title:parsed.title.slice(0,200),typography:[],colors:[],gradients:[],radii:[],shadows:[],buttons:[],widths:[]};
          for(const viewport of viewports) {
            if(cancelled)break;
            const frame=await loadFrame(url,VIEWPORTS[viewport]);
            const rendered=extractDocument(frame.contentDocument,viewport);
            for(const key of Object.keys(rendered))page[key].push(...rendered[key]);
            for(const a of frame.contentDocument.querySelectorAll('a[href]')) {try{add(new URL(a.getAttribute('href'),url).href);}catch{/* Invalid link. */}}
            frame.remove();frames=frames.filter(f=>f!==frame);
          }
          if(page.typography.length){pages.push(page);reportBytes+=JSON.stringify(page).length;}
        } catch(e) {issues.push({url,reason:String(e.message).slice(0,200)});frames.forEach(f=>f.remove());frames=[];}
        $('.panel progress').value=visited.size;
        if(reportBytes>20_000_000){warnings.push('Collection stopped at the 20 MB report budget. Narrow the page budget for a smaller report.');break;}
        await new Promise(resolve=>setTimeout(resolve,Math.max(delay,policy.delay)));
      }
      report.coverage.discovered=discovered.size;report.coverage.cancelled=cancelled;
      report.coverage.complete=queue.length===0&&!cancelled&&issues.length===0;
      if(queue.length&&!cancelled)warnings.push(`Collection budget reached with ${queue.length} URLs still queued.`);
      $('.stop').hidden=true;$('.send').hidden=false;$('.download').hidden=false;
      const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),download=URL.createObjectURL(blob);
      $('.download').href=download;$('.download').download=`${new URL(start).hostname}-style-report.json`;
      status(`Collected ${pages.length} pages. ${issues.length} skipped or failed. ${queue.length} remaining. Results are ready.`);
      message('esg-report',{report});
    } catch(e) {status(`Collection stopped: ${e.message}. Close and run the collector again.`);}
    finally{frames.forEach(f=>f.remove());frames=[];running=false;}
  };
}
