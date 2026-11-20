import { chromium, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
const out=path.resolve('.dev/validation-66805ba/evidence');
const connection=await chromium.connectOverCDP('http://127.0.0.1:24770');
const page=connection.contexts()[0].pages().find(p=>p.url().startsWith('http://127.0.0.1:24768'));
page.setDefaultTimeout(12000);
const mode=process.argv[2]??'inspect';
const fixture='http://127.0.0.1:24769/';
const scope=page.getByRole('button',{name:/Browser sessions:/});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const photograph=async name=>{await page.mouse.move(3,3);await pause(300);await page.screenshot({path:path.join(out,name+'.png')});console.log('captured',name);};
const projectRow=name=>page.getByRole('button',{name,exact:true});
async function setScope(label) {
  if(await scope.getAttribute('aria-label')==='Browser sessions: '+label) return;
  await scope.click();
  await page.getByText(label,{exact:true}).last().click();
  await expect(scope).toHaveAccessibleName('Browser sessions: '+label);
  await expect(scope).toBeEnabled();
  const settings=await page.evaluate(()=>window.paseoDesktop.invoke('get_desktop_settings'));
  console.log('persisted',settings.browser);
}
try {
 if(mode==='inspect'){console.log(page.url(),(await page.locator('body').innerText()).slice(0,3600));console.log(await page.locator('[role=button]').evaluateAll(els=>els.map(x=>x.getAttribute('aria-label')).filter(Boolean).slice(0,80))); }
 if(mode==='clear'){
   const observations=JSON.parse(await fs.readFile(path.join(out,'accounts.json'),'utf8'));
   await page.evaluate(()=>window.paseoDesktop.browser.clearProfile([]));
   for(const item of observations){
     await projectRow(item.project).click();
     const guest=page.locator('webview[partition="'+item.partition+'"]');
     await expect.poll(()=>guest.evaluate(e=>e.executeJavaScript('document.querySelector("h1")?.textContent')).catch(()=>'' )).toBe('Sign in');
     console.log('After clear:',item.project,'Sign in',item.url);
   }
 }
 if(mode==='settings'){
   if(!await scope.isVisible()){
     const close=page.getByTestId('add-host-method-modal').getByRole('button',{name:'Close',exact:true});
     if(await close.isVisible())await close.click();
     await page.getByRole('button',{name:'Settings',exact:true}).click();
     if(!await scope.isVisible())await page.getByRole('navigation',{name:'Settings'}).getByRole('button',{name:'General',exact:true}).click();
   }
   await scope.scrollIntoViewIfNeeded();
   for(const [key,label] of [['shared','Shared'],['workspace','Per workspace'],['project','Per project']]){
     await setScope(label); await expect(scope).toHaveAccessibleName('Browser sessions: '+label);
     await photograph('settings-'+key);
   }
   await scope.click(); for(const label of ['Shared','Per project','Per workspace']) await expect(page.getByText(label,{exact:true}).last()).toBeVisible(); await photograph('settings-choices'); await page.keyboard.press('Escape');
   await page.locator('[data-testid="settings-back-to-workspace"]:visible').click();
 }
 if(mode==='accounts'){
   const settings=await page.evaluate(()=>window.paseoDesktop.invoke('get_desktop_settings'));
   if(settings.browser.sessionScope!=='project')throw Error('Expected Per project');
   const observations=[];
   for(const [project,account,label] of [['Northwind','northwind-qa','Northwind tester'],['Contoso','contoso-qa','Contoso tester']]){
     await projectRow(project).click(); await pause(700);
     const address=page.getByRole('textbox',{name:'Browser URL'}).last();
     if(!await address.isVisible()) await page.keyboard.press('Control+Shift+b');
     const guest=page.locator('div[aria-hidden="false"] > webview').last();
     await expect(guest).toBeAttached();
     await expect.poll(()=>guest.evaluate(e=>e.isLoading()).catch(()=>true)).toBe(false);
     await expect(async()=>{
       if(await guest.evaluate(e=>e.getURL())!==fixture) {
         await address.click(); await address.fill(fixture); await address.press('Enter');
       }
       await expect.poll(()=>guest.evaluate(e=>e.getURL()),{timeout:1500}).toBe(fixture);
     }).toPass({timeout:12000});
     await expect.poll(async()=>guest.evaluate(e=>e.getURL()).catch(()=>''),{timeout:12000}).toBe(fixture);
     const evalGuest=expr=>guest.evaluate((e,expr)=>e.executeJavaScript(expr,true),expr);
     await expect.poll(()=>evalGuest('document.querySelector("h1")?.textContent')).toBe('Sign in');
     await evalGuest('document.querySelector("button[value='+account+']").click()');
     await expect.poll(()=>evalGuest('document.querySelector("strong")?.textContent')).toBe(label);
     observations.push({project,account,partition:await guest.getAttribute('partition'),url:await guest.evaluate(e=>e.getURL())});
   }
   if(new Set(observations.map(x=>x.partition)).size!==2)throw Error('Expected two partitions');
   for(const item of observations){
     await projectRow(item.project).click();
     const guest=page.locator('webview[partition="'+item.partition+'"]');
     await guest.evaluate(e=>e.reload());
     await expect.poll(()=>guest.evaluate(e=>e.executeJavaScript('document.body.innerText')).catch(()=>'' )).toContain(item.account+'@example.test');
     item.afterReload=await guest.evaluate(e=>e.executeJavaScript('document.body.innerText')); console.log(item.project,item.url,item.afterReload); await photograph('account-'+item.account);
   }
   await fs.writeFile(path.join(out,'accounts.json'),JSON.stringify(observations,null,2)+'\n');
 }
} finally {await connection.close();}
