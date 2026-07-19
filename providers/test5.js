"use strict";

const ECLIPSIA_API = "https://addon-osvh.onrender.com";
const ECLIPSIA_BACKUP_API = "https://addon.notorrent2.workers.dev";
const TMDB_API_KEY = "307b7b8ef035c6aa336900aef4e203bd";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
};

const pad2 = (n) => String(Number.parseInt(n ?? 0, 10) || 0).padStart(2, "0");

const cleanText = (str) =>
  String(str ?? "")
    .trim();

const extractQuality = (titleText) => {
  const match = String(titleText ?? "").match(/(\d{3,4}p)/i);
  return match?.[0] ?? "Unknown";
};

const extractLanguage = (cleanedTitle) => {
  const lower = String(cleanedTitle ?? "").toLowerCase();

  if (lower.includes("multi")) return "Multi";
  if (lower.includes("original")) return "Original";
  if (lower.includes("latino")) return "Latino";
  if (lower.includes("castellano")) return "Castellano";
  if (lower.includes("português") || lower.includes("portugues")) return "Português";
  if (lower.includes("türkçe") || lower.includes("turkce")) return "Türkçe";

  return "Default";
};

const isProxyUrl = (url) =>
  String(url ?? "").includes("workers.dev") ||
  /[?&](?:url|u)=/.test(String(url ?? "")) ||
  /\/redirect\?p=/.test(String(url ?? ""));

async function getImdbId(tmdbId, mediaType) {
  const type = mediaType === "tv" ? "tv" : "movie";
  const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return data?.external_ids?.imdb_id ?? null;
  } catch {
    return null;
  }
}

async function buildStream(item) {
  if (!item?.url || item.externalUrl) return null;
  if (String(item.url).includes("github.com")) return null;

  const cleanedTitle = cleanText(item.title);
  const language = extractLanguage(cleanedTitle);
  const isMulti = language === "Multi";
  const quality = isMulti ? "1080p/4K" : extractQuality(cleanedTitle);

  const headers = {
    ...(item.behaviorHints?.proxyHeaders?.request ?? {}),
    ...(item.behaviorHints?.headers ?? {}),
  };

  // Pass URL directly — let the player handle redirects
  const streamUrl = item.url;

  if (!streamUrl) return null;

  const nameParts = ["Eclipsia."];
  if (language !== "Default") nameParts.push(language);

  return {
    name: nameParts.join(" • "),
    title: quality,
    url: streamUrl,
    quality,
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
    provider: "Eclipsia.",
  };
}

async function parseStreams(data) {
  if (!Array.isArray(data?.streams) || data.streams.length === 0) return [];

  const validItems = data.streams.filter((item) => {
    // Skip external/promo entries
    if (item?.externalUrl) return false;

    const cleanedTitle = cleanText(item.title);
    const titleLower = cleanedTitle.toLowerCase();

    // Accept any language stream (not just multi/original)
    if (!titleLower.includes("1080")) return false;
    if (typeof item?.url !== "string" || !item.url.startsWith("https")) return false;

    const innerParamMatch = item.url.match(/[?&](?:u|url)=(https?:\/\/[^&]+)/i);
    return !innerParamMatch || innerParamMatch[1].startsWith("https");
  });

  // Sort: Original first, then Multi, then other languages
  validItems.sort((a, b) => {
    const aTitle = cleanText(a.title).toLowerCase();
    const bTitle = cleanText(b.title).toLowerCase();

    const priority = (title) => {
      if (title.includes("original")) return 0;
      if (title.includes("multi")) return 1;
      return 2;
    };
    return priority(aTitle) - priority(bTitle);
  });

  const streams = await Promise.all(validItems.map(buildStream));
  return streams.filter(Boolean);
}

async function fetchStreams(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();

    const streams = await parseStreams(data);

    if (
      streams.length === 0 &&
      Array.isArray(data?.streams) &&
      data.streams.some((s) => s?.externalUrl)
    ) {
      const freeTrialUrl = url.replace(ECLIPSIA_API, ECLIPSIA_BACKUP_API);
      if (freeTrialUrl !== url) {
        const trialResponse = await fetch(freeTrialUrl);
        if (trialResponse.ok) {
          const trialData = await trialResponse.json();
          return await parseStreams(trialData);
        }
      }
    }

    return streams;
  } catch {
    return [];
  }
}

async function fetchFirstValid(urls) {
  for (const url of urls) {
    const streams = await fetchStreams(url);
    if (streams.length > 0) return streams;
  }
  return [];
}

async function getStreams(tmdbId, mediaType, season, episode) {
  const isSeries = mediaType === "tv" || season != null || episode != null;
  const s = season ?? 1;
  const e = episode ?? 1;

  try {
    const imdbId = await getImdbId(tmdbId, isSeries ? "tv" : "movie");
    if (!imdbId) return [];

    if (!isSeries) {
      return await fetchStreams(`${ECLIPSIA_API}/stream/movie/${imdbId}.json`);
    }

    return await fetchFirstValid([
      `${ECLIPSIA_API}/stream/series/${imdbId}:${pad2(s)}:${pad2(e)}.json`,
      `${ECLIPSIA_API}/stream/series/${imdbId}:${parseInt(s, 10) || 1}:${parseInt(e, 10) || 1}.json`,
    ]);
  } catch {
    return [];
  }
}

module.exports = { getStreams };
