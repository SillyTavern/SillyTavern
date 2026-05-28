package ai.sillytavern.app;

import android.os.Bundle;
import android.content.Intent;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebSettings;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.net.Uri;
import android.util.Log;
import android.view.KeyEvent;
import android.view.Window;
import android.view.WindowManager;
import android.widget.TextView;
import android.widget.LinearLayout;
import android.graphics.Color;

import android.app.Activity;

public class MainActivity extends Activity {

    private static final String TAG = "SillyTavern";
    private static final String LOCAL_URL = "http://localhost:8000";

    private NodeRuntime nodeRuntime;
    private WebView webView;
    private LinearLayout errorLayout;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        showErrorScreen("Starting SillyTavern...");

        nodeRuntime = new NodeRuntime(this);

        new Thread(() -> {
            Log.i(TAG, "Starting Node.js runtime...");
            nodeRuntime.start();

            boolean ready = pollServer(60000, 1000);
            if (ready) {
                Log.i(TAG, "Server is ready, loading WebView");
                runOnUiThread(this::setupWebView);
            } else {
                Log.e(TAG, "Server failed to start within timeout");
                runOnUiThread(() -> showErrorScreen("Failed to start server."));
            }
        }).start();
    }

    private boolean pollServer(int timeoutMs, int intervalMs) {
        long start = System.currentTimeMillis();
        while (System.currentTimeMillis() - start < timeoutMs) {
            try {
                java.net.Socket socket = new java.net.Socket();
                socket.connect(new java.net.InetSocketAddress("127.0.0.1", 8000), 2000);
                socket.close();
                Log.i(TAG, "Server is ready (socket connected)");
                return true;
            } catch (Exception e) {
                Log.d(TAG, "Server not ready yet: " + e.getMessage());
            }
            try { Thread.sleep(intervalMs); } catch (InterruptedException e) { return false; }
        }
        return false;
    }

    private void showErrorScreen(String message) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackgroundColor(Color.parseColor("#202124"));
        layout.setGravity(android.view.Gravity.CENTER);

        TextView title = new TextView(this);
        title.setText("SillyTavern");
        title.setTextColor(Color.parseColor("#8C21E5"));
        title.setTextSize(28);
        title.setGravity(android.view.Gravity.CENTER);
        layout.addView(title);

        TextView msg = new TextView(this);
        msg.setText(message);
        msg.setTextColor(Color.parseColor("#CCCCCC"));
        msg.setTextSize(14);
        msg.setGravity(android.view.Gravity.CENTER);
        msg.setPadding(0, 30, 0, 0);
        layout.addView(msg);

        errorLayout = layout;
        setContentView(layout);
    }

    private void setupWebView() {
        webView = new WebView(this);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setUserAgentString(
            settings.getUserAgentString() + " SillyTavernMobile/1.0"
        );

        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new SillyTavernWebViewClient());
        webView.setWebChromeClient(new SillyTavernWebChromeClient());

        setContentView(webView);
        webView.loadUrl(LOCAL_URL);
        errorLayout = null;
    }

    public void onNodeExited(int exitCode) {
        Log.w(TAG, "Node.js process exited with code: " + exitCode);
        if (exitCode != 0) {
            runOnUiThread(() -> showErrorScreen("Server crashed (exit code " + exitCode + "). Restart the app."));
        }
    }

    @Override
    public void onResume() {
        super.onResume();
    }

    @Override
    public void onDestroy() {
        if (nodeRuntime != null) {
            nodeRuntime.stop();
        }
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView != null && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    private class SillyTavernWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            String host = url.getHost();
            if (host != null && !host.equals("localhost") && !host.equals("127.0.0.1")) {
                Intent intent = new Intent(Intent.ACTION_VIEW, url);
                startActivity(intent);
                return true;
            }
            return false;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            Log.i(TAG, "Page loaded: " + url);
        }
    }

    private class SillyTavernWebChromeClient extends WebChromeClient {
        @Override
        public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
            Log.d(TAG, "JS [" + consoleMessage.messageLevel() + "]: " +
                consoleMessage.message() + " (" +
                consoleMessage.sourceId() + ":" + consoleMessage.lineNumber() + ")");
            return true;
        }
    }
}
