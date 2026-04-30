/**
 * FourKHDHub - Final Fixed Version
 * Restored fetching logic + Fixed Resolution & UI Labels
 */

// ... (Keep all your original __create, __defProp, __async, etc. boilerplate here)

// src/FourKHDHub/extractor.js
var PROVIDER_NAME = "FourKHDHub";
var REDIRECT_REGEX = /s\('o','([A-Za-z0-9+/=]+)'|ck\('_wp_http_\d+','([^']+)'/g;

// 1. FIXED QUALITY PARSER (Matches the screenshot data)
function parseQuality(text) {
  const value = (text || "").toLowerCase();
  if (/2160p|4k|uhd/i.test(value)) return "4K";
  if (/1440p/i.test(value)) return "1440p";
  if (/1080p/i.test(value)) return "1080p";
  if (/720p/i.test(value)) return "720p";
  if (/480p/i.test(value)) return "480p";
  return "HD"; 
}

// 2. NEATENED UI LABELS
function buildDisplayMeta(sourceTitle = "", url = "") {
  const v = sourceTitle.toLowerCase();
  
  // Logic for Language
  let lang = "Multi";
  if (/\btr\b|turkce|türkçe/.test(v)) lang = "TR";
  else if (/\ben\b|english/.test(v)) lang = "EN";
  else if (v.includes("dual")) lang = "Dual Audio";
  else if (v.includes("dublaj") || v.includes("dubbed")) lang = "Dubbed";

  // Logic for Quality
  const quality = parseQuality(sourceTitle);

  return {
    displayName: `${PROVIDER_NAME} • ${lang} • ${quality}`,
    displayTitle: `${quality} • ${lang}`
  };
}

// 3. REFACTORED HUBCLOUD (Ensures Quality is passed to the UI)
async function resolveHubcloud(url, sourceTitle, referer) {
  const baseHeaders = referer ? { Referer: referer } : {};
  let entryUrl = url;

  if (!/hubcloud\.php/i.test(url)) {
    const html2 = await fetchText(url, { headers: baseHeaders });
    const $2 = import_cheerio_without_node_native2.default.load(html2);
    const raw = $2("#download").attr("href");
    if (!raw) return [];
    entryUrl = fixUrl(raw, url);
  }

  const html = await fetchText(entryUrl, { headers: { Referer: url, ...baseHeaders } });
  const $ = import_cheerio_without_node_native2.default.load(html);
  
  const size = $("i#size").first().text().trim();
  const header = $("div.card-header").first().text().trim();
  const quality = parseQuality(header);
  const details = cleanFileDetails(header);
  const extraInfo = [details, size].filter(Boolean).join(" | ");

  const streams = [];
  $("a.btn[href]").each((_, el) => {
    const link = fixUrl($(el).attr("href"), entryUrl);
    if (!link) return;

    const meta = buildDisplayMeta(header, link);

    streams.push({
      name: meta.displayName,
      // Removes "Download HubCloud" and shows clean info like [HDR DOLBYVISION | 48GB]
      title: `[${extraInfo}]`, 
      url: link,
      quality: quality, // CRITICAL: This fixes the badge in your UI
      headers: { Referer: entryUrl }
    });
  });
  return streams;
}

// 4. FIXED RESOLVE LINK (Ensures it returns the array to extractStreams)
async function resolveLink(rawUrl, sourceTitle, referer = "") {
  let url = rawUrl;
  if (!url) return [];
  
  if (url.includes("id=")) {
    const redirected = await getRedirectLinks(url);
    if (redirected) url = redirected;
  }

  const lower = url.toLowerCase();
  try {
    if (/\.(m3u8|mp4|mkv)(\?|$)/i.test(url)) {
      const q = parseQuality(sourceTitle);
      const meta = buildDisplayMeta(sourceTitle, url);
      return [{
        name: meta.displayName,
        title: meta.displayTitle,
        url: url,
        quality: q,
        headers: referer ? { Referer: referer } : {}
      }];
    }
    if (lower.includes("hubcloud")) {
      return await resolveHubcloud(url, sourceTitle, referer);
    }
    if (lower.includes("hubdrive")) {
      const html = await fetchText(url);
      const $ = import_cheerio_without_node_native2.default.load(html);
      const href = $("a.btn-success1").attr("href");
      if (href) return await resolveLink(fixUrl(href, url), sourceTitle, url);
    }
    if (lower.includes("pixeldrain")) {
      const q = parseQuality(sourceTitle);
      const meta = buildDisplayMeta(sourceTitle, url);
      return [{
        name: meta.displayName,
        title: `Pixeldrain • ${meta.displayTitle}`,
        url: url.includes("/api/file/") ? url : url.replace("/u/", "/api/file/") + "?download",
        quality: q,
        headers: referer ? { Referer: referer } : {}
      }];
    }
  } catch (error) {
    console.error(`[${PROVIDER_NAME}] Error: ${error.message}`);
  }
  return [];
}

// ... (Keep your original dedupeStreams, searchContent, and extractStreams as they were)
