from pathlib import Path
import sys,subprocess
D=Path(__file__).resolve().parents[1]
root=Path.cwd()
tmp=Path('/tmp/selector-3c-location').read_text().strip()+'/e2e-isolated/tmp'
file=Path('packages/app/src/desktop/browser/automation/handler.ts')
base=file.read_bytes()
assert base==subprocess.check_output(['git','show','HEAD:'+str(file)])
for phase in ('control','mutant'):
 name='catalog-agent-'+phase
 (D/name).mkdir(exist_ok=True)
 try:
  if phase=='mutant':
   assert base.count(b'  await waitForBrowserHydration();')==1
   file.write_bytes(base.replace(b'  await waitForBrowserHydration();', b'  await browserHost?.listProfiles?.();\n  await waitForBrowserHydration();'))
   (D/'mutations/agent-e2e.diff').write_bytes(subprocess.check_output(['git','diff','--',str(file)]))
  p=subprocess.run([D/'scripts/run',name,'env','TMPDIR='+tmp,'PASEO_DESKTOP_BROWSER_E2E_ARTIFACT_DIR='+str(D/name),'node',D/'scripts/catalog-agent-contract.mjs'])
  print(phase,p.returncode,flush=True)
  if phase=='control' and p.returncode: break
 finally:
  if phase=='mutant': file.write_bytes(base)
assert subprocess.run(['git','diff','--exit-code','--',str(file)]).returncode==0
print('Verified restoration',subprocess.check_output(['git','hash-object',str(file)],text=True).strip())
