# FreeSearch — Open-Source Static Web Proxy

A single-folder, **100% client-side** web proxy with a clean, dark, search-engine-style
UI. Powered by [Scramjet](https://github.com/MercuryWorkshop/scramjet) (URL rewriter +
service worker proxy) and [bare-mux](https://github.com/MercuryWorkshop/bare-mux)
(transport multiplexer). Drop the folder into Netlify or Vercel and it deploys as a pure
static site — no backend code to run.

---

## 📁 Project Structure

```
index.html    # Dark, responsive search UI + CDN bundle loads
script.js     # ScramjetController setup, SW registration, BareMux transport, form handling
sw.js         # Service Worker — imports Scramjet worker, intercepts 'fetch'
README.md     # This file
```

---

## ✅ Completed Features

- **Modern dark UI** — centered search bar with the placeholder `Search the web freely...`,
  gradient logo, quick-link chips, and a live status indicator.
- **Fully responsive** layout (mobile → desktop).
- **CDN-loaded engine** — `bare-mux` and `@mercuryworkshop/scramjet` controller bundles
  loaded from jsDelivr (no build step required).
- **Service Worker** (`sw.js`) that imports the Scramjet worker bundle, instantiates
  `ScramjetServiceWorker`, and routes intercepted requests through `scramjet.fetch(event)`.
- **Client bootstrap** (`script.js`) that:
  - Creates a `ScramjetController`, mapping `.wasm`, `.all.js`, and `.sync.js` to CDN URLs.
  - Registers `sw.js`.
  - Opens a `BareMuxConnection` and attaches a public **Wisp** transport
    (`wss://wisp.mercuryworkshop.xyz/`) via the Epoxy transport.
  - Intercepts form submit, normalises input into an `https://` URL (or a Google search),
    encodes it with `__scramjet$config.encodeUrl()`, and sets `window.location.href` to
    the proxy path.

---

## 🌐 Functional Entry Points

| Path / URI | Description | Parameters |
|------------|-------------|------------|
| `/` (`index.html`) | Main search/proxy interface | — |
| `/scramjet/<encoded-url>` | Proxied page output (handled by the Service Worker) | `<encoded-url>` is produced by `__scramjet$config.encodeUrl()` |
| `/sw.js` | Service Worker script | registered with `scope: "/"` |

**Search box behaviour:**
- `example.com` → treated as a domain → `https://example.com`
- `https://site.com/page` → used as-is
- `free search term` → routed to `https://www.google.com/search?q=...`

---

## 🚀 Deployment (Netlify / Vercel)

This is a static site — no configuration needed.

- **Netlify:** drag-and-drop the folder into the Netlify dashboard, or connect the repo.
  Publish directory = project root.
- **Vercel:** import the repo; framework preset = **Other**; output dir = root.

> To deploy from this workspace, open the **Publish tab** to publish in one click.

### Required hosting capability
The Service Worker is registered with `scope: "/"`, so the files must be served from the
**site root** over **HTTPS** (both Netlify and Vercel do this automatically). Local testing
must use `https://` or `http://localhost` — Service Workers won't run on `file://`.

---

## ⚙️ How It Works

```
User input ──► script.js
                  │  normalise → encodeUrl()
                  ▼
        window.location = /scramjet/<encoded>
                  │
                  ▼
            sw.js (fetch event)
                  │  scramjet.route() → scramjet.fetch()
                  ▼
            bare-mux transport ──► Wisp server ──► real website
```

- **Scramjet** rewrites HTML/CSS/JS so links and sub-resources stay inside the proxy.
- **bare-mux** abstracts the transport; here it uses **Epoxy** speaking the **Wisp**
  protocol to the backend server.
- **Wisp server** is the only non-static piece — it performs the actual outbound network
  requests on behalf of the browser.

---

## 🧩 Data Models / Storage

None. This app stores **no structured data** and uses **no database or Table API**.
All state is in-memory in the browser; Scramjet persists its own config for the Service
Worker via the standard Scramjet store.

---

## ⚠️ Important Limitations

1. **A backend transport is mandatory.** Static hosts (Netlify/Vercel) **cannot run** a
   Wisp/Bare server. The app points at the public `wss://wisp.mercuryworkshop.xyz/`
   server, which is best-effort and may be **down, rate-limited, or blocked**. If proxying
   fails, host your own Wisp server and update `WISP_URL` in `script.js`.
2. **CDN `@latest` pinning** — bundles are pulled from `@latest`. If Scramjet ships a
   breaking change, pin a specific version in `index.html`, `script.js`, and `sw.js`.
3. **Not all sites proxy cleanly** — heavy anti-bot, strict CSP, or WebRTC-dependent sites
   may render imperfectly. This is a limitation of all interception proxies.
4. Use responsibly and in accordance with your local laws and the terms of any service you
   access.

---

## 🛠️ Recommended Next Steps

1. **Self-host a Wisp server** ([wisp-server-node](https://github.com/MercuryWorkshop/wisp-server-node))
   and point `WISP_URL` at it for reliable, fast proxying.
2. **Pin CDN versions** (replace `@latest` with an exact version) for production stability.
3. **Add a transport switcher** in the UI (Wisp ↔ Bare) using `connection.setTransport`.
4. **Add localStorage history / favorites** for recently visited sites.
5. **Add a loading overlay / error toast** for a smoother UX during navigation.

---

## 🔧 Configuration Reference (`script.js`)

| Constant | Default | Purpose |
|----------|---------|---------|
| `CDN` | jsDelivr Scramjet dist | Base URL for Scramjet runtime assets |
| `PREFIX` | `/scramjet/` | URL prefix for proxied pages |
| `WISP_URL` | `wss://wisp.mercuryworkshop.xyz/` | Backend transport endpoint (change this!) |

---

## 📜 Credits

- [Scramjet](https://github.com/MercuryWorkshop/scramjet) — Mercury Workshop
- [bare-mux](https://github.com/MercuryWorkshop/bare-mux) — Mercury Workshop
- [Epoxy transport](https://github.com/MercuryWorkshop/epoxy-tls) — Mercury Workshop
