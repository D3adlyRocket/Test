// PStream Scraper for Nuvio
// Source: pstream.net
// Supports: movies & TV shows
// Quality: 4K / 1080p / 720p / 480p (prefers highest)

const PSTREAM_BASE   = "https://pstream.net";
const PSTREAM_EMBED  = "https://pstream.net/e";
const FEDAPI_HOSTS   = [
  "https://fed-api-db.pstream.mov",
  "https://fedapi.xyz",
  "https://api.pstream.net",
  "https://pstream.net/api",
  "https://stream.pstream.net/api",
];

const QUALITY_RANK = { "4k": 0, "2160p": 0, "1080p": 1, "720p": 2, "480p": 3, "360p": 4, "auto": 5 };

function normalizeQuality(str) {
  if (!str) return "auto";
  const s = String(str).toLowerCase();
  if (s.includes("4k") || s.includes("2160")) return "4K";
  if (s.includes("1080")) return "1080p";
  if (s.includes("720"))  return "720p";
  if (s.includes("480"))  return "480p";
  if (s.includes("360"))  return "360p";
  return str;
}

function qualityRank(q) {
  const k = (q || "auto").toLowerCase().replace("p", "");
  return QUALITY_RANK[k] ?? QUALITY_RANK[q?.toLowerCase()] ?? 5;
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return undefined;
  const units = ["B", "KB", "MB", "GB"];
  let i = 0, val = bytes;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return `${val.toFixed(1)} ${units[i]}`;
}

const COMMON_HEADERS = {
  "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  "Accept":          "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.5",
  "Origin":          PSTREAM_BASE,
  "Referer":         `${PSTREAM_BASE}/`,
};

// Try each FedAPI endpoint until one works
async function tryFedAPI(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${path}${qs ? "?" + qs : ""}`;

  for (const host of FEDAPI_HOSTS) {
    try {
      const res = await fetch(`${host}${url}`, {
        headers: COMMON_HEADERS,
        signal:  AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && (data.sources || data.streams || data.url || Array.isArray(data))) {
        return data;
      }
    } catch {
      continue;
    }
  }
  return null;
}

// Scrape m3u8/mp4 URLs from HTML
function extractStreamsFromHtml(html) {
  const streams = [];
  const seen = new Set();

  // Match direct stream URLs
  const patterns = [
    /["'`](https?:\/\/[^"'`\s]+\.(?:m3u8|mp4)(?:\?[^"'`\s]*)?)/gi,
    /file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)/gi,
    /source\s*src\s*=\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)/gi,
    /["'](https?:\/\/[^"']*(?:stream|cdn|video|media)[^"']*\.(?:m3u8|mp4)[^"']*)/gi,
  ];

  for (const pattern of patterns) {
    for (const [, url] of html.matchAll(pattern)) {
      if (!seen.has(url)) {
        seen.add(url);
        streams.push(url);
      }
    }
  }
  return streams;
}

// Parse sources array from API response
function parseSources(data, title) {
  const streams = [];
  const rawSources = data?.sources || data?.streams || data?.links || (Array.isArray(data) ? data : []);

  for (const src of rawSources) {
    const url = src.url || src.stream || src.link || src.file || src.src;
    if (!url) continue;

    const rawQuality = src.quality || src.resolution || src.label || src.height || "";
    const quality    = normalizeQuality(String(rawQuality));
    const fileSize   = src.size || src.filesize || src.file_size || null;
    const fileName   = src.name || src.filename || src.title || `${title || "stream"} [${quality}]`;
    const subs       = src.subtitles || src.captions || [];

    streams.push({
      url,
      quality,
      title:       fileName,
      fileName,
      size:        formatBytes(fileSize),
      description: [
        quality,
        formatBytes(fileSize) ? `📦 ${formatBytes(fileSize)}` : null,
      ].filter(Boolean).join(" · "),
      subtitles: subs,
      headers: {
        "Referer": `${PSTREAM_BASE}/`,
        "Origin":  PSTREAM_BASE,
      },
    });
  }
  return streams;
}

async function scrape({ tmdbId, type, season, episode, title }) {
  const streams = [];

  // --- Strategy 1: FedAPI direct ---
  try {
    let apiPath, params;
    if (type === "movie") {
      apiPath = "/movie";
      params  = { tmdb: tmdbId };
    } else {
      apiPath = "/tv";
      params  = { tmdb: tmdbId, season, episode };
    }

    const data = await tryFedAPI(apiPath, params);
    if (data) {
      streams.push(...parseSources(data, title));

      // Handle single-url response
      if (streams.length === 0 && data.url) {
        streams.push({
          url:      data.url,
          quality:  normalizeQuality(data.quality),
          title:    title || "PStream",
          size:     formatBytes(data.size),
          headers:  { "Referer": `${PSTREAM_BASE}/` },
        });
      }
    }
  } catch { /* continue to next strategy */ }

  // --- Strategy 2: Embed page scrape ---
  if (streams.length === 0) {
    try {
      const embedUrl = type === "movie"
        ? `${PSTREAM_EMBED}/${tmdbId}`
        : `${PSTREAM_EMBED}/${tmdbId}/${season}/${episode}`;

      const res = await fetch(embedUrl, {
        headers: { ...COMMON_HEADERS, "Accept": "text/html,application/xhtml+xml" },
        signal:  AbortSignal.timeout(12000),
      });

      if (res.ok) {
        const html = await res.text();

        // Try to find JSON stream data in page scripts
        const jsonMatches = [...html.matchAll(/(?:sources|streams|files)\s*=\s*(\[.+?\])/gs)];
        for (const [, jsonStr] of jsonMatches) {
          try {
            const sources = JSON.parse(jsonStr);
            for (const src of sources) {
              const url = src.url || src.file || src.src;
              if (url) {
                const quality = normalizeQuality(src.label || src.quality || "");
                streams.push({
                  url,
                  quality,
                  title:   `${title || "PStream"} [${quality}]`,
                  size:    formatBytes(src.size),
                  headers: { "Referer": `${PSTREAM_BASE}/` },
                });
              }
            }
          } catch { continue; }
        }

        // Fallback: extract raw URLs from HTML
        if (streams.length === 0) {
          const rawUrls = extractStreamsFromHtml(html);
          for (const url of rawUrls) {
            const quality = url.includes("1080") ? "1080p" : url.includes("720") ? "720p" : "auto";
            streams.push({
              url,
              quality,
              title:   `${title || "PStream"} [${quality}]`,
              headers: { "Referer": `${PSTREAM_BASE}/` },
            });
          }
        }
      }
    } catch { /* silent fail */ }
  }

  // --- Strategy 3: Direct watch URL ---
  if (streams.length === 0) {
    try {
      const watchUrl = type === "movie"
        ? `${PSTREAM_BASE}/movie/${tmdbId}`
        : `${PSTREAM_BASE}/tv/${tmdbId}/${season}/${episode}`;

      const res = await fetch(watchUrl, {
        headers: { ...COMMON_HEADERS, "Accept": "text/html" },
        signal:  AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const html  = await res.text();
        const urls  = extractStreamsFromHtml(html);
        for (const url of urls) {
          const quality = url.includes("1080") ? "1080p" : url.includes("720") ? "720p" : "auto";
          streams.push({
            url,
            quality,
            title:   `${title || "PStream"} [${quality}]`,
            headers: { "Referer": `${PSTREAM_BASE}/` },
          });
        }
      }
    } catch { /* silent fail */ }
  }

  // Sort: best quality first, then deduplicate URLs
  const seen = new Set();
  const unique = streams
    .sort((a, b) => qualityRank(a.quality) - qualityRank(b.quality))
    .filter(s => {
      if (seen.has(s.url)) return false;
      seen.add(s.url);
      return true;
    });

  return unique;
}

module.exports = { scrape };
