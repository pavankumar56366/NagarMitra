# Building the NagarMitra Android APK

The APK is a native shell around the published NagarMitra site. Camera, GPS and
photo upload all work through the native WebView. When you publish an update in
Lovable, every installed phone gets it immediately — no new APK needed.

You need a computer (Windows/Mac/Linux) for this part; it cannot be built inside
Lovable.

## One-time setup on your computer

1. Install [Node.js 20+](https://nodejs.org) and
   [Android Studio](https://developer.android.com/studio) (during setup let it
   install the Android SDK and an emulator).
2. Export this project to GitHub from Lovable (top-right → GitHub), then clone it:
   ```bash
   git clone <your-repo-url>
   cd <your-repo-folder>
   npm install
   ```
3. Add Capacitor and the Android platform:
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap add android
   npx cap sync android
   ```

`capacitor.config.ts` is already in the repo, pointing at
`https://nagarmitra-dashboard.lovable.app`. If you connect a custom domain,
change `server.url` there and run `npx cap sync android` again.

## Permissions

Open `android/app/src/main/AndroidManifest.xml` and make sure these lines are
inside `<manifest>` (above `<application>`):

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

## Build a test APK

```bash
npx cap open android
```

In Android Studio: **Build → Build Bundle(s)/APK(s) → Build APK(s)**.

The file appears at:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

Command-line alternative (same result):

```bash
cd android && ./gradlew assembleDebug
```

## Giving it to citizens for testing

Share `app-debug.apk` over WhatsApp, Drive or a download link. On their phone
they tap the file and allow "Install unknown apps" once. A debug APK is fine for
testing but is not Play Store ready.

## For the Play Store later

1. Create a signing key:
   ```bash
   keytool -genkey -v -keystore nagarmitra.keystore -alias nagarmitra \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
2. In Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle**,
   pick that keystore, choose the `release` variant.
3. Upload the resulting `.aab` to the Play Console.

Keep the keystore file and its password safe — losing it means you can never
update the listing.
