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
    private byte[] read(Uri uri) throws Exception {
        try(InputStream in=InstrumentationRegistry.getInstrumentation().getContext().getContentResolver().openInputStream(uri); ByteArrayOutputStream out=new ByteArrayOutputStream()) {
            byte[] buffer=new byte[8192]; int count; while((count=in.read(buffer))>=0) out.write(buffer,0,count); return out.toByteArray();
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
    @Test public void actualOfflineWebViewAnalysisFilesAndPersistence() throws Exception {
        Context target=InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals(PackageManager.PERMISSION_DENIED,target.checkCallingOrSelfPermission("android.permission.INTERNET"));
        proof.put("internetPermission",false); proof.put("device",android.os.Build.MODEL); proof.put("api",android.os.Build.VERSION.SDK_INT);
        scenario=ActivityScenario.launch(MainActivity.class);
        try {
            until("!!(window.StudioNativeBridge && window.StudioBrowserEngine && document.querySelector('#artboard'))",60);
            assertEquals("\"android\"",eval("StudioNativeBridge.platform"));
            assertEquals("true",eval("StudioNativeBridge.bundledAssets"));
            // No service worker is needed for packaged resources.
            eval("window.__androidSw=null; navigator.serviceWorker.getRegistrations().then(x=>window.__androidSw=x.length)");
            until("window.__androidSw !== null",10); assertEquals("0",eval("window.__androidSw"));
            // Only our dedicated synthetic QA database is touched. User autosave keys are untouched.
            eval("window.__androidStored=null; (()=>{const r=indexedDB.open('studio-android-instrumentation-only',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onsuccess=()=>{const d=r.result,t=d.transaction('projects','readwrite');t.objectStore('projects').put({title:'Synthetic QA project',panels:[{id:'qa-panel',svg:'<svg xmlns=\"http://www.w3.org/2000/svg\"><text>QA only</text></svg>'}]},'qa-project');t.oncomplete=()=>{d.close();window.__androidStored=true}}})()");
            until("window.__androidStored===true",15);
            scenario.recreate();
            until("!!window.StudioNativeBridge",60);
            eval("window.__androidRestored=null;(()=>{const r=indexedDB.open('studio-android-instrumentation-only',1);r.onsuccess=()=>{const d=r.result,q=d.transaction('projects').objectStore('projects').get('qa-project');q.onsuccess=()=>{window.__androidRestored=q.result;d.close()}}})()");
            until("!!window.__androidRestored",15);
            assertEquals("Synthetic QA project",result("window.__androidRestored").getString("title"));
            proof.put("indexedDbProjectAfterActivityRestart",true);
            // Real WebView user gesture -> onShowFileChooser -> content URI -> FileReader.
            Intents.init();
            try {
                Uri input=Uri.parse("content://"+FixtureProvider.AUTHORITY+"/input.csv");
                intending(hasAction(Intent.ACTION_OPEN_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK,new Intent().setData(input).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)));
                eval("window.__androidImported=null;(()=>{let i=document.createElement('input');i.type='file';i.accept='.csv';i.onchange=async()=>{try{window.__androidImported=await i.files[0].text()}catch(e){window.__androidImported='ERROR:'+e}};let b=document.createElement('button');b.textContent='Choose QA CSV';b.id='android-qa-picker';b.style='position:fixed;left:16px;top:60px;z-index:2147483647;background:white;color:black;padding:20px';b.onclick=()=>i.click();document.body.append(b,i)})()");
                UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
                UiObject button=device.findObject(new UiSelector().text("Choose QA CSV")); assertTrue(button.waitForExists(10000));button.click();
                until("window.__androidImported !== null",30);
                assertEquals(FixtureProvider.CSV,new JSONTokener(eval("window.__androidImported")).nextValue());
                eval("document.querySelector('#android-qa-picker').remove()");
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
            // Fresh worker loads only APK assets, then runs the real SciPy/Matplotlib dispatcher.
            eval("window.__androidQa={state:'running'};(async()=>{try{const started=performance.now();const rows=[['group','unit','value'],...[1,2,4,5,8].map((v,i)=>['A','A'+i,String(v)]),...[2,4,6,9,11,14].map((v,i)=>['B','B'+i,String(v)])];const config={mode:'raw',group:'group',value:'value',unit:'unit',design:'independent',method:'welch',family:'all_pairs',design_confirmed:true,unit_role:'independent_experimental_unit'};const a=await StudioBrowserEngine.fetch('/api/analyze',{method:'POST',body:JSON.stringify({recipe:{},rows,config})});const analysis=await a.json();if(!a.ok)throw Error(JSON.stringify(analysis));const r=await StudioBrowserEngine.fetch('/api/render',{method:'POST',body:JSON.stringify({recipe:{family:'gallery',parameters:{view:'compare_bar_points'},font:'Arial'},rows,statistics:config})});const rendered=await r.json();if(!r.ok)throw Error(JSON.stringify(rendered));window.__androidGeneratedSvg=rendered.panel.variants[0].svg;window.__androidQa={state:'done',p:analysis.analysis.primary_test.pairwise[0].p,variants:rendered.panel.variants.length,svg:window.__androidGeneratedSvg.includes('<svg'),durationMs:performance.now()-started,engine:StudioBrowserEngine.status()}}catch(e){window.__androidQa={state:'error',error:String(e),engine:StudioBrowserEngine.status()}}})()");
            until("window.__androidQa.state !== 'running'",420);
            JSONObject calculation=result("window.__androidQa");assertEquals(calculation.toString(),"done",calculation.getString("state"));
            assertEquals(0.13380466116494624,calculation.getDouble("p"),1e-12);assertTrue(calculation.getBoolean("svg"));assertTrue(calculation.getInt("variants")>=1);proof.put("calculation",calculation);
            String generated=(String)new JSONTokener(eval("window.__androidGeneratedSvg")).nextValue();
            saveToFixture("export.svg","new Blob([window.__androidGeneratedSvg],{type:'image/svg+xml'})",generated.getBytes(StandardCharsets.UTF_8));
            proof.put("generatedSvgSavedExactly",true);
            // Same-origin POST and external navigation/fetch cannot reach a remote service.
            eval("window.__androidDenied=null;Promise.all([fetch('./forbidden-qa',{method:'POST',body:'synthetic'}).then(r=>r.status).catch(()=>-1),fetch('https://example.invalid/qa').then(r=>r.status).catch(()=>-1)]).then(x=>window.__androidDenied=x)");
            until("!!window.__androidDenied",15);assertEquals("403",eval("window.__androidDenied[0]"));
            scenario.onActivity(activity->{try{proof.put("localAssetRequests",activity.localAssetRequests.get());proof.put("deniedRequests",activity.deniedRequests.get());}catch(JSONException error){throw new RuntimeException(error);}});
            assertTrue(proof.getInt("localAssetRequests")>20);assertTrue(proof.getInt("deniedRequests")>=1);
            proof.put("passed",true);
        } finally {
            File dir=new File(target.getExternalFilesDir(null),"qa");dir.mkdirs();
            try(FileOutputStream out=new FileOutputStream(new File(dir,"android-runtime-proof.json"))){out.write(proof.toString(2).getBytes(StandardCharsets.UTF_8));}
            UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(new File(dir,"android-editor.png"));
            Log.i("STUDIO_ANDROID_QA",proof.toString());
            if(scenario!=null)scenario.close();
        }
    }
}
