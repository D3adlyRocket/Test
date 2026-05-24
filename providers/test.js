"use strict";

const DEFAULT_ADDON_URL = "https://flixnest.app/flix-streams/u/6p9xzp78nunz";
const FLIXNEST_ADDON_URL = String(process.env.FLIXNEST_ADDON_URL || DEFAULT_ADDON_URL).replace(/\/+$/, "");
const FLIXNEST_TIMEOUT_MS = Number(process.env.FLIXNEST_TIMEOUT_MS || 30000);

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FLIXNEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Emby-Doom-addon-v1"
      },
      redirect: "follow",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function stremioId(tmdbId, mediaType, season, episode) {
  const id = `tmdb:${tmdbId}`;
  if (mediaType === "tv" || mediaType === "series") {
    return `${id}:${season}:${episode}`;
  }
  return id;
}

function normalizeStream(stream) {
  if (!stream || typeof stream !== "object" || !stream.url) {
    return null;
  }

  const behaviorHints = Object.assign({}, stream.behaviorHints || {});
  if (behaviorHints.proxyHeaders && behaviorHints.proxyHeaders.request) {
    behaviorHints.proxyHeaders = {
      request: Object.fromEntries(
        Object.entries(behaviorHints.proxyHeaders.request)
          .filter(([, value]) => value !== undefined && value !== null && value !== "")
          .map(([key, value]) => [key, String(value)])
      )
    };
  }

  return {
    name: stream.name || stream.message || "FlixNest",
    title: stream.title || stream.description || stream.name || "FlixNest stream",
    description: stream.description || stream.title || "",
    url: stream.url,
    behaviorHints,
    videoSize: stream.videoSize || behaviorHints.videoSize,
    quality: stream.quality,
    headers: stream.headers
  };
}

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  const type = mediaType === "tv" || mediaType === "series" ? "series" : "movie";
  const id = stremioId(tmdbId, mediaType, season, episode);
  const url = `${FLIXNEST_ADDON_URL}/stream/${type}/${encodeURIComponent(id)}.json`;

  console.log(`[FlixNest] Fetching ${type} streams: ${id}`);
  const data = await fetchJson(url);
  const streams = Array.isArray(data.streams) ? data.streams : [];
  console.log(`[FlixNest] Returned ${streams.length} stream(s)`);

  return streams.map(normalizeStream).filter(Boolean);
}

module.exports = { getStreams };
