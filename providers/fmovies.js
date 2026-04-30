/**
 * FourKHDHub - Rebuilt & Fixed (Nuvio Compatible)
 */

const cheerio = require("cheerio-without-node-native");

const PROVIDER_NAME = "FourKHDHub";
const MAIN_URL = "https://4khdhub.dad";

const HEADERS = {
  "User-Agent": "Mozilla/5.0",
  "Accept-Language": "en-US,en;q=0.9"
};

// ---------------- QUALITY FIX ----------------
function parseQuality(text = "") {
  const value = text.toLowerCase();

  if (/2160p|4k|uhd/.test(value)) return "2160p";
  if (/1440p|2k/.test(value)) return "1440p";
  if (/1080p|fullhd|fhd/.test(value)) return "1080p";
  if (/720p|hd/.test(value)) return "720p";
  if (/480p/.test(value)) return "480p";

  return "Unknown";
}

// ---------------- STREAM BUILDER ----------------
function buildStream(title, url, headers = {}) {
  const quality = parseQuality(title + " " + url);

  if (!/\.(m3u8|mp4|mkv)/i.test(url)) {
    url += "#.mkv";
  }

  return {
    name: PROVIDER_NAME,
    title: title,
    url,
    quality,
    headers: Object.keys(headers).length ? headers : undefined
  };
}

// ---------------- FETCH ----------------
async function fetchText(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error("Fetch failed");
  return res.text();
}

// ---------------- TMDB TITLE ----------------
async function getTitle(tmdbId, type) {
  try {
    const url = `https://www.themoviedb.org/${type}/${tmdbId}`;
    const html = await fetchText(url);

    const match = html.match(/<title>([^<]+)</);
    if (!match) return "";

    return match[1].split("(")[0].trim();
  } catch {
    return "";
  }
}

// ---------------- SEARCH ----------------
async function search(query) {
  const html = await fetchText(`${MAIN_URL}/?s=${encodeURIComponent(query)}`);
  const $ = cheerio.load(html);

  let result = null;

  $("div.card-grid a").each((_, el) => {
    const href = $(el).attr("href");
    const title = $(el).text().trim();

    if (title.toLowerCase().includes(query.toLowerCase()) && !result) {
      result = href;
    }
  });

  return result;
}

// ---------------- EXTRACT LINKS ----------------
function extractLinks(html, baseUrl) {
  const $ = cheerio.load(html);
  const links = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");

    if (!href) return;

    if (/hubcloud|hubdrive|pixeldrain|\.mkv|\.mp4|\.m3u8/i.test(href)) {
      links.push({
        url: href.startsWith("http") ? href : baseUrl + href,
        label: $(el).text().trim()
      });
    }
  });

  return links;
}

// ---------------- RESOLVER ----------------
async function resolve(url, label, referer) {
  try {
    // direct file
    if (/\.(m3u8|mp4|mkv)/i.test(url)) {
      return [buildStream(label, url, { Referer: referer })];
    }

    // pixeldrain
    if (url.includes("pixeldrain")) {
      return [buildStream(label, url, { Referer: referer })];
    }

    // hubcloud (basic)
    if (url.includes("hubcloud")) {
      const html = await fetchText(url);
      const $ = cheerio.load(html);

      const header = $("div.card-header").text();
      const size = $("#size").text();

      const quality = parseQuality(header + " " + size);

      const out = [];

      $("a.btn").each((_, el) => {
        const link = $(el).attr("href");
        if (link) {
          out.push({
            ...buildStream(label, link, { Referer: url }),
            quality
          });
        }
      });

      return out;
    }

  } catch (e) {}

  return [];
}

// ---------------- MAIN EXTRACT ----------------
async function extractStreams(tmdbId, type, season, episode) {
  const title = await getTitle(tmdbId, type === "movie" ? "movie" : "tv");

  if (!title) return [];

  const page = await search(title);
  if (!page) return [];

  const html = await fetchText(page);
  const links = extractLinks(html, page);

  let streams = [];

  for (const l of links) {
    const resolved = await resolve(l.url, l.label || title, page);
    streams.push(...resolved);
  }

  return streams;
}

// ---------------- EXPORT (NUVIO REQUIRED) ----------------
async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    return await extractStreams(tmdbId, mediaType, season, episode);
  } catch (e) {
    return [];
  }
}

module.exports = { getStreams };
