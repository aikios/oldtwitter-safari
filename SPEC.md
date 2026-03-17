# OldTwitter Safari Extension — SPEC

## Project Goal
Port the [OldTwitter Chrome extension](https://github.com/dimdenGD/OldTwitter) to a native Safari Web Extension. Restores the 2015/2018 Twitter UI on twitter.com and x.com.

## Source Reference
- Original: https://github.com/dimdenGD/OldTwitter
- Version targeted: latest main branch (as of 2026-03-17)

---

## How the Original Works

### Core Strategy
OldTwitter is **not** a CSS skin. It completely replaces Twitter's React UI:

1. **Block Twitter's scripts** — `blockBeforeInject.js` runs at `document_start`, sets all `<script>` tags to type `javascript/blocked` via MutationObserver, preventing React from mounting.
2. **Strip CSP headers** — `declarativeNetRequest` (ruleset.json) removes `Content-Security-Policy` headers so the extension can inject arbitrary HTML/JS, and blocks Twitter's service worker (`/sw.js`).
3. **Inject pre-built layouts** — Each Twitter page (home, profile, search, etc.) has a pre-built HTML + CSS + JS bundle in `layouts/[page]/`. These are injected as a complete replacement DOM.
4. **Use Twitter's own APIs** — `apis.js` wraps 50+ Twitter REST/GraphQL endpoints, authenticated via the user's existing cookies/tokens. The extension fetches data and renders it using its own DOM builder.
5. **Handle SPA navigation** — URL changes are monitored; new layouts are injected without full page reload.

### Key Files
| File | Role |
|------|------|
| `scripts/blockBeforeInject.js` | Blocks Twitter's React scripts at document_start |
| `scripts/injection.js` | Routes by URL, loads layouts, injects CSS/theme |
| `scripts/config.js` | 80+ settings from browser.storage.sync |
| `scripts/apis.js` | Wraps Twitter REST + GraphQL APIs |
| `scripts/helpers.js` | 30+ utility functions |
| `scripts/tweetConstructor.js` | Builds tweet DOM elements |
| `scripts/tweetviewer.js` | Modal/detail tweet view |
| `scripts/tdeb.js` | Lightweight DOM builder (elNew, htmlToNodes) |
| `scripts/background.js` | Service worker: handles events, dynamic script injection |
| `layouts/[page]/` | Pre-built HTML + CSS + JS per page |
| `ruleset.json` | declarativeNetRequest rules (CSP strip, sw.js block, CORS) |

### Network Interception (ruleset.json)
- Remove `Content-Security-Policy` and `X-Frame-Options` headers
- Block `/sw.js` service worker
- Redirect favicon to extension icon
- Add `Access-Control-Allow-Origin` to twimg.com image responses

---

## Safari Port Architecture

### Extension Type
**Safari Web Extension** (not Safari App Extension). Uses the WebExtension standard (same as Chrome MV3), supported since Safari 14. Requires an Xcode project wrapper (minimal hosting app + extension target).

### Why Not the Xcode Converter
The `xcrun safari-web-extension-converter` tool auto-converts Chrome extensions but produces bloated boilerplate and doesn't allow fine-grained control. We build the Xcode project structure manually.

### Directory Structure
```
oldtwitter-safari/
├── SPEC.md
├── README.md
├── OldTwitterSafari.xcodeproj/         # Xcode project
├── OldTwitterSafari/                   # macOS host app (minimal)
│   ├── AppDelegate.swift
│   ├── ViewController.swift
│   ├── Main.storyboard
│   ├── Assets.xcassets/
│   └── Info.plist
├── OldTwitterSafariExtension/          # Extension target
│   ├── SafariWebExtensionHandler.swift # Native messaging bridge
│   ├── Info.plist
│   └── Resources/                      # All web extension files live here
│       ├── manifest.json               # Safari-compatible MV3 manifest
│       ├── _locales/
│       ├── scripts/
│       │   ├── background.js
│       │   ├── blockBeforeInject.js
│       │   ├── config.js
│       │   ├── injection.js
│       │   ├── apis.js
│       │   ├── helpers.js
│       │   ├── tweetConstructor.js
│       │   ├── tweetviewer.js
│       │   ├── tdeb.js
│       │   ├── newtwitter.js
│       │   └── twchallenge.js
│       ├── layouts/
│       ├── libraries/
│       ├── images/
│       ├── fonts/
│       └── ruleset.json
└── scripts/                            # Build/dev scripts
    └── fetch-source.sh                 # Downloads latest source from OldTwitter repo
```

### Chrome → Safari API Adaptations

| Chrome API | Safari Equivalent | Notes |
|------------|-------------------|-------|
| `chrome.storage.sync` | `browser.storage.sync` | Safari 15+ |
| `chrome.scripting.executeScript` | `browser.scripting.executeScript` | Safari 16+ |
| `chrome.runtime.*` | `browser.runtime.*` | Full support |
| `chrome.declarativeNetRequest` | `browser.declarativeNetRequest` | Safari 16.4+ |
| `chrome.contextMenus` | `browser.contextMenus` | Safari 15+ |

**Strategy**: Use Mozilla's `browser-polyfill.js` to shim `chrome.*` → `browser.*` calls, then minimal targeted patches for any remaining incompatibilities.

### manifest.json Changes for Safari
- Add `"browser_specific_settings": { "safari": { "strict_min_version": "16.4" } }`
- Background service_worker → may need `"background": { "scripts": ["scripts/background.js"] }` fallback
- Verify all `web_accessible_resources` entries use correct match patterns

### Key Safari-Specific Constraints
- **No `chrome.storage.session`** in older Safari — use `browser.storage.local` fallback
- **Content Security Policy**: Safari enforces CSP on extension pages more strictly
- **`declarativeNetRequest`**: Supported from Safari 16.4; CSP header removal rule syntax identical
- **Service Worker**: Safari supports background service workers since Safari 15.4
- **App requirement**: Safari extensions must be packaged inside a macOS/iOS app — we create a minimal Swift app shell

### Build Process
1. Source files live in `OldTwitterSafariExtension/Resources/`
2. Xcode builds the app + extension together
3. To test: build in Xcode, enable extension in Safari > Preferences > Extensions
4. Distribution: Mac App Store or notarized DMG

---

## Implementation Phases

### Phase 1 — Project Scaffolding
- [x] Git repo initialized
- [ ] Fetch all source files from OldTwitter repo
- [ ] Create Xcode project structure manually (Swift app shell + extension target)
- [ ] Add browser-polyfill.js

### Phase 2 — API Compatibility Layer
- [ ] Audit all `chrome.*` calls across all JS files
- [ ] Apply polyfill or targeted patches
- [ ] Test manifest.json loads correctly in Safari

### Phase 3 — Core Functionality
- [ ] blockBeforeInject.js works (Twitter's React blocked)
- [ ] declarativeNetRequest rules active (CSP stripped, sw.js blocked)
- [ ] Layouts inject correctly for each page
- [ ] Settings persist via browser.storage.sync

### Phase 4 — Feature Parity
- [ ] Timeline loads (home, notifications)
- [ ] Profile pages work
- [ ] Search works
- [ ] Tweet interactions (like, retweet, reply)
- [ ] Media viewer
- [ ] DMs (if feasible)

### Phase 5 — Polish
- [ ] Icons and branding
- [ ] Settings UI in extension popup
- [ ] iOS Safari support (separate target)
- [ ] App Store submission prep

---

## Technical Decisions

**Approach: Copy + Adapt, Not Rewrite**
OldTwitter has 2800+ commits of battle-tested code. We copy the source files and make targeted Safari compatibility patches rather than reimplementing from scratch. This gives us feature parity from day one.

**Polyfill Strategy**
Use `browser-polyfill.js` as a first pass. Manually fix anything it doesn't cover (e.g., `chrome.scripting` nuances in Safari).

**No Extension Converter**
Manual Xcode project gives us full control over build settings, entitlements, and the app shell UI.
