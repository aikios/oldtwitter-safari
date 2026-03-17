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
    if (request.action === "inject") {
        if (!sender.tab || !sender.tab.id) {
            console.error('[OldTwitter BG] no tab id in sender:', JSON.stringify(sender));
            sendResponse({ error: 'no tab id' });
            return false;
        }
        console.log('[OldTwitter BG] injecting files into tab', sender.tab.id, ':', request.files);
        chrome.scripting
            .executeScript({
                target: {
                    tabId: sender.tab.id,
                    allFrames: true,
                },
                injectImmediately: true,
                files: request.files,
            })
            .then((res) => {
                console.log('[OldTwitter BG] inject success:', JSON.stringify(res));
                sendResponse({ ok: true });
            })
            .catch((e) => {
                console.error('[OldTwitter BG] inject error:', e && e.message);
                sendResponse({ error: e && e.message });
            });
        return true; // keep channel open for async sendResponse
    }
});
