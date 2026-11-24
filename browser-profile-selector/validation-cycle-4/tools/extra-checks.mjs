// Load the shipped test entrypoint and add validator observations to the in-memory
// test module. The checked-out app, daemon, Electron main and bridge stay at HEAD.
import { registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
const runner = pathToFileURL(resolve('packages/desktop/e2e/browser-tabs.e2e.mjs')).href;
const fixture = pathToFileURL(resolve('packages/desktop/e2e/browser-profiles.electron.mjs')).href;
const extra = readFileSync(new URL('./extra-journey.inc', import.meta.url),'utf8');
registerHooks({load(url,ctx,next){
  const item=next(url,ctx);
  if(url!==fixture && url!==runner) return item;
  let source=Buffer.from(item.source).toString();
  if(url===runner) {
    source=source.replaceAll('Desktop browser workspace ${index + 1}','Café ${index + 1}');
  } else {
    source=source.replace('await held;', 'await new Promise(resolve => setTimeout(resolve, 8000));');
    source=source.slice(0,source.indexOf('  try {\n    await inspect(`global.profileExampleRequests')) + extra + '\n}';
  }
  return {...item,source};
}});
process.env.PASEO_DESKTOP_BROWSER_PROFILES_ONLY='1';
await import(runner);
