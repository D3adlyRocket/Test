"use strict";

const cheerio = require("cheerio-without-node-native");
const fetch = require("node-fetch");

// 1. Settings Layout configuration for Audio Preferences (Targeted for Nuvio)
async function onSettings() {
    return [
        { type: "header", label: "Audio Preferences" },
        { type: "toggle", key: "langEnglish", label: "Enable English 🇺🇸", defaultValue: true },
        { type: "toggle", key: "langLatino", label: "Enable Latino 🇲🇽", defaultValue: true }
    ];
}

const PROVIDER_NAME = "Nuvio Scraper";
const BASE_URL = "https://new.pikahd.co"; // Replace with your target scraping domain
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

async function fetchHtml(url) {
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    return cheerio.load(await res.text());
  } catch (e) {
    console.error("Fetch error:", e.message);
    return null;
  }
}

async function searchByTitle(query) {
  const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
  const $ = await fetchHtml(url);
  if (!$) return [];
  
  const results = [];
  $("article, .post, .entry").each((_, el) => {
    const title = $(el).find("h1, h2, h3, .entry-title").first().text().trim();
    let link = $(el).find("a").first().attr("href");
    if (title && link) {
      if (!link.startsWith("http")) link = BASE_URL + link;
      results.push({ title: title.replace(/Download|Watch/gi, "").trim(), link });
    }
  });
  return results;
}

async function extractLinks(pageUrl) {
  const $ = await fetchHtml(pageUrl);
  if (!$) return [];
  const streams = [];
  
  $('a[href*="drive"], a[href*=".mp4"], a[href*="cloud"], a[href*="gdrive"]').each((_, el) => {
    let href = $(el).attr("href");
    if (href) {
      if (!href.startsWith("http")) href = BASE_URL + href;
      streams.push({
        title: $(el).text().trim() || "Stream Link",
        url: href
      });
    }
  });
  return streams;
}

// 2. The standardized entry point the Nuvio runtime executes
async function getStreams(tmdbId, mediaType, season, episode) {
  const isSeries = mediaType === 'tv' || mediaType === 'series';
  const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`;

  try {
    const settings = globalThis.SCRAPER_SETTINGS || {};
    const showEnglish = settings.langEnglish !== false;
    const showLatino = settings.langLatino !== false;

    // A. Resolve Meta (Get the actual search title from TMDB ID)
    const meta = await fetch(tmdbUrl).then(r => r.json()).catch(() => null);
    if (!meta) return [];

    const titleName = meta?.title || meta?.name || "";
    if (!titleName) return [];

    // B. Query the target site
    const searchResults = await searchByTitle(titleName);
    let rawStreams = [];

    // C. Extract links from the top search matches
    for (const result of searchResults.slice(0, 3)) {
      const links = await extractLinks(result.link);
      rawStreams = rawStreams.concat(links);
    }

    const result = [];

    // D. Filter languages and map streams to Nuvio's expected layout format
    rawStreams.forEach(s => {
      const titleText = s.title.toLowerCase();
      let detectedLang = "English 🇺🇸";
      let isLatinoStream = false;

      if (/latino|lat|spanish|esp|dual/.test(titleText)) {
        detectedLang = "Latino 🇲🇽";
        isLatinoStream = true;
      }

      if (isLatinoStream && !showLatino) return;
      if (!isLatinoStream && !showEnglish) return;

      const res = /2160|4k/.test(titleText) ? "2160p" : 
                  /1080/.test(titleText) ? "1080p" : 
                  /720/.test(titleText)  ? "720p"  : "HD";

      // Reformat the descriptive display data block to match
      const fullLayout = 
        `🎬 ${titleName}\n` +
        `💎 ${res} | 🔊 ${detectedLang}\n` +
        `🔗 Link: ${s.title}`;

      result.push({
        name: `${PROVIDER_NAME} | ${res} | ${detectedLang}`,
        title: fullLayout,
        size: fullLayout,
        description: fullLayout,
        url: s.url
      });
    });

    return result;
  } catch (err) {
    console.error("Global processing failure context:", err);
    return [];
  }
}

// 3. Export definitions so they register identically to PrimerLatino
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams, onSettings };
} else {
    global.getStreams = getStreams;
    global.onSettings = onSettings;
}
