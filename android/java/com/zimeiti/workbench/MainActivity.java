package com.zimeiti.workbench;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.TypedValue;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends Activity {

    private static final String HOME = "https://selfmedia-workbench-33729.app.workbuddy.host/?sharecode=KLEYZT3KBE";
    private static final String HOME_HOST = "app.workbuddy.host";
    private static final String OFFLINE = "file:///android_asset/offline.html";
    private static final int REQ_FILE = 1001;

    private static final String BRIDGE_JS =
            "(function(){"
            + "if(window.__zmtPatched||!window.AndroidBridge){return;}"
            + "window.__zmtPatched=true;"
            + "var q=[];"
            + "var cou=URL.createObjectURL;"
            + "URL.createObjectURL=function(b){try{q.push(b);}catch(e){}return cou.call(URL,b);};"
            + "var click=HTMLAnchorElement.prototype.click;"
            + "HTMLAnchorElement.prototype.click=function(){"
            + "try{"
            + "if(this.download&&q.length){"
            + "var blob=q.shift();var nm=this.download;var fr=new FileReader();"
            + "fr.onload=function(){var s=String(fr.result);var i=s.indexOf(',');"
            + "AndroidBridge.saveBase64(nm,i>=0?s.slice(i+1):'',blob.type||'');};"
            + "fr.readAsDataURL(blob);return;}"
            + "}catch(e){}"
            + "return click.apply(this,arguments);};"
            + "})();";

    private WebView web;
    private ProgressBar bar;
    private ValueCallback<Uri[]> filePicker;
    private boolean loadFailed = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#F3EEFF"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#F3EEFF"));
        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        int barH = (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 2.5f, getResources().getDisplayMetrics());
        bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        bar.setMax(100);
        bar.setProgress(0);
        FrameLayout.LayoutParams bp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, barH);
        root.addView(bar, bp);

        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setLoadsImagesAutomatically(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setUseWideViewPort(false);
        s.setLoadWithOverviewMode(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportMultipleWindows(false);
        s.setTextZoom(100);
        s.setUserAgentString(s.getUserAgentString() + " ZiMeitiApp/1.0");

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= 21) cm.setAcceptThirdPartyCookies(web, true);

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                Uri u = req.getUrl();
                String host = u.getHost();
                if (host != null && host.endsWith(HOME_HOST)) return false;
                String scheme = u.getScheme();
                if ("http".equals(scheme) || "https".equals(scheme)) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, u));
                    } catch (Exception ignored) {}
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                bar.setVisibility(View.GONE);
                if (url != null && !url.startsWith("file:")) {
                    v.evaluateJavascript(BRIDGE_JS, null);
                }
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) {
                    loadFailed = true;
                    v.loadUrl(OFFLINE);
                }
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView v, int p) {
                if (loadFailed) return;
                bar.setVisibility(p >= 100 ? View.GONE : View.VISIBLE);
                bar.setProgress(p);
            }

            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb,
                                             FileChooserParams params) {
                if (filePicker != null) filePicker.onReceiveValue(null);
                filePicker = cb;
                Intent i = params.createIntent();
                i.addCategory(Intent.CATEGORY_OPENABLE);
                try {
                    startActivityForResult(i, REQ_FILE);
                } catch (Exception e) {
                    filePicker = null;
                    return false;
                }
                return true;
            }
        });

        if (isOnline()) {
            web.loadUrl(HOME);
        } else {
            loadFailed = true;
            web.loadUrl(OFFLINE);
        }
    }

    private boolean isOnline() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
            if (cm == null) return true;
            if (Build.VERSION.SDK_INT >= 23) {
                Network n = cm.getActiveNetwork();
                if (n == null) return false;
                NetworkCapabilities c = cm.getNetworkCapabilities(n);
                return c != null && c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
            }
            return true;
        } catch (Exception e) {
            return true;
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ_FILE) {
            Uri[] out = null;
            if (res == RESULT_OK && data != null) {
                if (data.getData() != null) {
                    out = new Uri[]{data.getData()};
                } else if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount();
                    out = new Uri[n];
                    for (int i = 0; i < n; i++) out[i] = data.getClipData().getItemAt(i).getUri();
                }
            }
            if (filePicker != null) {
                filePicker.onReceiveValue(out);
                filePicker = null;
            }
            return;
        }
        super.onActivityResult(req, res, data);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.removeJavascriptInterface("AndroidBridge");
            web.destroy();
        }
        super.onDestroy();
    }

    /* ===== JS 桥 ===== */
    class Bridge {

        @JavascriptInterface
        public void retry() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    loadFailed = false;
                    bar.setVisibility(View.VISIBLE);
                    web.loadUrl(HOME);
                }
            });
        }

        @JavascriptInterface
        public void saveText(String name, String content) {
            try {
                write(name, content == null ? new byte[0] : content.getBytes("UTF-8"), "text/plain");
            } catch (Exception e) {
                toastUi("保存失败：" + e.getMessage());
            }
        }

        @JavascriptInterface
        public void saveBase64(String name, String b64, String mime) {
            try {
                byte[] data = Base64.decode(b64 == null ? "" : b64, Base64.DEFAULT);
                write(name, data, mime);
            } catch (Exception e) {
                toastUi("保存失败：" + e.getMessage());
            }
        }

        @JavascriptInterface
        public void toast(String msg) {
            toastUi(msg);
        }
    }

    private void write(String rawName, byte[] data, String rawMime) throws Exception {
        String name = rawName == null ? "" : rawName.trim();
        if (name.isEmpty()) name = "创作台导出-" + System.currentTimeMillis() + ".txt";
        name = name.replaceAll("[\\\\/:*?\"<>|\\r\\n]", "_");
        String mime = rawMime == null || rawMime.trim().isEmpty() ? "application/octet-stream" : rawMime;
        int semi = mime.indexOf(';');
        if (semi > 0) mime = mime.substring(0, semi).trim();

        final String where;
        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues cv = new ContentValues();
            cv.put(MediaStore.Downloads.DISPLAY_NAME, name);
            cv.put(MediaStore.Downloads.MIME_TYPE, mime);
            cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/创作台");
            cv.put(MediaStore.Downloads.IS_PENDING, 1);
            Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
            if (uri == null) throw new Exception("无法写入下载目录");
            OutputStream os = getContentResolver().openOutputStream(uri);
            try {
                os.write(data);
                os.flush();
            } finally {
                os.close();
            }
            cv.clear();
            cv.put(MediaStore.Downloads.IS_PENDING, 0);
            getContentResolver().update(uri, cv, null, null);
            where = "下载/创作台";
        } else {
            File dir = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "创作台");
            if (!dir.exists() && !dir.mkdirs()) throw new Exception("无法创建目录");
            File f = new File(dir, name);
            FileOutputStream fos = new FileOutputStream(f);
            try {
                fos.write(data);
                fos.flush();
            } finally {
                fos.close();
            }
            where = f.getAbsolutePath();
        }
        toastUi("已保存到 " + where);
    }

    private void toastUi(final String msg) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show();
            }
        });
    }
}
