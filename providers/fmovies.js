/**
 * patronDizipal - Final TV Optimized
 * Merged with UHDMovies Template Logic
 */

var TV_UA = "Mozilla/5.0 (Linux; Android 10; BRAVIA 4K VH2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

var patronDizipal_exports = {};
var __export = (target, all) => {
  for (var name in all)
    Object.defineProperty(target, name, { get: all[name], enumerable: true });
};

// --- CORE LOGIC ---

async function resolveMainUrl() {
  const domains = ["https://dizipal2064.com", "https://dizipal2063.com", "https://dizipal2062.com"];
  for (const domain of domains) {
    try {
      const res = await fetch(domain, { 
        method: 'HEAD', 
        headers: { "User-Agent": TV_UA },
        signal: AbortSignal.timeout(5000) 
      });
      if (res.ok) return domain;
    } catch (e) {}
  }
  return domains[0];
}

async function fetchTV(url, opts = {}) {
  const headers = Object.assign({
    "User-Agent": TV_UA,
    "Referer": "https://google.com",
    "X-Requested-With": "XMLHttpRequest"
  }, opts.headers || {});

  return await fetch(url, Object.assign({}, opts, {
    headers,
    signal: AbortSignal.timeout(15000),
    mode: 'cors'
  }));
}

// --- EXTRACTOR ---

async function extractStream(url, activeUrl) {
  try {
    const res = await fetchTV(url);
    const html = await res.text();
    
    // Check for Dizipal's Player Config Token
    const cfg = html.match(/data-cfg="([^"]+)"/);
    if (cfg) {
      const ajaxRes = await fetchTV(`${activeUrl}/ajax-player-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `cfg=${encodeURIComponent(cfg[1])}`
      });
      const json = await ajaxRes.json();
      const finalUrl = json?.config?.v || json?.url;
      if (finalUrl) return finalUrl.replace(/\\\//g, "/");
    }
    
    // Regex fallback for direct m3u8
    const direct = html.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);
    return direct ? direct[1] : null;
  } catch (e) {
    return null;
  }
}

// --- EXPORTED FUNCTION ---

async function getStreams(tmdbId, type, season, episode) {
  try {
    const activeUrl = await resolveMainUrl();
    
    // Get Metadata via TMDB
    const tmdbRes = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=500330721680edb6d5f7f12ba7cd9023&language=tr-TR`);
    const tmdbData = await tmdbRes.json();
    const query = tmdbData.title || tmdbData.name;
    
    if (!query) return [];

    // Search Dizipal
    const searchRes = await fetchTV(`${activeUrl}/ajax-search?q=${encodeURIComponent(query)}`);
    const searchData = await searchRes.json();
    
    if (!searchData.success || !searchData.results.length) return [];

    let targetUrl = searchData.results[0].url;
    if (!targetUrl.startsWith('http')) targetUrl = activeUrl + targetUrl;

    // Episode Logic for TV Shows
    if (type === "tv") {
      const pageRes = await fetchTV(targetUrl);
      const pageHtml = await pageRes.text();
      const epPattern = new RegExp(`${season}.*sezon.*${episode}.*b\xF6l\xFCm`, "i");
      
      const parts = pageHtml.split('class="detail-episode-item');
      for (const part of parts) {
        if (epPattern.test(part)) {
          const href = part.match(/href="([^"]+)"/);
          if (href) {
            targetUrl = href[1].startsWith('http') ? href[1] : activeUrl + href[1];
            break;
          }
        }
      }
    }

    const videoUrl = await extractStream(targetUrl, activeUrl);
    
    if (videoUrl) {
      return [{
        name: "Dizipal TV",
        url: videoUrl,
        quality: "Auto",
        headers: {
          "User-Agent": TV_UA,
          "Referer": targetUrl,
          "Origin": activeUrl
        }
      }];
    }
  } catch (err) {
    console.error("Dizipal TV Error:", err);
  }
  return [];
}

__export(patronDizipal_exports, { getStreams: () => getStreams });
module.exports = patronDizipal_exports;
