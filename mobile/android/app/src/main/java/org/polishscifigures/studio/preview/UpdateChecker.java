package org.polishscifigures.studio.preview;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import javax.net.ssl.HttpsURLConnection;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.regex.Matcher;

/** Fetches public update metadata only, separately from the editor and exports. */
final class UpdateChecker {
    static final long TTL = 86400000L;
    private final SharedPreferences preferences;
    private final String version;
    private JSONObject cached;
    private long checkedAt, failedAt;

    UpdateChecker(Context context) {
        preferences = context.getSharedPreferences("public-update-metadata", Context.MODE_PRIVATE);
        version = BuildConfig.VERSION_NAME.replaceFirst("-.*$", "");
        UpdatePolicy.compare(version, version);
        try {
            String raw = preferences.getString("offer", "");
            if (raw.length() > 32768 || !version.equals(preferences.getString("version", ""))) return;
            long stamp = preferences.getLong("checkedAt", 0);
            JSONObject offer = new JSONObject(raw);
            if (stamp > 0 && stamp <= System.currentTimeMillis()+300000 && validCached(offer)) { cached=offer; checkedAt=stamp; }
        } catch (Exception ignored) { /* Missing/corrupt cache is not an app error. */ }
    }

    static JSONObject select(JSONArray releases, String installed) throws Exception {
        if (releases.length() > 30) throw new IllegalArgumentException("Release metadata limit");
        JSONObject best = null; long newest = 0;
        for (int i = 0; i < releases.length(); i++) {
            JSONObject release = releases.optJSONObject(i); if (release == null) continue;
            if (!Boolean.FALSE.equals(release.opt("draft")) || !(release.opt("prerelease") instanceof Boolean)) continue;
            String tag = release.optString("tag_name"), releaseUrl = release.optString("html_url");
            if (!UpdatePolicy.tag(tag) || !releaseUrl.equals(UpdatePolicy.RELEASES + "/tag/" + tag)) continue;
            long published; try { published = Instant.parse(release.getString("published_at")).toEpochMilli(); } catch (Exception invalid) { continue; }
            JSONArray assets = release.optJSONArray("assets"); if (assets == null || assets.length() > 100) continue;
            for (int j = 0; j < assets.length(); j++) {
                JSONObject asset = assets.optJSONObject(j); if (asset == null || !"uploaded".equals(asset.optString("state"))) continue;
                Object size = asset.opt("size"); if (!(size instanceof Integer || size instanceof Long) || ((Number)size).longValue() <= 0 || ((Number)size).longValue() > 2000000000L) continue;
                String name = asset.optString("name"), url = asset.optString("browser_download_url");
                Matcher match = UpdatePolicy.ASSET.matcher(name); if (!match.matches() || !url.equals(UpdatePolicy.RELEASES + "/download/" + tag + "/" + name)) continue;
                String candidate = match.group(1);
                if (best == null || UpdatePolicy.compare(candidate, best.getString("latestVersion")) > 0 || (UpdatePolicy.compare(candidate, best.getString("latestVersion")) == 0 && published > newest)) {
                    newest = published;
                    best = new JSONObject().put("latestVersion", candidate).put("releaseUrl", releaseUrl).put("downloadUrl", url)
                        .put("assetName", name).put("assetBytes", size).put("releaseTag", tag).put("prerelease", release.getBoolean("prerelease"))
                        .put("status", UpdatePolicy.compare(candidate, installed) > 0 ? "update-available" : "up-to-date");
                }
            }
        }
        return best != null ? best : new JSONObject().put("status", "unavailable").put("reason", "no-installer").put("releaseUrl", UpdatePolicy.RELEASES);
    }

    private boolean validCached(JSONObject offer) throws Exception {
        if (offer.length()==3 && "unavailable".equals(offer.optString("status")) && "no-installer".equals(offer.optString("reason")) && UpdatePolicy.RELEASES.equals(offer.optString("releaseUrl"))) return true;
        JSONObject asset = new JSONObject().put("state", "uploaded").put("name", offer.opt("assetName")).put("size", offer.opt("assetBytes")).put("browser_download_url", offer.opt("downloadUrl"));
        JSONObject release = new JSONObject().put("draft", false).put("prerelease", offer.opt("prerelease")).put("tag_name", offer.opt("releaseTag")).put("html_url", offer.opt("releaseUrl")).put("published_at", "2026-01-01T00:00:00Z").put("assets", new JSONArray().put(asset));
        JSONObject validated = select(new JSONArray().put(release), version);
        if (validated.length() != offer.length()) return false;
        java.util.Iterator<String> keys=validated.keys();while(keys.hasNext()){String key=keys.next();if(!validated.get(key).equals(offer.opt(key)))return false;}return true;
    }

    private JSONObject result(JSONObject offer, boolean fromCache, boolean stale, String reason) throws Exception {
        JSONObject value = new JSONObject(offer.toString()).put("currentVersion", version).put("suiteVersion", "1.4.24")
            .put("platform", "android").put("architecture", "universal").put("channel", "preview").put("cached", fromCache).put("stale", stale);
        if (checkedAt > 0) value.put("checkedAt", Instant.ofEpochMilli(checkedAt).toString());
        if (reason != null) value.put("reason", reason);
        return value;
    }

    synchronized JSONObject check(boolean refresh) throws Exception {
        long now = System.currentTimeMillis();
        if (!refresh && cached != null && now-checkedAt < TTL) return result(cached, true, false, null);
        if (!refresh && failedAt > 0 && now-failedAt < TTL) return offline();
        try {
            JSONObject offer = select(fetch(), version);cached=offer;checkedAt=now;failedAt=0;
            preferences.edit().putString("version",version).putString("offer",offer.toString()).putLong("checkedAt",now).apply();
            return result(offer,false,false,null);
        } catch (Exception unavailable) { failedAt=now;return offline(); }
    }

    private JSONObject offline() throws Exception {
        if (cached != null) return result(cached,true,true,"offline");
        return result(new JSONObject().put("status","offline").put("releaseUrl",UpdatePolicy.RELEASES),false,false,"check-failed");
    }

    private static JSONArray fetch() throws Exception {
        HttpsURLConnection connection=(HttpsURLConnection)new URL(UpdatePolicy.API).openConnection();
        connection.setInstanceFollowRedirects(false);connection.setRequestMethod("GET");connection.setConnectTimeout(5000);connection.setReadTimeout(5000);connection.setUseCaches(false);
        connection.setRequestProperty("Accept","application/vnd.github+json");connection.setRequestProperty("User-Agent","Figure-Studio-Update-Check");connection.setRequestProperty("X-GitHub-Api-Version","2022-11-28");
        // This connection has no WebView cookies, authorization or body.
        long started=android.os.SystemClock.elapsedRealtime();
        try {
            if(connection.getResponseCode()!=200||!UpdatePolicy.API.equals(connection.getURL().toString()))throw new java.io.IOException("Metadata unavailable");
            if(connection.getContentLengthLong()>2000000)throw new java.io.IOException("Metadata limit");
            try(InputStream input=connection.getInputStream();ByteArrayOutputStream output=new ByteArrayOutputStream()){
                byte[] buffer=new byte[32768];int count;while((count=input.read(buffer))!=-1){if(output.size()+count>2000000||android.os.SystemClock.elapsedRealtime()-started>10000)throw new java.io.IOException("Metadata limit");output.write(buffer,0,count);}
                return new JSONArray(output.toString(StandardCharsets.UTF_8.name()));
            }
        }finally{connection.disconnect();}
    }
}
