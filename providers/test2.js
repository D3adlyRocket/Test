// movies4u.js - Movies4u native provider with FSL HubCloud resolution, M4U Direct parsing, Zero-Width Binary Sorting & Multi-Line Layout

const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const FALLBACK_URL = "https://new2.movies4u.clinic";
const WORKER_PROXY = "https://lucky-star-3059.salman-sohail93.workers.dev";
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

/* ========================================================================== */
/*                    ZERO-WIDTH BINARY SORTING ENGINE                        */
/* ========================================================================== */

function getInvertedSortTag(val, maxBaseline = 999999) {
  const safeVal = Math.max(0, parseInt(val, 10) || 0);
  const inverted = Math.max(0, maxBaseline - safeVal);
  const binaryStr = inverted.toString(2).padStart(20, '0');
  
  // \u200B = '0', \uFEFF = '1'
  return binaryStr.split('').map(bit => bit === '1' ? "\uFEFF" : "\u200B").join('');
}

function getQualityRank(res) {
  const clean = String(res || '').toLowerCase();
  if (clean.includes("2160") || clean.includes("4k") || clean.includes("uhd")) return 4;
  if (clean.includes("1080") || clean.includes("fhd") || clean.includes("fullhd")) return 3;
  if (clean.includes("720") || clean.includes("hd")) return 2;
  if (clean.includes("480") || clean.includes("sd") || clean.includes("360")) return 1;
  return 0;
}

function parseSizeToMB(sizeStr) {
  if (!sizeStr || sizeStr === "N/A") return 0;
  const match = String(sizeStr).match(/([\d.]+)\s*(GB|MB)/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === "GB") return Math.floor(num * 1024);
  if (unit === "MB") return Math.floor(num);
  return 0;
}

/* ========================================================================== */
/*                           METADATA & HELPERS                               */
/* ========================================================================== */

function extractQuality(text) {
  const u = (text || "").toLowerCase();
  if (/\b(2160p|4k|uhd)\b/.test(u)) return "4K";
  if (/\b(1080p|1080)(?!(?:\s*gb|\s*mb|\s*b))\b/.test(u)) return "1080p";
  if (/\b(720p|720)(?!(?:\s*gb|\s*mb|\s*b))\b/.test(u)) return "720p";
  if (/\b(480p|480)(?!(?:\s*gb|\s*mb|\s*b))\b/.test(u)) return "480p";
  if (/\b(360p|360)(?!(?:\s*gb|\s*mb|\s*b))\b/.test(u)) return "360p";
  return "Unknown";
}

function parseExtraMetadata(text) {
  const norm = (text || "").toUpperCase();
  let lang = "Multi-Audio";
  if (norm.includes("DUAL")) lang = "Multi Audio";
  if (norm.includes("ENGLISH") && !norm.includes("HINDI")) lang = "English";
  
  const sizeMatch = norm.match(/(\d+(?:\.\d+)?\s*[MGB]B)/i);
  let size = sizeMatch ? sizeMatch[0].replace(/\s+/g, "") : "N/A";
  if (size === "N/A") {
    const backupMatch = norm.match(/(\d+\.\d+)\s?G/);
    if (backupMatch) size = backupMatch[1] + "GB";
  }
  
  let format = "MKV";
  if (norm.includes("MP4")) format = "MP4";
  if (norm.includes("HEVC") || norm.includes("X265") || norm.includes("H265")) format += " (x265)";
  else if (norm.includes("X264") || norm.includes("H264")) format += " (x264)";

  const extras = [];
  if (norm.includes("HDR")) extras.push("HDR");
  if (norm.includes("DOLBY") || norm.includes("DV") || norm.includes("VISION") || norm.includes("ATMOS") || norm.includes("DD5")) extras.push("Dolby Vision/5.1");
  if (norm.includes("10BIT")) extras.push("10-Bit");
  if (norm.includes("REMUX")) extras.push("Remux");

  return {
    language: lang,
    size: size,
    format: format,
    extras: extras.length > 0 ? extras.join(" | ") : "Standard Dynamic Range"
  };
}

function safeUrl(value) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    parsed.pathname = parsed.pathname.split("/").map(segment => {
      try { return encodeURIComponent(decodeURIComponent(segment)); }
      catch (_) { return encodeURIComponent(segment); }
    }).join("/");
    return parsed.toString();
  } catch (_) {
    return value;
  }
}

function wrapFslMkvUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!(host === "r2.cloudflarestorage.com" || host.endsWith(".r2.cloudflarestorage.com"))) return url;
    return `${WORKER_PROXY}/media/file.mkv?url=${encodeURIComponent(url)}`;
  } catch (_) {
    return url;
  }
}

function hubCloudServer(text, link) {
  const value = `${text || ""} ${link || ""}`.toLowerCase();
  if (/gpdl\.|server\s*:\s*10gbps/.test(value)) return "HubCloud Pixel 10Gbps";
  if (/fslv2/.test(value)) return "HubCloud FSLv2";
  if (/fsl/.test(value)) return "HubCloud FSL";
  if (/s3 server/.test(value)) return "HubCloud S3";
  if (/mega server/.test(value)) return "HubCloud Mega";
  if (/pdl server/.test(value)) return "HubCloud PDL";
  if (/buzzserver/.test(value)) return "HubCloud BuzzServer";
  if (/pixeldrain/.test(value)) return "HubCloud Pixeldrain";
  if (/pixel\.|pixelserver/.test(value)) return "HubCloud Pixel";
  if (/workers\.dev|download file/.test(value)) return "HubCloud Direct";
  return "HubCloud";
}

function unpackJS(p, a, c, k) {
  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp("\\b" + c.toString(a) + "\\b", "g"), k[c]);
    }
  }
  return p;
}

async function detectFileSize(url, headers = {}) {
  try {
    const resp = await fetch(url, { method: "HEAD", headers, skipSizeCheck: true, redirect: "follow" });
    const size = resp.headers.get("content-length");
    if (!size) return null;
    const bytes = parseInt(size);
    let readableSize = "";
    if (bytes >= 1024 * 1024 * 1024) {
      readableSize = (bytes / (1024 * 1024 * 1024)).toFixed(1) + "GB";
    } else {
      readableSize = Math.round(bytes / (1024 * 1024)) + "MB";
    }
    return { bytes, string: readableSize };
  } catch (_) {}
  return null;
}

async function detectDynamicQuality(url, headers = {}, fallbackLabel = "", runtimeMinutes = 120) {
  try {
    if (!url) return "1080p";
    const decodedUrl = decodeURIComponent(url).toLowerCase();
    let detected = extractQuality(decodedUrl);
    if (detected !== "Unknown") return detected;

    if (fallbackLabel) {
      detected = extractQuality(fallbackLabel.toLowerCase());
      if (detected !== "Unknown") return detected;
    }

    const sizeData = await detectFileSize(url, headers);
    if (sizeData && sizeData.bytes) {
      const totalGB = sizeData.bytes / (1024 * 1024 * 1024);
      const minutes = parseInt(runtimeMinutes) || 120;
      const hours = minutes / 60;
      const gbPerHour = totalGB / hours;

      if (gbPerHour >= 6.5) return "4K";
      if (gbPerHour >= 0.95) return "1080p";
      if (gbPerHour >= 0.35) return "720p";
      return "480p";
    }
  } catch (_) {}
  return "1080p";
}

/* ========================================================================== */
/*                         EXTRACTORS & RESOLVERS                             */
/* ========================================================================== */

async function extractDirectM3u8(playerUrl) {
  try {
    const resp = await fetch(playerUrl, { headers: { ...HEADERS, Referer: "https://m4uplay.store/" }, skipSizeCheck: true });
    const html = await resp.text();
    let m3u8 = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0] || html.match(/https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/i)?.[0];
    
    if (!m3u8) {
      const rel = html.match(/\/(?:3o|stream)\/[^\s"'<>]+(?:m3u8|txt)/i)?.[0];
      if (rel) m3u8 = "https://m4uplay.store" + rel;
    }

    if (!m3u8) {
      const packedMatch = html.match(/eval\(function\(p,a,c,k,e,d\).*?\}\('(.*)',(\d+),(\d+),'(.*)'\.split\('\|'\)/s);
      if (packedMatch) {
        const unpacked = unpackJS(packedMatch[1], parseInt(packedMatch[2]), parseInt(packedMatch[3]), packedMatch[4].split("|"));
        m3u8 = unpacked.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0] || unpacked.match(/https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/i)?.[0];
        if (!m3u8) {
          const relUnpacked = unpacked.match(/\/(?:3o|stream)\/[^\s"'<>]+(?:m3u8|txt)/i)?.[0];
          if (relUnpacked) m3u8 = "https://m4uplay.store" + relUnpacked;
        }
      }
    }
    return m3u8 || null;
  } catch (_) {
    return null;
  }
}

async function extractHubCloud(url, referer) {
  try {
    let currentUrl = url.replace("hubcloud.foo", "hubcloud.cx").replace("hubcloud.ink", "hubcloud.dad");
    let resp = await fetch(currentUrl, { headers: { ...HEADERS, Referer: referer }, skipSizeCheck: true });
    let html = await resp.text();
    let pageUrl = resp.url || currentUrl;

    const generate = html.match(/<a[^>]+href="([^"]*hubcloud\.php[^"]*)"/i)?.[1] || 
                     html.match(/id="download"[^>]+href="([^"]+)"/i)?.[1] || 
                     html.match(/var url = '([^']+)'/)?.[1];
    
    if (generate) {
      const next = new URL(generate, pageUrl).href;
      resp = await fetch(next, { headers: { ...HEADERS, Referer: pageUrl }, skipSizeCheck: true });
      html = await resp.text();
      pageUrl = resp.url || next;
    }

    const header = html.match(/class="card-header">([^<]+)</i)?.[1] || html.match(/<title>([^<]+)<\/title>/i)?.[1] || "";
    const sizeMatch = html.match(/id="size">([^<]+)</i)?.[1] || html.match(/([\d.]+\s*(?:GB|MB))/i)?.[1];
    const size = sizeMatch ? sizeMatch.trim() : undefined;
    const quality = extractQuality(header);

    const buttonMatches = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    const buttons = [];

    for (const match of buttonMatches) {
      const link = match[1];
      const text = match[2].replace(/<[^>]+>/g, " ").toLowerCase();
      if (!link || !/(download file|download\s*\[server|fsl|buzzserver|pixeldra|pixelserver|pixel server|s3 server|mega server|pdl server)/i.test(text)) continue;
      if (/workers\.dev/i.test(link) && /download file/i.test(text)) continue;
      buttons.push({ link: new URL(link, pageUrl).href, text });
    }

    const streams = await Promise.all(buttons.map(async (button) => {
      let link = button.link;
      if (/pixeldra|pixelserver|pixel server/i.test(button.text)) {
        return null;
      } else if (/gpdl\.|download\s*\[server\s*:\s*10gbps/i.test(`${button.link} ${button.text}`)) {
        try {
          const gateway = await fetch(link, { redirect: "manual", headers: { ...HEADERS, Referer: pageUrl }, skipSizeCheck: true });
          const worker = gateway.headers.get("location");
          if (!worker) return null;
          const generated = await fetch(new URL(worker, link).href, { redirect: "manual", headers: { ...HEADERS, Referer: link }, skipSizeCheck: true });
          const wrapper = generated.headers.get("location");
          if (!wrapper) return null;
          link = new URL(wrapper).searchParams.get("link");
          if (!link) return null;
        } catch (_) {
          return null;
        }
      } else if (/buzzserver/i.test(button.text)) {
        try {
          const response2 = await fetch(link, { redirect: "manual", headers: { ...HEADERS, Referer: pageUrl }, skipSizeCheck: true });
          link = response2.headers.get("hx-redirect") || response2.headers.get("location");
          if (!link) return null;
          link = new URL(link, button.link).href;
        } catch (_) {
          return null;
        }
      }

      const source = hubCloudServer(button.text, button.link);
      if (/HubCloud FSL/i.test(source)) {
        link = wrapFslMkvUrl(link);
      }

      return {
        source,
        title: [quality, size].filter(Boolean).join(" • "),
        url: safeUrl(link),
        quality,
        size,
        headers: { ...HEADERS, Referer: pageUrl },
        subtitles: []
      };
    }));

    return streams.filter(Boolean);
  } catch (_) {
    return [];
  }
}

/* ========================================================================== */
/*                           MAIN PROVIDER LOGIC                              */
/* ========================================================================== */

async function getStreams(tmdbId, mediaType, season = 1, episode = 1) {
  const base = await getBaseUrl();
  const tmdbNum = tmdbId.toString().replace("tmdb:", "");

  let title = "", year = "";
  try {
    const type = mediaType === "tv" ? "tv" : "movie";
    const tmdbResp = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbNum}?api_key=${TMDB_API_KEY}`, { skipSizeCheck: true });
    const meta = await tmdbResp.json();
    title = type === "tv" ? meta.name : meta.title;
    const releaseDate = type === "tv" ? meta.first_air_date : meta.release_date;
    if (releaseDate) year = releaseDate.split("-")[0];
  } catch (_) {}

  if (!title) return [];

  let postUrl = null;
  try {
    const searchResp = await fetch(`${base}/?s=${encodeURIComponent(title)}`, { headers: HEADERS, skipSizeCheck: true });
    const searchHtml = await searchResp.text();
    const articles = [...searchHtml.matchAll(/<article[\s\S]*?<a href="([^"]+)"[^>]*rel="bookmark">([^<]+)<\/a>/gi)];
    
    for (const art of articles) {
      const link = art[1];
      const artTitle = art[2].toLowerCase();
      const cleanTarget = title.toLowerCase();

      if (artTitle.includes(cleanTarget) && (!year || artTitle.includes(year))) {
        if (mediaType === "tv" && !/season|series/i.test(artTitle)) continue;
        postUrl = link;
        break;
      }
    }
  } catch (_) {}

  if (!postUrl) return [];

  let detailHtml = "";
  try {
    const detailResp = await fetch(postUrl, { headers: HEADERS, skipSizeCheck: true });
    detailHtml = await detailResp.text();
  } catch (_) {
    return [];
  }

  const releasePages = [];
  const headingBlocks = [...detailHtml.matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>([\s\S]*?)(?=<h4|$)/gi)];

  for (const block of headingBlocks) {
    const label = block[1].replace(/<[^>]+>/g, " ").trim();
    const body = block[2];

    if (mediaType === "tv" && !new RegExp(`season\\s*0?${season}(?:\\D|$)`, "i").test(label)) continue;

    const quality = extractQuality(label);
    const sizeMatch = label.match(/\b\d+(?:\.\d+)?\s*(?:GB|MB)(?:\/E)?\b/i);
    const size = sizeMatch ? sizeMatch[0] : undefined;

    const anchors = [...body.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    for (const anc of anchors) {
      const href = anc[1];
      const anchorText = anc[2].replace(/<[^>]+>/g, "").trim();
      if (/m4ulinks\./i.test(href)) {
        releasePages.push({ url: href, quality, size, label, anchorText });
      }
    }
  }

  const rawStreams = [];

  for (const release of releasePages) {
    try {
      const relResp = await fetch(release.url, { headers: { ...HEADERS, Referer: postUrl }, skipSizeCheck: true });
      const relHtml = await relResp.text();

      const routes = [];
      const subHeadings = [...relHtml.matchAll(/<h[45][^>]*>([\s\S]*?)<\/h[45]>([\s\S]*?)(?=<h[45]|$)/gi)];

      for (const sub of subHeadings) {
        const hText = sub[1].replace(/<[^>]+>/g, "").trim();
        const body = sub[2];

        if (mediaType === "tv") {
          const epMatch = hText.match(/episodes?\s*:\s*0*(\d+)/i);
          if (!epMatch || parseInt(epMatch[1]) !== parseInt(episode)) continue;
        }

        const subAnchors = [...body.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
        for (const sa of subAnchors) {
          routes.push({ url: sa[1], label: sa[2].replace(/<[^>]+>/g, "").trim() });
        }
      }

      for (const route of routes) {
        const routeText = `${route.label} ${route.url}`.toLowerCase();
        
        // --- HubCloud Stream Processing ---
        if (routeText.includes("hubcloud")) {
          const hcStreams = await extractHubCloud(route.url, release.url);
          for (const s of hcStreams) {
            const meta = parseExtraMetadata(release.label + " " + (release.size || ""));
            const finalQuality = await detectDynamicQuality(s.url, s.headers, release.quality);
            const displaySize = s.size || meta.size;

            // Sorting metadata calculation
            const qualityRank = getQualityRank(finalQuality);
            const sizeInMB = parseSizeToMB(displaySize);
            const sortTag = getInvertedSortTag((qualityRank * 100000) + sizeInMB, 999999);

            // Subheadings UI Structure
            const line1 = `🎬 ${title}${year ? ` (${year})` : ""}`;
            const line2 = `📺 ${finalQuality} | 🗣️ ${meta.language} | 💾 ${displaySize}`;
            const line3 = `🎞️ ${meta.format} | ✨ ${meta.extras}`;
            const line4 = `🌐 Movies4u | 📦 ${s.source}`;

            const formattedSubtitles = [line1, line2, line3, line4].join("\n");

            rawStreams.push({
              name: `${sortTag}Movies4u • ${finalQuality} • ${s.source}`,
              title: formattedSubtitles,
              description: formattedSubtitles,
              url: s.url,
              quality: finalQuality,
              headers: s.headers,
              provider: "Movies4u",
              behaviorHints: {
                notWebReady: true,
                proxyHeaders: {
                  request: s.headers
                }
              }
            });
          }
        } 
        // --- Direct M4U Player Processing ---
        else if (routeText.includes("m4uplay") || routeText.includes("stream")) {
          const m3u8Url = await extractDirectM3u8(route.url);
          if (m3u8Url) {
            const meta = parseExtraMetadata(release.label + " " + (release.size || ""));
            const finalQuality = await detectDynamicQuality(m3u8Url, HEADERS, release.quality);
            const displaySize = meta.size;

            // Sorting metadata calculation
            const qualityRank = getQualityRank(finalQuality);
            const sizeInMB = parseSizeToMB(displaySize);
            const sortTag = getInvertedSortTag((qualityRank * 100000) + sizeInMB, 999999);

            // Subheadings UI Structure
            const line1 = `🎬 ${title}${year ? ` (${year})` : ""}`;
            const line2 = `📺 ${finalQuality} | 🗣️ ${meta.language} | 💾 ${displaySize}`;
            const line3 = `🎞️ ${meta.format} | ✨ ${meta.extras}`;
            const line4 = `🌐 Movies4u | 📦 M4U Direct`;

            const formattedSubtitles = [line1, line2, line3, line4].join("\n");

            rawStreams.push({
              name: `${sortTag}Movies4u • ${finalQuality} • M4U Direct`,
              title: formattedSubtitles,
              description: formattedSubtitles,
              url: m3u8Url,
              quality: finalQuality,
              headers: { ...HEADERS, Referer: "https://m4uplay.store/" },
              provider: "Movies4u",
              behaviorHints: {
                notWebReady: true,
                proxyHeaders: {
                  request: { ...HEADERS, Referer: "https://m4uplay.store/" }
                }
              }
            });
          }
        }
      }
    } catch (_) {}
  }

  // Deduplicate streams by URL
  const seen = new Set();
  return rawStreams.filter(stream => {
    if (!stream.url || seen.has(stream.url)) return false;
    seen.add(stream.url);
    return true;
  });
}

module.exports = { getStreams };
