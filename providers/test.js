// movierulzhd.js
// Simplified Nuvio-compatible Movierulzhd provider

const BASE_URL = "https://123moviesfree9.cloud";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent": "Mozilla/5.0",
  "Referer": BASE_URL
};

function extractQuality(text) {
  const t = (text || "").toLowerCase();

  if (t.includes("2160") || t.includes("4k")) return "4K";
  if (t.includes("1080")) return "1080p";
  if (t.includes("720")) return "720p";
  if (t.includes("480")) return "480p";

  return "HD";
}

function cleanUrl(url) {
  if (!url) return "";

  url = url.replace(/\\/g, "");
  url = url.replace(/^"/, "");
  url = url.replace(/"$/, "");

  return url.trim();
}

function getEmbedUrl(base, post, nume, type) {
  return fetch(base + "/wp-admin/admin-ajax.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": base,
      "User-Agent": HEADERS["User-Agent"]
    },
    body:
      "action=doo_player_ajax" +
      "&post=" + encodeURIComponent(post) +
      "&nume=" + encodeURIComponent(nume) +
      "&type=" + encodeURIComponent(type)
  })
    .then(function(resp) {
      return resp.text();
    })
    .then(function(text) {

      let match =
        text.match(/src=[\\"'](https?:\/\/[^"']+)/i) ||
        text.match(/"(https?:\/\/[^"]+)"/i) ||
        text.match(/(https?:\/\/[^\\"]+)/i);

      if (match && match[1]) {
        return cleanUrl(match[1]);
      }

      return null;
    })
    .catch(function() {
      return null;
    });
}

function getStreams(tmdbId, mediaType, season, episode) {

  return new Promise(function(resolve) {

    const streams = [];

    // STEP 1 — TMDB TITLE
    fetch(
      "https://api.themoviedb.org/3/" +
      mediaType +
      "/" +
      tmdbId +
      "?api_key=" +
      TMDB_API_KEY
    )
      .then(function(resp) {
        return resp.json();
      })

      .then(function(meta) {

        const title = meta.title || meta.name;

        if (!title) {
          resolve([]);
          return;
        }

        // STEP 2 — SEARCH
        return fetch(
          BASE_URL +
          "/search/" +
          encodeURIComponent(title.replace(/ /g, "-")),
          {
            headers: HEADERS
          }
        );
      })

      .then(function(resp) {

        if (!resp) {
          resolve([]);
          return;
        }

        return resp.text();
      })

      .then(function(html) {

        if (!html) {
          resolve([]);
          return;
        }

        const $ = cheerio.load(html);

        let contentUrl = null;

        $("div.result-item").each(function(i, el) {

          if (contentUrl) return;

          const href = $(el)
            .find("div.title a")
            .attr("href");

          if (href) {
            contentUrl = href;
          }
        });

        if (!contentUrl) {
          resolve([]);
          return;
        }

        // STEP 3 — OPEN PAGE
        return fetch(contentUrl, {
          headers: HEADERS
        });
      })

      .then(function(resp) {

        if (!resp) {
          resolve(streams);
          return;
        }

        return resp.text();
      })

      .then(function(html) {

        if (!html) {
          resolve(streams);
          return;
        }

        const $ = cheerio.load(html);

        const players = [];

        $("ul#playeroptionsul li").each(function(i, el) {

          const post = $(el).attr("data-post");
          const nume = $(el).attr("data-nume");
          const type = $(el).attr("data-type");

          if (
            post &&
            nume &&
            String(nume).toLowerCase().indexOf("trailer") === -1
          ) {
            players.push({
              post: post,
              nume: nume,
              type: type
            });
          }
        });

        if (players.length === 0) {
          resolve([]);
          return;
        }

        const requests = [];

        for (let i = 0; i < players.length; i++) {

          requests.push(
            getEmbedUrl(
              BASE_URL,
              players[i].post,
              players[i].nume,
              players[i].type
            )
          );
        }

        return Promise.all(requests);
      })

      .then(function(results) {

        if (!results) {
          resolve([]);
          return;
        }

        for (let i = 0; i < results.length; i++) {

          const url = results[i];

          if (
            url &&
            url.indexOf("youtube") === -1 &&
            url.startsWith("http")
          ) {

            streams.push({
              name: "Movierulzhd",
              title: "Movierulzhd " + extractQuality(url),
              quality: extractQuality(url),
              url: url,
              subtitles: []
            });
          }
        }

        resolve(streams);
      })

      .catch(function() {
        resolve([]);
      });
  });
}

global.getStreams = getStreams;
