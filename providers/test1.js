const PROVIDER_NAME = "4kHDHub";
const BASE_URL = "https://4khdhub.one";
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const TIMEOUT = 12000;

const MOBILE_UAS = [
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
];

var currentSessionUA = MOBILE_UAS[0];

function getHeaders(extra) {
  var h = {
    "User-Agent": currentSessionUA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9"
  };
  if (extra) { for (var k in extra) { h[k] = extra[k]; } }
  return h;
}

async function fetchWithTimeout(url, options, timeout) {
  var merged = { ...(options || {}) };
  if (!merged.headers) merged.headers = getHeaders();
  var tp = timeout || TIMEOUT;
  var fetchPromise = fetch(url, merged);
  var timeoutPromise = new Promise(function (_, reject) {
    setTimeout(function () { reject(new Error("timeout")); }, tp);
  });
  return await Promise.race([fetchPromise, timeoutPromise]);
}

async function fetchText(url, options) {
  try {
    var res = await fetchWithTimeout(url, options);
    if (res && res.ok) return await res.text();
    return null;
  } catch (e) {
    console.log("[" + PROVIDER_NAME + "] fetchText: " + (e.message || e));
    return null;
  }
}

async function fetchJson(url, options) {
  try {
    var res = await fetchWithTimeout(url, options);
    if (res && res.ok) return await res.json();
    return null;
  } catch (e) {
    return null;
  }
}

function parseQuality(text) {
  var t = String(text || "");
  var m = t.match(/(2160|1080|720|480)\s*p/i);
  if (m) return m[1].toLowerCase() + "p";
  if (/\b4K\b|\bUHD\b/i.test(t)) return "2160p";
  return "HD";
}

function base64Decode(str) {
  var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  var res = "", i = 0;
  str = String(str || "").replace(/[^A-Za-z0-9\+\/\=]/g, "");
  while (i < str.length) {
    var e1 = b64.indexOf(str.charAt(i++));
    var e2 = b64.indexOf(str.charAt(i++));
    var e3 = b64.indexOf(str.charAt(i++));
    var e4 = b64.indexOf(str.charAt(i++));
    var c1 = (e1 << 2) | (e2 >> 4);
    var c2 = ((e2 & 15) << 4) | (e3 >> 2);
    var c3 = ((e3 & 3) << 6) | e4;
    res += String.fromCharCode(c1);
    if (e3 != 64) res += String.fromCharCode(c2);
    if (e4 != 64) res += String.fromCharCode(c3);
  }
  return res;
}

function makeStream(name, title, url, quality, serverType, referer, fileSize) {
  var encodedUrl = url.replace(/ /g, "%20");
  var text = String(name || "").replace(/\./g, " ");

  // 1. Language Parsing (Strict Multi-Audio vs Single Logic)
  var lang = "Multi-Audio";
  var hasHindi = /\bhindi\b/i.test(text);
  var hasEng = /\benglish\b/i.test(text);
  var hasTamil = /\btamil\b/i.test(text);
  var hasTelugu = /\btelugu\b/i.test(text);
  var hasDualMulti = /\b(dual|multi|hindi\s*eng|eng\s*hin)\b/i.test(text);

  if (!hasDualMulti) {
    if (hasEng && !hasHindi && !hasTamil && !hasTelugu) lang = "English";
    else if (hasHindi && !hasEng && !hasTamil && !hasTelugu) lang = "Hindi";
  }

  // 2. Title & Year Cleaning
  var cleanTitle = "4KHDHub Link";
  var year = "";
  var yearMatch = text.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    year = yearMatch[0];
    var titleEndIdx = text.indexOf(year);
    if (titleEndIdx > 0) {
      cleanTitle = text.substring(0, titleEndIdx).replace(/[-_()]/g, " ").replace(/\s+/g, " ").trim();
    }
  } else {
    var cleanMatch = text.match(/^([^(\[.]+)/);
    if (cleanMatch) cleanTitle = cleanMatch[1].trim();
  }
  cleanTitle = cleanTitle.replace(/\s+-\s*$/, "").trim();
  cleanTitle = cleanTitle.replace(/\b\w/g, function (c) { return c.toUpperCase(); });

  // 3. Line 3 Properties (Fixed HDR10+ Priority and Dynamic BluRay Check)
  var qEmoji = quality === "2160p" ? "🌟" : "💎";
  
  var dynamicHdr = "SDR";
  if (/\bhdr10\+\b/i.test(text)) dynamicHdr = "HDR10+";
  else if (/\bhdr10\b/i.test(text)) dynamicHdr = "HDR10";
  else if (/\bhdr\b/i.test(text)) dynamicHdr = "HDR";

  var bitDepth = /\b10bit\b/i.test(text) ? "🔆 10Bit" : "";
  
  var isBluRay = /\bbluray\b/i.test(text);
  var discSource = isBluRay ? "📀 BluRay" : "☁️ WEB-DL"; 

  var dv = /\b(dv|dolby\s*vision)\b/i.test(text) ? "🕵️‍♀️DV" : "";
  
  var codec = "x264";
  if (/\b(hevc|x265|265)\b/i.test(text)) codec = "HEVC x265";
  else if (/\b(x264|264)\b/i.test(text)) codec = "x264";

  var sub3Left = [dynamicHdr, bitDepth].filter(Boolean).join(" • ");
  var sub3Right = [discSource, dv].filter(Boolean).join(" • ");
  var line3 = "⚡ " + sub3Left + " | " + sub3Right + " | 🎥 " + codec;

  // 4. Container Format
  var format = "🎞️ MKV";
  if (/\bmp4\b/i.test(text) || url.toLowerCase().indexOf(".mp4") > -1) format = "🎞️ MP4";

  // 5. Audio Parsing (Fixed DDP Priority Check over DD)
  var audioLabel = "🎧 DD 5.1"; 
  var channels = "5.1";
  if (/\b7\.1\b/.test(text)) channels = "7.1";
  else if (/\b2\.0\b/.test(text)) channels = "2.0";

  if (/\btruehd\b/i.test(text)) {
    audioLabel = "🎧 TrueHD " + (channels === "5.1" ? "7.1" : channels);
  } else if (/\b(ddp|dd\+|eac3)\b/i.test(text)) {
    audioLabel = "🎧 DDP " + channels;
  } else if (/\b(dd|ac3)\b/i.test(text)) {
    audioLabel = "🎧 DD " + channels;
  } else if (/\baac\b/i.test(text)) {
    audioLabel = "🎧 AAC " + channels;
  }

  var atmos = /\batmos\b/i.test(text) ? "• 🔊 Atmos" : "";
  var line4 = format + " | " + audioLabel + (atmos ? " " + atmos : "");

  // 6. Line 5 Properties 
  var sourceTag = isBluRay ? "BluRay" : "WEB-DL";
  if (/\bwebrip\b/i.test(text)) sourceTag = "WEB-Rip";

  var imax = /\bimax\b/i.test(text) ? " | 👁️ iMAX" : "";
  var line5 = "🔗 " + (serverType || "Worker") + " | ☁️ " + sourceTag + imax;

  // Final Output Formatting
  var qUpper = quality.toUpperCase();
  var finalName = "4KHDHub | " + qUpper + " | " + lang;
  
  var finalTitle = 
    "🎬 " + cleanTitle + (year ? " - (" + year + ")" : "") + "\n" +
    qEmoji + " " + qUpper + " | 🌍 " + lang + (fileSize ? " | 💾 " + fileSize : "") + "\n" +
    line3 + "\n" +
    line4 + " |\n" +
    line5;

  return {
    name: finalName,
    title: finalTitle,
    url: encodedUrl,
    quality: quality,
    behaviorHints: { 
      notWebReady: true,
      proxyHeaders: { request: { "Referer": referer || BASE_URL + "/" } }
    }
  };
}

async function getTMDBInfo(tmdbId, mediaType) {
  var type = (mediaType === "tv" || mediaType === "series") ? "tv" : "movie";
  try {
    var url = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + TMDB_API_KEY;
    var data = await fetchJson(url);
    if (data) {
      return {
        title: type === "tv" ? data.name : data.title,
        year: (data.first_air_date || data.release_date || "").split("-")[0]
      };
    }
  } catch (e) {}
  return { title: String(tmdbId), year: null };
}

async function searchSite(query) {
  var searchUrl = BASE_URL + "/?s=" + encodeURIComponent(query);
  var html = await fetchText(searchUrl);
  if (!html) return [];

  var results = [];
  var seen = {};
  var linkRegex = /href="(\/[^"]+)"/g;
  var m;

  while ((m = linkRegex.exec(html)) !== null) {
    var path = m[1];
    if (seen[path]) continue;
    seen[path] = true;
    if (path.indexOf("/category/") > -1 || path.indexOf("?") > -1) continue;

    var isSeries = path.indexOf("-series-") > -1;
    var isMovie = path.indexOf("-movie-") > -1;
    if (!isSeries && !isMovie) continue;

    var parts = path.split("-");
    var slugParts = [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === "series" || parts[i] === "movie") break;
      if (/^\d+$/.test(parts[i])) continue;
      slugParts.push(parts[i]);
    }
    var scrapedTitle = slugParts.join(" ").replace(/-/g, " ").replace(/\s+/g, " ").trim();
    scrapedTitle = scrapedTitle.replace(/\b\w/g, function (c) { return c.toUpperCase(); });

    var yearMatch = path.match(/\b(19|20)\d{2}\b/);
    var year = yearMatch ? yearMatch[0] : null;

    results.push({
      url: BASE_URL + path,
      title: scrapedTitle,
      year: year,
      isSeries: isSeries
    });
  }

  return results;
}

function findEpisodeHubLinks(html, targetSeason, targetEpisode) {
  var episodes = [];

  var epTabStart = html.indexOf('id="episodes"');
  if (epTabStart < 0) return episodes;

  var epContent = html.substring(epTabStart);

  var hubRegex = /https?:\/\/hubcloud\.(?:foo|to|bar)\/drive\/([a-z0-9]+)/g;
  var hubMatch;

  while ((hubMatch = hubRegex.exec(epContent)) !== null) {
    var hubUrl = hubMatch[0];
    var pos = hubMatch.index;
    var before = epContent.substring(Math.max(0, pos - 2000), pos);

    var seMatch = before.match(/S0*(\d+)\s*E0*(\d+)/i);
    if (!seMatch) continue;

    var sNum = parseInt(seMatch[1]);
    var eNum = parseInt(seMatch[2]);
    if (sNum !== targetSeason || eNum !== targetEpisode) continue;

    var qualityMatch = before.match(/(\d{3,4})p/i);
    var quality = qualityMatch ? qualityMatch[1].toLowerCase() + "p" : "HD";

    var sizeMatch = before.match(/badge-size[^>]*>([\d.]+)\s*(GB|MB)/i);
    var fileSize = sizeMatch ? sizeMatch[1] + " " + sizeMatch[2] : "";

    var fileMatch = before.match(/([A-Za-z0-9 ._\-,()[\]]*?(?:S0*\d+\s*E0*\d+)[A-Za-z0-9 ._\-,()[\]]*?\.(?:mkv|mp4))/i);
    var label = fileMatch ? fileMatch[1].trim() : ("S" + sNum + "E" + eNum);

    episodes.push({ hubUrl: hubUrl, quality: quality, label: label, size: fileSize });
  }

  return episodes;
}

function findMovieHubLinks(html) {
  var links = [];

  var hubRegex = /https?:\/\/hubcloud\.(?:foo|to|bar)\/drive\/([a-z0-9]+)/g;
  var hubMatch;
  var seen = {};

  while ((hubMatch = hubRegex.exec(html)) !== null) {
    var hubUrl = hubMatch[0];
    if (seen[hubUrl]) continue;
    seen[hubUrl] = true;

    var pos = hubMatch.index;
    var before = html.substring(Math.max(0, pos - 1000), pos);

    var qualityMatch = before.match(/(\d{3,4})p/i);
    var quality = qualityMatch ? qualityMatch[1].toLowerCase() + "p" : "HD";

    var fileMatch = before.match(/<div[^>]*class=['"][^'"]*file-title[^'"]*['"][^>]*>([^<]+)</i);
    var label = fileMatch ? fileMatch[1].trim() : quality;
    if (fileMatch) {
      var fileQ = parseQuality(fileMatch[1]);
      if (fileQ !== "HD") quality = fileQ;
    }

    var sizeMatch = before.match(/>([\d.]+)\s*(GB|MB)</);
    var fileSize = sizeMatch ? sizeMatch[1] + " " + sizeMatch[2] : "";

    links.push({ hubUrl: hubUrl, quality: quality, label: label, size: fileSize });
  }

  return links;
}

async function resolveHubCloud(hubUrl, fallbackSize) {
  var streams = [];

  try {
    var hcHtml = await fetchText(hubUrl, { headers: getHeaders({ "Referer": BASE_URL + "/" }) });
    if (!hcHtml) return streams;

    var gamerUrl = null;
    var gamerMatch = hcHtml.match(/href="([^"]+gamerxyt\.com[^"]+)"/i);
    if (gamerMatch) {
      gamerUrl = gamerMatch[1].replace(/&amp;/g, "&");
    }

    var xHrefMatch = hcHtml.match(/x-href="([^"]+)"/i);
    if (!gamerUrl && xHrefMatch) {
      try {
        var decoded = base64Decode(xHrefMatch[1]);
        if (decoded.indexOf("gamerxyt") > -1) gamerUrl = decoded;
      } catch (e) {}
    }

    var targetHtml = hcHtml;

    if (gamerUrl) {
      var gamerHtml = await fetchText(gamerUrl, { headers: getHeaders({ "Referer": hubUrl }) });
      if (gamerHtml) targetHtml = gamerHtml;
    }

    var headerMatch = targetHtml.match(/<div[^>]*class=['"][^'"]*card-header[^'"]*['"][^>]*>([^<]+)</i);
    var filename = headerMatch ? headerMatch[1].trim() : "";
    var quality = parseQuality(filename);

    var allLinks = targetHtml.split(/<a\s/);
    for (var li = 1; li < allLinks.length; li++) {
      var tag = allLinks[li];
      var hrefMatch = tag.match(/href=['"]([^'"]+)['"]/);
      if (!hrefMatch) continue;
      var linkUrl = hrefMatch[1];
      if (linkUrl.indexOf(".zip") > -1 || linkUrl.indexOf("#") === 0 || linkUrl.indexOf(".r2.dev") > -1) continue;

      var idMatch = tag.match(/id=['"]([^'"]+)['"]/i);
      var linkId = idMatch ? idMatch[1].toLowerCase() : "";

      var serverMatch = tag.match(/Download\s*\[([^\]]+)\]/i);
      var serverName = serverMatch ? serverMatch[1] : "";
      var lowerServer = serverName.toLowerCase();

      if (serverName && lowerServer.indexOf("10gbps") > -1) continue;
      if (serverName && lowerServer.indexOf("zipdisk") > -1) continue;

      var type = "";

      if (linkId === "fsl" || lowerServer.indexOf("fsl server") > -1 || lowerServer.indexOf("[fsl]") > -1) {
        type = "FSL";
      } else if (linkId === "s3" || lowerServer.indexOf("fslv2") > -1) {
        type = "FSLv2";
      } else if (linkUrl.indexOf(".workers.dev") > -1) {
        type = "Worker";
      }

      if (type) {
        var q = quality || "HD";
        var finalUrl = linkUrl;
        if (type === "FSL" && finalUrl.indexOf("?s=") === -1) {
          finalUrl = finalUrl + (finalUrl.indexOf("?") > -1 ? "&" : "?") + "s=" + (1 + new Date().getMinutes());
        }
        var sizeForDisplay = fallbackSize || "";
        var displayName = filename ? filename : (serverName || type);
        streams.push(makeStream(
          displayName,
          serverName || type,
          finalUrl,
          q,
          type,
          gamerUrl || hubUrl,
          sizeForDisplay
        ));
      }
    }
  } catch (e) {
    console.log("[" + PROVIDER_NAME + "] resolveHubCloud error: " + (e.message || e));
  }

  return streams;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  currentSessionUA = MOBILE_UAS[Math.floor(Math.random() * MOBILE_UAS.length)];

  var isTv = (mediaType === "tv" || mediaType === "series");
  var allStreams = [];

  try {
    var media = await getTMDBInfo(tmdbId, mediaType);
    var searchTitle = media.title;
    var mediaYear = media.year;

    console.log("[" + PROVIDER_NAME + "] Searching: " + searchTitle + (mediaYear ? " (" + mediaYear + ")" : ""));

    var searchResults = await searchSite(searchTitle);
    if (searchResults.length === 0 && mediaYear) {
      searchResults = await searchSite(searchTitle + " " + mediaYear);
    }
    if (searchResults.length === 0 && searchTitle !== shortQuery) {
      var shortQuery = searchTitle.replace(/'/g, "").replace(/[^a-z0-9\s]/gi, " ").replace(/\s+/g, " ").trim();
      if (shortQuery.length > 3) {
        searchResults = await searchSite(shortQuery);
      }
    }

    if (searchResults.length === 0) {
      console.log("[" + PROVIDER_NAME + "] No search results found");
      return allStreams;
    }

    var bestMatch = null;
    var searchNorm = searchTitle.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

    for (var i = 0; i < searchResults.length; i++) {
      var r = searchResults[i];
      if (isTv && !r.isSeries) continue;
      if (!isTv && r.isSeries) continue;

      var rNorm = r.title.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
      if (rNorm.indexOf(searchNorm) === -1 && searchNorm.indexOf(rNorm) === -1) {
        continue;
      }

      if (!bestMatch) bestMatch = r;

      if (mediaYear && r.year === mediaYear) {
        bestMatch = r;
        break;
      }
    }

    if (!bestMatch) {
      console.log("[" + PROVIDER_NAME + "] No matching " + (isTv ? "series" : "movie") + " post found");
      return allStreams;
    }

    console.log("[" + PROVIDER_NAME + "] Matched: " + bestMatch.url);

    var postHtml = await fetchText(bestMatch.url, { headers: getHeaders({ "Referer": BASE_URL + "/" }) });
    if (!postHtml) return allStreams;

    var hubLinks;
    if (isTv && season != null && episode != null) {
      var targetS = parseInt(season);
      var targetE = parseInt(episode);
      hubLinks = findEpisodeHubLinks(postHtml, targetS, targetE);
      console.log("[" + PROVIDER_NAME + "] Found " + hubLinks.length + " HubCloud links for S" + targetS + "E" + targetE);
    } else {
      hubLinks = findMovieHubLinks(postHtml);
      console.log("[" + PROVIDER_NAME + "] Found " + hubLinks.length + " HubCloud links for movie");
    }

    for (var j = 0; j < hubLinks.length; j++) {
      try {
        var resolved = await resolveHubCloud(hubLinks[j].hubUrl, hubLinks[j].size);
        for (var k = 0; k < resolved.length; k++) {
          if (hubLinks[j].quality && hubLinks[j].quality !== "HD") {
            resolved[k].quality = hubLinks[j].quality;
          }
          allStreams.push(resolved[k]);
        }
      } catch (e) {}
    }

    var seen = {};
    allStreams = allStreams.filter(function (s) {
      if (!s || !s.url || seen[s.url]) return false;
      seen[s.url] = true;
      return true;
    });

  } catch (e) {
    console.log("[" + PROVIDER_NAME + "] Fatal: " + (e.message || e));
  }

  return allStreams;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
