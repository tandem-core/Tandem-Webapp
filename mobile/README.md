# Tandem phone app (Expo)

Mary's view of Tandem for Android. It reads from the web API at https://tandemweb.vercel.app.

## Try it on this computer

Use the Android emulator (a virtual Pixel 8). It behaves like a real phone, including audio.

1. Start the virtual phone: `E:\Android\Sdk\emulator\emulator.exe -avd Pixel_8`
2. In this folder: `npm install` once, then `npx expo start`
3. Press `a` in the terminal. Expo Go opens the app on the virtual phone.

Quick browser preview: `npm run web`. It forwards API calls through a small local proxy because the live API doesn't allow browser calls from other sites. Layout and audio differ a little from a phone.

## Try it on your Android phone

Install Expo Go from the Play Store, run `npx expo start` (add `--tunnel` if the phone is on a different network), and scan the QR code with Expo Go.

## Checks

Run these before sharing a build:

```
npm test            # small checks for the medicine and timeline helpers
npx tsc --noEmit    # types
npx expo lint       # lint
npx expo-doctor     # Expo dependency versions
```

`EXPO_PUBLIC_API_URL` points the app at a different API, such as a local `npm run dev` server.
