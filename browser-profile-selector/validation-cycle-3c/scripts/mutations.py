"""Run from the clean candidate root, with all baseline tests and Electron shut down."""
import pathlib,subprocess,sys,hashlib
D=pathlib.Path(__file__).resolve().parents[1]
root=pathlib.Path.cwd()
hook='app/src/desktop/browser/use-browser-tab-profile.ts'
catalog='desktop/src/features/browser-profile-catalog.ts'
profiles='app/src/desktop/browser/profiles.ts'
mutations=[
 ('neon-1',hook,'      selected?.slug ?? null,','      workspaceName,\n      selected?.slug ?? null,','src/desktop/browser/use-browser-tab-profile.test.tsx','workspace rename'),
 ('neon-2','desktop/src/features/browser-profile.ts','for (const live of liveSessions) result.add(live);','void liveSessions;','src/features/browser-profile.test.ts','clears and reloads a live guest'),
 ('neon-3',catalog,'code: "reserved"','code: "invalid"','src/features/browser-profile-catalog.test.ts','typed code'),
 ('neon-8',hook,'(browserHydrated && !hasRecord) || ','','src/desktop/browser/use-browser-tab-profile.test.tsx','missing or unreadable'),
 ('neon-9','desktop/src/features/browser-webviews/index.ts','  browserRegistry.unregisterWebContents(guest.id);','  // Mutation: only the destruction callback unregisters.','src/features/browser-webviews/index.test.ts','closes a never-navigated'),
 ('neon-10','app/src/desktop/browser/automation/handler.ts','  await waitForBrowserHydration();','  await browserHost?.listProfiles?.();\n  await waitForBrowserHydration();','src/desktop/browser/automation/handler.test.ts',None),
 ('normalization-1',catalog,'name.normalize("NFC").trim()','name.trim()','src/features/browser-profile-catalog.test.ts','canonically equivalent'),
 ('normalization-2',profiles,'name.normalize("NFC").trim()','name.trim()','src/desktop/browser/profiles.test.ts','canonically equivalent'),
 ('normalization-3',catalog,'name.normalize("NFC").trim()','name.normalize("NFD").replace(/\\p{M}+/gu, "").trim()','src/features/browser-profile-catalog.test.ts','canonically equivalent')]
for key,relative,old,new,test,pattern in mutations:
 if len(sys.argv)>1 and key not in sys.argv[1:]: continue
 pkg=relative.split('/')[0]
 file=root/'packages'/relative
 baseline=file.read_bytes()
 assert subprocess.check_output(['git','show','HEAD:packages/'+relative])==baseline
 data=baseline.decode()
 assert data.count(old)==1,(key,old)
 with (D/'mutations'/(key+'.log')).open('w') as out:
  try:
   file.write_text(data.replace(old,new))
   subprocess.run(['git','diff','--',str(file)],stdout=out,check=True)
   args=['../../node_modules/.bin/vitest','run',test,'--bail=1','--reporter=verbose']
   if pattern: args+=['-t',pattern]
   out.flush()
   p=subprocess.run([D/'scripts/run','mutant-'+key,*args],cwd=root/'packages'/pkg,stdout=out,stderr=subprocess.STDOUT)
  finally: file.write_bytes(baseline)
  assert subprocess.run(['git','diff','--exit-code','--',str(file)],stdout=out).returncode==0
  print('restored HEAD blob',subprocess.check_output(['git','hash-object',str(file)],text=True).strip(),file=out)
  print(key,p.returncode,flush=True)
