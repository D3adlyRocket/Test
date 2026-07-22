var PROVIDER_NAME = "MoviesHunt";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var movieshuntBase = "https://movieshunt.run";
var abhilinksBase = "https://abhilinks.site";
var currentUA = "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

var UAS = [
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
];

function log(msg) { console.log("[" + PROVIDER_NAME + "] " + msg); }

function hdrs(extra) {
  return Object.assign({}, { "User-Agent": currentUA, "Accept-Language": "en-US,en;q=0.9", "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" }, extra || {});
}

var FETCH_TIMEOUT = 20000;

function raceTimeout(ms) {
  return new Promise(function(_, reject) { setTimeout(function() { reject(new Error("Timeout")); }, ms); });
}

async function fetchText(url, opts) {
  try {
    var r = await Promise.race([fetch(url, opts || {}), raceTimeout(FETCH_TIMEOUT)]);
    if (r && r.ok) return await r.text();
  } catch (e) {}
  return null;
}

async function fetchJson(url, opts) {
  try {
    var r = await Promise.race([fetch(url, opts || {}), raceTimeout(FETCH_TIMEOUT)]);
    if (r && r.ok) return await r.json();
  } catch (e) {}
  return null;
}

async function getTMDBInfo(tmdbId, mediaType) {
  var type = mediaType === "tv" || mediaType === "series" ? "tv" : "movie";
  var url = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + TMDB_API_KEY + "&language=en-US";
  return await fetchJson(url, { headers: { "User-Agent": currentUA } });
}

function parseSearchResults(html) {
  var results = [];
  var entryRe = /<h\d[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h\d>/gi;
  var m;
  while ((m = entryRe.exec(html)) !== null) {
    var inner = m[1];
    var linkMatch = inner.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (linkMatch) {
      var href = linkMatch[1];
      if (href.indexOf("http") !== 0) href = movieshuntBase + (href.startsWith("/") ? "" : "/") + href;
      var text = linkMatch[2].replace(/<[^>]+>/g, "").trim();
      if (text.length > 5) results.push({ title: text, url: href });
    }
  }
  return results;
}

async function searchSite(query) {
  var results = [];
  var queries = [query.replace(/'/g, "").trim()];
  var cleaned = query.replace(/[^a-zA-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned !== queries[0]) queries.push(cleaned);
  var noYear = cleaned.replace(/\s*\d{4}\s*/g, " ").trim();
  if (noYear && queries.indexOf(noYear) < 0) queries.push(noYear);
  var words = cleaned.split(" ").filter(function(w) { return w.length > 2; });
  while (words.length > 1) {
    words.pop();
    var subQ = words.join(" ");
    if (subQ.length > 3 && queries.indexOf(subQ) < 0) queries.push(subQ);
  }
  if (cleaned) {
    var parts = cleaned.split(" ");
    if (parts.length > 1) {
      var lastWords = parts.slice(-Math.min(2, parts.length)).join(" ");
      if (lastWords.length > 3 && queries.indexOf(lastWords) < 0) queries.push(lastWords);
      var lastWord = parts[parts.length - 1];
      if (lastWord.length > 3 && /[a-zA-Z]/.test(lastWord) && queries.indexOf(lastWord) < 0) queries.push(lastWord);
    }
  }
  for (var qi = 0; qi < queries.length; qi++) {
    var q = queries[qi];
    if (q.length < 3) continue;
    var url = movieshuntBase + "/?s=" + encodeURIComponent(q);
    var html = await fetchText(url, { headers: hdrs() });
    if (!html) continue;
    var found = parseSearchResults(html);
    if (found && found.length) {
      log("Search '" + q + "' found " + found.length + " results");
      return found;
    }
  }
  return results;
}

function matchHits(results, tmdbInfo, isTV) {
  var title = (isTV ? tmdbInfo.name : tmdbInfo.title) || "";
  var releaseYear = isTV ? (tmdbInfo.first_air_date || "").split("-")[0] : (tmdbInfo.release_date || "").split("-")[0];
  var mainLower = title.toLowerCase().replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
  var fillerRe = /\b(and|&|the|a|an)\b/g;
  var mainStripped = mainLower.replace(fillerRe, "").replace(/\s+/g, " ").trim();
  var mainWords = mainLower.split(/\s+/).filter(function(w) { return w.length > 1; });
  var scored = [];
  var seen = {};
  for (var i = 0; i < results.length; i++) {
    var doc = results[i];
    var docTitle = doc.title || "";
    var docUrl = doc.url || "";
    if (seen[docUrl]) continue;
    seen[docUrl] = true;
    var titleLower = docTitle.toLowerCase().replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
    var score = 0;
    if (titleLower === mainLower) score += 100;
    else if (titleLower.indexOf(mainLower) >= 0 || mainLower.indexOf(titleLower) >= 0) score += 50;
    else {
      var docStripped = titleLower.replace(fillerRe, "").replace(/\s+/g, " ").trim();
      if (docStripped.indexOf(mainStripped) >= 0 || mainStripped.indexOf(docStripped) >= 0) score += 50;
      else if (docStripped.replace(/[^a-z0-9\s]/g, "").trim() === mainStripped.replace(/[^a-z0-9\s]/g, "").trim()) score += 60;
    }
    if (score === 0 && mainWords.length > 1) {
      var docWords = titleLower.split(/\s+/).filter(function(w) { return w.length > 1; });
      var matchCount = 0;
      for (var wi = 0; wi < mainWords.length; wi++) {
        for (var wj = 0; wj < docWords.length; wj++) {
          if (mainWords[wi] === docWords[wj] || docWords[wj].indexOf(mainWords[wi]) === 0 || mainWords[wi].indexOf(docWords[wj]) === 0) {
            matchCount++;
            break;
          }
        }
      }
      if (matchCount >= Math.min(mainWords.length, 3)) score += 50;
    }
    if (score >= 50 && releaseYear && docTitle.indexOf(releaseYear) >= 0) score += 10;
    if (score >= 50) scored.push({ doc: doc, score: score });
  }
  scored.sort(function(a, b) { return b.score - a.score; });
  var result = [];
  for (var si = 0; si < Math.min(scored.length, 5); si++) result.push(scored[si].doc);
  return result;
}

function extractAbhilinksUrl(html) {
  var m = html.match(/<a[^>]*href="(https:\/\/abhilinks\.(?:life|site)\/[^"]+)"[^>]*class="btn"[^>]*>/i);
  if (m) return m[1];
  var m2 = html.match(/<a[^>]*href="(https:\/\/abhilinks\.(?:life|site)\/[^"]+)"[^>]*>/i);
  if (m2) return m2[1];
  return null;
}

function extractQualityOptions(html) {
  var options = [];
  var qRe = /(2160|1080|720|480)[pP](?:\s+\w{1,15})?\s*\[([^\]]+)\]/g;
  var m;
  while ((m = qRe.exec(html)) !== null) {
    var quality = m[1].toLowerCase() + "p";
    var size = m[2];
    if (quality === "480p") continue;
    var pos = m.index;
    var ctx = html.substring(Math.max(0, pos - 200), pos + 600);
    var hubMatch = ctx.match(/href="(https:\/\/hubcloud\.cx\/(?:drive|video)\/[^"]+)"/i);
    var vcMatch = ctx.match(/href="(https:\/\/href\.li\/\?https:\/\/vcloud\.zip\/[^"]+)"/i);
    if (hubMatch) options.push({ quality: quality, size: size, type: "hubcloud", url: hubMatch[1] });
    else if (vcMatch) options.push({ quality: quality, size: size, type: "vcloud", url: vcMatch[1] });
  }
  return options;
}

function extractVcloudUrl(hrefLiUrl) {
  var m = hrefLiUrl.match(/href\.li\/\?https:\/\/vcloud\.zip\/([^"&?]+)/i);
  if (m) return "https://vcloud.zip/" + m[1];
  return null;
}

async function processHubcloud(hubUrl) {
  var html = await fetchText(hubUrl, { headers: hdrs({ Referer: abhilinksBase + "/" }) });
  if (!html) return null;
  var genMatch = html.match(/href="(https:\/\/[^"]*hubcloud\.php[^"]*)"/i);
  if (!genMatch) return null;
  var genUrl = genMatch[1].replace(/&amp;/g, "&");
  var desktopUA = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:152.0) Gecko/20100101 Firefox/152.0";
  var genHtml = await fetchText(genUrl, {
    headers: {
      "User-Agent": desktopUA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Referer": hubUrl,
      "DNT": "1",
      "Cookie": "xla=s4t"
    }
  });
  if (!genHtml || genHtml.length < 500) return null;
  return extractFSLLinks(genHtml);
}

async function processVcloud(vcUrl) {
  var html = await fetchText(vcUrl, { headers: hdrs({ Referer: abhilinksBase + "/" }) });
  if (!html) return null;
  var b64 = html.match(/atob\s*\(\s*atob\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\)/);
  if (!b64) return null;
  var first, tokenUrl;
  try {
    first = atob(b64[1]);
    tokenUrl = atob(first);
  } catch (e) { return null; }
  var tokenHtml = await fetchText(tokenUrl, { headers: hdrs({ Referer: movieshuntBase + "/", Cookie: "xla=s4t" }) });
  if (!tokenHtml) return null;
  return extractFSLLinks(tokenHtml);
}

function extractFSLLinks(html) {
  var streams = [];
  var anchors = html.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi);
  if (!anchors) return streams;
  for (var i = 0; i < anchors.length; i++) {
    var a = anchors[i];
    var hm = a.match(/href="([^"]+)"/i);
    var tm = a.match(/>([\s\S]*?)<\/a>/i);
    if (!hm) continue;
    var url = hm[1].replace(/&amp;/g, "&");
    var text = tm ? tm[1].replace(/<[^>]+>/g, "").trim() : "";
    if (!url || url.indexOf("javascript:") === 0) continue;
    if (/telegram/i.test(text) || /tg\//i.test(url) || /pixeldrain/i.test(url)) continue;
    if (/hubcloud\.cx|gpdl2/i.test(url)) continue;
    var type = "";
    if (/cdn\.fsl-buckets\.life/i.test(url) || /r2\.cloudflarestorage/i.test(url) || /r2\.dev/i.test(url)) type = "FSLv2";
    else if (/hub\.(latent|whistle)/i.test(url)) type = "FSL";
    else if (/workers\.dev/i.test(url)) type = "Worker";
    else continue;
    var quality = "";
    var qm2 = text.match(/(2160|1080|720|480)\s*[pP]/i);
    if (qm2) quality = qm2[1].toLowerCase() + "p";
    streams.push({ url: url, type: type, quality: quality, rawText: text });
  }
  return streams;
}

function dedupe(arr) {
  var seen = {};
  return (arr || []).filter(function(item) {
    if (!item || !item.url) return false;
    if (seen[item.url]) return false;
    seen[item.url] = true;
    return true;
  });
}

function extractEpisodes(html) {
  var episodes = [];
  var epRe = /-:\s*Episodes?\s*:\s*(\d+)\s*:-/gi;
  var parts = [];
  var m;
  while ((m = epRe.exec(html)) !== null) parts.push({ num: parseInt(m[1]), idx: m.index });
  if (parts.length === 0) {
    var ep2 = />\s*Episode\s*(\d+)\s*</gi;
    while ((m = ep2.exec(html)) !== null) parts.push({ num: parseInt(m[1]), idx: m.index });
  }

  for (var i = 0; i < parts.length; i++) {
    var start = parts[i].idx;
    var end = i + 1 < parts.length ? parts[i + 1].idx : html.length;
    var secHtml = html.substring(start, end);
    var links = [];
    var hubRe = /href="(https:\/\/hubcloud\.cx\/(?:drive|video)\/[^"]+)"/gi;
    var hm;
    while ((hm = hubRe.exec(secHtml)) !== null) links.push({ type: "hubcloud", url: hm[1] });
    var vcRe = /href="(https:\/\/href\.li\/\?https:\/\/vcloud\.zip\/[^"]+)"/gi;
    while ((hm = vcRe.exec(secHtml)) !== null) {
      var vcUrl = extractVcloudUrl(hm[1]);
      if (vcUrl) links.push({ type: "vcloud", url: vcUrl });
    }
    if (links.length) episodes.push({ number: parts[i].num, links: links });
  }
  return episodes;
}

function extractSeasonLinks(html) {
  var seasons = {};
  var h4Re = /<h4[^>]*>([\s\S]*?)<\/h4>/gi;
  var h4s = [];
  var m;
  while ((m = h4Re.exec(html)) !== null) h4s.push({ inner: m[1], start: m.index, end: m.index + m[0].length });
  for (var i = 0; i < h4s.length; i++) {
    var h4 = h4s[i];
    var sMatch = h4.inner.match(/Season\s+(\d+)/i);
    var qMatch = h4.inner.match(/(\d+p)/i);
    if (!sMatch || !qMatch) continue;
    var sNum = parseInt(sMatch[1]);
    var qual = qMatch[1].toLowerCase();
    var sectionStart = h4s[i].end;
    var sectionEnd = i + 1 < h4s.length ? h4s[i + 1].start : html.length;
    var section = html.substring(sectionStart, sectionEnd);
    var urlMatch = section.match(/href="(https:\/\/abhilinks\.(?:life|site)\/archives\/\d+)\/?"/i);
    if (urlMatch) {
      if (!seasons[sNum]) seasons[sNum] = {};
      if (!seasons[sNum][qual]) seasons[sNum][qual] = urlMatch[1];
    }
  }
  return seasons;
}

function parseLanguage(searchPool) {
  var pool = String(searchPool || "").toLowerCase();
  var extraLangs = ["tamil", "telugu", "bengali", "malayalam", "kannada", "marathi", "punjabi"];
  var extraCount = 0;
  for (var i = 0; i < extraLangs.length; i++) {
    if (pool.indexOf(extraLangs[i]) !== -1) extraCount++;
  }
  if (extraCount >= 1 || pool.indexOf("multi") !== -1) return "Multi-Audio";
  if (pool.indexOf("dual") !== -1 || (pool.indexOf("hindi") !== -1 && pool.indexOf("english") !== -1)) return "Dual-Audio";
  return "Dual-Audio";
}

function buildDropdownMetadata(tmdbInfo, normQual, sizeText, serverType, isTV, season, episode, rawText, targetUrl) {
  var title = (isTV ? tmdbInfo.name : tmdbInfo.title) || "Unknown Title";
  var year = isTV ? (tmdbInfo.first_air_date || "").split("-")[0] : (tmdbInfo.release_date || "").split("-")[0];
  var yearStr = year ? " (" + year + ")" : "";
  var searchPool = (String(rawText) + " " + String(targetUrl)).toLowerCase();

  // Subheading Line 1
  var icon1 = isTV ? "🎬 " : "🍿 ";
  var line1 = icon1 + title + yearStr;
  if (isTV && season != null && episode != null) {
    line1 += " | S" + String(season).padStart(2, "0") + " E" + String(episode).padStart(2, "0");
  }

  // Subheading Line 2
  var qIcon = "💎";
  if (normQual.indexOf("2160") !== -1 || normQual.indexOf("4k") !== -1) qIcon = "🌟";
  else if (normQual.indexOf("1080") !== -1) qIcon = "🔥";

  var szMatch = searchPool.match(/(\d+(?:\.\d+)?\s*(?:gb|mb))/i);
  var extractedSize = szMatch ? szMatch[1].toUpperCase() : (sizeText || "Variable Size");
  var line2 = qIcon + " " + normQual + " | 💾 " + extractedSize;

  // Subheading Line 3
  var colorVal = "SDR";
  if (searchPool.indexOf("hdr10+") !== -1) colorVal = "HDR10+";
  else if (searchPool.indexOf("hdr10") !== -1) colorVal = "HDR10";
  else if (searchPool.indexOf("hdr") !== -1) colorVal = "HDR";

  var bitVal = "";
  if (searchPool.indexOf("10bit") !== -1 || searchPool.indexOf("10-bit") !== -1) bitVal = " • 10Bit";

  var codecVal = "🎥 x264";
  if (searchPool.indexOf("hevc") !== -1) codecVal = "⚡ HEVC";
  else if (searchPool.indexOf("x265") !== -1 || searchPool.indexOf("h265") !== -1) codecVal = "🎥 x265";

  var formatVal = targetUrl.indexOf(".mp4") !== -1 ? "MP4" : "MKV";
  var line3 = "🌈 " + colorVal + bitVal + " | " + codecVal + " | 📦 " + formatVal;

  // Subheading Line 4
  var langStr = parseLanguage(searchPool);
  
  var audioCodecs = [];
  if (searchPool.indexOf("ddp5.1") !== -1 || searchPool.indexOf("ddp 5.1") !== -1) audioCodecs.push("DDP5.1");
  if (searchPool.indexOf("truehd") !== -1) audioCodecs.push("TrueHD");
  if (searchPool.indexOf("dd5.1") !== -1 || searchPool.indexOf("5.1") !== -1) {
    if (audioCodecs.indexOf("DDP5.1") === -1) audioCodecs.push("DD 5.1");
  }
  if (audioCodecs.length === 0) {
    audioCodecs.push("AAC");
  }
  var audioCodecStr = audioCodecs.join(" • ");

  var atmosTag = searchPool.indexOf("atmos") !== -1 ? " | 🔊 Atmos" : "";
  var line4 = "🔈 " + langStr + " | 🎧 " + audioCodecStr + atmosTag;

  // Subheading Line 5
  var sourceVal = "📥 WEB-DL";
  if (searchPool.indexOf("web-rip") !== -1 || searchPool.indexOf("webrip") !== -1) sourceVal = "🌐 WEB-RIP";
  else if (searchPool.indexOf("bluray") !== -1) sourceVal = "💿 Blu-Ray";

  var line5 = "🔗 " + (serverType || "FSL") + " | " + sourceVal;

  return line1 + "\n" + line2 + "\n" + line3 + "\n" + line4 + "\n" + line5;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  currentUA = UAS[Math.floor(Math.random() * UAS.length)];
  log("getStreams(" + tmdbId + ", " + mediaType + ", " + season + ", " + episode + ")");

  var isTV = mediaType === "tv" || mediaType === "series";
  var tmdbInfo = await getTMDBInfo(tmdbId, mediaType);
  if (!tmdbInfo) { log("TMDB fetch failed"); return []; }

  var title = isTV ? tmdbInfo.name : tmdbInfo.title;
  if (!title) { log("No title from TMDB"); return []; }
  log("Title: " + title);

  var searchResults = await searchSite(title);
  if (!searchResults || !searchResults.length) { log("Search failed"); return []; }
  log("Search results: " + searchResults.length);

  var matches = matchHits(searchResults, tmdbInfo, isTV);
  if (!matches.length) { log("No match found"); return []; }
  log("Matches: " + matches.length);

  for (var mi = 0; mi < matches.length; mi++) {
    var matched = matches[mi];
    var postUrl = matched.url;
    log("Trying post: " + postUrl);

    var postHtml = await fetchText(postUrl, { headers: hdrs() });
    if (!postHtml) continue;

    var allStreams = [];

    if (isTV) {
      var parsedSeason = season !== undefined && season !== null && season !== "undefined" ? parseInt(season) : null;
      var parsedEpisode = episode !== undefined && episode !== null && episode !== "undefined" ? parseInt(episode) : null;

      var seasonAbhiUrls = [];

      if (parsedSeason) {
        var seasonLinks = extractSeasonLinks(postHtml);
        if (seasonLinks[parsedSeason]) {
          var quals = Object.keys(seasonLinks[parsedSeason]).sort(function(a, b) { return parseInt(b) - parseInt(a); });
          quals.forEach(function(q) { seasonAbhiUrls.push({ quality: q, url: seasonLinks[parsedSeason][q] }); });
          log("S" + parsedSeason + " qualities: " + quals.join(", "));
        }
      }

      if (!seasonAbhiUrls.length) {
        var fallback = extractAbhilinksUrl(postHtml);
        if (fallback) seasonAbhiUrls.push({ quality: "", url: fallback });
      }

      if (!seasonAbhiUrls.length) { log("No abhilinks URLs, trying next match"); continue; }

      var tvTasks = [];
      for (var qui = 0; qui < seasonAbhiUrls.length; qui++) {
        var sa = seasonAbhiUrls[qui];
        log("Fetching " + (sa.quality || "default") + ": " + sa.url);
        var abhilinksHtml = await fetchText(sa.url, { headers: hdrs() });
        if (!abhilinksHtml) { log("  fetch failed"); continue; }

        var epList = extractEpisodes(abhilinksHtml);
        if (!epList.length) { log("  no episodes"); continue; }

        var filtered = epList;
        if (parsedEpisode) {
          filtered = epList.filter(function(ep) { return ep.number === parsedEpisode; });
          if (!filtered.length) { log("  episode " + parsedEpisode + " not found"); continue; }
        }

        for (var ei = 0; ei < filtered.length; ei++) {
          var ep = filtered[ei];
          for (var li = 0; li < ep.links.length; li++) {
            var link = ep.links[li];
            tvTasks.push((function(epNum, l, qual) {
              return async function() {
                var fslStreams = null;
                if (l.type === "hubcloud") fslStreams = await processHubcloud(l.url);
                else if (l.type === "vcloud") fslStreams = await processVcloud(l.url);
                if (fslStreams) {
                  fslStreams.forEach(function(s) { s.episode = epNum; s.quality = s.quality || qual; });
                }
                return fslStreams;
              };
            })(ep.number, link, sa.quality));
          }
        }
      }

      if (!tvTasks.length) { log("No hubcloud/vcloud tasks"); continue; }
      log("Processing " + tvTasks.length + " hubcloud/vcloud links...");
      var tvResults = await Promise.all(tvTasks.map(function(t) { return t(); }));
      for (var ri = 0; ri < tvResults.length; ri++) {
        if (!tvResults[ri]) continue;
        for (var si = 0; si < tvResults[ri].length; si++) {
          var fl = tvResults[ri][si];
          var qVal = (fl.quality || "").toLowerCase();
          if (qVal === "480p" || qVal === "hd") continue;
          
          var normQual = qVal || "1080p";
          var rawPool = (fl.rawText || "") + " " + fl.url;
          var displayLang = parseLanguage(rawPool);
          var metadata = buildDropdownMetadata(tmdbInfo, normQual, "", fl.type, true, parsedSeason, fl.episode, rawPool, fl.url);

          allStreams.push({
            name: PROVIDER_NAME + " | " + normQual + " | " + displayLang,
            title: metadata,
            size: metadata,
            description: metadata,
            url: fl.url,
            quality: "",
            language: "",
            headers: { Referer: movieshuntBase + "/", "User-Agent": currentUA }
          });
        }
      }
    } else {
      var abhilinksUrl = extractAbhilinksUrl(postHtml);
      if (!abhilinksUrl) { log("No abhilinks URL, trying next match"); continue; }
      log("Abhilinks: " + abhilinksUrl);

      var abhilinksHtml = await fetchText(abhilinksUrl, { headers: hdrs() });
      if (!abhilinksHtml) { log("Abhilinks fetch failed"); continue; }

      var qualityOptions = extractQualityOptions(abhilinksHtml);
      if (!qualityOptions.length) { log("No quality options found"); continue; }
      log("Quality options: " + qualityOptions.length);

      var tasks = [];
      for (var qi = 0; qi < qualityOptions.length; qi++) {
        var opt = qualityOptions[qi];
        tasks.push((function(qOpt) {
          return async function() {
            if (qOpt.type === "hubcloud") return await processHubcloud(qOpt.url);
            else if (qOpt.type === "vcloud") {
              var vcUrl = extractVcloudUrl(qOpt.url);
              if (!vcUrl) return null;
              return await processVcloud(vcUrl);
            }
            return null;
          };
        })(opt));
      }
      var results = await Promise.all(tasks.map(function(t) { return t(); }));

      for (var ri2 = 0; ri2 < results.length; ri2++) {
        if (!results[ri2]) continue;
        var qOpt = qualityOptions[ri2];
        for (var si2 = 0; si2 < results[ri2].length; si2++) {
          var fl2 = results[ri2][si2];
          var q = (fl2.quality || qOpt.quality || "").toLowerCase();
          if (q === "480p" || q === "hd") continue;
          
          var normQual = q || "1080p";
          var size = qOpt.size || "";
          var rawPool = (fl2.rawText || "") + " " + fl2.url + " " + size;
          var displayLang = parseLanguage(rawPool);
          var metadata = buildDropdownMetadata(tmdbInfo, normQual, size, fl2.type, false, null, null, rawPool, fl2.url);

          allStreams.push({
            name: PROVIDER_NAME + " | " + normQual + " | " + displayLang,
            title: metadata,
            size: metadata,
            description: metadata,
            url: fl2.url,
            quality: "",
            language: "",
            headers: { Referer: movieshuntBase + "/", "User-Agent": currentUA }
          });
        }
      }
    }

    allStreams = dedupe(allStreams);

    function getResolutionScore(nameStr) {
      var pool = nameStr.toLowerCase();
      if (pool.indexOf("2160p") !== -1 || pool.indexOf("4k") !== -1) return 2160;
      if (pool.indexOf("1080p") !== -1) return 1080;
      if (pool.indexOf("720p") !== -1) return 720;
      if (pool.indexOf("480p") !== -1) return 480;
      return 0;
    }

    allStreams.sort(function(a, b) {
      return getResolutionScore(b.name) - getResolutionScore(a.name);
    });

    if (allStreams.length > 0) {
      log("Returning " + allStreams.length + " streams from " + postUrl);
      return allStreams;
    }
    log("No streams from this post, trying next match");
  }

  log("No streams from any match");
  return [];
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
