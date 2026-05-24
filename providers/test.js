/**
 * movies4u - Built from src/movies4u/
 * Fixed + Android TV compatible version
 */

var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;

var __defNormalProp = (obj, key, value) =>
  key in obj
    ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value })
    : (obj[key] = value);

var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b))
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
  return a;
};

var __spreadProps = (a, b) =>
  __defProps(a, __getOwnPropDescs(b));

var __async = (__this, __arguments, generator) =>
  new Promise((resolve, reject) => {
    const step = (x) =>
      x.done
        ? resolve(x.value)
        : Promise.resolve(x.value).then(fulfilled, rejected);

    const fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };

    const rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };

    step((generator = generator.apply(__this, __arguments)).next());
  });

const cheerio = require("cheerio-without-node-native");

const TMDB_API_KEY = "1b3113663c9004682ed61086cf967c44";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const MAIN_URL = "https://new3.movies4u.style/";
const M4UPLAY_BASE = "https://m4uplay.store";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  Referer: `${MAIN_URL}/`
};

function fetchWithTimeout(url, options = {}, timeout = 10000) {
  return __async(this, null, function* () {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = yield fetch(
        url,
        __spreadProps(__spreadValues({}, options), {
          signal: controller.signal
        })
      );
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  });
}

/* ---------------- TITLE HELPERS ---------------- */

function normalizeTitle(title) {
  if (!title) return "";
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function calculateTitleSimilarity(a, b) {
  const n1 = normalizeTitle(a);
  const n2 = normalizeTitle(b);

  if (n1 === n2) return 1;
  if (n1.includes(n2) || n2.includes(n1)) return 0.9;

  const s1 = new Set(n1.split(" "));
  const s2 = new Set(n2.split(" "));

  const inter = [...s1].filter((x) => s2.has(x));
  const union = new Set([...s1, ...s2]);

  return inter.length / union.size;
}

function findBestTitleMatch(mediaInfo, results) {
  let best = null;
  let bestScore = 0;

  for (const r of results) {
    let score = calculateTitleSimilarity(mediaInfo.title, r.title);

    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }

  return bestScore > 0.4 ? best : null;
}

/* ---------------- STREAM TITLE ---------------- */

function formatStreamTitle(mediaInfo, stream) {
  const year = mediaInfo.year ? ` (${mediaInfo.year})` : "";
  return `${mediaInfo.title}${year} - ${stream.quality || "Unknown"}`;
}

/* ---------------- HLS RESOLUTION ---------------- */

function resolveHlsPlaylist(masterUrl) {
  return __async(this, null, function* () {
    const result = {
      masterUrl,
      variants: [],
      audios: [],
      isMaster: false
    };

    const res = yield fetchWithTimeout(masterUrl, {
      headers: __spreadProps(__spreadValues({}, HEADERS), {
        Referer: M4UPLAY_BASE
      })
    });

    const text = yield res.text();

    if (!text.includes("#EXTM3U")) return result;
    if (text.includes("#EXT-X-STREAM-INF")) result.isMaster = true;

    const lines = text.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes("#EXT-X-STREAM-INF")) {
        let j = i + 1;
        while (lines[j] && lines[j].startsWith("#")) j++;

        const url = lines[j];
        if (!url) continue;

        let quality = "Unknown";
        const match = line.match(/RESOLUTION=\d+x(\d+)/);

        if (match) {
          const h = parseInt(match[1]);
          quality =
            h >= 2160
              ? "4K"
              : h >= 1080
              ? "1080p"
              : h >= 720
              ? "720p"
              : `${h}p`;
        }

        result.variants.push({ url, quality });
      }
    }

    return result;
  });
}

/* ---------------- M4UPLAY ---------------- */

function extractFromM4UPlay(embedUrl) {
  return __async(this, null, function* () {
    const res = yield fetchWithTimeout(embedUrl, {
      headers: __spreadProps(__spreadValues({}, HEADERS), {
        Referer: MAIN_URL
      })
    });

    const html = yield res.text();

    const match = html.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);
    if (!match) return [];

    return [
      {
        url: match[0],
        quality: "Unknown",
        audios: [],
        audioInfo: "",
        isMaster: false
      }
    ];
  });
}

/* ---------------- WATCH LINKS ---------------- */

function extractWatchLinks(movieUrl) {
  return __async(this, null, function* () {
    const res = yield fetchWithTimeout(movieUrl, {
      headers: HEADERS
    });

    const html = yield res.text();
    const $ = cheerio.load(html);

    const links = [];

    $("a.btn.btn-zip").each((_, el) => {
      const href = $(el).attr("href");
      const text = $(el).text();

      if (href && href.includes("m4uplay")) {
        links.push({
          url: href,
          label: text,
          quality: text.includes("1080") ? "1080p" : "Unknown"
        });
      }
    });

    return links;
  });
}

/* ---------------- TMDB ---------------- */

function getTMDBDetails(id) {
  return __async(this, null, function* () {
    const res = yield fetchWithTimeout(
      `${TMDB_BASE_URL}/movie/${id}?api_key=${TMDB_API_KEY}`
    );

    const data = yield res.json();

    return {
      title: data.title,
      year: (data.release_date || "").split("-")[0]
    };
  });
}

/* ---------------- MAIN ---------------- */

function getStreams(tmdbId) {
  return __async(this, null, function* () {
    let mediaInfo;

    if (/^\d+$/.test(tmdbId)) {
      mediaInfo = yield getTMDBDetails(tmdbId);
    } else {
      mediaInfo = { title: tmdbId, year: null };
    }

    const searchRes = yield fetchWithTimeout(
      `${MAIN_URL}/?s=${encodeURIComponent(mediaInfo.title)}`
    );

    const html = yield searchRes.text();
    const $ = cheerio.load(html);

    const results = [];

    $("h3.entry-title a").each((_, el) => {
      results.push({
        title: $(el).text(),
        url: $(el).attr("href")
      });
    });

    const match = findBestTitleMatch(mediaInfo, results);
    if (!match) return [];

    const watchLinks = yield extractWatchLinks(match.url);
    const streams = [];

    for (const link of watchLinks) {
      const extracted = yield extractFromM4UPlay(link.url);

      for (const s of extracted) {
        streams.push({
          name: "Movies4u",
          title: formatStreamTitle(mediaInfo, s),
          url: `https://nuvio-hls-proxy.onrender.com/proxy?url=${encodeURIComponent(s.url)}`,
          type: "hls",
          quality: s.quality,
          headers: {
            "User-Agent": HEADERS["User-Agent"],
          },
          provider: "Movies4u"
        });
      }
    }

    return streams;
  });
}

if (typeof module !== "undefined") {
  module.exports = { getStreams };
} else {
  global.getStreams = { getStreams };
}
