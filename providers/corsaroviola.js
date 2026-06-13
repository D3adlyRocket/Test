const cheerio = require('cheerio-without-node-native');
// multimovies.js
// MultiMovies - Clean Stream Extraction & Iframe Target Hub

const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const FALLBACK_URL = "https://multimovies.homes";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

let cachedBaseUrl = null;

async function getBaseUrl() {
  if (cachedBaseUrl) return cachedBaseUrl;
  try {
    const resp = await fetch(DOMAINS_URL);
    const data = await resp.json();
    cachedBaseUrl = data.MultiMovies || FALLBACK_URL;
  } catch(e) {
    cachedBaseUrl = FALLBACK_URL;
  }
  return cachedBaseUrl;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    const BASE_URL = await getBaseUrl();

    // Step 1: TMDB Lookup
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // Step 2: MultiMovies Search Index
    const searchResp = await fetch(`${BASE_URL}/?s=${encodeURIComponent(title)}`, {
      headers: HEADERS
    });
    const searchHtml = await searchResp.text();
    const $ = cheerio.load(searchHtml);

    const results = [];
    $("div.result-item").each((i, el) => {
      const a = $(el).find("article > div.details > div.title > a");
      const href = a.attr("href");
      const name = a.text().trim();
      if (href && name) results.push({ href, name });
    });

    if (results.length === 0) return [];

    const isMovie = mediaType === "movie";
    const match = results.find(r =>
      r.name.toLowerCase().includes(title.toLowerCase())
    ) || results[0];

    // Step 3: Load Target Metadata Content
    const pageResp = await fetch(match.href, { headers: HEADERS });
    const pageHtml = await pageResp.text();
    const $p = cheerio.load(pageHtml);

    const streams = [];

    if (!isMovie && mediaType === "tv") {
      const episodes = [];
      $p("#seasons ul.episodios li").each((seasonIdx, sEl) => {
        $p(sEl).find("li").each((epIdx, epEl) => {
          const href = $p(epEl).find("div.episodiotitle > a").attr("href");
          if (href) {
            episodes.push({
              href,
              season: seasonIdx + 1,
              episode: epIdx + 1
            });
          }
        });
      });

      if (episodes.length === 0) {
        let seasonNum = 1;
        $p("#seasons ul.episodios").each((sIdx, sList) => {
          seasonNum = sIdx + 1;
          $p(sList).find("li").each((eIdx, epEl) => {
            const href = $p(epEl).find("div.episodiotitle > a").attr("href");
            if (href) {
              episodes.push({ href, season: seasonNum, episode: eIdx + 1 });
            }
          });
        });
      }

      const targetEp = episodes.find(ep =>
        ep.season === parseInt(season || 1) && ep.episode === parseInt(episode || 1)
      ) || episodes[0];

      if (!targetEp) return [];

      const epResp = await fetch(targetEp.href, { headers: HEADERS });
      const epHtml = await epResp.text();
      const $ep = cheerio.load(epHtml);

      const epItems = [];
      $ep("ul#playeroptionsul li").each((i, el) => {
        epItems.push({
          post: $ep(el).attr("data-post"),
          nume: $ep(el).attr("data-nume"),
          type: $ep(el).attr("data-type"),
          title: $ep(el).find("span.title").text().trim()
        });
      });

      for (const item of epItems.slice(0, 5)) {
        if (!item.post || !item.nume || item.title.toLowerCase().includes("trailer")) continue;
        const embedUrl = await fetchEmbedUrl(BASE_URL, item.post, item.nume, item.type);
        if (embedUrl) {
          const streamObj = await resolveEmbed(embedUrl, item.title, BASE_URL);
          if (streamObj) streams.push(streamObj);
        }
      }

      return streams;
    }

    // Movie Content Pipeline
    const playerItems = [];
    $p("ul#playeroptionsul li").each((i, el) => {
      playerItems.push({
        post: $p(el).attr("data-post"),
        nume: $p(el).attr("data-nume"),
        type: $p(el).attr("data-type"),
        title: $p(el).find("span.title").text().trim()
      });
    });

    for (const item of playerItems.slice(0, 5)) {
      if (!item.post || !item.nume || item.title.toLowerCase().includes("trailer")) continue;
      const embedUrl = await fetchEmbedUrl(BASE_URL, item.post, item.nume, item.type);
      if (embedUrl) {
        const streamObj = await resolveEmbed(embedUrl, item.title, BASE_URL);
        if (streamObj) streams.push(streamObj);
      }
    }

    return streams;
  } catch (e) {
    console.error("[MultiMovies Core Error]", e);
    return [];
  }
}

async function fetchEmbedUrl(baseUrl, post, nume, type) {
  try {
    const resp = await fetch(`${baseUrl}/wp-admin/admin-ajax.php`, {
      method: "POST",
      headers: {
        ...HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": baseUrl
      },
      body: `action=doo_player_ajax&post=${post}&nume=${nume}&type=${type}`
    });
    const data = await resp.json();
    const embedUrl = data.embed_url || "";

    const srcMatch = embedUrl.match(/src="([^"]+)"/i) || embedUrl.match(/SRC="([^"]+)"/i);
    if (srcMatch) return srcMatch[1].trim();

    const urlMatch = embedUrl.match(/"(https?[^"]+)"/);
    if (urlMatch) return urlMatch[1].trim();

    return embedUrl.replace(/^"|"$/g, "").trim();
  } catch(e) {
    return null;
  }
}

async function resolveEmbed(embedUrl, sourceTitle, referer) {
  if (!embedUrl || !embedUrl.startsWith("http")) return null;

  try {
    // If the Ajax endpoint returned a direct media stream directly, capture it
    if (embedUrl.includes(".m3u8") || embedUrl.includes("sprintcdn.com") || embedUrl.includes("smoothpre.com/stream/")) {
      // Ensure we only pass it if it contains the real hashed media structure
      if (!embedUrl.match(/\/stream\/tt\d+/i)) {
        return {
          url: embedUrl,
          quality: "1080p",
          title: sourceTitle || "MultiMovies Direct Stream",
          subtitles: []
        };
      }
    }

    // Inspect underlying response body
    const resp = await fetch(embedUrl, { headers: { ...HEADERS, "Referer": referer } });
    const text = await resp.text();

    const streamPatterns = [
      /(https?:\/\/smoothpre\.com\/stream\/[^tt][^\s"']+)/i,
      /(https?:\/\/multimovieshg\.com\/stream\/[^tt][^\s"']+)/i,
      /(https?:\/\/[^\s"']+\.sprintcdn\.[^\s"']+\/[^\s"']+\.m3u8[^\s"']*)/i,
      /(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/i
    ];

    for (const regex of streamPatterns) {
      const match = text.match(regex);
      if (match) {
        return {
          url: match[1],
          quality: "1080p",
          title: sourceTitle || "MultiMovies Manifest",
          subtitles: []
        };
      }
    }

    // Clean Parameter Fallback: Output the authenticated iframe player targets 
    // contextually containing their security hashes (?key=...) so the frontend engine handles runtime player loads.
    return {
      url: embedUrl,
      quality: "Auto",
      title: `${sourceTitle || "Server Player"} Source`,
      subtitles: []
    };
  } catch(e) {
    return {
      url: embedUrl,
      quality: "Auto",
      title: sourceTitle || "Alternative Player",
      subtitles: []
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
}
