// OldTwitter Challenge Solver — runs in the page's MAIN world.
// OldTwitter replaces the page DOM, so Twitter's vendor.js never runs and
// webpackChunk_twitter_responsive_web is never populated by the page itself.
// We fetch vendor.js + ondemand.s.*.js manually and eval them, exactly as the
// original sandbox.html does — but in the main world to avoid Safari's
// isolated-world postMessage limitations.
//
// Communication: content script (twchallenge.js) ↔ this script via window.postMessage
// with {__src: '__ot__', action: ...} messages.

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
                // Already initialized
                window.postMessage({ __src: TAG, action: 'ready' }, '*');
                return;
            }
            try {
                // Fetch vendor.js and ondemand.s.*.js in parallel (same as sandbox.html).
                // OldTwitter replaces the page so Twitter's webpack never loads; we
                // must bootstrap it ourselves.
                console.log('[OT Solver] fetching vendor.js (' + data.vendorCode + ') + challenge (' + data.challengeCode + ')');
                const [vendorData, challengeData] = await Promise.all([
                    fetch('https://abs.twimg.com/responsive-web/client-web/vendor.' + data.vendorCode + '.js').then(function (r) { return r.text(); }),
                    fetch('https://abs.twimg.com/responsive-web/client-web/ondemand.s.' + data.challengeCode + 'a.js').then(function (r) { return r.text(); })
                ]);
                console.log('[OT Solver] scripts fetched, vendor:', vendorData.length, 'challenge:', challengeData.length);

                // Bootstrap webpack in the main world by eval-ing vendor.js
                // eslint-disable-next-line no-eval
                eval(vendorData);

                // Set the twitter-site-verification meta tag (challenge solver reads it)
                let verif = document.querySelector('meta[name="twitter-site-verification"]');
                if (!verif) {
                    verif = document.createElement('meta');
                    verif.name = 'twitter-site-verification';
                    document.head.appendChild(verif);
                }
                verif.content = data.verificationCode;

                // Add animation SVGs (challenge solver needs them in the DOM)
                let animsDiv = document.getElementById('__ot_anims__');
                if (!animsDiv) {
                    animsDiv = document.createElement('div');
                    animsDiv.id = '__ot_anims__';
                    animsDiv.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
                    document.body.appendChild(animsDiv);
                }
                for (let anim of (data.anims || [])) {
                    animsDiv.innerHTML += '\n' + anim;
                }

                // Match the challenge module and patch it to expose the solver function
                const headerRegex = /(\d+):(.+)=>.+default:\(\)=>(\w)}\);/;
                const headerMatch = challengeData.match(headerRegex);
                if (!headerMatch) {
                    throw new Error(
                        'Header not found at ' + data.challengeCode +
                        ' (' + String(challengeData).slice(0, 300) + '...)'
                    );
                }

                // Patch: make the module factory set window._OT_CHALLENGE instead of just exporting
                const patched = challengeData.replace(headerRegex, '$1:$2=>{window._OT_CHALLENGE=()=>$3;');

                // eval the patched challenge script — vendor.js set up webpack, so
                // webpackChunk_twitter_responsive_web.push() is intercepted and the module executes
                // eslint-disable-next-line no-eval
                eval(patched);

                // Give webpack a tick to process the newly pushed chunk
                await sleep(50);

                if (typeof window._OT_CHALLENGE !== 'function') {
                    // Fallback: run the module manually with a minimal webpack require
                    console.warn('[OT Solver] _OT_CHALLENGE not set by webpack push, trying manual require');
                    const id = headerMatch[1];
                    const chunks = window.webpackChunk_twitter_responsive_web || [];
                    const registry = {};
                    for (const payload of chunks) {
                        if (payload && payload[1]) Object.assign(registry, payload[1]);
                    }
                    if (!registry[id]) {
                        throw new Error('Module ' + id + ' not found in webpack registry after eval (registry size: ' + Object.keys(registry).length + ')');
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
                    // In sandbox.html the challenge chunk is always at index [1][1][id].
                    // Here we search all chunks for the module with the right id.
                    let ran = false;
                    for (const chunk of chunks) {
                        if (chunk && chunk[1] && chunk[1][id]) {
                            chunk[1][id]({}, {}, wreq);
                            ran = true;
                            break;
                        }
                    }
                    if (!ran) {
                        throw new Error('Could not find and run module ' + id + ' in any chunk');
                    }
                    await sleep(20);
                }

                if (typeof window._OT_CHALLENGE !== 'function') {
                    throw new Error('_OT_CHALLENGE not set after eval and manual require fallback');
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
