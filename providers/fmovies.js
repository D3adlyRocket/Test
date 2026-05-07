const cheerio = require("cheerio");
const { get } = require("../utils/http");
const { extractVideoUrl, extractIframes } = require("../utils/extractor");

const BASE = "https://cineby.sc";
const SOURCE = "Cineby";

async function search(query, type) {
  try {
    const res = await get(`${BASE}/?s=${encodeURIComponent(query)}`);
    const $ = cheerio.load(res.data);
    const results = [];
    $("article, .item, .film-item").each((_, el) => {
      const title = $(el).find("h2, h3, .title").first().text().trim();
      const link = $(el).find("a").first().attr("href") || "";
      const img = $(el).find("img").attr("src") || "";
      if (title && link) results.push({ title, link, img });
    });
    return results;
  } catch (err) {
    console.error(`[${SOURCE}]:`, err.message);
    return [];
  }
}

async function getStreams(imdbId, type, season, episode) {
  try {
    const res = await get(`${BASE}/?s=${imdbId}`);
    const $ = cheerio.load(res.data);
    const link = $("article a, h2 a").first().attr("href");
    if (!link) return [];
    let targetUrl = link.startsWith("http") ? link : BASE + link;

    if (type === "series" && season && episode) {
      const p = await get(targetUrl);
      const p$ = cheerio.load(p.data);
      const ep = p$(
        `a[href*="temporada-${season}"][href*="episodio-${episode}"]`
      ).first().attr("href");
      if (ep) targetUrl = ep.startsWith("http") ? ep : BASE + ep;
    }

    const iframes = await extractIframes(targetUrl, BASE);
    const streams = [];
    for (const iframe of iframes.slice(0, 4)) {
      const videoUrl = await extractVideoUrl(iframe, targetUrl);
      if (videoUrl) {
        streams.push({
          name: SOURCE,
          title: `📺 ${SOURCE}`,
          url: videoUrl,
        });
      }
    }
    return streams;
  } catch (err) {
    console.error(`[${SOURCE}]:`, err.message);
    return [];
  }
}

async function getCatalog(type, skip = 0) {
  try {
    const page = Math.floor(skip / 20) + 1;
    const section = type === "movie" ? "peliculas" : "series";
    const res = await get(`${BASE}/${section}/page/${page}/`);
    const $ = cheerio.load(res.data);
    const items = [];
    $("article, .item").each((_, el) => {
      const title = $(el).find("h2, h3, .title").first().text().trim();
      const link = $(el).find("a").first().attr("href") || "";
      const img = $(el).find("img").attr("src") || "";
      if (title && link) {
        items.push({
          id: `latam:cineby:${encodeURIComponent(link)}`,
          type,
          name: title,
          poster: img,
          source: SOURCE,
          sourceUrl: link,
        });
      }
    });
    return items;
  } catch (err) {
    console.error(`[${SOURCE}]:`, err.message);
    return [];
  }
}

module.exports = { search, getStreams, getCatalog, SOURCE, BASE };
