import { deriveTheme, normalizeReport, publicUrl, validateTheme } from './model.js';
import { buildKitZip, buildGuide, escapeHtml } from './elementor.js';

const $=q=>document.querySelector(q);
let report=null,theme=null,sourceWindow=null,received='',expected=null;
const query=new URLSearchParams(location.search);
if(query.get('session')&&query.get('source')) {try{expected={session:query.get('session'),origin:new URL(query.get('source')).origin};}catch{/* Invalid handoff query. */}}
window.name='esg-builder';
const notice=(message,error=false)=>{const node=$('#notice');node.textContent=message;node.hidden=!message;if(error)node.scrollIntoView({block:'center',behavior:'smooth'});};

$('#prepare-form').addEventListener('submit',event=>{
  event.preventDefault();notice('');
  const url=publicUrl($('#site-url').value);
  if(!url){notice('Enter a public HTTP or HTTPS website URL without credentials or an admin path.',true);return;}
  expected={session:crypto.randomUUID(),origin:new URL(url).origin,url};received='';
  const toolUrl=new URL('./',location.href).href;
  const config={toolUrl,session:expected.session,maxPages:Number($('#page-budget').value),responsive:$('#responsive').checked,delay:400};
  const js=`(()=>{if(location.origin!==${JSON.stringify(expected.origin)}){alert('Run this bookmark on ${new URL(url).hostname}.');return;}const s=document.createElement('script');s.src=${JSON.stringify(new URL('collector.js',toolUrl).href)};s.dataset.esg=${JSON.stringify(JSON.stringify(config))};s.onerror=()=>alert('This site blocked the Style Kit collector script. Its security policy may prevent bookmarklet collection.');document.body.appendChild(s);})()`;
  $('#bookmarklet').href='javascript:'+encodeURIComponent(js);
  $('#connection-title').textContent=`Your ${new URL(url).hostname} collector is ready.`;
  $('#collection-progress').textContent='Waiting for the collector…';$('#connection').hidden=false;
  $('#connection').scrollIntoView({behavior:'smooth',block:'nearest'});
});
$('#bookmarklet').addEventListener('click',event=>{event.preventDefault();notice('Drag “Collect site styles” to your bookmarks bar, open the target website, then run the bookmark there.');});
$('#open-site').addEventListener('click',()=>{if(expected?.url)sourceWindow=window.open(expected.url,'esg-source');});
window.addEventListener('message',event=>{
  if(!expected||event.origin!==expected.origin||event.data?.session!==expected.session)return;
  if(sourceWindow&&event.source!==sourceWindow)return;
  if(event.data.type==='esg-progress') {
    $('#collection-progress').textContent=`${Number(event.data.scanned)||0} pages collected · ${Number(event.data.discovered)||0} discovered · ${String(event.data.url||'').slice(0,200)}`;
  } else if(event.data.type==='esg-report') {
    try {
      if(new URL(event.data.report.sourceUrl).origin!==expected.origin)throw new Error('Report source does not match the connected website.');
      const fingerprint=`${event.data.session}:${event.data.report.capturedAt}:${event.data.report.pages?.length}`;
      if(fingerprint===received)return;
      loadReport(event.data.report);received=fingerprint;
      $('#collection-progress').textContent=`Collection received: ${report.pages.length} pages. Review the results below.`;
    }catch(e){notice(e.message,true);}
  }
});

$('#load-example').addEventListener('click',async()=>{
  try {const response=await fetch(new URL('examples/aloha-report.json',location.href));if(!response.ok)throw new Error('Example could not be loaded.');loadReport(await response.json());}
  catch(e){notice(e.message,true);}
});
$('#report-file').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try {if(file.size>25_000_000)throw new Error('Choose a report smaller than 25 MB.');loadReport(JSON.parse(await file.text()));}
  catch(e){notice(`Could not import this report: ${e.message}`,true);}
  finally{event.target.value='';}
});

function loadReport(raw) {
  const normalized=normalizeReport(raw),detected=deriveTheme(normalized);
  report=normalized;theme=detected;notice('');
  $('#results').hidden=false;$('#results-title').textContent=theme.name;
  $('#results-source').textContent=`${new URL(report.sourceUrl).hostname} · ${report.example?'Reference example':new Date(report.capturedAt).toLocaleDateString()}`;
  $('#metric-pages').textContent=report.pages.length.toLocaleString();$('#metric-colors').textContent=theme.palette.length;
  $('#coverage-badge').textContent=report.example?'Reference example':report.coverage.complete?'Crawl exhausted':'Partial collection';
  $('#step-review').classList.add('active');$('#step-export').classList.add('active');
  renderEditors();renderCoverage();renderPreview();
  $('#results').scrollIntoView({behavior:'smooth',block:'start'});
}

function create(tag,props={},parent) {const node=document.createElement(tag);for(const [key,value]of Object.entries(props)){if(key==='text')node.textContent=value;else if(key==='class')node.className=value;else if(key==='style')Object.assign(node.style,value);else node.setAttribute(key,value);}parent?.appendChild(node);return node;}
function input(parent,label,value,change,{type='text',min,max,step,maxlength}={}) {
  const node=create('input',{'aria-label':label,type,value,...(min!=null?{min}:{}),...(max!=null?{max}:{}),...(step!=null?{step}:{}),...(maxlength?{maxlength}:{})},parent);
  node.addEventListener('change',()=>{change(type==='number'?Number(node.value):node.value);refreshPreview();});return node;
}
function refreshPreview(){try{renderPreview();notice('');}catch(e){notice(e.message);}}

function renderEditors() {
  const palette=$('#palette-editor');palette.replaceChildren();
  theme.palette.forEach((color,i)=>{
    const card=create('div',{class:'palette-card'},palette),label=create('label',{class:'swatch-label',style:{background:color.value}},card);
    const picker=input(label,`${color.title} color`,color.value,value=>{color.value=value;label.style.background=value;hex.value=value;},{type:'color'});
    const name=input(card,`Color ${i+1} name`,color.title,value=>{color.title=value;picker.setAttribute('aria-label',`${value} color`);},{maxlength:70});name.className='color-name';
    const hex=input(card,`Color ${i+1} hex value`,color.value,value=>{color.value=value.toUpperCase();picker.value=color.value;label.style.background=color.value;},{maxlength:7});hex.className='color-value';
  });
  const tbody=$('#heading-editor');tbody.replaceChildren();
  theme.headings.forEach((h,i)=>{
    const row=create('tr',{},tbody),label=create('td',{text:`H${i+1}`},row);
    if(h.inferred)create('span',{class:'inferred',text:'Inferred'},label);
    input(create('td',{},row),`H${i+1} font family`,h.family,value=>{h.family=value;},{maxlength:100});
    for(const key of ['size','tablet','mobile'])input(create('td',{},row),`H${i+1} ${key==='size'?'desktop':key} size`,h[key],value=>{h[key]=value;},{type:'number',min:8,max:200,step:.1});
    input(create('td',{},row),`H${i+1} weight`,h.weight,value=>{h.weight=String(value);},{type:'number',min:100,max:900,step:100});
    input(create('td',{},row),`H${i+1} line height`,h.lineHeight,value=>{h.lineHeight=value;},{type:'number',min:.7,max:3,step:.05});
  });
  $('#body-family').value=theme.body.family;$('#body-size').value=theme.body.size;$('#button-radius').value=theme.button.radius;$('#content-width').value=theme.contentWidth;
}
for(const [id,change] of Object.entries({'body-family':value=>{theme.body.family=value;theme.button.family=value;},'body-size':value=>{theme.body.size=Number(value);},'button-radius':value=>{theme.button.radius=Number(value);},'content-width':value=>{theme.contentWidth=Number(value);}})) {
  $('#'+id).addEventListener('change',event=>{if(theme){change(event.target.value);refreshPreview();}});
}

function renderCoverage() {
  const c=report.coverage;
  $('#coverage-summary').textContent=report.example?'This example uses the approved Aloha palette and heading sizes from the reference guide. It is not a full-site crawl.':`${report.pages.length} pages collected out of ${c.discovered} discovered URLs. ${c.issues.length} skipped or failed. ${c.complete?'The discovered crawl queue was exhausted. This does not prove that every URL on the site was discoverable.':c.cancelled?'Collection was stopped; this is a partial report.':'The crawl was limited or some pages could not be collected.'}`;
  $('#coverage-warnings').replaceChildren();for(const warning of c.warnings)create('li',{text:warning},$('#coverage-warnings'));
  $('#collected-pages').replaceChildren();$('#failed-pages').replaceChildren();
  for(const p of report.pages){const li=create('li',{},$('#collected-pages'));create('a',{href:p.url,target:'_blank',rel:'noreferrer',text:p.title||new URL(p.url).pathname},li);create('span',{text:p.url},li);}
  for(const issue of c.issues){const li=create('li',{text:issue.reason},$('#failed-pages'));create('span',{text:issue.url},li);}
  if(!c.issues.length)create('li',{text:'No skipped or failed pages recorded.'},$('#failed-pages'));
}

function renderPreview() {
  if(!theme)return;
  const {page,theme:t}=buildGuide(theme),s=t.palette;
  const fontMap=new Map();
  const {siteSettings}=buildGuide(theme);
  for(const item of [...siteSettings.settings.system_typography,...siteSettings.settings.custom_typography])fontMap.set(item._id,item);
  const globalId=(node,key)=>(node.settings.__globals__?.[key]||'').split('?id=')[1];
  const typeStyle=(node)=>{const f=fontMap.get(globalId(node,'typography_typography'));return f?`font-family:&quot;${escapeHtml(f.typography_font_family)}&quot;,sans-serif;font-size:${f.typography_font_size.size}px;font-weight:${f.typography_font_weight};line-height:${f.typography_line_height.size};`:'';};
  const render=node=>{
    const st=node.settings,cls=escapeHtml(st.css_classes||st._css_classes||''),font=typeStyle(node),bg=globalId(node,'background_color'),typeAttr=font?` data-type="type-${node.id}"`:'';
    if(node.elType==='container')return `<div class="e-con ${cls}"${st._element_id?` id="${escapeHtml(st._element_id)}"`:''} style="${bg?`background-color:var(--e-global-color-${bg});`:''}">${node.elements.map(render).join('')}</div>`;
    if(node.widgetType==='html')return st.html;
    const color=globalId(node,node.widgetType==='heading'?'title_color':'text_color');
    if(node.widgetType==='heading')return `<div class="elementor-widget elementor-widget-heading ${cls}"><${st.header_size} class="elementor-heading-title"${typeAttr} style="${font}color:var(--e-global-color-${color})">${st.title}</${st.header_size}></div>`;
    if(node.widgetType==='text-editor')return `<div class="elementor-widget elementor-widget-text-editor ${cls}"${typeAttr} style="${font}color:var(--e-global-color-${color})">${st.editor}</div>`;
    if(node.widgetType==='button')return `<div class="elementor-widget ${cls}"><a class="elementor-button"${typeAttr} href="${st.link.url}" style="${font}background-color:${st.border_border?'transparent':`var(--e-global-color-${globalId(node,'background_color')})`};color:var(--e-global-color-${globalId(node,'button_text_color')});${st.border_border?`border:1px solid var(--e-global-color-${globalId(node,'border_color')});`:''}border-radius:${t.button.radius}px">${st.text}</a></div>`;
    return '';
  };
  const fonts=new Map();for(const f of fontMap.values()){if(/^(Arial|Helvetica|system-ui|sans-serif|serif|monospace|Segoe UI|Georgia|Times New Roman)$/i.test(f.typography_font_family))continue;if(!fonts.has(f.typography_font_family))fonts.set(f.typography_font_family,new Set());fonts.get(f.typography_font_family).add(f.typography_font_weight);}
  const fontUrl=new URL('https://fonts.googleapis.com/css2');for(const [family,weights]of fonts)fontUrl.searchParams.append('family',family+':wght@'+[...weights].sort((a,b)=>a-b).join(';'));fontUrl.searchParams.set('display','swap');
  // Global type references are rendered as class rules so responsive sizes can override them.
  let body=page.content.map(render).join('');
  const typeClasses=[];
  const nativeNodes=[];const walk=nodes=>{for(const node of nodes){nativeNodes.push(node);walk(node.elements||[]);}};walk(page.content);
  for(const node of nativeNodes){const f=fontMap.get(globalId(node,'typography_typography'));if(!f)continue;const cls=`type-${node.id}`;typeClasses.push(`@media(max-width:1024px){[data-type="${cls}"]{font-size:${f.typography_font_size_tablet?.size||f.typography_font_size.size}px!important}}@media(max-width:767px){[data-type="${cls}"]{font-size:${f.typography_font_size_mobile?.size||f.typography_font_size.size}px!important}}`);}
  $('#guide-preview').srcdoc=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${fonts.size?`<link rel="stylesheet" href="${escapeHtml(fontUrl.href)}">`:''}<style>:root{${s.map(c=>`--e-global-color-${c.id}:${c.value}`).join(';')}}*{box-sizing:border-box}body{margin:0;background:#fff;font-family:"${escapeHtml(t.body.family)}",sans-serif;font-size:${t.body.size}px;color:var(--e-global-color-text)}.e-con{display:flex;flex-direction:column;gap:20px;min-width:0}.esg-style-guide{max-width:${t.contentWidth}px;margin:auto}.elementor-widget{min-width:0;width:100%}h1,h2,h3,h4,h5,h6,p{margin:0}p{margin-bottom:1em}a{color:${t.link}}a.elementor-button{display:inline-block;text-decoration:none;line-height:1.2;text-align:center}.elementor-button:hover{background-color:var(--e-global-color-primary)!important;color:${readablePrimary(t)}!important}ul,ol{padding-left:24px;margin-top:0}li{margin-bottom:.5em}${typeClasses.join('')}</style></head><body>${body}</body></html>`;
}
function readablePrimary(t){const color=t.palette.find(c=>c.id==='primary').value;const rgb=color.slice(1).match(/../g).map(v=>parseInt(v,16));return (rgb[0]*.299+rgb[1]*.587+rgb[2]*.114)>150?'#000':'#fff';}

for(const button of document.querySelectorAll('[data-tab]'))button.addEventListener('click',()=>{
  for(const tab of document.querySelectorAll('[data-tab]')){const active=tab===button;tab.setAttribute('aria-selected',String(active));$('#'+tab.dataset.tab+'-panel').hidden=!active;}
});
$('.result-tabs').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const tabs=[...document.querySelectorAll('[data-tab]')],index=tabs.indexOf(document.activeElement),next=tabs[(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length];next.focus();next.click();});
for(const button of document.querySelectorAll('[data-width]'))button.addEventListener('click',()=>{
  for(const b of document.querySelectorAll('[data-width]'))b.setAttribute('aria-pressed',String(b===button));$('#guide-preview').classList.toggle('mobile',button.dataset.width!=='desktop');
});

function download(bytes,name,type){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#download-report').addEventListener('click',()=>{if(report)download(JSON.stringify(report,null,2),`${new URL(report.sourceUrl).hostname}-style-report.json`,'application/json');});
$('#download-kit').addEventListener('click',()=>{
  if(!theme)return;
  try {validateTheme(theme);const zip=buildKitZip(theme,{title:$('#page-title').value||'Style Guide',noindex:$('#noindex').checked});download(zip,`${new URL(theme.sourceUrl).hostname}-elementor-style-kit.zip`,'application/zip');notice('Kit downloaded. In Elementor’s website kit importer, select Site Settings and Content / Pages.');}
  catch(e){notice(e.message,true);}
});
