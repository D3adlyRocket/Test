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
      const response = yield fetch("https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json", {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      });
      if (response.ok) {
        const data = yield response.json();
        if (data && data.moviesmod) {
          moviesModDomain = data.moviesmod;
          domainCacheTimestamp = now;
        }
      }
    } catch (error) {}
    return moviesModDomain;
  });
}

function makeRequest(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const defaultHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Connection": "keep-alive"
    };
    const response = yield fetch(url, __spreadProps(__spreadValues({}, options), {
      headers: __spreadValues(__spreadValues({}, defaultHeaders), options.headers)
    }));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response;
  });
}

function extractQuality(text) {
  if (!text) return "Unknown";
  const qualityMatch = text.match(/(480p|720p|1080p|2160p|4k)/i);
  if (qualityMatch) return qualityMatch[1];
  return "Unknown";
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
        if (title && url) {
          results.push({ title, url });
        }
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
      const contentBox = $(".thecontent");
      const headers = contentBox.find('h3:contains("Season"), h4');
      headers.each((i, el) => {
        const header = $(el);
        const headerText = header.text().trim();
        const blockContent = header.nextUntil("h3, h4");
        if (header.is("h3") && headerText.toLowerCase().includes("season")) {
          const linkElements = blockContent.find("a").filter((i2, el2) => {
            const text = $(el2).text().trim().toLowerCase();
            return text.includes("episode links") && !text.includes("batch");
          });
          linkElements.each((j, linkEl) => {
            const buttonText = $(linkEl).text().trim();
            const linkUrl = $(linkEl).attr("href");
            if (linkUrl) {
              links.push({ quality: `${headerText} - ${buttonText}`, url: linkUrl });
            }
          });
        } else if (header.is("h4")) {
          const linkElement = blockContent.find("a.maxbutton-download-links, .maxbutton").first();
          if (linkElement.length > 0) {
            const link = linkElement.attr("href");
            const cleanQuality = extractQuality(headerText);
            if (link && cleanQuality) {
              links.push({ quality: cleanQuality, url: link });
            }
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
      if (urlObject.hostname.includes("links.modpro.blog") || urlObject.hostname.includes("posts.modpro.blog")) {
        const response = yield makeRequest(initialUrl, { headers: { "Referer": refererUrl } });
        const html = yield response.text();
        const $ = cheerio.load(html);
        const finalLinks = [];
        $('.entry-content a[href*="driveseed.org"], .entry-content a[href*="cloud.unblockedgames.world"], .entry-content a[href*="tech.creativeexpressionsblog.com"], .entry-content a[href*="tech.examzculture.in"]').each((i, el) => {
          const link = $(el).attr("href");
          const text = $(el).text().trim();
          if (link && text && !text.toLowerCase().includes("batch")) {
            finalLinks.push({ server: text.replace(/\s+/g, " "), url: link });
          }
        });
        return finalLinks;
      } else if (urlObject.hostname.includes("episodes.modpro.blog")) {
        const response = yield makeRequest(initialUrl, { headers: { "Referer": refererUrl } });
        const html = yield response.text();
        const $ = cheerio.load(html);
        const finalLinks = [];
        $("h3").each((i, el) => {
          const headerText = $(el).text().trim();
          const episodeMatch = headerText.match(/Episode\s+(\d+)/i);
          if (episodeMatch) {
            const episodeNum = episodeMatch[1];
            const linkElement = $(el).find("a").first();
            if (linkElement.length > 0) {
              const link = linkElement.attr("href");
              if (link) {
                finalLinks.push({ server: `Episode ${episodeNum}`, url: link });
              }
            }
          }
        });
        return finalLinks;
      } else if (urlObject.hostname.includes("modrefer.in")) {
        const encodedUrl = urlObject.searchParams.get("url");
        if (!encodedUrl) return [];
        const decodedUrl = atob(encodedUrl);
        const response = yield makeRequest(decodedUrl, { headers: { "Referer": refererUrl } });
        const html = yield response.text();
        const $ = cheerio.load(html);
        const finalLinks = [];
        $("a").each((i, el) => {
          const link = $(el).attr("href");
          const text = $(el).text().trim();
          if (link && (link.includes("driveseed.org") || link.includes("cloud.unblockedgames.world") || link.includes("tech.examzculture.in") || link.includes("tech.creativeexpressionsblog.com") || link.includes("tech.examdegree.site"))) {
            finalLinks.push({ server: text || "Download Link", url: link });
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
      const html = yield response.text();
      const $ = cheerio.load(html);
      const initialForm = $("#landing");
      const wp_http_step1 = initialForm.find('input[name="_wp_http"]').val();
      const action_url_step1 = initialForm.attr("action");
      if (!wp_http_step1 || !action_url_step1) return null;
      const step1Data = new URLSearchParams({ "_wp_http": wp_http_step1 });
      const responseStep1 = yield makeRequest(action_url_step1, {
        method: "POST",
        headers: { "Referer": sidUrl, "Content-Type": "application/x-www-form-urlencoded" },
        body: step1Data.toString()
      });
      const html2 = yield responseStep1.text();
      const $2 = cheerio.load(html2);
      const verificationForm = $2("#landing");
      const action_url_step2 = verificationForm.attr("action");
      const wp_http2 = verificationForm.find('input[name="_wp_http2"]').val();
      const token = verificationForm.find('input[name="token"]').val();
      if (!action_url_step2) return null;
      const step2Data = new URLSearchParams({ "_wp_http2": wp_http2, "token": token });
      const responseStep2 = yield makeRequest(action_url_step2, {
        method: "POST",
        headers: { "Referer": responseStep1.url, "Content-Type": "application/x-www-form-urlencoded" },
        body: step2Data.toString()
      });
      const finalHtml = yield responseStep2.text();
      let finalLinkPath = null, cookieName = null, cookieValue = null;
      const cookieMatch = finalHtml.match(/s_343\('([^']+)',\s*'([^']+)'/);
      const linkMatch = finalHtml.match(/c\.setAttribute\("href",\s*"([^"]+)"\)/);
      if (cookieMatch) { cookieName = cookieMatch[1].trim(); cookieValue = cookieMatch[2].trim(); }
      if (linkMatch) finalLinkPath = linkMatch[1].trim();
      if (!finalLinkPath || !cookieName || !cookieValue) return null;
      const { origin } = new URL(sidUrl);
      const finalUrl = new URL(finalLinkPath, origin).href;
      const finalResponse = yield makeRequest(finalUrl, {
        headers: { "Referer": responseStep2.url, "Cookie": `${cookieName}=${cookieValue}` }
      });
      const metaHtml = yield finalResponse.text();
      const $3 = cheerio.load(metaHtml);
      const metaRefresh = $3('meta[http-equiv="refresh"]');
      if (metaRefresh.length > 0) {
        const content = metaRefresh.attr("content");
        const urlMatch = content.match(/url=(.*)/i);
        if (urlMatch && urlMatch[1]) {
          return urlMatch[1].replace(/"/g, "").replace(/'/g, "");
        }
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
      if (redirectMatch && redirectMatch[1]) {
        const finalPath = redirectMatch[1];
        const finalUrl = `https://driveseed.org${finalPath}`;
        const finalResponse = yield makeRequest(finalUrl, { headers: { "Referer": driveseedUrl } });
        const finalHtml = yield finalResponse.text();
        const $ = cheerio.load(finalHtml);
        const downloadOptions = [];
        let size = null, fileName = null;
        $("ul.list-group li").each((i, el) => {
          const text = $(el).text();
          if (text.includes("Size :")) size = text.split(":")[1].trim();
          else if (text.includes("Name :")) fileName = text.split(":")[1].trim();
        });
        const resumeCloudLink = $('a:contains("Resume Cloud")').attr("href");
        if (resumeCloudLink) downloadOptions.push({ title: "Resume Cloud", type: "resume", url: `https://driveseed.org${resumeCloudLink}`, priority: 1 });
        const workerSeedLink = $('a:contains("Resume Worker Bot")').attr("href");
        if (workerSeedLink) downloadOptions.push({ title: "Resume Worker Bot", type: "worker", url: workerSeedLink, priority: 2 });
        $('a[href*="/download/"]').each((i, el) => {
          const href = $(el).attr("href");
          const text = $(el).text().trim();
          if (href && text && !downloadOptions.some((opt) => opt.url === href)) {
            downloadOptions.push({ title: text, type: "generic", url: href.startsWith("http") ? href : `https://driveseed.org${href}`, priority: 4 });
          }
        });
        const instantDownloadLink = $('a:contains("Instant Download")').attr("href");
        if (instantDownloadLink) downloadOptions.push({ title: "Instant Download", type: "instant", url: instantDownloadLink, priority: 3 });
        downloadOptions.sort((a, b) => a.priority - b.priority);
        return { downloadOptions, size, fileName };
      }
      return { downloadOptions: [], size: null, fileName: null };
    } catch (error) {
      return { downloadOptions: [], size: null, fileName: null };
    }
  });
}

function resolveResumeCloudLink(resumeUrl) {
  return __async(this, null, function* () {
    try {
      const response = yield makeRequest(resumeUrl, { headers: { "Referer": "https://driveseed.org/" } });
      const html = yield response.text();
      const $ = cheerio.load(html);
      const downloadLink = $('a:contains("Cloud Resume Download")').attr("href");
      return downloadLink || null;
    } catch (error) {
      return null;
    }
  });
}

function resolveVideoSeedLink(videoSeedUrl) {
  return __async(this, null, function* () {
    try {
      const urlParams = new URLSearchParams(new URL(videoSeedUrl).search);
      const keys = urlParams.get("url");
      if (keys) {
        const apiUrl = `${new URL(videoSeedUrl).origin}/api`;
        const formData = new URLSearchParams();
        formData.append("keys", keys);
        const apiResponse = yield fetch(apiUrl, {
          method: "POST",
          body: formData,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "x-token": new URL(videoSeedUrl).hostname,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        });
        if (apiResponse.ok) {
          const responseData = yield apiResponse.json();
          if (responseData && responseData.url) return responseData.url;
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  });
}

function validateVideoUrl(url) {
  return __async(this, null, function* () {
    try {
      const response = yield fetch(url, {
        method: "HEAD",
        headers: {
          "Range": "bytes=0-1",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      });
      return response.ok || response.status === 206;
    } catch (error) {
      return false;
    }
  });
}

async function getStreamsInternal(tmdbId, mediaType = "movie", seasonNum = null, episodeNum = null) {
  try {
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType === "tv" ? "tv" : "movie"}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    const tmdbResponse = yield makeRequest(tmdbUrl);
    const tmdbData = yield tmdbResponse.json();
    const title = mediaType === "tv" ? tmdbData.name : tmdbData.title;
    const year = mediaType === "tv" ? tmdbData.first_air_date?.substring(0, 4) : tmdbData.release_date?.substring(0, 4);
    const imdbId = tmdbData.external_ids ? tmdbData.external_ids.imdb_id : null;
    
    let searchResults = [];
    let selectedResult = null;

    if (imdbId) {
      const imdbQuery = mediaType === "tv" && seasonNum ? `${imdbId} Season ${seasonNum}` : imdbId;
      searchResults = yield searchMoviesMod(imdbQuery);
      if (searchResults.length > 0) selectedResult = searchResults[0];
    }

    if (!selectedResult) {
      const titleQuery = mediaType === "tv" && seasonNum ? `${title} Season ${seasonNum}` : title;
      searchResults = yield searchMoviesMod(titleQuery);
      if (searchResults.length === 0) searchResults = yield searchMoviesMod(title);
      if (searchResults.length > 0) {
        const titles = searchResults.map((r) => r.title);
        const bestMatch = findBestMatch(title, titles);
        if (bestMatch.bestMatch.rating > 0.3) {
          selectedResult = searchResults[bestMatch.bestMatchIndex];
        }
      }
    }

    if (!selectedResult) return [];
    const downloadLinks = yield extractDownloadLinks(selectedResult.url);
    let relevantLinks = downloadLinks;
    if ((mediaType === "tv" || mediaType === "series") && seasonNum !== null) {
      relevantLinks = downloadLinks.filter((link) => link.quality.toLowerCase().includes(`season ${seasonNum}`) || link.quality.toLowerCase().includes(`s${seasonNum}`));
    }
    relevantLinks = relevantLinks.filter((link) => !link.quality.toLowerCase().includes("480p"));

    const streamPromises = relevantLinks.map((link) => __async(this, null, function* () {
      const finalLinks = yield resolveIntermediateLink(link.url, selectedResult.url, link.quality);
      if (!finalLinks || finalLinks.length === 0) return null;
      for (const targetLink of finalLinks) {
        let currentUrl = targetLink.url;
        const isEpisodeLink = targetLink.server && targetLink.server.toLowerCase().includes("episode");
        if (currentUrl.includes("cloud.unblockedgames.world") || currentUrl.includes("tech.creativeexpressionsblog.com") || currentUrl.includes("tech.examzculture.in")) {
          currentUrl = yield resolveTechUnblockedLink(currentUrl);
          if (!currentUrl) continue;
        }
        if (currentUrl && currentUrl.includes("driveseed.org")) {
          const driveseedInfo = yield resolveDriveseedLink(currentUrl);
          if (driveseedInfo && driveseedInfo.downloadOptions?.length > 0) {
            for (const option of driveseedInfo.downloadOptions) {
              let finalDownloadUrl = null;
              if (option.type === "resume" || option.type === "worker") finalDownloadUrl = yield resolveResumeCloudLink(option.url);
              else if (option.type === "instant") finalDownloadUrl = (yield resolveVideoSeedLink(option.url)) || option.url;
              else if (option.type === "generic") finalDownloadUrl = option.url;

              if (finalDownloadUrl && (yield validateVideoUrl(finalDownloadUrl))) {
                if (isEpisodeLink && episodeNum !== null) {
                  const episodeFromServer = targetLink.server.match(/Episode\s+(\d+)/i);
                  if (episodeFromServer && parseInt(episodeFromServer[1]) !== episodeNum) continue;
                }
                return {
                  name: `MoviesMod ${targetLink.server || ""}`.trim(),
                  title: `${title} - ${link.quality}`,
                  url: finalDownloadUrl,
                  quality: link.quality,
                  size: driveseedInfo.size || "Unknown",
                  headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Referer": "https://driveseed.org/"
                  }
                };
              }
            }
          }
        }
      }
      return null;
    }));

    const rawStreams = yield Promise.all(streamPromises);
    const streams = rawStreams.filter(Boolean).sort((a, b) => parseQualityForSort(b.quality) - parseQualityForSort(a.quality));
    return streams;
  } catch (e) {
    return [];
  }
}

// Nuvio App Standard Export
const source = {
  name: "MoviesMod",
  getStreams: function(input) {
    return __async(this, null, function* () {
      const { tmdbId, type, season, episode } = input;
      const mediaType = type === "tv" ? "tv" : "movie";
      return yield getStreamsInternal(tmdbId, mediaType, season, episode);
    });
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = source;
} else {
  global.source = source;
}
