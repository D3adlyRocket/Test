"use strict";

const __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    const fulfilled = (value) => {
      try { step(generator.next(value)); } catch (e) { reject(e); }
    };
    const rejected = (value) => {
      try { step(generator.throw(value)); } catch (e) { reject(e); }
    };
    const step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

const PYNVIX_BASE = "https://moviebox-cfa7.onrender.com";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
};

const pad2 = (n) => String(Number.parseInt(n ?? 0, 10) || 0).padStart(2, "0");

const cleanText = (str) =>
  String(str ?? "").replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu, "").trim();

const extractQuality = (titleText) => {
  const match = String(titleText ?? "").match(/(\d{3,4}p)/i);
  return match?.[0] ?? "Unknown";
};

const extractLanguage = (cleanedTitle) => {
  const parts = String(cleanedTitle ?? "").split("|");
  if (parts.length < 2) return "Default";
  const raw = parts[parts.length - 1].trim();
  return raw === "" ? "Default" : raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
};

const isProxyUrl = (url) => String(url ?? "").includes("workers.dev") || /[?&]url=/.test(String(url ?? ""));

function getImdbId(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const type = mediaType === "tv" ? "tv" : "movie";
    const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    try {
      const response = yield fetch(url);
      if (!response.ok) return null;
      const data = yield response.json();
      return data?.external_ids?.imdb_id ?? null;
    } catch { return null; }
  });
}

function resolveProxyUrl(url) {
  return __async(this, null, function* () {
    try {
      const response = yield fetch(url, { redirect: "follow", headers: { ...HEADERS, "Referer": url } });
      const finalUrl = response.url;
      if ([".m3u8", ".mp4", ".mkv"].some((ext) => finalUrl.includes(ext))) return finalUrl;
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const data = yield response.json();
        return data?.url ?? data?.stream ?? data?.src ?? null;
      }
      return finalUrl || null;
    } catch { return null; }
  });
}

function buildStream(item) {
  return __async(this, null, function* () {
    // 1. Filter out the unwanted link
    const unwantedUrl = "https://bcdnxw.hakunaymatata.com/resource/320b187e54ef8eba8a5e5512bc13d47e.mp4";
    if (!item?.url || item.url.includes(unwantedUrl) || item.externalUrl || String(item.url).includes("github.com")) return null;

    const cleanedTitle = cleanText(item.title);
    const quality = extractQuality(cleanedTitle);
    let language = extractLanguage(cleanedTitle);

    // 2. Force "Default" to "Hindi" to match your requirement for the first entry
    if (language === "Default") {
      language = "Hindi";
    }

    const streamUrl = isProxyUrl(item.url) ? yield resolveProxyUrl(item.url) : item.url;
    if (!streamUrl) return null;

    const nameParts = ["Pynvix."];
    if (language) nameParts.push(language);

    return {
      name: nameParts.join(" • "),
      title: quality,
      url: streamUrl,
      quality,
      provider: "Pynvix.",
    };
  });
}

function fetchStreams(url) {
  return __async(this, null, function* () {
    try {
      const response = yield fetch(url);
      if (!response.ok) return [];
      const data = yield response.json();
      if (!Array.isArray(data?.streams)) return [];
      const validItems = data.streams.filter((item) => typeof item?.url === "string" && item.url.startsWith("https"));
      const streams = yield Promise.all(validItems.map(buildStream));
      return streams.filter(Boolean);
    } catch { return []; }
  });
}

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const isSeries = mediaType === "tv" || season != null || episode != null;
    const s = season ?? 1;
    const e = episode ?? 1;
    const languages = ["hi", "en"]; // Languages to fetch
    let allStreams = [];

    try {
      const imdbId = yield getImdbId(tmdbId, isSeries ? "tv" : "movie");
      if (!imdbId) return [];

      for (const lang of languages) {
        let urls = [];
        if (!isSeries) {
          urls = [`${PYNVIX_BASE}/source=v2|lang=${lang}|res=all/stream/movie/${imdbId}.json`];
        } else {
          urls = [
            `${PYNVIX_BASE}/source=all|lang=${lang}|res=1080p/stream/series/${imdbId}:${pad2(s)}:${pad2(e)}.json`,
            `${PYNVIX_BASE}/source=all|lang=${lang}|res=1080p/stream/series/${imdbId}:${parseInt(s, 10) || 1}:${parseInt(e, 10) || 1}.json`
          ];
        }
        // Fetch and append all found streams for this language
        for (const url of urls) {
          const streams = yield fetchStreams(url);
          allStreams = allStreams.concat(streams);
        }
      }
      return allStreams;
    } catch { return []; }
  });
}

module.exports = { getStreams };
