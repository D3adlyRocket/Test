var PROVIDER_NAME = "MoviesDrive"; 
var MAIN_URL = "https://new4.moviesdrives.my"; 
var ARCHIVE_DOMAIN = "https://mdrive.lol"; 
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
  var h = { "User-Agent": ua, "Accept-Language": "en-US,en;q=0.9" }; 
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
    var hdrs = getHeaders(options && options.headers ? null : null); 
    if (options && options.headers) { for (var k in options.headers) { hdrs[k] = options.headers[k]; } } 
    var merged = { ...(options || {}), headers: hdrs }; 
    if (sig) merged.signal = sig; 
    var fetchPromise = fetch(url, merged); 
    var timeoutPromise = new Promise(function(_, reject) { setTimeout(function() { reject(new Error("Timeout " + timeout + "ms")); }, timeout); }); 
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

function parseQuality(text) { 
  var t = String(text || ''); 
  var m = t.match(/(2160|1080|720|480)\s*P/i); 
  if (m) return m[1] + "p"; 
  if (/4K|UHD/i.test(t)) return "2160p"; 
  if (/1440|2K/i.test(t)) return "1440p"; 
  return "HD"; 
} 

function extractSiteTitle(html) { 
  var tm = html.match(/<title>(.*?)<\/title>/i); 
  if (!tm) return ""; 
  var t = tm[1]; 
  var clean = t.match(/Download\s+(.+?)\s+(?:In HD Free|Free Download)/i); 
  if (clean) return clean[1].trim(); 
  var stripped = t.replace(/^(?:Download\s+)?/, ""); 
  stripped = stripped.replace(/\s+(?:\d{3,4}p\b|4K\b|WEB-DL\b|BluRay\b|HDTV\b|x26[45]\b|HEVC\b|SDR\b|HDR\b|DD\d|DDP\d|Hindi|English|Dual\s*Audio|ESubs?)\b.*$/i, ""); 
  stripped = stripped.replace(/\s*[-–|]\s*\w*\s*$/i, "").trim(); 
  stripped = stripped.replace(/&#8211;/g, '\u2013'); 
  return stripped || t; 
} 

function isStrictMatch(reqTitle, reqYear, scrTitle, scrYear) { 
  if (!reqTitle || !scrTitle) return false; 
  var rC = reqTitle.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim().replace(/\s+/g, ' '); 
  var sC = scrTitle.toLowerCase().replace(/download\s*/g, '').replace(/[^a-z0-9\s]/g, ' ').trim().replace(/\s+/g, ' '); 
  if (sC !== rC && sC.indexOf(rC + ' ') !== 0 && sC.indexOf(' ' + rC + ' ') === -1 && sC.indexOf(' ' + rC) !== sC.length - rC.length - 1) return false; 
  if (reqYear && scrYear) { 
    var rY = parseInt(reqYear); 
    var sY = parseInt(scrYear); 
    if (!isNaN(rY) && !isNaN(sY) && Math.abs(rY - sY) > 1) return false; 
  } 
  return true; 
} 

function extractSeasonHtml(html, targetSeason) { 
  if (!html || targetSeason == null) return html; 
  var regex = new RegExp('(<h[1-6][^>]*>|<strong[^>]*>|<span[^>]*>)[\\s\\S]{0,100}?(?:Season|Saison|Staffel)\\s*0*(\\d+)\\b(?!\\s*[-–+&])', 'gi'); 
  var match, headers = []; 
  while ((match = regex.exec(html)) !== null) { 
    headers.push({ index: match.index, season: parseInt(match[2]) }); 
  } 
  var firstTarget = -1, lastOtherIdx = -1; 
  for (var i = 0; i < headers.length; i++) { 
    if (headers[i].season === targetSeason) { 
      if (firstTarget === -1) firstTarget = i; 
    } else { 
      lastOtherIdx = i; 
    } 
  } 
  if (firstTarget === -1) { 
    var rangeRegex = new RegExp('(<h[1-6][^>]*>|<strong[^>]*>).*?(?:Season|Saison|Staffel)\\s*0*(\\d+)\\s*[-–]\\s*0*(\\d+)', 'gi'); 
    var rMatch, rangeStart = -1; 
    while ((rMatch = rangeRegex.exec(html)) !== null) { 
      if (targetSeason >= parseInt(rMatch[2]) && targetSeason <= parseInt(rMatch[3])) { 
        rangeStart = rMatch.index; 
        break; 
      } 
    } 
    if (rangeStart !== -1) return html.substring(rangeStart); 
    return null; 
  } 
  var j = headers[firstTarget].index; 
  if (lastOtherIdx > firstTarget) { 
    for (var k = 0; k < headers.length; k++) { 
      if (headers[k].season === targetSeason && k > lastOtherIdx) { 
        j = headers[k].index; 
        break; 
      } 
    } 
  } 
  var endPos = html.length; 
  for (var k = 0; k < headers.length; k++) { 
    if (headers[k].index > j && headers[k].season !== targetSeason) { 
      endPos = headers[k].index; 
      break; 
    } 
  } 
  return html.substring(j, endPos); 
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
        return { title: t === 'tv' ? it.name : it.title, year: (it.first_air_date || it.release_date || '').split('-')[0], imdb: s }; 
      } 
    } else { 
      var data = await fetchJson('https://api.themoviedb.org/3/' + t + '/' + s + '?api_key=' + TMDB_KEY + '&append_to_response=external_ids', {}, 10000); 
      if (data) { 
        return { title: t === 'tv' ? data.name : data.title, year: (data.first_air_date || data.release_date || '').split('-')[0], imdb: data.imdb_id || (data.external_ids && data.external_ids.imdb_id) || null }; 
      } 
    } 
  } catch(e) { err("tmdb: " + e.message); } 
  return { title: s, year: null, imdb: null }; 
} 

async function searchSite(query) { 
  var q = encodeURIComponent(query); 
  var url = MAIN_URL + '/search.php?q=' + q + '&per_page=10'; 
  var data = await fetchJson(url, { headers: { 'Referer': MAIN_URL + '/' } }, 10000); 
  if (!data || !data.hits || data.hits.length === 0) { 
    log("search zero: " + query); 
    return []; 
  } 
  var out = []; 
  for (var i = 0; i < data.hits.length; i++) { 
    var doc = data.hits[i].document; 
    if (doc && doc.permalink && doc.post_title) { 
      var ym = doc.post_title.match(/\((\d{4})\)/); 
      out.push({ title: doc.post_title, href: doc.permalink, year: ym ? parseInt(ym[1]) : null, imdb: doc.imdb_id || null }); 
    } 
  } 
  log("search found " + out.length + " for: " + query); 
  return out; 
} 

async function parsePage(url, season, html) { 
  if (!html) html = await fetchText(url, { headers: { 'Referer': MAIN_URL + '/' } }, 12000); 
  if (!html) return []; 
  var isTv = (season != null); 
  var sliced = isTv ? extractSeasonHtml(html, season) : html; 
  if (!sliced) { 
    log("season " + season + " not found"); 
    return []; 
  } 
  var links = []; 
  var regex = /href="(https?:\/\/mdrive\.lol\/archive\/(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi; 
  var m; 
  while ((m = regex.exec(sliced)) !== null) { 
    var label = m[3].replace(/<[^>]+>/g, '').trim(); 
    if (isTv && /zip/i.test(label)) continue; 
    var q = parseQuality(label); 
    if (q === "480p") continue; 
    var sz = label.match(/\[([\d.]+)\s*(MB|GB|TB)\]/i); 
    var sizeText = sz ? sz[1] + " " + sz[2].toUpperCase() : "Variable Size"; 
    links.push({ id: m[2], url: m[1], label: label, q: q, size: sizeText }); 
  } 
  log("archive links: " + links.length + (isTv ? " (season " + season + ")" : "")); 
  return links; 
} 

async function parseArchive(url, episode) { 
  var html = await fetchText(url, { headers: { 'Referer': MAIN_URL + '/' } }, 12000); 
  if (!html) return []; 
  var hosts = []; 
  var regex = /https?:\/\/hubcloud\.[a-z]+\/drive\/([a-z0-9_]+)/gi; 
  var m; 
  while ((m = regex.exec(html)) !== null) { 
    var hcUrl = m[0]; 
    var isEp = (episode != null); 
    if (isEp) { 
      var startIdx = Math.max(0, m.index - 300); 
      var context = html.substring(startIdx, m.index); 
      var epRegex = /(?:EP|Episode|E)\D*0*(\d+)/gi; 
      var em; 
      var lastEp = -1; 
      while ((em = epRegex.exec(context)) !== null) { 
        lastEp = parseInt(em[1]); 
      } 
      if (lastEp === -1 || lastEp !== episode) continue; 
    } 
    hosts.push({ url: hcUrl, id: m[1] }); 
  } 
  log("archive hosts: " + hosts.length + (isEp ? " (ep " + episode + ")" : "")); 
  return hosts; 
} 

function minutes() { return String(new Date().getMinutes()); } 

function decodeBase64(str) { 
  if (typeof atob === 'function') return atob(str); 
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='; 
  var output = ''; str = String(str).replace(/=+$/, ''); 
  for (var bc = 0, bs, buffer, idx = 0; buffer = str.charAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) { 
    buffer = chars.indexOf(buffer); 
  } 
  return output; 
} 

async function resolveHubcloud(url, quality, sizeText) { 
  var html = await fetchText(url, { headers: { 'Cookie': 'xla=s4t', 'Referer': ARCHIVE_DOMAIN + '/' } }, 12000); 
  if (!html) return []; 
  var bridgeUrl = null; 
  var vm = html.match(/var\s+url\s*=\s*'([^']+)'/); 
  if (vm) bridgeUrl = vm[1]; 
  if (!bridgeUrl) { 
    var dm = html.match(/<a\s+id="download"\s+(?:x-href|href)="([^"]+)"/); 
    if (dm) { 
      bridgeUrl = dm[1]; 
      if (!bridgeUrl.startsWith("http")) { try { bridgeUrl = decodeBase64(bridgeUrl); } catch(e) {} } 
    } 
  } 
  if (!bridgeUrl) return []; 
  var bridgeHtml = await fetchText(bridgeUrl, { headers: { 'Cookie': 'xla=s4t', 'Referer': url } }, 15000); 
  if (!bridgeHtml) return []; 
  var streams = []; var fm; 
  var fslv2Regex = /href="(https?:\/\/fsl\.gigabytes\.icu[^"]+)"/gi; 
  while ((fm = fslv2Regex.exec(bridgeHtml)) !== null) { 
    streams.push({ type: "FSLv2 Server", url: fm[1], quality: quality, size: sizeText || "" }); 
  } 
  var fslRegex = /href="(https?:\/\/(?:pub-[a-z0-9]+\.r2\.dev|[a-z0-9.]+\.buzz)[^"]+)"/gi; 
  while ((fm = fslRegex.exec(bridgeHtml)) !== null) { 
    streams.push({ type: "FSL Server", url: fm[1] + '1' + minutes(), quality: quality, size: sizeText || "" }); 
  } 
  if (streams.length === 0) { 
    var tm = bridgeHtml.match(/https?:\/\/[^\s"'<>]+\?token=\d+/); 
    if (tm) { 
      var mUrl = tm[0].replace(/["'].*$/, '').replace(/[<>].*$/, ''); 
      streams.push({ type: "FSL Server", url: mUrl + '1' + minutes(), quality: quality, size: sizeText || "" }); 
    } 
  } 
  return streams; 
} 

function dedupe(arr) { 
  var seen = {}; 
  return (arr || []).filter(function(s) { 
    if (!s || !s.url || seen[s.url]) return false; 
    seen[s.url] = true; return true; 
  }); 
} 

function pad2(n) { return (n != null && n < 10) ? '0' + n : String(n); } 

function buildDropdownMetadata(info, qualityLabel, isTv, season, episode, serverType, targetUrl, rawLabel) {
  var title = info.title || "Unknown Title";
  var yearStr = info.year ? " (" + info.year + ")" : "";
  var searchPool = (String(rawLabel) + " " + String(targetUrl)).toLowerCase();

  // Subheading Line 1
  var line1 = "🎦 " + title + yearStr;
  if (isTv && season && episode) {
    line1 += " | S" + season + "E" + episode;
  }

  // Subheading Line 2
  var normQual = qualityLabel.toLowerCase();
  var qIcon = "💎";
  if (normQual.indexOf("2160") !== -1 || normQual.indexOf("4k") !== -1) qIcon = "🌟";
  else if (normQual.indexOf("1080") !== -1) qIcon = "🔥";

  var langStr = "Original";
  var multiAudioKeywords = ["multi", "dual", "hindi", "tamil", "telugu", "bengali", "malayalam", "kannada", "marathi", "punjabi"];
  for (var i = 0; i < multiAudioKeywords.length; i++) {
    if (searchPool.indexOf(multiAudioKeywords[i]) !== -1) {
      langStr = "Multi-Audio";
      break;
    }
  }
  if (searchPool.indexOf("dual") !== -1 && langStr !== "Multi-Audio") {
    langStr = "Dual-Audio";
  }

  var szMatch = searchPool.match(/(\d+(?:\.\d+)?\s*(?:gb|mb))/i);
  var extractedSize = szMatch ? szMatch[1].toUpperCase() : "Variable Size";
  var line2 = qIcon + normQual + " | 💾 " + extractedSize + " | 🔊 " + langStr;

  // Subheading Line 3
  var formatVal = targetUrl.indexOf(".mp4") !== -1 ? "MP4" : "MKV";
  var codecVal = "🎥 H.264";
  if (searchPool.indexOf("hevc") !== -1 || searchPool.indexOf("x265") !== -1 || searchPool.indexOf("h265") !== -1) {
    codecVal = searchPool.indexOf("hevc") !== -1 ? "⚡ HEVC" : "🎥 H.265";
  }
  var extraInfo = "🎞️ " + formatVal + " | " + codecVal;
  if (searchPool.indexOf("hdr") !== -1) extraInfo += " | 🌈 HDR";
  if (searchPool.indexOf("bluray") !== -1) extraInfo += " | 💿 BluRay";

  // Subheading Line 4
  var sourceVal = "📥 WEB-DL";
  if (searchPool.indexOf("webrip") !== -1 || searchPool.indexOf("web-rip") !== -1) sourceVal = "🌐 WEB-Rip";
  else if (searchPool.indexOf("bluray") !== -1) sourceVal = "💿 BluRay";
  else if (searchPool.indexOf("hdrip") !== -1) sourceVal = "📺 HD-Rip";
  
  var line4 = "⛓️‍💥 " + serverType + " | " + sourceVal;

  return line1 + "\n" + line2 + "\n" + extraInfo + "\n" + line4;
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

    var results, ri; var best = null; var bestPageHtml = null; 
    if (info.imdb && info.imdb.indexOf('tt') === 0) { 
      results = await searchSite(info.imdb); 
      if (isTv && safeSeason != null) { 
        for (ri = 0; ri < results.length; ri++) { 
          if (results[ri].imdb !== info.imdb) continue; 
          var testUrl = results[ri].href.indexOf('http') === 0 ? results[ri].href : MAIN_URL + results[ri].href; 
          var testHtml = await fetchText(testUrl, { headers: { 'Referer': MAIN_URL + '/' } }, 12000); 
          if (testHtml && extractSeasonHtml(testHtml, safeSeason) !== null) { best = results[ri]; bestPageHtml = testHtml; log("imdb season match: " + best.title); break; } 
        } 
      } else { 
        for (ri = 0; ri < results.length; ri++) { if (results[ri].imdb === info.imdb) { best = results[ri]; log("imdb exact match: " + best.title); break; } } 
      } 
    } 
    if (!best) { 
      results = await searchSite(info.title); 
      for (ri = 0; ri < results.length; ri++) { 
        if (isStrictMatch(info.title, info.year, results[ri].title, results[ri].year)) { 
          var testUrl = results[ri].href.indexOf('http') === 0 ? results[ri].href : MAIN_URL + results[ri].href; 
          var testHtml = await fetchText(testUrl, { headers: { 'Referer': MAIN_URL + '/' } }, 12000); 
          if (!isTv || extractSeasonHtml(testHtml, safeSeason) !== null) { best = results[ri]; bestPageHtml = testHtml; log("title match: " + best.title); break; } 
        } 
      } 
    } 
    if (!best) { log("no match"); return []; } 
    if (!bestPageHtml) { 
      var pageUrl = best.href.indexOf('http') === 0 ? best.href : MAIN_URL + best.href; 
      bestPageHtml = await fetchText(pageUrl, { headers: { 'Referer': MAIN_URL + '/' } }, 12000); 
      if (!bestPageHtml) return []; 
    } 

    var archLinks = await parsePage(best.href.indexOf('http') === 0 ? best.href : MAIN_URL + best.href, safeSeason, bestPageHtml); 
    archLinks = archLinks.filter(function(al) { return al.q !== '480p'; }); 
    if (archLinks.length === 0) { log("no 720p/1080p/4k archives"); return []; } 

    log("processing " + archLinks.length + " archive links"); 
    var allHosts = []; 
    for (var i = 0; i < archLinks.length; i++) { 
      var al = archLinks[i]; 
      try { 
        var hosts = await parseArchive(al.url, safeEpisode); 
        hosts.forEach(function(h) { allHosts.push({ url: h.url, q: al.q, size: al.size }); }); 
      } catch(e) {} 
    } 
    if (allHosts.length === 0) { log("no hubcloud hosts"); return []; } 

    log("resolving " + allHosts.length + " hubcloud links"); 
    var resolved = []; 
    for (var i = 0; i < allHosts.length; i++) { 
      var h = allHosts[i]; 
      try { var s = await resolveHubcloud(h.url, h.q, h.size); resolved.push(s); } catch(e) {} 
    } 

    var raw = []; 
    resolved.forEach(function(arr) { arr.forEach(function(s) { raw.push(s); }); }); 
    if (raw.length === 0) { log("no FSL streams resolved"); return []; } 

    var out = []; 
    raw.forEach(function(s) { 
      var cleanQ = s.quality.toLowerCase();
      var metadata = buildDropdownMetadata(info, cleanQ, isTv, safeSeason, safeEpisode, s.type, s.url, s.size);

      var displayLang = "Original";
      var searchPool = (String(s.size) + " " + String(s.url)).toLowerCase();
      var multiAudioKeywords = ["multi", "dual", "hindi", "tamil", "telugu", "bengali", "malayalam", "kannada", "marathi", "punjabi"];
      for (var i = 0; i < multiAudioKeywords.length; i++) {
        if (searchPool.indexOf(multiAudioKeywords[i]) !== -1) { displayLang = "Multi-Audio"; break; }
      }
      if (searchPool.indexOf("dual") !== -1 && displayLang !== "Multi-Audio") displayLang = "Dual-Audio";

      out.push({ 
        name: PROVIDER_NAME + " | " + cleanQ + " | " + displayLang, 
        title: metadata, 
        url: s.url, 
        quality: "", 
        size: metadata, 
        behaviorHints: { notWebReady: true, proxyHeaders: { request: { "Referer": ARCHIVE_DOMAIN + "/" } } } 
      }); 
    }); 

    out = dedupe(out); 
    var qOrder = { "2160p": 4, "1080p": 3, "720p": 2, "HD": 1 }; 
    out.sort(function(a, b) { 
      var srcPrio = function(n) { return n.indexOf("FSLv2") !== -1 ? 1 : 0; }; 
      var pa = srcPrio(a.title), pb = srcPrio(b.title); 
      if (pa !== pb) return pb - pa; 
      
      var getQ = function(nameStr) {
        if (nameStr.indexOf("2160p") !== -1) return "2160p";
        if (nameStr.indexOf("1080p") !== -1) return "1080p";
        if (nameStr.indexOf("720p") !== -1) return "720p";
        return "HD";
      };
      return (qOrder[getQ(b.name)] || 0) - (qOrder[getQ(a.name)] || 0); 
    }); 

    log("returning " + out.length + " streams"); 
    return out; 
  } catch (e) { 
    err("fatal: " + e.message); 
    return []; 
  } 
} 

if (typeof module !== 'undefined' && module.exports) { 
  module.exports = { getStreams }; 
} else { 
  global.getStreams = getStreams; 
}
