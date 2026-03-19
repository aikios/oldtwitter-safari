# OldTwitter for Safari

A Safari Web Extension that restores the classic 2015/2018 Twitter UI on twitter.com and x.com. This is a Safari port of the [OldTwitter Chrome extension](https://github.com/dimdenGD/OldTwitter) by dimdenGD.

## What It Does

OldTwitter is not a CSS skin — it completely replaces Twitter's React frontend with a pre-built classic layout:

- Blocks Twitter's JavaScript from loading entirely
- Strips Content-Security-Policy headers so the extension can inject its own UI
- Injects pre-built HTML/CSS/JS layouts for each page (home, profile, search, notifications, etc.)
- Calls Twitter's own internal APIs using your existing login session
- Restores the old UI: chronological timeline, classic tweet cards, old-style notifications, DMs, and more

All features from the original Chrome extension are preserved: themes, font options, custom CSS, tweet filtering, muting, translation, media viewer, and more.

## Requirements

- macOS 13 (Ventura) or later
- Safari 16.4 or later
- Xcode 14 or later (to build)

## Installation

### 1. Clone the repo

```bash
git clone https://github.com/aikios/oldtwitter-safari.git
cd oldtwitter-safari
```

### 2. Open in Xcode

```bash
open OldTwitterSafari.xcodeproj
```

### 3. Build and run

Select the `OldTwitterSafari` scheme and press **Run** (⌘R). This builds the host app and the extension together.

### 4. Enable the extension in Safari

1. Open **Safari → Settings → Extensions**
2. Enable **Old Twitter Layout**
3. Click **Always Allow on twitter.com** and **Always Allow on x.com** when prompted
4. Navigate to [twitter.com](https://twitter.com) or [x.com](https://x.com)

> **Note:** The first time you load Twitter after enabling the extension, you may need to log in again. Your credentials are not stored by the extension — it uses your browser's existing Twitter session.

### Signing

If you're building for personal use, set the team to your personal Apple ID in **Signing & Capabilities**. No paid developer account is required to run on your own Mac.

## How It Works

The extension runs in three stages on every Twitter page load:

1. **`blockBeforeInject.js`** — injected at `document_start`, attaches a MutationObserver that sets all incoming `<script>` tags to `type="javascript/blocked"`, preventing Twitter's React app from mounting.

2. **`ruleset.json`** — declarativeNetRequest rules strip `Content-Security-Policy` and `X-Frame-Options` headers, block Twitter's service worker, and fix CORS headers for media.

3. **`injection.js`** — detects the current page URL, fetches the corresponding pre-built layout from `layouts/[page]/`, replaces `document.documentElement.innerHTML` with the layout HTML, then injects the layout's scripts and styles. The layout scripts call Twitter's own REST/GraphQL APIs via `apis.js` to load your actual timeline, notifications, etc.

## Project Structure

```
OldTwitterSafariExtension/Resources/
├── manifest.json               # Safari MV3 manifest
├── scripts/
│   ├── blockBeforeInject.js    # Blocks Twitter's React at document_start
│   ├── injection.js            # Routes pages and injects layouts
│   ├── apis.js                 # Twitter REST + GraphQL API wrappers
│   ├── helpers.js              # Shared utilities
│   ├── tweetConstructor.js     # Builds tweet DOM elements
│   ├── tweetviewer.js          # Modal tweet detail view
│   ├── background.js           # Service worker
│   └── ...
├── layouts/
│   ├── home/                   # Timeline
│   ├── tweet/                  # Individual tweet + replies
│   ├── profile/                # User profiles
│   ├── notifications/          # Notifications + mentions
│   ├── search/                 # Search results
│   ├── bookmarks/
│   ├── lists/
│   └── ...                     # Each layout has index.html + style.css + script.js
├── images/                     # Icons and assets
├── fonts/                      # Custom icon font (JustBird, rosetta)
├── libraries/                  # Third-party libs (twemoji, viewer.js, etc.)
└── ruleset.json                # declarativeNetRequest rules
```

## Credits

All core extension code is by [dimdenGD](https://github.com/dimdenGD/OldTwitter). This repo contains only the Safari packaging, Xcode project, and Safari-specific compatibility patches.

Safari-specific changes made in this port:
- Xcode project and Swift host app wrapper
- `browser.runtime.getURL` instead of `chrome.runtime.getURL` throughout
- Favicon delivered as embedded `data:` URL (Safari ignores `safari-web-extension://` URLs as favicons)
- `history.replaceState` trigger for Safari to re-evaluate favicon after DOM replacement
- CSS URL rewriting (`chrome-extension://` → `safari-web-extension://`) for font assets
- Translate button shown inline on timeline (not just tweet detail page)

## License

See the [original project](https://github.com/dimdenGD/OldTwitter) for license information.
