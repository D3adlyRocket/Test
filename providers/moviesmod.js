// movies4u.js
// Nuvio-compatible Movies4u provider (Unified Streaming + Playable Cloud Downloads)

const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const FALLBACK_URL = "https://new1.movies4u.finance";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Referer": FALLBACK_URL,
  "Cookie": "xla=s4t"
};

let cachedBaseUrl = null;

async function getBaseUrl() {
  if (cachedBaseUrl) return cachedBaseUrl;
  try {
    const resp = await fetch(DOMAINS_URL, { skipSizeCheck: true });
    const data = await resp.json();
    cachedBaseUrl = data.movies4u || data.movies4uhd || FALLBACK_URL;
  } catch (_) {
    cachedBaseUrl = FALLBACK_URL;
  }
  return cachedBaseUrl;
}

function extractQuality(text) {
  const u = (text || "").toLowerCase();
  if (u.includes("2160") || u.includes("4k")) return "4K";
  if (u.includes("1080")) return "1080p";
  if (u.includes("720")) return "720p";
  if (u.includes("480")) return "480p";
  if (u.includes("360")) return "360p";
  return "Unknown";
}

// Bypasses the link shortener protection layer to get the raw GDFlix/HubCloud destination
async function resolveDownloadUrl(url) {
  try {
    const resp = await fetch(url, {
      headers: HEADERS,
      redirect: "follow",
      skipSizeCheck: true
    });
    
    // If the shortener bounces directly to the final host via location headers
    if (resp.url && !resp.url.includes("m4ulinks")) {
      return resp.url;
    }

    // If it renders an intermediate landing page, try parsing a deep link
    const html = await resp.text();
    const destination = html.match(/window\.location\.replace\(['"](.*?)['"]\)/)?.[1] || 
                        html.match(/href=['"](https?:\/\/(?:gdflix|hubcloud|hubdrive)[^'"]+)['"]/i)?.[1];
                        
    return destination || url;
  } catch (_) {
    return url;
  }
}

function unpack(p, a, c, k) {
  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp("\\b" + c.toString(a) + "\\b", "g"), k[c]);
    }
  }
  return p;
}

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  try {
    const BASE_URL = await getBaseUrl();
    const streams = [];

    // Step 1: TMDB Lookup
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // Step 2: Search Website
    const searchResp = await fetch(`${BASE_URL}/?s=${encodeURIComponent(title)}`, {
      headers: HEADERS,
      skipSizeCheck: true
    });
    const searchHtml = await searchResp.text();
    const $ = cheerio.load(searchHtml);
    const results = [];

    $("article").each((i, el) => {
      const a = $(el).find("h2 a, h3 a").first();
      const href = a.attr("href");
      const name = a.text().trim();
      if (href && name) results.push({ href, name });
    });

    if (!results.length) return [];
    const match = results.find(r => r.name.toLowerCase().includes(title.toLowerCase())) || results[0];
    if (!match) return [];

    // Step 3: Load Movie/Content Page
    const movieResp = await fetch(match.href, { headers: HEADERS, skipSizeCheck: true });
    const movieHtml = await movieResp.text();
    const $movie = cheerio.load(movieHtml);

    // ==========================================
    // STRATEGY A: Grab the direct Stream Embeds (Original Logic)
    // ==========================================
    const watchLinks = [];
    $movie("a.btn.btn-zip").each((i, el) => {
      const href = $movie(el).attr("href");
      if (href && (href.includes("m4uplay") || href.includes("m4ufree") || href.includes("m4u"))) {
        watchLinks.push(href);
      }
    });

    for (const watchLink of watchLinks.slice(0, 3)) {
      try {
        const embedResp = await fetch(watchLink, {
          headers: { ...HEADERS, Referer: BASE_URL + "/" },
          skipSizeCheck: true
        });
        const embedHtml = await embedResp.text();
        let m3u8 = embedHtml.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'*]*/i)?.[0] ||
                   embedHtml.match(/https?:\/\/[^\s"'<>]+master\.txt[^\s"'*]*/i)?.[0];

        if (!m3u8) {
          const rel = embedHtml.match(/\/(?:3o|stream)\/[^\s"'<>]+(?:m3u8|txt)/i)?.[0];
          if (rel) m3u8 = "https://m4uplay.store" + rel;
        }

        // Packed JS evaluation fallback
        if (!m3u8) {
          const packedMatch = embedHtml.match(/eval\(function\(p,a,c,k,e,d\).*?\}\('(.*)',(\d+),(\d+),'(.*)'\.split\('\|'\)/s);
          if (packedMatch) {
            const unpacked = unpack(packedMatch[1], parseInt(packedMatch[2]), parseInt(packedMatch[3]), packedMatch[4].split("|"));
            m3u8 = unpacked.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'*]*/i)?.[0] ||
                   unpacked.match(/https?:\/\/[^\s"'<>]+master\.txt[^\s"'*]*/i)?.[0];
            if (!m3u8) {
              const rel = unpacked.match(/\/(?:3o|stream)\/[^\s"'<>]+(?:m3u8|txt)/i)?.[0];
              if (rel) m3u8 = "https://m4uplay.store" + rel;
            }
          }
        }

        if (m3u8) {
          if (m3u8.includes("master.txt")) m3u8 = m3u8.replace("master.txt", "master.m3u8");
          streams.push({
            name: "Movies4u (Stream)",
            title: "Movies4u Primary Stream",
            quality: extractQuality(watchLink + " " + m3u8),
            url: m3u8,
            headers: {
              Referer: "https://m4uplay.store/",
              Origin: "https://m4uplay.store",
              "User-Agent": HEADERS["User-Agent"]
            },
            subtitles: []
          });
        }
      } catch (e) {}
    }

    // ==========================================
    // STRATEGY B: Grab & Un-shorten Cloud Download Links
    // ==========================================
    const rawDownloadButtons = [];
    $movie("div.downloads-btns-div a[href], div.download-links-div a[href]").each((i, el) => {
      const href = $movie(el).attr("href");
      const text = $movie(el).text();
      if (href && !href.includes("zip")) {
        rawDownloadButtons.push({ href, text });
      }
    });

    // Use a Set to make sure we don't return duplicated final destinations
    const processedUrls = new Set();

    for (const btn of rawDownloadButtons.slice(0, 6)) {
      try {
        let finalUrl = btn.href;
        
        // If protected by the shortener domain, unlock it
        if (finalUrl.includes("m4ulinks.com")) {
          finalUrl = await resolveDownloadUrl(finalUrl);
        }

        // Drop if it failed to unpack or is a duplicate
        if (!finalUrl || processedUrls.has(finalUrl) || finalUrl.includes("m4ulinks.com")) {
          continue;
        }
        processedUrls.add(finalUrl);

        const quality = extractQuality(btn.text + " " + finalUrl);
        let hostName = "Cloud Link";
        if (finalUrl.includes("gdflix")) hostName = "GDFlix";
        if (finalUrl.includes("hubcloud")) hostName = "HubCloud";

        streams.push({
          name: `Movies4u (${hostName})`,
          title: `Download Server Mirror (${quality})`,
          quality: quality,
          url: finalUrl,
          headers: {
            ...HEADERS,
            Referer: match.href
          },
          subtitles: []
        });
      } catch (e) {}
    }

    return streams;
  } catch (e) {
    console.error("[Movies4u Engine Error]", e);
    return [];
  }
}

module.exports = {
  getStreams
};
