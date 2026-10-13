package org.polishscifigures.studio.preview;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.util.Log;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.espresso.intent.Intents;
import androidx.test.uiautomator.*;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import static androidx.test.espresso.intent.Intents.intending;
import static androidx.test.espresso.intent.matcher.IntentMatchers.hasAction;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class LocalEngineInstrumentedTest {
    private ActivityScenario<MainActivity> scenario;
    private final JSONObject proof = new JSONObject();
    private String eval(String script) throws Exception {
        CountDownLatch complete = new CountDownLatch(1); AtomicReference<String> result = new AtomicReference<>();
        scenario.onActivity(activity -> activity.webViewForTests().evaluateJavascript(script, value -> { result.set(value); complete.countDown(); }));
        assertTrue("WebView response timed out", complete.await(10,TimeUnit.SECONDS)); return result.get();
    }
    private void until(String expression, long seconds) throws Exception {
        long end = System.nanoTime() + TimeUnit.SECONDS.toNanos(seconds);
        while(System.nanoTime()<end) {
            if("true".equals(eval(expression))) return;
            Thread.sleep(200);
        }
        fail("Timed out: " + expression + " | " + eval("JSON.stringify(window.__androidQa || {})"));
    }
    private JSONObject result(String variable) throws Exception {
        Object value = new JSONTokener(eval("JSON.stringify("+variable+")")).nextValue();
        return new JSONObject((String)value);
    }
    private void restoredEditorFrame() throws Exception {
        // Density changes may recreate the Activity. A correct innerWidth alone
        // does not prove that autosave restoration or the compositor has finished.
        until("document.readyState==='complete' && typeof StudioLibrary!=='undefined' && !!document.querySelector('[data-alignment-guide=\"'+JSON.parse(localStorage.getItem('android-instrumentation-workspace')||'{}').guideId+'\"]') && !document.getElementById('undo').disabled",60);
        CountDownLatch drawn = new CountDownLatch(1);
        scenario.onActivity(activity -> {
            android.webkit.WebView view = activity.webViewForTests();
            view.postVisualStateCallback(System.nanoTime(),new android.webkit.WebView.VisualStateCallback() {
                @Override public void onComplete(long id) {
                    view.postOnAnimation(() -> view.postOnAnimation(drawn::countDown));
                }
            });
        });
        assertTrue("Restored editor frame did not draw",drawn.await(15,TimeUnit.SECONDS));
    }
    private void recordFrame(String key) throws Exception {
        JSONObject frame=result("({width:innerWidth,height:innerHeight,scale:devicePixelRatio,documentWidth:document.documentElement.scrollWidth,restoredGuide:!!document.querySelector('[data-alignment-guide=\"'+JSON.parse(localStorage.getItem('android-instrumentation-workspace')).guideId+'\"]')})");
        scenario.onActivity(activity -> {
            android.webkit.WebView view=activity.webViewForTests();int[] position=new int[2];view.getLocationOnScreen(position);
            try {frame.put("nativeLeft",position[0]);frame.put("nativeTop",position[1]);frame.put("nativeWidth",view.getWidth());frame.put("nativeHeight",view.getHeight());}
            catch(JSONException error){throw new RuntimeException(error);}
        });
        assertTrue("WebView must be below the status bar",frame.getInt("nativeTop")>0);
        assertEquals(frame.getInt("nativeWidth"),frame.getDouble("width")*frame.getDouble("scale"),2.0);
        assertTrue(frame.getBoolean("restoredGuide"));proof.put(key,frame);
    }
    private byte[] read(Uri uri) throws Exception {
        try(InputStream in=InstrumentationRegistry.getInstrumentation().getContext().getContentResolver().openInputStream(uri); ByteArrayOutputStream out=new ByteArrayOutputStream()) {
            byte[] buffer=new byte[8192]; int count; while((count=in.read(buffer))>=0) out.write(buffer,0,count); return out.toByteArray();
        }
    }
    private void verifyLiteratureLinkHandoff() throws Exception {
        // Click the real target=_blank anchor. Espresso captures ACTION_VIEW,
        // so CI verifies native handoff without opening a browser or networking.
        Intents.init();
        try {
            intending(hasAction(Intent.ACTION_VIEW)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_CANCELED, null));
            eval("(()=>{const a=document.createElement('a');a.id='android-literature-link';a.textContent='Open paper QA';a.href='https://europepmc.org/articles/PMC12345#Fig-2';a.target='_blank';a.rel='noopener noreferrer';a.style.cssText='position:fixed;top:16px;left:16px;z-index:2147483647;background:white;color:black;padding:24px';document.body.append(a)})()");
            UiObject2 link = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).wait(Until.findObject(By.text("Open paper QA")), 10000);
            assertNotNull("A public-paper link must be accessible", link); link.click();
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();
            for (int attempt=0; attempt<50 && Intents.getIntents().stream().noneMatch(intent -> Intent.ACTION_VIEW.equals(intent.getAction())); attempt++) Thread.sleep(100);
            Intents.intended(hasAction(Intent.ACTION_VIEW));
            Intent handoff = Intents.getIntents().stream().filter(intent -> Intent.ACTION_VIEW.equals(intent.getAction())).findFirst().orElseThrow(() -> new AssertionError("No browser handoff"));
            assertEquals("https://europepmc.org/articles/PMC12345#Fig-2", handoff.getDataString());
            assertEquals(MainActivity.START, new JSONTokener(eval("location.href")).nextValue());
            proof.put("literaturePaperHandoff", "User gesture opens validated target=_blank paper link through ACTION_VIEW; captured by Espresso");
        } finally {
            eval("document.getElementById('android-literature-link')?.remove()"); Intents.release();
        }
    }
    private void saveToFixture(String name, String expression, byte[] expected) throws Exception {
        Uri destination=Uri.parse("content://"+FixtureProvider.AUTHORITY+"/"+name);
        Intents.init();
        try {
            intending(hasAction(Intent.ACTION_CREATE_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK,new Intent().setData(destination).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION)));
            eval("window.__androidSave=null; (async()=>{try{window.__androidSave=await StudioNativeBridge.saveBlob("+expression+","+JSONObject.quote(name)+");}catch(e){window.__androidSave={error:String(e)}}})()");
            until("!!window.__androidSave",60);
            JSONObject saved=result("window.__androidSave"); assertTrue(saved.toString(),saved.optBoolean("saved"));
            assertEquals(expected.length,saved.getLong("bytes")); assertArrayEquals(expected,read(destination));
        } finally { Intents.release(); }
    }
    private void openSavedProject(Uri source, boolean confirm) throws Exception {
        Intents.init();
        try {
            intending(hasAction(Intent.ACTION_OPEN_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK,new Intent().setData(source).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)));
            eval("document.getElementById('projectMenu').open=true");
            UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
            UiObject open=device.findObject(new UiSelector().text("Open project"));
            assertTrue("Actual Open project command is visible",open.waitForExists(10000));open.click();
            UiObject message=device.findObject(new UiSelector().resourceId("android:id/message"));
            assertTrue("Native JavaScript confirmation must be shown",message.waitForExists(10000));
            assertTrue(message.getText(),message.getText().contains("Opening a project replaces the current workspace"));
            device.findObject(new UiSelector().resourceId(confirm?"android:id/button1":"android:id/button2")).click();
        } finally { Intents.release(); }
    }
    private void actualProjectRoundTrip() throws Exception {
        Uri saved=Uri.parse("content://"+FixtureProvider.AUTHORITY+"/project.json");
        Intents.init();
        try {
            intending(hasAction(Intent.ACTION_CREATE_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK,new Intent().setData(saved).addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)));
            UiObject save=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).findObject(new UiSelector().text("Save"));
            assertTrue(save.waitForExists(10000));save.click();
            until("document.getElementById('status').textContent==='Project downloaded with source assets, current edits and versions.'",30);
        } finally { Intents.release(); }
        JSONObject payload=new JSONObject(new String(read(saved),StandardCharsets.UTF_8));
        assertTrue(payload.has("project"));assertTrue(payload.has("history"));
        assertEquals(1,payload.getJSONObject("state").getJSONArray("alignmentGuides").length());
        eval("document.getElementById('addVerticalGuide').click()");
        until("document.querySelectorAll('[data-alignment-guide]').length===2",10);
        openSavedProject(saved,true);
        until("document.getElementById('status').textContent==='Project restored' && document.querySelectorAll('[data-alignment-guide]').length===1",15);
        eval("document.getElementById('addVerticalGuide').click()");
        until("document.querySelectorAll('[data-alignment-guide]').length===2",10);
        openSavedProject(saved,false);
        assertEquals("2",eval("document.querySelectorAll('[data-alignment-guide]').length"));
        openSavedProject(saved,true);
        until("document.getElementById('status').textContent==='Project restored' && document.querySelectorAll('[data-alignment-guide]').length===1",15);
        proof.put("actualProjectSaveOpenConfirmAndCancel",true);
        proof.put("sameProjectReopenedAfterCancel",true);
        proof.put("actualProjectFileBytes",read(saved).length);
    }
    @Test public void actualOfflineWebViewAnalysisFilesAndPersistence() throws Exception {
        Context target=InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals(PackageManager.PERMISSION_GRANTED,target.checkCallingOrSelfPermission("android.permission.INTERNET"));
        proof.put("internetPermission",true); proof.put("device",android.os.Build.MODEL); proof.put("api",android.os.Build.VERSION.SDK_INT);
        proof.put("ciLauncherDisabled",Boolean.parseBoolean(InstrumentationRegistry.getArguments().getString("ciLauncherDisabled","false")));
        scenario=ActivityScenario.launch(MainActivity.class);
        try {
            until("!!(window.StudioNativeBridge && window.StudioBrowserEngine && document.querySelector('#artboard'))",60);
            assertEquals("\"android\"",eval("StudioNativeBridge.platform"));
            assertEquals("true",eval("StudioNativeBridge.bundledAssets"));
            proof.put("phoneViewport",result("({width:innerWidth,height:innerHeight,scale:devicePixelRatio,userAgent:navigator.userAgent})"));
            // No service worker is needed for packaged resources.
            eval("window.__androidSw=null; navigator.serviceWorker.getRegistrations().then(x=>window.__androidSw=x.length)");
            until("window.__androidSw !== null",10); assertEquals("0",eval("window.__androidSw"));
            // Only our dedicated synthetic QA database is touched. User autosave keys are untouched.
            eval("window.__androidStored=null; (()=>{const r=indexedDB.open('studio-android-instrumentation-only',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onsuccess=()=>{const d=r.result,t=d.transaction('projects','readwrite');t.objectStore('projects').put({title:'Synthetic QA project',panels:[{id:'qa-panel',svg:'<svg xmlns=\"http://www.w3.org/2000/svg\"><text>QA only</text></svg>'}]},'qa-project');t.oncomplete=()=>{d.close();window.__androidStored=true}}})()");
            until("window.__androidStored===true",15);
            // Exercise the editor's real mutation/autosave/history, only in a fresh test profile.
            eval("window.__androidWorkspace=null;(async()=>{try{const records=await StudioLibrary.list('autosaves');if(localStorage.getItem('android-instrumentation-workspace')||records.length>1||records.some(r=>r.payload?.project.desktopStarter!==true||r.payload?.state.alignmentGuides?.length||r.payload?.project.panels.some(p=>p.provenance!=='blank-canvas')))throw Error('Use a fresh test profile; existing projects are never cleared');document.getElementById('addHorizontalGuide').click();for(let i=0;i<100;i++){const saved=(await StudioLibrary.list('autosaves')).find(r=>r.payload?.state.alignmentGuides?.length);if(saved){const value={projectId:saved.id,guideId:saved.payload.state.alignmentGuides[0].id,origin:location.origin,undoHistory:!!saved.payload.history};localStorage.setItem('android-instrumentation-workspace',JSON.stringify(value));window.__androidWorkspace=value;return;}await new Promise(r=>setTimeout(r,100));}throw Error('Autosave not completed')}catch(e){window.__androidWorkspace={error:String(e)}}})()");
            until("!!window.__androidWorkspace",20);
            JSONObject workspace=result("window.__androidWorkspace");assertFalse(workspace.toString(),workspace.has("error"));assertTrue(workspace.getBoolean("undoHistory"));
            scenario.recreate();
            until("!!window.StudioNativeBridge",60);
            eval("window.__androidRestored=null;(()=>{const r=indexedDB.open('studio-android-instrumentation-only',1);r.onsuccess=()=>{const d=r.result,q=d.transaction('projects').objectStore('projects').get('qa-project');q.onsuccess=()=>{window.__androidRestored=q.result;d.close()}}})()");
            until("!!window.__androidRestored",15);
            assertEquals("Synthetic QA project",result("window.__androidRestored").getString("title"));
            proof.put("indexedDbProjectAfterActivityRestart",true);
            until("!!document.querySelector('[data-alignment-guide=\"'+JSON.parse(localStorage.getItem('android-instrumentation-workspace')).guideId+'\"]')",20);
            proof.put("actualEditorAutosaveAfterActivityRestart",workspace);
            eval("document.getElementById('mobileTab-panels').click()");
            until("document.body.dataset.mobileTab==='panels'",10);
            UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).pressBack();
            until("document.body.dataset.mobileTab==='canvas'",10);
            eval("(()=>{const d=document.createElement('dialog');d.id='android-qa-dialog';d.textContent='Synthetic Back test';document.body.append(d);d.showModal()})()");
            UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).pressBack();
            until("!document.getElementById('android-qa-dialog').open",10);
            eval("document.getElementById('android-qa-dialog').remove()");
            proof.put("nativeBackClosesDrawerAndDialog",true);
            // Real WebView user gesture -> onShowFileChooser -> content URI -> FileReader.
            Intents.init();
            try {
                Uri input=Uri.parse("content://"+FixtureProvider.AUTHORITY+"/input.csv");
                intending(hasAction(Intent.ACTION_OPEN_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK,new Intent().setData(input).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)));
                eval("window.__androidImported=null;(()=>{let i=document.createElement('input');i.id='android-qa-input';i.type='file';i.accept='.csv';i.onchange=async()=>{try{window.__androidImported=await i.files[0].text()}catch(e){window.__androidImported='ERROR:'+e}};let b=document.createElement('button');b.textContent='Choose QA CSV';b.id='android-qa-picker';b.style='position:fixed;left:16px;top:60px;z-index:2147483647;background:white;color:black;padding:20px';b.onclick=()=>i.click();document.body.append(b,i)})()");
                UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
                UiObject button=device.findObject(new UiSelector().text("Choose QA CSV")); assertTrue(button.waitForExists(10000));button.click();
                until("window.__androidImported !== null",30);
                assertEquals(FixtureProvider.CSV,new JSONTokener(eval("window.__androidImported")).nextValue());
                eval("document.querySelector('#android-qa-picker').remove();document.querySelector('#android-qa-input').remove()");
                proof.put("fileChooserContentUriRead",true);
            } finally { Intents.release(); }
            // Native provider writes are byte-for-byte checked, including multiple bridge chunks.
            byte[] binary=new byte[600001];for(int i=0;i<binary.length;i++)binary[i]=(byte)(i%251);
            saveToFixture("figure.tif","new Blob([Uint8Array.from({length:600001},(_,i)=>i%251)],{type:'image/tiff'})",binary);
            String project="{\"title\":\"Synthetic 工程\",\"source\":\"QA only\"}";
            saveToFixture("project.json","new Blob(["+JSONObject.quote(project)+"],{type:'application/json'})",project.getBytes(StandardCharsets.UTF_8));
            Intents.init();
            try {
                intending(hasAction(Intent.ACTION_CREATE_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_CANCELED,null));
                eval("window.__androidSave=null;StudioNativeBridge.saveBlob(new Blob(['cancel']), 'cancelled.txt').then(x=>window.__androidSave=x).catch(e=>window.__androidSave={error:String(e)})");
                until("!!window.__androidSave",15);JSONObject cancelled=result("window.__androidSave");assertTrue(cancelled.optBoolean("cancelled"));assertFalse(cancelled.optBoolean("saved"));
            } finally { Intents.release(); }
            proof.put("nativeSaveBytes",600001);proof.put("saveCancellation",true);proof.put("savePickerMode","ACTION_CREATE_DOCUMENT result supplied by Espresso; real ContentResolver output write");
            actualProjectRoundTrip();
            // Fresh worker loads only APK assets, then runs the real SciPy/Matplotlib dispatcher.
            eval("window.__androidQa={state:'running'};(async()=>{try{const started=performance.now();const rows=[['group','unit','value'],...[1,2,4,5,8].map((v,i)=>['A','A'+i,String(v)]),...[2,4,6,9,11,14].map((v,i)=>['B','B'+i,String(v)])];const config={mode:'raw',group:'group',value:'value',unit:'unit',design:'independent',method:'welch',family:'all_pairs',design_confirmed:true,unit_role:'independent_experimental_unit'};const a=await StudioBrowserEngine.fetch('/api/analyze',{method:'POST',body:JSON.stringify({recipe:{},rows,config})});const analysis=await a.json();if(!a.ok)throw Error(JSON.stringify(analysis));const r=await StudioBrowserEngine.fetch('/api/render',{method:'POST',body:JSON.stringify({recipe:{family:'gallery',parameters:{view:'compare_bar_points'},font:'Arial'},rows,statistics:config})});const rendered=await r.json();if(!r.ok)throw Error(JSON.stringify(rendered));window.__androidGeneratedSvg=rendered.panel.variants[0].svg;window.__androidQa={state:'done',p:analysis.analysis.primary_test.pairwise[0].p,variants:rendered.panel.variants.length,svg:window.__androidGeneratedSvg.includes('<svg'),durationMs:performance.now()-started,engine:StudioBrowserEngine.status()}}catch(e){window.__androidQa={state:'error',error:String(e),engine:StudioBrowserEngine.status()}}})()");
            until("window.__androidQa.state !== 'running'",420);
            JSONObject calculation=result("window.__androidQa");assertEquals(calculation.toString(),"done",calculation.getString("state"));
            assertEquals(0.13380466116494624,calculation.getDouble("p"),1e-12);assertTrue(calculation.getBoolean("svg"));assertTrue(calculation.getInt("variants")>=1);proof.put("calculation",calculation);
            String generated=(String)new JSONTokener(eval("window.__androidGeneratedSvg")).nextValue();
            saveToFixture("export.svg","new Blob([window.__androidGeneratedSvg],{type:'image/svg+xml'})",generated.getBytes(StandardCharsets.UTF_8));
            proof.put("generatedSvgSavedExactly",true);
            // Exercise the real packaged OpenCV image-check path using only a
            // generated synthetic fixture and its exact copy, not research images.
            eval("window.__androidDuplicate={state:'running'};(async()=>{try{const started=performance.now(),canvas=document.createElement('canvas');canvas.width=256;canvas.height=192;const ctx=canvas.getContext('2d');ctx.fillStyle='#172338';ctx.fillRect(0,0,256,192);for(let i=0;i<70;i++){ctx.fillStyle='rgb('+((i*31)%255)+','+((i*67)%255)+','+((i*97)%255)+')';ctx.beginPath();ctx.arc((i*73)%256,(i*47)%192,2+i%8,0,Math.PI*2);ctx.fill()}const data=canvas.toDataURL('image/png'),send=async body=>{const response=await StudioBrowserEngine.fetch('/api/image-duplicates',{method:'POST',body:JSON.stringify(body)}),value=await response.json();if(!response.ok)throw Error(JSON.stringify(value));return value};const job=await send({action:'start',images:[{id:'android-qa-a',label:'Synthetic QA original',data},{id:'android-qa-b',label:'Synthetic QA exact copy',data}]});for(let i=0;i<600;i++){const status=await send({action:'result',jobId:job.jobId});if(status.status==='complete'){const result=status.result,match=result.matches[0];window.__androidDuplicate={state:'done',schema:result.schema,images:result.images.length,matches:result.matches.length,kind:match?.kind,evidence:!!match?.evidence?.startsWith('data:image/png;base64,'),reviewPreviews:result.images.every(image=>image.reviewPreview?.startsWith('data:image/png;base64,')),durationMs:performance.now()-started};return}if(status.status==='error'||status.status==='cancelled')throw Error(JSON.stringify(status));await new Promise(resolve=>setTimeout(resolve,400))}throw Error('Image check timed out')}catch(error){window.__androidDuplicate={state:'error',error:String(error)}}})()");
            until("window.__androidDuplicate.state!=='running'",250);
            JSONObject duplicate=result("window.__androidDuplicate");assertEquals(duplicate.toString(),"done",duplicate.getString("state"));
            assertEquals("image-duplicate-check/1",duplicate.getString("schema"));assertEquals(2,duplicate.getInt("images"));assertEquals(1,duplicate.getInt("matches"));
            assertEquals("exact",duplicate.getString("kind"));assertTrue(duplicate.getBoolean("evidence"));assertTrue(duplicate.getBoolean("reviewPreviews"));proof.put("imageDuplicateCheck",duplicate);
            // Same-origin POST and external navigation/fetch cannot reach a remote service.
            eval("window.__androidDenied=null;Promise.all([fetch('./forbidden-qa',{method:'POST',body:'synthetic'}).then(r=>r.status).catch(()=>-1),fetch('https://example.invalid/qa').then(r=>r.status).catch(()=>-1)]).then(x=>window.__androidDenied=x)");
            until("!!window.__androidDenied",15);assertEquals("403",eval("window.__androidDenied[0]"));
            scenario.onActivity(activity->{try{proof.put("localAssetRequests",activity.localAssetRequests.get());proof.put("deniedRequests",activity.deniedRequests.get());proof.put("literatureRequests",activity.literatureRequests.get());}catch(JSONException error){throw new RuntimeException(error);}});
            assertTrue(proof.getInt("localAssetRequests")>20);assertTrue(proof.getInt("deniedRequests")>=1);
            assertEquals("Startup, analysis and export must not query literature automatically",0,proof.getInt("literatureRequests"));
            verifyLiteratureLinkHandoff();
            // Actual emulator display/density overrides exercise tablet WebView layouts.
            File screenshots=new File(target.getExternalFilesDir(null),"qa");screenshots.mkdirs();
            UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
            restoredEditorFrame();recordFrame("phoneEditorFrame");
            device.takeScreenshot(new File(screenshots,"android-phone.png"));
            device.executeShellCommand("wm density 240");device.executeShellCommand("wm size 1600x2560");
            until("innerWidth >= 1000 && innerHeight > innerWidth",15);
            restoredEditorFrame();recordFrame("tabletPortraitViewport");
            assertEquals("true",eval("document.documentElement.scrollWidth <= innerWidth+2"));
            device.takeScreenshot(new File(screenshots,"android-tablet-portrait.png"));
            device.executeShellCommand("wm size 2560x1600");
            until("innerWidth >= 1600 && innerWidth > innerHeight",15);
            restoredEditorFrame();recordFrame("tabletLandscapeViewport");
            assertEquals("true",eval("document.documentElement.scrollWidth <= innerWidth+2"));
            device.takeScreenshot(new File(screenshots,"android-tablet-landscape.png"));
            proof.put("passed",true);
        } finally {
            File dir=new File(target.getExternalFilesDir(null),"qa");dir.mkdirs();
            try(FileOutputStream out=new FileOutputStream(new File(dir,"android-runtime-proof.json"))){out.write(proof.toString(2).getBytes(StandardCharsets.UTF_8));}
            UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(new File(dir,"android-editor.png"));
            UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).executeShellCommand("wm size reset");
            UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).executeShellCommand("wm density reset");
            Log.i("STUDIO_ANDROID_QA",proof.toString());
            if(scenario!=null)scenario.close();
        }
    }
}
