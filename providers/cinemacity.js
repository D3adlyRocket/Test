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
  langHindi: { path: "hindi", label: "Hindi 🇮🇳", webCode: "hindi" },
  langTamil: { path: "tamil", label: "Tamil 🇮🇳", webCode: "tamil" },
  langTelugu: { path: "telugu", label: "Telugu 🇮🇳", webCode: "telugu" },
  langMalayalam: { path: "malayalam", label: "Malayalam 🇮🇳", webCode: "malayalam" },
  langKannada: { path: "kannada", label: "Kannada 🇮🇳", webCode: "kannada" },
  langBengali: { path: "bengali", label: "Bengali 🇮🇳", webCode: "bengali" }
};

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5"
};

const pad2 = (n) => String(Number.parseInt(n ?? 0, 10) || 0).padStart(2, "0");

const isProxyUrl = (url) =>
  String(url ?? "").includes("workers.dev") || /[?&]url=/.test(String(url ?? ""));

/**
 * Directly scrapes the official web page source using the extracted ID 
 * and &uhd=true to safely grab the real, validated UHD adaptive playlist link.
 */
async function scrapeOfficialUhdLink(lowQualityUrl, langWebCode, isSeries) {
  if (!lowQualityUrl || !lowQualityUrl.includes("einthusan.io")) return lowQualityUrl;

  try {
    // Extract the page content ID from the low quality file name (e.g. 7xEc)
    const idMatch = lowQualityUrl.match(/\/content\/D([^.]+)\.mp4/);
    if (!idMatch) return lowQualityUrl;
    const contentId = idMatch[1];

    // Build the exact webpage watch URL discovered in your DevTools logs
    const typePath = isSeries ? "serial" : "movie";
    const watchPageUrl = `https://einthusan.tv/${typePath}/watch/${contentId}/?lang=${langWebCode}&uhd=true`;

    const response = await fetch(watchPageUrl, { headers: HEADERS });
    if (!response.ok) return lowQualityUrl;

    const html = await response.text();
    
    // Look for any signed UHD '/content/B...' stream embedded inside the webpage code
    const streamRegex = /https:\/\/[^"' ]+\/content\/B[^"' ]+\.mp4\.m3u8\?[^"' ]+/;
    const match = html.match(streamRegex);
    
    if (match && match[0]) {
      // Return the unescaped, perfectly clean premium playlist link
      return match[0].replace(/\\/g, "");
    }
  } catch (err) {
    console.error("Web scraping for UHD stream link failed:", err);
  }
  return lowQualityUrl;
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
            langLabel: langConfig.label,
            langWebCode: langConfig.webCode
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

      // Leverage the page-scrapper fallback to grab the true premium link using your devtools recipe
      streamUrl = await scrapeOfficialUhdLink(streamUrl, item.langWebCode, isSeries);

      // Verify if we successfully pulled the genuine HLS streaming master link
      const res = streamUrl.includes("/content/B") ? "1080p Ultra HD" : "720p HD";
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
