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

const cheerio = require("cheerio-without-node-native");

/** * ANDROID TV BYPASS UA
 * Standard TV UAs often trigger cloudflare/firewalls on MoviesMod.
 * We force a Windows Chrome UA for all requests.
 */
const TV_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

console.log("[MoviesMod] Initializing for Android TV / Nuvio...");

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const FALLBACK_DOMAIN = "https://moviesmod.farm";
const DOMAIN_CACHE_TTL = 4 * 60 * 60 * 1e3;
let moviesModDomain = FALLBACK_DOMAIN;
let domainCacheTimestamp = 0;

function getMoviesModDomain() {
  return __async(this, null, function* () {
    const now = Date.now();
    if (now - domainCacheTimestamp < DOMAIN_CACHE_TTL) {
      return moviesModDomain;
    }
    try {
      console.log("[MoviesMod] Fetching latest domain...");
      const response = yield fetch("https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json", {
        method: "GET",
        headers: { "User-Agent": TV_UA }
      });
      if (response.ok) {
        const data = yield response.json();
        if (data && data.moviesmod) {
          moviesModDomain = data.moviesmod;
          domainCacheTimestamp = now;
          console.log(`[MoviesMod] Updated domain to: ${moviesModDomain}`);
        }
      }
    } catch (error) {
      console.error(`[MoviesMod] Failed to fetch domain: ${error.message}`);
    }
    return moviesModDomain;
  });
}

function makeRequest(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const defaultHeaders = {
      "User-Agent": TV_UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Connection": "keep-alive"
    };
    const response = yield fetch(url, __spreadProps(__spreadValues({}, options), {
      headers: __spreadValues(__spreadValues({}, defaultHeaders), options.headers)
    }));
    return response;
  });
}

function extractQuality(text) {
  if (!text) return "Unknown";
  const qualityMatch = text.match(/(480p|720p|1080p|2160p|4k)/i);
  return qualityMatch ? qualityMatch[1] : "Unknown";
}

function parseQualityForSort(qualityString) {
  if (!qualityString) return 0;
  const match = qualityString.match(/(\d{3,4})p/i);
  return match ? parseInt(match[1], 10) : 0;
}

function getTechDetails(qualityString) {
  if (!qualityString) return [];
  const details = [];
  const lowerText = qualityString.toLowerCase();
  if (lowerText.includes("10bit")) details.push("10-bit");
  if (lowerText.includes("hevc") || lowerText.includes("x265")) details.push("HEVC");
  if (lowerText.includes("hdr")) details.push("HDR");
  return details;
}

function findBestMatch(mainString, targetStrings) {
  if (!targetStrings || targetStrings.length === 0) {
    return { bestMatch: { target: "", rating: 0 }, bestMatchIndex: -1 };
  }
  const ratings = targetStrings.map((target) => {
    if (!target) return 0;
    const main = mainString.toLowerCase();
    const targ = target.toLowerCase();
    if (main === targ) return 1;
    if (targ.includes(main) || main.includes(targ)) return 0.8;
    const mainWords = main.split(/\s+/);
    const targWords = targ.split(/\s+/);
    let matches = 0;
    for (const word of mainWords) {
      if (word.length > 2 && targWords.some((tw) => tw.includes(word) || word.includes(tw))) {
        matches++;
      }
    }
    return matches / Math.max(mainWords.length, targWords.length);
  });
  const bestRating = Math.max(...ratings);
  const bestIndex = ratings.indexOf(bestRating);
  return {
    bestMatch: { target: targetStrings[bestIndex], rating: bestRating },
    bestMatchIndex: bestIndex
  };
}

function searchMoviesMod(query) {
  return __async(this, null, function* () {
    try {
      const baseUrl = yield getMoviesModDomain();
      const searchUrl = `${baseUrl}/?s=${encodeURIComponent(query)}`;
      const response = yield makeRequest(searchUrl);
      const html = yield response.text();
      const $ = cheerio.load(html);
      const results = [];
      $(".latestPost").each((i, element) => {
        const linkElement = $(element).find("a");
        const title = linkElement.attr("title");
        const url = linkElement.attr("href");
        if (title && url) results.push({ title, url });
      });
      return results;
    } catch (error) {
      return [];
    }
  });
}

function extractDownloadLinks(moviePageUrl) {
  return __async(this, null, function* () {
    try {
      const response = yield makeRequest(moviePageUrl);
      const html = yield response.text();
      const $ = cheerio.load(html);
      const links = [];
      const headers = $(".thecontent").find('h3:contains("Season"), h4');
      headers.each((i, el) => {
        const header = $(el);
        const headerText = header.text().trim();
        const blockContent = header.nextUntil("h3, h4");
        if (header.is("h3") && headerText.toLowerCase().includes("season")) {
          blockContent.find("a").filter((i2, el2) => {
            const t = $(el2).text().toLowerCase();
            return t.includes("episode links") && !t.includes("batch");
          }).each((j, linkEl) => {
            links.push({ quality: `${headerText} - ${$(linkEl).text().trim()}`, url: $(linkEl).attr("href") });
          });
        } else if (header.is("h4")) {
          const btn = blockContent.find("a.maxbutton-download-links, .maxbutton").first();
          if (btn.length > 0) {
            links.push({ quality: extractQuality(headerText), url: btn.attr("href") });
          }
        }
      });
      return links;
    } catch (error) {
      return [];
    }
  });
}

function resolveIntermediateLink(initialUrl, refererUrl, quality) {
  return __async(this, null, function* () {
    try {
      const urlObject = new URL(initialUrl);
      const isBlog = urlObject.hostname.includes("modpro.blog");
      if (isBlog) {
        const response = yield makeRequest(initialUrl, { headers: { "Referer": refererUrl } });
        const $ = cheerio.load(yield response.text());
        const finalLinks = [];
        $('.entry-content a[href*="driveseed.org"], .entry-content a[href*="cloud.unblockedgames.world"], .entry-content a[href*="tech.creativeexpressionsblog.com"], .entry-content a[href*="tech.examzculture.in"]').each((i, el) => {
          finalLinks.push({ server: $(el).text().trim().replace(/\s+/g, " "), url: $(el).attr("href") });
        });
        return finalLinks;
      } else if (urlObject.hostname.includes("modrefer.in")) {
        const decodedUrl = atob(urlObject.searchParams.get("url"));
        const response = yield makeRequest(decodedUrl, { headers: { "Referer": refererUrl } });
        const $ = cheerio.load(yield response.text());
        const finalLinks = [];
        $("a").each((i, el) => {
          const link = $(el).attr("href");
          if (link && (link.includes("driveseed.org") || link.includes("cloud.unblockedgames.world") || link.includes("tech.examzculture.in"))) {
            finalLinks.push({ server: $(el).text().trim() || "Download Link", url: link });
          }
        });
        return finalLinks;
      }
      return [];
    } catch (error) {
      return [];
    }
  });
}

function resolveTechUnblockedLink(sidUrl) {
  return __async(this, null, function* () {
    try {
      const response = yield makeRequest(sidUrl);
      const $ = cheerio.load(yield response.text());
      const wp_http = $("#landing").find('input[name="_wp_http"]').val();
      const action = $("#landing").attr("action");
      if (!wp_http) return null;

      const step1 = yield makeRequest(action, {
        method: "POST",
        headers: { "Referer": sidUrl, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ "_wp_http": wp_http }).toString()
      });

      const $2 = cheerio.load(yield step1.text());
      const step2 = yield makeRequest($2("#landing").attr("action"), {
        method: "POST",
        headers: { "Referer": step1.url, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ "_wp_http2": $2('input[name="_wp_http2"]').val(), "token": $2('input[name="token"]').val() }).toString()
      });

      const finalHtml = yield step2.text();
      const cMatch = finalHtml.match(/s_343\('([^']+)',\s*'([^']+)'/);
      const lMatch = finalHtml.match(/c\.setAttribute\("href",\s*"([^"]+)"\)/);
      if (cMatch && lMatch) {
        const finalUrl = new URL(lMatch[1].trim(), new URL(sidUrl).origin).href;
        const res = yield makeRequest(finalUrl, { headers: { "Referer": step2.url, "Cookie": `${cMatch[1].trim()}=${cMatch[2].trim()}` } });
        const mMatch = (yield res.text()).match(/url=(.*)/i);
        return mMatch ? mMatch[1].replace(/["']/g, "") : null;
      }
      return null;
    } catch (error) {
      return null;
    }
  });
}

function resolveDriveseedLink(driveseedUrl) {
  return __async(this, null, function* () {
    try {
      const response = yield makeRequest(driveseedUrl, { headers: { "Referer": "https://links.modpro.blog/" } });
      const html = yield response.text();
      const redirectMatch = html.match(/window\.location\.replace\("([^"]+)"\)/);
      if (redirectMatch) {
        const finalUrl = `https://driveseed.org${redirectMatch[1]}`;
        const $ = cheerio.load(yield (yield makeRequest(finalUrl)).text());
        const options = [];
        let size = "Unknown";
        $("ul.list-group li").each((i, el) => { if ($(el).text().includes("Size :")) size = $(el).text().split(":")[1].trim(); });
        
        const resume = $('a:contains("Resume Cloud")').attr("href");
        if (resume) options.push({ title: "Resume Cloud", type: "resume", url: `https://driveseed.org${resume}`, priority: 1 });
        
        const instant = $('a:contains("Instant Download")').attr("href");
        if (instant) options.push({ title: "Instant Download", type: "instant", url: instant, priority: 3 });

        $('a[href*="/download/"]').each((i, el) => {
           options.push({ title: $(el).text().trim(), type: "generic", url: $(el).attr("href").startsWith("http") ? $(el).attr("href") : `https://driveseed.org${$(el).attr("href")}`, priority: 4 });
        });
        
        return { downloadOptions: options.sort((a,b) => a.priority - b.priority), size };
      }
      return { downloadOptions: [], size: null };
    } catch (error) {
      return { downloadOptions: [], size: null };
    }
  });
}

function resolveResumeCloudLink(resumeUrl) {
  return __async(this, null, function* () {
    try {
      const html = yield (yield makeRequest(resumeUrl, { headers: { "Referer": "https://driveseed.org/" } })).text();
      return cheerio.load(html)('a:contains("Cloud Resume Download")').attr("href") || null;
    } catch (error) { return null; }
  });
}

function resolveVideoSeedLink(videoSeedUrl) {
  return __async(this, null, function* () {
    try {
      const urlParams = new URLSearchParams(new URL(videoSeedUrl).search);
      const keys = urlParams.get("url");
      if (keys) {
        const apiResponse = yield fetch(`${new URL(videoSeedUrl).origin}/api`, {
          method: "POST",
          body: new URLSearchParams({ "keys": keys }),
          headers: { "Content-Type": "application/x-www-form-urlencoded", "x-token": new URL(videoSeedUrl).hostname, "User-Agent": TV_UA }
        });
        const data = yield apiResponse.json();
        return data.url || null;
      }
      return null;
    } catch (error) { return null; }
  });
}

function validateVideoUrl(url) {
  return __async(this, null, function* () {
    try {
      const res = yield fetch(url, { method: "HEAD", headers: { "Range": "bytes=0-1", "User-Agent": TV_UA } });
      return res.ok || res.status === 206;
    } catch (error) { return false; }
  });
}

function getStreamsInternal(tmdbId, mediaType = "movie", seasonNum = null, episodeNum = null) {
  return __async(this, null, function* () {
    try {
      const tmdbUrl = `https://api.themoviedb.org/3/${mediaType === "tv" ? "tv" : "movie"}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
      const tmdbData = yield (yield makeRequest(tmdbUrl)).json();
      const title = mediaType === "tv" ? tmdbData.name : tmdbData.title;
      
      let searchResults = yield searchMoviesMod(mediaType === "tv" ? `${title} Season ${seasonNum}` : title);
      if (searchResults.length === 0) searchResults = yield searchMoviesMod(title);
      
      const best = findBestMatch(title, searchResults.map(r => r.title));
      if (best.bestMatchIndex === -1) return [];
      
      const selectedResult = searchResults[best.bestMatchIndex];
      const downloadLinks = (yield extractDownloadLinks(selectedResult.url)).filter(l => !l.quality.includes("480p"));
      
      const streamPromises = downloadLinks.map((link) => __async(this, null, function* () {
        const finalLinks = yield resolveIntermediateLink(link.url, selectedResult.url, link.quality);
        for (const target of finalLinks) {
          let currentUrl = target.url;
          if (currentUrl.includes("tech.") || currentUrl.includes("unblockedgames")) {
            currentUrl = yield resolveTechUnblockedLink(currentUrl);
          }
          if (currentUrl && currentUrl.includes("driveseed.org")) {
            const dsInfo = yield resolveDriveseedLink(currentUrl);
            for (const option of dsInfo.downloadOptions) {
              let finalUrl = null;
              if (option.type === "resume") finalUrl = yield resolveResumeCloudLink(option.url);
              else if (option.type === "instant") finalUrl = (yield resolveVideoSeedLink(option.url)) || option.url;
              else finalUrl = option.url;

              if (finalUrl && (yield validateVideoUrl(finalUrl))) {
                // TV Player requires these headers to bypass 403 on Driveseed
                return {
                  name: `MoviesMod [${target.server}]`,
                  title: `${title} - ${link.quality}`,
                  url: finalUrl,
                  quality: extractQuality(link.quality),
                  size: dsInfo.size || "Unknown",
                  headers: {
                    "User-Agent": TV_UA,
                    "Referer": "https://driveseed.org/"
                  }
                };
              }
            }
          }
        }
        return null;
      }));

      return (yield Promise.all(streamPromises)).filter(Boolean).sort((a, b) => parseQualityForSort(b.quality) - parseQualityForSort(a.quality));
    } catch (e) { return []; }
  });
}

// NUVIO PROVIDER INTERFACE
const source = {
  name: "MoviesMod",
  getStreams: function(input) {
    return __async(this, null, function* () {
      const { tmdbId, type, season, episode } = input;
      return yield getStreamsInternal(tmdbId, type === "tv" ? "tv" : "movie", season, episode);
    });
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = source;
} else {
  global.getStreams = source.getStreams;
}
