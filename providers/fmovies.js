"use strict";

/**
 * 4KHDHub - Restored Fetching with UHDMovies Resolution Logic
 */

var DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
var DEFAULT_MAIN_URL = "https://4khdhub.dad";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

// --- UHDMovies Quality Logic (Plugged In) ---

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
  var sScore = 0;
  if (/remux/i.test(q)) sScore = 5;
  else if (/blu.?ray/i.test(q)) sScore = 4;
  return (rScore * 10) + sScore;
}

// --- Original 4KHDHub Fetching Logic ---

async function getMainUrl() {
  try {
    const res = await fetch(DOMAINS_URL);
    const domains = await res.json();
    return domains["4khdhub"] || domains.n4khdhub || DEFAULT_MAIN_URL;
  } catch (e) { return DEFAULT_MAIN_URL; }
}

function rot13(v) {
  return v.replace(/[a-zA-Z]/g, (c) => String.fromCharCode((c <= 'Z' ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26));
}

async function getRedirectLinks(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    const html = await res.text();
    const match = html.match(/s\('o','([A-Za-z0-9+/=]+)'/);
    if (!match) return "";
    const decoded = JSON.parse(atob(rot13(atob(atob(match[1])))));
    return atob(decoded.o || "").trim();
  } catch (e) { return ""; }
}

async function resolveHubcloud(url, label, referer) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Referer": referer } });
    const html = await res.text();
    const quality = buildQualityLabel(label); // Uses UHDMovies logic
    const streams = [];
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
    const searchRes = await fetch(searchUrl, { headers: { "User-Agent": USER_AGENT } });
    const searchHtml = await searchRes.text();
    
    const postMatch = searchHtml.match(/<div[^>]*class="card-grid"[^>]*>[\s\S]*?<a\s[^>]*href="([^"]+)"/i);
    if (!postMatch) return [];
    
    const postUrl = postMatch[1];
    const postRes = await fetch(postUrl, { headers: { "User-Agent": USER_AGENT } });
    const postHtml = await postRes.text();
    const isSeries = mediaType === "tv" || mediaType === "series";
    
    const linkRe = /<a[^>]*href="([^"]+(?:hubcloud|id=)[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let lm;
    let allStreams = [];

    while ((lm = linkRe.exec(postHtml)) !== null) {
      const href = lm[1];
      const text = lm[2].replace(/<[^>]+>/g, "").trim();

      if (isSeries) {
        if (!text.includes(`Episode-${episode}`)) continue;
      }

      let target = href;
      if (target.includes("id=")) {
        target = await getRedirectLinks(target);
      }
      
      if (target.includes("hubcloud")) {
        const res = await resolveHubcloud(target, text, postUrl);
        allStreams = allStreams.concat(res);
      }
    }

    return allStreams.sort((a, b) => scoreStream(b) - scoreStream(a));
  } catch (e) {
    return [];
  }
}

module.exports = { getStreams };
