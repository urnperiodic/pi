/*
 * script.js — Client-side bootstrap for the FreeSearch web proxy.
 *
 * Flow:
 *   1. Create a ScramjetController, mapping the .wasm / .all.js / .sync.js
 *      runtime assets to their CDN URLs and defining the proxy URL prefix.
 *   2. Register the Service Worker (sw.js).
 *   3. Open a BareMuxConnection and point it at a public Wisp transport.
 *   4. On form submit: normalise the input into a URL, encode it with
 *      __scramjet$config.encodeUrl(), and navigate to the proxied path.
 *
 * Everything here is 100% client-side — safe for Netlify / Vercel static hosting.
 */

(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  const CDN = "https://cdn.jsdelivr.net/npm/@mercuryworkshop/scramjet@latest/dist";

  // URL prefix under which all proxied pages are served (must end with "/").
  const PREFIX = "/scramjet/";

  // Public Wisp transport WebSocket endpoint. Swap this for your own server
  // for reliability — public servers are best-effort and may be unavailable.
  const WISP_URL =
    (location.protocol === "https:" ? "wss" : "ws") +
    "://wisp.mercuryworkshop.xyz/";

  // ---------------------------------------------------------------------------
  // DOM references
  // ---------------------------------------------------------------------------

  const form = document.getElementById("search-form");
  const input = document.getElementById("search-input");
  const button = document.getElementById("search-btn");
  const statusEl = document.getElementById("status");
  const statusText = document.getElementById("status-text");
  const chips = document.querySelectorAll(".chip");

  let scramjet = null;
  let ready = false;

  // ---------------------------------------------------------------------------
  // UI helpers
  // ---------------------------------------------------------------------------

  function setStatus(state, message) {
    statusEl.className = "status " + state; // loading | ready | error
    statusText.textContent = message;
  }

  function setReady(isReady) {
    ready = isReady;
    button.disabled = !isReady;
    button.textContent = isReady ? "Search" : "Searching…";
  }

  // ---------------------------------------------------------------------------
  // Input normalisation: turn raw user text into a real https:// URL.
  // ---------------------------------------------------------------------------

  function normaliseToUrl(raw) {
    let value = (raw || "").trim();
    if (!value) return null;

    // Already a full URL.
    if (/^https?:\/\//i.test(value)) return value;

    // Looks like a bare domain (contains a dot, no spaces) -> prepend https://
    const looksLikeDomain = /^[^\s]+\.[^\s]{2,}(\/.*)?$/.test(value) && !value.includes(" ");
    if (looksLikeDomain) {
      return "https://" + value;
    }

    // Otherwise treat it as a search query (Google).
    return "https://www.google.com/search?q=" + encodeURIComponent(value);
  }

  // ---------------------------------------------------------------------------
  // Scramjet controller setup
  // ---------------------------------------------------------------------------

  function createController() {
    // ScramjetController is exposed by the scramjet.all.js bundle.
    const ControllerCtor =
      window.ScramjetController ||
      (window.$scramjet && window.$scramjet.ScramjetController);

    if (!ControllerCtor) {
      throw new Error("ScramjetController bundle failed to load from CDN.");
    }

    return new ControllerCtor({
      prefix: PREFIX,
      files: {
        wasm: CDN + "/scramjet.wasm.wasm",
        all: CDN + "/scramjet.all.js",
        sync: CDN + "/scramjet.sync.js",
      },
      // Flags can be tuned; these are sensible cross-site defaults.
      flags: {
        rewriterLogs: false,
        scramitize: false,
        cleanErrors: true,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Boot sequence
  // ---------------------------------------------------------------------------

  async function boot() {
    if (!("serviceWorker" in navigator)) {
      setStatus("error", "Service Workers are not supported in this browser.");
      return;
    }

    if (!window.isSecureContext) {
      setStatus("error", "A secure (HTTPS) context is required for the proxy.");
      return;
    }

    try {
      setStatus("loading", "Configuring Scramjet engine…");

      // 1. Build & initialise the controller (writes config the SW will read).
      scramjet = createController();
      await scramjet.init();

      // 2. Register the Service Worker that actually intercepts traffic.
      setStatus("loading", "Registering service worker…");
      await navigator.serviceWorker.register("./sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      // 3. Open a BareMux connection and attach the Wisp transport.
      setStatus("loading", "Connecting transport…");
      await connectTransport();

      // Ready to proxy.
      setReady(true);
      setStatus("ready", "Ready — type a URL or search term to begin.");
    } catch (err) {
      console.error("[FreeSearch] Boot failed:", err);
      setReady(false);
      setStatus("error", "Initialization failed: " + (err && err.message ? err.message : err));
    }
  }

  /**
   * Open a BareMuxConnection and set the active transport to Epoxy (Wisp).
   * BareMux is exposed globally as window.BareMux by the bundle.
   */
  async function connectTransport() {
    if (!window.BareMux || !window.BareMux.BareMuxConnection) {
      throw new Error("bare-mux bundle failed to load from CDN.");
    }

    // The worker path points at bare-mux's own worker shipped on the CDN.
    const connection = new window.BareMux.BareMuxConnection(
      "https://cdn.jsdelivr.net/npm/@mercuryworkshop/bare-mux@2/dist/worker.js"
    );

    // Use the Epoxy transport (a Wisp client) pointed at the public Wisp server.
    await connection.setTransport(
      "https://cdn.jsdelivr.net/npm/@mercuryworkshop/epoxy-transport@latest/dist/index.mjs",
      [{ wisp: WISP_URL }]
    );
  }

  // ---------------------------------------------------------------------------
  // Navigation: encode the target URL and go to the proxied path.
  // ---------------------------------------------------------------------------

  function navigateTo(rawUrl) {
    if (!ready || !scramjet) {
      setStatus("error", "Proxy is not ready yet — please wait a moment.");
      return;
    }

    const target = normaliseToUrl(rawUrl);
    if (!target) {
      input.focus();
      return;
    }

    try {
      // __scramjet$config.encodeUrl is the canonical encoder; fall back to the
      // controller's encodeUrl if the global isn't present in this build.
      let encoded;
      if (window.__scramjet$config && typeof window.__scramjet$config.encodeUrl === "function") {
        encoded = window.__scramjet$config.encodeUrl(target);
      } else if (typeof scramjet.encodeUrl === "function") {
        encoded = scramjet.encodeUrl(target);
      } else {
        throw new Error("No Scramjet URL encoder available.");
      }

      setStatus("loading", "Opening " + target + " …");
      window.location.href = PREFIX + encoded;
    } catch (err) {
      console.error("[FreeSearch] Navigation failed:", err);
      setStatus("error", "Could not open that address: " + (err.message || err));
    }
  }

  // ---------------------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------------------

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    navigateTo(input.value);
  });

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      const url = chip.getAttribute("data-url");
      input.value = url;
      navigateTo(url);
    });
  });

  // Kick everything off once the page is ready.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
