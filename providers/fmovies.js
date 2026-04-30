"use strict";

/**
 * FourKHDHub - UHDMovies Resolution Logic Integration
 * This version uses the exact UHDMovies quality scoring and labeling
 * while keeping the FourKHDHub fetching structure intact.
 */

var DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
var DEFAULT_MAIN_URL = "https://4khdhub.dad";
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
};

// --- START UHDMOVIES RESOLUTION LOGIC ---

function getIndexQuality(str) {
  if (!str) return "Unknown";
  var m = str.match(/(\d{3,4})[pP]/);
  if (m) return m[1] + "p";
  if (/\b4[kK]\b/.test(str) || /\bUHD\b(?!movies)/i.test(str)) return "2160p";
  return "Unknown";
}

function buildQualityLabel(str) {
  var resolution = getIndexQuality(str);
  var label = resolution === "2160p" ? "4K" : resolution;
  var fuente = null;
  if (/remux/i.test(str)) fuente = "BluRay REMUX";
  else if (/blu.?ray|bluray/i.test(str)) fuente = "BluRay";
  else if (/web.?dl/i.test(str)) fuente = "WEB-DL";
  else if (/webrip/i.test(str)) fuente = "WEBRip";

  var codec = null;
  if (/\bHEVC\b|\bx265\b|\bH\.?265\b/i.test(str)) codec = "x265/HEVC";
  else if (/\bAVC\b|\bx264\b|\bH\.?264\b/i.test(str)) codec = "x264/AVC";
  
  return [label, fuente, codec].filter(Boolean).join(" | ");
}

function scoreStream(s) {
  var q = s.quality || "";
  var rScore = 0;
  if (/^4K|2160p/i.test(q)) rScore = 4;
  else if (/1080p/i.test(q)) rScore = 3;
  else if (/720p/i.test(q)) rScore = 2;
  else if (/480p/i.test(q)) rScore = 1;
  
  var sScore = 0;
  if (/remux/i.test(q)) sScore = 5;
  else if (/blu.?ray/i.test(q)) sScore = 4;
  else if (/web.?dl/i.test(q)) sScore = 3;
  return rScore * 10 + sScore;
}

// --- END UHDMOVIES RESOLUTION LOGIC ---

async function getMainUrl() {
  try {
    const res = await fetch(DOMAINS_URL);
    const domains = await res.json();
    return domains["4khdhub"] || domains.n4khdhub || DEFAULT_MAIN_URL;
  } catch (e) { return DEFAULT_MAIN_URL; }
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...HEADERS, ...options.headers }
  });
  return await response.text();
}

function rot13(v) {
  return v.replace(/[a-zA-Z]/g, (c) => String.fromCharCode((c <= 'Z' ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26));
}

async function getRedirectLinks(url) {
  try {
    const html = await fetchText(url);
    const match = html.match(/s\('o','([A-Za-z0-9+/=]+)'/);
    if (!match) return "";
    const decoded = JSON.parse(atob(rot13(atob(atob(match[1])))));
    return atob(decoded.o || "").trim();
  } catch (e) { return ""; }
}

async function resolveHubcloud(url, sourceTitle, referer) {
  try {
    const html = await fetchText(url, { headers: { Referer: referer } });
    const streams = [];
    const quality = buildQualityLabel(sourceTitle); // Use template logic
    
    const linkMatch = html.matchAll(/<a[^>]*class="[^"]*btn[^"]*"[^>]*href="([^"]+)"/gi);
    for (const match of linkMatch) {
      const link = match[1];
      if (link && !link.includes("javascript")) {
        streams.push({
          name: "4KHDHub",
          title: `Source | ${quality}`,
          url: link + (link.includes("#") ? "" : "#.mkv"),
          quality: quality
        });
      }
    }
    return streams;
  } catch (e) { return []; }
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    const mainUrl = await getMainUrl();
    const searchUrl = `${mainUrl}/?s=${tmdbId}`;
    const searchHtml = await fetchText(searchUrl);
    
    const postMatch = searchHtml.match(/<div[^>]*class="card-grid"[^>]*>[\s\S]*?<a\s[^>]*href="([^"]+)"/i);
    if (!postMatch) return [];
    
    const postHtml = await fetchText(postMatch[1]);
    const isSeries = mediaType === "tv" || mediaType === "series";
    const links = [];

    const linkRe = /<a[^>]*href="([^"]+(?:hubcloud|id=)[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let lm;
    while ((lm = linkRe.exec(postHtml)) !== null) {
      const text = lm[2].replace(/<[^>]+>/g, "");
      if (isSeries) {
        if (text.includes(`Episode-${episode}`)) links.push({ url: lm[1], label: text });
      } else {
        links.push({ url: lm[1], label: text });
      }
    }

    let allStreams = [];
    for (const item of links) {
      let target = item.url;
      if (target.includes("id=")) target = await getRedirectLinks(target);
      if (target.includes("hubcloud")) {
        const res = await resolveHubcloud(target, item.label, postMatch[1]);
        allStreams = allStreams.concat(res);
      }
    }

    return allStreams.sort((a, b) => scoreStream(b) - scoreStream(a));
  } catch (e) { return []; }
}

module.exports = { getStreams };
