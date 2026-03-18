// OldTwitter Challenge Solver — runs in the page's MAIN world.
//
// Strategy:
//   1. Load vendor.js via <script src="abs.twimg.com/..."> — no eval, CSP allows *.twimg.com
//   2. Fetch challenge script as TEXT to extract the specific module ID (headerRegex)
//   3. Intercept webpackChunk.push() keyed on that module ID
//   4. Load challenge script via <script src> — webpack processes it, patched factory fires
//
// Communication with twchallenge.js via window.postMessage {__src:'__ot__', action:...}

(function () {
    // Guard against duplicate injection (watchdog re-inject while already initialized)
    if (window.__ot_solver_active) {
        console.log('[OT Solver] already active, skipping re-init');
        return;
    }
    window.__ot_solver_active = true;

    const TAG = '__ot__';
    let solver = null;
    let initError = null;
    let initializing = false;

    console.log('[OT Solver] main-world solver script loaded');

    function loadScript(url) {
        return new Promise(function (resolve, reject) {
            const s = document.createElement('script');
            s.src = url;
            s.onload = function () { resolve(); };
            s.onerror = function () { reject(new Error('Failed to load: ' + url)); };
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
            if (initializing) {
                console.log('[OT Solver] already initializing, ignoring duplicate init');
                return;
            }
            initializing = true;
            try {
                // Step 1: Load vendor.js — bootstraps webpack in the main world
                console.log('[OT Solver] loading vendor.js:', data.vendorCode);
                await loadScript('https://abs.twimg.com/responsive-web/client-web/vendor.' + data.vendorCode + '.js');
                console.log('[OT Solver] vendor.js loaded');

                // Step 2: Set the verification meta tag and animation SVGs
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

                // Step 3: Fetch challenge script as text to extract the module ID.
                // This is a text-only fetch — the script is NOT executed yet.
                const challengeUrl = 'https://abs.twimg.com/responsive-web/client-web/ondemand.s.' + data.challengeCode + 'a.js';
                console.log('[OT Solver] fetching challenge script text:', data.challengeCode);
                const challengeText = await fetch(challengeUrl).then(function (r) { return r.text(); });

                // The module that generates transaction IDs has this unique shape in the raw bundle text:
                // <id>:(<args>)=>{...,<args>[1]?s.d(<args>[1],{default:()=><var>})...}
                const headerRegex = /(\d+):(.+)=>.+default:\(\)=>(\w)}\);/;
                const headerMatch = challengeText.match(headerRegex);
                if (!headerMatch) {
                    throw new Error('Challenge module not found in script ' + data.challengeCode + ' (first 200: ' + challengeText.slice(0, 200) + ')');
                }
                const moduleId = headerMatch[1];
                console.log('[OT Solver] challenge module id:', moduleId);

                // Step 4: Intercept webpackChunk.push() for the specific module ID.
                const chunks = window.webpackChunk_twitter_responsive_web;
                if (!chunks) {
                    throw new Error('webpackChunk_twitter_responsive_web not found after vendor.js');
                }

                const challengeReady = new Promise(function (resolve, reject) {
                    const timeout = setTimeout(function () {
                        chunks.push = origPush;
                        reject(new Error('Timed out: module ' + moduleId + ' never pushed to webpack'));
                    }, 15000);

                    const origPush = chunks.push;
                    chunks.push = function () {
                        const chunkData = arguments[0];
                        if (chunkData && chunkData[1] && chunkData[1][moduleId]) {
                            // Found our module — wrap its factory to capture exports.default
                            const origFactory = chunkData[1][moduleId];
                            chunkData[1][moduleId] = function (mod, exports, wreq) {
                                origFactory(mod, exports, wreq);
                                // After the factory runs, exports.default is a getter returning
                                // the solver constructor (the 'var' in default:()=>var)
                                const def = exports && exports.default;
                                if (typeof def === 'function') {
                                    window._OT_CHALLENGE = function () { return def; };
                                    clearTimeout(timeout);
                                    chunks.push = origPush;
                                    resolve();
                                } else {
                                    clearTimeout(timeout);
                                    chunks.push = origPush;
                                    reject(new Error('exports.default is not a function after module ' + moduleId + ' ran (got ' + typeof def + ')'));
                                }
                            };
                        }
                        return origPush.apply(this, arguments);
                    };
                });

                // Step 5: Load the challenge script via <script src>.
                // Browser uses the cached response from step 3; webpack intercepts the push.
                console.log('[OT Solver] loading challenge script via <script src>');
                await loadScript(challengeUrl);
                console.log('[OT Solver] challenge script loaded, waiting for module push...');

                await challengeReady;

                if (typeof window._OT_CHALLENGE !== 'function') {
                    throw new Error('_OT_CHALLENGE not set after challenge module ran');
                }

                solver = window._OT_CHALLENGE()();
                console.log('[OT Solver] solver ready');
                window.postMessage({ __src: TAG, action: 'ready' }, '*');

            } catch (err) {
                console.error('[OT Solver] init error:', err);
                initError = String(err);
                initializing = false;
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
