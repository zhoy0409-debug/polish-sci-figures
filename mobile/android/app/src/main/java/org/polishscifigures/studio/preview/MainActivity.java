package org.polishscifigures.studio.preview;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.DocumentsContract;
import android.view.View;
import android.webkit.*;
import android.widget.TextView;
import android.widget.Toast;
import androidx.webkit.*;
import org.json.JSONObject;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

public final class MainActivity extends Activity {
    static final String ORIGIN = "https://appassets.androidplatform.net";
    static final String START = ORIGIN + "/assets/www/starter.html";
    private static final int OPEN_FILE = 201, SAVE_FILE = 202;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final AtomicBoolean processing = new AtomicBoolean();
    final java.util.concurrent.atomic.AtomicInteger localAssetRequests = new java.util.concurrent.atomic.AtomicInteger();
    final java.util.concurrent.atomic.AtomicInteger deniedRequests = new java.util.concurrent.atomic.AtomicInteger();
    private WebView web;
    private WebViewAssetLoader assets;
    private ValueCallback<Uri[]> fileChoice;
    private ExportTransfer transfer;
    private JavaScriptReplyProxy transferReply;
    private volatile boolean destroyed;
    private final Runnable abandon = () -> io.execute(() -> endTransfer("Export expired / 导出已超时", false));

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(52, 90, 135));
        web = new WebView(this);
        web.setId(View.generateViewId());
        setContentView(web);
        web.setOnApplyWindowInsetsListener((view, insets) -> { view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom()); return insets; });
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            TextView notice = new TextView(this); notice.setText("Update Android System WebView to use this local preview. / 请更新 Android System WebView 后使用此本地预览版。"); notice.setPadding(32, 48, 32, 32); setContentView(notice); return;
        }
        assets = new WebViewAssetLoader.Builder().addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false); settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false); settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true); settings.setGeolocationEnabled(false);
        CookieManager.getInstance().setAcceptCookie(false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) { return localResponse(request); }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request.isForMainFrame() && request.getUrl().toString().equals(START)) return false;
                Toast.makeText(MainActivity.this, "External navigation is disabled in the local preview / 本地预览版不打开外部页面", Toast.LENGTH_SHORT).show(); return true;
            }
            @Override public void onReceivedSslError(WebView view, android.webkit.SslErrorHandler handler, android.net.http.SslError error) { handler.cancel(); }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                io.execute(() -> endTransfer("The editor stopped / 编辑器已停止", false));
                new AlertDialog.Builder(MainActivity.this).setMessage("The local editor stopped. Reopen it to restore the saved workspace. / 本地编辑器已停止，请重新打开恢复已保存的工作区。")
                    .setPositiveButton("Reopen / 重新打开", (dialog, which) -> recreate()).setNegativeButton("Close / 关闭", (dialog, which) -> finish()).show(); return true;
            }
        });
        // Asset loads from Web Workers and Service Workers must be local as well.
        ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) { return localResponse(request); }
        });
        ServiceWorkerWebSettings workerSettings = ServiceWorkerController.getInstance().getServiceWorkerWebSettings();
        workerSettings.setAllowContentAccess(false); workerSettings.setAllowFileAccess(false);
        WebViewCompat.addWebMessageListener(web, "StudioAndroidHost", Collections.singleton(ORIGIN), (view, message, sourceOrigin, isMainFrame, reply) -> {
            if (!isMainFrame || !ORIGIN.equals(sourceOrigin.toString()) || message.getType() != WebMessageCompat.TYPE_STRING) return;
            String raw = message.getData();
            if (raw == null || raw.length() > 265000) { replyError(reply, "", "Export message is too large"); return; }
            if (!processing.compareAndSet(false, true)) { String rejectedId = ""; try { rejectedId = new JSONObject(raw).optString("id"); } catch (Exception ignored) {} replyError(reply, rejectedId, "An export operation is already being processed"); return; }
            io.execute(() -> {
                try { handleExport(new JSONObject(raw), reply); }
                catch (Exception error) { String id = ""; try { id = new JSONObject(raw).optString("id"); } catch (Exception ignored) {} replyError(reply, id, error.getMessage()); if (transfer != null && transfer.id.equals(id)) endTransfer(null, false); }
                finally { processing.set(false); }
            });
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) { request.deny(); }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileChoice != null) fileChoice.onReceiveValue(null);
                fileChoice = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                intent.putExtra(Intent.EXTRA_LOCAL_ONLY, true);
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                ArrayList<String> types = new ArrayList<>();
                for (String accept : params.getAcceptTypes()) if (accept.matches("[A-Za-z0-9.+*-]+/[A-Za-z0-9.+*-]+")) types.add(accept);
                if (!types.isEmpty()) intent.putExtra(Intent.EXTRA_MIME_TYPES, types.toArray(new String[0]));
                try { startActivityForResult(intent, OPEN_FILE); }
                catch (Exception error) { fileChoice.onReceiveValue(null); fileChoice = null; Toast.makeText(MainActivity.this, "No local file picker / 没有可用的文件选择器", Toast.LENGTH_LONG).show(); }
                return true;
            }
        });
        web.setDownloadListener((url, agent, disposition, mime, size) -> Toast.makeText(this, "Use the editor Export or Save command / 请使用编辑器的导出或保存按钮", Toast.LENGTH_LONG).show());
        // Remove only this app's abandoned staging files, never selected input files.
        io.execute(() -> { File[] stale = getCacheDir().listFiles((dir, name) -> name.startsWith("studio-export-") && name.endsWith(".pending")); if (stale != null) for (File file : stale) file.delete(); });
        web.loadUrl(START);
    }
    private WebResourceResponse localResponse(WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (!"GET".equals(request.getMethod()) || !"https".equals(uri.getScheme()) || !"appassets.androidplatform.net".equals(uri.getHost()) || (uri.getPort() != -1 && uri.getPort() != 443) || uri.getQuery() != null || uri.getPath() == null || !uri.getPath().startsWith("/assets/www/") || uri.getPath().contains("/../") || uri.getPath().contains("/./")) { deniedRequests.incrementAndGet(); return denied(); }
        WebResourceResponse response = assets.shouldInterceptRequest(uri);
        if (response != null) localAssetRequests.incrementAndGet(); else deniedRequests.incrementAndGet();
        return response != null ? response : denied();
    }
    private static WebResourceResponse denied() {
        return new WebResourceResponse("text/plain", "UTF-8", 403, "Local assets only", Collections.singletonMap("Cache-Control", "no-store"), new ByteArrayInputStream("Only bundled local assets are available".getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    }
    private void handleExport(JSONObject value, JavaScriptReplyProxy reply) throws Exception {
        String id = value.getString("id"), action = value.getString("action");
        if ("begin".equals(action)) {
            if (transfer != null) throw new IllegalArgumentException("Finish or cancel the current export first / 请先完成或取消当前导出");
            transfer = new ExportTransfer(getCacheDir(), id, value.getString("name"), value.getString("mime"), integer(value, "size"));
            transferReply = reply;
            send(reply, new JSONObject().put("id", id).put("stage", "ready"));
        } else {
            if (transfer == null || !transfer.id.equals(id)) throw new IllegalArgumentException("Unknown export transfer");
            if ("chunk".equals(action)) {
                transfer.append(integer(value, "offset"), value.getString("base64"));
                send(reply, new JSONObject().put("id", id).put("stage", "chunk").put("received", transfer.received));
            } else if ("finish".equals(action)) {
                transfer.seal(); transferReply = reply;
                String filename = transfer.name, mime = transfer.mime;
                main.post(() -> {
                    if (destroyed) return;
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime);
                    intent.putExtra(Intent.EXTRA_TITLE, filename); intent.putExtra(Intent.EXTRA_LOCAL_ONLY, true);
                    try { startActivityForResult(intent, SAVE_FILE); }
                    catch (Exception error) { io.execute(() -> endTransfer("No local save picker / 没有可用的保存对话框", false)); }
                });
            } else if ("abort".equals(action)) endTransfer(null, true);
            else throw new IllegalArgumentException("Unknown export action");
        }
        main.removeCallbacks(abandon);
        main.postDelayed(abandon, 600000);
    }
    private void send(JavaScriptReplyProxy reply, JSONObject message) {
        main.post(() -> { processing.set(false); if (!destroyed) reply.postMessage(message.toString()); });
    }
    private static long integer(JSONObject value, String key) throws Exception {
        Object item = value.get(key);
        if (!(item instanceof Integer || item instanceof Long)) throw new IllegalArgumentException("Invalid integer: " + key);
        return ((Number)item).longValue();
    }
    private void replyError(JavaScriptReplyProxy reply, String id, String error) {
        try { send(reply, new JSONObject().put("id", id).put("error", error == null ? "Export failed / 导出失败" : error)); } catch (Exception ignored) {}
    }
    private void endTransfer(String error, boolean cancelled) {
        main.removeCallbacks(abandon);
        if (transfer == null) return;
        try {
            if (error != null) replyError(transferReply, transfer.id, error);
            else if (cancelled) send(transferReply, new JSONObject().put("id", transfer.id).put("cancelled", true));
            transfer.close();
        } catch (Exception ignored) {} finally { transfer = null; transferReply = null; }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == OPEN_FILE && fileChoice != null) {
            List<Uri> uris = new ArrayList<>();
            if (result == RESULT_OK && data != null) {
                if (data.getClipData() != null) for (int i = 0; i < Math.min(data.getClipData().getItemCount(), 60); i++) uris.add(data.getClipData().getItemAt(i).getUri());
                else if (data.getData() != null) uris.add(data.getData());
            }
            uris.removeIf(uri -> !"content".equals(uri.getScheme()));
            fileChoice.onReceiveValue(uris.isEmpty() ? null : uris.toArray(new Uri[0])); fileChoice = null;
        } else if (request == SAVE_FILE) {
            Uri target = result == RESULT_OK && data != null ? data.getData() : null;
            io.execute(() -> {
                if (transfer == null) return;
                if (target == null) { endTransfer(null, true); return; }
                try {
                    if (!"content".equals(target.getScheme())) throw new IOException("A document destination is required");
                    try (OutputStream output = getContentResolver().openOutputStream(target, "wt")) {
                        if (output == null) throw new IOException("Unable to open the export destination");
                        transfer.copyTo(output);
                    }
                    send(transferReply, new JSONObject().put("id", transfer.id).put("saved", true).put("name", transfer.name).put("bytes", transfer.received));
                    endTransfer(null, false);
                } catch (Exception error) {
                    try { if (DocumentsContract.isDocumentUri(this, target)) DocumentsContract.deleteDocument(getContentResolver(), target); } catch (Exception ignored) {}
                    endTransfer("Unable to save the complete file / 无法完整保存文件: " + error.getMessage(), false);
                }
            });
        }
    }
    @Override public void onBackPressed() {
        if (web == null || destroyed) { confirmClose(); return; }
        // Fixed app-owned code only: Back dismisses an HTML dialog/drawer before exit.
        web.evaluateJavascript("(()=>{const d=[...document.querySelectorAll('dialog[open]')].pop();if(d){if(d.dispatchEvent(new Event('cancel',{cancelable:true}))&&d.open)d.close();return true;}if(document.body.classList.contains('studio-mobile')&&document.body.dataset.mobileTab!=='canvas'){document.getElementById('mobileTab-canvas')?.click();return true;}return false;})()", consumed -> { if (!destroyed && !"true".equals(consumed)) confirmClose(); });
    }
    private void confirmClose() {
        new AlertDialog.Builder(this).setMessage("Close the local editor? Save a project file to keep a separate backup. / 关闭本地编辑器？建议保存工程文件作为独立备份。")
            .setPositiveButton("Close / 关闭", (dialog, which) -> finish()).setNegativeButton("Stay / 留在编辑器", null).show();
    }
    @Override protected void onDestroy() {
        destroyed = true; main.removeCallbacks(abandon);
        if (fileChoice != null) { fileChoice.onReceiveValue(null); fileChoice = null; }
        io.execute(() -> endTransfer(null, false)); io.shutdown();
        if (web != null) { web.stopLoading(); web.destroy(); }
        super.onDestroy();
    }
    WebView webViewForTests() { return web; }
}
