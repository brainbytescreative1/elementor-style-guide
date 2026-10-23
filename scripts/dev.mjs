import './build.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../dist/',import.meta.url)),port=Number(process.env.PORT)||4173;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  try {const url=new URL(req.url,'http://localhost'),pathname=decodeURIComponent(url.pathname);
    const testFiles={'/__test__/browser.html':'test/browser.html','/__test__/src/collector.js':'src/collector.js','/__test__/src/model.js':'src/model.js','/__test__/src/robots.js':'src/robots.js'};
    if(testFiles[pathname]){const file=new URL('../'+testFiles[pathname],import.meta.url);res.writeHead(200,{'Content-Type':types[extname(file.pathname)]||'text/plain','Cache-Control':'no-store'});res.end(await readFile(file));return;}
    const file=resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
    if(!file.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(403);res.end();return;}
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(file));
  }catch{if(!res.headersSent)res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit()));
