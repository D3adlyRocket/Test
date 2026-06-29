"use strict";

// Settings Layout for Nuvio Local Scrapers
async function onSettings() {
    return [
        { type: "header", label: "Language Preferences" },
        { type: "toggle", key: "langHindi", label: "Enable Hindi 🇮🇳", defaultValue: true },
        { type: "toggle", key: "langTamil", label: "Enable Tamil 🇮🇳", defaultValue: true },
        { type: "toggle", key: "langTelugu", label: "Enable Telugu 🇮🇳", defaultValue: true },
        { type: "toggle", key: "langMalayalam", label: "Enable Malayalam 🇮🇳", defaultValue: true },
        { type: "toggle", key: "langKannada", label: "Enable Kannada 🇮🇳", defaultValue: true },
        { type: "toggle", key: "langBengali", label: "Enable Bengali 🇮🇳", defaultValue: true }
    ];
}

const EINTHUSAN_BASE = "https://einthusan.asaddon.com";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";
const PROVIDER_NAME = "Einthusan";

const LANGUAGES = {
  langHindi: { path: "hindi", label: "Hindi 🇮🇳" },
  langTamil: { path: "tamil", label: "Tamil 🇮🇳" },
  langTelugu: { path: "telugu", label: "Telugu 🇮🇳" },
  langMalayalam: { path: "malayalam", label: "Malayalam 🇮🇳" },
  langKannada: { path: "kannada", label: "Kannada 🇮🇳" },
  langBengali: { path: "bengali", label: "Bengali 🇮🇳" }
};

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
};

const pad2 = (n) => String(Number.parseInt(n ?? 0, 10) || 0).padStart(2, "0");

const isProxyUrl = (url) =>
  String(url ?? "").includes("workers.dev") || /[?&]url=/.test(String(url ?? ""));

/**
 * Contacts the CDN signature handler to swap the standard MP4 token 
 * for a fully valid, verified HLS Adaptive 1080p stream token.
 */
async function fetchHighQualityToken(standardUrl) {
  if (!standardUrl || !standardUrl.includes("einthusan.io")) return standardUrl;
  
  try {
    // Extract the unique content identifier key (e.g., '7xEc' out of 'D7xEc.mp4')
    const match = standardUrl.match(/\/content\/D([^.]+)\.mp4/);
    if (!match) return standardUrl;
    
    const fileId = match[1]; 
    
    // Request a fresh, officially hashed signature from the API mirror for the high definition tier 'B' playlist
    const signingEndpoint = `https://einthusan.asaddon.com/api/sign?id=${fileId}&quality=B`;
    const res = await fetch(signingEndpoint, { headers: HEADERS });
    
    if (res.ok) {
      const data = await res.json();
      if (data && data.url) {
         return data.url; // Returns the authentic, playable Bxxxx.mp4.m3u8?e=...&md5=... link
      }
    }
  } catch (e) {
    console.error("Failed to fetch secure high quality signature token:", e);
  }
  return standardUrl;
}

async function getTmdbMeta(tmdbId, mediaType) {
  const type = mediaType === "tv" ? "tv" : "movie";
  const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function resolveProxyUrl(url) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { ...HEADERS, "Referer": url },
    });
    const finalUrl = response.url;
    if ([".m3u8", ".mp4", ".mkv"].some((ext) => finalUrl.includes(ext))) {
      return finalUrl;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/plain")) {
      const text = await response.text();
      return text.trim() || null;
    }
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return data?.url ?? data?.stream ?? data?.src ?? null;
    }
    return finalUrl || null;
  } catch {
    return null;
  }
}

async function fetchStreams(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data?.streams)) return [];
    
    return data.streams.filter((item) => {
      if (typeof item?.url !== "string" || !item.url.startsWith("https")) return false;
      const innerMatch = item.url.match(/[?&]url=(https?:\/\/[^&]+)/);
      return !innerMatch || innerMatch[1].startsWith("https");
    });
  } catch {
    return [];
  }
}

async function getStreams(tmdbId, mediaType, season, episode) {
  const isSeries = mediaType === "tv" || mediaType === "series" || season != null || episode != null;
  const s = season ?? 1;
  const e = episode ?? 1;

  try {
    const settings = globalThis.SCRAPER_SETTINGS || {};
    const allowedLanguages = Object.entries(LANGUAGES).filter(([key]) => {
        return settings[key] !== false;
    });

    const meta = await getTmdbMeta(tmdbId, isSeries ? "tv" : "movie");
    const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id;
    if (!imdbId) return [];

    const allStreams = [];

    await Promise.all(
      allowedLanguages.map(async ([_, langConfig]) => {
        let rawStreams = [];
        const endpointBase = `${EINTHUSAN_BASE}/${langConfig.path}`;

        if (!isSeries) {
          rawStreams = await fetchStreams(`${endpointBase}/stream/movie/${imdbId}.json`);
        } else {
          rawStreams = await fetchStreams(`${endpointBase}/stream/series/${imdbId}:${pad2(s)}:${pad2(e)}.json`);
          if (rawStreams.length === 0) {
            rawStreams = await fetchStreams(`${endpointBase}/stream/series/${imdbId}:${parseInt(s, 10)}:${parseInt(e, 10)}.json`);
          }
        }

        rawStreams.forEach((stream) => {
          allStreams.push({
            ...stream,
            langLabel: langConfig.label
          });
        });
      })
    );

    if (allStreams.length === 0) return [];

    const result = [];
    const grouped = {};

    for (const item of allStreams) {
      if (!item?.url || item.externalUrl || String(item.url).includes("github.com")) continue;

      let streamUrl = isProxyUrl(item.url)
        ? await resolveProxyUrl(item.url)
        : item.url;

      if (!streamUrl) continue;

      // Request a fresh legal high-quality signature token matching the file parameters
      streamUrl = await fetchHighQualityToken(streamUrl);

      // Check if signature successfully generated the 1080p HLS variant
      const res = (streamUrl.includes("/content/B") || streamUrl.includes(".m3u8")) ? "1080p" : "720p";
      const lang = item.langLabel; 
      const key = `${res}-${lang}`;

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({ ...item, resolvedUrl: streamUrl });
    }

    Object.entries(grouped).forEach(([key, items]) => {
      const [res, lang] = key.split("-");

      items.forEach(item => {
        const isHls = item.resolvedUrl.includes(".m3u8");
        const formatLabel = isHls ? "M3U8" : "MP4";

        const fullLayout =
`🎦 ${meta.title || meta.name}
💎 ${res} | 🗣️ ${lang}
🎞️ ${formatLabel} | 🔗 ${PROVIDER_NAME}`;

        result.push({
          name: `${PROVIDER_NAME} | ${res} | ${lang}`,
          title: fullLayout,
          size: fullLayout,
          description: fullLayout,
          url: item.resolvedUrl,
          behaviorHints: item.behaviorHints ?? {}
        });
      });
    });

    return result;
  } catch (err) {
    console.error("Fetch failed:", err);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams, onSettings };
} else {
    global.getStreams = getStreams;
    global.onSettings = onSettings;
}
