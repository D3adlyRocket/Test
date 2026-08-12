const cheerio = typeof require === "function" ? require("cheerio-without-node-native") : global.cheerio;
// zinkmovies.js
// Zinkmovies - Hindi/Indian movie & series site (domain from a remote config file)
// Search: /page/1/?s={query} → article results
// Movie: div.movie-button-container a[href]; TV: .lgtagmessage season headings → season page → .entry-content a[href]
// Links: bypassShortlink (tpi.li/oii.la) → generateZinkLinks (ajax token → /dl/ page → mirrors + worker) → HubCloud/Hubdrive/HUBCDN/PixelDrain extractors

function parseSize(text) {
  if (!text) return "Unknown Size";
  const m = String(text).match(/(\d+(?:\.\d+)?\s*(?:GB|MB|gb|mb))/i);
  return m ? m[1].toUpperCase() : "Unknown Size";
}

function buildDropdownMetadata(tmdbData, qualityLabel, isTv, season, episode, serverType, labelText, targetUrl) {
  const title = (isTv ? tmdbData?.name : tmdbData?.title) || "Unknown Title";
  const releaseYear = isTv 
    ? (tmdbData?.first_air_date || "").split("-")[0] 
    : (tmdbData?.release_date || "").split("-")[0];
  const yearStr = releaseYear ? ` (${releaseYear})` : "";
  
  let decodedUrl = "";
  try {
    if (targetUrl) decodedUrl = decodeURIComponent(targetUrl);
  } catch(e) {
    decodedUrl = targetUrl || "";
  }
  const searchPool = `${String(labelText)} ${decodedUrl}`.toLowerCase();

  // Subheading Line 1
  let line1 = `🎬 ${title}${yearStr}`;
  if (isTv && season && episode) {
    line1 += ` | S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
  }

  // Subheading Line 2
  let normQual = String(qualityLabel).toLowerCase().replace(/p/g, "") + "p";
  if (searchPool.includes("2160p") || searchPool.includes("4k") || searchPool.includes("uhd")) normQual = "2160p";
  else if (searchPool.includes("1080p")) normQual = "1080p";
  else if (searchPool.includes("720p")) normQual = "720p";

  let qIcon = "💎";
  if (normQual.includes("2160") || normQual.includes("4k")) qIcon = "🌟";
  else if (normQual.includes("1080")) qIcon = "🔥";

  let langStr = "Original-Audio";
  const multiAudioKeywords = ["multi", "dual", "hindi", "tamil", "telugu", "bengali", "malayalam", "kannada", "marathi", "punjabi"];
  if (multiAudioKeywords.some(keyword => searchPool.includes(keyword))) {
    langStr = "Multi-Audio";
  }

  const parsedSize = parseSize(labelText);
  const line2 = `${qIcon} ${normQual} | 🌍 ${langStr} | 💾 ${parsedSize}`;

  // Subheading Line 3
  const formatVal = targetUrl.includes(".mp4") ? "MP4" : "MKV";
  let codecVal = "🎥 H.264";
  if (searchPool.includes("hevc") || searchPool.includes("x265") || searchPool.includes("h265")) {
    codecVal = searchPool.includes("hevc") ? "⚡ HEVC" : "🎥 H.265";
  } else if (searchPool.includes("x264")) {
    codecVal = "🎥 H.264";
  }

  let hdrVal = "";
  if (searchPool.includes("hdr10+")) hdrVal = " | 🌈 HDR10+";
  else if (searchPool.includes("hdr")) hdrVal = " | 🌈 HDR";
  else if (searchPool.includes("sdr")) hdrVal = " | 🌈 SDR";

  let sourceVal = "";
  if (searchPool.includes("web-dl") || searchPool.includes("webdl")) sourceVal = " | 📥 WEB-DL";
  else if (searchPool.includes("web-rip") || searchPool.includes("webrip")) sourceVal = " | 🌐 WEB-Rip";
  else if (searchPool.includes("hd-rip") || searchPool.includes("hdrip")) sourceVal = " | 📺 HD-Rip";
  else if (searchPool.includes("bluray")) sourceVal = " | 💿 BluRay";

  const line3 = `🎞️ ${formatVal}${hdrVal} | ${codecVal}${sourceVal}`;

  // Subheading Line 4
  let audioCodec = "🎵 AAC";
  if (searchPool.includes("ddp5.1") || searchPool.includes("ddp 5.1") || searchPool.includes("atmos")) audioCodec = "🎵 DDP 5.1";
  else if (searchPool.includes("truehd")) audioCodec = "🎵 TrueHD";

  let audioProfile = "";
  if (searchPool.includes("atmos")) audioProfile = " | 🔊 Dolby Atmos";
  else if (searchPool.includes("dv") || searchPool.includes("dolby vision")) audioProfile = " | ♾ Dolby Vision";

  const line4 = audioCodec + audioProfile;

  // Subheading Line 5
  const line5 = `🔗 ${serverType}`;

  return `${line1}\n${line2}\n${line3}\n${line4}\n${line5}`;
}

const DOMAINS_URL = "https://raw.githubusercontent.com/sapariyaneel/nuvio-plugin/refs/heads/main/domains.json";
const FALLBACK_BASE_URL = "https://new2.zinkmovies.mobi";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  "Cookie": "xla=s4t"
};

const RANDOM_ID_REGEX = /generateDownloadLink\(['"]([^'"]+)/;
const AJAX_REGEX = /https:\/\/[^"'\s]+ajax_generate_token\.php/;
const DL_REGEX = /https:\/\/[^"'\s]+\/dl\//;
const SERVER_HANDLER_REGEX = /SERVER_HANDLER_URL\s*=\s*["']([^"']+)/;
const WORKER_REGEX = /handleServerRequest\(['"]worker['"]\s*,\s*['"]([^'"]+)/;

let cachedDomains = null;

async function getDomains() {
  if (cachedDomains) return cachedDomains;
  try {
    const resp = await fetch(DOMAINS_URL, { skipSizeCheck: true });
    cachedDomains = await resp.json();
  } catch (e) {
    cachedDomains = {};
  }
  return cachedDomains;
}

async function getBaseUrl() {
  const d = await getDomains();
  return d.zinkmovies || FALLBACK_BASE_URL;
}

function originOf(url) {
  const m = (url || "").match(/^(https?:\/\/[^/]+)/);
  return m ? m[1] : "";
}

function indexQuality(str) {
  const m = (str || "").match(/(\d{3,4})[pP]/);
  if (!m) return "Unknown";
  return `${m[1]}p`;
}

function toBytes(size) {
  const m = (size || "").match(/([\d.]+)\s*(GB|MB|KB)/i);
  if (!m) return 0;
  const v = parseFloat(m[1]);
  const unit = m[2].toUpperCase();
  if (unit === "GB") return v * 1024 ** 3;
  if (unit === "MB") return v * 1024 ** 2;
  return v * 1024;
}

function formatBytes(bytes) {
  if (!bytes) return "";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function base64Decode(value) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  const input = (value || "").replace(/[^A-Za-z0-9+/=]/g, "");
  let output = "";
  let i = 0;
  while (i < input.length) {
    const e1 = chars.indexOf(input.charAt(i++));
    const e2 = chars.indexOf(input.charAt(i++));
    const e3 = chars.indexOf(input.charAt(i++));
    const e4 = chars.indexOf(input.charAt(i++));
    const c1 = (e1 << 2) | (e2 >> 4);
    const c2 = ((e2 & 15) << 4) | (e3 >> 2);
    const c3 = ((e3 & 3) << 6) | e4;
    output += String.fromCharCode(c1);
    if (e3 !== 64) output += String.fromCharCode(c2);
    if (e4 !== 64) output += String.fromCharCode(c3);
  }
  return output;
}

function cleanHubTitle(title) {
  const name = (title || "").replace(/\.[a-zA-Z0-9]{2,4}$/, "");
  const normalized = name
    .replace(/WEB[-_. ]?DL/gi, "WEB-DL")
    .replace(/WEB[-_. ]?RIP/gi, "WEBRIP")
    .replace(/H[ .]?265/gi, "H265")
    .replace(/H[ .]?264/gi, "H264")
    .replace(/DDP[ .]?([0-9]\.[0-9])/gi, "DDP$1");

  const sourceTags = ["WEB-DL", "WEBRIP", "BLURAY", "HDRIP", "DVDRIP", "HDTV", "CAM", "TS", "BRRIP", "BDRIP"];
  const codecTags = ["H264", "H265", "X264", "X265", "HEVC", "AVC"];
  const audioTags = ["AAC", "AC3", "DTS", "MP3", "FLAC", "DD", "DDP", "EAC3"];
  const hdrTags = ["SDR", "HDR", "HDR10", "HDR10+", "DV", "DOLBYVISION"];

  const out = [];
  for (const part of normalized.split(/[ _.]/)) {
    const p = part.toUpperCase();
    let keep = null;
    if (sourceTags.includes(p) || codecTags.includes(p)) keep = p;
    else if (audioTags.some(t => p.startsWith(t)) || p === "ATMOS") keep = p;
    else if (hdrTags.includes(p)) keep = p === "DV" || p === "DOLBYVISION" ? "DOLBYVISION" : p;
    else if (p === "NF" || p === "CR") keep = p;
    if (keep && !out.includes(keep)) out.push(keep);
  }
  return out.join(" ");
}

async function retry(times, delayMs, block) {
  for (let i = 0; i < times; i++) {
    try {
      const result = await block();
      if (result) return result;
    } catch (e) {}
    if (i < times - 1) await new Promise(r => setTimeout(r, delayMs));
  }
  return null;
}

async function bypassShortlink(url) {
  if (!url.includes("tpi.li") && !url.includes("oii.la")) return url;
  try {
    const docText = await (await fetch(url, { headers: HEADERS, skipSizeCheck: true })).text();
    const match = docText.match(/aHR0c[a-zA-Z0-9+/=]+/);
    if (!match) return url;
    const decodedUrl = base64Decode(match[0]);
    if (decodedUrl.startsWith("http")) return decodedUrl;
    const $ = cheerio.load(docText);
    const link = $("a.get-link").attr("href");
    return link && link.trim() ? link : url;
  } catch (e) {
    return url;
  }
}

async function generateZinkLinks(url) {
  try {
    const firstHtml = await (await fetch(url, { headers: HEADERS, skipSizeCheck: true })).text();

    const randomIdMatch = firstHtml.match(RANDOM_ID_REGEX);
    if (!randomIdMatch) return [];
    const randomId = randomIdMatch[1];

    const ajaxMatch = firstHtml.match(AJAX_REGEX);
    if (!ajaxMatch) return [];
    const ajaxEndpoint = ajaxMatch[0];

    const dlMatch = firstHtml.match(DL_REGEX);
    if (!dlMatch) return [];
    const downloadBase = dlMatch[0];

    const token = await retry(3, 1000, async () => {
      const resp = await fetch(`${ajaxEndpoint}?random_id=${randomId}`, {
        method: "POST",
        headers: {
          ...HEADERS,
          "X-Requested-With": "XMLHttpRequest",
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: `random_id=${encodeURIComponent(randomId)}`,
        skipSizeCheck: true
      });
      const text = await resp.text();
      const data = JSON.parse(text);
      return data && data.token ? data.token : null;
    });
    if (!token) return [];

    const generatedUrl = `${downloadBase}${token}`;
    const generatedHtml = await (await fetch(generatedUrl, { headers: HEADERS, skipSizeCheck: true })).text();
    const $ = cheerio.load(generatedHtml);

    const results = [];
    $("#mirror-buttons a[href]").each((i, el) => {
      const href = ($(el).attr("href") || "").trim();
      if (!href) return;
      const name = $(el).text().replace("Generate", "").trim();
      results.push({ name, url: href });
    });

    const workerOnclick = $("#worker-btn").attr("onclick") || "";
    const workerMatch = workerOnclick.match(WORKER_REGEX);
    const workerId = workerMatch ? workerMatch[1] : "";
    const handlerMatch = generatedHtml.match(SERVER_HANDLER_REGEX);
    const serverHandler = handlerMatch ? handlerMatch[1] : "";

    if (workerId && serverHandler) {
      try {
        const workerResp = await fetch(serverHandler, {
          method: "POST",
          headers: {
            ...HEADERS,
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/json",
            "Origin": generatedUrl.split("/dl/")[0],
            "Referer": generatedUrl
          },
          body: JSON.stringify({ server: "worker", random_id: workerId }),
          skipSizeCheck: true
        });
        const workerJson = JSON.parse(await workerResp.text());
        const workerUrl = (workerJson && (workerJson.url || workerJson.download)) || "";
        if (workerUrl && workerUrl.trim()) results.push({ name: "WORKER", url: workerUrl });
      } catch (e) {}
    }

    const seen = new Set();
    return results.filter(l => {
      if (seen.has(l.url)) return false;
      seen.add(l.url);
      return true;
    });
  } catch (e) {
    return [];
  }
}

async function pixelDrainExtractor(link, quality, label) {
  try {
    const base = originOf(link) || "https://pixeldrain.dev";
    const finalUrl = link.includes("download")
      ? link
      : `${base}/api/file/${link.split("/").pop()}?download`;
    return [{ url: finalUrl, quality, title: `Zinkmovies Pixeldrain ${label}`.trim() }];
  } catch (e) {
    return [];
  }
}

async function hubCdnExtractor(url) {
  try {
    const html = await (await fetch(url, { headers: HEADERS, skipSizeCheck: true })).text();
    const $ = cheerio.load(html);
    const scriptText = $("script:contains(var reurl)").first().html() || html;
    const m = scriptText.match(/reurl\s*=\s*"([^"]+)"/);
    if (!m) return [];
    const encodedUrl = m[1].split("?r=")[1];
    if (!encodedUrl) return [];
    const decoded = base64Decode(encodedUrl);
    const idx = decoded.lastIndexOf("link=");
    if (idx === -1) return [];
    const decodedUrl = decoded.substring(idx + 5);
    if (!decodedUrl) return [];
    return [{ url: decodedUrl, quality: "Unknown", title: "Zinkmovies HUBCDN" }];
  } catch (e) {
    return [];
  }
}

async function hubDriveExtractor(url) {
  try {
    const html = await (await fetch(url, { headers: HEADERS, skipSizeCheck: true })).text();
    const $ = cheerio.load(html);
    const href = $(".btn.btn-primary.btn-user.btn-success1.m-1").attr("href");
    if (!href) return [];
    if (href.toLowerCase().includes("hubcloud")) return hubCloudExtractor(href, "HubDrive");
    return loadExtractor(href, "HubDrive");
  } catch (e) {
    return [];
  }
}

async function hubCloudExtractor(url, referer) {
  try {
    const ref = referer || "";
    const baseUrl = originOf(url);
    if (!baseUrl) return [];

    let href;
    if (url.includes("hubcloud.php")) {
      href = url;
    } else {
      const html = await (await fetch(url, { headers: HEADERS, skipSizeCheck: true })).text();
      const $first = cheerio.load(html);
      const raw = $first("#download").attr("href") || "";
      if (!raw) return [];
      href = raw.toLowerCase().startsWith("http")
        ? raw
        : `${baseUrl.replace(/\/+$/, "")}/${raw.replace(/^\/+/, "")}`;
    }
    if (!href.trim()) return [];

    const pageHtml = await (await fetch(href, { headers: HEADERS, skipSizeCheck: true })).text();
    const $ = cheerio.load(pageHtml);

    const size = $("i#size").first().text() || "";
    const header = $("div.card-header").first().text() || "";
    const headerDetails = cleanHubTitle(header);
    const quality = indexQuality(header);
    const sizeInBytes = toBytes(size);

    let labelExtras = "";
    if (headerDetails.length > 0) labelExtras += `[${headerDetails}]`;
    if (size.length > 0) labelExtras += `[${size}]`;

    const buttons = $("a.btn").toArray().map(el => ({
      link: $(el).attr("href") || "",
      label: ($(el).text() || "").toLowerCase()
    }));

    const streams = [];
    for (const { link, label } of buttons) {
      if (!link) continue;
      try {
        if (label.includes("fsl server")) {
          streams.push({ url: link, quality, title: `${ref} [FSL Server] ${labelExtras}`.trim(), size: formatBytes(sizeInBytes )});
        } else if (label.includes("download file")) {
          streams.push({ url: link, quality, title: `${ref} ${labelExtras}`.trim(), size: formatBytes(sizeInBytes )});
        } else if (label.includes("buzzserver")) {
          const resp = await fetch(`${link}/download`, {
            headers: { ...HEADERS, Referer: link },
            redirect: "manual",
            skipSizeCheck: true
          });
          const dlink = resp.headers.get("hx-redirect") || resp.headers.get("HX-Redirect") || "";
          if (dlink.trim()) {
            streams.push({ url: dlink, quality, title: `${ref} [BuzzServer] ${labelExtras}`.trim(), size: formatBytes(sizeInBytes )});
          }
        } else if (
          label.includes("pixeldra") ||
          label.includes("pixelserver") ||
          label.includes("pixel server") ||
          label.includes("pixeldrain")
        ) {
          const base = originOf(link);
          const finalUrl = link.includes("download")
            ? link
            : `${base}/api/file/${link.split("/").pop()}?download`;
          streams.push({ url: finalUrl, quality, title: `${ref} Pixeldrain ${labelExtras}`.trim(), size: formatBytes(sizeInBytes )});
        } else if (label.includes("s3 server")) {
          streams.push({ url: link, quality, title: `${ref} [S3 Server] ${labelExtras}`.trim(), size: formatBytes(sizeInBytes )});
        } else if (label.includes("fslv2")) {
          streams.push({ url: link, quality, title: `${ref} [FSLv2] ${labelExtras}`.trim(), size: formatBytes(sizeInBytes )});
        } else if (label.includes("mega server")) {
          streams.push({ url: link, quality, title: `${ref} [Mega Server] ${labelExtras}`.trim(), size: formatBytes(sizeInBytes )});
        } else {
          const nested = await loadExtractor(link, "");
          streams.push(...nested.map(s => ({ ...s, size: s.size || formatBytes(sizeInBytes) })));
        }
      } catch (e) {}
    }
    return streams;
  } catch (e) {
    return [];
  }
}

async function tpiLiExtractor(url) {
  try {
    const finalUrl = await bypassShortlink(url);
    if (finalUrl === url || !finalUrl.trim()) return [];
    return loadExtractor(finalUrl, url);
  } catch (e) {
    return [];
  }
}

async function loadExtractor(url, referer) {
  if (!url || !url.startsWith("http")) return [];
  const host = (originOf(url) || "").toLowerCase();
  try {
    if (host.includes("hubcdn")) return await hubCdnExtractor(url);
    if (host.includes("hubdrive")) return await hubDriveExtractor(url);
    if (host.includes("hubcloud")) return await hubCloudExtractor(url, referer || "HubCloud");
    if (host.includes("pixeldrain")) return await pixelDrainExtractor(url, "Unknown", "");
    if (host.includes("tpi.li") || host.includes("oii.la")) return await tpiLiExtractor(url);
    return [{ url, quality: indexQuality(url), title: "Zinkmovies" }];
  } catch (e) {
    return [];
  }
}

async function resolvePageLinks(pageUrl) {
  try {
    const finalUrl = await bypassShortlink(pageUrl);
    const zinkLinks = await generateZinkLinks(finalUrl);
    const streams = [];
    for (const link of zinkLinks) {
      try {
        if (link.name.toLowerCase().includes("worker")) {
          streams.push({ url: link.url, quality: indexQuality(link.url), title: "Zink Worker" });
        } else {
          const extracted = await loadExtractor(link.url, "Zinkmovies");
          streams.push(...extracted);
        }
      } catch (e) {}
    }
    return streams;
  } catch (e) {
    return [];
  }
}

async function resolveImdbToTmdb(imdbId, mediaType) {
  try {
    const url = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    const data = await (await fetch(url, { skipSizeCheck: true })).json();
    const results = mediaType === "tv" ? data.tv_results : data.movie_results;
    return results && results.length ? results[0].id : null;
  } catch (e) {
    return null;
  }
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    if (typeof tmdbId === "string" && tmdbId.trim().toLowerCase().startsWith("tt")) {
      tmdbId = await resolveImdbToTmdb(tmdbId, mediaType);
      if (!tmdbId) return [];
    }

    const baseUrl = await getBaseUrl();

    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    const searchUrl = `${baseUrl}/page/1/?s=${encodeURIComponent(title)}`;
    const searchHtml = await (await fetch(searchUrl, { headers: HEADERS, skipSizeCheck: true })).text();
    const $search = cheerio.load(searchHtml);

    const results = [];
    $search("article").each((i, el) => {
      const href = $search("a", el).attr("href");
      const name = $search("a", el).text().trim();
      if (href) results.push({ title: name, url: href });
    });
    if (!results.length) return [];

    const isTV = mediaType === "tv";
    const lcTitle = title.toLowerCase();
    let match = results.find(r => r.title.toLowerCase().includes(lcTitle));
    if (!match) match = results[0];

    const pageUrl = match.url.startsWith("http") ? match.url : `${baseUrl}${match.url}`;
    const pageHtml = await (await fetch(pageUrl, { headers: HEADERS, skipSizeCheck: true })).text();
    const $page = cheerio.load(pageHtml);

    const targetPages = [];

    if (isTV) {
      const seasonRegex = /Season\s*(\d+)/i;
      const episodeRegex = /EPISODE\s*[-:]?\s*(\d+)/i;

      const hasClass = (el, cls) => new RegExp(`\\b${cls}\\b`).test($page(el).attr("class") || "");

      const seasonUrls = [];
      $page(".lgtagmessage").each((i, el) => {
        const sm = $page(el).text().match(seasonRegex);
        if (!sm) return;
        const seasonNum = parseInt(sm[1], 10);
        if (seasonNum !== season) return;

        let next = $page(el).next();
        while (next.length && !hasClass(next, "lgtagmessage")) {
          if (hasClass(next, "movie-button-container")) {
            const href = ($page("a[href]", next).first().attr("href") || "").trim();
            if (href) seasonUrls.push(href);
            break;
          }
          next = next.next();
        }
      });

      for (const seasonUrl of seasonUrls) {
        try {
          const seasonHtml = await (await fetch(seasonUrl, { headers: HEADERS, skipSizeCheck: true })).text();
          const $season = cheerio.load(seasonHtml);
          $season(".entry-content a[href]").each((i, el) => {
            const text = $season(el).text();
            const em = text.match(episodeRegex);
            if (!em) return;
            if (parseInt(em[1], 10) !== episode) return;
            const href = ($season(el).attr("href") || "").trim();
            if (!href || text.toLowerCase().includes("zip")) return;
            targetPages.push(href);
          });
        } catch (e) {}
      }
    } else {
      $page("div.movie-button-container a").each((i, el) => {
        const href = $page(el).attr("href");
        if (href) targetPages.push(href);
      });
    }

    if (!targetPages.length) return [];

    const streams = [];
    for (const page of targetPages) {
      const resolved = await resolvePageLinks(page);
      streams.push(...resolved);
    }

    return streams
      .filter(s => s && s.url)
      .map(s => {
        const qualityLabel = s.quality || indexQuality(s.url) || "HD";
        const serverType = s.title || "Zinkmovies";
        const labelText = `${s.title || ""} ${s.size || ""}`;

        const metadata = buildDropdownMetadata(
          mediaInfo,
          qualityLabel,
          isTV,
          season,
          episode,
          serverType,
          labelText,
          s.url
        );

        let displayLang = "Original-Audio";
        const searchPool = `${labelText} ${s.url}`.toLowerCase();
        const multiAudioKeywords = ["multi", "dual", "hindi", "tamil", "telugu", "bengali", "malayalam", "kannada", "marathi", "punjabi"];
        if (multiAudioKeywords.some(keyword => searchPool.includes(keyword))) {
          displayLang = "Multi-Audio";
        }

        let normQual = String(qualityLabel).toLowerCase().replace(/p/g, "") + "p";
        if (searchPool.includes("2160p") || searchPool.includes("4k") || searchPool.includes("uhd")) normQual = "2160p";
        else if (searchPool.includes("1080p")) normQual = "1080p";
        else if (searchPool.includes("720p")) normQual = "720p";

        return {
          name: `Zinkmovies | ${normQual} | ${displayLang}`,
          title: metadata,
          size: metadata,
          description: metadata,
          url: s.url,
          quality: "",
          language: "",
          headers: { Referer: baseUrl, "User-Agent": HEADERS["User-Agent"] },
          subtitles: []
        };
      });
  } catch (e) {
    console.error("[Zinkmovies]", e);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
