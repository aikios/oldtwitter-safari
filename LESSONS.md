# Lessons & Takeaways — OldTwitter Safari Port

## Safari Extension Architecture

### Safari ignores `safari-web-extension://` URLs as favicons
Safari will not use `safari-web-extension://` (or `chrome-extension://`) URLs set as `<link rel="icon">` hrefs. The only reliable approach is embedding a `data:image/x-icon;base64,...` URL directly in the layout HTML. No fetch, no extension URL lookup, no `blob:` URL needed.

### Safari only re-evaluates favicons on navigation events
Setting `document.head.appendChild(faviconLink)` or modifying `link.href` after `innerHTML` replacement does nothing — Safari ignores it. You must trigger a navigation event via `history.replaceState(null, '', location.href)` (using `null` as state, not `history.state` which may contain non-serializable data) to force Safari to pick up the new `<link rel="icon">`.

### `document.documentElement.innerHTML = html` wipes everything
When the extension replaces the entire page DOM with a layout HTML string, any `<link>` or `<script>` injected earlier by content scripts is destroyed. The favicon and any other persistent DOM elements must be embedded in the layout HTML strings themselves, not injected before them.

### `browser.runtime.getURL` not `chrome.runtime.getURL`
Safari requires `browser.runtime.getURL` (from the WebExtensions polyfill). `chrome.runtime.getURL` is Chromium-specific and produces wrong URLs in Safari. Any place that constructs extension resource URLs (favicons, icons) must use `browser.runtime.getURL`.

### DNR redirects don't intercept cached requests
`declarativeNetRequest` redirect rules won't fire for resources the browser has already cached. When debugging favicon/icon issues, always test with cache cleared (`Develop → Empty Caches` in Safari). A working mechanism can look broken if the old cached asset is still being served.

### CSS from layout HTML uses `chrome-extension://` scheme
The `header_css` and `css` variables fetched from layout files contain `chrome-extension://` URLs (baked in at build time). These must be rewritten to the correct scheme (`safari-web-extension://`) at runtime using `browser.runtime.getURL("").split("://")[0]` to derive the correct scheme prefix.

---

## Safari vs Chrome Extension Differences

| Feature | Chrome | Safari |
|---|---|---|
| Extension URL scheme | `chrome-extension://` | `safari-web-extension://` |
| Runtime URL API | `chrome.runtime.getURL` | `browser.runtime.getURL` |
| Favicon via extension URL | Works | Broken |
| Favicon via `data:` URL | Works | Works |
| `history.replaceState` to trigger favicon reload | Not needed | Required |
| `beforescriptexecute` event | Not supported | Supported (Firefox too) |

---

## DOM & Layout

### Inline translate button vs. action bar
Placing a translate button inline below the tweet body (reusing the existing `tweet-translate` node, just removing the `options.mainTweet` guard) is cleaner than adding an icon to the action bar. The action bar is already crowded, and inline text matches the established UX pattern from the tweet detail page.

### `getElementsByClassName()[0]` picks DOM order
When a helper looks up `tweet.getElementsByClassName("some-class")[0]`, it returns the first element in DOM order. If the same class appears in both the tweet header and action bar, only the first one gets the event handler. Moving translate to only one location eliminates this ambiguity.

---

## Debugging Process

### Add targeted logging early, remove it before shipping
Debug `console.log` lines with a consistent prefix (e.g. `[OldTwitter Safari DEBUG]`) make it easy to grep and remove them later. Don't leave them in — they expose internal state and clutter the console for users.

### Test cache-sensitive fixes with a deliberately broken asset first
When debugging favicon/icon replacement, first use a visually obvious test asset (solid black square) to confirm the mechanism works before swapping in the real asset. This separates "mechanism broken" from "asset looks too similar to notice."

### Browser caching masks working fixes
If a fix appears not to work but the code looks correct, suspect the cache before assuming the logic is wrong. Always verify with a fresh cache when working on resource replacement (favicons, fonts, images).
