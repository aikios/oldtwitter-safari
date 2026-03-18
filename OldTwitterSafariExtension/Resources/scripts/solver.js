// OldTwitter Challenge Solver — runs in the page's MAIN world (not content script isolated world).
// Injected via web_accessible_resources so it executes in page context where:
//   - eval() works (DNR Rule 12 strips x.com's CSP, extension CSP doesn't apply here)
//   - fetch to abs.twimg.com works (DNR Rule 14 adds CORS for x.com initiator)
//   - window.postMessage is on the REAL window, avoiding Safari isolated-world postMessage issues
//   - window.webpackChunk_twitter_responsive_web already exists (vendor.js already loaded by page)
//
// Communicates with the content script (twchallenge.js) via window.postMessage using __ot__ tagged messages.

(function () {
    const TAG = '__ot__';
    let solver = null;
    let initError = null;

    function sleep(ms) {
        return new Promise(function (r) { setTimeout(r, ms); });
    }

    console.log('[OT Solver] main-world solver script loaded');

    window.addEventListener('message', async function (e) {
        if (!e.data || e.data.__src !== TAG) return;
        const data = e.data;
        console.log('[OT Solver] received message, action:', data.action);

        if (data.action === 'init') {
            if (solver) {
                // Already initialized — just signal ready again
                window.postMessage({ __src: TAG, action: 'ready' }, '*');
                return;
            }
            try {
                // Wait for Twitter's webpack to be available (vendor.js loads async after document_start)
                let waited = 0;
                while (!window.webpackChunk_twitter_responsive_web) {
                    await sleep(100);
                    waited += 100;
                    if (waited > 15000) throw new Error('Timed out waiting for webpackChunk_twitter_responsive_web');
                }
                console.log('[OT Solver] webpack found, fetching challenge script:', data.challengeCode);

                // Fetch only the challenge script (vendor.js already available via page's webpack)
                const challengeData = await fetch(
                    'https://abs.twimg.com/responsive-web/client-web/ondemand.s.' + data.challengeCode + 'a.js'
                ).then(function (r) { return r.text(); });

                const headerRegex = /(\d+):(.+)=>.+default:\(\)=>(\w)}\);/;
                const headerMatch = challengeData.match(headerRegex);
                if (!headerMatch) {
                    throw new Error(
                        'Header not found at ' + data.challengeCode +
                        ' (' + String(challengeData).slice(0, 300) + '...)'
                    );
                }

                // Patch the challenge module: make it expose the solver function as window._OT_CHALLENGE
                const patched = challengeData.replace(headerRegex, '$1:$2=>{window._OT_CHALLENGE=()=>$3;');

                // eval() into the page context — Twitter's webpack processes the push,
                // calls our patched module factory, which sets window._OT_CHALLENGE.
                // eslint-disable-next-line no-eval
                eval(patched);

                // Wait a tick for webpack to process the newly pushed chunk
                await sleep(50);

                if (typeof window._OT_CHALLENGE !== 'function') {
                    // Fallback: try to run the module manually with a minimal webpack require
                    console.warn('[OT Solver] _OT_CHALLENGE not set by webpack push, trying manual require');
                    const id = headerMatch[1];
                    const chunks = window.webpackChunk_twitter_responsive_web || [];
                    const registry = {};
                    for (const payload of chunks) {
                        if (payload && payload[1]) Object.assign(registry, payload[1]);
                    }
                    if (!registry[id]) {
                        throw new Error('Module ' + id + ' not found in webpack registry after eval');
                    }
                    const cache = {};
                    function wreq(modId) {
                        if (cache[modId]) return cache[modId].exports;
                        const factory = registry[modId];
                        if (!factory) throw new Error('No module with id ' + modId);
                        const mod = { id: modId, loaded: false, exports: {} };
                        cache[modId] = mod;
                        wreq.d = function (exports, defs) {
                            for (const k in defs) Object.defineProperty(exports, k, { enumerable: true, get: defs[k] });
                        };
                        wreq.r = function (exports) {
                            if (typeof Symbol !== 'undefined' && Symbol.toStringTag)
                                Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
                            Object.defineProperty(exports, '__esModule', { value: true });
                        };
                        wreq.n = function (m) {
                            const g = m && m.__esModule ? function () { return m.default; } : function () { return m; };
                            wreq.d(g, { a: g });
                            return g;
                        };
                        wreq.o = function (obj, prop) { return Object.prototype.hasOwnProperty.call(obj, prop); };
                        factory(mod, mod.exports, wreq);
                        mod.loaded = true;
                        return mod.exports;
                    }
                    registry[id]({}, {}, wreq);
                    await sleep(20);
                }

                if (typeof window._OT_CHALLENGE !== 'function') {
                    throw new Error('_OT_CHALLENGE not set after eval and manual require');
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
