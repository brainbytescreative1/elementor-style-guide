import { build } from 'esbuild';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=new URL('../',import.meta.url),dist=new URL('dist/',root);
await mkdir(dist,{recursive:true});await mkdir(new URL('examples/',dist),{recursive:true});
await mkdir(new URL('examples/collector-demo/',dist),{recursive:true});
await Promise.all([
  build({absWorkingDir:fileURLToPath(root),entryPoints:['src/app.js'],outfile:fileURLToPath(new URL('app.js',dist)),bundle:true,format:'esm',target:'es2022',tsconfigRaw:{},minify:true}),
  build({absWorkingDir:fileURLToPath(root),entryPoints:['src/collector.js'],outfile:fileURLToPath(new URL('collector.js',dist)),bundle:true,format:'iife',target:'es2022',tsconfigRaw:{},minify:true}),
  ...['index.html','styles.css','favicon.svg'].map(file=>copyFile(new URL('public/'+file,root),new URL(file,dist))),
  copyFile(new URL('examples/aloha-report.json',root),new URL('examples/aloha-report.json',dist)),
  ...['index.html','about.html','site.css'].map(file=>copyFile(new URL('examples/collector-demo/'+file,root),new URL('examples/collector-demo/'+file,dist))),
  writeFile(new URL('.nojekyll',dist),''),
]);
console.log('Built static GitHub Pages app in dist/');
