// Bundles the installed, MIT-licensed hash.js without fetching dependencies.
const fs = require('node:fs'), path = require('node:path');
const root = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const ids = new Map(), modules = [];
function add(file) {
  if (ids.has(file)) return ids.get(file);
  const id = modules.length; ids.set(file, id); modules.push('');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/require\(['"]([^'"]+)['"]\)/g, (_, spec) => {
    const resolved = spec === 'inherits' ? path.join(root, 'inherits/inherits_browser.js') : require.resolve(spec, {paths:[path.dirname(file),root]});
    return `require(${add(resolved)})`;
  });
  modules[id] = `function(module,exports,require){\n${source}\n}`; return id;
}
const sha = add(require.resolve('hash.js/lib/hash/sha/256', {paths:[root]}));
const hmac = add(require.resolve('hash.js/lib/hash/hmac', {paths:[root]}));
const notice = ['hash.js','inherits','minimalistic-assert'].map(n => {
  const dir = path.join(root,n), f = fs.readdirSync(dir).find(f=>/^license/i.test(f));
  return n+'\n'+(f?fs.readFileSync(path.join(dir,f),'utf8'):fs.readFileSync(path.join(dir,'README.md'),'utf8').split('#### LICENSE')[1]);
}).join('\n\n');
fs.writeFileSync(path.join(__dirname,'../backend/Crypto.gs'), '// Vendored hash.js 1.1.7. MIT; see THIRD-PARTY-LICENSES.txt\nvar PortalCrypto=(function(){var modules=['+modules.join(',\n')+'];var cache={};function require(id){if(!cache[id]){var m=cache[id]={exports:{}};modules[id](m,m.exports,require);}return cache[id].exports;}return {sha256:require('+sha+'),hmac:require('+hmac+')};})();\n');
fs.writeFileSync(path.join(__dirname,'../backend/THIRD-PARTY-LICENSES.txt'),notice);
