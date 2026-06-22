/**
 * hdmulti - Built from src/hdmulti/
 * Generated: 2026-04-17T10:31:18.195Z
 */
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
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

// providers/uhdmovies.js
var require_uhdmovies = __commonJS({
  "providers/uhdmovies.js"(exports2, module2) {
    "use strict";
    var cheerio = require("cheerio-without-node-native");
    var DOMAIN = "https://uhdmovies.ink";
    var DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
    var DOMAIN_CACHE = { url: DOMAIN, ts: 0 };
    function getLatestDomain() {
      const now = Date.now();
      if (now - DOMAIN_CACHE.ts < 36e5)
        return Promise.resolve(DOMAIN_CACHE.url);
      return fetch(DOMAINS_URL).then((res) => res.json()).then((data) => {
        if (data && data["UHDMovies"]) {
          DOMAIN_CACHE.url = data["UHDMovies"];
          DOMAIN_CACHE.ts = now;
        }
        return DOMAIN_CACHE.url;
      }).catch(() => DOMAIN_CACHE.url);
    }
    var TMDB_API = "https://api.themoviedb.org/3";
    var TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
    var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    function getBaseUrl(url) {
      try {
        var urlObj = new URL(url);
        return urlObj.protocol + "//" + urlObj.host;
      } catch (e) {
        return DOMAIN;
      }
    }
    function fixUrl(url, domain) {
      if (!url)
        return "";
      if (url.startsWith("http"))
        return url;
      if (url.startsWith("//"))
        return "https:" + url;
      if (url.startsWith("/"))
        return domain + url;
      return domain + "/" + url;
    }
    function getIndexQuality2(str) {
      if (!str)
        return "Unknown";
      var match = str.match(/(\d{3,4})[pP]/);
      if (match)
        return match[1] + "p";
      if (str.toUpperCase().includes("4K") || str.toUpperCase().includes("UHD"))
        return "2160p";
      return "Unknown";
    }
    function cleanTitle(title) {
      var parts = title.split(/[.\-_]/);
      var qualityTags = ["WEBRip", "WEB-DL", "WEB", "BluRay", "HDRip", "DVDRip", "HDTV", "CAM", "TS", "R5", "DVDScr", "BRRip", "BDRip", "DVD", "PDTV", "HD"];
      var audioTags = ["AAC", "AC3", "DTS", "MP3", "FLAC", "DD5", "EAC3", "Atmos"];
      var subTags = ["ESub", "ESubs", "Subs", "MultiSub", "NoSub", "EnglishSub", "HindiSub"];
      var codecTags = ["x264", "x265", "H264", "HEVC", "AVC"];
      var startIndex = parts.findIndex(function(part2) {
        return qualityTags.some(function(tag) {
          return part2.toLowerCase().includes(tag.toLowerCase());
        });
      });
      var endIndex = -1;
      for (var i = parts.length - 1; i >= 0; i--) {
        var part = parts[i];
        if (subTags.some(function(tag) {
          return part.toLowerCase().includes(tag.toLowerCase());
        }) || audioTags.some(function(tag) {
          return part.toLowerCase().includes(tag.toLowerCase());
        }) || codecTags.some(function(tag) {
          return part.toLowerCase().includes(tag.toLowerCase());
        })) {
          endIndex = i;
          break;
        }
      }
      if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
        return parts.slice(startIndex, endIndex + 1).join(".");
      } else if (startIndex !== -1) {
        return parts.slice(startIndex).join(".");
      }
      return parts.slice(-3).join(".");
    }
    function searchByTitle(title, year) {
      return getLatestDomain().then(function(domain) {
        var query = encodeURIComponent((title + " " + (year || "")).trim());
        var searchUrl = domain + "/?s=" + query;
        console.log("[UHDMovies] Search URL: " + searchUrl);
        return fetch(searchUrl, {
          headers: { "User-Agent": USER_AGENT }
        }).then(function(response) {
          return response.text();
        }).then(function(html) {
          console.log("[UHDMovies] Response length: " + html.length + " bytes");
          return parseSearchResults(html);
        }).catch(function(error) {
          console.error("[UHDMovies] Search failed:", error.message);
          return [];
        });
      });
    }
    function parseSearchResults(html) {
      var $ = cheerio.load(html);
      var results = [];
      $("article.gridlove-post").each(function(_, el) {
        var $el = $(el);
        var titleRaw = $el.find("h1.sanket").text().trim().replace(/^Download\s+/i, "");
        var titleMatch = titleRaw.match(/^(.*\)\d*)/);
        var title = titleMatch ? titleMatch[1] : titleRaw;
        var href = $el.find("div.entry-image > a").attr("href");
        if (href && title) {
          results.push({
            title,
            url: href,
            rawTitle: titleRaw
          });
        }
      });
      console.log("[UHDMovies] Found " + results.length + " search results");
      return results;
    }
    function bypassHrefli(url) {
      var host = getBaseUrl(url);
      console.log("[UHDMovies] Bypassing Hrefli: " + url);
      return fetch(url, { headers: { "User-Agent": USER_AGENT } }).then(function(res) {
        return res.text();
      }).then(function(html) {
        var $ = cheerio.load(html);
        var formUrl = $("form#landing").attr("action");
        var formData = {};
        $("form#landing input").each(function(_, el) {
          formData[$(el).attr("name")] = $(el).attr("value") || "";
        });
        return fetch(formUrl, {
          method: "POST",
          headers: {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams(formData).toString()
        });
      }).then(function(res) {
        return res.text();
      }).then(function(html) {
        var $ = cheerio.load(html);
        var formUrl = $("form#landing").attr("action");
        var formData = {};
        $("form#landing input").each(function(_, el) {
          formData[$(el).attr("name")] = $(el).attr("value") || "";
        });
        return fetch(formUrl, {
          method: "POST",
          headers: {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams(formData).toString()
        }).then(function(res) {
          return { response: res, formData };
        });
      }).then(function(result) {
        return result.response.text().then(function(html) {
          return { html, formData: result.formData };
        });
      }).then(function(result) {
        var $ = cheerio.load(result.html);
        var script = $("script:contains(?go=)").html() || "";
        var skTokenMatch = script.match(/\?go=([^"]+)/);
        if (!skTokenMatch)
          return null;
        var skToken = skTokenMatch[1];
        var wpHttp2 = result.formData["_wp_http2"] || "";
        return fetch(host + "?go=" + skToken, {
          headers: {
            "User-Agent": USER_AGENT,
            "Cookie": skToken + "=" + wpHttp2
          }
        });
      }).then(function(res) {
        if (!res)
          return null;
        return res.text();
      }).then(function(html) {
        if (!html)
          return null;
        var $ = cheerio.load(html);
        var metaRefresh = $('meta[http-equiv="refresh"]').attr("content") || "";
        var driveUrlMatch = metaRefresh.match(/url=(.+)/);
        if (!driveUrlMatch)
          return null;
        return driveUrlMatch[1];
      }).then(function(driveUrl) {
        if (!driveUrl)
          return null;
        return fetch(driveUrl, { headers: { "User-Agent": USER_AGENT } }).then(function(res) {
          return res.text();
        }).then(function(html) {
          var pathMatch = html.match(/replace\("([^"]+)"\)/);
          if (!pathMatch || pathMatch[1] === "/404")
            return null;
          return fixUrl(pathMatch[1], getBaseUrl(driveUrl));
        });
      }).catch(function(error) {
        console.error("[UHDMovies] Hrefli bypass failed:", error.message);
        return null;
      });
    }
    function extractVideoSeed(finallink) {
      console.log("[UHDMovies] Extracting VideoSeed: " + finallink);
      try {
        var urlObj = new URL(finallink);
        var host = urlObj.host || "video-seed.xyz";
        var token = finallink.split("?url=")[1];
        if (!token)
          return Promise.resolve(null);
        return fetch("https://" + host + "/api", {
          method: "POST",
          headers: {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
            "x-token": host,
            "Referer": finallink
          },
          body: "keys=" + encodeURIComponent(token)
        }).then(function(res) {
          return res.text();
        }).then(function(text) {
          var urlMatch = text.match(/url":"([^"]+)"/);
          if (urlMatch) {
            return urlMatch[1].replace(/\\\//g, "/");
          }
          return null;
        }).catch(function(error) {
          console.error("[UHDMovies] VideoSeed extraction failed:", error.message);
          return null;
        });
      } catch (e) {
        return Promise.resolve(null);
      }
    }
    function extractInstantLink(finallink) {
      console.log("[UHDMovies] Extracting InstantLink: " + finallink);
      try {
        var urlObj = new URL(finallink);
        var host = urlObj.host;
        if (!host) {
          host = finallink.includes("video-leech") ? "video-leech.pro" : "video-seed.pro";
        }
        var token = finallink.split("url=")[1];
        if (!token)
          return Promise.resolve(null);
        return fetch("https://" + host + "/api", {
          method: "POST",
          headers: {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
            "x-token": host,
            "Referer": finallink
          },
          body: "keys=" + encodeURIComponent(token)
        }).then(function(res) {
          return res.text();
        }).then(function(text) {
          var urlMatch = text.match(/url":"([^"]+)"/);
          if (urlMatch) {
            return urlMatch[1].replace(/\\\//g, "/");
          }
          return null;
        }).catch(function(error) {
          console.error("[UHDMovies] InstantLink extraction failed:", error.message);
          return null;
        });
      } catch (e) {
        return Promise.resolve(null);
      }
    }
    function extractResumeBot(url) {
      console.log("[UHDMovies] Extracting ResumeBot: " + url);
      return fetch(url, { headers: { "User-Agent": USER_AGENT } }).then(function(res) {
        return res.text();
      }).then(function(html) {
        var tokenMatch = html.match(/formData\.append\('token', '([a-f0-9]+)'\)/);
        var pathMatch = html.match(/fetch\('\/download\?id=([a-zA-Z0-9\/+]+)'/);
        if (!tokenMatch || !pathMatch)
          return null;
        var token = tokenMatch[1];
        var path = pathMatch[1];
        var baseUrl = url.split("/download")[0];
        return fetch(baseUrl + "/download?id=" + path, {
          method: "POST",
          headers: {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "*/*",
            "Origin": baseUrl,
            "Referer": url
          },
          body: "token=" + encodeURIComponent(token)
        });
      }).then(function(res) {
        if (!res)
          return null;
        return res.text();
      }).then(function(text) {
        if (!text)
          return null;
        try {
          var json = JSON.parse(text);
          return json.url && json.url.startsWith("http") ? json.url : null;
        } catch (e) {
          return null;
        }
      }).catch(function(error) {
        console.error("[UHDMovies] ResumeBot extraction failed:", error.message);
        return null;
      });
    }
    function extractCFType1(url) {
      console.log("[UHDMovies] Extracting CFType1: " + url);
      return fetch(url + "?type=1", { headers: { "User-Agent": USER_AGENT } }).then(function(res) {
        return res.text();
      }).then(function(html) {
        var $ = cheerio.load(html);
        var links = [];
        $("a.btn-success").each(function(_, el) {
          var href = $(el).attr("href");
          if (href && href.startsWith("http")) {
            links.push(href);
          }
        });
        return links;
      }).catch(function(error) {
        console.error("[UHDMovies] CFType1 extraction failed:", error.message);
        return [];
      });
    }
    function extractResumeCloudLink(baseUrl, path) {
      console.log("[UHDMovies] Extracting ResumeCloud: " + baseUrl + path);
      return fetch(baseUrl + path, { headers: { "User-Agent": USER_AGENT } }).then(function(res) {
        return res.text();
      }).then(function(html) {
        var $ = cheerio.load(html);
        var link2 = $("a.btn-success").first().attr("href");
        return link2 && link2.startsWith("http") ? link2 : null;
      }).catch(function(error) {
        console.error("[UHDMovies] ResumeCloud extraction failed:", error.message);
        return null;
      });
    }
    function extractDriveseedPage(url) {
      console.log("[UHDMovies] Extracting Driveseed page: " + url);
      var streams = [];
      return Promise.resolve().then(function() {
        if (url.includes("r?key=")) {
          return fetch(url, { headers: { "User-Agent": USER_AGENT } }).then(function(res) {
            return res.text();
          }).then(function(html) {
            var redirectMatch = html.match(/replace\("([^"]+)"\)/);
            if (redirectMatch) {
              var baseDomain = getBaseUrl(url);
              return fetch(baseDomain + redirectMatch[1], { headers: { "User-Agent": USER_AGENT } }).then(function(res) {
                return res.text();
              });
            }
            return html;
          });
        }
        return fetch(url, { headers: { "User-Agent": USER_AGENT } }).then(function(res) {
          return res.text();
        });
      }).then(function(html) {
        var $ = cheerio.load(html);
        var baseDomain = getBaseUrl(url);
        var qualityText = $("li.list-group-item").first().text() || "";
        var rawFileName = qualityText.replace("Name : ", "").trim();
        var fileName = cleanTitle(rawFileName);
        var size = $("li:nth-child(3)").text().replace("Size : ", "").trim();
        var quality = getIndexQuality2(qualityText);
        var labelExtras = "";
        if (fileName)
          labelExtras += "[" + fileName + "]";
        if (size)
          labelExtras += "[" + size + "]";
        var promises = [];
        $("div.text-center > a").each(function(_, el) {
          var text = $(el).text();
          var href = $(el).attr("href");
          if (!href)
            return;
          if (text.toLowerCase().includes("instant download")) {
            promises.push(
              extractInstantLink(href).then(function(link2) {
                if (link2) {
                  streams.push({
                    name: "UHDMovies",
                    title: "Driveseed Instant " + labelExtras,
                    url: link2,
                    quality,
                    size
                  });
                }
              })
            );
          } else if (text.toLowerCase().includes("resume worker bot")) {
            promises.push(
              extractResumeBot(href).then(function(link2) {
                if (link2) {
                  streams.push({
                    name: "UHDMovies",
                    title: "Driveseed ResumeBot " + labelExtras,
                    url: link2,
                    quality,
                    size
                  });
                }
              })
            );
          } else if (text.toLowerCase().includes("direct links")) {
            promises.push(
              extractCFType1(baseDomain + href).then(function(links) {
                links.forEach(function(link2) {
                  streams.push({
                    name: "UHDMovies",
                    title: "Driveseed Direct " + labelExtras,
                    url: link2,
                    quality,
                    size
                  });
                });
              })
            );
          } else if (text.toLowerCase().includes("resume cloud")) {
            promises.push(
              extractResumeCloudLink(baseDomain, href).then(function(link2) {
                if (link2) {
                  streams.push({
                    name: "UHDMovies",
                    title: "Driveseed ResumeCloud " + labelExtras,
                    url: link2,
                    quality,
                    size
                  });
                }
              })
            );
          } else if (text.toLowerCase().includes("cloud download")) {
            streams.push({
              name: "UHDMovies",
              title: "Driveseed Cloud " + labelExtras,
              url: href,
              quality,
              size
            });
          }
        });
        return Promise.all(promises).then(function() {
          return streams;
        });
      }).catch(function(error) {
        console.error("[UHDMovies] Driveseed extraction failed:", error.message);
        return [];
      });
    }
    function getMovieLinks(pageUrl) {
      console.log("[UHDMovies] Getting movie links from: " + pageUrl);
      return fetch(pageUrl, { headers: { "User-Agent": USER_AGENT } }).then(function(res) {
        return res.text();
      }).then(function(html) {
        var $ = cheerio.load(html);
        var links = [];
        var iframeRegex = /\[.*\]/;
        $("div.entry-content > p").each(function(_, el) {
          var $el = $(el);
          var elHtml = $.html(el);
          if (iframeRegex.test(elHtml)) {
            var sourceName = $el.text().split("Download")[0].trim();
            var nextEl = $el.next();
            var sourceLink = nextEl.find("a.maxbutton-1").attr("href") || "";
            if (sourceLink) {
              links.push({
                sourceName,
                sourceLink
              });
            }
          }
        });
        console.log("[UHDMovies] Found " + links.length + " movie links");
        return links;
      }).catch(function(error) {
        console.error("[UHDMovies] Movie links extraction failed:", error.message);
        return [];
      });
    }
    function getTvEpisodeLink(pageUrl, targetSeason, targetEpisode) {
      console.log("[UHDMovies] Getting TV episode S" + targetSeason + "E" + targetEpisode + " from: " + pageUrl);
      return fetch(pageUrl, { headers: { "User-Agent": USER_AGENT } }).then(function(res) {
        return res.text();
      }).then(function(html) {
        var $ = cheerio.load(html);
        var links = [];
        var pTags = $("p:has(a:contains(Episode))");
        if (pTags.length === 0) {
          pTags = $("div:has(a:contains(Episode))");
        }
        var currentSeason = 1;
        pTags.each(function(_, pTag) {
          var $pTag = $(pTag);
          var prevPtag = $pTag.prev();
          var details = prevPtag.text() || "";
          var seasonMatch = details.match(/(?:Season |S0?)(\d+)/i);
          if (seasonMatch) {
            currentSeason = parseInt(seasonMatch[1]);
          }
          if (currentSeason === targetSeason) {
            var aTags = $pTag.find("a:contains(Episode)");
            aTags.each(function(idx, aTag) {
              var episodeNum = idx + 1;
              if (episodeNum === targetEpisode) {
                var link2 = $(aTag).attr("href");
                if (link2) {
                  var qualityMatch = details.match(/(1080p|720p|480p|2160p|4K|\d+0p)/i);
                  var sizeMatch = details.match(/(\d+(?:\.\d+)?\s*(?:MB|GB))/i);
                  links.push({
                    sourceLink: link2,
                    quality: qualityMatch ? qualityMatch[1] : "Unknown",
                    size: sizeMatch ? sizeMatch[1] : null,
                    details
                  });
                }
              }
            });
          }
          currentSeason++;
        });
        console.log("[UHDMovies] Found " + links.length + " episode links for S" + targetSeason + "E" + targetEpisode);
        return links;
      }).catch(function(error) {
        console.error("[UHDMovies] TV episode extraction failed:", error.message);
        return [];
      });
    }
    function getTmdbDetails(tmdbId, mediaType) {
      var isSeries = mediaType === "series" || mediaType === "tv";
      var endpoint = isSeries ? "tv" : "movie";
      var url = TMDB_API + "/" + endpoint + "/" + tmdbId + "?api_key=" + TMDB_API_KEY;
      console.log("[UHDMovies] Fetching TMDB details from: " + url);
      return fetch(url).then(function(res) {
        return res.json();
      }).then(function(data) {
        if (isSeries) {
          return {
            title: data.name,
            year: data.first_air_date ? parseInt(data.first_air_date.split("-")[0]) : null
          };
        } else {
          return {
            title: data.title,
            year: data.release_date ? parseInt(data.release_date.split("-")[0]) : null
          };
        }
      }).catch(function(error) {
        console.error("[UHDMovies] TMDB request failed:", error.message);
        return null;
      });
    }
    function getStreams2(tmdbId, mediaType, season, episode) {
      console.log("[UHDMovies] Searching for " + mediaType + " " + tmdbId);
      var allStreams = [];
      return getTmdbDetails(tmdbId, mediaType).then(function(tmdbDetails) {
        if (!tmdbDetails) {
          console.log("[UHDMovies] Could not get TMDB details");
          return [];
        }
        var title = tmdbDetails.title;
        var year = tmdbDetails.year;
        console.log("[UHDMovies] Search: " + title + " (" + year + ")");
        return searchByTitle(title, year);
      }).then(function(searchResults) {
        if (!searchResults || searchResults.length === 0) {
          console.log("[UHDMovies] No results found");
          return [];
        }
        var isSeries = mediaType === "series" || mediaType === "tv";
        var processResult = function(index) {
          if (index >= searchResults.length) {
            return Promise.resolve(allStreams);
          }
          var result = searchResults[index];
          console.log("[UHDMovies] Processing result: " + result.title);
          var linksPromise;
          if (isSeries && season && episode) {
            linksPromise = getTvEpisodeLink(result.url, season, episode);
          } else {
            linksPromise = getMovieLinks(result.url);
          }
          return linksPromise.then(function(links) {
            var extractPromises = links.map(function(linkData) {
              var sourceLink = linkData.sourceLink;
              if (!sourceLink)
                return Promise.resolve([]);
              var finalLinkPromise;
              if (sourceLink.includes("unblockedgames")) {
                finalLinkPromise = bypassHrefli(sourceLink);
              } else {
                finalLinkPromise = Promise.resolve(sourceLink);
              }
              return finalLinkPromise.then(function(finalLink) {
                if (!finalLink)
                  return [];
                if (finalLink.includes("driveseed") || finalLink.includes("driveleech")) {
                  return extractDriveseedPage(finalLink);
                }
                if (finalLink.includes("video-seed")) {
                  return extractVideoSeed(finalLink).then(function(url) {
                    if (url) {
                      return [{
                        name: "UHDMovies",
                        title: "UHDMovies " + (linkData.quality || "Unknown"),
                        url,
                        quality: linkData.quality || "Unknown",
                        size: linkData.size
                      }];
                    }
                    return [];
                  });
                }
                return [{
                  name: "UHDMovies",
                  title: "UHDMovies " + (linkData.sourceName || linkData.quality || ""),
                  url: finalLink,
                  quality: linkData.quality || "Unknown",
                  size: linkData.size
                }];
              });
            });
            return Promise.all(extractPromises).then(function(results) {
              results.forEach(function(streams) {
                allStreams = allStreams.concat(streams);
              });
              return processResult(index + 1);
            });
          });
        };
        return processResult(0);
      }).catch(function(error) {
        console.error("[UHDMovies] Error:", error.message);
        return [];
      });
    }
    module2.exports = { getStreams: getStreams2 };
  }
});

// providers/4khdhub.js
var require_khdhub = __commonJS({
  "providers/4khdhub.js"(exports2, module2) {
    "use strict";
    var __defProp2 = Object.defineProperty;
    var __defProps2 = Object.defineProperties;
    var __getOwnPropDescs2 = Object.getOwnPropertyDescriptors;
    var __getOwnPropSymbols2 = Object.getOwnPropertySymbols;
    var __hasOwnProp2 = Object.prototype.hasOwnProperty;
    var __propIsEnum2 = Object.prototype.propertyIsEnumerable;
    var __defNormalProp2 = (obj, key, value) => key in obj ? __defProp2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
    var __spreadValues2 = (a, b) => {
      for (var prop in b || (b = {}))
        if (__hasOwnProp2.call(b, prop))
          __defNormalProp2(a, prop, b[prop]);
      if (__getOwnPropSymbols2)
        for (var prop of __getOwnPropSymbols2(b)) {
          if (__propIsEnum2.call(b, prop))
            __defNormalProp2(a, prop, b[prop]);
        }
      return a;
    };
    var __spreadProps2 = (a, b) => __defProps2(a, __getOwnPropDescs2(b));
    var __async2 = (__this, __arguments, generator) => {
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
    var BASE_URL = "https://4khdhub.dad";
    var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
    var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
    var DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
    var domainCache = { url: BASE_URL, ts: 0 };
    function fetchLatestDomain() {
      return __async2(this, null, function* () {
        const now = Date.now();
        if (now - domainCache.ts < 36e5)
          return domainCache.url;
        try {
          const response = yield fetch(DOMAINS_URL);
          const data = yield response.json();
          if (data && data["4khdhub"]) {
            domainCache.url = data["4khdhub"];
            domainCache.ts = now;
          }
        } catch (e) {
        }
        return domainCache.url;
      });
    }
    function fetchText(_0) {
      return __async2(this, arguments, function* (url, options = {}) {
        try {
          const response = yield fetch(url, {
            headers: __spreadValues2({
              "User-Agent": USER_AGENT
            }, options.headers)
          });
          return yield response.text();
        } catch (err) {
          console.log(`[4KHDHub] Request failed for ${url}: ${err.message}`);
          return null;
        }
      });
    }
    function getTmdbDetails(tmdbId, type) {
      return __async2(this, null, function* () {
        const isSeries = type === "series" || type === "tv";
        const endpoint = isSeries ? "tv" : "movie";
        const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        console.log(`[4KHDHub] Fetching TMDB details from: ${url}`);
        try {
          const response = yield fetch(url);
          const data = yield response.json();
          if (isSeries) {
            return {
              title: data.name,
              year: data.first_air_date ? parseInt(data.first_air_date.split("-")[0]) : 0
            };
          } else {
            return {
              title: data.title,
              year: data.release_date ? parseInt(data.release_date.split("-")[0]) : 0
            };
          }
        } catch (error) {
          console.log(`[4KHDHub] TMDB request failed: ${error.message}`);
          return null;
        }
      });
    }
    function atob(input) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
      let str = String(input).replace(/=+$/, "");
      if (str.length % 4 === 1) {
        throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
      }
      let output = "";
      for (let bc = 0, bs, buffer, i = 0; buffer = str.charAt(i++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
        buffer = chars.indexOf(buffer);
      }
      return output;
    }
    function rot13Cipher(str) {
      return str.replace(/[a-zA-Z]/g, function(c) {
        return String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26);
      });
    }
    function levenshteinDistance(s, t) {
      if (s === t)
        return 0;
      const n = s.length;
      const m = t.length;
      if (n === 0)
        return m;
      if (m === 0)
        return n;
      const d = [];
      for (let i = 0; i <= n; i++) {
        d[i] = [];
        d[i][0] = i;
      }
      for (let j = 0; j <= m; j++) {
        d[0][j] = j;
      }
      for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
          const cost = s.charAt(i - 1) === t.charAt(j - 1) ? 0 : 1;
          d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        }
      }
      return d[n][m];
    }
    function parseBytes(val) {
      if (typeof val === "number")
        return val;
      if (!val)
        return 0;
      const match = val.match(/^([0-9.]+)\s*([a-zA-Z]+)$/);
      if (!match)
        return 0;
      const num = parseFloat(match[1]);
      const unit = match[2].toLowerCase();
      let multiplier = 1;
      if (unit.indexOf("k") === 0)
        multiplier = 1024;
      else if (unit.indexOf("m") === 0)
        multiplier = 1024 * 1024;
      else if (unit.indexOf("g") === 0)
        multiplier = 1024 * 1024 * 1024;
      else if (unit.indexOf("t") === 0)
        multiplier = 1024 * 1024 * 1024 * 1024;
      return num * multiplier;
    }
    function formatBytes(val) {
      if (val === 0)
        return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB", "TB"];
      let i = Math.floor(Math.log(val) / Math.log(k));
      if (i < 0)
        i = 0;
      return parseFloat((val / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }
    var cheerio = require("cheerio-without-node-native");
    function fetchPageUrl(name, year, isSeries) {
      return __async2(this, null, function* () {
        const domain = yield fetchLatestDomain();
        const searchUrl = `${domain}/?s=${encodeURIComponent(name + " " + year)}`;
        console.log(`[4KHDHub] Search Request URL: ${searchUrl}`);
        const html = yield fetchText(searchUrl);
        if (!html) {
          console.log("[4KHDHub] Search failed: No HTML response");
          return null;
        }
        const $ = cheerio.load(html);
        const targetType = isSeries ? "Series" : "Movies";
        console.log(`[4KHDHub] Parsing search results for type: ${targetType}`);
        const matchingCards = $(".movie-card").filter((_, el) => {
          const hasFormat = $(el).find(`.movie-card-format:contains("${targetType}")`).length > 0;
          if (!hasFormat) {
          }
          return hasFormat;
        }).filter((_, el) => {
          const metaText = $(el).find(".movie-card-meta").text();
          const movieCardYear = parseInt(metaText);
          const yearMatch = !isNaN(movieCardYear) && Math.abs(movieCardYear - year) <= 1;
          if (!yearMatch) {
            console.log(`[4KHDHub] Skip: Year mismatch (${movieCardYear} vs ${year}) - ${$(el).find(".movie-card-title").text().trim()}`);
          }
          return yearMatch;
        }).filter((_, el) => {
          const movieCardTitle = $(el).find(".movie-card-title").text().replace(/\[.*?]/g, "").trim();
          const distance = levenshteinDistance(movieCardTitle.toLowerCase(), name.toLowerCase());
          const match = distance < 5;
          console.log(`[4KHDHub] Checking: "${movieCardTitle}" (Dist: ${distance}) vs "${name}"`);
          return match;
        }).map((_, el) => {
          let href = $(el).attr("href");
          if (href && !href.startsWith("http")) {
            href = domain + (href.startsWith("/") ? "" : "/") + href;
          }
          return href;
        }).get();
        if (matchingCards.length === 0) {
          console.log("[4KHDHub] No matching cards found after filtering");
        } else {
          console.log(`[4KHDHub] Found ${matchingCards.length} matching cards`);
        }
        return matchingCards.length > 0 ? matchingCards[0] : null;
      });
    }
    var cheerio2 = require("cheerio-without-node-native");
    function resolveRedirectUrl(redirectUrl) {
      return __async2(this, null, function* () {
        const redirectHtml = yield fetchText(redirectUrl);
        if (!redirectHtml)
          return null;
        try {
          const redirectDataMatch = redirectHtml.match(/'o','(.*?)'/);
          if (!redirectDataMatch)
            return null;
          const step1 = atob(redirectDataMatch[1]);
          const step2 = atob(step1);
          const step3 = rot13Cipher(step2);
          const step4 = atob(step3);
          const redirectData = JSON.parse(step4);
          if (redirectData && redirectData.o) {
            return atob(redirectData.o);
          }
        } catch (e) {
          console.log(`[4KHDHub] Error resolving redirect: ${e.message}`);
        }
        return null;
      });
    }
    function extractSourceResults($, el) {
      return __async2(this, null, function* () {
        const localHtml = $(el).html();
        const sizeMatch = localHtml.match(/([\d.]+ ?[GM]B)/);
        const heightMatch = localHtml.match(/\d{3,}p/);
        const title = $(el).find(".file-title, .episode-file-title").text().trim();
        let height = heightMatch ? parseInt(heightMatch[0]) : 0;
        if (height === 0 && (title.includes("4K") || title.includes("4k") || localHtml.includes("4K") || localHtml.includes("4k"))) {
          height = 2160;
        }
        const meta = {
          bytes: sizeMatch ? parseBytes(sizeMatch[1]) : 0,
          height,
          title
        };
        const hubCloudLink = $(el).find("a").filter((_, a) => $(a).text().includes("HubCloud")).attr("href");
        if (hubCloudLink) {
          const resolved = yield resolveRedirectUrl(hubCloudLink);
          return { url: resolved, meta };
        }
        const hubDriveLink = $(el).find("a").filter((_, a) => $(a).text().includes("HubDrive")).attr("href");
        if (hubDriveLink) {
          const resolvedDrive = yield resolveRedirectUrl(hubDriveLink);
          if (resolvedDrive) {
            const hubDriveHtml = yield fetchText(resolvedDrive);
            if (hubDriveHtml) {
              const $2 = cheerio2.load(hubDriveHtml);
              const innerCloudLink = $2('a:contains("HubCloud")').attr("href");
              if (innerCloudLink) {
                return { url: innerCloudLink, meta };
              }
            }
          }
        }
        return null;
      });
    }
    function extractHubCloud(hubCloudUrl, baseMeta) {
      return __async2(this, null, function* () {
        if (!hubCloudUrl)
          return [];
        const redirectHtml = yield fetchText(hubCloudUrl, { headers: { Referer: hubCloudUrl } });
        if (!redirectHtml)
          return [];
        const redirectUrlMatch = redirectHtml.match(/var url ?= ?'(.*?)'/);
        if (!redirectUrlMatch)
          return [];
        const finalLinksUrl = redirectUrlMatch[1];
        const linksHtml = yield fetchText(finalLinksUrl, { headers: { Referer: hubCloudUrl } });
        if (!linksHtml)
          return [];
        const $ = cheerio2.load(linksHtml);
        const results = [];
        const sizeText = $("#size").text();
        const titleText = $("title").text().trim();
        const currentMeta = __spreadProps2(__spreadValues2({}, baseMeta), {
          bytes: parseBytes(sizeText) || baseMeta.bytes,
          title: titleText || baseMeta.title
        });
        $("a").each((_, el) => {
          const text = $(el).text();
          const href = $(el).attr("href");
          if (!href)
            return;
          if (text.includes("FSL") || text.includes("Download File")) {
            results.push({
              source: "FSL",
              url: href,
              meta: currentMeta
            });
          } else if (text.includes("PixelServer")) {
            const pixelUrl = href.replace("/u/", "/api/file/");
            results.push({
              source: "PixelServer",
              url: pixelUrl,
              meta: currentMeta
            });
          }
        });
        return results;
      });
    }
    var cheerio3 = require("cheerio-without-node-native");
    function getStreams2(tmdbId, type, season, episode) {
      return __async2(this, null, function* () {
        const tmdbDetails = yield getTmdbDetails(tmdbId, type);
        if (!tmdbDetails)
          return [];
        const { title, year } = tmdbDetails;
        console.log(`[4KHDHub] Search: ${title} (${year})`);
        const isSeries = type === "series" || type === "tv";
        const pageUrl = yield fetchPageUrl(title, year, isSeries);
        if (!pageUrl) {
          console.log("[4KHDHub] Page not found");
          return [];
        }
        console.log(`[4KHDHub] Found page: ${pageUrl}`);
        const html = yield fetchText(pageUrl);
        if (!html)
          return [];
        const $ = cheerio3.load(html);
        const itemsToProcess = [];
        if (isSeries && season && episode) {
          const seasonStr = "S" + String(season).padStart(2, "0");
          const episodeStr = "Episode-" + String(episode).padStart(2, "0");
          $(".episode-item").each((_, el) => {
            if ($(".episode-title", el).text().includes(seasonStr)) {
              const downloadItems = $(".episode-download-item", el).filter((_2, item) => $(item).text().includes(episodeStr));
              downloadItems.each((_2, item) => {
                itemsToProcess.push(item);
              });
            }
          });
        } else {
          $(".download-item").each((_, el) => {
            itemsToProcess.push(el);
          });
        }
        console.log(`[4KHDHub] Processing ${itemsToProcess.length} items`);
        const streamPromises = itemsToProcess.map((item) => __async2(this, null, function* () {
          try {
            const sourceResult = yield extractSourceResults($, item);
            if (sourceResult && sourceResult.url) {
              console.log(`[4KHDHub] Extracting from HubCloud: ${sourceResult.url}`);
              const extractedLinks = yield extractHubCloud(sourceResult.url, sourceResult.meta);
              return extractedLinks.map((link2) => ({
                name: `4KHDHub - ${link2.source}${sourceResult.meta.height ? ` ${sourceResult.meta.height}p` : ""}`,
                title: `${link2.meta.title}
${formatBytes(link2.meta.bytes || 0)}`,
                url: link2.url,
                quality: sourceResult.meta.height ? `${sourceResult.meta.height}p` : void 0,
                behaviorHints: {
                  bingeGroup: `4khdhub-${link2.source}`
                }
              }));
            }
            return [];
          } catch (err) {
            console.log(`[4KHDHub] Item processing error: ${err.message}`);
            return [];
          }
        }));
        const results = yield Promise.all(streamPromises);
        return results.reduce((acc, val) => acc.concat(val), []);
      });
    }
    module2.exports = { getStreams: getStreams2 };
  }
});

// providers/hdhub4u.js
var require_hdhub4u = __commonJS({
  "providers/hdhub4u.js"(exports2, module2) {
    var __create = Object.create;
    var __defProp2 = Object.defineProperty;
    var __defProps2 = Object.defineProperties;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropDescs2 = Object.getOwnPropertyDescriptors;
    var __getOwnPropNames2 = Object.getOwnPropertyNames;
    var __getOwnPropSymbols2 = Object.getOwnPropertySymbols;
    var __getProtoOf = Object.getPrototypeOf;
    var __hasOwnProp2 = Object.prototype.hasOwnProperty;
    var __propIsEnum2 = Object.prototype.propertyIsEnumerable;
    var __defNormalProp2 = (obj, key, value) => key in obj ? __defProp2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
    var __spreadValues2 = (a, b) => {
      for (var prop in b || (b = {}))
        if (__hasOwnProp2.call(b, prop))
          __defNormalProp2(a, prop, b[prop]);
      if (__getOwnPropSymbols2)
        for (var prop of __getOwnPropSymbols2(b)) {
          if (__propIsEnum2.call(b, prop))
            __defNormalProp2(a, prop, b[prop]);
        }
      return a;
    };
    var __spreadProps2 = (a, b) => __defProps2(a, __getOwnPropDescs2(b));
    var __copyProps = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames2(from))
          if (!__hasOwnProp2.call(to, key) && key !== except)
            __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
      // If the importer is in node compatibility mode or this is not an ESM
      // file that has been converted to a CommonJS file using a Babel-
      // compatible transform (i.e. "__esModule" has not been set), then set
      // "default" to the CommonJS "module.exports" for node compatibility.
      isNodeMode || !mod || !mod.__esModule ? __defProp2(target, "default", { value: mod, enumerable: true }) : target,
      mod
    ));
    var __async2 = (__this, __arguments, generator) => {
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
    var import_cheerio_without_node_native2 = __toESM(require("cheerio-without-node-native"));
    var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
    var TMDB_BASE_URL = "https://api.themoviedb.org/3";
    var MAIN_URL = "https://new3.hdhub4u.fo";
    var DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
    var DOMAIN_CACHE_TTL = 4 * 60 * 60 * 1e3;
    var HEADERS = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
      "Cookie": "xla=s4t",
      "Referer": `${MAIN_URL}/`
    };
    function updateMainUrl(url) {
      MAIN_URL = url;
      HEADERS.Referer = `${url}/`;
    }
    var domainCacheTimestamp = 0;
    function formatBytes(bytes) {
      if (!bytes || bytes === 0)
        return "Unknown";
      const k = 1024;
      const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    }
    function extractServerName(source) {
      if (!source)
        return "Unknown";
      if (source.startsWith("HubCloud")) {
        const serverMatch = source.match(/HubCloud(?:\s*-\s*([^[\]]+))?/);
        return serverMatch ? serverMatch[1] || "Download" : "HubCloud";
      }
      if (source.startsWith("Pixeldrain"))
        return "Pixeldrain";
      if (source.startsWith("StreamTape"))
        return "StreamTape";
      if (source.startsWith("HubCdn"))
        return "HubCdn";
      if (source.startsWith("HbLinks"))
        return "HbLinks";
      if (source.startsWith("Hubstream"))
        return "Hubstream";
      return source.replace(/^www\./, "").split(".")[0];
    }
    function rot13(value) {
      return value.replace(/[a-zA-Z]/g, function(c) {
        return String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26);
      });
    }
    var BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    function atob(value) {
      if (!value)
        return "";
      let input = String(value).replace(/=+$/, "");
      let output = "";
      let bc = 0, bs, buffer, idx = 0;
      while (buffer = input.charAt(idx++)) {
        buffer = BASE64_CHARS.indexOf(buffer);
        if (~buffer) {
          bs = bc % 4 ? bs * 64 + buffer : buffer;
          if (bc++ % 4) {
            output += String.fromCharCode(255 & bs >> (-2 * bc & 6));
          }
        }
      }
      return output;
    }
    function cleanTitle(title) {
      let name = title.replace(/\.[a-zA-Z0-9]{2,4}$/, "");
      const normalized = name.replace(/WEB[-_. ]?DL/gi, "WEB-DL").replace(/WEB[-_. ]?RIP/gi, "WEBRIP").replace(/H[ .]?265/gi, "H265").replace(/H[ .]?264/gi, "H264").replace(/DDP[ .]?([0-9]\.[0-9])/gi, "DDP$1");
      const parts = normalized.split(/[\s_.]/);
      const sourceTags = /* @__PURE__ */ new Set(["WEB-DL", "WEBRIP", "BLURAY", "HDRIP", "DVDRIP", "HDTV", "CAM", "TS", "BRRIP", "BDRIP"]);
      const codecTags = /* @__PURE__ */ new Set(["H264", "H265", "X264", "X265", "HEVC", "AVC"]);
      const audioTags = ["AAC", "AC3", "DTS", "MP3", "FLAC", "DD", "DDP", "EAC3"];
      const audioExtras = /* @__PURE__ */ new Set(["ATMOS"]);
      const hdrTags = /* @__PURE__ */ new Set(["SDR", "HDR", "HDR10", "HDR10+", "DV", "DOLBYVISION"]);
      const filtered = parts.map((part) => {
        const p = part.toUpperCase();
        if (sourceTags.has(p))
          return p;
        if (codecTags.has(p))
          return p;
        if (audioTags.some((tag) => p.startsWith(tag)))
          return p;
        if (audioExtras.has(p))
          return p;
        if (hdrTags.has(p))
          return p === "DOLBYVISION" || p === "DV" ? "DOLBYVISION" : p;
        if (p === "NF" || p === "CR")
          return p;
        return null;
      }).filter(Boolean);
      return [...new Set(filtered)].join(" ");
    }
    function fetchAndUpdateDomain() {
      return __async2(this, null, function* () {
        const now = Date.now();
        if (now - domainCacheTimestamp < DOMAIN_CACHE_TTL)
          return;
        console.log("[HDHub4u] Fetching latest domain...");
        try {
          const response = yield fetch(DOMAINS_URL, {
            method: "GET",
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
          });
          if (response.ok) {
            const data = yield response.json();
            if (data && data.HDHUB4u) {
              const newDomain = data.HDHUB4u;
              if (newDomain !== MAIN_URL) {
                console.log(`[HDHub4u] Updating domain from ${MAIN_URL} to ${newDomain}`);
                updateMainUrl(newDomain);
                domainCacheTimestamp = now;
              }
            }
          }
        } catch (error) {
          console.error(`[HDHub4u] Failed to fetch latest domains: ${error.message}`);
        }
      });
    }
    function getCurrentDomain() {
      return __async2(this, null, function* () {
        yield fetchAndUpdateDomain();
        return MAIN_URL;
      });
    }
    function normalizeTitle(title) {
      if (!title)
        return "";
      return title.toLowerCase().replace(/\b(the|a|an)\b/g, "").replace(/[:\-_]/g, " ").replace(/\s+/g, " ").replace(/[^\w\s]/g, "").trim();
    }
    function calculateTitleSimilarity(title1, title2) {
      const norm1 = normalizeTitle(title1);
      const norm2 = normalizeTitle(title2);
      if (norm1 === norm2)
        return 1;
      const words1 = norm1.split(/\s+/).filter((w) => w.length > 0);
      const words2 = norm2.split(/\s+/).filter((w) => w.length > 0);
      if (words1.length === 0 || words2.length === 0)
        return 0;
      const set1 = new Set(words1);
      const set2 = new Set(words2);
      const intersection = words1.filter((w) => set2.has(w));
      const union = /* @__PURE__ */ new Set([...words1, ...words2]);
      const jaccard = intersection.length / union.size;
      const extraWordsCount = words2.filter((w) => !set1.has(w)).length;
      let score = jaccard - extraWordsCount * 0.05;
      if (words1.length > 0 && words1.every((w) => set2.has(w))) {
        score += 0.2;
      }
      return score;
    }
    function findBestTitleMatch(mediaInfo, searchResults, mediaType, season) {
      if (!searchResults || searchResults.length === 0)
        return null;
      let bestMatch = null;
      let bestScore = 0;
      for (const result of searchResults) {
        let score = calculateTitleSimilarity(mediaInfo.title, result.title);
        if (mediaInfo.year && result.year) {
          const yearDiff = Math.abs(mediaInfo.year - result.year);
          if (yearDiff === 0)
            score += 0.2;
          else if (yearDiff <= 1)
            score += 0.1;
          else if (yearDiff > 5)
            score -= 0.3;
        }
        if (mediaType === "tv" && season) {
          const titleLower = result.title.toLowerCase();
          const seasonPatterns = [
            `season ${season}`,
            `s${season}`,
            `season ${season.toString().padStart(2, "0")}`,
            `s${season.toString().padStart(2, "0")}`
          ];
          const hasSeason = seasonPatterns.some((p) => titleLower.includes(p));
          const otherSeasonMatch = titleLower.match(/season\s*(\d+)|s(\d+)/i);
          if (otherSeasonMatch) {
            const foundSeason = parseInt(otherSeasonMatch[1] || otherSeasonMatch[2]);
            if (foundSeason !== season) {
              score -= 0.8;
            }
          }
          if (hasSeason)
            score += 0.5;
          else
            score -= 0.3;
        }
        if (result.title.toLowerCase().includes("2160p") || result.title.toLowerCase().includes("4k")) {
          score += 0.05;
        }
        if (score > bestScore && score > 0.3) {
          bestScore = score;
          bestMatch = result;
        }
      }
      if (bestMatch)
        console.log(`[HDHub4u] Best title match: "${bestMatch.title}" (score: ${bestScore.toFixed(2)})`);
      return bestMatch;
    }
    function getTMDBDetails(tmdbId, mediaType) {
      return __async2(this, null, function* () {
        var _a;
        const endpoint = mediaType === "tv" ? "tv" : "movie";
        const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
        const response = yield fetch(url, {
          method: "GET",
          headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" }
        });
        if (!response.ok)
          throw new Error(`TMDB API error: ${response.status}`);
        const data = yield response.json();
        const title = mediaType === "tv" ? data.name : data.title;
        const releaseDate = mediaType === "tv" ? data.first_air_date : data.release_date;
        const year = releaseDate ? parseInt(releaseDate.split("-")[0]) : null;
        return { title, year, imdbId: ((_a = data.external_ids) == null ? void 0 : _a.imdb_id) || null };
      });
    }
    var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
    var import_crypto_js = __toESM(require("crypto-js"));
    function getRedirectLinks(url) {
      return __async2(this, null, function* () {
        try {
          const response = yield fetch(url, { headers: HEADERS });
          if (!response.ok)
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          const doc = yield response.text();
          const regex = /s\s*\(\s*['"]o['"]\s*,\s*['"]([A-Za-z0-9+/=]+)['"]|ck\s*\(\s*['"]_wp_http_\d+['"]\s*,\s*['"]([^'"]+)['"]/g;
          let combinedString = "";
          let match;
          while ((match = regex.exec(doc)) !== null) {
            const extractedValue = match[1] || match[2];
            if (extractedValue)
              combinedString += extractedValue;
          }
          if (!combinedString) {
            const redirectMatch = doc.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/);
            if (redirectMatch && redirectMatch[1]) {
              const newUrl = redirectMatch[1];
              if (newUrl !== url && !newUrl.includes(url)) {
                return yield getRedirectLinks(newUrl);
              }
            }
            return null;
          }
          const decodedString = atob(rot13(atob(atob(combinedString))));
          const jsonObject = JSON.parse(decodedString);
          const encodedUrl = atob(jsonObject.o || "").trim();
          if (encodedUrl)
            return encodedUrl;
          const data = atob(jsonObject.data || "").trim();
          const wpHttp = (jsonObject.blog_url || "").trim();
          if (wpHttp && data) {
            const directLinkResponse = yield fetch(`${wpHttp}?re=${data}`, { headers: HEADERS });
            const html = yield directLinkResponse.text();
            const $ = import_cheerio_without_node_native.default.load(html);
            return ($("body").text() || html).trim();
          }
          return null;
        } catch (e) {
          return null;
        }
      });
    }
    function vidStackExtractor(url) {
      return __async2(this, null, function* () {
        var _a, _b, _c;
        try {
          const hash = url.split("#").pop().split("/").pop();
          const baseUrl = new URL(url).origin;
          const apiUrl = `${baseUrl}/api/v1/video?id=${hash}`;
          const response = yield fetch(apiUrl, { headers: __spreadProps2(__spreadValues2({}, HEADERS), { Referer: url }) });
          const encoded = (yield response.text()).trim();
          const key = import_crypto_js.default.enc.Utf8.parse("kiemtienmua911ca");
          const ivs = ["1234567890oiuytr", "0123456789abcdef"];
          for (const ivStr of ivs) {
            try {
              const iv = import_crypto_js.default.enc.Utf8.parse(ivStr);
              const decrypted = import_crypto_js.default.AES.decrypt(
                { ciphertext: import_crypto_js.default.enc.Hex.parse(encoded) },
                key,
                { iv, mode: import_crypto_js.default.mode.CBC, padding: import_crypto_js.default.pad.Pkcs7 }
              );
              const decryptedText = decrypted.toString(import_crypto_js.default.enc.Utf8);
              if (decryptedText && decryptedText.includes("source")) {
                const m3u8 = (_b = (_a = decryptedText.match(/"source":"(.*?)"/)) == null ? void 0 : _a[1]) == null ? void 0 : _b.replace(/\\/g, "");
                const subtitles = [];
                const subtitleSection = (_c = decryptedText.match(/"subtitle":\{(.*?)\}/)) == null ? void 0 : _c[1];
                if (subtitleSection) {
                  const subtitlePattern = /"([^"]+)":\s*"([^"]+)"/g;
                  let subMatch;
                  while ((subMatch = subtitlePattern.exec(subtitleSection)) !== null) {
                    const lang = subMatch[1];
                    const subPath = subMatch[2].split("#")[0].replace(/\\/g, "");
                    if (subPath) {
                      subtitles.push({
                        language: lang,
                        url: subPath.startsWith("http") ? subPath : `${baseUrl}${subPath}`
                      });
                    }
                  }
                }
                if (m3u8) {
                  return [{
                    source: "Vidstack Hubstream",
                    quality: "M3U8",
                    url: m3u8.replace("https:", "http:"),
                    headers: {
                      "Referer": url,
                      "Origin": url.split("/").pop()
                    },
                    subtitles
                  }];
                }
              }
            } catch (e) {
            }
          }
          return [];
        } catch (e) {
          return [];
        }
      });
    }
    function hbLinksExtractor(url) {
      return __async2(this, null, function* () {
        try {
          const response = yield fetch(url, { headers: __spreadProps2(__spreadValues2({}, HEADERS), { Referer: url }) });
          const data = yield response.text();
          const $ = import_cheerio_without_node_native.default.load(data);
          const links = $("h3 a, h5 a, div.entry-content p a").map((i, el) => $(el).attr("href")).get();
          const results = yield Promise.all(links.map((l) => loadExtractor(l, url)));
          return results.flat().map((link2) => __spreadProps2(__spreadValues2({}, link2), {
            source: `${link2.source} Hblinks`
          }));
        } catch (e) {
          return [];
        }
      });
    }
    function pixelDrainExtractor(link2) {
      return __async2(this, null, function* () {
        var _a;
        try {
          const urlObj = new URL(link2);
          const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
          const fileId = ((_a = link2.match(/(?:file|u)\/([A-Za-z0-9]+)/)) == null ? void 0 : _a[1]) || link2.split("/").pop();
          if (!fileId)
            return [{ source: "Pixeldrain", quality: 0, url: link2 }];
          const finalUrl = link2.includes("?download") ? link2 : `${baseUrl}/api/file/${fileId}?download`;
          return [{ source: "Pixeldrain", quality: 0, url: finalUrl }];
        } catch (e) {
          return [{ source: "Pixeldrain", quality: 0, url: link2 }];
        }
      });
    }
    function streamTapeExtractor(link2) {
      return __async2(this, null, function* () {
        var _a, _b, _c, _d;
        try {
          const url = new URL(link2);
          url.hostname = "streamtape.com";
          const res = yield fetch(url.toString(), { headers: HEADERS });
          const data = yield res.text();
          let videoSrc = (_c = (_b = (_a = data.match(/document\.getElementById\('videolink'\)\.innerHTML = (.*?);/)) == null ? void 0 : _a[1]) == null ? void 0 : _b.match(/'(\/\/streamtape\.com\/get_video[^']+)'/)) == null ? void 0 : _c[1];
          if (!videoSrc) {
            videoSrc = (_d = data.match(/'(\/\/streamtape\.com\/get_video[^']+)'/)) == null ? void 0 : _d[1];
          }
          return videoSrc ? [{ source: "StreamTape", quality: 720, url: "https:" + videoSrc }] : [];
        } catch (e) {
          return [];
        }
      });
    }
    function hubCloudExtractor(url, referer) {
      return __async2(this, null, function* () {
        var _a;
        try {
          let currentUrl = url.replace("hubcloud.ink", "hubcloud.dad");
          const pageResponse = yield fetch(currentUrl, { headers: __spreadProps2(__spreadValues2({}, HEADERS), { Referer: referer }) });
          let pageData = yield pageResponse.text();
          let finalUrl = currentUrl;
          if (!currentUrl.includes("hubcloud.php")) {
            let nextHref = "";
            const $first = import_cheerio_without_node_native.default.load(pageData);
            const downloadBtn = $first("#download");
            if (downloadBtn.length) {
              nextHref = downloadBtn.attr("href");
            } else {
              const scriptUrlMatch = pageData.match(/var url = '([^']*)'/);
              if (scriptUrlMatch)
                nextHref = scriptUrlMatch[1];
            }
            if (nextHref) {
              if (!nextHref.startsWith("http")) {
                const urlObj = new URL(currentUrl);
                nextHref = `${urlObj.protocol}//${urlObj.hostname}/${nextHref.replace(/^\//, "")}`;
              }
              finalUrl = nextHref;
              const secondResponse = yield fetch(finalUrl, { headers: __spreadProps2(__spreadValues2({}, HEADERS), { Referer: currentUrl }) });
              pageData = yield secondResponse.text();
            }
          }
          const $ = import_cheerio_without_node_native.default.load(pageData);
          const size = $("i#size").text().trim();
          const header = $("div.card-header").text().trim();
          const qualityStr = (_a = header.match(/(\d{3,4})[pP]/)) == null ? void 0 : _a[1];
          const quality = qualityStr ? parseInt(qualityStr) : 1080;
          const headerDetails = cleanTitle(header);
          const labelExtras = (headerDetails ? `[${headerDetails}]` : "") + (size ? `[${size}]` : "");
          const sizeInBytes2 = (() => {
            const sizeMatch = size.match(/([\d.]+)\s*(GB|MB|KB)/i);
            if (!sizeMatch)
              return 0;
            const multipliers = { GB: 1024 ** 3, MB: 1024 ** 2, KB: 1024 };
            return parseFloat(sizeMatch[1]) * (multipliers[sizeMatch[2].toUpperCase()] || 0);
          })();
          const links = [];
          const elements = $("a.btn").get();
          for (const element of elements) {
            const link2 = $(element).attr("href");
            const text = $(element).text().toLowerCase();
            const fileName = header || headerDetails || "Unknown";
            if (text.includes("download file") || text.includes("fsl server") || text.includes("s3 server") || text.includes("fslv2") || text.includes("mega server")) {
              let label = "HubCloud";
              if (text.includes("fsl server"))
                label = "HubCloud - FSL";
              else if (text.includes("s3 server"))
                label = "HubCloud - S3";
              else if (text.includes("fslv2"))
                label = "HubCloud - FSLv2";
              else if (text.includes("mega server"))
                label = "HubCloud - Mega";
              links.push({ source: `${label} ${labelExtras}`, quality, url: link2, size: sizeInBytes2, fileName });
            } else if (text.includes("buzzserver")) {
              try {
                const buzzResp = yield fetch(`${link2}/download`, { method: "GET", headers: __spreadProps2(__spreadValues2({}, HEADERS), { Referer: link2 }), redirect: "manual" });
                let dlink = buzzResp.headers.get("hx-redirect") || buzzResp.headers.get("HX-Redirect");
                if (!dlink && buzzResp.url && buzzResp.url !== `${link2}/download`) {
                  dlink = buzzResp.url;
                }
                if (dlink) {
                  links.push({ source: `HubCloud - BuzzServer ${labelExtras}`, quality, url: dlink, size: sizeInBytes2, fileName });
                }
              } catch (e) {
              }
            } else if (text.includes("10gbps")) {
              try {
                const resp = yield fetch(link2, { method: "GET", redirect: "manual" });
                const loc = resp.headers.get("location");
                if (loc && loc.includes("link=")) {
                  const dlink = loc.substring(loc.indexOf("link=") + 5);
                  links.push({ source: `HubCloud - 10Gbps ${labelExtras}`, quality, url: dlink, size: sizeInBytes2, fileName });
                }
              } catch (e) {
              }
            } else if (link2 && link2.includes("pixeldra")) {
              const results = yield pixelDrainExtractor(link2);
              links.push(...results.map((l) => __spreadProps2(__spreadValues2({}, l), { source: `${l.source} ${labelExtras}`, size: sizeInBytes2, fileName })));
            } else if (link2 && !link2.includes("magnet:") && link2.startsWith("http")) {
              const extracted = yield loadExtractor(link2, finalUrl);
              links.push(...extracted.map((l) => __spreadProps2(__spreadValues2({}, l), { quality: l.quality || quality })));
            }
          }
          return links;
        } catch (e) {
          return [];
        }
      });
    }
    function hubCdnExtractor(url, referer) {
      return __async2(this, null, function* () {
        var _a, _b;
        try {
          const response = yield fetch(url, { headers: __spreadProps2(__spreadValues2({}, HEADERS), { Referer: referer }) });
          const data = yield response.text();
          const encoded = (_a = data.match(/r=([A-Za-z0-9+/=]+)/)) == null ? void 0 : _a[1];
          if (encoded) {
            const m3u8Link = atob(encoded).substring(atob(encoded).lastIndexOf("link=") + 5);
            return [{ source: "HubCdn", quality: 1080, url: m3u8Link }];
          }
          const scriptEncoded = (_b = data.match(/reurl\s*=\s*["']([^"']+)["']/)) == null ? void 0 : _b[1];
          if (scriptEncoded) {
            const queryPart = scriptEncoded.split("?r=").pop();
            const m3u8Link = atob(queryPart).substring(atob(queryPart).lastIndexOf("link=") + 5);
            return [{ source: "HubCdn", quality: 1080, url: m3u8Link }];
          }
          return [];
        } catch (e) {
          return [];
        }
      });
    }
    function loadExtractor(_0) {
      return __async2(this, arguments, function* (url, referer = MAIN_URL) {
        try {
          const hostname = new URL(url).hostname;
          const isRedirect = url.includes("?id=") || hostname.includes("techyboy4u") || hostname.includes("gadgetsweb.xyz") || hostname.includes("cryptoinsights.site") || hostname.includes("bloggingvector") || hostname.includes("ampproject.org");
          if (isRedirect) {
            const finalLink = yield getRedirectLinks(url);
            if (finalLink && finalLink !== url)
              return yield loadExtractor(finalLink, url);
            return [];
          }
          if (hostname.includes("hubcloud"))
            return yield hubCloudExtractor(url, referer);
          if (hostname.includes("hubcdn"))
            return yield hubCdnExtractor(url, referer);
          if (hostname.includes("hblinks") || hostname.includes("hubstream.dad"))
            return yield hbLinksExtractor(url);
          if (hostname.includes("hubstream") || hostname.includes("vidstack"))
            return yield vidStackExtractor(url);
          if (hostname.includes("pixeldrain"))
            return yield pixelDrainExtractor(url);
          if (hostname.includes("streamtape"))
            return yield streamTapeExtractor(url);
          if (hostname.includes("hdstream4u"))
            return [{ source: "HdStream4u", quality: 1080, url }];
          if (hostname.includes("hubdrive")) {
            const res = yield fetch(url, { headers: __spreadProps2(__spreadValues2({}, HEADERS), { Referer: referer }) });
            const data = yield res.text();
            const href = import_cheerio_without_node_native.default.load(data)(".btn.btn-primary.btn-user.btn-success1.m-1").attr("href");
            if (href)
              return yield loadExtractor(href, url);
          }
          return [];
        } catch (e) {
          return [];
        }
      });
    }
    function search(query) {
      return __async2(this, null, function* () {
        const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        const searchUrl = `https://search.pingora.fyi/collections/post/documents/search?q=${encodeURIComponent(query)}&query_by=post_title,category&query_by_weights=4,2&sort_by=sort_by_date:desc&limit=15&highlight_fields=none&use_cache=true&page=1&analytics_tag=${today}`;
        const response = yield fetch(searchUrl, { headers: HEADERS });
        const data = yield response.json();
        if (!data || !data.hits)
          return [];
        return data.hits.map((hit) => {
          const doc = hit.document;
          const title = doc.post_title;
          const yearMatch = title.match(/\((\d{4})\)|\b(\d{4})\b/);
          const year = yearMatch ? parseInt(yearMatch[1] || yearMatch[2]) : null;
          let url = doc.permalink;
          if (url && url.startsWith("/")) {
            url = `${MAIN_URL}${url}`;
          }
          return {
            title,
            url,
            poster: doc.post_thumbnail,
            year
          };
        });
      });
    }
    function getDownloadLinks(mediaUrl) {
      return __async2(this, null, function* () {
        const domain = yield getCurrentDomain();
        const response = yield fetch(mediaUrl, { headers: __spreadProps2(__spreadValues2({}, HEADERS), { Referer: `${domain}/` }) });
        const data = yield response.text();
        const $ = import_cheerio_without_node_native2.default.load(data);
        const typeRaw = $("h1.page-title span").text();
        const isMovie = typeRaw.toLowerCase().includes("movie");
        if (isMovie) {
          const qualityLinks = $("h3 a, h4 a").filter((i, el) => $(el).text().match(/480|720|1080|2160|4K/i));
          const bodyLinks = $(".page-body > div a").filter((i, el) => {
            const href = $(el).attr("href");
            return href && (href.includes("hdstream4u") || href.includes("hubstream"));
          });
          const initialLinks = [.../* @__PURE__ */ new Set([
            ...qualityLinks.map((i, el) => $(el).attr("href")).get(),
            ...bodyLinks.map((i, el) => $(el).attr("href")).get()
          ])];
          const results = yield Promise.all(initialLinks.map((url) => loadExtractor(url, mediaUrl)));
          const allFinalLinks = results.flat();
          const seenUrls = /* @__PURE__ */ new Set();
          const uniqueFinalLinks = allFinalLinks.filter((link2) => {
            var _a;
            if (!link2.url || link2.url.includes(".zip") || ((_a = link2.name) == null ? void 0 : _a.toLowerCase().includes(".zip")))
              return false;
            if (seenUrls.has(link2.url))
              return false;
            seenUrls.add(link2.url);
            return true;
          });
          return { finalLinks: uniqueFinalLinks, isMovie };
        } else {
          const episodeLinksMap = /* @__PURE__ */ new Map();
          const directLinkBlocks = [];
          $("h3, h4").each((i, element) => {
            const $el = $(element);
            const text = $el.text();
            const anchors = $el.find("a");
            const links = anchors.map((i2, a) => $(a).attr("href")).get();
            const isDirectLinkBlock = anchors.get().some((a) => $(a).text().match(/1080|720|4K|2160/i));
            if (isDirectLinkBlock) {
              directLinkBlocks.push(...links);
              return;
            }
            const episodeMatch = text.match(/(?:EPiSODE\s*(\d+)|E(\d+))/i);
            if (episodeMatch) {
              const epNum = parseInt(episodeMatch[1] || episodeMatch[2]);
              if (!episodeLinksMap.has(epNum))
                episodeLinksMap.set(epNum, []);
              episodeLinksMap.get(epNum).push(...links);
              let nextElement = $el.next();
              while (nextElement.length && nextElement.get(0).tagName !== "hr") {
                const siblingLinks = nextElement.find("a[href]").map((i2, a) => $(a).attr("href")).get();
                episodeLinksMap.get(epNum).push(...siblingLinks);
                nextElement = nextElement.next();
              }
            }
          });
          if (directLinkBlocks.length > 0) {
            yield Promise.all(directLinkBlocks.map((blockUrl) => __async2(this, null, function* () {
              try {
                const resolvedUrl = yield getRedirectLinks(blockUrl);
                if (!resolvedUrl)
                  return;
                const blockRes = yield fetch(resolvedUrl, { headers: HEADERS });
                const blockData = yield blockRes.text();
                const $$ = import_cheerio_without_node_native2.default.load(blockData);
                $$("h5 a, h4 a, h3 a").each((i, el) => {
                  const linkText = $$(el).text();
                  const linkHref = $$(el).attr("href");
                  const epMatch = linkText.match(/Episode\s*(\d+)/i);
                  if (epMatch && linkHref) {
                    const epNum = parseInt(epMatch[1]);
                    if (!episodeLinksMap.has(epNum))
                      episodeLinksMap.set(epNum, []);
                    episodeLinksMap.get(epNum).push(linkHref);
                  }
                });
              } catch (e) {
              }
            })));
          }
          const initialLinks = [];
          episodeLinksMap.forEach((links, epNum) => {
            const uniqueLinks = [...new Set(links)];
            initialLinks.push(...uniqueLinks.map((link2) => ({ url: link2, episode: epNum })));
          });
          const results = yield Promise.all(initialLinks.map((linkInfo) => __async2(this, null, function* () {
            try {
              const extracted = yield loadExtractor(linkInfo.url, mediaUrl);
              return extracted.map((ext) => __spreadProps2(__spreadValues2({}, ext), { episode: linkInfo.episode }));
            } catch (e) {
              return [];
            }
          })));
          const allFinalLinks = results.flat();
          const seenUrls = /* @__PURE__ */ new Set();
          const uniqueFinalLinks = allFinalLinks.filter((link2) => {
            if (!link2.url || link2.url.includes(".zip"))
              return false;
            if (seenUrls.has(link2.url))
              return false;
            seenUrls.add(link2.url);
            return true;
          });
          return { finalLinks: uniqueFinalLinks, isMovie };
        }
      });
    }
    function getStreams2(tmdbId, mediaType = "movie", season = null, episode = null) {
      return __async2(this, null, function* () {
        console.log(`[HDHub4u] Fetching streams for TMDB ID: ${tmdbId}, Type: ${mediaType}`);
        try {
          const mediaInfo = yield getTMDBDetails(tmdbId, mediaType);
          console.log(`[HDHub4u] TMDB Info: "${mediaInfo.title}" (${mediaInfo.year || "N/A"})`);
          const searchQuery = mediaType === "tv" && season ? `${mediaInfo.title} Season ${season}` : mediaInfo.title;
          const searchResults = yield search(searchQuery);
          if (searchResults.length === 0)
            return [];
          const bestMatch = findBestTitleMatch(mediaInfo, searchResults, mediaType, season);
          const selectedMedia = bestMatch || searchResults[0];
          console.log(`[HDHub4u] Selected: "${selectedMedia.title}" (${selectedMedia.url})`);
          const result = yield getDownloadLinks(selectedMedia.url);
          const finalLinks = result.finalLinks;
          let filteredLinks = finalLinks;
          if (mediaType === "tv" && episode !== null) {
            filteredLinks = finalLinks.filter((link2) => link2.episode === episode);
          }
          const streams = filteredLinks.map((link2) => {
            let mediaTitle = link2.fileName && link2.fileName !== "Unknown" ? link2.fileName : mediaInfo.title;
            if (mediaType === "tv" && season && episode) {
              mediaTitle = `${mediaInfo.title} S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
            }
            const serverName = extractServerName(link2.source);
            let qualityStr = "Unknown";
            if (typeof link2.quality === "number" && link2.quality > 0) {
              if (link2.quality >= 2160)
                qualityStr = "4K";
              else if (link2.quality >= 1080)
                qualityStr = "1080p";
              else if (link2.quality >= 720)
                qualityStr = "720p";
              else if (link2.quality >= 480)
                qualityStr = "480p";
            } else if (typeof link2.quality === "string") {
              qualityStr = link2.quality;
            }
            return {
              name: `HDHub4u ${serverName}`,
              title: mediaTitle,
              url: link2.url,
              quality: qualityStr,
              size: formatBytes(link2.size),
              headers: HEADERS,
              provider: "hdhub4u"
            };
          });
          const qualityOrder = { "4K": 4, "1080p": 2, "720p": 1, "480p": 0, "Unknown": -2 };
          return streams.sort((a, b) => (qualityOrder[b.quality] || -3) - (qualityOrder[a.quality] || -3));
        } catch (error) {
          console.error(`[HDHub4u] Scraping error: ${error.message}`);
          return [];
        }
      });
    }
    module2.exports = { getStreams: getStreams2 };
  }
});

// providers/moviesdrive.js
var require_moviesdrive = __commonJS({
  "providers/moviesdrive.js"(exports2, module2) {
    var cheerio = require("cheerio-without-node-native");
    var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
    var TMDB_BASE_URL = "https://api.themoviedb.org/3";
    var MAIN_URL = "https://new2.moviesdrives.my";
    var DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
    var DOMAIN_CACHE_TTL = 4 * 60 * 60 * 1e3;
    var domainCacheTimestamp = 0;
    var HEADERS = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
      "Referer": `${MAIN_URL}/`
    };
    function formatBytes(bytes) {
      if (!bytes || bytes === 0)
        return "Unknown";
      const k = 1024;
      const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    }
    function extractServerName(source) {
      if (!source)
        return "Unknown";
      const src = source.trim();
      if (/HubCloud/i.test(src)) {
        if (/FSL/i.test(src))
          return "HubCloud FSL Server";
        if (/FSL V2/i.test(src))
          return "HubCloud FSL V2 Server";
        if (/S3/i.test(src))
          return "HubCloud S3 Server";
        if (/Buzz/i.test(src))
          return "HubCloud BuzzServer";
        if (/10\s*Gbps/i.test(src))
          return "HubCloud 10Gbps";
        return "HubCloud";
      }
      if (/Pixeldrain/i.test(src))
        return "Pixeldrain";
      if (/StreamTape/i.test(src))
        return "StreamTape";
      if (/HubCdn/i.test(src))
        return "HubCdn";
      if (/HbLinks/i.test(src))
        return "HbLinks";
      if (/Hubstream/i.test(src))
        return "Hubstream";
      return src.replace(/^www\./i, "").split(/[.\s]/)[0];
    }
    var BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    function atob(value) {
      if (!value)
        return "";
      let input = String(value).replace(/=+$/, "");
      let output = "";
      let bc = 0, bs, buffer, idx = 0;
      while (buffer = input.charAt(idx++)) {
        buffer = BASE64_CHARS.indexOf(buffer);
        if (~buffer) {
          bs = bc % 4 ? bs * 64 + buffer : buffer;
          if (bc++ % 4) {
            output += String.fromCharCode(255 & bs >> (-2 * bc & 6));
          }
        }
      }
      return output;
    }
    function cleanTitle(title) {
      const parts = title.split(/[.\-_]/);
      const qualityTags = [
        "WEBRip",
        "WEB-DL",
        "WEB",
        "BluRay",
        "HDRip",
        "DVDRip",
        "HDTV",
        "CAM",
        "TS",
        "R5",
        "DVDScr",
        "BRRip",
        "BDRip",
        "DVD",
        "PDTV",
        "HD"
      ];
      const audioTags = [
        "AAC",
        "AC3",
        "DTS",
        "MP3",
        "FLAC",
        "DD5",
        "EAC3",
        "Atmos"
      ];
      const subTags = [
        "ESub",
        "ESubs",
        "Subs",
        "MultiSub",
        "NoSub",
        "EnglishSub",
        "HindiSub"
      ];
      const codecTags = [
        "x264",
        "x265",
        "H264",
        "HEVC",
        "AVC"
      ];
      const startIndex = parts.findIndex(
        (part) => qualityTags.some((tag) => part.toLowerCase().includes(tag.toLowerCase()))
      );
      const endIndex = parts.findLastIndex(
        (part) => subTags.some((tag) => part.toLowerCase().includes(tag.toLowerCase())) || audioTags.some((tag) => part.toLowerCase().includes(tag.toLowerCase())) || codecTags.some((tag) => part.toLowerCase().includes(tag.toLowerCase()))
      );
      if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
        return parts.slice(startIndex, endIndex + 1).join(".");
      } else if (startIndex !== -1) {
        return parts.slice(startIndex).join(".");
      } else {
        return parts.slice(-3).join(".");
      }
    }
    function fetchAndUpdateDomain() {
      const now = Date.now();
      if (now - domainCacheTimestamp < DOMAIN_CACHE_TTL) {
        return Promise.resolve();
      }
      console.log("[Moviesdrive] Fetching latest domain...");
      return fetch(DOMAINS_URL, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      }).then(function(response) {
        if (response.ok) {
          return response.json().then(function(data) {
            if (data && data.Moviesdrive) {
              const newDomain = data.Moviesdrive;
              if (newDomain !== MAIN_URL) {
                console.log(`[Moviesdrive] Updating domain from ${MAIN_URL} to ${newDomain}`);
                MAIN_URL = newDomain;
                HEADERS.Referer = `${MAIN_URL}/`;
                domainCacheTimestamp = now;
              }
            }
          });
        }
      }).catch(function(error) {
        console.error(`[Moviesdrive] Failed to fetch latest domains: ${error.message}`);
      });
    }
    function getCurrentDomain() {
      return fetchAndUpdateDomain().then(function() {
        return MAIN_URL;
      });
    }
    function pixelDrainExtractor(link2) {
      return Promise.resolve().then(() => {
        let fileId;
        const match = link2.match(/(?:file|u)\/([A-Za-z0-9]+)/);
        if (match) {
          fileId = match[1];
        } else {
          fileId = link2.split("/").pop();
        }
        if (!fileId) {
          return [{ source: "Pixeldrain", quality: "Unknown", url: link2 }];
        }
        const infoUrl = `https://pixeldrain.com/api/file/${fileId}/info`;
        let fileInfo = { name: "", quality: "Unknown", size: 0 };
        return fetch(infoUrl, { headers: HEADERS }).then((response) => response.json()).then((info) => {
          if (info && info.name) {
            fileInfo.name = info.name;
            fileInfo.size = info.size || 0;
            const qualityMatch = info.name.match(/(\d{3,4})p/);
            if (qualityMatch) {
              fileInfo.quality = qualityMatch[0];
            }
          }
          const directUrl = `https://pixeldrain.com/api/file/${fileId}?download`;
          return [{
            source: "Pixeldrain",
            quality: fileInfo.quality,
            url: directUrl,
            name: fileInfo.name,
            size: fileInfo.size
          }];
        }).catch((e) => {
          console.warn(`[Pixeldrain] Could not fetch file info for ${fileId}:`, e.message);
          const directUrl = `https://pixeldrain.com/api/file/${fileId}?download`;
          return [{
            source: "Pixeldrain",
            quality: fileInfo.quality,
            url: directUrl,
            name: fileInfo.name,
            size: fileInfo.size
          }];
        });
      }).catch((e) => {
        console.error("[Pixeldrain] extraction failed", e.message);
        return [{ source: "Pixeldrain", quality: "Unknown", url: link2 }];
      });
    }
    function streamTapeExtractor(link2) {
      const url = new URL(link2);
      url.hostname = "streamtape.com";
      const normalizedLink = url.toString();
      return fetch(normalizedLink, { headers: HEADERS }).then((res) => res.text()).then((data) => {
        const match = data.match(/document\.getElementById\('videolink'\)\.innerHTML = (.*?);/);
        if (match && match[1]) {
          const scriptContent = match[1];
          const urlPartMatch = scriptContent.match(/'(\/\/streamtape\.com\/get_video[^']+)'/);
          if (urlPartMatch && urlPartMatch[1]) {
            const videoSrc = "https:" + urlPartMatch[1];
            return [{ source: "StreamTape", quality: "Stream", url: videoSrc }];
          }
        }
        const simpleMatch = data.match(/'(\/\/streamtape\.com\/get_video[^']+)'/);
        if (simpleMatch && simpleMatch[0]) {
          const videoSrc = "https:" + simpleMatch[0].slice(1, -1);
          return [{ source: "StreamTape", quality: "Stream", url: videoSrc }];
        }
        return [];
      }).catch((e) => {
        if (!e.response || e.response.status !== 404) {
          console.error(`[StreamTape] An unexpected error occurred for ${normalizedLink}:`, e.message);
        }
        return [];
      });
    }
    function hubStreamExtractor(url, referer) {
      return fetch(url, { headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: referer }) }).then((response) => {
        return [{ source: "Hubstream", quality: "Unknown", url }];
      }).catch((e) => {
        console.error(`[Hubstream] Failed to extract from ${url}:`, e.message);
        return [];
      });
    }
    function hbLinksExtractor(url, referer) {
      return fetch(url, { headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: referer }) }).then((response) => response.text()).then((data) => {
        const $ = cheerio.load(data);
        const links = $("h3 a, div.entry-content p a").map((i, el) => $(el).attr("href")).get();
        const finalLinks = [];
        const promises = links.map((link2) => loadExtractor(link2, url));
        return Promise.all(promises).then((results) => {
          results.forEach((extracted) => finalLinks.push(...extracted));
          return finalLinks;
        });
      });
    }
    function hubCdnExtractor(url, referer) {
      return fetch(url, { headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: referer }) }).then((response) => response.text()).then((data) => {
        const encodedMatch = data.match(/r=([A-Za-z0-9+/=]+)/);
        if (encodedMatch && encodedMatch[1]) {
          const m3u8Data = atob(encodedMatch[1]);
          const m3u8Link = m3u8Data.substring(m3u8Data.lastIndexOf("link=") + 5);
          return [{
            source: "HubCdn",
            quality: "M3U8",
            url: m3u8Link
          }];
        }
        return [];
      }).catch(() => []);
    }
    function hubDriveExtractor(url, referer) {
      return fetch(url, { headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: referer }) }).then((response) => response.text()).then((data) => {
        const $ = cheerio.load(data);
        const href = $(".btn.btn-primary.btn-user.btn-success1.m-1").attr("href");
        if (href) {
          return loadExtractor(href, url);
        }
        return [];
      }).catch(() => []);
    }
    function hubCloudExtractor(url, referer) {
      let currentUrl = url;
      if (currentUrl.includes("hubcloud.ink")) {
        currentUrl = currentUrl.replace("hubcloud.ink", "hubcloud.dad");
      }
      if (/\/(video|drive)\//i.test(currentUrl)) {
        return fetch(currentUrl, {
          headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: referer })
        }).then((r) => r.text()).then((html) => {
          const $ = cheerio.load(html);
          const hubPhp = $('a[href*="hubcloud.php"]').attr("href");
          if (!hubPhp)
            return [];
          return hubCloudExtractor(hubPhp, currentUrl);
        }).catch(() => []);
      }
      const initialFetch = currentUrl.includes("hubcloud.php") ? fetch(currentUrl, {
        headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: referer }),
        redirect: "follow"
      }).then(
        (response) => response.text().then((html) => ({
          pageData: html,
          finalUrl: response.url || currentUrl
        }))
      ) : fetch(currentUrl, {
        headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: referer })
      }).then((r) => r.text()).then((pageData) => {
        let finalUrl = currentUrl;
        const scriptUrlMatch = pageData.match(/var url = '([^']*)'/);
        if (scriptUrlMatch && scriptUrlMatch[1]) {
          finalUrl = scriptUrlMatch[1];
          return fetch(finalUrl, {
            headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: currentUrl })
          }).then((r) => r.text()).then((secondData) => ({
            pageData: secondData,
            finalUrl
          }));
        }
        return { pageData, finalUrl };
      });
      return initialFetch.then(({ pageData, finalUrl }) => {
        const $ = cheerio.load(pageData);
        const size = $("i#size").text().trim();
        const header = $("div.card-header").text().trim();
        const getIndexQuality2 = (str) => {
          const match = (str || "").match(/(\d{3,4})[pP]/);
          return match ? parseInt(match[1]) : 2160;
        };
        const quality = getIndexQuality2(header);
        const headerDetails = cleanTitle(header);
        const labelExtras = (() => {
          let extras = "";
          if (headerDetails)
            extras += `[${headerDetails}]`;
          if (size)
            extras += `[${size}]`;
          return extras;
        })();
        const sizeInBytes2 = (() => {
          if (!size)
            return 0;
          const m = size.match(/([\d.]+)\s*(GB|MB|KB)/i);
          if (!m)
            return 0;
          const v = parseFloat(m[1]);
          if (m[2].toUpperCase() === "GB")
            return v * 1024 ** 3;
          if (m[2].toUpperCase() === "MB")
            return v * 1024 ** 2;
          if (m[2].toUpperCase() === "KB")
            return v * 1024;
          return 0;
        })();
        const links = [];
        const elements = $("a.btn[href]").get();
        const processElements = elements.map((el) => {
          const link2 = $(el).attr("href");
          const text = $(el).text();
          if (/telegram/i.test(text) || /telegram/i.test(link2)) {
            return Promise.resolve();
          }
          console.log(`[HubCloud] Found ${text} link ${link2}`);
          const fileName = header || headerDetails || "Unknown";
          if (text.includes("Download File")) {
            links.push({
              source: `HubCloud ${labelExtras}`,
              quality,
              url: link2,
              size: sizeInBytes2,
              fileName
            });
            return Promise.resolve();
          }
          if (text.includes("FSL V2")) {
            links.push({
              source: `HubCloud - FSL V2 Server ${labelExtras}`,
              quality,
              url: link2,
              size: sizeInBytes2,
              fileName
            });
            return Promise.resolve();
          }
          if (text.includes("FSL")) {
            links.push({
              source: `HubCloud - FSL Server ${labelExtras}`,
              quality,
              url: link2,
              size: sizeInBytes2,
              fileName
            });
            return Promise.resolve();
          }
          if (text.includes("S3 Server")) {
            links.push({
              source: `HubCloud - S3 Server ${labelExtras}`,
              quality,
              url: link2,
              size: sizeInBytes2,
              fileName
            });
            return Promise.resolve();
          }
          if (text.includes("BuzzServer")) {
            return fetch(`${link2}/download`, {
              method: "GET",
              headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: link2 }),
              redirect: "manual"
            }).then((resp) => {
              if (resp.status >= 300 && resp.status < 400) {
                const loc = resp.headers.get("location");
                const m = loc == null ? void 0 : loc.match(/hx-redirect=([^&]+)/);
                if (m) {
                  links.push({
                    source: `HubCloud - BuzzServer ${labelExtras}`,
                    quality,
                    url: decodeURIComponent(m[1]),
                    size: sizeInBytes2,
                    fileName
                  });
                }
              }
            }).catch(() => {
            });
          }
          if (link2.includes("pixeldra")) {
            return pixelDrainExtractor(link2).then((extracted) => {
              links.push(...extracted.map((l) => __spreadProps(__spreadValues({}, l), {
                quality: typeof l.quality === "number" ? l.quality : quality,
                size: l.size || sizeInBytes2,
                fileName
              })));
            }).catch(() => {
            });
          }
          if (text.includes("10Gbps")) {
            let redirectUrl = link2;
            let finalLink = null;
            const walk = (i) => {
              if (i >= 5)
                return Promise.resolve(finalLink);
              return fetch(redirectUrl, { redirect: "manual" }).then((r) => {
                if (r.status >= 300 && r.status < 400) {
                  const loc = r.headers.get("location");
                  if (loc == null ? void 0 : loc.includes("link=")) {
                    finalLink = loc.split("link=")[1];
                    return finalLink;
                  }
                  if (loc)
                    redirectUrl = new URL(loc, redirectUrl).toString();
                  return walk(i + 1);
                }
                return finalLink;
              }).catch(() => finalLink);
            };
            return walk(0).then((dlink) => {
              if (dlink) {
                links.push({
                  source: `HubCloud - 10Gbps ${labelExtras}`,
                  quality,
                  url: dlink,
                  size: sizeInBytes2,
                  fileName
                });
              }
            });
          }
          return loadExtractor(link2, finalUrl).then((r) => links.push(...r));
        });
        return Promise.all(processElements).then(() => links);
      }).catch(() => []);
    }
    function gdFlixExtractor(url, referer = null) {
      return __async(this, null, function* () {
        var _a, _b, _c, _d, _e, _f;
        const links = [];
        const getIndexQuality2 = (name) => {
          const m = (name || "").match(/(\d{3,4})[pP]/);
          return m ? parseInt(m[1]) : 2160;
        };
        const toBytes = (size) => {
          if (!size)
            return 0;
          const m = size.match(/([\d.]+)\s*(GB|MB|KB)/i);
          if (!m)
            return 0;
          const v = parseFloat(m[1]);
          return m[2].toUpperCase() === "GB" ? v * 1024 ** 3 : m[2].toUpperCase() === "MB" ? v * 1024 ** 2 : v * 1024;
        };
        try {
          let res = yield fetch(url, { headers: HEADERS });
          let html = yield res.text();
          let refresh = html.match(/url=([^"]+)/i);
          let finalUrl = refresh ? refresh[1] : url;
          const page = yield fetch(finalUrl, { headers: HEADERS }).then((r) => r.text());
          const $ = cheerio.load(page);
          const fileName = $('li:contains("Name")').text().replace("Name :", "").trim();
          const fileSizeText = $('li:contains("Size")').text().replace("Size :", "").trim();
          const quality = getIndexQuality2(fileName);
          const sizeBytes = toBytes(fileSizeText);
          const anchors = $("div.text-center a[href]").get();
          for (const a of anchors) {
            const el = $(a);
            const text = el.text().toLowerCase();
            const href = el.attr("href");
            if (text.includes("direct")) {
              links.push({
                source: "GDFlix [Direct]",
                quality,
                url: href,
                size: sizeBytes,
                fileName
              });
            } else if (text.includes("index")) {
              const indexPage = yield fetch(`https://new6.gdflix.dad${href}`).then((r) => r.text());
              const $$ = cheerio.load(indexPage);
              const btns = $$("a.btn-outline-info").get();
              for (const b of btns) {
                const serverUrl = "https://new6.gdflix.dad" + $$(b).attr("href");
                const serverPage = yield fetch(serverUrl).then((r) => r.text());
                const $$$ = cheerio.load(serverPage);
                $$$("div.mb-4 > a[href]").each((_, x) => {
                  links.push({
                    source: "GDFlix [Index]",
                    quality,
                    url: $$(x).attr("href"),
                    size: sizeBytes,
                    fileName
                  });
                });
              }
            } else if (text.includes("drivebot")) {
              const id = (_a = href.match(/id=([^&]+)/)) == null ? void 0 : _a[1];
              const doId = (_b = href.match(/do=([^=]+)/)) == null ? void 0 : _b[1];
              if (!id || !doId)
                continue;
              const bases = ["https://drivebot.sbs", "https://drivebot.cfd"];
              for (const base of bases) {
                try {
                  const bot = yield fetch(`${base}/download?id=${id}&do=${doId}`);
                  const cookie = bot.headers.get("set-cookie") || "";
                  const html2 = yield bot.text();
                  const token = (_c = html2.match(/token', '([a-f0-9]+)/)) == null ? void 0 : _c[1];
                  const postId = (_d = html2.match(/download\?id=([^']+)/)) == null ? void 0 : _d[1];
                  if (!token || !postId)
                    continue;
                  const dl = yield fetch(`${base}/download?id=${postId}`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/x-www-form-urlencoded",
                      "Referer": `${base}/download?id=${id}&do=${doId}`,
                      "Cookie": cookie
                    },
                    body: `token=${token}`
                  }).then((r) => r.text());
                  const final = (_f = (_e = dl.match(/url":"(.*?)"/)) == null ? void 0 : _e[1]) == null ? void 0 : _f.replace(/\\/g, "");
                  if (final) {
                    links.push({
                      source: "GDFlix [DriveBot]",
                      quality,
                      url: final,
                      size: sizeBytes,
                      fileName
                    });
                  }
                } catch (e) {
                }
              }
            } else if (text.includes("instant")) {
              const r = yield fetch(href, { redirect: "manual" });
              const loc = r.headers.get("location");
              if (loc) {
                links.push({
                  source: "GDFlix [Instant]",
                  quality,
                  url: loc.replace("url=", ""),
                  size: sizeBytes,
                  fileName
                });
              }
            } else if (text.includes("gofile")) {
              const extracted = yield goFileExtractor(href);
              extracted.forEach((l) => links.push(__spreadProps(__spreadValues({}, l), {
                quality,
                size: l.size || sizeBytes,
                fileName
              })));
            } else if (text.includes("pixel")) {
              return pixelDrainExtractor(link).then((extracted) => {
                links.push(...extracted.map((l) => __spreadProps(__spreadValues({}, l), {
                  quality: typeof l.quality === "number" ? l.quality : quality,
                  size: l.size || sizeInBytes,
                  fileName
                })));
              }).catch(() => {
              });
            }
          }
        } catch (e) {
        }
        return links;
      });
    }
    function goFileExtractor(url) {
      return __async(this, null, function* () {
        var _a, _b, _c;
        const links = [];
        try {
          const id = (_a = url.match(/(?:\?c=|\/d\/)([a-zA-Z0-9-]+)/)) == null ? void 0 : _a[1];
          if (!id)
            return [];
          const acc = yield fetch("https://api.gofile.io/accounts", { method: "POST" }).then((r) => r.json());
          const token = (_b = acc == null ? void 0 : acc.data) == null ? void 0 : _b.token;
          if (!token)
            return [];
          const js = yield fetch("https://gofile.io/dist/js/global.js").then((r) => r.text());
          const wt = (_c = js.match(/appdata\.wt\s*=\s*["']([^"']+)/)) == null ? void 0 : _c[1];
          if (!wt)
            return [];
          const data = yield fetch(`https://api.gofile.io/contents/${id}?wt=${wt}`, {
            headers: { Authorization: `Bearer ${token}` }
          }).then((r) => r.json());
          const files = Object.values(data.data.children);
          const file = files[0];
          if (!file)
            return [];
          const size = file.size;
          const sizeFormatted = size < 1024 ** 3 ? `${(size / 1024 ** 2).toFixed(2)} MB` : `${(size / 1024 ** 3).toFixed(2)} GB`;
          links.push({
            source: "GoFile",
            quality: getIndexQuality(file.name),
            url: file.link,
            size,
            fileName: file.name,
            headers: { Cookie: `accountToken=${token}` },
            label: `GoFile [${sizeFormatted}]`
          });
        } catch (e) {
        }
        return links;
      });
    }
    function loadExtractor(url, referer = MAIN_URL) {
      const hostname = new URL(url).hostname;
      if (hostname.includes("gdflix")) {
        return gdFlixExtractor(url, referer);
      }
      if (hostname.includes("gofile")) {
        return goFileExtractor(url);
      }
      if (hostname.includes("hubcloud")) {
        return hubCloudExtractor(url, referer);
      }
      if (hostname.includes("hubdrive")) {
        return hubDriveExtractor(url, referer);
      }
      if (hostname.includes("hubcdn")) {
        return hubCdnExtractor(url, referer);
      }
      if (hostname.includes("hblinks")) {
        return hbLinksExtractor(url, referer);
      }
      if (hostname.includes("hubstream")) {
        return hubStreamExtractor(url, referer);
      }
      if (hostname.includes("pixeldrain")) {
        return pixelDrainExtractor(url);
      }
      if (hostname.includes("streamtape")) {
        return streamTapeExtractor(url);
      }
      if (hostname.includes("hdstream4u")) {
        return Promise.resolve([{ source: "HdStream4u", quality: "Unknown", url }]);
      }
      if (hostname.includes("linkrit")) {
        return Promise.resolve([]);
      }
      if (hostname.includes("google.") || hostname.includes("ampproject.org") || hostname.includes("gstatic.") || hostname.includes("doubleclick.") || hostname.includes("ddl2")) {
        console.warn("[Moviesdrive] Blocked redirect host:", hostname);
        return Promise.resolve([]);
      }
      const sourceName = hostname.replace(/^www\./, "");
      return Promise.resolve([{ source: sourceName, quality: "Unknown", url }]);
    }
    function search(imdbId, page = 1) {
      return getCurrentDomain().then((currentDomain) => {
        const apiUrl = `${currentDomain}/searchapi.php?q=${encodeURIComponent(imdbId)}&page=${page}`;
        console.log(`[Moviesdrive] Searching API: ${apiUrl}`);
        return fetch(apiUrl, { headers: HEADERS });
      }).then((res) => res.json()).then((json) => {
        var _a;
        if (!((_a = json == null ? void 0 : json.hits) == null ? void 0 : _a.length)) {
          console.log("[Moviesdrive] No results");
          return [];
        }
        const results = json.hits.map((hit) => hit.document).filter((doc) => doc.imdb_id === imdbId).map((doc) => {
          var _a2;
          return {
            title: doc.post_title,
            url: doc.permalink.startsWith("http") ? doc.permalink : `${MAIN_URL}${doc.permalink.startsWith("/") ? "" : "/"}${doc.permalink}`,
            poster: (_a2 = doc.post_thumbnail) != null ? _a2 : null,
            year: (() => {
              const match = doc.post_title.match(/\b(19|20)\d{2}\b/);
              return match ? Number(match[0]) : null;
            })(),
            imdbId: doc.imdb_id
          };
        });
        console.log(`[Moviesdrive] Search results: ${results.length}`);
        return results;
      });
    }
    function getDownloadLinks(mediaUrl, season, episode) {
      return getCurrentDomain().then((currentDomain) => {
        HEADERS.Referer = `${currentDomain}/`;
        return fetch(mediaUrl, { headers: HEADERS });
      }).then((response) => response.text()).then((data) => {
        const $ = cheerio.load(data);
        const typeRaw = $("h1.post-title").text();
        const isMovie = typeRaw.toLowerCase().includes("movie");
        const title = $(".poster-title").first().text().trim();
        const seasonMatch = title.match(/\bSeason\s*(\d+)\b/i);
        const seasonNumber = seasonMatch ? parseInt(seasonMatch[1]) : null;
        if (isMovie) {
          const links = $("h5 a").map((_, el) => $(el).attr("href")).get().filter(Boolean);
          console.error(`[Moviesdrive] Found ${links.length} h5 links`);
          const hosterRegex = /hubcloud|gdflix|gdlink/i;
          const extractMdrive = (url) => {
            return fetch(url, {
              headers: {
                "User-Agent": "Mozilla/5.0"
              }
            }).then((res) => res.text()).then((html) => {
              const $$ = cheerio.load(html);
              return $$("a[href]").map((_, el) => {
                const href = $$(el).attr("href");
                return hosterRegex.test(href) ? href : null;
              }).get().filter(Boolean);
            }).catch((e) => {
              console.error("[Moviesdrive] Error extracting links:", e.message);
              return [];
            });
          };
          const promises = links.map((url) => {
            return extractMdrive(url).then((extractedUrls) => {
              return Promise.all(
                extractedUrls.map(
                  (serverUrl) => loadExtractor(serverUrl, mediaUrl).catch((err) => {
                    console.error(
                      `[Moviesdrive] Failed extractor ${serverUrl}:`,
                      err.message
                    );
                    return [];
                  })
                )
              );
            }).catch((err) => {
              console.error("[Moviesdrive] Failed extractMdrive:", err.message);
              return [];
            });
          });
          return Promise.all(promises).then((results) => {
            const flat = results.flat(2);
            const seen = /* @__PURE__ */ new Set();
            const finalLinks = flat.filter((link2) => {
              if (!(link2 == null ? void 0 : link2.url) || seen.has(link2.url))
                return false;
              seen.add(link2.url);
              return true;
            });
            console.error(
              `[Moviesdrive] Final extracted movie streams: ${finalLinks.length}`
            );
            return {
              finalLinks,
              isMovie: true
            };
          });
        } else {
          const seasonPattern = new RegExp(`Season\\s*0?${season}\\b`, "i");
          const episodePattern = new RegExp(`Ep\\s*0?${episode}\\b`, "i");
          const seasonPageUrls = [];
          $("h5").each((_, el) => {
            const text = $(el).text();
            if (seasonPattern.test(text)) {
              $(el).nextAll("h5").each((_2, h5) => {
                const a = $(h5).find("a[href]");
                if (a.length && /single\s*episode/i.test(a.text()) && !/zip/i.test(a.text())) {
                  const href = a.attr("href");
                  if (href && !seasonPageUrls.includes(href)) {
                    seasonPageUrls.push(href);
                  }
                }
              });
            }
          });
          if (seasonPageUrls.length === 0) {
            console.error("[Moviesdrive] No single-episode pages found for season", season);
            return Promise.resolve({ finalLinks: [], isMovie: false });
          }
          const mdrivePromises = seasonPageUrls.map(
            (seasonPageUrl) => fetch(seasonPageUrl, { headers: HEADERS }).then((r) => r.text()).then((html) => {
              const $$ = cheerio.load(html);
              const episodeLinks = [];
              $$("h5").each((_, h) => {
                if (episodePattern.test($$(h).text())) {
                  let next = $$(h).next();
                  while (next.length && next.prop("tagName") !== "HR") {
                    const a = next.find("a[href]").addBack("a[href]");
                    if (a.length) {
                      const href = a.attr("href");
                      if (/hubcloud|gdflix/i.test(href)) {
                        episodeLinks.push(href);
                      }
                    }
                    next = next.next();
                  }
                }
              });
              return episodeLinks;
            }).catch(() => [])
          );
          return Promise.all(mdrivePromises).then((allEpisodeLinks) => {
            const flatLinks = allEpisodeLinks.flat();
            if (flatLinks.length === 0) {
              console.error("[Moviesdrive] No episode links found for episode", episode);
              return { finalLinks: [], isMovie: false };
            }
            const extractorPromises = flatLinks.map(
              (serverUrl) => console.log("[DEBUG] Loading extractor for", serverUrl) || loadExtractor(serverUrl, seasonPageUrls[0]).catch((e) => {
                console.error(
                  `[Moviesdrive] Failed extractor ${serverUrl}:`,
                  e.message
                );
                return [];
              })
            );
            return Promise.all(extractorPromises).then((results) => {
              const flat = results.flat();
              const seen = /* @__PURE__ */ new Set();
              const finalLinks = flat.filter((link2) => {
                if (!(link2 == null ? void 0 : link2.url) || seen.has(link2.url))
                  return false;
                seen.add(link2.url);
                return true;
              });
              console.log(
                `[Moviesdrive] Final extracted episode streams: ${finalLinks.length}`
              );
              return {
                finalLinks,
                isMovie: false
              };
            });
          });
        }
      });
    }
    function getTMDBDetails(tmdbId, mediaType) {
      const endpoint = mediaType === "tv" ? "tv" : "movie";
      const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
      return fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      }).then(function(response) {
        console.error("[TMDB] HTTP status:", response.status);
        if (!response.ok) {
          throw new Error(`TMDB API error: ${response.status}`);
        }
        return response.json();
      }).then(function(data) {
        var _a;
        const title = mediaType === "tv" ? data.name : data.title;
        const releaseDate = mediaType === "tv" ? data.first_air_date : data.release_date;
        const year = releaseDate ? parseInt(releaseDate.split("-")[0]) : null;
        return {
          title,
          year,
          imdbId: ((_a = data.external_ids) == null ? void 0 : _a.imdb_id) || null
        };
      });
    }
    function normalizeTitle(title) {
      if (!title)
        return "";
      return title.toLowerCase().replace(/\b(the|a|an)\b/g, "").replace(/[:\-_]/g, " ").replace(/\s+/g, " ").replace(/[^\w\s]/g, "").trim();
    }
    function calculateTitleSimilarity(title1, title2) {
      const norm1 = normalizeTitle(title1);
      const norm2 = normalizeTitle(title2);
      if (norm1 === norm2)
        return 1;
      if (norm1.includes(norm2) || norm2.includes(norm1))
        return 0.9;
      const words1 = new Set(norm1.split(/\s+/).filter((w) => w.length > 2));
      const words2 = new Set(norm2.split(/\s+/).filter((w) => w.length > 2));
      if (words1.size === 0 || words2.size === 0)
        return 0;
      const intersection = new Set([...words1].filter((w) => words2.has(w)));
      const union = /* @__PURE__ */ new Set([...words1, ...words2]);
      return intersection.size / union.size;
    }
    function findBestTitleMatch(mediaInfo, searchResults, mediaType, season) {
      if (!searchResults || searchResults.length === 0)
        return null;
      let bestMatch = null;
      let bestScore = 0;
      for (const result of searchResults) {
        let score = calculateTitleSimilarity(mediaInfo.title, result.title);
        if (mediaInfo.year && result.year) {
          const yearDiff = Math.abs(mediaInfo.year - result.year);
          if (yearDiff === 0) {
            score += 0.2;
          } else if (yearDiff <= 1) {
            score += 0.1;
          } else if (yearDiff > 5) {
            score -= 0.3;
          }
        }
        if (mediaType === "tv" && season) {
          const titleLower = result.title.toLowerCase();
          const hasSeason = titleLower.includes(`season ${season}`) || titleLower.includes(`s${season}`) || titleLower.includes(`season ${season.toString().padStart(2, "0")}`);
          if (hasSeason) {
            score += 0.3;
          } else {
            score -= 0.2;
          }
        }
        if (result.title.toLowerCase().includes("2160p") || result.title.toLowerCase().includes("4k")) {
          score += 0.05;
        }
        if (score > bestScore && score > 0.3) {
          bestScore = score;
          bestMatch = result;
        }
      }
      if (bestMatch) {
        console.log(`[Moviesdrive] Best title match: "${bestMatch.title}" (score: ${bestScore.toFixed(2)})`);
      }
      return bestMatch;
    }
    function getStreams2(tmdbId, mediaType = "movie", season = null, episode = null) {
      console.log(`[Moviesdrive] Fetching streams for TMDB ID: ${tmdbId}, Type: ${mediaType}${mediaType === "tv" ? `, S:${season}E:${episode}` : ""}`);
      return getTMDBDetails(tmdbId, mediaType).then(function(mediaInfo) {
        if (!mediaInfo.title) {
          throw new Error("Could not extract title from TMDB response");
        }
        console.log(`[Moviesdrive] TMDB Info: "${mediaInfo.title}" (${mediaInfo.year || "N/A"})`);
        const searchQuery = mediaInfo.imdbId ? mediaInfo.imdbId : mediaInfo.title;
        console.log(`[Moviesdrive] Searching for: "${searchQuery}"`);
        return search(searchQuery).then(function(searchResults) {
          if (searchResults.length === 0) {
            console.log("[Moviesdrive] No search results found");
            return [];
          }
          const bestMatch = findBestTitleMatch(mediaInfo, searchResults, mediaType, season);
          const selectedMedia = bestMatch || searchResults[0];
          console.log(`[Moviesdrive] Selected: "${selectedMedia.title}" (${selectedMedia.url})`);
          return getDownloadLinks(selectedMedia.url, season, episode).then(function(result) {
            const { finalLinks, isMovie } = result;
            let filteredLinks = finalLinks;
            const streams = filteredLinks.filter(function(link2) {
              console.log("[Moviesdrive] Processing link from source:", link2.source);
              return link2 && link2.url;
            }).map(function(link2) {
              let mediaTitle;
              if (link2.fileName && link2.fileName !== "Unknown") {
                mediaTitle = link2.fileName;
              } else if (mediaType === "tv" && season && episode) {
                mediaTitle = `${mediaInfo.title} S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
              } else if (mediaInfo.year) {
                mediaTitle = `${mediaInfo.title} (${mediaInfo.year})`;
              } else {
                mediaTitle = mediaInfo.title;
              }
              const formattedSize = formatBytes(link2.size);
              const serverName = extractServerName(link2.source);
              let qualityStr = "Unknown";
              if (link2.quality >= 2160)
                qualityStr = "2160p";
              else if (link2.quality >= 1440)
                qualityStr = "1440p";
              else if (link2.quality >= 1080)
                qualityStr = "1080p";
              else if (link2.quality >= 720)
                qualityStr = "720p";
              else if (link2.quality >= 480)
                qualityStr = "480p";
              else if (link2.quality >= 360)
                qualityStr = "360p";
              else
                qualityStr = "240p";
              return {
                name: `Moviesdrive ${serverName}`,
                title: mediaTitle,
                url: link2.url,
                quality: qualityStr,
                size: formattedSize,
                headers: HEADERS,
                provider: "Moviesdrive"
              };
            });
            const qualityOrder = {
              "2160p": 5,
              "1440p": 4,
              "1080p": 3,
              "720p": 2,
              "480p": 1,
              "360p": 0,
              "240p": -1,
              "Unknown": -2
            };
            streams.sort(function(a, b) {
              var _a, _b;
              return ((_a = qualityOrder[b.quality]) != null ? _a : -3) - ((_b = qualityOrder[a.quality]) != null ? _b : -3);
            });
            console.log(`[Moviesdrive] Found ${streams.length} streams`);
            return streams;
          });
        });
      }).catch(function(error) {
        console.error(`[Moviesdrive] Scraping error: ${error.message}`);
        return [];
      });
    }
    if (typeof module2 !== "undefined" && module2.exports) {
      module2.exports = { getStreams: getStreams2 };
    } else {
      global.getStreams = { getStreams: getStreams2 };
    }
  }
});

// src/hdmulti/index.js
function loadProvider(label, factory) {
  try {
    const provider = factory();
    if (!provider || typeof provider.getStreams !== "function") {
      console.log(`[HDMulti] ${label} is missing getStreams.`);
      return null;
    }
    return provider;
  } catch (error) {
    console.log(`[HDMulti] ${label} unavailable: ${error && error.message ? error.message : error}`);
    return null;
  }
}
var SOURCES = [
  { key: "uhdmovies", label: "UHDMovies", factory: () => require_uhdmovies() },
  { key: "4khdhub", label: "4KHDHub", factory: () => require_khdhub() },
  { key: "hdhub4u", label: "HDHub4u", factory: () => require_hdhub4u() },
  { key: "moviesdrive", label: "Moviesdrive", factory: () => require_moviesdrive() }
];
var SOURCE_TIMEOUT_BY_KEY = {
  uhdmovies: 2e4,
  moviesdrive: 2e4,
  hdhub4u: 12e3,
  "4khdhub": 12e3
};
var PROVIDER_CACHE = /* @__PURE__ */ Object.create(null);
var TOTAL_TIMEOUT_MS = 18e3;
var TV_TOTAL_TIMEOUT_MS = 14e3;
function getSourceTimeout(source) {
  if (isTvRuntime())
    return 1e4;
  return SOURCE_TIMEOUT_BY_KEY[source.key] || 15e3;
}
function getProvider(source) {
  if (Object.prototype.hasOwnProperty.call(PROVIDER_CACHE, source.key)) {
    return PROVIDER_CACHE[source.key];
  }
  const provider = loadProvider(source.label, source.factory);
  PROVIDER_CACHE[source.key] = provider || null;
  return PROVIDER_CACHE[source.key];
}
function isTvRuntime() {
  try {
    const ua = String(globalThis && globalThis.navigator && globalThis.navigator.userAgent ? globalThis.navigator.userAgent : "").toLowerCase();
    return /smart-tv|smarttv|tizen|web0s|webos|bravia|aft|android tv|googletv/.test(ua);
  } catch (_) {
    return false;
  }
}
function getActiveSources() {
  return SOURCES;
}
function normalizeMediaType(mediaType) {
  if (mediaType === "series")
    return "tv";
  if (mediaType === "show")
    return "tv";
  return mediaType || "movie";
}
function withSiteLabel(stream, source) {
  const cloned = Object.assign({}, stream);
  const safeName = (cloned.name || "").trim();
  const safeTitle = (cloned.title || "").trim();
  cloned.name = safeName.includes(source.label) ? safeName : `[${source.label}] ${safeName || "Link"}`;
  cloned.title = safeTitle.includes(`[${source.label}]`) ? safeTitle : `[${source.label}] ${safeTitle || "Direct Link"}`;
  cloned.provider = "hdmulti";
  cloned.sourceSite = source.key;
  return cloned;
}
function runSource(source, tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    let timeoutId;
    const timeoutMs = getSourceTimeout(source);
    const provider = getProvider(source);
    if (!provider)
      return [];
    try {
      const result = yield Promise.race([
        provider.getStreams(tmdbId, mediaType, season, episode),
        new Promise((resolve) => {
          timeoutId = setTimeout(() => {
            console.log(`[HDMulti] ${source.label} timed out after ${timeoutMs}ms.`);
            resolve([]);
          }, timeoutMs);
        })
      ]);
      if (!Array.isArray(result))
        return [];
      return result.map((stream) => withSiteLabel(stream, source));
    } catch (error) {
      console.log(`[HDMulti] ${source.label} failed: ${error && error.message ? error.message : error}`);
      return [];
    } finally {
      if (timeoutId)
        clearTimeout(timeoutId);
    }
  });
}
function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  return __async(this, null, function* () {
    const isTv = isTvRuntime();
    const activeSources = getActiveSources();
    if (activeSources.length === 0) {
      console.log("[HDMulti] No sub-providers are available in this runtime.");
      return [];
    }
    const normalizedType = normalizeMediaType(mediaType);
    const streams = [];
    const collectorPromise = Promise.all(
      activeSources.map((source) => __async(this, null, function* () {
        const sourceStreams = yield runSource(source, tmdbId, normalizedType, season, episode);
        if (Array.isArray(sourceStreams))
          streams.push(...sourceStreams);
      }))
    );
    const totalTimeout = isTv ? TV_TOTAL_TIMEOUT_MS : TOTAL_TIMEOUT_MS;
    yield Promise.race([
      collectorPromise,
      new Promise((resolve) => {
        setTimeout(() => {
          console.log(`[HDMulti] Global timeout reached (${totalTimeout}ms). Returning partial results.`);
          resolve();
        }, totalTimeout);
      })
    ]);
    return streams;
  });
}
module.exports = { getStreams };
