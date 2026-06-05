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

function buildQualityLabel(str) {
  if (!str) return "720p";
  var m = str.match(/(\d{3,4})[pP]/);
  var label = m ? m[1] + "p" : "720p";
  if (/\b4[kK]\b/.test(str) || /\bUHD\b(?!movies)/i.test(str)) label = "2160p";
  return label;
}

// ==========================================
// SCRIPT 2 DEEP PLAYBACK BYPASSERS
// ==========================================

function bypassHrefli(url) {
  return __async(this, null, function* () {
    const host = getBaseUrl(url);
    console.log("[UHDMovies Playback] Bypassing Hrefli Hub/Landing Gateway: " + url);
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

      let refreshM = cookieHtml.match(/<meta[^>]*http-equiv="refresh"[^>]*content="([^"]+)"/i) || cookieHtml.match(/<meta[^>]*content="([^"]+)"[^>]*http-equiv="refresh"/i);
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
      
      const links = $("div.text-center a").toArray();
      for (let el of links) {
        const href = $(el).attr("href");
        const text = $(el).text().toLowerCase();
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
// MOVIE & TV LINK CONTAINER MATCHERS (From Script 2)
// ==========================================

function getMovieLinks(html) {
  var links = [];
  var entryM = html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*)/i);
  var entryHtml = entryM ? entryM[1] : html;
  var parts = entryHtml.split(/<\/?p(?:\s[^>]*)?\s*>/i);
  for (var i = 0; i < parts.length; i++) {
    if (!/\[.*\]/.test(parts[i])) continue;
    var sourceName = parts[i].replace(/<[^>]+>/g, "").split("Download")[0].trim();
    for (var j = i + 1; j < Math.min(i + 6, parts.length); j++) {
      var btnM = parts[j].match(/<a[^>]*class="[^"]*maxbutton-1[^"]*"[^>]*href="([^"]+)"/i) || parts[j].match(/<a[^>]*href="([^"]+)"[^>]*class="[^"]*maxbutton-1[^"]*"/i);
      if (btnM) {
        links.push({ sourceName, sourceLink: btnM[1] });
        break;
      }
    }
  }
  return links;
}

function getTvEpisodeLink(html, targetSeason, targetEpisode) {
  var links = [];
  var blockRe = /<(p|div)(\s[^>]*)?>[\s\S]*?<\/\1>/gi;
  var prevDetails = "";
  var currentSeason = 1;
  var m;
  while ((m = blockRe.exec(html)) !== null) {
    var blockHtml = m[0];
    var blockText = blockHtml.replace(/<[^>]+>/g, "").trim();
    var hasEpisodeLink = /episode/i.test(blockHtml) && /<a\b/i.test(blockHtml);
    if (hasEpisodeLink) {
      var seasonM = prevDetails.match(/(?:Season\s+|S0?)(\d+)/i);
      if (seasonM) currentSeason = parseInt(seasonM[1]);
      if (currentSeason === targetSeason) {
        var episodeLinks = [];
        var aRe = /<a\b[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>/gi;
        var aM;
        while ((aM = aRe.exec(blockHtml)) !== null) {
          if (/episode/i.test(aM[0])) episodeLinks.push(aM[1]);
        }
        if (targetEpisode <= episodeLinks.length && targetEpisode >= 1) {
          var link = episodeLinks[targetEpisode - 1];
          var sizeM = prevDetails.match(/(\d+(?:\.\d+)?\s*(?:MB|GB))/i);
          links.push({
            sourceLink: link,
            quality: buildQualityLabel(prevDetails),
            size: sizeM ? sizeM[1] : "Unknown",
            sourceName: prevDetails
          });
        }
      }
    }
    prevDetails = blockText;
  }
  return links;
}

// ==========================================
// CORE EXECUTION ENTRYPOINT
// ==========================================

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  return __async(this, null, function* () {
    try {
      const domain = yield getLatestDomain();
      const media = yield getMediaDetails(tmdbId, mediaType);
      if (!media) return [];
      
      console.log(`[UHDMovies] Resolved: "${media.title}", Year=${media.year}`);
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
      
      if (results.length === 0) return [];
      
      const bestPost = results[0];
      const searchWords = media.title.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      const isMatched = searchWords.every((word) => bestPost.title.toLowerCase().includes(word));
      if (!isMatched) return [];
      
      console.log(`[UHDMovies] Navigating content page: ${bestPost.title}`);
      const postRes = yield fetch(bestPost.url, { headers: { "User-Agent": USER_AGENT } });
      const postHtml = yield postRes.text();
      
      // Select the precise container strategy matching Script 2
      const isSeries = mediaType === "tv" || mediaType === "series";
      const targetLinks = isSeries && seasonNum && episodeNum 
        ? getTvEpisodeLink(postHtml, parseInt(seasonNum), parseInt(episodeNum))
        : getMovieLinks(postHtml);
        
      console.log(`[UHDMovies] Located ${targetLinks.length} target block elements.`);
      const streams = [];
      
      // Process and de-obfuscate raw items sequentially to achieve playable outputs
      for (let item of targetLinks) {
        let rawUrl = item.sourceLink;
        if (!rawUrl) continue;
        
        let finalPlayableUrl = null;
        
        // Process landing gateway explicitly (Script 2 approach)
        if (rawUrl.includes("unblockedgames") || rawUrl.includes("sid=")) {
          finalPlayableUrl = yield bypassHrefli(rawUrl);
        } else {
          finalPlayableUrl = rawUrl;
        }
        
        if (!finalPlayableUrl) continue;
        
        // Deep unpack internal configurations
        if (finalPlayableUrl.includes("driveseed") || finalPlayableUrl.includes("driveleech")) {
          finalPlayableUrl = yield extractDriveseedPage(finalPlayableUrl);
        } else if (finalPlayableUrl.includes("video-seed")) {
          finalPlayableUrl = yield extractVideoSeed(finalPlayableUrl);
        }
        
        if (finalPlayableUrl && finalPlayableUrl.startsWith("http") && !finalPlayableUrl.includes("uhdmovies")) {
          const streamQuality = buildQualityLabel(item.sourceName || item.quality);
          streams.push({
            name: `UHDMovies (${streamQuality})`,
            title: `${bestPost.title.substring(0, 30)}... [${item.size || "Multi"}]`,
            url: finalPlayableUrl,
            quality: streamQuality,
            size: item.size || "Unknown",
            provider: "uhdmovies"
          });
        }
      }
      
      return streams;
    } catch (e) {
      console.error("[UHDMovies] Playback compiler encountered an error:", e.message);
      return [];
    }
  });
}

module.exports = { getStreams };
