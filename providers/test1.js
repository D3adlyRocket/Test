const PROVIDER_NAME = "ZinkMovies";
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";

const DOMAINS_JSON_URL = "https://raw.githubusercontent.com/SaurabhKaperwan/Utils/refs/heads/main/urls.json";
let cachedDomains = null;
let domainCacheTime = 0;
const DOMAIN_CACHE_TTL = 4 * 60 * 60 * 1000;

let baseUrl = "https://zinkmovies.cc";
let cachedHubDomain = "https://hubcloud.foo";

async function refreshDomains() {
  const now = Date.now();
  if (cachedDomains && (now - domainCacheTime < DOMAIN_CACHE_TTL)) return cachedDomains;
  try {
    var data = await fetchJson(DOMAINS_JSON_URL);
    if (data) {
      cachedDomains = data;
      domainCacheTime = now;
      if (data.zinkmovies) baseUrl = data.zinkmovies;
      if (data.hubcloud) cachedHubDomain = data.hubcloud;
      console.log("[" + PROVIDER_NAME + "] Domains updated: site=" + baseUrl + " hub=" + cachedHubDomain);
    }
  } catch (e) {
    console.log("[" + PROVIDER_NAME + "] Domain refresh failed, using defaults");
  }
  return cachedDomains || {};
}

var MOBILE_UAS = [
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
];

var currentSessionUA = MOBILE_UAS[0];

function getHeaders(extra) {
  var h = {
    "User-Agent": currentSessionUA,
    "Accept-Language": "en-US,en;q=0.9"
  };
  if (extra) { for (var k in extra) { h[k] = extra[k]; } }
  return h;
}

async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  var headers = getHeaders(options?.headers);
  if (options && options.headers) {
    for (var k in options.headers) { headers[k] = options.headers[k]; }
  }
  var mergedOpts = { ...(options || {}), headers: headers };
  
  const fetchPromise = fetch(url, mergedOpts);
  const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), timeout);
  });
  return await Promise.race([fetchPromise, timeoutPromise]);
}

async function fetchText(url, options) {
  try {
    var res = await fetchWithTimeout(url, options);
    if (res && res.ok) return await res.text();
    return null;
  } catch (e) {
    return null;
  }
}

async function fetchJson(url, options) {
  try {
    var res = await fetchWithTimeout(url, options || {});
    if (res.ok) return await res.json();
    return null;
  } catch (e) {
    return null;
  }
}

async function getImdbId(tmdbId, mediaType) {
  var type = (mediaType === "series" || mediaType === "tv") ? "tv" : "movie";
  var url = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "/external_ids?api_key=" + TMDB_API_KEY;
  var data = await fetchJson(url);
  if (data && data.imdb_id) {
    return data.imdb_id;
  }
  return null;
}

// Extract HDVB JSON config from player HTML
function extractHDVBConfig(html) {
  try {
    // Try to find direct object passed: new HDVBPlayer({...})
    var match = html.match(/new HDVBPlayer\((\{[\s\S]*?\})\)/);
    if (match) return JSON.parse(match[1]);
    
    // Try to find variable assignment: let p3 = {...};
    var match2 = html.match(/(?:let|var|const)\s+\w+\s*=\s*(\{[\s\S]*?"file":[\s\S]*?\});/);
    if (match2) return JSON.parse(match2[1]);
    
    return null;
  } catch (e) {
    return null;
  }
}



async function getZinkCloudWorkerLink(id, serverName = "worker") {
  try {
    var res = await fetch("https://new3.zinkcloud.net/server-handler.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": getHeaders()["User-Agent"]
      },
      body: JSON.stringify({ server: serverName, random_id: id })
    });
    var data = await res.json();
    if (data && data.success && data.url) return data.url;
  } catch (e) {}
  return null;
}

function parseQualityLabel(label) {
  var m = label.match(/(2160|1080|720|480)\s*P/i);
  if (m) return m[1] + "P";
  if (/4K|UHD/i.test(label)) return "2160P";
  return "HD";
}

function extractSiteTitle(postHtml) {
  var tm = postHtml.match(/<title>(.*?)<\/title>/i);
  if (!tm) return "";
  var t = tm[1];
  var clean = t.match(/Download\s+(.+?)\s+In HD Free/i);
  return clean ? clean[1].trim() : t.trim();
}

function base64Decode(str) {
    var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var res = "", i = 0;
    str = str.replace(/[^A-Za-z0-9\+\/\=]/g, "");
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

async function scrapeZinkMoviesForMovies(title, year) {
  var streams = [];
  try {
    var searchUrl = baseUrl + "/?s=" + encodeURIComponent(title);
    var searchHtml = await fetchText(searchUrl);
    if (!searchHtml) return streams;

    // Find post link
    var matchUrl = null;
    var regex = /href="(https?:\/\/[^\/]+\/movies\/[^"]+)"/ig;
    var m;
    while ((m = regex.exec(searchHtml)) !== null) {
        if (!year || m[1].includes(year)) { matchUrl = m[1]; break; }
    }
    if (!matchUrl) {
       var fb = searchHtml.match(/href="(https?:\/\/[^\/]+\/movies\/[^"]+)"/i);
       if (fb) matchUrl = fb[1];
    }
    if (!matchUrl) return streams;
    
    var postUrl = matchUrl;
    var postHtml = await fetchText(postUrl);
    if (!postHtml) return streams;
    
    var siteTitle = extractSiteTitle(postHtml);

    var regex = /href="(https:\/\/new3\.zinkcloud\.net\/file\/([^"]+))"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/ig;
    var m;
    var linksToFetch = [];
    while ((m = regex.exec(postHtml)) !== null) {
      linksToFetch.push({ id: m[2], label: m[3].replace(/<[^>]+>/g, "").trim() });
    }
    
    await Promise.all(linksToFetch.map(async (linkObj) => {
      var id = linkObj.id;
      var label = linkObj.label;
      if (label.includes("480")) return;
      
      // Dynamic Server Check
      var tokenUrl = "https://new3.zinkcloud.net/ajax_generate_token.php";
      try {
          var tokenRes = await fetch(tokenUrl, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest", ...getHeaders() },
              body: "random_id=" + id
          });
          var tokenData = await tokenRes.json();
          if (tokenData && tokenData.token) {
              var dlPageHtml = await fetchText("https://new3.zinkcloud.net/dl/" + tokenData.token);
              if (dlPageHtml) {

                  // Extract Hubcloud URL
                  var hubcloudMatch = dlPageHtml.match(/href="([^"]+hubcloud\.[^"\/]+\/drive\/[^"]+)"/i);
                  if (hubcloudMatch) {
                      try {
                          var hcUrl = hubcloudMatch[1];
                          var hcRes = await fetch(hcUrl, {headers: getHeaders()}); var hcHtml = await hcRes.text();
                          if (hcHtml) {
                              var targetHtmlForFsl = hcHtml;
                              var gamerUrl = null;
                              var gamerMatch = hcHtml.match(/href="([^"]+gamerxyt\.com[^"]+)"/i);
                              if (gamerMatch) gamerUrl = gamerMatch[1].replace(/&amp;/g, "&");
                              
                              var xHrefMatch = hcHtml.match(/x-href="([^"]+)"/i);
                              if (!gamerUrl && xHrefMatch) {
                                  try {
                                      var decoded = base64Decode(xHrefMatch[1]);
                                      if (decoded.includes("gamerxyt")) gamerUrl = decoded;
                                  } catch(e) {}
                              }
                              
                              if (gamerUrl) {
                                  var gamerRes = await fetch(gamerUrl, {headers: getHeaders()}); 
                                  targetHtmlForFsl = await gamerRes.text();
                              }
                              
                              if (targetHtmlForFsl) {
                                  var fileRegex = /href="([^"]+)"[^>]*id="fsl"|href="([^"]+(?:\.workers\.dev|\.r2\.dev|\.buzz)\/[^"]+)"/ig;
                                  var fm;
                                  while ((fm = fileRegex.exec(targetHtmlForFsl)) !== null) {
                                      var finalUrl = fm[1] || fm[2];
                                      if (finalUrl && !finalUrl.includes(".zip")) {
                                          var q = parseQualityLabel(label);
                                          var subTitle = q + " \u00B7 FSL";
                                          streams.push({
                                              name: siteTitle + " - " + PROVIDER_NAME + " | " + q + " (FSL)",
                                              title: siteTitle + " - " + PROVIDER_NAME + " | " + subTitle,
                                              size: subTitle,
                                              url: finalUrl,
                                              quality: q,
                                              format: finalUrl.includes(".mkv") ? "mkv" : "mp4"
                                          });
                                      }
                                  }
                              }
                          }
                      } catch(e) {}
                  }
              }
          }
      } catch(e) {}
    }));
  } catch (e) {}
  return streams;
}

async function scrapeZinkMoviesForTv(title, year, season, episode) {
  var streams = [];
  try {
    var searchUrl = baseUrl + "/?s=" + encodeURIComponent(title);
    var searchHtml = await fetchText(searchUrl);
    if (!searchHtml) return streams;

    // Find TV show post
    var matchUrl = null;
    var regex = /href="(https?:\/\/[^\/]+\/tvshows\/[^"]+)"/ig;
    var m;
    while ((m = regex.exec(searchHtml)) !== null) {
        if (!year || m[1].includes(year)) { matchUrl = m[1]; break; }
    }
    if (!matchUrl) {
       var fb = searchHtml.match(/href="(https?:\/\/[^\/]+\/tvshows\/[^"]+)"/i);
       if (fb) matchUrl = fb[1];
    }
    if (!matchUrl) return streams;
    
    var postUrl = matchUrl;
    var postHtml = await fetchText(postUrl);
    if (!postHtml) return streams;
    
    var siteTitle = extractSiteTitle(postHtml);
    var siteShowName = siteTitle.replace(/\s*\(?Season.*/i, "").trim();
    var siteTvTitle = siteShowName + " S" + String(season).padStart(2, "0") + "E" + String(episode).padStart(2, "0");

    // Find linkstore URLs
    var lsRegex = /href="(https:\/\/linkstore\.zinkcloud\.net\/\d+\/)"/ig;
    var lsMatch;
    var linkstores = [];
    while ((lsMatch = lsRegex.exec(postHtml)) !== null) {
      if (linkstores.indexOf(lsMatch[1]) === -1) {
        linkstores.push(lsMatch[1]);
      }
    }

    // Phase 1: collect all target episodes from all linkstores concurrently
    var allEpisodes = [];
    await Promise.all(linkstores.map(async (lsUrl) => {
      var lsHtml = await fetchText(lsUrl);
      if (!lsHtml) return;
      
      var titleMatch = lsHtml.match(/<title>(.*?)<\/title>/i);
      var lsTitle = titleMatch ? titleMatch[1] : "";
      
      var sMatch = lsTitle.match(/Season\s*0?(\d+)/i);
      if (sMatch && parseInt(sMatch[1]) != season) return;
      
      var quality = parseQualityLabel(lsTitle);
      if (quality === "480P") return;
      
      var epRegex = /href="(https:\/\/new3\.zinkcloud\.net\/file\/([^"]+))"[^>]*>\s*<span[^>]*>(.*?)<\/span>/ig;
      var eMatch;
      while ((eMatch = epRegex.exec(lsHtml)) !== null) {
        var id = eMatch[2];
        var label = eMatch[3].replace(/<[^>]+>/g, "").trim();
        
        var isTargetEp = false;
        var epNumMatch = label.match(/(?:EPISODE|EP|E)\s*[-_]?\s*0?(\d+)/i);
        if (epNumMatch && parseInt(epNumMatch[1]) == episode) {
            isTargetEp = true;
        } else if (label.toLowerCase().includes("all episodes")) {
            // Ignore zip packs for streaming
        }
        
        if (isTargetEp) {
            allEpisodes.push({ id, label, quality, lsTitle });
        }
      }
    }));
    
    // Phase 2: process all episodes sequentially to avoid 429 rate limits and hanging connections
    for (var i = 0; i < allEpisodes.length; i++) {
        var epObj = allEpisodes[i];
        var id = epObj.id;
        var quality = epObj.quality;
        var lsTitle = epObj.lsTitle;
        // Dynamic Server Check for TV
        var tokenUrl = "https://new3.zinkcloud.net/ajax_generate_token.php";
        try {
            var tokenRes = await fetch(tokenUrl, {
                method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest", ...getHeaders() },
                body: "random_id=" + id
            });
            var tokenData = await tokenRes.json();
            if (tokenData && tokenData.token) {
                var dlPageHtml = await fetchText("https://new3.zinkcloud.net/dl/" + tokenData.token);
                if (dlPageHtml) {

                    // Extract Hubcloud URL for TV
                    var hubcloudMatch = dlPageHtml.match(/href="([^"]+hubcloud\.[^"\/]+\/drive\/[^"]+)"/i);
                    if (hubcloudMatch) {
                        try {
                            var hcUrl = hubcloudMatch[1];
                          var hcRes = await fetch(hcUrl, {headers: getHeaders()}); var hcHtml = await hcRes.text();
                            if (hcHtml) {
                                var targetHtmlForFsl = hcHtml;
                                var gamerUrl = null;
                                var gamerMatch = hcHtml.match(/href="([^"]+gamerxyt\.com[^"]+)"/i);
                                if (gamerMatch) gamerUrl = gamerMatch[1].replace(/&amp;/g, "&");
                                
                                var xHrefMatch = hcHtml.match(/x-href="([^"]+)"/i);
                                if (!gamerUrl && xHrefMatch) {
                                    try {
                                        var decoded = base64Decode(xHrefMatch[1]);
                                        if (decoded.includes("gamerxyt")) gamerUrl = decoded;
                                    } catch(e) {}
                                }
                                
                                if (gamerUrl) {
                                    var gamerRes = await fetch(gamerUrl, {headers: getHeaders()}); 
                                    targetHtmlForFsl = await gamerRes.text();
                                }
                                
                                if (targetHtmlForFsl) {
                                    var fileRegex = /href="([^"]+)"[^>]*id="fsl"|href="([^"]+(?:\.workers\.dev|\.r2\.dev|\.buzz)\/[^"]+)"/ig;
                                    var fm;
                                    while ((fm = fileRegex.exec(targetHtmlForFsl)) !== null) {
                                        var finalUrl = fm[1] || fm[2];
                                        if (finalUrl && !finalUrl.includes(".zip")) {
                                            var q = quality;
                                            var subTitle = q + " \u00B7 FSL";
                                            streams.push({
                                                name: siteTvTitle + " - " + PROVIDER_NAME + " | " + q + " (FSL)",
                                                title: siteTvTitle + " - " + PROVIDER_NAME + " | " + subTitle,
                                                size: subTitle,
                                                url: finalUrl,
                                                quality: q,
                                                format: finalUrl.includes(".mkv") ? "mkv" : "mp4"
                                            });
                                        }
                                    }
                                }
                            }
                        } catch(e) {}
                    }
                }
            }
        } catch(e) {}
    }
  } catch(e) {}
  return streams;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  currentSessionUA = MOBILE_UAS[Math.floor(Math.random() * MOBILE_UAS.length)];
  await refreshDomains();
  var streams = [];
  var isTv = (mediaType === "series" || mediaType === "tv");
  
  // 1. Try ZinkCloud Direct Links
  var zinkStreams = [];
  var gemmaTitle = "";
  if (!isTv) {
    try {
      var tmdbUrl = "https://api.themoviedb.org/3/movie/" + tmdbId + "?api_key=" + TMDB_API_KEY;
      var tmdbData = await fetchJson(tmdbUrl);
      if (tmdbData && tmdbData.title) {
        var year = tmdbData.release_date ? tmdbData.release_date.split("-")[0] : "";
        gemmaTitle = tmdbData.title + (year ? " (" + year + ")" : "");
        zinkStreams = await scrapeZinkMoviesForMovies(tmdbData.title, year);
      }
    } catch(e) {}
  } else {
    try {
      var tmdbUrl = "https://api.themoviedb.org/3/tv/" + tmdbId + "?api_key=" + TMDB_API_KEY;
      var tmdbData = await fetchJson(tmdbUrl);
      if (tmdbData && tmdbData.name) {
        var year = tmdbData.first_air_date ? tmdbData.first_air_date.split("-")[0] : "";
        gemmaTitle = tmdbData.name + " S" + String(season).padStart(2, "0") + "E" + String(episode).padStart(2, "0");
        zinkStreams = await scrapeZinkMoviesForTv(tmdbData.name, year, season, episode);
      }
    } catch(e) {}
  }
  
  if (zinkStreams.length > 0) {
    streams = streams.concat(zinkStreams);
  }

  // 1. Get IMDB ID
  var imdbId = await getImdbId(tmdbId, mediaType);
  if (!imdbId) return streams;
  
  // Do not reset streams array
  
  // 2. Fetch Gemma Player
  var playerUrl = "https://gemma416okl.com/play/" + imdbId;
  var playerHtml = await fetchText(playerUrl, {
    headers: { "Referer": baseUrl + "/" }
  });
  
  if (!playerHtml) return streams;
  
  // 3. Extract Player Config
  var config = extractHDVBConfig(playerHtml);
  if (!config || !config.file || !config.key) return streams;
  
  var masterUrl = config.file;
  if (masterUrl.startsWith("/")) {
    masterUrl = "https://gemma416okl.com" + masterUrl;
  }
  var token = config.key;
  
  // 4. Fetch Master Playlist
  var playlistData = await fetchJson(masterUrl, {
    method: "POST",
    headers: {
      "X-CSRF-TOKEN": token,
      "Content-Type": "application/x-www-form-urlencoded",
      "Origin": "https://gemma416okl.com",
      "Referer": playerUrl
    }
  });
  
  if (!playlistData) return streams;
  
  // Base URL for secondary requests
  var baseUrl = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);
  var languageFiles = []; // { title: string, file: string }
  
  // 5. Parse JSON based on Media Type
  if (isTv) {
    // Array of Seasons
    for (var i = 0; i < playlistData.length; i++) {
      var seasonObj = playlistData[i];
      if (seasonObj.id == season || (seasonObj.title && seasonObj.title.indexOf(String(season)) > -1)) {
        if (seasonObj.folder) {
          // Array of Episodes
          for (var j = 0; j < seasonObj.folder.length; j++) {
            var epObj = seasonObj.folder[j];
            if (epObj.episode == episode || epObj.id == (season + "-" + episode)) {
              if (epObj.folder) {
                // Array of Languages
                for (var k = 0; k < epObj.folder.length; k++) {
                  if (epObj.folder[k].file && epObj.folder[k].file.startsWith("~")) {
                    languageFiles.push(epObj.folder[k]);
                  }
                }
              }
              break;
            }
          }
        }
        break;
      }
    }
  } else {
    // Movies: Flat Array of Languages
    for (var i = 0; i < playlistData.length; i++) {
      if (playlistData[i].file && playlistData[i].file.startsWith("~")) {
        languageFiles.push(playlistData[i]);
      }
    }
  }
  
  // 6. Fetch actual M3U8 for each language
  for (var i = 0; i < languageFiles.length; i++) {
    var langObj = languageFiles[i];
    var encodedFile = langObj.file.substring(1); // remove "~"
    var fetchUrl = baseUrl + encodedFile + ".txt";
    
    var m3u8Url = await fetchText(fetchUrl, {
      method: "POST",
      headers: {
        "X-CSRF-TOKEN": token,
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": "https://gemma416okl.com",
        "Referer": playerUrl
      }
    });
    
    if (m3u8Url && m3u8Url.indexOf(".m3u8") > -1) {
      var langLabel = langObj.title ? " | " + langObj.title : "";
      var subTitle = "HD \u00B7 " + langObj.title;
      streams.push({
        name: gemmaTitle + " - " + PROVIDER_NAME + langLabel + " | HD",
        title: gemmaTitle + " - " + PROVIDER_NAME + langLabel + " | HD",
        size: subTitle,
        url: m3u8Url.trim(),
        quality: "HD",
        headers: {
          "origin": "https://i-arch-400.keymi417exx.com",
          "referer": "https://i-arch-400.keymi417exx.com/"
        }
      });
    }
  }
  const getPrio = (n) => {
    return n.includes("(FSL)") ? 3 : n.includes("(HUB)") ? 2 : n.includes(" | ") ? 1 : 0; 
  };
  return [...streams].sort((a, b) => {
    let pa = getPrio(a.name);
    let pb = getPrio(b.name);
    if (pa !== pb) return pb - pa;
    var order = { "2160P": 5, "1080P": 4, "720P": 3, "480P": 2, "HD": 1 };
    var qA = order[a.quality] !== undefined ? order[a.quality] : 0;
    var qB = order[b.quality] !== undefined ? order[b.quality] : 0;
    return qB - qA;
  });
  return streams;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
