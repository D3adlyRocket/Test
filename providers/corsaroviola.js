const cheerio = require('cheerio-without-node-native');
// multimovies.js
// MultiMovies - Optimized Stream & Provider Asset Hub

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

    // Step 1: Fetch metadata title from TMDB
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // Step 2: Search MultiMovies Database
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

    // Step 3: Parse Target Content Document Layout
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
          type: $ep(el).attr("data-type")
        });
      });

      for (const item of epItems.slice(0, 5)) {
        if (!item.post || !item.nume || (item.nume || "").includes("trailer")) continue;
        const embedUrl = await fetchEmbedUrl(BASE_URL, item.post, item.nume, item.type, match.href);
        if (embedUrl && !embedUrl.includes("youtube")) {
          const resolvedStream = await resolveEmbed(embedUrl, BASE_URL);
          if (resolvedStream) {
            streams.push(resolvedStream);
          }
        }
      }

      return streams;
    }

    // Movie Strategy Matrix
    const playerItems = [];
    $p("ul#playeroptionsul li").each((i, el) => {
      playerItems.push({
        post: $p(el).attr("data-post"),
        nume: $p(el).attr("data-nume"),
        type: $p(el).attr("data-type")
      });
    });

    for (const item of playerItems.slice(0, 5)) {
      if (!item.post || !item.nume || (item.nume || "").includes("trailer")) continue;
      const embedUrl = await fetchEmbedUrl(BASE_URL, item.post, item.nume, item.type, match.href);
      if (embedUrl && !embedUrl.includes("youtube")) {
        const resolvedStream = await resolveEmbed(embedUrl, BASE_URL);
        if (resolvedStream) {
          streams.push(resolvedStream);
        }
      }
    }

    return streams;
  } catch (e) {
    console.error("[MultiMovies Engine Failure]", e);
    return [];
  }
}

async function fetchEmbedUrl(baseUrl, post, nume, type, referer) {
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

async function resolveEmbed(url, referer) {
  if (!url || !url.startsWith("http")) return null;

  try {
    // If input is already explicitly an HLS manifest, map it forward immediately
    if (url.includes("multimovieshg.com") || url.includes("smoothpre.com") || url.includes("sprintcdn.com") || url.includes(".m3u8")) {
      return {
        url: url,
        quality: extractQuality(url),
        title: "MultiMovies Native Stream",
        subtitles: []
      };
    }

    const resp = await fetch(url, { headers: { ...HEADERS, "Referer": referer } });
    const text = await resp.text();

    const patterns = [
      {
        title: "MultiMovies Native",
        regex: /(https?:\/\/multimovieshg\.com\/stream\/[^\s"']+)/i
      },
      {
        title: "SmoothPre Mirror",
        regex: /(https?:\/\/smoothpre\.com\/stream\/[^\s"']+)/i
      },
      {
        title: "SprintCDN Edge",
        regex: /(https?:\/\/[^\s"']+\.sprintcdn\.[^\s"']+\/master\.m3u8[^\s"']*)/i
      },
      {
        title: "Obfuscated Master",
        regex: /(https?:\/\/[^\s"']+\/cf-master\.[^\s"']+\.txt)/i
      },
      {
        title: "Global Fallback",
        regex: /(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/i
      }
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        return {
          url: match[1],
          quality: extractQuality(match[1]),
          title: pattern.title,
          subtitles: []
        };
      }
    }

    // Direct Handler Mapping: Delivers the fully functional player link context (including hashes)
    // for assets that rely on client-side JS runtime decryption engines
    if (url.includes("vidzee.wtf") || url.includes("iqsmartgames.com") || url.includes("vixsrc.to") || url.includes("ironbrookbuilders.cyou")) {
      let label = "Premium Stream Cluster";
      if (url.includes("vidzee.wtf")) label = "VidZee Player Stream";
      if (url.includes("vixsrc.to")) label = "VixSrc Server Stream";
      if (url.includes("iqsmartgames.com")) label = "IQSmart Media Hub";

      return {
        url: url,
        quality: "Auto Quality",
        title: label,
        subtitles: []
      };
    }

    // Secondary fallback validation
    if (url.includes(".m3u8") || url.includes(".mp4")) {
      return {
        url: url,
        quality: extractQuality(url),
        title: "Direct Stream Gateway",
        subtitles: []
      };
    }

    return null;
  } catch(e) {
    // Graceful recovery block
    if (url.includes("http")) {
      return {
        url: url,
        quality: "1080p",
        title: "MultiMovies Alternative Route",
        subtitles: []
      };
    }
    return null;
  }
}

function extractQuality(url) {
  const u = (url || "").toLowerCase();
  if (u.includes("2160p") || u.includes("4k")) return "4K";
  if (u.includes("1080p") || u.includes("index-f1") || u.includes("master.m3u8")) return "1080p";
  if (u.includes("720p") || u.includes("index-f2")) return "720p";
  if (u.includes("480p")) return "480p";
  if (u.includes("360p")) return "360p";
  return "Auto";
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
}
