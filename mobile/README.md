# SillyTavern Android

Run SillyTavern natively on Android — no server, no cloud, no remote hosting required.

The app bundles a Node.js runtime (`libnode.so`) and the full SillyTavern server inside the APK. On launch, it starts the server on `localhost:8000` and loads the web UI in a WebView. You still need API keys for your preferred AI service (OpenAI, Claude, etc.).

## How It Works

1. **Node.js on Android** — Uses [nodejs-mobile](https://github.com/nicandris/nodejs-mobile) `libnode.so` (v18.20.4) loaded via JNI. A C++ bridge (`native-lib.cpp`) calls `node::Start()` on a background thread, passing the mobile entry script and CLI args.

2. **Asset Extraction** — On first run, ~300MB of server files are extracted from the APK's `assets/` directory to internal storage. A `.version` marker file ensures assets are re-extracted only when the app is updated.

3. **WebView** — After the Node.js server passes a health check (socket connection to `127.0.0.1:8000`), a WebView loads `http://localhost:8000/` with JavaScript, DOM storage, and proper user-agent configuration.

4. **Mobile Config** — `default/config.mobile.yaml` provides mobile-optimized defaults: localhost-only binding, CSRF disabled, whitelist disabled, CORS enabled, lazy loading, 50MB cache.

## Architecture

```
APK
├── lib/arm64-v8a/
│   ├── libnode.so              ← Node.js runtime (nodejs-mobile)
│   └── libsillytavern-node.so  ← C++ JNI bridge
├── assets/sillytavern/
│   ├── mobile/start-mobile.js  ← Mobile entry point
│   ├── src/                    ← Server source (ESM)
│   ├── node_modules/           ← Dependencies (patched for Node 18)
│   ├── default/               ← Default configs & content
│   └── public/                 ← Frontend static files
└── java/ai/sillytavern/app/
    ├── MainActivity.java       ← Activity with WebView + splash screen
    └── NodeRuntime.java        ← Asset extraction + Node lifecycle
```

### Key Files

| File | Purpose |
|------|---------|
| `android/app/src/main/cpp/native-lib.cpp` | C++ JNI bridge — loads `libnode.so`, starts Node, redirects stdout/stderr to logcat |
| `android/app/src/main/java/ai/sillytavern/app/MainActivity.java` | Main Activity — splash screen, server polling, WebView setup |
| `android/app/src/main/java/ai/sillytavern/app/NodeRuntime.java` | Asset extraction with version checking, node start/stop |
| `android/app/src/main/assets/sillytavern/mobile/start-mobile.js` | Node.js entry — TextDecoder patch, CWD fix, settings pre-seed, imports server-main |
| `default/config.mobile.yaml` | Mobile-optimized server configuration |
| `android/download-libnode.ps1` | Downloads `libnode.so` from nodejs-mobile releases |
| `mobile/prepare-assets.ps1` | Bundles ST files into APK assets directory |
| `mobile/build-apk.ps1` | Full build pipeline script |

## Building

### Prerequisites

- Android Studio with NDK 27.x
- JDK 21 (Android Studio's JBR)
- Python 3 + Pillow (for icon generation)
- Node.js 20+ (for `prepare-assets.ps1`)

### Steps

1. **Download libnode.so**
   ```powershell
   cd android
   .\download-libnode.ps1
   ```

2. **Prepare assets** (copies ST server files into APK assets, applies patches)
   ```powershell
   cd ..
   powershell mobile/prepare-assets.ps1
   ```

3. **Build APK**
   ```powershell
   cd android
   $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
   $env:ANDROID_HOME = "C:\Users\<you>\AppData\Local\Android\Sdk"
   .\gradlew.bat assembleRelease
   ```

4. **Install**
   ```powershell
   adb install -r app/build/outputs/apk/release/app-release.apk
   ```

## Node 18 Compatibility Patches

SillyTavern requires Node.js >= 20, but nodejs-mobile only provides v18.20.4. Node 18 lacks full Unicode property escape support in regex and full ICU data. The `prepare-assets.ps1` script automatically patches these modules:

| Module | Issue | Fix |
|--------|-------|-----|
| `webpack/lib/RuntimeTemplate.js` | `\p{L}` in regex | Replace with ASCII+range |
| `webpack/lib/library/AssignLibraryPlugin.js` | `\p{L}` in regex | Replace with ASCII+range |
| `gpt-3-encoder/Encoder.js` | `\p{L}`, `\p{N}` with `/gu` | Replace with ASCII ranges |
| `sillytavern-transformers` | `\p{Cc}\|\p{Cf}\|\p{Co}\|\p{Cs}` | Replace with hex ranges |
| `tiktoken/encoders/*.js` | Various `\p{}` patterns | Replace with ASCII ranges |
| `protobufjs/marked` | `\p{Cc}` etc. | Replace with hex ranges |
| `minimatch/brace-expressions.js` | Unicode posix classes | Replace with ASCII ranges |
| `isomorphic-git` | `TextDecoder({fatal: true})` | Strip fatal option |

Additionally, `start-mobile.js` monkey-patches `TextDecoder` to strip the `{fatal: true}` option, since nodejs-mobile's small-ICU build doesn't support it.

## Known Limitations

- **Node.js 18** — nodejs-mobile only provides v18.20.4. Building Node 20+ for Android from source would eliminate all regex/ICU patches.
- **16KB page alignment** — `libnode.so` from nodejs-mobile is not 16KB-aligned, causing crashes on Android 15+ devices. Current workaround: `targetSdk=34`.
- **~191MB APK** — The bundled server files and libnode.so are large. Future work: pre-compile webpack, trim node_modules, use Android App Bundles.
- **First-run extraction** — Takes ~20-30 seconds to extract assets on first launch. Subsequent launches are fast (~5s to server ready).
- **No background service** — The server stops when the app is closed.

## Future Improvements

- [ ] Build Node.js 20+ for Android ARM64 from source using NDK
- [ ] Pre-compile webpack bundle before APK packaging
- [ ] 16KB page-align `libnode.so` for Android 15+ support
- [ ] Reduce APK size with Android App Bundle (AAB)
- [ ] Add a persistent notification for background server mode
- [ ] Auto-detect and configure API keys from Android clipboard on first run
- [ ] Support x86_64 emulators (libnode.so already bundled)