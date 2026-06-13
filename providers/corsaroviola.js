var PROVIDER_NAME = "HindMovie";
var BASE_URL = "https://hindmovie.icu";
var TMDB_KEY = "439c478a771f35c05022f9feabcca01c";

var MOBILE_UAS = [
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
];

function getHeaders(extra) {
  var ua = MOBILE_UAS[Math.floor(Math.random() * MOBILE_UAS.length)];
  var h = { "User-Agent": ua, "Accept-Language": "en-US,en;q=0.9", "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8" };
  if (extra) { for (var k in extra) { h[k] = extra[k]; } }
  return h;
}

function log(msg) { console.log("[" + PROVIDER_NAME + "] " + msg); }
function err(msg) { console.error("[" + PROVIDER_NAME + "] " + msg); }

async function fetchText(url, options, timeout) {
  timeout = timeout || 12000;
  try {
    var sig = null;
    if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) sig = AbortSignal.timeout(timeout);
    var hdrs = getHeaders(null);
    if (options && options.headers) { for (var k in options.headers) { hdrs[k] = options.headers[k]; } }
    var merged = { ...(options || {}), headers: hdrs };
    if (sig) merged.signal = sig;
    
    var fetchPromise = fetch(url, merged);
    var timeoutPromise = new Promise(function(_, reject) {
        setTimeout(function() { reject(new Error("Timeout " + timeout + "ms")); }, timeout);
    });
    
    var res = await Promise.race([fetchPromise, timeoutPromise]);
    if (res.ok) return await res.text();
    return null;
  } catch (e) {
    err("fetch: " + url.substring(0, 80) + " -> " + (e.message || ''));
    return null;
  }
}

async function fetchJson(url, options, timeout) {
  var t = await fetchText(url, options, timeout);
  if (!t) return null;
  try { return JSON.parse(t); } catch(e) { return null; }
}

async function getMedia(id, type) {
  var s = String(id || '').trim();
  var isImdb = s.indexOf('tt') === 0;
  var t = (type === 'tv' || type === 'series') ? 'tv' : 'movie';
  try {
    if (isImdb) {
      var data = await fetchJson('https://api.themoviedb.org/3/find/' + s + '?api_key=' + TMDB_KEY + '&external_source=imdb_id', {}, 10000);
      var list = data ? (t === 'tv' ? data.tv_results : data.movie_results) : null;
      if (list && list.length > 0) {
        var it = list[0];
        return { 
          title: t === 'tv' ? it.name : it.title, 
          year: (it.first_air_date || it.release_date || '').split('-')[0], 
          imdb: s,
          runtime: it.runtime || null,
          episode_run_time: it.episode_run_time || null
        };
      }
    } else {
      var data = await fetchJson('https://api.themoviedb.org/3/' + t + '/' + s + '?api_key=' + TMDB_KEY + '&append_to_response=external_ids', {}, 10000);
      if (data) {
        return { 
          title: t === 'tv' ? data.name : data.title, 
          year: (data.first_air_date || data.release_date || '').split('-')[0], 
          imdb: data.imdb_id || (data.external_ids && data.external_ids.imdb_id) || null,
          runtime: data.runtime || null,
          episode_run_time: data.episode_run_time || null
        };
      }
    }
  } catch(e) { err("tmdb: " + e.message); }
  return { title: s, year: null, imdb: null, runtime: null, episode_run_time: null };
}

function parseQuality(text) {
  var t = String(text || '');
  var m = t.match(/(2160|1080|720|480)\s*P/i);
  if (m) return m[1] + "p";
  if (/4K|UHD/i.test(t)) return "2160p";
  if (/1440|2K/i.test(t)) return "1440p";
  return "HD";
}

function decodeEntities(str) {
    return String(str)
        .replace(/&#8211;/g, '-')
        .replace(/&#8212;/g, '-')
        .replace(/&#8216;/g, "'")
        .replace(/&#8217;/g, "'")
        .replace(/&#8220;/g, '"')
        .replace(/&#8221;/g, '"')
        .replace(/&#038;/g, '&')
        .replace(/&amp;/g, '&')
        .replace(/&#(\d+);/g, function(m, d) { return String.fromCharCode(d); });
}

function getCleanTitle(title) {
    return decodeEntities(title).toLowerCase()
        .replace(/download/g, '')
        .replace(/\b(dual audio|multi audio|hindi|english|tamil|telugu|malayalam|korean|japanese|chinese|spanish|french|italian|german)\b/g, '')
        .replace(/\b(480p|720p|1080p|2160p|4k|2k|hd|fhd|uhd)\b/g, '')
        .replace(/\b(web-?dl|web-?dlrip|web-?rip|brrip|bdrip|bluray|blu-?ray|hdtv|tvrip|dvdrip|camrip|hdrip)\b/g, '')
        .replace(/\b(x264|x265|hevc|10bit|12bit|aac|ac3|dd5\.1|ddp5\.1|atmos|dts)\b/g, '')
        .replace(/\b(season|saison|staffel)\s*\d+(?:\s*(?:-|to)\s*\d+)?\b/g, '')
        .replace(/\bs\d+(?:\s*(?:-|to)\s*\d+)?\b/g, '')
        .replace(/\b(episode|episodes|ep)\s*\d+(?:\s*(?:-|to)\s*\d+)?\s*(added|update|updated)?\b/g, '')
        .replace(/\b(complete|all episodes|pack|batch)\b/g, '')
        .replace(/\b(movie|film|part\s*\d+|vol\s*\d+|volume\s*\d+)\b/g, '')
        .replace(/\b(unrated|extended|directors cut|uncut|18)\b/g, '')
        .replace(/\b(19\d{2}|20\d{2})\b/g, '')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^(the|a|an)\s+/g, '');
}

function isStrictMatch(reqTitle, reqYear, scrTitle, scrYear) {
  if (!reqTitle || !scrTitle) return false;
  var cleanReq = getCleanTitle(reqTitle);
  var cleanScr = getCleanTitle(scrTitle);
  if (cleanReq === cleanScr) return true;
  if (reqYear && scrYear) {
    var rY = parseInt(reqYear);
    var sY = parseInt(scrYear);
    if (!isNaN(rY) && !isNaN(sY) && Math.abs(rY - sY) > 1) return false;
  }
  return false;
}

async function searchWPJson(query) {
    var url = BASE_URL + "/wp-json/wp/v2/posts?search=" + encodeURIComponent(query) + "&per_page=100";
    var posts = await fetchJson(url);
    if (!posts || !Array.isArray(posts)) return [];
    
    var out = [];
    for (var i = 0; i < posts.length; i++) {
        var post = posts[i];
        if (post && post.title && post.title.rendered) {
            var title = post.title.rendered.replace(/<[^>]+>/g, "").trim();
            var yearMatch = title.match(/\b(19\d{2}|20\d{2})\b/);
            var year = yearMatch ? yearMatch[1] : null;
            out.push({
                id: post.id,
                title: title,
                year: year,
                content: post.content ? post.content.rendered : ""
            });
        }
    }
    return out;
}

function dedupe(arr) {
  var seen = {};
  return (arr || []).filter(function(s) {
    if (!s || !s.url || seen[s.url]) return false;
    seen[s.url] = true;
    return true;
  });
}

function pad2(n) {
  return (n != null && n < 10) ? '0' + n : String(n);
}

function encodeBase64(str) {
  var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  var o1, o2, o3, h1, h2, h3, h4, bits, i = 0, enc = "";
  do {
    o1 = str.charCodeAt(i++);
    o2 = str.charCodeAt(i++);
    o3 = str.charCodeAt(i++);
    bits = o1 << 16 | o2 << 8 | o3;
    h1 = bits >> 18 & 0x3f;
    h2 = bits >> 12 & 0x3f;
    h3 = bits >> 6 & 0x3f;
    h4 = bits & 0x3f;
    enc += b64.charAt(h1) + b64.charAt(h2) + (isNaN(o2) ? '=' : b64.charAt(h3)) + (isNaN(o3) ? '=' : b64.charAt(h4));
  } while (i < str.length);
  return enc;
}

function urlSafeBase64Encode(str) {
    var b64 = encodeBase64(str);
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64(str) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  var output = '';
  str = String(str).replace(/=+$/, '');
  for (var bc = 0, bs, buffer, idx = 0; buffer = str.charAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
      buffer = chars.indexOf(buffer);
  }
  return output;
}

async function bypassHShareAPI(rawId, mvUrl) {
    var encodedId = urlSafeBase64Encode(rawId);
    var body = "action=hindshare_sign&d=" + encodeURIComponent(encodedId);
    log("Bypassing HShare via admin-ajax for ID: " + rawId.substring(0, 30) + "...");
    var json = await fetchJson("https://mvlink.blog/wp-admin/admin-ajax.php", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": mvUrl,
            "X-Requested-With": "XMLHttpRequest"
        },
        body: body
    });
    if (json && json.success && json.data && json.data.url) {
        log("Bypass Success! f.php URL: " + json.data.url);
        return json.data.url;
    }
    log("Bypass Failed: " + JSON.stringify(json));
    return null;
}

// Unified multi-line formatter interface with Dynamic Server tracking
function generateStreamLayout(url, titleContext, qualityContext, info, isTv, season, episode, fileName, serverName) {
  var name = info.title || "Unknown Title";
  var year = info.year || "N/A";
  var lowerScan = String(fileName || url || '').toLowerCase();

  var audioType = "Single-Audio";
  var language = "Hindi";
  
  if (lowerScan.includes("dual") || (lowerScan.includes("hindi") && lowerScan.includes("english"))) {
    audioType = "Dual-Audio";
    language = "English • Hindi"; 
  } else if (lowerScan.includes("multi")) {
    audioType = "Multi-Audio";
    language = "Multilingual";
  } else if (lowerScan.includes("bangla")) {
    language = "Bangla";
  } else if (lowerScan.includes("tamil")) {
    language = "Tamil";
  } else if (lowerScan.includes("telugu")) {
    language = "Telugu";
  } else if (lowerScan.includes("english")) {
    audioType = "Single-Audio";
    language = "English";
  }

  var format = "MKV";
  if (lowerScan.includes(".mp4")) format = "MP4";
  if (lowerScan.includes(".m3u8")) format = "M3U8 / HLS";

  var duration = "N/A";
  if (isTv) {
    duration = info.episode_run_time && info.episode_run_time[0] ? info.episode_run_time[0] + " min" : "45 min";
  } else {
    duration = info.runtime ? info.runtime + " min" : "N/A";
  }

  // Codec/Source Layout Engine
  var sourceParts = [];
  if (lowerScan.includes("10bit")) {
    sourceParts.push("10bit");
  }
  if (lowerScan.includes("x265") || lowerScan.includes("hevc")) {
    sourceParts.push("x265");
  } else if (lowerScan.includes("x264") || lowerScan.includes("h264")) {
    sourceParts.push("x264");
  }
  sourceParts.push("WEB-DL");
  
  var dynamicSourceTag = "📌 " + sourceParts.join(" • ");

  var qIcon = qualityContext.includes("4K") || qualityContext.includes("2160") ? "🌟" : "💎";
  var displayTitle = PROVIDER_NAME + " | " + qualityContext + " | " + audioType;

  // Tracked server insertion configuration
  var serverTag = serverName ? " | 🗃️ " + serverName : " | 🗃️ Server 1";

  var line1 = isTv ? "🎬 " + name + " - S" + pad2(season) + "E" + pad2(episode) + " (" + year + ")" : "🎬 " + name + " - " + year;
  var line2 = qIcon + " " + qualityContext + " | 🌍 " + language + serverTag;
  var line3 = "🎞️ " + format + " | ⏱️ " + duration + " | " + dynamicSourceTag;
  var multiLineUnifiedTitle = line1 + "\n" + line2 + "\n" + line3;

  return {
    name: displayTitle,             
    title: multiLineUnifiedTitle,   
    url: url,
    quality: qualityContext,
    behaviorHints: { notWebReady: true }
  };
}

async function processHShareLink(hpageUrls, qualityContext, titleContext, fphpUrl, fileName, info, isTv, season, episode) {
    var streams = [];
    
    for (var i = 0; i < (hpageUrls || []).length; i++) {
        var hpageUrl = hpageUrls[i];
        log("Processing HPage: " + hpageUrl);
        var baseMatch = hpageUrl.match(/url=([^&]+)/i);
        if (baseMatch) {
            try {
                var decodedUrl1 = decodeBase64(baseMatch[1]);
                if (decodedUrl1.startsWith("http")) {
                    var directHtml = await fetchText(decodedUrl1, { headers: { "Referer": fphpUrl } });
                    var serverCount = 1;
                    if (directHtml) {
                        var wRegex = /href="([^"]+\.workers\.dev[^"]+)"/ig;
                        var wM;
                        while ((wM = wRegex.exec(directHtml)) !== null) {
                            var workerUrl = wM[1];
                            var syncedUrl = workerUrl.indexOf('?') > -1 ? workerUrl + '&s=' + new Date().getTime() : workerUrl + '?s=' + new Date().getTime();
                            
                            var currentServerName = "Server " + serverCount;
                            var layout = generateStreamLayout(syncedUrl, titleContext, qualityContext, info, isTv, season, episode, fileName || workerUrl, currentServerName);
                            streams.push(layout);
                            serverCount++;
                        }
                    }
                    
                    if (streams.length === 0) {
                        var workerUrl = null;
                        if (decodedUrl1.includes(".workers.dev")) {
                            workerUrl = decodedUrl1;
                        } else {
                            var innerMatch = decodedUrl1.match(/url=([^&]+)/i);
                            if (innerMatch) {
                                var decodedUrl2 = decodeBase64(innerMatch[1]);
                                if (decodedUrl2.includes(".workers.dev")) {
                                    workerUrl = decodedUrl2;
                                }
                            }
                        }
                        
                        if (workerUrl) {
                            var syncedUrl = workerUrl.indexOf('?') > -1 ? workerUrl + '&s=' + new Date().getTime() : workerUrl + '?s=' + new Date().getTime();
                            var layout = generateStreamLayout(syncedUrl, titleContext, qualityContext, info, isTv, season, episode, fileName || workerUrl, "Server 1");
                            streams.push(layout);
                        }
                    }
                }
            } catch(e) {
                log("HPage decode err: " + e.message);
            }
        }
    }
    return streams;
}

async function processMvlink(mvUrl, referer, titleContext, qualityContext, targetEpisode, info, isTv, season) {
    var streams = [];
    log("Processing MvLink: " + mvUrl);
    var mvHtml = await fetchText(mvUrl, { headers: { "Referer": referer } });
    if (!mvHtml) return streams;
    
    var hshareRegex = /href="(?:https:\/\/hshare\.ink\/\?id=([^"]+)|https:\/\/hshare\.ink\/dl\/([^"]+))"/ig;
    var hMatch;
    var hshareLinks = []; 
    while ((hMatch = hshareRegex.exec(mvHtml)) !== null) {
        if (hMatch[1]) hshareLinks.push(decodeURIComponent(hMatch[1]));
    }
    
    if (hshareLinks.length === 0) return streams;
    log("Found " + hshareLinks.length + " HShare IDs in mvlink page.");
    
    if (targetEpisode != null) {
        var pIdx = targetEpisode - 1;
        var found = false;
        
        if (pIdx >= 0 && pIdx < hshareLinks.length) {
            log("Fast Path Guessing Episode " + targetEpisode + " at index " + pIdx);
            var rawId = hshareLinks[pIdx];
            var fphpUrl = await bypassHShareAPI(rawId, mvUrl);
            var fphpHtml = await fetchText(fphpUrl, { headers: { "Referer": mvUrl } });
            if (fphpHtml) {
                var fNameMatch = fphpHtml.match(/Name:\s*([^<]+)/i);
                var fName = fNameMatch ? fNameMatch[1].trim() : null;
                var hpageUrls = [];
                var hRegex = /href="([^"]+hcloud\.ink[^"]+)"/ig;
                var hM;
                while ((hM = hRegex.exec(fphpHtml)) !== null) {
                    if (hM[1]) hpageUrls.push(hM[1]);
                }
                var r = await processHShareLink(hpageUrls, qualityContext, titleContext, fphpUrl, fName, info, isTv, season, targetEpisode);
                if (r && r.length > 0) {
                    streams = streams.concat(r);
                    found = true;
                }
            }
        }
        
        if (!found) {
            var remaining = hshareLinks.filter(function(_, i) { return i !== pIdx; });
            for (var i = 0; i < remaining.length; i += 3) {
                var chunk = remaining.slice(i, i + 3);
                var results = await Promise.all(chunk.map(async function(rawId) { 
                    var fphpUrl = await bypassHShareAPI(rawId, mvUrl);
                    var fphpHtml = await fetchText(fphpUrl, { headers: { "Referer": mvUrl } });
                    if (!fphpHtml) return [];
                    var fNameMatch = fphpHtml.match(/Name:\s*([^<]+)/i);
                    var fName = fNameMatch ? fNameMatch[1].trim() : null;
                    var hpageUrls = [];
                    var hRegex = /href="([^"]+hcloud\.ink[^"]+)"/ig;
                    var hM;
                    while ((hM = hRegex.exec(fphpHtml)) !== null) {
                        if (hM[1]) hpageUrls.push(hM[1]);
                    }
                    return processHShareLink(hpageUrls, qualityContext, titleContext, fphpUrl, fName, info, isTv, season, targetEpisode); 
                }));
                var chunkFound = false;
                results.forEach(function(r) { 
                    if (r && r.length > 0) {
                        streams = streams.concat(r);
                        chunkFound = true;
                    }
                });
                if (chunkFound) break;
            }
        }
    } else {
        for (var i = 0; i < hshareLinks.length; i++) {
            var rawId = hshareLinks[i];
            var fphpUrl = await bypassHShareAPI(rawId, mvUrl);
            var fphpHtml = await fetchText(fphpUrl, { headers: { "Referer": mvUrl } });
            if (fphpHtml) {
                var fNameMatch = fphpHtml.match(/Name:\s*([^<]+)/i);
                var fName = fNameMatch ? fNameMatch[1].trim() : null;
                var hpageUrls = [];
                var hRegex = /href="([^"]+hcloud\.ink[^"]+)"/ig;
                var hM;
                while ((hM = hRegex.exec(fphpHtml)) !== null) {
                    if (hM[1]) hpageUrls.push(hM[1]);
                }
                var r = await processHShareLink(hpageUrls, qualityContext, titleContext, fphpUrl, fName, info, isTv, season, null);
                if (r) streams = streams.concat(r);
            }
        }
    }
    
    return streams;
}

function extractSeasonHtml(html, targetSeason) {
  if (!html || targetSeason == null) return html;
  var cleanHtml = html;
  var seasonRegex = /(?:Season|Saison|Staffel)\s+0*(\d+)\b/gi;
  var match;
  var seasonBlocks = [];
  
  while ((match = seasonRegex.exec(cleanHtml)) !== null) {
      var tagStart = cleanHtml.lastIndexOf('<', match.index);
      if (tagStart < 0 || match.index - tagStart > 500) tagStart = match.index;
      var localContext = cleanHtml.substring(tagStart, match.index + 50);
      if (localContext.toLowerCase().includes('download') || localContext.toLowerCase().includes('episode')) continue;
      seasonBlocks.push({ season: parseInt(match[1]), index: tagStart });
  }
  
  if (seasonBlocks.length === 0) return cleanHtml;
  var targetBlocks = seasonBlocks.filter(function(b) { return b.season === targetSeason; });
  if (targetBlocks.length === 0) return cleanHtml;
  
  var targetBlock = targetBlocks[0]; 
  var startPos = targetBlock.index;
  var nextBlock = null;
  for (var i = 0; i < seasonBlocks.length; i++) {
      if (seasonBlocks[i].index > startPos && seasonBlocks[i].season !== targetSeason) {
          nextBlock = seasonBlocks[i];
          break;
      }
  }
  var cutPos = nextBlock ? nextBlock.index : cleanHtml.length;
  return cleanHtml.substring(startPos, cutPos);
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    log("request: id=" + tmdbId + " type=" + mediaType + " s=" + season + " e=" + episode);
    var info = await getMedia(tmdbId, mediaType);
    if (!info || !info.title) return [];
    var isTv = (mediaType === 'tv' || mediaType === 'series');
    var safeSeason = (season != null) ? Number(season) : null;
    var safeEpisode = (episode != null) ? Number(episode) : null;
    log("resolved: \"" + info.title + "\" (" + (info.year || '?') + ")");
    
    var results = [];
    if (info.imdb) {
        log("Searching WP-JSON by IMDB ID: " + info.imdb);
        results = await searchWPJson(info.imdb);
    }
    
    if (!results || results.length === 0) {
        log("Searching WP-JSON by Title: " + info.title);
        results = await searchWPJson(info.title);
    }
    
    var best = null;
    if (info.imdb) {
        for (var i = 0; i < results.length; i++) {
            if (results[i].content && results[i].content.includes(info.imdb)) {
                log("Matched via IMDB ID!");
                best = results[i];
                break;
            }
        }
    }
    
    if (!best) {
        for (var i = 0; i < results.length; i++) {
            if (isStrictMatch(info.title, info.year, results[i].title, results[i].year)) {
                log("Matched via Strict Title Match!");
                best = results[i];
                break;
            }
        }
    }
    
    if (!best) { log("No strict match found in WP-JSON"); return []; }
    log("Matched Post: " + best.title);
    
    var contentHtml = best.content;
    if (isTv && safeSeason != null) {
        var sliced = extractSeasonHtml(contentHtml, safeSeason);
        if (sliced) contentHtml = sliced;
    }
    
    var mvLinks = [];
    var mvRegex = /href="(https?:\/\/mvlink\.blog\/(?:web\/)?\d+)"/ig;
    var mMatch;
    while ((mMatch = mvRegex.exec(contentHtml)) !== null) {
        var url = mMatch[1];
        var startIdx = Math.max(0, mMatch.index - 500);
        var context = contentHtml.substring(startIdx, mMatch.index);
        var quality = parseQuality(context) || "HD";
        
        mvLinks.push({ url: url, quality: quality });
    }
    
    if (mvLinks.length === 0) { log("No mvlink.blog links found in post."); return []; }
    log("Found " + mvLinks.length + " MvLink domains.");
    
    var streams = [];
    var tvContext = isTv ? info.title + " [S" + pad2(safeSeason) + "E" + pad2(safeEpisode) + "]" : best.title;
    
    for (var i = 0; i < mvLinks.length; i++) {
        var ml = mvLinks[i];
        if (ml.quality === "480p") {
            log("Skipping 480p link");
            continue;
        }
        var s = await processMvlink(ml.url, BASE_URL + "/", tvContext, ml.quality, safeEpisode, info, isTv, safeSeason);
        if (s && s.length > 0) {
            streams = streams.concat(s);
        }
    }
    
    streams = dedupe(streams);
    
    var qOrder = { "2160p": 5, "1440p": 4, "1080p": 3, "720p": 2, "HD": 1 };
    streams.sort(function(a, b) {
        var qA = qOrder[a.quality] || 0;
        var qB = qOrder[b.quality] || 0;
        return qB - qA;
    });
    
    log("Returning " + streams.length + " streams.");
    return streams;

  } catch (e) {
    err("fatal: " + e.message);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) { module.exports = { getStreams }; }
else { global.getStreams = getStreams; }
