"use strict";

const DOMAIN = "https://uhdmovies.rip";
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// --- CORE UTILITIES FROM MOVIESMOD ---

async function makeRequest(url, options = {}) {
  const defaultHeaders = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1"
  };
  const response = await fetch(url, {
    ...options,
    headers: { ...defaultHeaders, ...options.headers }
  });
  return response;
}

// --- SID (UNBLOCKED GAMES) RESOLVER - DIRECT TRANSPLANT ---

async function resolveTechUnblockedLink(sidUrl) {
  try {
    const response = await makeRequest(sidUrl);
    const html = await response.text();
    
    // Step 1: Find initial _wp_http
    const wp_http_step1 = html.match(/name="_wp_http"\s+value="([^"]+)"/)?.[1];
    const action_url_step1 = html.match(/id="landing"\s+action="([^"]+)"/)?.[1];
    if (!wp_http_step1 || !action_url_step1) return null;

    const step1Data = new URLSearchParams({ "_wp_http": wp_http_step1 });
    const responseStep1 = await makeRequest(action_url_step1, {
      method: "POST",
      headers: { "Referer": sidUrl, "Content-Type": "application/x-www-form-urlencoded" },
      body: step1Data.toString()
    });

    const html2 = await responseStep1.text();
    
    // Step 2: Find _wp_http2 and token
    const action_url_step2 = html2.match(/id="landing"\s+action="([^"]+)"/)?.[1];
    const wp_http2 = html2.match(/name="_wp_http2"\s+value="([^"]+)"/)?.[1];
    const token = html2.match(/name="token"\s+value="([^"]+)"/)?.[1];
    if (!action_url_step2) return null;

    const step2Data = new URLSearchParams({ "_wp_http2": wp_http2 || "", "token": token || "" });
    const responseStep2 = await makeRequest(action_url_step2, {
      method: "POST",
      headers: { "Referer": responseStep1.url, "Content-Type": "application/x-www-form-urlencoded" },
      body: step2Data.toString()
    });

    const finalHtml = await responseStep2.text();
    
    // Step 3: The dynamic cookie bypass
    let finalLinkPath = null, cookieName = null, cookieValue = null;
    const cookieMatch = finalHtml.match(/s_343\('([^']+)',\s*'([^']+)'/);
    const linkMatch = finalHtml.match(/c\.setAttribute\("href",\s*"([^"]+)"\)/);

    if (cookieMatch) {
      cookieName = cookieMatch[1].trim();
      cookieValue = cookieMatch[2].trim();
    }
    if (linkMatch) finalLinkPath = linkMatch[1].trim();

    if (!finalLinkPath || !cookieName || !cookieValue) return null;

    const { origin } = new URL(sidUrl);
    const finalUrl = new URL(finalLinkPath, origin).href;
    
    const finalResponse = await makeRequest(finalUrl, {
      headers: { "Referer": responseStep2.url, "Cookie": `${cookieName}=${cookieValue}` }
    });

    const metaHtml = await finalResponse.text();
    const metaRefresh = metaHtml.match(/url=(.*)/i);
    return metaRefresh ? metaRefresh[1].replace(/"/g, "").replace(/'/g, "").trim() : null;
  } catch (error) {
    return null;
  }
}

// --- DRIVESEED RESOLVER - DIRECT TRANSPLANT ---

async function resolveDriveseedLink(driveseedUrl) {
  try {
    const response = await makeRequest(driveseedUrl, { headers: { "Referer": DOMAIN } });
    const html = await response.text();
    const redirectMatch = html.match(/window\.location\.replace\("([^"]+)"\)/);
    
    if (redirectMatch && redirectMatch[1]) {
      const finalUrl = `https://driveseed.org${redirectMatch[1]}`;
      const finalResponse = await makeRequest(finalUrl, { headers: { "Referer": driveseedUrl } });
      const finalHtml = await finalResponse.text();

      // Priority 1: Instant Download
      const instantMatch = finalHtml.match(/href="([^"]+)"[^>]*>Instant Download/i);
      if (instantMatch) return instantMatch[1];

      // Priority 2: Resume Cloud (Requires second hop)
      const resumeMatch = finalHtml.match(/href="([^"]+)"[^>]*>Resume Cloud/i);
      if (resumeMatch) {
        const resumeUrl = `https://driveseed.org${resumeMatch[1]}`;
        const resHtml = await (await makeRequest(resumeUrl, { headers: { "Referer": "https://driveseed.org/" } })).text();
        const cloudLink = resHtml.match(/href="([^"]+)"[^>]*>Cloud Resume Download/i);
        if (cloudLink) return cloudLink[1];
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

// --- MAIN SEARCH & FLOW ---

async function getStreams(tmdbId, mediaType, season, episode) {
  const streams = [];
  try {
    const isSeries = mediaType === "tv" || mediaType === "series";
    const tmdbUrl = `${TMDB_API}/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const tmdbData = await (await fetch(tmdbUrl)).json();
    
    const title = isSeries ? tmdbData.name : tmdbData.title;
    const year = (isSeries ? tmdbData.first_air_date : tmdbData.release_date || "").slice(0, 4);
    const searchQuery = `${title} ${year}`.trim();

    const searchHtml = await (await makeRequest(`${DOMAIN}/?s=${encodeURIComponent(searchQuery)}`)).text();
    
    // Extract Post URL
    const articleMatch = searchHtml.match(/href="([^"]+)"[^>]*class="[^"]*gridlove-post/i) || searchHtml.match(/<h1[^>]*class="sanket[^>]*><a href="([^"]+)"/i);
    if (!articleMatch) return [];

    const pageHtml = await (await makeRequest(articleMatch[1])).text();
    const btnRegex = /href="([^"]+)"[^>]*class="[^"]*maxbutton-1/gi;
    let match;
    
    while ((match = btnRegex.exec(pageHtml)) !== null) {
      let url = match[1];

      // 1. Handle modrefer (atob) if present
      if (url.includes("modrefer.in")) {
        const encoded = new URL(url).searchParams.get("url");
        if (encoded) url = atob(encoded);
      }

      // 2. Resolve SID (UnblockedGames/CreativeExpressions)
      if (url.includes("unblockedgames") || url.includes("creativeexpressions") || url.includes("tech.examzculture")) {
        url = await resolveTechUnblockedLink(url);
      }

      // 3. Resolve Driveseed
      if (url && (url.includes("driveseed") || url.includes("driveleech"))) {
        const finalUrl = await resolveDriveseedLink(url);
        if (finalUrl) {
          streams.push({
            name: "UHDMovies",
            title: title + (isSeries ? ` S${season}E${episode}` : ""),
            url: finalUrl,
            quality: "HD",
            headers: { "Referer": "https://driveseed.org/", "User-Agent": USER_AGENT }
          });
        }
      }
    }
  } catch (e) {
    console.error("[UHDMovies] Error: " + e.message);
  }
  return streams;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
