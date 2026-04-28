"use strict";

const cheerio = require("cheerio-without-node-native");

// --- Constants & Config ---
const TMDB_API_KEY = "500330721680edb6d5f7f12ba7cd9023";
const USER_AGENT = "Mozilla/5.0 (Linux; Android 10; BRAVIA 4K VH2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const KNOWN_DOMAINS = [
  "https://dizipal2063.com",
  "https://dizipal2064.com",
  "https://dizipal2062.com"
];

let _activeDomain = null;

// --- Helper Functions ---
async function getActiveDomain() {
  if (_activeDomain) return _activeDomain;
  for (const domain of KNOWN_DOMAINS) {
    try {
      const res = await fetch(domain, { method: "HEAD", signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        _activeDomain = domain;
        return domain;
      }
    } catch (e) { /* continue */ }
  }
  return KNOWN_DOMAINS[0];
}

async function getTmdbMetadata(tmdbId, type) {
  const endpoint = type === "movie" ? "movie" : "tv";
  const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=tr-TR`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return {
      title: data.title || data.name,
      year: parseInt((data.release_date || data.first_air_date || "0").split("-")[0])
    };
  } catch (e) { return null; }
}

// --- Extraction Logic ---
async function extractSource(embedUrl) {
  try {
    const res = await fetch(embedUrl, { headers: { "User-Agent": USER_AGENT, "Referer": embedUrl } });
    const html = await res.text();
    
    // Look for m3u8 or mp4 patterns standard in Dizipal sources
    const streamMatch = html.match(/["']([^"']*\.(?:m3u8|mp4)[^"']*)["']/i);
    if (streamMatch) {
      return {
        url: streamMatch[1],
        headers: { "Referer": embedUrl, "User-Agent": USER_AGENT }
      };
    }
  } catch (e) { return null; }
  return null;
}

// --- Main getStreams Function ---
async function getStreams(tmdbId, type, season, episode) {
  try {
    const meta = await getTmdbMetadata(tmdbId, type);
    if (!meta) return [];

    const domain = await getActiveDomain();
    const searchUrl = `${domain}/ajax-search?q=${encodeURIComponent(meta.title)}`;
    
    const searchRes = await fetch(searchUrl, {
      headers: { "X-Requested-With": "XMLHttpRequest", "Referer": domain, "User-Agent": USER_AGENT }
    });
    const searchData = await searchRes.json();

    if (!searchData.success || !searchData.results.length) return [];

    // Filter results by type and year
    const match = searchData.results.find(r => {
      const typeMatch = type === "movie" ? r.type === "Film" : r.type === "Dizi";
      return typeMatch && Math.abs(r.year - meta.year) <= 1;
    });

    if (!match) return [];

    let targetUrl = match.url.startsWith("http") ? match.url : `${domain}${match.url}`;

    // Handle TV Series Episode Selection
    if (type === "tv" || type === "series") {
      const pageHtml = await (await fetch(targetUrl)).text();
      const $ = cheerio.load(pageHtml);
      // Logic to find the specific S/E link
      const epPattern = new RegExp(`${season}.*Sezon.*${episode}.*Bölüm`, "i");
      let epLink = null;
      
      $("a").each((_, el) => {
        if (epPattern.test($(el).text())) {
          epLink = $(el).attr("href");
        }
      });
      
      if (!epLink) return [];
      targetUrl = epLink.startsWith("http") ? epLink : `${domain}${epLink}`;
    }

    // Resolve Player Config to get the Embed
    const contentHtml = await (await fetch(targetUrl)).text();
    const cfgMatch = contentHtml.match(/data-cfg="([^"]+)"/);
    
    if (cfgMatch) {
      const playerRes = await fetch(`${domain}/ajax-player-config`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest" },
        body: `cfg=${encodeURIComponent(cfgMatch[1])}`
      });
      const playerData = await playerRes.json();
      const embedUrl = playerData.url || (playerData.config && playerData.config.v);

      if (embedUrl) {
        const finalStream = await extractSource(embedUrl);
        if (finalStream) {
          return [{
            name: "Dizipal TV",
            title: `${meta.title} - ${type === 'tv' ? `S${season}E${episode}` : meta.year}`,
            url: finalStream.url,
            headers: finalStream.headers,
            behaviorHints: { proxyHeaders: { "common": finalStream.headers } }
          }];
        }
      }
    }
  } catch (err) {
    console.log(`[DizipalTV] Error: ${err.message}`);
  }
  return [];
}

module.exports = { getStreams };
