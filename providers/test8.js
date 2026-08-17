const BASE_URL = "https://movix.bet";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/html, */*",
  "Referer": `${BASE_URL}/`
};

/**
 * Scrapes movix.bet for streaming links.
 * @param {Object} params - Query details (title, year, type, season, episode, tmdbId, imdbId)
 */
async function getStreams(params) {
  const { title, year, type, season, episode } = params;
  const streams = [];

  try {
    // 1. Search Movix for the title
    const searchEndpoint = `${BASE_URL}/api/search?q=${encodeURIComponent(title)}`;
    let targetPath = "";

    try {
      const searchRes = await fetch(searchEndpoint, { headers: HEADERS });
      if (searchRes.ok) {
        const data = await searchRes.json();
        const results = Array.isArray(data) ? data : (data.results || []);
        const match = results.find(item => 
          (item.title || item.name || "").toLowerCase() === title.toLowerCase() ||
          (year && item.release_date && item.release_date.startsWith(year.toString()))
        ) || results[0];

        if (match) {
          targetPath = match.slug || match.path || `/${type}/${match.id}`;
        }
      }
    } catch {
      // Fallback to HTML search page if JSON API is not returned
      const searchHtmlRes = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(title)}`, { headers: HEADERS });
      const htmlText = await searchHtmlRes.text();
      const hrefMatch = htmlText.match(/href="(\/(movie|tv|watch)\/[^"]+)"/i);
      if (hrefMatch) {
        targetPath = hrefMatch[1];
      }
    }

    if (!targetPath) {
      console.warn(`[Movix] No title matching "${title}" found.`);
      return [];
    }

    // 2. Build full target URL (with episode formatting for TV shows)
    let watchUrl = targetPath.startsWith("http") ? targetPath : `${BASE_URL}${targetPath}`;
    if (type === "tv" && season && episode) {
      watchUrl = `${watchUrl.replace(/\/$/, "")}/season/${season}/episode/${episode}`;
    }

    // 3. Fetch video player page
    const pageRes = await fetch(watchUrl, { headers: HEADERS });
    const pageHtml = await pageRes.text();

    // 4. Extract direct .m3u8, .mp4, or iframe player sources
    const streamRegex = /(https?:\/\/[^\s"'<>]+\.(m3u8|mp4)[^\s"'<>]*)/gi;
    const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
    
    let match;
    const foundUrls = new Set();

    // Match direct video files
    while ((match = streamRegex.exec(pageHtml)) !== null) {
      foundUrls.add(match[1]);
    }

    // Match embedded stream sources if direct video URLs aren't in HTML root
    while ((match = iframeRegex.exec(pageHtml)) !== null) {
      const embedUrl = match[1].startsWith("//") ? `https:${match[1]}` : match[1];
      foundUrls.add(embedUrl);
    }

    // 5. Structure discovered links into Nuvio stream items
    for (const url of foundUrls) {
      const isHls = url.includes(".m3u8");
      streams.push({
        name: isHls ? "Movix (HLS)" : "Movix (Auto)",
        url: url,
        quality: "Auto",
        format: isHls ? "m3u8" : "mp4",
        headers: {
          "Referer": `${BASE_URL}/`,
          "User-Agent": HEADERS["User-Agent"]
        }
      });
    }

    return streams;
  } catch (error) {
    console.error("[Movix Provider Error]:", error);
    return [];
  }
}

module.exports = { getStreams };
