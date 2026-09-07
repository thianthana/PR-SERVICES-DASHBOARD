// Run after adding service HTML files to web/. No Git credentials are used.
import {readdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../web/',import.meta.url);
const core=new Set(['index.html','login.html','dashboard.html','admin.html','reset-password.html']);
const files=[];
async function walk(url,prefix=''){
  for(const entry of await readdir(url,{withFileTypes:true})){
    if(!/^[a-zA-Z0-9_.-]+$/.test(entry.name)||entry.name.startsWith('.'))continue;
    if(entry.isDirectory()&&/^[a-zA-Z0-9_-]+$/.test(entry.name))await walk(new URL(entry.name+'/',url),prefix+entry.name+'/');
    if(entry.isFile()&&/^[a-zA-Z0-9_-]+\.html$/.test(entry.name)&&!core.has(entry.name)){
      const path=prefix+entry.name;
      const html=await readFile(new URL(entry.name,url),'utf8');
      if(!/service-guard\.js|Auth\.requireService\(/.test(html))throw Error('Missing service guard: '+path);
      files.push(path);
    }
  }
}
await walk(root);files.sort();
await writeFile(new URL('services-manifest.json',root),JSON.stringify({version:1,files},null,2)+'\n');
console.log('Service manifest:',files.length,'files in',fileURLToPath(root));
