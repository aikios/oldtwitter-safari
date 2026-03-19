// OldTwitter Challenge Solver — runs in the page's MAIN world.
//
// Strategy:
//   1. Load vendor.js via <script src="abs.twimg.com/..."> — CSP allows *.twimg.com
//   2. Load challenge script via <script src> — webpack registers the module
//   3. Find the module factory in the populated webpackChunk array and invoke it
//      directly with a minimal __webpack_require__, mirroring sandbox.html's approach
//      but without eval (not needed since we already have main-world access).
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
            // Timeout guards against onload/onerror never firing (e.g. DOM replacement
            // by injection.js removes the <script> element mid-fetch).
            const t = setTimeout(function () {
                reject(new Error('loadScript timeout (12s): ' + url));
            }, 12000);
            s.onload = function () { clearTimeout(t); resolve(); };
            s.onerror = function () { clearTimeout(t); reject(new Error('Failed to load: ' + url)); };
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
                // Step 1: Load vendor.js — bootstraps webpack in the main world.
                // Snapshot window keys before so we can detect the chunk array name.
                const windowKeysBefore = new Set(Object.keys(window));

                // Stub __SCRIPTS_LOADED__ so vendor.js's guard passes:
                //   window.__SCRIPTS_LOADED__.runtime && (self.webpackChunk_twitter_responsive_web = ...).push(...)
                // Without a truthy .runtime, vendor.js short-circuits and never sets up webpack.
                if (!window.__SCRIPTS_LOADED__) window.__SCRIPTS_LOADED__ = {};
                if (!window.__SCRIPTS_LOADED__.runtime) window.__SCRIPTS_LOADED__.runtime = {};

                console.log('[OT Solver] loading vendor.js:', data.vendorCode);
                await loadScript('https://abs.twimg.com/responsive-web/client-web/vendor.' + data.vendorCode + '.js');
                console.log('[OT Solver] vendor.js loaded');

                // Step 2: Set the verification meta tag and animation SVGs.
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
                const challengeUrl = 'https://abs.twimg.com/responsive-web/client-web/ondemand.s.' + data.challengeCode + 'a.js';
                console.log('[OT Solver] fetching challenge script text:', data.challengeCode);
                const challengeText = await fetch(challengeUrl).then(function (r) { return r.text(); });
                console.log('[OT Solver] challenge script fetched, length:', challengeText.length);

                const headerRegex = /(\d+):(.+)=>.+default:\(\)=>(\w)}\);/;
                const headerMatch = challengeText.match(headerRegex);
                if (!headerMatch) {
                    throw new Error('Challenge module not found in script ' + data.challengeCode + ' (first 200: ' + challengeText.slice(0, 200) + ')');
                }
                const moduleId = headerMatch[1];
                console.log('[OT Solver] challenge module id:', moduleId);

                // Step 4: Find the webpack chunk array (detect name dynamically in case
                // vendor.js uses a different key than the standard name).
                let chunks = window.webpackChunk_twitter_responsive_web;
                if (!chunks) {
                    const newKeys = Object.keys(window).filter(function (k) { return !windowKeysBefore.has(k); });
                    const chunkKey = newKeys.find(function (k) { return k.startsWith('webpackChunk'); });
                    if (chunkKey) {
                        console.log('[OT Solver] webpack chunk array at window.' + chunkKey + ', aliasing');
                        chunks = window[chunkKey];
                        // Alias so challenge script's hardcoded reference finds the same array.
                        window.webpackChunk_twitter_responsive_web = chunks;
                    }
                }
                if (!chunks) {
                    const webpackKeys = Object.keys(window).filter(function (k) { return k.toLowerCase().includes('webpack'); });
                    throw new Error('webpack chunk array not found. webpack keys: ' + JSON.stringify(webpackKeys));
                }
                console.log('[OT Solver] webpack chunks found, count:', chunks.length);

                // Step 5: Load the challenge script — webpack registers the module.
                console.log('[OT Solver] loading challenge script via <script src>');
                await loadScript(challengeUrl);
                console.log('[OT Solver] challenge script loaded, chunks now:', chunks.length);

                // Step 6: Find the module factory in the populated chunk array.
                // Mirrors sandbox.html's approach: scan all pushed chunks for moduleId.
                const registry = {};
                for (var ci = 0; ci < chunks.length; ci++) {
                    var chunk = chunks[ci];
                    if (chunk && chunk[1]) {
                        var keys = Object.keys(chunk[1]);
                        for (var ki = 0; ki < keys.length; ki++) {
                            registry[keys[ki]] = chunk[1][keys[ki]];
                        }
                    }
                }
                console.log('[OT Solver] registry size:', Object.keys(registry).length, 'has target:', !!registry[moduleId]);

                if (!registry[moduleId]) {
                    throw new Error('Module ' + moduleId + ' not found in webpack registry (' + Object.keys(registry).length + ' modules total)');
                }

                // Step 7: Build a minimal __webpack_require__ (same as sandbox.html's wreq).
                const cache = {};
                function wreq(id) {
                    if (cache[id]) return cache[id].exports;
                    const factory = registry[id];
                    if (!factory) throw new Error('No module with id ' + id);
                    const mod = { id: id, loaded: false, exports: {} };
                    cache[id] = mod;
                    wreq.d = function (exports, definition) {
                        for (const key in definition) {
                            Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
                        }
                    };
                    wreq.r = function (exports) {
                        if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
                            Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
                        }
                        Object.defineProperty(exports, '__esModule', { value: true });
                    };
                    wreq.n = function (mod) {
                        const getter = mod && mod.__esModule ? function () { return mod.default; } : function () { return mod; };
                        wreq.d(getter, { a: getter });
                        return getter;
                    };
                    wreq.o = function (obj, prop) { return Object.prototype.hasOwnProperty.call(obj, prop); };
                    factory(mod, mod.exports, wreq);
                    mod.loaded = true;
                    return mod.exports;
                }
                wreq.d = function (exports, definition) {
                    for (const key in definition) {
                        Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
                    }
                };
                wreq.r = function (exports) {
                    if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
                        Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
                    }
                    Object.defineProperty(exports, '__esModule', { value: true });
                };
                wreq.n = function (mod) {
                    const getter = mod && mod.__esModule ? function () { return mod.default; } : function () { return mod; };
                    wreq.d(getter, { a: getter });
                    return getter;
                };
                wreq.o = function (obj, prop) { return Object.prototype.hasOwnProperty.call(obj, prop); };

                // Step 8: Invoke the module factory directly to get exports.default.
                const modExports = {};
                const modObj = { id: moduleId, loaded: false, exports: modExports };
                cache[moduleId] = modObj;
                registry[moduleId](modObj, modExports, wreq);
                modObj.loaded = true;

                const solverFactory = modExports.default;
                console.log('[OT Solver] module invoked, default export type:', typeof solverFactory);
                if (typeof solverFactory !== 'function') {
                    throw new Error('Module ' + moduleId + ' default export is not a function (got ' + typeof solverFactory + ')');
                }

                solver = solverFactory();
                console.log('[OT Solver] solver ready, type:', typeof solver);
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
