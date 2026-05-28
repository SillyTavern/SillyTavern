package ai.sillytavern.app;

import android.content.Context;
import android.content.res.AssetManager;
import android.util.Log;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;

public class NodeRuntime {

    private static final String TAG = "SillyTavern:NodeRuntime";
    private static final int SERVER_READY_TIMEOUT_MS = 60000;
    private static final int POLL_INTERVAL_MS = 1000;

    private final Context context;
    private String appRootPath;
    private String dataPath;
    private boolean serverReady = false;

    static {
        System.loadLibrary("sillytavern-node");
    }

    public native void startNodeWithArguments(String[] args, String appRootPath, String dataDirPath);

    public NodeRuntime(Context context) {
        this.context = context;
        this.appRootPath = context.getFilesDir() + "/sillytavern";
        this.dataPath = context.getFilesDir() + "/sillytavern-data";
    }

    public void start() {
        prepareAppFiles();
        prepareDataDirectory();

        String scriptPath = appRootPath + "/mobile/start-mobile.js";
        File scriptFile = new File(scriptPath);
        if (!scriptFile.exists()) {
            Log.e(TAG, "Mobile start script not found at: " + scriptPath);
            return;
        }

        ArrayList<String> args = new ArrayList<>();
        args.add("node");
        args.add(scriptPath);
        args.add("--port=8000");
        args.add("--dataRoot=" + dataPath);

        String[] argsArray = args.toArray(new String[0]);
        Log.i(TAG, "Starting Node.js with script: " + scriptPath);
        Log.i(TAG, "App root: " + appRootPath);
        Log.i(TAG, "Data root: " + dataPath);

        startNodeWithArguments(argsArray, appRootPath, dataPath);
    }

    public void onNodeExited(int exitCode) {
        Log.w(TAG, "Node.js exited with code: " + exitCode);
        serverReady = false;
    }

    public void stop() {
        Log.i(TAG, "Node.js stop requested");
        serverReady = false;
    }

    public boolean isRunning() {
        try {
            HttpURLConnection conn = (HttpURLConnection) new URL("http://127.0.0.1:8000/api/ping").openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(2000);
            conn.setReadTimeout(2000);
            int code = conn.getResponseCode();
            conn.disconnect();
            serverReady = (code == 200);
            return serverReady;
        } catch (Exception e) {
            Log.d(TAG, "isRunning ping failed: " + e.getMessage());
            return false;
        }
    }

    public boolean waitForServer() {
        long startTime = System.currentTimeMillis();
        Log.i(TAG, "waitForServer: polling 127.0.0.1:8000/api/ping...");
        while (System.currentTimeMillis() - startTime < SERVER_READY_TIMEOUT_MS) {
            if (isRunning()) {
                serverReady = true;
                Log.i(TAG, "waitForServer: server is ready!");
                return true;
            }
            try {
                Thread.sleep(POLL_INTERVAL_MS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            }
        }
        Log.w(TAG, "waitForServer: timed out after " + SERVER_READY_TIMEOUT_MS + "ms");
        return false;
    }

    private void prepareAppFiles() {
        File appRoot = new File(appRootPath);
        if (!appRoot.exists()) {
            appRoot.mkdirs();
        }

        File versionMarker = new File(appRootPath, ".version");
        String currentVersion = getCurrentAppVersion();
        String extractedVersion = "";

        if (versionMarker.exists()) {
            try {
                BufferedReader br = new BufferedReader(new InputStreamReader(
                    new java.io.FileInputStream(versionMarker)));
                extractedVersion = br.readLine().trim();
                br.close();
            } catch (IOException ignored) {}
        }

        if (!currentVersion.equals(extractedVersion)) {
            Log.i(TAG, "Extracting app assets (version: " + currentVersion + ")...");
            extractAssets("sillytavern", appRootPath);
            try {
                OutputStream os = new FileOutputStream(versionMarker);
                os.write(currentVersion.getBytes());
                os.close();
            } catch (IOException ignored) {}
        } else {
            Log.i(TAG, "App assets already extracted (version: " + extractedVersion + ")");
        }
    }

    private void prepareDataDirectory() {
        File dataDir = new File(dataPath);
        if (!dataDir.exists()) {
            dataDir.mkdirs();
        }
        String[] subdirs = {"characters", "chats", "groups", "worlds", "backgrounds",
            "thumbnails", "User Avatars", "themes", "QuickReplies", "vectors",
            "backups", "assets", "user/files", "user/images"};
        for (String subdir : subdirs) {
            File d = new File(dataPath, subdir);
            if (!d.exists()) d.mkdirs();
        }
    }

    private void extractAssets(String srcPath, String destPath) {
        AssetManager assetManager = context.getAssets();
        try {
            String[] assets = assetManager.list(srcPath);
            if (assets == null || assets.length == 0) return;

            for (String asset : assets) {
                String srcAssetPath = srcPath + "/" + asset;
                String destAssetPath = destPath + "/" + asset;

                String[] subAssets = assetManager.list(srcAssetPath);
                if (subAssets != null && subAssets.length > 0) {
                    new File(destAssetPath).mkdirs();
                    extractAssets(srcAssetPath, destAssetPath);
                } else {
                    InputStream is = assetManager.open(srcAssetPath);
                    FileOutputStream fos = new FileOutputStream(destAssetPath);
                    byte[] buffer = new byte[8192];
                    int len;
                    while ((len = is.read(buffer)) > 0) {
                        fos.write(buffer, 0, len);
                    }
                    fos.close();
                    is.close();
                }
            }
        } catch (IOException e) {
            Log.e(TAG, "Error extracting assets: " + e.getMessage());
        }
    }

    private String getCurrentAppVersion() {
        try {
            return context.getPackageManager()
                .getPackageInfo(context.getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "1.0.0";
        }
    }
}
