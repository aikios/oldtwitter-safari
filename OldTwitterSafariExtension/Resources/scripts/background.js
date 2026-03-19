// Safari compatibility shim: alias chrome <-> browser
try { importScripts('../libraries/browser-polyfill.min.js'); } catch(e) {
    // If import fails, set up the alias manually
    if (typeof browser !== 'undefined' && typeof chrome === 'undefined') { globalThis.chrome = browser; }
    else if (typeof chrome !== 'undefined' && typeof browser === 'undefined') { globalThis.browser = chrome; }
}

chrome.contextMenus.create({
    id: "open_settings",
    title: "Open settings",
    contexts: ["action"],
});

chrome.runtime.onInstalled.addListener(() => {
    chrome.runtime.setUninstallURL("https://dimden.dev/ot/uninstall.html");
});

chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === "open_settings") {
        chrome.tabs.create({
            url: "https://twitter.com/old/settings",
        });
    }
});
chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({
        url: "https://twitter.com/old/settings",
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[OldTwitter BG] message received:', request.action, 'tabId:', sender && sender.tab && sender.tab.id);
    if (request.action === "fetchProxy") {
        // Proxy cross-origin fetches from content scripts — Safari blocks them silently
        fetch(request.url, request.options || {})
            .then(async (r) => {
                const text = await r.text();
                console.log('[OldTwitter BG] fetchProxy ok:', request.url, r.status);
                sendResponse({ ok: r.ok, status: r.status, text });
            })
            .catch((e) => {
                console.error('[OldTwitter BG] fetchProxy error:', request.url, e && e.message);
                sendResponse({ error: e && e.message });
            });
        return true;
    }
    if (request.action === "inject") {
        if (!sender.tab || !sender.tab.id) {
            console.error('[OldTwitter BG] no tab id in sender:', JSON.stringify(sender));
            sendResponse({ error: 'no tab id' });
            return false;
        }
        chrome.scripting
            .executeScript({
                target: {
                    tabId: sender.tab.id,
                    allFrames: request.allFrames !== false,
                },
                injectImmediately: true,
                files: request.files,
                world: "ISOLATED",
            })
            .then(() => {
                sendResponse({ ok: true });
            })
            .catch((e) => {
                console.error('[OldTwitter BG] inject error:', e && e.message);
                sendResponse({ error: e && e.message });
            });
        return true; // keep channel open for async sendResponse
    }
    if (request.action === "injectSolverMain") {
        // Inject solver.js into the page's MAIN world (not isolated).
        // <script src="extension://..."> runs in the isolated world in Safari,
        // so we must use executeScript with world:"MAIN" to guarantee main-world execution.
        // This ensures solver.js shares window with vendor.js and sees webpackChunk globals.
        if (!sender.tab || !sender.tab.id) {
            sendResponse({ error: 'no tab id' });
            return false;
        }
        console.log('[OldTwitter BG] injecting solver.js into MAIN world, tab', sender.tab.id);
        chrome.scripting
            .executeScript({
                target: {
                    tabId: sender.tab.id,
                    allFrames: false,
                },
                injectImmediately: true,
                files: ['scripts/solver.js'],
                world: "MAIN",
            })
            .then(() => {
                console.log('[OldTwitter BG] solver.js MAIN world injection success');
                sendResponse({ ok: true });
            })
            .catch((e) => {
                console.error('[OldTwitter BG] solver.js MAIN world injection error:', e && e.message);
                sendResponse({ error: e && e.message });
            });
        return true;
    }
});
