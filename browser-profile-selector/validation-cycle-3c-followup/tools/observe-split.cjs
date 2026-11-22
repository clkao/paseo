const {chromium} = require(require.resolve('playwright',{paths:[process.cwd()]}));
const fs = require('node:fs');
const {setTimeout:delay} = require('node:timers/promises');
(async()=>{
  const dir=process.argv[2];
  const port=fs.readFileSync(dir+'/desktop.log','utf8').match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/)[1];
  const browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);
  const page=browser.contexts()[0].pages().find(p=>p.url().startsWith('http://localhost:'));
  let previous=-1, split=false;
  while(!page.isClosed() && !fs.readFileSync(dir+'/command.log','utf8').includes('Finished ')){
    const rails=await page.evaluate(()=>{
      if(!location.pathname.endsWith('/workspace/desktop-browser-original')) return [];
      const deck=[...document.querySelectorAll('[data-testid^="workspace-deck-entry-"]')].find(e=>e.dataset.testid.endsWith(':desktop-browser-original') && e.getBoundingClientRect().width);
      if(!deck) return [];
      return [...deck.querySelectorAll('[data-testid="workspace-tabs-row"]')].filter(e=>e.getBoundingClientRect().width)
        .map(r=>[...r.querySelectorAll('[aria-selected=true]')].map(el=>el.dataset.testid));
    }).catch(()=>[]);
    if(rails.length!==previous && rails.length){
      console.log(new Date().toISOString(), 'visible rails',rails.length,'selected tabs',JSON.stringify(rails));
      if(rails.length===1 && split)break;
      if(rails.length===2)split=true;
    }
    previous=rails.length;
    await delay(350);
  }
  await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
