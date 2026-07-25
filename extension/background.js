// Runs the "add to BumpSafe" work in the background service worker instead
// of the popup. Popups are destroyed the instant they lose focus, and
// bringing another window forward (chrome.windows.update) does exactly that
// — so doing this work in the popup could get killed mid-flight before the
// tab was ever written to. The background worker has no such lifecycle tied
// to the popup's visibility.

const CANDIDATE_PORTS = [3000, 3001, 3100, 3200];
const APP_HOSTS = ["localhost", "127.0.0.1"];
const APP_ORIGINS = APP_HOSTS.flatMap((host) => CANDIDATE_PORTS.map((port) => `http://${host}:${port}`));

async function resolveAppOrigin() {
  for (const origin of APP_ORIGINS) {
    try {
      const response = await fetch(`${origin}/api/product/000000000000`, { method: "GET" });
      if (response.status < 500) return origin;
    } catch {
      // Not reachable on this origin, try the next one.
    }
  }
  throw new Error("Couldn't find BumpSafe running on localhost. Start it with `npm run dev` and try again.");
}

async function findAppTab() {
  for (const origin of APP_ORIGINS) {
    const [tab] = await chrome.tabs.query({ url: `${origin}/*` });
    if (tab) return tab;
  }
  return null;
}

function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function addAnalysisToApp(analysis) {
  let tab = await findAppTab();
  if (!tab) {
    const origin = await resolveAppOrigin();
    tab = await chrome.tabs.create({ url: `${origin}/scan`, active: true });
    await waitForTabLoad(tab.id);
  }
  // Write to the tab's localStorage and navigate it *before* touching window
  // focus, so the critical step always completes regardless of what the
  // popup or the user's cursor does next.
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (analysisJson) => {
      const analysis = JSON.parse(analysisJson);
      const existing = JSON.parse(localStorage.getItem("bumpsafe-analyses") || "[]");
      const next = [analysis, ...existing.filter((item) => item.id !== analysis.id)].slice(0, 20);
      localStorage.setItem("bumpsafe-analyses", JSON.stringify(next));
      window.dispatchEvent(new Event("bumpsafe-storage"));
      window.location.href = `/analysis/${analysis.id}`;
    },
    args: [JSON.stringify(analysis)]
  });
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
  return { tabId: tab.id };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "ADD_ANALYSIS_TO_APP") return undefined;
  addAnalysisToApp(message.analysis)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: error?.message || "Couldn't add that to BumpSafe." }));
  return true; // keep the message channel open for the async response
});
