package org.polishscifigures.studio.preview;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

/** Run separately after force-stopping the app, using only the prior synthetic fixture. */
@RunWith(AndroidJUnit4.class)
public class WorkspaceRestartInstrumentedTest {
    @Test public void realEditorAutosaveSurvivesProcessRestart() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            JSONObject result=null;
            for(int attempt=0;attempt<100;attempt++) {
                CountDownLatch done=new CountDownLatch(1);AtomicReference<String> value=new AtomicReference<>();
                scenario.onActivity(activity->activity.webViewForTests().evaluateJavascript("JSON.stringify((()=>{const p=JSON.parse(localStorage.getItem('android-instrumentation-workspace')||'null');if(!p||p.origin!==location.origin||!document.querySelector('[data-alignment-guide=\"'+p.guideId+'\"]'))return null;return {...p,restored:true,undoEnabled:!document.getElementById('undo').disabled}})())", text->{value.set(text);done.countDown();}));
                assertTrue(done.await(10,TimeUnit.SECONDS));
                Object decoded=new JSONTokener(value.get()).nextValue();
                if(decoded instanceof String && !"null".equals(decoded)){result=new JSONObject((String)decoded);break;}
                Thread.sleep(200);
            }
            assertNotNull("Actual editor guide was not restored after process restart",result);
            assertTrue(result.getBoolean("restored"));assertTrue(result.getBoolean("undoEnabled"));
            result.put("passed",true);result.put("processRestart",true);
            File directory=new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null),"qa");directory.mkdirs();
            try(FileOutputStream out=new FileOutputStream(new File(directory,"android-process-restart-proof.json"))){out.write(result.toString(2).getBytes(StandardCharsets.UTF_8));}
        }
    }
}
