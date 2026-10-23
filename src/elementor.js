import { zipSync, strToU8 } from 'fflate';
import { validateTheme, readableInk } from './model.js';

export const ELEMENTOR_VERSION='4.3.5';
export const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const stableId=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(16).padStart(8,'0').slice(0,7);};
const slider=(size,unit='px')=>({unit,size,sizes:[]});
const dimensions=(n,unit='px')=>({unit,top:String(n),right:String(n),bottom:String(n),left:String(n),isLinked:true});
const ref=(kind,id)=>`globals/${kind}?id=${id}`;

export function buildSiteSettings(raw) {
  const theme=validateTheme(raw),namespace=new URL(theme.sourceUrl).origin;
  const palette=theme.palette.map(c=>({...c,id:c.system?c.id:stableId(`${namespace}:color:${c.id}`)}));
  const typography=(id,title,t)=>({_id:id,title,typography_typography:'custom',typography_font_family:t.family,
    typography_font_size:slider(t.size),typography_font_weight:t.weight,typography_line_height:slider(t.lineHeight||1.5,'em'),
    ...(t.tablet?{typography_font_size_tablet:slider(t.tablet),typography_font_size_mobile:slider(t.mobile)}:{})});
  const fontIds=theme.headings.map(h=>stableId(`${namespace}:type:${h.tag}`));
  const smallId=stableId(`${namespace}:type:small`),captionId=stableId(`${namespace}:type:caption`);
  const s={template:'default',system_colors:palette.filter(c=>c.system).map(c=>({_id:c.id,title:c.title,color:c.value})),
    custom_colors:palette.filter(c=>!c.system).map(c=>({_id:c.id,title:c.title,color:c.value})),
    system_typography:[typography('primary','Primary',theme.headings[0]),typography('secondary','Secondary',theme.headings[1]),typography('text','Text',theme.body),typography('accent','Accent',theme.button)],
    custom_typography:[...theme.headings.map((h,i)=>typography(fontIds[i],`H${i+1} - ${h.size}px`,h)),typography(smallId,'Small text - 14px',{...theme.body,size:14}),typography(captionId,'Caption - 12px',{...theme.body,size:12})],
    body_color:palette[2].value,body_background_background:'classic',body_background_color:'#FFFFFF',
    link_normal_color:theme.link,link_hover_color:palette[0].value,
    button_text_color:readableInk(palette[0].value),button_background_background:'classic',button_background_color:palette[0].value,
    button_border_radius:dimensions(theme.button.radius),container_width:slider(theme.contentWidth)};
  const setType=(prefix,t)=>{
    s[`${prefix}_typography`]='custom';s[`${prefix}_font_family`]=t.family;s[`${prefix}_font_size`]=slider(t.size);
    s[`${prefix}_font_weight`]=t.weight;s[`${prefix}_line_height`]=slider(t.lineHeight||1.5,'em');
    if(t.tablet){s[`${prefix}_font_size_tablet`]=slider(t.tablet);s[`${prefix}_font_size_mobile`]=slider(t.mobile);}
  };
  setType('body_typography',theme.body);setType('button_typography',theme.button);
  theme.headings.forEach((h,i)=>{s[`h${i+1}_color`]=palette[2].value;setType(`h${i+1}_typography`,h);});
  return {document:{content:[],settings:s,metadata:[]},theme:{...theme,palette},fontIds,smallId,captionId};
}

export function buildGuide(raw,{title='Style Guide',noindex=true}={}) {
  const {document:settingsDocument,theme,fontIds,smallId,captionId}=buildSiteSettings(raw);
  let next=1;const id=()=>`a${(next++).toString(16).padStart(6,'0')}`;
  const e=escapeHtml,white=theme.palette.find(c=>c.value==='#FFFFFF').id,black=theme.palette.find(c=>c.value==='#000000').id;
  const widget=(kind,settings,label)=>({id:id(),elType:'widget',widgetType:kind,settings:{...settings,_title:label},elements:[],isInner:false});
  const text=(html,font='text',color='text',cls='')=>widget('text-editor',{editor:html,_css_classes:cls,__globals__:{typography_typography:ref('typography',font),text_color:ref('colors',color)}},'Text specimen');
  const heading=(label,tag='h2',font=fontIds[1],color='text',cls='')=>widget('heading',{title:e(label),header_size:tag,_css_classes:cls,__globals__:{typography_typography:ref('typography',font),title_color:ref('colors',color)}},label);
  const box=(children,label,cls='',anchor='',background=null)=>{
    for(const child of children)if(child.elType==='container')child.isInner=true;
    return {id:id(),elType:'container',isInner:false,elements:children,settings:{_title:label,content_width:'full',flex_direction:'column',padding:dimensions(0),flex_gap:{unit:'px',size:20,column:'20',row:'20',isLinked:true},css_classes:cls,
      ...(anchor?{_element_id:anchor}:{}),...(background?{background_background:'classic',__globals__:{background_color:ref('colors',background)}}:{})}};
  };
  const colorInk=id=>{const c=theme.palette.find(c=>c.id===id);return readableInk(c.value)==='#FFFFFF'?white:black;};
  const button=(label,color='primary',outline=false)=>widget('button',{text:e(label),link:{url:'#sg-buttons'},_css_classes:'esg-button',
    ...(outline?{background_color:'#FFFFFF00',border_border:'solid',border_width:dimensions(1)}:{}),
    __globals__:{typography_typography:ref('typography','accent'),button_text_color:ref('colors',outline?color:colorInk(color)),
      ...(outline?{border_color:ref('colors',color)}:{background_color:ref('colors',color)}),hover_color:ref('colors',colorInk('primary')),button_background_hover_color:ref('colors','primary')}},`Button: ${label}`);
  const section=(number,label,intro,children,anchor)=>box([text(`<p>${number} / ${e(label.toUpperCase())}</p>`,smallId,'primary','esg-kicker'),heading(label),text(`<p>${e(intro)}</p>`,'text','text','esg-intro'),...children],label,'esg-section',anchor);
  const css=guideCss(theme);
  const style=widget('html',{html:`<style>${css}</style>`},'Style guide layout CSS (scoped to this page)');
  const masthead=box([text(`<p><strong>${e(theme.name.toUpperCase())}</strong></p>`,'accent','primary','esg-brand'),text('<p>Website style guide</p>',smallId)],'Guide masthead','esg-masthead');
  const hero=box([
    box([text('<p>OUR DIGITAL DESIGN REFERENCE</p>',smallId,'secondary','esg-kicker'),heading('Style guide','h1',fontIds[0],'primary'),text(`<p>A shared reference for the colors, typography, buttons, and layouts that bring ${e(theme.name)} together.</p>`,'text','text','esg-intro')],'Introduction','esg-hero-copy'),
    box([text('<p>ONE CONSISTENT EXPERIENCE</p>',smallId,colorInk('primary'),'esg-kicker'),heading('The details make the difference.','h3',fontIds[3],colorInk('primary')),text('<p>Recognizable colors. Clear hierarchy. Familiar interactions. Use this guide to keep the website feeling connected.</p>',smallId,colorInk('primary'))],'Brand note','esg-brand-note','','primary'),
  ],'Introduction','esg-hero','sg-top');
  const nav=text('<nav aria-label="Style guide sections"><a href="#sg-typography">Typography</a><a href="#sg-colors">Colors</a><a href="#sg-buttons">Buttons</a><a href="#sg-samples">Sample sections</a><a href="#sg-details">Shape &amp; layout</a></nav>','text','primary','esg-nav');
  const faces=box([
    box([heading('Aa Bb Cc','h3',fontIds[2],'primary'),text(`<p><strong>${e(theme.headings[0].family)}</strong><br>Headings<br>ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>abcdefghijklmnopqrstuvwxyz<br>0123456789 &amp; ! ?</p>`,smallId)],'Heading typeface','esg-card'),
    box([text('<p class="esg-body-sample">Aa Bb Cc</p>'),text(`<p><strong>${e(theme.body.family)}</strong><br>Body &amp; buttons<br>ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>abcdefghijklmnopqrstuvwxyz<br>0123456789 &amp; ! ?</p>`,smallId)],'Body typeface','esg-card'),
  ],'Typefaces','esg-two-col');
  const scale=theme.headings.map((h,i)=>box([text(`<p><strong>H${i+1}</strong><br>${h.size}px / ${e(h.weight)}</p>`,smallId,'primary'),heading(`Heading ${i+1}`,h.tag,fontIds[i],'text','esg-specimen')],`H${i+1} specimen`,'esg-type-row'));
  const body=box([
    box([heading('Normal text','h3',fontIds[4]),text('<p>Good design makes a website feel clear, welcoming, and easy to explore. Use short paragraphs and give each message room to breathe.</p><p>This is <strong>bold text</strong>, this is <em>italic text</em>, and this is an <a href="#sg-buttons">inline link</a>.</p>'),text('<p>Small text / 14px. Supporting details and secondary information.</p>',smallId),text('<p>Caption / 12px. Short labels and captions.</p>',captionId)],'Body text specimens','esg-card'),
    box([heading('Text in context','h3',fontIds[4]),text('<ul><li>Clear, helpful language</li><li>Short, readable paragraphs</li><li>Consistent color and type</li></ul><ol><li>Introduce the message.</li><li>Explain the next step.</li><li>Make the action easy to find.</li></ol><blockquote>A consistent experience starts with the small details.</blockquote>')],'Lists and quotation','esg-card'),
  ],'Body examples','esg-two-col');
  const typography=section('01','Typography',`${theme.headings[0].family} for headings. ${theme.body.family} for supporting content.`,[faces,box(scale,'Heading scale','esg-scale'),body,heading('Font weights','h3',fontIds[4]),box([400,600,700].map(w=>text(`<p style="font-weight:${w}">Aa — ${w}</p>`)),'Font weights','esg-three-col')],'sg-typography');
  const swatches=theme.palette.map(c=>box([box([],`${c.title} swatch`,'esg-swatch','',c.id),text(`<p><strong>${e(c.title)}</strong><br><code>${c.value}</code></p>`,smallId)],c.title,'esg-color-card'));
  const gradients=theme.gradients.map((g,i)=>box([box([],`Gradient ${i+1}`,`esg-gradient esg-gradient-${i}`),text(`<p>Gradient ${i+1}</p>`,smallId)],`Gradient ${i+1}`,'esg-color-card'));
  const palette=section('02','Colors','The global palette brings a consistent visual language to every page.',[
    box(swatches.slice(0,4),'Core palette','esg-palette'),...(swatches.length>4?[heading('Supporting palette','h3',fontIds[4]),box(swatches.slice(4),'Supporting palette','esg-palette')]:[]),
    ...(gradients.length?[heading('Gradients','h3',fontIds[4]),box(gradients,'Gradients','esg-three-col')]:[]),
    text('<p>Use high-contrast combinations for text. Accent colors are best used with a clear purpose.</p>',smallId),
  ],'sg-colors');
  const buttons=section('03','Buttons',`The default button uses ${theme.button.family}, weight ${theme.button.weight}, and a ${theme.button.radius}px corner radius.`,[
    box([button('Primary'),button('Secondary','secondary'),button('Dark','text'),button('Light',white)],'Filled buttons','esg-button-row'),
    box([button('Primary outline','primary',true),button('Dark outline','text',true),text('<p><a href="#sg-typography">Text link →</a></p>')],'Outline buttons','esg-button-row'),
    text('<p>Hover or focus the examples to inspect their interaction state. Specimen links stay inside this guide.</p>',smallId),
  ],'sg-buttons');
  const sample=(dark)=>box([
    text(`<p>SAMPLE / ${dark?'DARK':'LIGHT'} BACKGROUND</p>`,smallId,dark?colorInk('primary'):'primary','esg-kicker'),
    heading(dark?'A consistent experience, everywhere.':'A warm welcome starts here.','h2',fontIds[1],dark?colorInk('primary'):'text'),
    text('<p>Bring a page section together with a clear headline, a short introduction, and one useful action. Give the content room to breathe.</p>','text',dark?colorInk('primary'):'text'),
    box([button(dark?'Light action':'Primary action',dark?white:'primary'),button('Learn more',dark?'accent':'text',!dark)],'Sample actions','esg-button-row'),
  ],dark?'Dark sample':'Light sample','esg-sample','',dark?'primary':white);
  const samples=section('04','Sample sections','The global styles working together in complete page sections.',[sample(false),sample(true)],'sg-samples');
  const radiusValues=theme.radii.length?theme.radii:['4px','20px',`${theme.button.radius}px`,'50%'];
  const shapes=radiusValues.map((r,i)=>box([box([],`Radius ${r}`,`esg-shape esg-shape-${i}`,'','primary'),text(`<p>${e(r)}</p>`,smallId)],`Radius ${r}`,'esg-color-card'));
  const shadows=theme.shadows.map((s,i)=>box([text(`<p>Shadow ${i+1}</p>`,smallId)],`Shadow ${i+1}`,`esg-shadow esg-shadow-${i}`,'',white));
  const details=section('05','Shape & layout','Small details create a familiar rhythm across the website.',[
    heading('Corner radius','h3',fontIds[4]),box(shapes,'Radii','esg-shape-grid'),
    ...(shadows.length?[heading('Shadows','h3',fontIds[4]),box(shadows,'Shadows','esg-three-col')]:[]),
    heading('Content width','h3',fontIds[4]),text(`<p><strong>${theme.contentWidth}px</strong> is the global content width. Use the site’s Elementor breakpoints for responsive layouts.</p>`),
  ],'sg-details');
  const footer=box([text(`<p><strong>${e(theme.name.toUpperCase())}</strong><br>Website style reference</p>`,smallId,'primary'),text('<p><a href="#sg-top">Back to top ↑</a></p>',smallId)],'Guide footer','esg-footer');
  const root=box([style,masthead,hero,nav,typography,palette,buttons,samples,details,footer],'Style Guide','esg-style-guide');
  root.settings.content_width='boxed';root.settings.boxed_width=slider(theme.contentWidth);
  const metadata={esg_style_guide:'1',_wp_page_template:'elementor_canvas',...(noindex?{'_yoast_wpseo_meta-robots-noindex':'1',rank_math_robots:['noindex','follow']}:{})};
  return {siteSettings:settingsDocument,page:{content:[root],settings:{hide_title:'yes',page_layout:'elementor_canvas'},metadata},theme,title:String(title).slice(0,100)};
}

function guideCss(theme) {
  const s='.esg-style-guide',primary='var(--e-global-color-primary)',text='var(--e-global-color-text)';
  const radii=theme.radii.length?theme.radii:['4px','20px',`${theme.button.radius}px`,'50%'];
  return `${s}{padding:32px 28px 64px;--widgets-spacing:0px;color:${text}}${s} p:last-child{margin-bottom:0}${s} code{font-size:12px;color:inherit;background:none;padding:0}${s} .elementor-heading-title{overflow-wrap:anywhere}${s} .esg-masthead,${s} .esg-footer{display:flex;flex-direction:row;justify-content:space-between;align-items:center;gap:24px;padding-bottom:24px;border-bottom:1px solid #e9edf3}${s} .esg-masthead>.elementor-widget,${s} .esg-footer>.elementor-widget{width:auto}${s} .esg-brand{letter-spacing:.1em}${s} .esg-hero{display:grid;grid-template-columns:1.65fr 1fr;gap:56px;padding:48px 0 32px;align-items:center}${s} .esg-brand-note{padding:30px;border-radius:20px;gap:18px}${s} .esg-kicker{letter-spacing:.12em;line-height:1.5}${s} .esg-intro{max-width:760px;line-height:1.8}${s} .esg-nav{padding:18px 0;border-block:1px solid #e9edf3}${s} .esg-nav nav{display:flex;flex-wrap:wrap;gap:14px 28px}${s} .esg-nav a{font-size:14px;font-weight:600;color:${primary};text-decoration:none}${s} .esg-nav a:hover{text-decoration:underline}${s} .esg-section{padding:64px 0;gap:24px;border-bottom:1px solid #e9edf3;scroll-margin-top:24px}${s} .esg-two-col{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:36px}${s} .esg-card{padding:28px;background:#f0f3f7;border-radius:20px;gap:20px;overflow-wrap:anywhere}${s} .esg-body-sample{font-size:45px;line-height:1.2}${s} .esg-scale{gap:0;margin:16px 0}${s} .esg-type-row{display:grid;grid-template-columns:160px minmax(0,1fr);gap:24px;align-items:center;padding:24px 0;border-bottom:1px solid #e9edf3}${s} blockquote{margin:24px 0 0;padding:12px 0 12px 20px;border-left:3px solid var(--e-global-color-secondary);font-style:italic}${s} .esg-three-col{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}${s} .esg-palette{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:28px 22px}${s} .esg-color-card{gap:14px;min-width:0}${s} .esg-swatch{min-height:120px;border-radius:20px;border:1px solid #1a2e3b20}${s} .esg-gradient{min-height:140px;border-radius:20px}${s} .esg-button-row{display:flex;flex-direction:row;flex-wrap:wrap;align-items:center;gap:16px}${s} .esg-button-row>.elementor-widget{width:auto}${s} .esg-button .elementor-button{padding:16px 28px;transition:background-color .2s,color .2s}${s} a:focus-visible{outline:3px solid ${primary};outline-offset:4px}${s} .esg-sample{padding:44px;border-radius:20px;gap:22px;border:1px solid #e9edf3}${s} .esg-sample>.elementor-widget-text-editor{max-width:760px;line-height:1.8}${s} .esg-shape-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:24px}${s} .esg-shape{min-height:96px;aspect-ratio:1;max-width:120px}${s} .esg-shadow{padding:36px 24px;border-radius:20px}${s} .esg-footer{padding:28px 0 0;border:0}${theme.gradients.map((g,i)=>`${s} .esg-gradient-${i}{background:${g}}`).join('')}${radii.map((r,i)=>`${s} .esg-shape-${i}{border-radius:${r}}`).join('')}${theme.shadows.map((v,i)=>`${s} .esg-shadow-${i}{box-shadow:${v}}`).join('')}@media(max-width:1024px){${s} .esg-hero{gap:28px;grid-template-columns:1.3fr 1fr}${s} .esg-palette{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:767px){${s}{padding:24px 20px 40px}${s} .esg-masthead,${s} .esg-footer{align-items:flex-start;flex-direction:column;gap:8px}${s} .esg-hero{grid-template-columns:1fr;gap:28px;padding:32px 0 20px}${s} .esg-nav nav{gap:12px 20px}${s} .esg-section{padding:44px 0}${s} .esg-two-col,${s} .esg-three-col{grid-template-columns:1fr;gap:24px}${s} .esg-type-row{grid-template-columns:1fr;gap:12px}${s} .esg-palette{grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 16px}${s} .esg-sample{padding:28px 24px}${s} .esg-shape-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}${s} .esg-card{padding:24px 20px}}`;
}

export function buildKitFiles(raw,options={}) {
  const result=buildGuide(raw,options),title=result.title;
  const manifest={name:'website-style-guide',title:`${result.theme.name} - Style Guide`,description:'Global styles and an editable Elementor style guide page.',author:'Style Kit',version:'3.0',elementor_version:ELEMENTOR_VERSION,created:new Date().toISOString().replace('T',' ').slice(0,19),thumbnail:false,site:result.theme.sourceUrl,plugins:[],
    'site-settings':{theme:false,globalColors:true,globalFonts:true,themeStyleSettings:true,generalSettings:true,experiments:false,customCode:false,customIcons:false,customFonts:false},
    content:{page:{'1':{title,excerpt:'Website design system reference.',doc_type:'wp-page',thumbnail:false,url:new URL('/style-guide/',result.theme.sourceUrl).href,terms:[]}}}};
  const files={'manifest.json':manifest,'site-settings.json':result.siteSettings,'content/page/1.json':result.page};
  validateKitFiles(files);return files;
}

export function validateKitFiles(files) {
  const manifest=files['manifest.json'],settings=files['site-settings.json']?.settings;
  if(!manifest||manifest.version!=='3.0'||!settings)throw new Error('Kit manifest or site settings are missing.');
  const colorIds=new Set([...settings.system_colors,...settings.custom_colors].map(c=>c._id)),fontIds=new Set([...settings.system_typography,...settings.custom_typography].map(t=>t._id));
  const elementIds=new Set();
  const walk=nodes=>{if(!Array.isArray(nodes))throw new Error('Page content is not an element array.');for(const n of nodes){
    if(!/^[a-f\d]{7}$/.test(n.id)||elementIds.has(n.id))throw new Error('Invalid or duplicate Elementor element ID.');elementIds.add(n.id);
    for(const v of Object.values(n.settings?.__globals__||{})){const match=/^globals\/(colors|typography)\?id=([\w-]+)$/.exec(v);if(!match||!(match[1]==='colors'?colorIds:fontIds).has(match[2]))throw new Error('Page references a missing global style.');}
    if(n.elType==='container')for(const child of n.elements||[])if(child.elType==='container'&&!child.isInner)throw new Error('Nested container has an invalid root flag.');
    walk(n.elements||[]);
  }};
  for(const id of Object.keys(manifest.content.page)) {const page=files[`content/page/${id}.json`];if(!page?.settings||!page.metadata)throw new Error('Manifest page payload is missing.');walk(page.content);}
  return true;
}

export function buildKitZip(theme,options) {
  const files=buildKitFiles(theme,options);
  return zipSync(Object.fromEntries(Object.entries(files).map(([path,data])=>[path,strToU8(JSON.stringify(data))])),{level:6});
}
