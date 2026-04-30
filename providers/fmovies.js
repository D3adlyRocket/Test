/**
 * 4khdhub - Fixed & Merged
 * Built on the working 2nd code engine with 1st code's UI details.
 */
"use strict";

const cheerio = require("cheerio-without-node-native");

// Settings from 2nd code (Working)
const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const DEFAULT_MAIN_URL = "https://4khdhub.dad";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9"
};

// --- Logic Helpers ---

function rot13(str) {
  return str.replace(/[a-zA-Z]/g, (c) => String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26));
}

async function getMainUrl() {
  try {
    const res = await fetch(DOMAINS_URL, { headers: HEADERS });
    const domains = await res.json();
    return domains["4khdhub"] || domains.n4khdhub || DEFAULT_MAIN_URL;
  } catch (e) { return DEFAULT_MAIN_URL; }
}

async function resolveRedirect(url) {
  try {
    const html = await (await fetch(url, { headers: HEADERS, redirect: "follow" })).text();
    const match = html.match(/'o','([A-Za-z0-9+/=]+)'/);
    if (!match) return null;
    // Step-by-step decoding from the working code
    const decoded = JSON.parse(atob(rot13(atob(atob(match[1])))));
    return atob(decoded.o);
  } catch (e) { return null; }
}

// --- Main Function ---

async function getStreams(tmdbId, mediaType, season, episode) {
  const isSeries = mediaType === "series" || mediaType === "tv";
  const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? "tv" : "movie"}/${tmdbId}?api_key=439c478a771f35c05022f9feabcca01c`;
  
  const info = await (await fetch(tmdbUrl)).json();
  const title = info.name || info.title;
  const year = (info.first_air_date || info.release_date || "").split("-")[0];

  const domain = await getMainUrl();
  const searchUrl = `${domain}/?s=${encodeURIComponent(title)}`;
  
  const searchHtml = await (await fetch(searchUrl, { headers: HEADERS })).text();
  const $ = cheerio.load(searchHtml);
  
  let pageUrl = null;
  // Use the search matching logic that works in 2026
  $("div.card-grid a, .movie-card").each((_, el) => {
    const href = $(el).attr("href");
    const cardTitle = $(el).text().toLowerCase();
    if (cardTitle.includes(title.toLowerCase()) && cardTitle.includes(year)) {
      pageUrl = href.startsWith("http") ? href : domain + href;
      return false;
    }
  });

  if (!pageUrl) return [];

  const pageHtml = await (await fetch(pageUrl, { headers: HEADERS })).text();
  const $p = cheerio.load(pageHtml);
  const results = [];

  // Identify target items (Logic from working 2nd code)
  let items = [];
  if (isSeries) {
    const sStr = "S" + String(season).padStart(2, "0");
    const eStr = "Episode-" + String(episode).padStart(2, "0");
    $p(".episode-item").each((_, el) => {
      if ($p(el).find(".episode-title, .episode-number").text().includes(sStr)) {
        $p(el).find(".episode-download-item").each((_, item) => {
          if ($p(item).text().includes(eStr)) items.push(item);
        });
      }
    });
  } else {
    $p(".download-item").each((_, el) => items.push(el));
  }

  // Extract and Resolve (Adding the 1st code's resolution/size formatting)
  for (const item of items) {
    const itemText = $p(item).text();
    
    // Resolution check (from 1st code)
    let resolution = "HD";
    if (itemText.includes("2160p") || itemText.includes("4K")) resolution = "2160p";
    else if (itemText.includes("1080p")) resolution = "1080p";
    else if (itemText.includes("720p")) resolution = "720p";

    // Size check (from 1st code)
    const sizeMatch = itemText.match(/([\d.]+ ?[GM]B)/);
    const size = sizeMatch ? sizeMatch[0] : "";

    const links = $p(item).find("a");
    for (let i = 0; i < links.length; i++) {
      const a = links[i];
      const btnText = $p(a).text();
      const href = $p(a).attr("href");

      if (href && (btnText.includes("HubCloud") || btnText.includes("Instant"))) {
        const streamUrl = await resolveRedirect(href);
        if (streamUrl) {
          results.push({
            name: `4KHDHub - ${resolution}`,
            title: `${title}\n${btnText} | ${size} | ${resolution}`,
            url: streamUrl,
            quality: resolution,
            behaviorHints: { bingeGroup: `4khd-${tmdbId}` }
          });
        }
      }
    }
  }

  return results;
}

module.exports = { getStreams };
