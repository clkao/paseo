  const assert = (await import("node:assert/strict")).default;
  const result = {};
  const record = (key, value) => {
    result[key] = value;
    fs.writeFileSync(path.join(artifactDir, "extra.json"), JSON.stringify(result,null,2));
    console.log(key,JSON.stringify(value));
  };
  const menu=()=>page.locator('[data-menu-surface="true"]:visible');
  await workspace(0);
  const autoName = "Café 1", oldName = autoName.normalize("NFD");
  await blank();
  await expect(picker()).toContainText(autoName);
  await screenshot("trigger");
  await picker().click();
  await expect(menuGroup(project)).toBeVisible();
  await menu().evaluate(async e=>{ for(let n=e;n;n=n.parentElement) await Promise.all(n.getAnimations().map(a=>a.finished)); });
  await screenshot("two-groups");
  await menuGroup(project).getByText("Create new project profile…",{exact:true}).click();
  await page.getByTestId("browser-create-profile-input").fill(oldName);
  await page.getByTestId("browser-create-profile-submit").click();
  const error = page.getByTestId("browser-create-profile-error");
  await expect(error).toHaveText("A profile with this name already exists in this group.");
  await screenshot("canonical-name-error");
  record("equivalentAutomatic", {entered:oldName,automatic:autoName,message:await error.innerText()});
  await page.getByTestId("browser-create-profile-cancel").click();
  await expect(picker()).toContainText(autoName);
  await picker().click();
  await menuGroup("Shared").getByText("Create new shared profile…",{exact:true}).click();
  await page.getByTestId("browser-create-profile-input").fill("default");
  await page.getByTestId("browser-create-profile-submit").click();
  const reserved=page.getByTestId("browser-create-profile-error");
  await expect(reserved).toHaveText("This name is reserved. Choose another name.");
  record("reservedMessage",await reserved.innerText());
  await screenshot("reserved-name-error");
  await page.getByTestId("browser-create-profile-cancel").click();
  const long="International collaboration and customer experience research workspace profile";
  await create("Shared",long,long);
  const geometry=await picker().evaluate(e=>{
    const t=[...e.querySelectorAll('*')].find(n=>n.childNodes.length===1 && n.firstChild.nodeType===3);
    const icon=e.querySelector('svg').getBoundingClientRect(), frame=e.getBoundingClientRect();
    return {caption:t.textContent,scroll:t.scrollWidth,visible:t.clientWidth,overflow:getComputedStyle(t).textOverflow,frame:frame.toJSON(),chevron:icon.toJSON()};
  });
  await screenshot("long-label-chevron");
  record("geometry",geometry);
  assert(geometry.scroll>geometry.visible && geometry.chevron.width>0 && geometry.chevron.right<=geometry.frame.right && geometry.frame.height===28);
  await create(project,"Café","Café");
  await create(project,"Cafe","Cafe");
  await choose("Café");
  await expect.poll(()=>active().getAttribute("partition")).toMatch(/-cafe$/);
  const accented=await active().getAttribute("partition");
  await choose("Cafe");
  await expect.poll(()=>active().getAttribute("partition")).toMatch(/-cafe-2$/);
  const plain=await active().getAttribute("partition");
  record("accentedAndPlain",{accented,plain});
  assert.notEqual(accented,plain);
  await picker().focus();
  await page.keyboard.press("Enter");
  const first=menuGroup("Shared").getByRole("menuitem",{name:"default",exact:true});
  await expect(first).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(picker()).toHaveText("Shared › default");
  record("keyboard",await picker().innerText());
  await go("file:///unsupported");
  await expect(page.getByText("Blocked unsupported browser URL: file:",{exact:true})).toBeVisible();
  await expect(picker()).toBeVisible();
  record("unsupported",{caption:await picker().innerText(),url:await active().evaluate(v=>v.getURL())});

  async function visit(account,click) {
    await go(url);
    await expect(label()).toBeVisible();
    await page.waitForFunction(async()=> {
      const v=document.querySelector('[data-paseo-browser-surface][aria-hidden="false"] webview');
      return v?.executeJavaScript("!!document.querySelector('#account')").catch(()=>false);
    });
    const id=await activeId();
    if(click) await guest(id,`document.querySelectorAll("button")[${account==="Alice"?0:1}].click()`);
    const values=await guest(id,"({account:document.querySelector('#account').textContent,cookie:document.cookie,storage:localStorage.getItem('account')})");
    assert.deepEqual(values,{account,cookie:"account="+account,storage:account});
    return {id,caption:await label().innerText(),partition:await active().getAttribute("partition"),...values};
  }
  record("eightSecondResponse", await checkDelayedRegistration(tool));
  const catalogFile=await inspect("return process.mainModule.require('path').join(process.mainModule.require('electron').app.getPath('userData'),'browser-profiles.json')");
  const bytes=fs.readFileSync(catalogFile);
  try {
    fs.writeFileSync(catalogFile,"{");
    const automaticTab=await tool("browser_new_tab",{});
    assert(automaticTab.browserId);
    const listed=(await tool("browser_list_tabs",{})).tabs.filter(t=>t.browserId===automaticTab.browserId);
    assert.equal(listed.length,1);
    record("agentWithUnreadableCatalog",{id:automaticTab.browserId,url:automaticTab.url,listed:listed.length});
  } finally { fs.writeFileSync(catalogFile,bytes); }
  const legacy=await visit("Alice",true);
  await blank();
  const originalAuto=await visit("Alice",true);
  await blank();
  await create(project,"Cafe 1","Cafe 1");
  const originalNamed=await visit("Bob",true);
  // Recreate the persisted cycle-2 catalog spelling without touching either
  // Electron partition. The two original sessions already hold different users.

  const cat=JSON.parse(fs.readFileSync(catalogFile));
  const row=cat.profiles.find(x=>x.name==="Cafe 1");
  row.name=oldName;
  fs.writeFileSync(catalogFile,JSON.stringify(cat));
  // Reproduce legacy missing fields and the named tab's persisted old caption.
  await page.evaluate(({legacyId,namedId,oldName})=>{
    const key="workspace-browser-store",saved=JSON.parse(localStorage.getItem(key));
    const records=saved.state.browsersById;
    delete records[legacyId].profile; delete records[legacyId].phase;
    records[namedId].profile.name=oldName;
    localStorage.setItem(key,JSON.stringify(saved));
  },{legacyId:legacy.id,namedId:originalNamed.id,oldName});
  page=await restart();
  await workspace(0);
  await focus(legacy.id);
  await expect(label()).toHaveText("Shared › default");
  assert.equal(await guest(legacy.id,"document.cookie"),"account=Alice");
  record("legacy",{id:legacy.id,caption:await label().innerText(),cookie:await guest(legacy.id,"document.cookie")});
  const restored=[];
  for(const original of [originalAuto,originalNamed]){
    await focus(original.id);
    const expectedLabel=project+" › "+(original===originalAuto?autoName+" (Workspace)":oldName);
    await expect(label()).toHaveText(expectedLabel);
    const actual=await guest(original.id,"({account:document.querySelector('#account').textContent,cookie:document.cookie,storage:localStorage.getItem('account')})");
    assert.equal(actual.account,original.account);
    assert.equal(actual.cookie,original.cookie);
    assert.equal(actual.storage,original.storage);
    const partition=await active().getAttribute("partition");
    assert.equal(partition,original.partition);
    restored.push({id:original.id,caption:await label().innerText(),partition,...actual});
    await screenshot(original===originalAuto?"old-automatic":"old-named");
  }
  assert.notEqual(restored[0].caption.normalize("NFC"),restored[1].caption.normalize("NFC"));
  record("oldCollision",{before:[originalAuto,originalNamed],after:restored});
  return result;
