// movierulzhd.js
// Movierulzhd - Hindi movies/series provider formatted for Nuvio

const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const FALLBACK_URL = "https://123moviesfree9.cloud";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

let cachedBaseUrl = null;

function getBaseUrl() {
  if (cachedBaseUrl) return Promise.resolve(cachedBaseUrl);
  return fetch(DOMAINS_URL)
    .then(resp => resp.json())
    .then(data => {
      cachedBaseUrl = data.movierulzhd || FALLBACK_URL;
      return cachedBaseUrl;
    })
    .catch(() => {
      cachedBaseUrl = FALLBACK_URL;
      return cachedBaseUrl;
    });
}

function fetchEmbedUrl(baseUrl, post, nume, type) {
  return fetch(`${baseUrl}/wp-admin/admin-ajax.php`, {
    method: "POST",
    headers: {
      ...HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": baseUrl
    },
    body: `action=doo_player_ajax&post=${post}&nume=${nume}&type=${type}`
  })
  .then(resp => resp.json())
  .then(data => {
    const embedUrl = data.embed_url || "";
    const srcMatch = embedUrl.match(/SRC="(https?:[^"]+)"/i);
    if (srcMatch) return srcMatch[1].trim();

    const urlMatch = embedUrl.match(/"(https?[^"]+)"/);
    if (urlMatch) return urlMatch[1].trim();

    return embedUrl.replace(/^"|"$/g, "").trim();
  })
  .catch(() => null);
}

function extractQuality(url) {
  const u = (url || "").toLowerCase();
  if (u.includes("2160p") || u.includes("4k")) return "4K";
  if (u.includes("1080p")) return "1080p";
  if (u.includes("720p")) return "720p";
  if (u.includes("480p")) return "480p";
  if (u.includes("360p")) return "360p";
  return "Unknown";
}

// Main Nuvio function implementation
function getStreams(tmdbId, mediaType, season, episode) {
  return new Promise((resolve, reject) => {
    let BASE_URL = "";
    let title = "";
    const streams = [];

    getBaseUrl()
      .then(url => {
        BASE_URL = url;
        const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        return fetch(tmdbUrl);
      })
      .then(resp => resp.json())
      .then(mediaInfo => {
        title = mediaInfo.title || mediaInfo.name;
        if (!title) throw new Error("Title not found");

        return fetch(`${BASE_URL}/search/${encodeURIComponent(title.replace(/ /g, "-"))}`, { headers: HEADERS });
      })
      .then(resp => resp.text())
      .then(searchHtml => {
        const $ = cheerio.load(searchHtml);
        const results = [];

        $("div.result-item").each((i, el) => {
          const a = $(el).find("div.title > a");
          const href = a.attr("href");
          const name = a.text().replace(/\(\d{4}\)/, "").trim();
          if (href && name) results.push({ href, name });
        });

        if (results.length === 0) throw new Error("No search results");

        const match = results.find(r => r.name.toLowerCase().includes(title.toLowerCase())) || results[0];
        let contentUrl = match.href;

        if (contentUrl.includes("/episodes/") || contentUrl.includes("/seasons/")) {
          const splitKey = contentUrl.includes("/episodes/") ? "/episodes/" : "/seasons/";
          const t = contentUrl.split(splitKey)[1];
          const slug = t.match(/(.+?)-season/)?.[1] || t;
          contentUrl = `${BASE_URL}/tvshows/${slug}`;
        }

        return fetch(contentUrl, { headers: HEADERS });
      })
      .then(pageResp => {
        return pageResp.text().then(pageHtml => ({ pageHtml, finalUrl: pageResp.url }));
      })
      .then(({ pageHtml, finalUrl }) => {
        const $p = cheerio.load(pageHtml);
        const directUrl = new URL(finalUrl).origin;
        const isMovie = mediaType === "movie";

        if (!isMovie && mediaType === "tv") {
          const epLinks = [];
          $p("ul.episodios > li").each((i, el) => {
            const href = $p(el).find("a").attr("href");
            const numText = $p(el).find("div.numerando").text().replace(/ /g, "");
            const parts = numText.split("-");
            const sNum = parseInt(parts[0] || "0");
            const eNum = parseInt(parts[1] || "0");
            if (href) epLinks.push({ href, season: sNum, episode: eNum });
          });

          if (epLinks.length > 0) {
            let targetEp = epLinks.find(ep => ep.season === parseInt(season || 1) && ep.episode === parseInt(episode || 1)) || epLinks[0];
            return fetch(targetEp.href, { headers: HEADERS })
              .then(epResp => epResp.text().then(epHtml => ({ epHtml, epDirectUrl: new URL(epResp.url || targetEp.href).origin })))
              .then(({ epHtml, epDirectUrl }) => {
                const $ep = cheerio.load(epHtml);
                const epItems = [];
                $ep("ul#playeroptionsul > li").each((i, el) => {
                  epItems.push({
                    post: $ep(el).attr("data-post"),
                    nume: $ep(el).attr("data-nume"),
                    type: $ep(el).attr("data-type")
                  });
                });

                const promises = epItems.slice(0, 5)
                  .filter(item => item.post && item.nume && !item.nume.includes("trailer"))
                  .map(item => fetchEmbedUrl(epDirectUrl, item.post, item.nume, item.type));

                return Promise.all(promises);
              });
          }
        }

        // Processing Movie Players
        const playerItems = [];
        $p("ul#playeroptionsul > li").each((i, el) => {
          playerItems.push({
            post: $p(el).attr("data-post"),
            nume: $p(el).attr("data-nume"),
            type: $p(el).attr("data-type")
          });
        });

        const promises = playerItems.slice(0, 5)
          .filter(item => item.post && item.nume && !item.nume.includes("trailer"))
          .map(item => fetchEmbedUrl(directUrl, item.post, item.nume, item.type));

        return Promise.all(promises);
      })
      .then(embedUrls => {
        if (embedUrls && embedUrls.length > 0) {
          embedUrls.forEach(embedUrl => {
            if (embedUrl && !embedUrl.includes("youtube")) {
              streams.push({
                name: "Movierulzhd", // Nuvio commonly checks for 'name' or 'title'
                url: embedUrl,
                quality: extractQuality(embedUrl),
                title: "Movierulzhd",
                subtitles: []
              });
            }
          });
        }
        resolve(streams);
      })
      .catch(err => {
        console.error("[Movierulzhd Error]", err);
        resolve([]); // Resolve empty array so app doesn't hang
      });
  });
}

// Correct Nuvio validation export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
