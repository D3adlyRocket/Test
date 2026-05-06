"use strict";

const DOMAIN = "https://uhdmovies.rip";
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// --- Utility Helpers ---

function getBaseUrl(url) {
  if (!url) return DOMAIN;
  var match = url.match(/^(https?:\/\/[^\/]+)/);
  return match ? match[1] : DOMAIN;
}

function fixUrl(url, domain) {
  if (!url) return "";
  if (url.indexOf("http") === 0) return url;
  if (url.indexOf("//") === 0) return "https:" + url;
  if (url.indexOf("/") === 0) return domain + url;
  return domain + "/" + url;
}

function stripTags(html) {
  return (html || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();
}

async function fetchText(url, options = {}) {
  const headers = Object.assign({ "User-Agent": USER_AGENT }, options.headers || {});
  const res = await fetch(url, { ...options, headers });
  return res.text();
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  return res.json();
}

// --- Quality & Title Parsing ---

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

// --- Bypasser: SID / UnblockedGames ---

async function bypassSid(url) {
  console.log("[UHDMovies] Bypassing SID: " + url);
  try {
    const html = await fetchText(url);
    const step1Match = html.match(/name="_wp_http"\s+value="([^"]+)"/);
    const actionMatch = html.match(/id="landing"\s+action="([^"]+)"/);

    if (!step1Match || !actionMatch) return null;

    const body1 = new URLSearchParams({ "_wp_http": step1Match[1] });
    const res2 = await fetch(actionMatch[1], {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Referer": url },
      body: body1.toString()
    });
    
    const html2 = await res2.text();
    const action2Match = html2.match(/id="landing"\s+action="([^"]+)"/);
    const tokenMatch = html2.match(/name="token"\s+value="([^"]+)"/);
    const wp2Match = html2.match(/name="_wp_http2"\s+value="([^"]+)"/);

    if (!action2Match) return null;

    const body2 = new URLSearchParams({ "_wp_http2": wp2Match ? wp2Match[1] : "", "token": tokenMatch ? tokenMatch[1] : "" });
    const res3 = await fetch(action2Match[1], {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Referer": res2.url },
      body: body2.toString()
    });

    const finalHtml = await res3.text();
    // Extract dynamic cookie and go link
    const cookieMatch = finalHtml.match(/s_343\('([^']+)',\s*'([^']+)'/);
    const linkMatch = finalHtml.match(/c\.setAttribute\("href",\s*"([^"]+)"\)/);

    if (!cookieMatch || !linkMatch) return null;

    const origin = getBaseUrl(url);
    const finalGoUrl = fixUrl(linkMatch[1], origin);
    
    const res4 = await fetch(finalGoUrl, {
      headers: { "Referer": res3.url, "Cookie": `${cookieMatch[1]}=${cookieMatch[2]}` }
    });

    const metaHtml = await res4.text();
    const metaRefresh = metaHtml.match(/url=(.*)"/i);
    return metaRefresh ? metaRefresh[1].replace(/"/g, "").trim() : null;
  } catch (e) {
    console.error("[UHDMovies] SID error: " + e.message);
    return null;
  }
}

// --- Driveseed Resolver ---

async function resolveDriveseed(url) {
  console.log("[UHDMovies] Resolving Driveseed: " + url);
  try {
    const html = await fetchText(url);
    const redirectMatch = html.match(/replace\("([^"]+)"\)/);
    const driveUrl = redirectMatch ? fixUrl(redirectMatch[1], getBaseUrl(url)) : url;

    const finalHtml = await fetchText(driveUrl);
    
    // Extract file details
    const nameMatch = finalHtml.match(/Name\s*:\s*([^<]+)/i);
    const sizeMatch = finalHtml.match(/Size\s*:\s*([^<]+)/i);
    
    // Extraction of sub-links (Instant, Resume Bot, etc.)
    const links = [];
    const aRegex = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = aRegex.exec(finalHtml)) !== null) {
      const href = match[1];
      const text = stripTags(match[2]).toLowerCase();
      
      if (text.includes("instant download") || text.includes("resume worker") || text.includes("direct links")) {
        links.push({ url: fixUrl(href, getBaseUrl(driveUrl)), type: text });
      }
    }
    
    return { links, name: nameMatch ? nameMatch[1].trim() : "Unknown", size: sizeMatch ? sizeMatch[1].trim() : "" };
  } catch (e) {
    return null;
  }
}

// --- Core Search & Logic ---

async function getStreams(tmdbId, mediaType, season, episode) {
  const allStreams = [];
  try {
    const isSeries = mediaType === "series" || mediaType === "tv";
    const tmdbData = await fetchJson(`${TMDB_API}/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`);
    const title = isSeries ? tmdbData.name : tmdbData.title;
    const year = (isSeries ? tmdbData.first_air_date : tmdbData.release_date || "").slice(0, 4);

    const searchUrl = `${DOMAIN}/?s=${encodeURIComponent(title + " " + year)}`;
    const searchHtml = await fetchText(searchUrl);
    
    // Parse Search Results
    const results = [];
    const chunks = searchHtml.split(/<article\b/i);
    for (let i = 1; i < chunks.length; i++) {
      const linkM = chunks[i].match(/href="([^"]+)"/);
      const titleM = chunks[i].match(/class="sanket[^>]*>([\s\S]*?)<\/h1>/);
      if (linkM && titleM) results.push({ url: linkM[1], title: stripTags(titleM[1]) });
    }

    for (const res of results) {
      const pageHtml = await fetchText(res.url);
      const links = [];
      
      // Basic link extraction (simplified for this update)
      const btnRegex = /<a[^>]*maxbutton-1[^>]*href="([^"]+)"/gi;
      let m;
      while ((m = btnRegex.exec(pageHtml)) !== null) {
        links.push(m[1]);
      }

      for (let link of links) {
        // Step 1: Bypass SID if needed
        if (link.includes("unblockedgames") || link.includes("creativeexpressionsblog")) {
          link = await bypassSid(link);
        }

        if (link && (link.includes("driveseed") || link.includes("driveleech"))) {
          const driveData = await resolveDriveseed(link);
          if (driveData && driveData.links.length > 0) {
            // Pick the first available (usually Instant or Direct)
            const target = driveData.links[0];
            allStreams.push({
              name: "UHDMovies",
              title: `${driveData.name}\n${driveData.size}`,
              url: target.url,
              quality: buildQualityLabel(driveData.name)
            });
          }
        }
      }
    }
  } catch (err) {
    console.error("[UHDMovies] Main error: " + err.message);
  }
  return allStreams;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
