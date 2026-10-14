/* Run the same real synthetic localization cases in the bundled offline runtime.
 * Requires an existing build_local_web_preview.py output; downloads are disabled. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runtime=path.resolve(process.argv[2]||path.join(root,'.cache/local-web-preview/runtime'));
const bundle=path.dirname(runtime);
let requests=0;
globalThis.fetch=async()=>{requests++;throw new Error('Network prohibited in image-link localization test');};
const {loadPyodide}=await import(pathToFileURL(path.join(runtime,'pyodide.mjs')));
const py=await loadPyodide({indexURL:runtime+path.sep,stdout:console.log,stderr:console.error});
await py.loadPackage(['numpy','pillow','opencv-python']);
py.FS.mkdirTree('/qa');
for(const relative of ['skills/polish-sci-figures/scripts/studio_duplicates.py','skills/polish-sci-figures/scripts/studio_image_links.py','scripts/test_image_duplicates.py','scripts/test_studio_image_links.py']){
  const source=fs.readFileSync(path.join(root,relative)),bytes=relative.startsWith('skills/')?fs.readFileSync(path.join(bundle,'python',relative)):source;
  assert.ok(bytes.equals(source),'Rebuild the browser bundle before testing changed source: '+relative);py.FS.writeFile('/qa/'+path.basename(relative),bytes);
}
const bootstrap=fs.readFileSync(path.join(bundle,'engine-bootstrap.py'),'utf8');assert.equal(bootstrap,fs.readFileSync(path.join(root,'web/engine-bootstrap.py'),'utf8'),'Dispatcher bundle must be current');
const progress=[];globalThis._studio_progress=encoded=>progress.push(JSON.parse(encoded));
await py.runPythonAsync(bootstrap);
const started=performance.now();
const result=JSON.parse(await py.runPythonAsync(`
import sys, json, unittest
sys.path.insert(0, '/qa')
import test_studio_image_links
suite = unittest.defaultTestLoader.loadTestsFromModule(test_studio_image_links)
result = unittest.TextTestRunner(verbosity=1).run(suite)
parent = test_studio_image_links.ImageLinkTests.parent
payload = {'images': [test_studio_image_links.item('parent', parent),
           {**test_studio_image_links.item('child', parent),
            'roi': {'x': 110/640, 'y': 80/480, 'w': 410/640, 'h': 310/480}}]}
api = json.loads(_studio_dispatch('/api/image-links', json.dumps(payload)))
assert api['status'] == 200 and api['body']['status'] == 'matched', api
assert api['body']['coordinateSpace'] == 'decoded-image-normalized'
assert json.loads(_studio_dispatch('/api/image-links', json.dumps({'images': []})))['status'] == 422
assert json.loads(_studio_dispatch('/api/image-links', json.dumps({**payload, 'url': 'https://untrusted.invalid'})))['status'] == 422
json.dumps(dict(passed=result.wasSuccessful(), tests=result.testsRun,
               failures=len(result.failures), errors=len(result.errors), dispatcherPassed=True))
`));
assert.equal(result.passed,true,JSON.stringify(result));
assert.ok(progress.some(p=>p.stage==='pairs'&&p.completed===1),'Real dispatcher progress is delivered');
assert.equal(requests,0,'No remote request is permitted, including runtime downloads');
console.log(JSON.stringify({...result,networkRequests:requests,elapsedMs:Math.round(performance.now()-started),runtime:'bundled Pyodide'},null,2));
