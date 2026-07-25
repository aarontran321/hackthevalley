# BumpSafe Scanner (Chrome extension)

A companion Manifest V3 extension for BumpSafe. It captures a screenshot of the
current tab, sends it to BumpSafe's existing `/api/analyse/screenshot` endpoint
for Gemini analysis, lists every product it detects, and lets you click one to
send it straight into the BumpSafe web app.

## How it works

1. Opening the popup captures the visible tab (`chrome.tabs.captureVisibleTab`) and shows it as a preview. Use **Retake** to recapture if the page has changed.
2. **Scan for products** posts that screenshot to `POST /api/analyse/screenshot` on the BumpSafe app (`http://localhost:3000` by default), using the pregnancy profile from an open BumpSafe tab's local storage when one exists.
3. Each detected product is listed with its brand, confidence, and BumpSafe safety verdict.
4. Clicking a product injects its analysis into the BumpSafe tab's `localStorage` (creating one if none is open) and jumps straight to that product's analysis page.

No new backend code was needed — the extension reuses the same screenshot-analysis endpoint and local-storage shape as the in-app "Screenshot" scan mode (`src/app/scan/page.tsx`).

## Load it in Chrome

1. Run the BumpSafe app locally (`npm run dev`, defaults to `http://localhost:3000`).
2. Go to `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select this `extension/` folder.
4. Pin the "BumpSafe Scanner" icon, browse to a shopping/menu page, and click the icon to scan it.

## Notes

- The popup probes `localhost`/`127.0.0.1` on ports 3000, 3001, 3100, and 3200 to find your running dev server (Next.js picks the next free port if 3000 is taken), so it works even when the default port is occupied.
- Screenshots are captured as compressed JPEG (not full-resolution PNG) to stay well under the API's image size limit and keep uploads fast on high-DPI displays.
- If no BumpSafe tab is open, adding a product opens one automatically.
- If no BumpSafe tab exists yet when scanning, the extension falls back to a default demo profile so scanning still works; open the app once to use your real profile.
- **"Scan with AI"** calls Gemini live. If that fails for any reason (quota, key config, network), it automatically falls back to seeded snack-aisle results instead of a dead-end error, so the rest of the flow is always demoable.
- **"Quick scan (no AI, on-device)"** runs an in-browser OCR pass (Tesseract.js, vendored under `vendor/tesseract/`) over the screenshot's text and matches it against a small keyword-to-guidance rule set drawn from `src/data/guidance.json` — no network call to Gemini at all. Results are clearly labeled "not AI-verified."
- **"Try a demo scan instead"** loads the same seeded chip products without capturing or calling anything.
- "Add to BumpSafe" work (writing the analysis into the app tab's storage and navigating there) runs in the background service worker (`background.js`), not the popup — popups are destroyed the instant they lose focus, which happens right when the target tab/window gets brought forward, so doing this step in the popup could get killed mid-flight.
- Both scan buttons show a scanning sweep animation over the preview while running.
