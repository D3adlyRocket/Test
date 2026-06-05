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
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/uhdmovies/index.js
var cheerio = require("cheerio-without-node-native");
var BASE_URL = "https://uhdmovies.rodeo";
var DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
var TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var domainCache = { url: BASE_URL, ts: 0 };

function getLatestDomain() {
  return __async(this, null, function* () {
    const now = Date.now();
    if (now - domainCache.ts < 36e5)
      return domainCache.url;
    try {
      const response = yield fetch(DOMAINS_URL);
      const data = yield response.json();
      if (data && data["UHDMovies"]) {
        domainCache.url = data["UHDMovies"];
        domainCache.ts = now;
      }
    } catch (e) {
      console.log("[UHDMovies] Domain fetch error:", e.message);
    }
    return domainCache.url;
  });
}

function getMediaDetails(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const endpoint = mediaType === "tv" || mediaType === "series" ? "tv" : "movie";
    const url = `https://api.tmdb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    try {
      const response = yield fetch(url);
      const data = yield response.json();
      if (endpoint === "tv") {
        return {
          title: data.name,
          year: data.first_air_date ? data.first_air_date.split("-")[0] : ""
        };
      } else {
        return {
          title: data.title,
          year: data.release_date ? data.release_date.split("-")[0] : ""
        };
      }
    } catch (error) {
      console.error("[UHDMovies] TMDB details fetch failed:", error.message);
      return null;
    }
  });
}

function parseSize(text) {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
  return match ? `${match[1]} ${match[2].toUpperCase()}` : "Unknown Size";
}

function parseQuality(text) {
  if (text.match(/4k|2160p/i)) return "2160p";
  if (text.match(/1080p/i)) return "1080p";
  if (text.match(/720p/i)) return "720p";
  if (text.match(/480p/i)) return "480p";
  return "720p";
}

function getBaseUrl(url) {
  if (!url) return BASE_URL;
  var match = url.match(/^(https?:\/\/[^\/]+)/);
  return match ? match[1] : BASE_URL;
}

function fixUrl(url, domain) {
  if (!url) return "";
  if (url.indexOf("http") === 0) return url;
  if (url.indexOf("//") === 0) return "https:" + url;
  if (url.indexOf("/") === 0) return domain + url;
  return domain + "/" + url;
}

// ==========================================
// SCRIPT 2 WORKING PLAYBACK BYPASSERS
// ==========================================

function bypassHrefli(url) {
  return __async(this, null, function* () {
    const host = getBaseUrl(url);
    console.log("[UHDMovies] Bypassing Landing Hub: " + url);
    try {
      const res = yield fetch(url, { headers: { "User-Agent": USER_AGENT } });
      const html = yield res.text();
      
      let formUrl = html.match(/<form[^>]*id="landing"[^>]*action="([^"]+)"/i) || html.match(/<form[^>]*action="([^"]+)"[^>]*id="landing"/i);
      formUrl = formUrl ? formUrl[1] : null;
      
      const formData = {};
      const formMatch = html.match(/<form[^>]*id="landing"[^>]*>([\s\S]*?)<\/form>/i) || html.match(/<form[^>]*>([\s\S]*?)<\/form>/i);
      const formHtml = formMatch ? formMatch[1] : html;
      const re = /<input[^>]+>/gi;
      let m;
      while ((m = re.exec(formHtml)) !== null) {
        var nameM = m[0].match(/name="([^"]+)"/i);
        var valueM = m[0].match(/value="([^"]*)"/i);
        if (nameM) formData[nameM[1]] = valueM ? valueM[1] : "";
      }
      if (!formUrl) return null;

      const postRes = yield fetch(formUrl, {
        method: "POST",
        headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(formData).toString()
      });
      const postHtml = yield postRes.text();

      let formUrl2 = postHtml.match(/<form[^>]*id="landing"[^>]*action="([^"]+)"/i) || postHtml.match(/<form[^>]*action="([^"]+)"[^>]*id="landing"/i);
      formUrl2 = formUrl2 ? formUrl2[1] : null;
      
      const formData2 = {};
      const formMatch2 = postHtml.match(/<form[^>]*id="landing"[^>]*>([\s\S]*?)<\/form>/i) || postHtml.match(/<form[^>]*>([\s\S]*?)<\/form>/i);
      const formHtml2 = formMatch2 ? formMatch2[1] : postHtml;
      while ((m = re.exec(formHtml2)) !== null) {
        var nameM2 = m[0].match(/name="([^"]+)"/i);
        var valueM2 = m[0].match(/value="([^"]*)"/i);
        if (nameM2) formData2[nameM2[1]] = valueM2 ? valueM2[1] : "";
      }
      if (!formUrl2) return null;

      const postRes2 = yield fetch(formUrl2, {
        method: "POST",
        headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(formData2).toString()
      });
      const postHtml2 = yield postRes2.text();

      let scriptContent = "";
      const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
      while ((m = scriptRe.exec(postHtml2)) !== null) {
        if (m[1].indexOf("?go=") !== -1) scriptContent = m[1];
      }
      const skTokenM = scriptContent.match(/\?go=([^"]+)/);
      if (!skTokenM) return null;
      
      const skToken = skTokenM[1];
      const wpHttp2 = formData2["_wp_http2"] || "";
      
      const cookieRes = yield fetch(host + "?go=" + skToken, {
        headers: { "User-Agent": USER_AGENT, "Cookie": skToken + "=" + wpHttp2 }
      });
      const cookieHtml = yield cookieRes.text();

      let refreshM = cookieHtml.match(/<meta[^>]*http-equiv="refresh"[^>]*content="([^"]+)"/i) || cookieHtml.match(/<meta[^>]*content="([^"]+)"[^http-equiv="refresh"]/i);
      let driveUrl = null;
      if (refreshM) {
        var urlM = refreshM[1].match(/url=(.+)/i);
        driveUrl = urlM ? urlM[1].trim() : null;
      }
      if (!driveUrl) return null;

      const driveRes = yield fetch(driveUrl, { headers: { "User-Agent": USER_AGENT } });
      const driveHtml = yield driveRes.text();
      const pathM = driveHtml.match(/replace\("([^"]+)"\)/);
      if (!pathM || pathM[1] === "/404") return null;
      
      return fixUrl(pathM[1], getBaseUrl(driveUrl));
    } catch (err) {
      console.error("[UHDMovies] Hrefli bypass error: " + err.message);
      return null;
    }
  });
}

function extractVideoSeed(finallink) {
  return __async(this, null, function* () {
    try {
      var hostM = finallink.match(/^https?:\/\/([^\/]+)/);
      var host = hostM ? hostM[1] : "video-seed.xyz";
      var tokenParts = finallink.split("?url=");
      if (tokenParts.length < 2) return null;
      var token = tokenParts[1];
      const res = yield fetch("https://" + host + "/api", {
        method: "POST",
        headers: {
          "User-Agent": USER_AGENT,
          "Content-Type": "application/x-www-form-urlencoded",
          "x-token": host,
          "Referer": finallink
        },
        body: "keys=" + encodeURIComponent(token)
      });
      const text = yield res.text();
      var m = text.match(/url":"([^"]+)"/);
      return m ? m[1].replace(/\\\//g, "/") : null;
    } catch (err) {
      return null;
    }
  });
}

function extractInstantLink(finallink) {
  return __async(this, null, function* () {
    try {
      var hostM = finallink.match(/^https?:\/\/([^\/]+)/);
      var host = hostM ? hostM[1] : "video-seed.pro";
      var tokenParts = finallink.split("url=");
      if (tokenParts.length < 2) return null;
      var token = tokenParts[1];
      const res = yield fetch("https://" + host + "/api", {
        method: "POST",
        headers: {
          "User-Agent": USER_AGENT,
          "Content-Type": "application/x-www-form-urlencoded",
          "x-token": host,
          "Referer": finallink
        },
        body: "keys=" + encodeURIComponent(token)
      });
      const text = yield res.text();
      var m = text.match(/url":"([^"]+)"/);
      return m ? m[1].replace(/\\\//g, "/") : null;
    } catch (err) {
      return null;
    }
  });
}

function extractResumeBot(url) {
  return __async(this, null, function* () {
    try {
      const res = yield fetch(url, { headers: { "User-Agent": USER_AGENT } });
      const html = yield res.text();
      var tokenM = html.match(/formData\.append\('token', '([a-f0-9]+)'\)/);
      var pathM = html.match(/fetch\('\/download\?id=([a-zA-Z0-9\/+]+)'/);
      if (!tokenM || !pathM) return null;
      var token = tokenM[1];
      var path = pathM[1];
      var baseUrl = url.split("/download")[0];
      const postRes = yield fetch(baseUrl + "/download?id=" + path, {
        method: "POST",
        headers: {
          "User-Agent": USER_AGENT,
          "Content-Type": "application/x-www-form-urlencoded",
          "Referer": url
        },
        body: "token=" + encodeURIComponent(token)
      });
      const text = yield postRes.text();
      var json = JSON.parse(text);
      return json.url && json.url.indexOf("http") === 0 ? json.url : null;
    } catch (e) {
      return null;
    }
  });
}

function extractDriveseedPage(url) {
  return __async(this, null, function* () {
    try {
      let html = "";
      if (url.indexOf("r?key=") !== -1) {
        const res1 = yield fetch(url, { headers: { "User-Agent": USER_AGENT } });
        const html1 = yield res1.text();
        var redirectM = html1.match(/replace\("([^"]+)"\)/);
        if (!redirectM) return null;
        const res2 = yield fetch(getBaseUrl(url) + redirectM[1], { headers: { "User-Agent": USER_AGENT } });
        html = yield res2.text();
      } else {
        const res = yield fetch(url, { headers: { "User-Agent": USER_AGENT } });
        html = yield res.text();
      }
      
      const $ = cheerio.load(html);
      let foundUrl = null;
      
      const links = $("a").toArray();
      for (let el of links) {
        const href = $(el).attr("href");
        const text = $(el).text().toLowerCase() || $(el).parent().text().toLowerCase();
        if (!href) continue;
        
        if (text.indexOf("instant download") !== -1) {
          foundUrl = yield extractInstantLink(href);
        } else if (text.indexOf("resume worker bot") !== -1) {
          foundUrl = yield extractResumeBot(href);
        } else if (text.indexOf("cloud download") !== -1 || text.indexOf("direct links") !== -1) {
          foundUrl = href;
        }
        if (foundUrl) break;
      }
      return foundUrl;
    } catch (e) {
      return null;
    }
  });
}

// ==========================================
// CORE EXTRACTION MACHINE
// ==========================================

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  return __async(this, null, function* () {
    try {
      const domain = yield getLatestDomain();
      const media = yield getMediaDetails(tmdbId, mediaType);
      if (!media) return [];
      
      console.log(`[UHDMovies] Resolved details: Title="${media.title}", Year=${media.year}`);
      const cleanQuery = media.title.replace(/[^\w\s]/gi, "");
      const query = encodeURIComponent(`${cleanQuery} ${media.year}`);
      const searchUrl = `${domain}/?s=${query}`;
      
      const res = yield fetch(searchUrl, { headers: { "User-Agent": USER_AGENT } });
      const html = yield res.text();
      const $ = cheerio.load(html);
      const results = [];
      
      $("article.gridlove-post").each((_, el) => {
        const $el = $(el);
        const titleRaw = $el.find("h1.sanket, h2.entry-title a").text().trim();
        const href = $el.find("div.entry-image > a, h2.entry-title a").attr("href");
        if (href && titleRaw) {
          results.push({ title: titleRaw, url: href });
        }
      });
      
      if (results.length === 0) {
        console.log(`[UHDMovies] No search results found on ${domain}`);
        return [];
      }
      
      const bestPost = results[0];
      const searchedTitle = media.title.toLowerCase();
      const matchedTitle = bestPost.title.toLowerCase();
      const searchWords = searchedTitle.split(/\s+/).filter((w) => w.length > 2);
      const isMatched = searchWords.every((word) => matchedTitle.includes(word));
      if (!isMatched) {
        console.log(`[UHDMovies] Title mismatch gap found. Skipping.`);
        return [];
      }
      
      console.log(`[UHDMovies] Extracting links from content page: ${bestPost.title}`);
      const postRes = yield fetch(bestPost.url, { headers: { "User-Agent": USER_AGENT } });
      const postHtml = yield postRes.text();
      const $post = cheerio.load(postHtml);
      const rawStreams = [];
      
      // Using Script 1's working wide-net anchor collector strategy
      $post("a").each((_, el) => {
        const href = $post(el).attr("href") || "";
        const text = $post(el).text().trim() || $post(el).parent().text().trim();
        
        // Filter out TV show episodes if specific limits are requested
        if (mediaType === "tv" || mediaType === "series") {
          if (episodeNum) {
            const epPatterns = [
              new RegExp(`ep(?:isode)?\\s*0*${episodeNum}\\b`, "i"),
              new RegExp(`E0*${episodeNum}\\b`, "i")
            ];
            const textMatch = epPatterns.some(p => p.test(text) || p.test(href));
            // Only enforce skipping if there's an explicit episode list block text mismatching our targeted index
            if (/episode|ep/i.test(text) && !textMatch) {
              return; 
            }
          }
        }

        if (href.match(/instant|drive|gdrive|sharer|kolop|hubdrive|appdrive|gdflix|vcloud|mdisk|unblockedgames|sid=/i)) {
          const quality = parseQuality(text + " " + bestPost.title);
          const size = parseSize(text);
          rawStreams.push({
            name: `UHDMovies (${quality})`,
            title: `${bestPost.title.substring(0, 35)}... [${size}]`,
            url: href,
            quality,
            size,
            provider: "uhdmovies",
            rawText: text
          });
        }
      });
      
      console.log(`[UHDMovies] Found ${rawStreams.length} links. Parsing through video-playback bypassers...`);
      const linksToResolve = rawStreams.slice(0, 15);
      
      const resolvedStreams = yield Promise.all(linksToResolve.map((stream) => __async(this, null, function* () {
        let currentUrl = stream.url;
        
        // Use Script 2's functional bypassHrefli engine instead of Script 1's incomplete form handler
        if (currentUrl.includes("unblockedgames") || currentUrl.includes("sid=")) {
          currentUrl = yield bypassHrefli(currentUrl);
        }
        
        if (!currentUrl) return null;
        
        // Deep unpack landing pages straight to video layer URLs
        if (currentUrl.includes("driveseed") || currentUrl.includes("driveleech")) {
          const deepVideoUrl = yield extractDriveseedPage(currentUrl);
          if (deepVideoUrl) currentUrl = deepVideoUrl;
        } else if (currentUrl.includes("video-seed")) {
          const deepVideoUrl = yield extractVideoSeed(currentUrl);
          if (deepVideoUrl) currentUrl = deepVideoUrl;
        }
        
        return __spreadProps(__spreadValues({}, stream), { url: currentUrl });
      })));
      
      const finalStreams = resolvedStreams.filter((stream) => {
        if (!stream || !stream.url) return false;
        const url = stream.url.toLowerCase();
        return !url.includes("uhdmovies") && !url.includes("/4k-movies/") && url.startsWith("http");
      });
      
      console.log(`[UHDMovies] Returning ${finalStreams.length} direct media file streams.`);
      return finalStreams;
    } catch (e) {
      console.error("[UHDMovies] Scraper error:", e.message);
      return [];
    }
  });
}

module.exports = { getStreams };
