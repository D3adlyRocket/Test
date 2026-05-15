// MoviesDrive Provider Plugin with HubCloud/GDFlix Bypass Logic
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => { try { step(generator.next(value)); } catch (e) { reject(e); } };
    var rejected = (value) => { try { step(generator.throw(value)); } catch (e) { reject(e); } };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// -------------- CONFIG --------------
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DOMAIN_JSON_URL = "https://himanshu8443.github.io/providers/modflix.json";
const PROVIDER_KEY = "drive";
const HF_API_BASE = "https://badboysxs-md.hf.space";
const HF_MOVIE_API = HF_API_BASE + "/movie";
const HF_SERIES_AUTO_API = HF_API_BASE + "/series_auto";
const PROVIDER_NAME = "MoviesDrive";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
};

let visitedUrls = new Set();

// -------------- BYPASS LOGIC (The Matrix Parts) --------------

function makeStream(name, title, url, quality, headers = {}) {
  return { name: PROVIDER_NAME + " | " + name, title, url, quality, headers };
}

function resolveHubCloud(url, label, quality) {
  return __async(this, null, function* () {
    if (visitedUrls.has(url)) return [];
    visitedUrls.add(url);
    try {
      console.log(`[${PROVIDER_NAME}] HubCloud: Probing ${url.substring(0, 50)}`);
      const res = yield fetch(url, { headers: HEADERS });
      if (!res) return [];
      const rawHtml = yield res.text();
      const streams = [];

      // Instant Match for Google Video links
      const instantMatch = rawHtml.match(/https:\/\/video-downloads\.googleusercontent\.com\/[^'"]+/g);
      if (instantMatch) {
          instantMatch.forEach(link => streams.push(makeStream("Direct", label, link, quality)));
          return streams; 
      }

      // Check for GamerXyt redirect
      const blogMatch = rawHtml.match(/href=['"]([^'"]+gamerxyt\.com[^'"]+)['"]/);
      let targetUrl = blogMatch ? blogMatch[1] : url;

      const blogRes = yield fetch(targetUrl, { 
          headers: __spreadProps(__spreadValues({}, HEADERS), { 
              "Referer": url,
              "Cookie": "xyt=1; xla=s4t"
          }) 
      });
      const blogHtml = yield blogRes.text();
      
      const googleLinks = blogHtml.match(/https:\/\/video-downloads\.googleusercontent\.com\/[^'"]+/g);
      if (googleLinks) {
          googleLinks.forEach(link => streams.push(makeStream("Direct", label, link, quality)));
      }
      return streams;
    } catch (e) { return []; }
  });
}

// -------------- MAIN getStreams --------------
function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  return __async(this, null, function* () {
    visitedUrls = new Set();
    try {
      const tmdbUrl = `https://api.themoviedb.org/3/${mediaType === "tv" ? "tv" : "movie"}/${tmdbId}?api_key=${TMDB_API_KEY}`;
      const tmdbRes = yield fetch(tmdbUrl);
      const tmdbData = yield tmdbRes.json();
      const title = mediaType === "tv" ? tmdbData.name : tmdbData.title;
      if (!title) return [];

      let rawLinks = [];
      if (mediaType === "movie") {
        // ... (existing search logic for movies) ...
        // For brevity, assuming the HF API call returns links
        const movieRes = yield fetch(`${HF_MOVIE_API}?url=${encodeURIComponent(tmdbId)}`); // Simplified for example
        const movieData = yield movieRes.json();
        if (movieData && movieData.links) rawLinks = movieData.links;
      } else {
        const seriesRes = yield fetch(`${HF_SERIES_AUTO_API}?q=${encodeURIComponent(title)}&season=${seasonNum}&episode=${episodeNum}`);
        const seriesData = yield seriesRes.json();
        if (seriesData && seriesData.links) rawLinks = seriesData.links;
      }

      const finalStreams = [];
      for (const link of rawLinks) {
        const quality = link.quality || "HD";
        const streamTitle = link.stream_title || title;

        // If it's a HubCloud or GDFlix link, use the bypass
        if (link.url.includes("hubcloud") || link.url.includes("gdlink") || link.url.includes("gdflix")) {
            const bypassed = yield resolveHubCloud(link.url, streamTitle, quality);
            finalStreams.push(...bypassed);
        } else {
            // Otherwise, keep it as a direct link
            finalStreams.push(makeStream("Direct", streamTitle, link.url, quality));
        }
      }

      return finalStreams;
    } catch (e) {
      console.error("[MoviesDrive] Error:", e);
      return [];
    }
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
