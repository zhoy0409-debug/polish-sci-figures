package org.polishscifigures.studio.preview;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Exercises real Android org.json parsing, without making any network request. */
@RunWith(AndroidJUnit4.class)
public final class UpdateCheckerTest {
    private JSONObject release(String version) throws Exception {
        String tag="figure-studio-local-preview-20261014", name="polish-sci-figures-Studio-"+version+"-Android-preview.apk";
        return new JSONObject().put("draft",false).put("prerelease",true).put("tag_name",tag)
            .put("html_url",UpdatePolicy.RELEASES+"/tag/"+tag).put("published_at","2026-10-14T00:00:00Z")
            .put("assets",new JSONArray().put(new JSONObject().put("name",name).put("state","uploaded").put("size",60000000)
                .put("browser_download_url",UpdatePolicy.RELEASES+"/download/"+tag+"/"+name)));
    }
    @Test public void comparesApplicationVersionNotSuiteTag() throws Exception {
        JSONObject result=UpdateChecker.select(new JSONArray().put(release("0.1.9")).put(release("0.1.10")),"0.1.9");
        assertEquals("update-available",result.getString("status"));assertEquals("0.1.10",result.getString("latestVersion"));
        assertTrue(result.getString("downloadUrl").endsWith("-Android-preview.apk"));
        assertEquals("up-to-date",UpdateChecker.select(new JSONArray().put(release("0.1.9")),"0.1.10").getString("status"));
    }
    @Test public void rejectsDraftsWrongPlatformAndUntrustedUrls() throws Exception {
        JSONObject draft=release("9.0.0").put("draft",true), bad=release("9.0.0"), other=release("9.0.0");
        bad.getJSONArray("assets").getJSONObject(0).put("browser_download_url","https://evil.invalid/app.apk");
        other.getJSONArray("assets").getJSONObject(0).put("name","polish-sci-figures-Studio-9.0.0-Setup-x64.exe");
        JSONObject result=UpdateChecker.select(new JSONArray().put(draft).put(bad).put(other),"0.1.7");
        assertEquals("unavailable",result.getString("status"));assertFalse(result.has("downloadUrl"));assertFalse(result.has("latestVersion"));
    }
    @Test public void rejectsInvalidReleaseFieldsAndOversizeMetadata() throws Exception {
        JSONObject invalid=release("0.1.8");invalid.getJSONArray("assets").getJSONObject(0).put("size",true);
        assertEquals("unavailable",UpdateChecker.select(new JSONArray().put(invalid),"0.1.7").getString("status"));
        JSONArray many=new JSONArray();for(int i=0;i<31;i++)many.put(release("0.1.8"));
        try{UpdateChecker.select(many,"0.1.7");fail("Release metadata must be bounded");}catch(IllegalArgumentException expected){}
    }
}
