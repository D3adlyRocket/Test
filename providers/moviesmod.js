// movies4u.js
// Fixed Nuvio-compatible Movies4u provider (Supports 4K, 1080p, 720p Download Links)

const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const FALLBACK_URL = "https://new2.movies4u.style";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Cookie": "xla=s4t"
};

let cachedBaseUrl = null;

// Dynamically gets the active streaming/download domain
async function getBaseUrl() {
  if (cachedBaseUrl) return cachedBaseUrl;
  try {
    const resp = await fetch(DOMAINS_URL, { skipSizeCheck: true });
    const data = await resp.json();
    cachedBaseUrl = data.movies4u || data.movies4u_style || FALLBACK_URL;
  } catch (e) {
    cachedBaseUrl = FALLBACK_URL;
  }
  return cachedBaseUrl;
}

// Parses titles and URLs to extract stream quality resolutions
function extractQuality(url, text = "") {
  const combined = `${url || ""} ${text || ""}`.toLowerCase();
  if (combined.includes("2160") || combined.includes("4k") || combined.includes("uhd")) return "4K";
  if (combined.includes("1080")) return "1080p";
  if (combined.includes("720")) return "720p";
  if (combined.includes("480")) return "480p";
  if (combined.includes("360")) return "360p";
  return "Unknown";
}

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  try {
    const BASE_URL = await getBaseUrl();

    // Step 1: Query metadata via TMDB
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // Step 2: Search target site
    const searchResp = await fetch(`${BASE_URL}/?s=${encodeURIComponent(title)}`, {
      headers: HEADERS,
      skipSizeCheck: true
    });
    const searchHtml = await searchResp.text();
    const $ = cheerio.load(searchHtml);

    const results = [];
    $("article").each((i, el) => {
      const a = $(el).find("h3 a, h2 a").first();
      const href = a.attr("href");
      const name = a.text().replace(/\(\d{4}\)/, "").trim();
      if (href && name) results.push({ href, name });
    });

    if (results.length === 0) return [];

    const isMovie = mediaType === "movie" || !mediaType;
    const match = results.find(r =>
      r.name.toLowerCase().includes(title.toLowerCase())
    ) || results[0];

    // Step 3: Parse specific item page for direct multi-quality links
    const pageResp = await fetch(match.href, { headers: HEADERS, skipSizeCheck: true });
    const pageHtml = await pageResp.text();
    const $p = cheerio.load(pageHtml);

    const streams = [];

    if (isMovie) {
      // Movie Handling: Grabs ALL structural download mirrors (GDFlix, HubCloud, etc)
      const downloadLinks = [];
      $p("div.downloads-btns-div a[href]").each((i, el) => {
        const linkHref = $p(el).attr("href");
        const linkText = $p(el).text();
        if (linkHref) {
          downloadLinks.push({ href: linkHref, text: linkText });
        }
      });

      // Iterates through discovered quality/host targets up to 12 variations
      for (const link of downloadLinks.slice(0, 12)) {
        const qualityResolved = extractQuality(link.href, link.text);
        streams.push({
          name: "Movies4u",
          title: `Movies4u - Download Link (${qualityResolved})`,
          quality: qualityResolved,
          url: link.href,
          headers: {
            ...HEADERS,
            Referer: match.href
          },
          subtitles: []
        });
      }
    } else {
      // TV Series Handling: Navigates season blocks down to selective episode indices
      const seasonLinks = [];

      $p("div.download-links-div h4").each((i, el) => {
        const h4Text = $p(el).text();
        const sMatch = h4Text.match(/Season\s*(\d+)/i);
        if (!sMatch) return;
        const sNum = parseInt(sMatch[1]);
        if (season && sNum !== parseInt(season)) return;

        const nextEl = $p(el).next();
        nextEl.find("a[href]").each((j, a) => {
          const href = $p(a).attr("href");
          const label = $p(a).text();
          if (href && !label.toLowerCase().includes("zip")) {
            seasonLinks.push({ href, season: sNum, text: label });
          }
        });
      });

      for (const { href, season: sNum, text: sText } of seasonLinks.slice(0, 5)) {
        try {
          const seasonResp = await fetch(href, { headers: HEADERS, skipSizeCheck: true });
          const seasonHtml = await seasonResp.text();
          const $s = cheerio.load(seasonHtml);

          const epBlocks = $s("h5");
          if (epBlocks.length > 0) {
            $s("h5").each((i, h5) => {
              const epText = $s(h5).text();
              const epMatch = epText.match(/Episodes?:\s*(\d+)/i);
              if (!epMatch) return;
              const epNum = parseInt(epMatch[1]);
              if (episode && epNum !== parseInt(episode)) return;

              const links = [];
              $s(h5).next().find("a[href]").each((j, a) => {
                links.push({ href: $s(a).attr("href"), text: $s(a).text() });
              });

              for (const lnk of links) {
                if (!lnk.href) continue;
                const qualityResolved = extractQuality(lnk.href, lnk.text || sText);
                streams.push({
                  name: "Movies4u",
                  title: `Movies4u - S${sNum}E${epNum} (${qualityResolved})`,
                  quality: qualityResolved,
                  url: lnk.href,
                  headers: {
                    ...HEADERS,
                    Referer: href
                  },
                  subtitles: []
                });
              }
            });
          } else {
            if (!episode || episode === "1") {
              const qualityResolved = extractQuality(href, sText);
              streams.push({
                name: "Movies4u",
                title: `Movies4u - S${sNum} (${qualityResolved})`,
                quality: qualityResolved,
                url: href,
                headers: {
                  ...HEADERS,
                  Referer: match.href
                },
                subtitles: []
              });
            }
          }
        } catch (e) {}
      }
    }

    return streams;
  } catch (e) {
    console.error("[Movies4u Context Error]", e);
    return [];
  }
}

// =======================
// REQUIRED FOR NUVIO
// =======================
module.exports = {
  getStreams
};
