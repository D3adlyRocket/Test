// movies4u.js
// Nuvio-compatible Movies4u provider (Unified Streams + Decoded GDFlix & HubCloud Players)

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

// Bypasses the intermediate m4ulinks shortener layer
async function resolveShortener(url) {
  try {
    const resp = await fetch(url, { headers: HEADERS, redirect: "follow", skipSizeCheck: true });
    if (resp.url && !resp.url.includes("m4ulinks")) return resp.url;
    const html = await resp.text();
    const destination = html.match(/window\.location\.replace\(['"](.*?)['"]\)/)?.[1] || 
                        html.match(/href=['"](https?:\/\/[^'"]+)['"]/i)?.[1];
    return destination || url;
  } catch (_) {
    return url;
  }
}

// Deep Decoder: Extracts direct video streaming URLs from HubCloud mirrors
async function decodeHubCloud(url) {
  try {
    const pageResp = await fetch(url, { headers: HEADERS, skipSizeCheck: true });
    const html = await pageResp.text();
    
    // Find the intermediate download or token generation endpoint
    let nextUrl = html.match(/href=['"](https?:\/\/[^'"]+?\/download\/[^'"]+)['"]/i)?.[1];
    
    if (!nextUrl) {
      const matchKey = html.match(/[\?&]id=([^&"'<>]+)/)?.[1];
      if (matchKey) {
        const domain = url.match(/https?:\/\/[^\/]+/)[0];
        nextUrl = `${domain}/download/?id=${matchKey}`;
      }
    }
    if (!nextUrl) return null;

    // Request the download page to process standard form elements
    const dlPageResp = await fetch(nextUrl, { headers: { ...HEADERS, Referer: url }, skipSizeCheck: true });
    const dlHtml = await dlPageResp.text();
    const $h = cheerio.load(dlHtml);

    // Look for direct download elements or cloud drive references
    let directLink = $h("a.btn-success, a.btn-danger, a[href*='api/download']").first().attr("href");
    
    if (!directLink) {
      directLink = dlHtml.match(/https?:\/\/[^\s"'<>]+?\.workers\.dev\/[^'"]+/i)?.[0] ||
                   dlHtml.match(/https?:\/\/[^\s"'<>]+?\/api\/download\?[^'"]+/i)?.[0];
    }
    
    return directLink || null;
  } catch (_) {
    return null;
  }
}

// Deep Decoder: Extracts direct video streaming URLs from GDFlix mirrors
async function decodeGDFlix(url) {
  try {
    const pageResp = await fetch(url, { headers: HEADERS, skipSizeCheck: true });
    const html = await pageResp.text();
    const $g = cheerio.load(html);

    // Extract core parameters required to bypass the redirect screen
    const form = $g("form");
    const action = form.attr("action") || url;
    
    const formData = new URLSearchParams();
    form.find("input").each((i, el) => {
      const name = $g(el).attr("name");
      const value = $g(el).attr("value") || "";
      if (name) formData.append(name, value);
    });

    const bypassResp = await fetch(action, {
      method: "POST",
      headers: { 
        ...HEADERS, 
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: url 
      },
      body: formData.toString(),
      skipSizeCheck: true
    });

    const bHtml = await bypassResp.text();
    const $b = cheerio.load(bHtml);
    
    // Grabs the immediate watch/stream or download asset
    let streamUrl = $b("a.btn-primary, a[href*='drive.google.com'], a[href*='download']").first().attr("href");
    
    if (!streamUrl) {
      streamUrl = bHtml.match(/https?:\/\/[^\s"'<>]+?\(stream\)[^'"]+/i)?.[0];
    }

    return streamUrl || null;
  } catch (_) {
    return null;
  }
}

function unpack(p, a, c, k) {
  while (c--) {
    if (k[c]) p = p.replace(new RegExp("\\b" + c.toString(a) + "\\b", "g"), k[c]);
  }
  return p;
}

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  try {
    const BASE_URL = await getBaseUrl();
    const streams = [];

    // Step 1: TMDB Processing
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // Step 2: Query Movies4u Site Indexer
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

    // Step 3: Parse Target Structural Page Layout
    const movieResp = await fetch(match.href, { headers: HEADERS, skipSizeCheck: true });
    const movieHtml = await movieResp.text();
    const $movie = cheerio.load(movieHtml);

    // ==========================================
    // STRATEGY A: Direct Stream Embed Extraction
    // ==========================================
    const watchLinks = [];
    $movie("a.btn.btn-zip").each((i, el) => {
      const href = $movie(el).attr("href");
      if (href && (href.includes("m4uplay") || href.includes("m4ufree") || href.includes("m4u"))) {
        watchLinks.push(href);
      }
    });

    for (const watchLink of watchLinks.slice(0, 2)) {
      try {
        const embedResp = await fetch(watchLink, {
          headers: { ...HEADERS, Referer: BASE_URL + "/" },
          skipSizeCheck: true
        });
        const embedHtml = await embedResp.text();
        let m3u8 = embedHtml.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'*]*/i)?.[0];

        if (!m3u8) {
          const packedMatch = embedHtml.match(/eval\(function\(p,a,c,k,e,d\).*?\}\('(.*)',(\d+),(\d+),'(.*)'\.split\('\|'\)/s);
          if (packedMatch) {
            const unpacked = unpack(packedMatch[1], parseInt(packedMatch[2]), parseInt(packedMatch[3]), packedMatch[4].split("|"));
            m3u8 = unpacked.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'*]*/i)?.[0];
          }
        }

        if (m3u8) {
          streams.push({
            name: "Movies4u (Stream)",
            title: "Primary Direct Web Stream",
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
    // STRATEGY B: De-shorte and Decode Cloud Mirrors
    // ==========================================
    const rawDownloadButtons = [];
    $movie("div.downloads-btns-div a[href], div.download-links-div a[href]").each((i, el) => {
      const href = $movie(el).attr("href");
      const text = $movie(el).text();
      if (href && !href.includes("zip")) {
        rawDownloadButtons.push({ href, text });
      }
    });

    const processedUrls = new Set();

    for (const btn of rawDownloadButtons.slice(0, 8)) {
      try {
        let unshortenedUrl = btn.href;
        
        if (unshortenedUrl.includes("m4ulinks.com")) {
          unshortenedUrl = await resolveShortener(unshortenedUrl);
        }
        if (!unshortenedUrl || processedUrls.has(unshortenedUrl)) continue;
        processedUrls.add(unshortenedUrl);

        let playableDirectUrl = null;
        let hostLabel = "Cloud Source";

        // Determine host and run the corresponding engine decoder
        if (unshortenedUrl.includes("hubcloud") || unshortenedUrl.includes("hubdrive")) {
          hostLabel = "HubCloud Decoded";
          playableDirectUrl = await decodeHubCloud(unshortenedUrl);
        } else if (unshortenedUrl.includes("gdflix")) {
          hostLabel = "GDFlix Decoded";
          playableDirectUrl = await decodeGDFlix(unshortenedUrl);
        }

        // Only append if the decoder found a direct link for ExoPlayer
        if (playableDirectUrl) {
          const quality = extractQuality(btn.text + " " + unshortenedUrl);
          streams.push({
            name: `Movies4u (${hostLabel})`,
            title: `Direct Media Stream (${quality})`,
            quality: quality,
            url: playableDirectUrl,
            headers: {
              "User-Agent": HEADERS["User-Agent"],
              Referer: unshortenedUrl
            },
            subtitles: []
          });
        }
      } catch (e) {}
    }

    return streams;
  } catch (e) {
    console.error("[Movies4u Fatal Parsing Error]", e);
    return [];
  }
}

module.exports = {
  getStreams
};
