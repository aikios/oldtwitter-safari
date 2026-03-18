let solveId = 0;
let solveCallbacks = {};
let solveQueue = [];
let solverReady = false;
let solverErrored = false;
let sentData = false;

const SOLVER_TAG = '__ot__';

// Inject solver.js into the page's MAIN world via a web_accessible_resources <script> tag.
// This avoids Safari's isolated-world postMessage issues (content script world ≠ page world).
// The script runs in the page context where:
//   - eval() works (DNR Rule 12 strips x.com's CSP; extension MV3 CSP does not apply to page context)
//   - fetch to abs.twimg.com works (DNR Rule 14 adds CORS for x.com initiator)
//   - window.webpackChunk_twitter_responsive_web already exists (no need to re-fetch vendor.js)
//   - window.postMessage reaches content scripts (standard cross-world communication)
function injectSolver() {
    let existing = document.getElementById('__ot_solver__');
    if (existing) existing.remove();
    let script = document.createElement('script');
    script.id = '__ot_solver__';
    script.src = chrome.runtime.getURL('scripts/solver.js');
    document.documentElement.appendChild(script);
    console.log('[OT Challenge] solver.js injected into main world');
}
injectSolver();

function solveChallenge(path, method) {
    return new Promise((resolve, reject) => {
        if (solverErrored) {
            reject("Solver errored during initialization");
            return;
        }
        let id = solveId++;
        solveCallbacks[id] = { resolve, reject, time: Date.now() };
        if (!solverReady) {
            solveQueue.push({ id, path, method });
        } else {
            window.postMessage({ __src: SOLVER_TAG, action: "solve", id, path, method }, "*");
        }
    });
}

setInterval(() => {
    if (
        !document.getElementById("loading-box").hidden &&
        sentData &&
        solveQueue.length
    ) {
        console.log(
            "Something's wrong with the challenge solver, re-injecting",
            solveQueue
        );
        solverReady = false;
        injectSolver();
        initChallenge();
    }
}, 2000);

window.addEventListener("message", (e) => {
    if (!e.data || e.data.__src !== SOLVER_TAG) return;
    let data = e.data;
    console.log('[OT Challenge] solver message received, action:', data.action);
    if (data.action === "solved" && typeof data.id === "number") {
        let { id, result } = data;
        if (solveCallbacks[id]) {
            solveCallbacks[id].resolve(result);
            delete solveCallbacks[id];
        }
    } else if (data.action === "error" && typeof data.id === "number") {
        let { id, error } = data;
        if (solveCallbacks[id]) {
            solveCallbacks[id].reject(error);
            delete solveCallbacks[id];
        }
    } else if (data.action === "initError") {
        solverErrored = true;
        for (let id in solveCallbacks) {
            solveCallbacks[id].reject("Solver errored during initialization");
            delete solveCallbacks[id];
        }
        alert(
            `There was an error in initializing security header generator:\n${data.error}\nUser Agent: ${navigator.userAgent}\nOldTwitter doesn't allow unsigned requests anymore for your account security.`
        );
        console.error("Error initializing solver:", data.error);
    } else if (data.action === "ready") {
        solverReady = true;
        for (let task of solveQueue) {
            window.postMessage({
                __src: SOLVER_TAG,
                action: "solve",
                id: task.id,
                path: task.path,
                method: task.method,
            }, "*");
        }
        solveQueue = [];
    }
});

window._fetch = window.fetch;
fetch = async function (url, options) {
    if (
        !url.startsWith("/i/api") &&
        !url.startsWith("https://api.twitter.com") &&
        !url.startsWith("https://api.x.com")
    )
        return _fetch(url, options);
    if (!options) options = {};
    if (!options.headers) options.headers = {};
    if (!options.headers["x-twitter-auth-type"]) {
        options.headers["x-twitter-auth-type"] = "OAuth2Session";
    }
    if (!options.headers["x-twitter-active-user"]) {
        options.headers["x-twitter-active-user"] = "yes";
    }
    if (!options.headers["X-Client-UUID"]) {
        options.headers["X-Client-UUID"] = OLDTWITTER_CONFIG.deviceId;
    }
    if (!url.startsWith("http:") && !url.startsWith("https:")) {
        let host = location.hostname;
        if (!["x.com", "twitter.com"].includes(host)) host = "x.com";
        if (!url.startsWith("/")) url = "/" + url;
        url = `https://${host}${url}`;
    }
    let parsedUrl = new URL(url);
    let solved = await solveChallenge(
        parsedUrl.pathname,
        options.method ? options.method.toUpperCase() : "GET"
    );
    options.headers["x-client-transaction-id"] = solved;
    if (
        options.method &&
        options.method.toUpperCase() === "POST" &&
        typeof options.body === "string"
    ) {
        options.headers["Content-Length"] = options.body.length;
    }

    return _fetch(url, options);
};

async function initChallenge() {
    try {
        let homepageData;
        let sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        let host = location.hostname;
        if (!["x.com", "twitter.com"].includes(host)) host = "x.com";
        console.log('[OT Challenge] initChallenge: fetching homepage from', host);
        try {
            homepageData = await _fetch(`https://${host}/`).then((res) =>
                res.text()
            );
        } catch (e) {
            console.warn('[OT Challenge] homepage fetch attempt 1 failed:', e && e.message, '— retrying');
            await sleep(500);
            try {
                homepageData = await _fetch(`https://${host}/`).then((res) =>
                    res.text()
                );
            } catch (e) {
                throw new Error("Failed to fetch homepage: " + e);
            }
        }
        console.log('[OT Challenge] homepage fetched, length:', homepageData.length);
        let dom = new DOMParser().parseFromString(homepageData, "text/html");
        let verificationKey = dom.querySelector(
            'meta[name="twitter-site-verification"]'
        ).content;
        let anims = Array.from(
            dom.querySelectorAll('svg[id^="loading-x"]')
        ).map((svg) => svg.outerHTML);

        let vendorCode = homepageData.match(/vendor.(\w+).js"/)[1];
        let challengePos = homepageData.match(/(\d+):"ondemand.s"/)[1];
        let challengeCode = homepageData.match(new RegExp(`${challengePos}:"(\\w+)"`))[1];
        console.log('[OT Challenge] vendorCode:', vendorCode, 'challengeCode:', challengeCode);

        OLDTWITTER_CONFIG.verificationKey = verificationKey;

        sentData = true;
        console.log('[OT Challenge] sending init to main-world solver');
        window.postMessage({
            __src: SOLVER_TAG,
            action: "init",
            challengeCode,
            vendorCode,
            anims,
            verificationCode: OLDTWITTER_CONFIG.verificationKey,
        }, "*");
        return true;
    } catch (e) {
        console.error(`Error during challenge init:`);
        console.error(e);
        if (location.hostname === "twitter.com") {
            alert(
                `There was an error in initializing security header generator: ${e}\nUser Agent: ${navigator.userAgent}\nOldTwitter doesn't allow unsigned requests anymore for your account security. Currently the main reason for this happening is social network tracker protection blocking the script. Try disabling such settings in your browser and extensions that do that and refresh the page. This also might be because you're either not logged in or using twitter.com instead of x.com.`
            );
        } else {
            alert(
                `There was an error in initializing security header generator: ${e}\nUser Agent: ${navigator.userAgent}\nOldTwitter doesn't allow unsigned requests anymore for your account security. Currently the main reason for this happening is social network tracker protection blocking the script. Try disabling such settings in your browser and extensions that do that and refresh the page. This can also happen if you're not logged in.`
            );
        }
        return false;
    }
}

initChallenge();
