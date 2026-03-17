let solverIframe;
let solveId = 0;
let solveCallbacks = {};
let solveQueue = [];
let solverReady = false;
let solverErrored = false;
let sentData = false;

// Use the extension URL directly — the blob fetch approach hangs in Safari
let sandboxExtUrl = chrome.runtime.getURL('sandbox.html');
console.log('[OT Challenge] sandboxExtUrl:', sandboxExtUrl);

function createSolverFrame() {
    if (solverIframe) solverIframe.remove();
    solverIframe = document.createElement("iframe");
    //display:none causes animations to not play which breaks the challenge solver, so have to hide it in different way
    solverIframe.style.position = "absolute";
    solverIframe.width = "0px";
    solverIframe.height = "0px";
    solverIframe.style.border = "none";
    solverIframe.style.opacity = 0;
    solverIframe.style.pointerEvents = "none";
    solverIframe.tabIndex = -1;
    console.log('[OT Challenge] setting iframe src to extension URL');
    solverIframe.src = sandboxExtUrl;
    let injectedBody = document.getElementById("injected-body");
    if (injectedBody) {
        injectedBody.appendChild(solverIframe);
    } else {
        let int = setInterval(() => {
            let injectedBody = document.getElementById("injected-body");
            if (injectedBody) {
                injectedBody.appendChild(solverIframe);
                clearInterval(int);
            }
        }, 10);
    }
}
createSolverFrame();

function solveChallenge(path, method) {
    return new Promise((resolve, reject) => {
        if (solverErrored) {
            reject("Solver errored during initialization");
            return;
        }
        let id = solveId++;
        solveCallbacks[id] = { resolve, reject, time: Date.now() };
        if (!solverReady || !solverIframe || !solverIframe.contentWindow) {
            solveQueue.push({ id, path, method });
        } else {
            try {
                solverIframe.contentWindow.postMessage(
                    { action: "solve", id, path, method },
                    "*"
                );
            } catch (e) {
                console.error(`Error sending challenge to solver:`, e);
                reject(e);
            }
            // setTimeout(() => {
            //     if(solveCallbacks[id]) {
            //         solveCallbacks[id].reject('Solver timed out');
            //         delete solveCallbacks[id];
            //     }
            // }, 1750);
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
            "Something's wrong with the challenge solver, reloading",
            solveQueue
        );
        createSolverFrame();
        initChallenge();
    }
}, 2000);

window.addEventListener("message", (e) => {
    console.log('[OT Challenge] window message received, origin:', e.origin, 'action:', e.data && e.data.action);
    if (e.source !== solverIframe.contentWindow) { console.log('[OT Challenge] message not from solver iframe, ignoring'); return; }
    let data = e.data;
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
        console.error("Error initializing solver:");
        console.error(data.error);
    } else if (data.action === "ready") {
        solverReady = true;
        for (let task of solveQueue) {
            solverIframe.contentWindow.postMessage(
                {
                    action: "solve",
                    id: task.id,
                    path: task.path,
                    method: task.method,
                },
                "*"
            );
        }
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
    // try {
    let solved = await solveChallenge(
        parsedUrl.pathname,
        options.method ? options.method.toUpperCase() : "GET"
    );
    options.headers["x-client-transaction-id"] = solved;
    // } catch (e) {
    //     console.error(`Error solving challenge for ${url}:`);
    //     console.error(e);
    // }
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
        let challengeCode = homepageData.match(/"ondemand.s":"(\w+)"/)[1];
        console.log('[OT Challenge] vendorCode:', vendorCode, 'challengeCode:', challengeCode);

        OLDTWITTER_CONFIG.verificationKey = verificationKey;

        function sendInit() {
            sentData = true;
            console.log('[OT Challenge] sendInit called, iframe contentWindow:', !!solverIframe?.contentWindow);
            if (!solverIframe || !solverIframe.contentWindow)
                return setTimeout(sendInit, 50);
            console.log('[OT Challenge] posting init to iframe');
            solverIframe.contentWindow.postMessage(
                {
                    action: "init",
                    challengeCode,
                    vendorCode,
                    anims,
                    verificationCode: OLDTWITTER_CONFIG.verificationKey,
                },
                "*"
            );
        }
        setTimeout(sendInit, 50);
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
