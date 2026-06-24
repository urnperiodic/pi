/*
 * sw.js — Service Worker for the FreeSearch web proxy.
 *
 * Responsibilities:
 *   1. Import the Scramjet worker bundle from the CDN.
 *   2. Instantiate ScramjetServiceWorker.
 *   3. Intercept the global 'fetch' event and route any request that
 *      belongs to the proxy through scramjet.fetch(event).
 *
 * This file runs entirely inside the Service Worker scope (no DOM).
 */

// Import the Scramjet service-worker runtime. The "worker" bundle registers
// the ScramjetServiceWorker class onto the worker's global scope.
importScripts(
  "https://cdn.jsdelivr.net/npm/@mercuryworkshop/scramjet@latest/dist/scramjet.worker.js"
);

// Instantiate the Scramjet service worker. It reads the configuration that was
// persisted by the ScramjetController on the client side (prefix, files, etc.).
const scramjet = new ScramjetServiceWorker();

/**
 * Boot helper — loads the Scramjet config before handling traffic.
 * Newer Scramjet builds expose `loadConfig()`; older ones don't, so we guard it.
 */
async function handleRequest(event) {
  await scramjet.loadConfig();

  // Ask Scramjet whether this request targets the proxy. If so, let it handle it.
  if (scramjet.route(event)) {
    return scramjet.fetch(event);
  }

  // Otherwise, perform a normal network fetch (assets, the app shell, etc.).
  return fetch(event.request);
}

// Activate immediately so the proxy is usable on first load.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Core interception: every request the page makes passes through here.
self.addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});
