// movies4u.js
// Nuvio-compatible Movies4u provider (Streams + Bypassed Cloud Downloads)

const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const FALLBACK_URL = "https://new1.movies4u.finance";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
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
  return "Unknown";
}

// Multi-step decoder for the m4ulinks -> gamerxyt -> hubcloud chain
async function resolveCloudStream(shortenerUrl) {
  try {
    // Step 1: Follow m4ulinks shortener
    const res1 = await fetch(shortenerUrl, { headers: HEADERS, redirect: "follow", skipSizeCheck: true });
    let html1 = await res1.text();
    
    // Extract target gateway domain (e.g., gamerxyt.com/bgmi/)
    let gatewayUrl = html1.match(/window\.location\.replace\(['"](.*?)['"]\)/)?.[1] || 
                     html1.match(/meta\s+http-equiv=["']refresh["']\s+content=["']\d+;\s*url=(.*?)["']/i)?.[1];
                     
    if (!gatewayUrl && res1.url && !res1.url.includes("m4ulinks")) {
      gatewayUrl = res1.url;
    }
    if (!gatewayUrl) return null;

    // Step 2: Query the gateway page to fetch generated session tokens
    const res2 = await fetch(gatewayUrl, { 
      headers: { ...HEADERS, Referer: shortenerUrl }, 
      skipSizeCheck: true 
    });
    const html2 = await res2.text();
    
    // Look for the hubcloud query string parameters hidden inside the page script layout
    const idMatch = html2.match(/id\s*=\s*["']([^"']+)["']/)?.[1] || html2.match(/[\?&]id=([^&"'\s>]+)/)?.[1];
    const tokenMatch = html2.match(/token\s*=\s*["']([^"']+)["']/)?.[1] || html2.match(/[\?&]token=([^&"'\s>]+)/)?.[1];
    
    if (!idMatch || !tokenMatch) {
      // Alternate fallback regex to scan entire anchors
      const anchorMatch = html2.match(/href=["']([^"']+(?:hubcloud|hub\.homelander)[^"']+)["']/i)?.[1];
      if (anchorMatch) return anchorMatch;
      return null;
    }

    // Step 3: Call internal API layout to receive the direct download landing spot
    const targetGatewayHost = gatewayUrl.match(/https?:\/\/[^\/]+/)[0];
    const hubcloudApiUrl = `${targetGatewayHost}/bgmi/hubcloud.php?host=hubcloud&id=${idMatch}&token=${tokenMatch}`;

    const res3 = await fetch(hubcloudApiUrl, {
      headers: { ...HEADERS, Referer: gatewayUrl },
      skipSizeCheck: true
    });
    const html3 = await res3.text();
    
    // Extract absolute final file link pointing toward direct streaming networks
    const finalStreamUrl = html3.match(/href=['"](https?:\/\/hub\.homelander\.buzz\/[^'"]+)['"]/i)?.[1] ||
                           html3.match(/href=['"](https?:\/\/[^\s"'<>]+?\/download\?[^'"]+)['"]/i)?.[1] ||
                           html3.match(/window\.location\.replace\(['"](.*?)['"]\)/)?.[1];
                           
    return finalStreamUrl || null;
  } catch (e) {
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

    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

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

    const movieResp = await fetch(match.href, { headers: HEADERS, skipSizeCheck: true });
    const movieHtml = await movieResp.text();
    const $movie = cheerio.load(movieHtml);

    // ==========================================
    // STRATEGY A: Standard Native Streaming Links
    // ==========================================
    const watchLinks = [];
    $movie("a.btn.btn-zip").each((i, el) => {
      const href = $movie(el).attr("href");
      if (href && (href.includes("m4uplay") || href.includes("m4ufree"))) {
        watchLinks.push(href);
      }
    });

    for (const watchLink of watchLinks.slice(0, 1)) {
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
            name: "Movies4u",
            title: "Direct Mirror [Fast]",
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
      } catch (_) {}
    }

    // ==========================================
    // STRATEGY B: Tokenized Cloud Download Targets
    // ==========================================
    const rawDownloadButtons = [];
    $movie("div.downloads-btns-div a[href], div.download-links-div a[href]").each((i, el) => {
      const href = $movie(el).attr("href");
      const text = $movie(el).text();
      if (href && href.includes("m4ulinks.com")) {
        rawDownloadButtons.push({ href, text });
      }
    });

    const processedUrls = new Set();

    for (const btn of rawDownloadButtons.slice(0, 4)) {
      try {
        const directPlayableUrl = await resolveCloudStream(btn.href);
        
        if (directPlayableUrl && !processedUrls.has(directPlayableUrl)) {
          processedUrls.add(directPlayableUrl);
          const quality = extractQuality(btn.text + " " + directPlayableUrl);
          
          let engineName = "HubCloud Source";
          if (directPlayableUrl.includes("gdflix")) engineName = "GDFlix Source";

          streams.push({
            name: `Movies4u (${engineName})`,
            title: `Cloud Stream (${quality})`,
            quality: quality,
            url: directPlayableUrl,
            headers: {
              "User-Agent": HEADERS["User-Agent"],
              Referer: "https://gamerxyt.com/"
            },
            subtitles: []
          });
        }
      } catch (_) {}
    }

    return streams;
  } catch (e) {
    return [];
  }
}

module.exports = {
  getStreams
};
