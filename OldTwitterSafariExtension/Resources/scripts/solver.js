// OldTwitter Challenge Solver — runs in the page's MAIN world.
//
// Problem: Twitter's CSP (delivered via <meta> tag, which DNR can't strip) blocks eval().
// Solution: load vendor.js and ondemand.s.*.js as <script src> tags pointing directly to
//   abs.twimg.com, which IS in the CSP's script-src allowlist (https://*.twimg.com).
//   Intercept webpackChunk_twitter_responsive_web.push() to patch the challenge module
//   as webpack processes it — no eval() needed at all.
//
// Communication with content script (twchallenge.js) via window.postMessage,
// {__src: '__ot__', action: ...} — avoids Safari isolated-world postMessage issues.

(function () {
    const TAG = '__ot__';
    let solver = null;
    let initError = null;

    console.log('[OT Solver] main-world solver script loaded');

    function loadScript(url) {
        return new Promise(function (resolve, reject) {
            const s = document.createElement('script');
            s.src = url;
            s.onload = function () { resolve(); };
            s.onerror = function () { reject(new Error('Failed to load script: ' + url)); };
            document.documentElement.appendChild(s);
        });
    }

    window.addEventListener('message', async function (e) {
        if (!e.data || e.data.__src !== TAG) return;
        const data = e.data;
        console.log('[OT Solver] received message, action:', data.action);

        if (data.action === 'init') {
            if (solver) {
                window.postMessage({ __src: TAG, action: 'ready' }, '*');
                return;
            }
            try {
                // Step 1: Load vendor.js as <script src> — allowed by CSP (https://*.twimg.com)
                // This bootstraps webpack (sets up webpackChunk_twitter_responsive_web with custom push)
                console.log('[OT Solver] loading vendor.js:', data.vendorCode);
                await loadScript('https://abs.twimg.com/responsive-web/client-web/vendor.' + data.vendorCode + '.js');
                console.log('[OT Solver] vendor.js loaded');

                // Step 2: Set the verification meta tag and add animation SVGs
                let verif = document.querySelector('meta[name="twitter-site-verification"]');
                if (!verif) {
                    verif = document.createElement('meta');
                    verif.name = 'twitter-site-verification';
                    (document.head || document.documentElement).appendChild(verif);
                }
                verif.content = data.verificationCode;

                let animsDiv = document.getElementById('__ot_anims__');
                if (!animsDiv) {
                    animsDiv = document.createElement('div');
                    animsDiv.id = '__ot_anims__';
                    animsDiv.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
                    (document.body || document.documentElement).appendChild(animsDiv);
                }
                for (const anim of (data.anims || [])) {
                    animsDiv.innerHTML += '\n' + anim;
                }

                // Step 3: Intercept webpack chunk push BEFORE loading the challenge script.
                // The regex matches the challenge module factory signature.
                const headerRegex = /(\d+):(.+)=>.+default:\(\)=>(\w)}\);/;
                const chunks = window.webpackChunk_twitter_responsive_web;
                if (!chunks) {
                    throw new Error('webpackChunk_twitter_responsive_web not found after vendor.js loaded');
                }

                const challengeReady = new Promise(function (resolve, reject) {
                    const timeout = setTimeout(function () {
                        chunks.push = origPush;
                        reject(new Error('Timed out waiting for challenge module push'));
                    }, 15000);

                    const origPush = chunks.push;
                    chunks.push = function () {
                        const chunkData = arguments[0];
                        if (chunkData && chunkData[1]) {
                            for (const key in chunkData[1]) {
                                try {
                                    const factoryStr = chunkData[1][key].toString();
                                    if (headerRegex.test(factoryStr)) {
                                        // Found the challenge module — wrap its factory to capture exports.default
                                        const origFactory = chunkData[1][key];
                                        chunkData[1][key] = function (mod, exports, wreq) {
                                            origFactory(mod, exports, wreq);
                                            const def = exports && exports.default;
                                            if (typeof def === 'function') {
                                                window._OT_CHALLENGE = function () { return def; };
                                                clearTimeout(timeout);
                                                chunks.push = origPush;
                                                resolve();
                                            }
                                        };
                                        break;
                                    }
                                } catch (_) { /* some factories aren't stringifiable */ }
                            }
                        }
                        return origPush.apply(this, arguments);
                    };
                });

                // Step 4: Load ondemand.s.*.js as <script src> — allowed by CSP (https://*.twimg.com)
                // Webpack intercepts the push and calls our patched factory, setting window._OT_CHALLENGE
                console.log('[OT Solver] loading challenge script:', data.challengeCode);
                await loadScript('https://abs.twimg.com/responsive-web/client-web/ondemand.s.' + data.challengeCode + 'a.js');
                console.log('[OT Solver] challenge script loaded, waiting for module...');

                // Step 5: Wait for interceptor to fire
                await challengeReady;

                if (typeof window._OT_CHALLENGE !== 'function') {
                    throw new Error('_OT_CHALLENGE not set after challenge module loaded');
                }

                solver = window._OT_CHALLENGE()();
                console.log('[OT Solver] solver ready');
                window.postMessage({ __src: TAG, action: 'ready' }, '*');

            } catch (err) {
                console.error('[OT Solver] init error:', err);
                initError = String(err);
                window.postMessage({ __src: TAG, action: 'initError', error: String(err) }, '*');
            }

        } else if (data.action === 'solve') {
            if (initError) {
                window.postMessage({ __src: TAG, action: 'error', id: data.id, error: initError }, '*');
                return;
            }
            if (!solver) {
                window.postMessage({ __src: TAG, action: 'error', id: data.id, error: 'Solver not ready' }, '*');
                return;
            }
            try {
                const result = await solver(data.path, data.method);
                window.postMessage({ __src: TAG, action: 'solved', id: data.id, result: result }, '*');
            } catch (err) {
                window.postMessage({ __src: TAG, action: 'error', id: data.id, error: String(err) }, '*');
            }
        }
    });
})();
