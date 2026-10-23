// Longest matching rule wins; Allow wins ties. Supports * and terminal $.
export function robotsPolicy(text, agent='ElementorStyleGuide') {
  const groups=[];let group=null,hasRules=false;const sitemaps=[];
  for (const line of String(text).split(/\r?\n/)) {
    const clean=line.replace(/\s*#.*$/,'').trim(),colon=clean.indexOf(':');
    if (colon<0) continue;
    const key=clean.slice(0,colon).toLowerCase(),value=clean.slice(colon+1).trim();
    if (key==='sitemap') {sitemaps.push(value);continue;}
    if (key==='user-agent') {
      if (!group||hasRules) {group={agents:[],rules:[],delay:0};groups.push(group);hasRules=false;}
      group.agents.push(value.toLowerCase());
    } else if (group&&['allow','disallow'].includes(key)) {hasRules=true;if(value) group.rules.push({allow:key==='allow',path:value});}
    else if (group&&key==='crawl-delay') {hasRules=true;group.delay=Number(value)||0;}
  }
  const score=g=>Math.max(-1,...g.agents.map(a=>a==='*'?0:agent.toLowerCase().includes(a)?a.length:-1));
  const best=Math.max(-1,...groups.map(score)),selected=groups.filter(g=>score(g)===best&&best>=0);
  const rules=selected.flatMap(g=>g.rules).map(r=>{
    const end=r.path.endsWith('$'),raw=end?r.path.slice(0,-1):r.path;
    const pattern=raw.split('*').map(v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*');
    return {...r,length:raw.replace(/\*/g,'').length,re:new RegExp('^'+pattern+(end?'$':''))};
  });
  return {sitemaps,delay:Math.min(10000,Math.max(0,...selected.map(g=>g.delay*1000))),allows(url){
    const u=new URL(url);const matches=rules.filter(r=>r.re.test(u.pathname+u.search)).sort((a,b)=>b.length-a.length||Number(b.allow)-Number(a.allow));
    return matches[0]?.allow??true;
  }};
}

export function sitemapLocations(xml) {
  if (typeof xml!=='string'||xml.length>5_000_000||/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Unsupported sitemap XML.');
  const decode=s=>s.replace(/&(?:amp|lt|gt|quot|apos);/g,m=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[m]));
  return {index:/<(?:[\w-]+:)?sitemapindex[\s>]/i.test(xml),urls:[...xml.matchAll(/<(?:[\w-]+:)?loc\b[^>]*>\s*(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))\s*<\/(?:[\w-]+:)?loc>/gi)].map(m=>decode((m[1]??m[2]).trim())).slice(0,50000)};
}
