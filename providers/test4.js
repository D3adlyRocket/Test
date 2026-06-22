const PROVIDER_NAME = "ZinkMovies";
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://zinkmovies.wtf";
var currentUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function hdrs(extra) {
  var h = { "User-Agent": currentUA, "Accept-Language": "en-US,en;q=0.9" };
  if (extra) { for (var k in extra) h[k] = extra[k]; }
  return h;
}

async function fetchText(url, opts) {
  try {
    var r = await fetch(url, opts || {});
    if (r.ok) return await r.text();
  } catch (e) {}
  return null;
}

async function fetchJson(url, opts) {
  try {
    var r = await fetch(url, opts || {});
    if (r.ok) return await r.json();
  } catch (e) {}
  return null;
}

// ==================== ORIGINAL FORMATTING ENGINE ====================
function makeStream(rawFilename, serverType, url, referer, parsedSize) {
  var decodedScan = "";
  try {
    decodedScan = decodeURIComponent(url) + " " + rawFilename;
  } catch(e) {
    decodedScan = url + " " + rawFilename;
  }
  
  var scanText = decodedScan.toLowerCase().replace(/[\s\.\-\+\[\]_]+/g, " ");
  var audioScan = decodedScan.toLowerCase().replace(/[\s\.\-\+\[\]_]+/g, "");

  // 1. QUALITY PARSING
  var quality = "1080P";
  var qMatch = rawFilename.match(/(2160|1080|720|480)\s*P/i);
  if (qMatch) quality = qMatch[1].toUpperCase() + "P";
  else if (/\b(4k|uhd)\b/.test(scanText)) quality = "2160P";

  // 2. LANGUAGE MATCH MATRIX
  var shortLangLabel = "Dual-Audio"; 
  var hasHindi = /\bhindi\b/.test(scanText);
  var hasEng = /\b(english|eng)\b/.test(scanText);
  var hasTamil = /\btamil\b/.test(scanText);
  var hasTelugu = /\btelugu\b/.test(scanText);
  
  var langCount = 0;
  if (hasHindi) langCount++;
  if (hasEng) langCount++;
  if (hasTamil) langCount++;
  if (hasTelugu) langCount++;

  if (/\b(multi|multiaudio)\b/.test(scanText) || langCount >= 3) {
    shortLangLabel = "Multi-Audio";
  } else if (/\b(dual|dualaudio|dubbed)\b/.test(scanText) || langCount === 2) {
    shortLangLabel = "Dual-Audio";
  } else if (langCount === 1) {
    if (hasHindi) shortLangLabel = "Hindi";
    else if (hasTamil) shortLangLabel = "Tamil";
    else if (hasTelugu) shortLangLabel = "Telugu";
    else if (hasEng) shortLangLabel = "English";
  }

  // 3. TITLE CLEANER
  var cleanDisplayTitle = rawFilename.replace(/\.(mkv|mp4|avi)$/i, "").replace(/\./g, " ");
  var seasonEpisodeBlock = "";
  
  var tvMatch = cleanDisplayTitle.match(/\b(S\d{1,2}\s*E\d{1,2})\b/i);
  if (tvMatch) {
    seasonEpisodeBlock = " | " + tvMatch[1].toUpperCase().replace(/\s+/g, "");
    var tvIdx = cleanDisplayTitle.toLowerCase().indexOf(tvMatch[0].toLowerCase());
    if (tvIdx > 0) cleanDisplayTitle = cleanDisplayTitle.substring(0, tvIdx);
  }

  var yearBlock = "";
  var yearMatch = cleanDisplayTitle.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    yearBlock = yearMatch[0];
    var titleEndIdx = cleanDisplayTitle.indexOf(yearBlock);
    if (titleEndIdx > 0) cleanDisplayTitle = cleanDisplayTitle.substring(0, titleEndIdx);
  }

  cleanDisplayTitle = cleanDisplayTitle
    .replace(/AMZN|WEB-DL|AVC|x264|x265|HEVC|STAN|WEBRip|SDR|10bit|iTunes/gi, "")
    .replace(/[-_()\[\]|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  cleanDisplayTitle = cleanDisplayTitle.replace(/\b\w/g, function (c) { return c.toUpperCase(); });

  // 4. METADATA PROFILE LINES
  var qEmoji = (quality === "2160P") ? "🌟" : "💎";
  var line2 = qEmoji + " " + quality + " | 🌍 " + shortLangLabel + " | 💾 " + (parsedSize || "N/A");

  var dynamicHdr = "";
  var showLightning = false;
  if (/\b(hdr10\+|hdr10p)\b/.test(scanText)) { dynamicHdr = "HDR10+"; showLightning = true; }
  else if (/\bhdr10\b/.test(scanText)) { dynamicHdr = "HDR10"; showLightning = true; }
  else if (/\bhdr\b/.test(scanText)) { dynamicHdr = "HDR"; showLightning = true; }

  var bitDepth = /\b10bit\b/.test(scanText) ? "🔆 10Bit" : "";
  var dv = /\b(dv|dolby\s*vision|dolbyvision)\b/.test(scanText) ? "🕵️‍♀️ DV" : "";
  var isBluRay = /\bbluray\b/.test(scanText);
  
  var codecTag = "x264";
  if (/\b(hevc|x265|265|h265)\b/.test(scanText)) {
    codecTag = "HEVC x265";
  } else if (/\b(x264|264|h264)\b/.test(scanText)) {
    codecTag = "x264";
  } else if (quality === "2160P") {
    codecTag = "HEVC x265";
  }

  var line3Parts = [];
  if (dynamicHdr) line3Parts.push(dynamicHdr);
  if (bitDepth) line3Parts.push(bitDepth);
  if (isBluRay) line3Parts.push("📀 BluRay");
  if (dv) line3Parts.push(dv);

  var line3 = "";
  if (line3Parts.length > 0) {
    var prefix = showLightning ? "⚡ " : "";
    line3 = prefix + line3Parts.join(" • ") + " | 🎥 " + codecTag;
  } else {
    line3 = "🎥 " + codecTag;
  }

  var formatTag = "🎞️ MKV";
  if (/\bmp4\b/.test(scanText)) formatTag = "🎞️ MP4";

  var audioChannelTag = "DDP 5.1";
  var displayAtmos = /\batmos\b/.test(scanText);

  if (audioScan.indexOf("ddp51atmos") !== -1 || audioScan.indexOf("atmos51") !== -1 || audioScan.indexOf("ddpatmos51") !== -1) {
    audioChannelTag = "DDP 5.1";
    displayAtmos = true;
  } else if (audioScan.indexOf("truehd71") !== -1) {
    audioChannelTag = "TrueHD 7.1";
  } else if (audioScan.indexOf("aac71") !== -1) {
    audioChannelTag = "AAC 7.1";
  } else if (audioScan.indexOf("aac") !== -1) {
    audioChannelTag = "AAC 5.1";
  }

  var atmosBlock = displayAtmos ? " • 🔊 Atmos" : "";
  var line4 = formatTag + " | 🎧 " + audioChannelTag + atmosBlock + " |";

  var sourceOrigin = "WEB-DL";
  if (isBluRay) {
    sourceOrigin = "BluRay";
  } else if (/\bwebrip\b/.test(scanText) || /\bhdrip\b/.test(scanText)) {
    sourceOrigin = "WEB-Rip";
  } else if (/\b(webdl|web\-dl|itunes|amzn)\b/.test(scanText)) {
    sourceOrigin = "WEB-DL";
  }

  var imaxBlock = /\bimax\b/.test(scanText) ? " | 👁️ iMAX" : "";
  var line5 = "🔗 " + (serverType || "Worker") + " | ☁️ " + sourceOrigin + imaxBlock;

  var finalName = "ZinkMovies | " + quality + " | " + shortLangLabel;
  var finalTitle = 
    "🎬 " + cleanDisplayTitle + (yearBlock ? " - (" + yearBlock + ")" : "") + seasonEpisodeBlock + "\n" +
    line2 + "\n" +
    line3 + "\n" +
    line4 + "\n" +
    line5;

  return {
    name: finalName,
    title: finalTitle,
    size: finalTitle, 
    url: url.replace(/ /g, "%20"),
    behaviorHints: {
      notWebReady: true,
      proxyHeaders: { request: { "Referer": referer || "https://zinkmovies.wtf/" } }
    }
  };
}

async function serverHandler(id, server) {
  try {
    var r = await fetch("https://new3.zinkcloud.net/server-handler.php", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", "User-Agent": currentUA },
      body: JSON.stringify({ server: server, random_id: id })
    });
    var d = await r.json();
    if (d && d.success && d.url) return d.url;
  } catch (e) {}
  return null;
}

// ─── INTERMEDIARY EXTRACTION PIPELINE ───
async function processFile(id) {
  var streams = [];
  var targetLandingUrl = "https://new3.zinkcloud.net/file/" + id;
  
  var landHtml = await fetchText(targetLandingUrl, { headers: hdrs() });
  if (!landHtml) return streams;

  var parsedFilename = "";
  var headMatch = landHtml.match(/<h1[^>]*class=["']text-center[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) ||
                  landHtml.match(/<div[^>]*class=["']card-header[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (headMatch) {
    parsedFilename = headMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  } else {
    var titleFallback = landHtml.match(/<title>Download\s+([^<]+)<\/title>/i);
    if (titleFallback) parsedFilename = titleFallback[1].trim();
  }
  if (!parsedFilename) return streams;

  var parsedSize = "";
  var sizeCells = landHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
  if (sizeCells) {
    for (var x = 0; x < sizeCells.length; x++) {
      var cleanText = sizeCells[x].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (/([\d\.]+\s*(?:GB|MB|KB))/i.test(cleanText)) {
        parsedSize = cleanText.match(/([\d\.]+\s*(?:GB|MB|KB))/i)[1];
        break;
      }
    }
  }

  var hcUrl = await serverHandler(id, "hubcloud");
  if (hcUrl) {
    var hcHtml = await fetchText(hcUrl, { headers: hdrs() });
    if (hcHtml) {
      var gamer = hcHtml.match(/href="(https:\/\/gamerxyt\.com[^"]+)"/i);
      if (gamer) {
        var gUrl = gamer[1].replace(/&amp;/g, "&");
        var gHtml = await fetchText(gUrl, { headers: hdrs() });
        if (gHtml) {
          var fm = gHtml.match(/href="([^"]+)"[^>]*id="fsl"/);
          if (fm) {
            streams.push(makeStream(parsedFilename, "FSL", fm[1], gUrl, parsedSize));
          }
        }
      }
    }
  }

  var workerUrl = await serverHandler(id, "worker");
  if (workerUrl) {
    streams.push(makeStream(parsedFilename, "Worker", workerUrl, BASE_URL, parsedSize));
  }

  return streams;
}

// ─── LINK SCRAPER MODULE ──────────────────────────────────────────

async function scrapeZinkCloud(title, year, isTv, season, episode) {
  var streams = [];
  try {
    var searchUrl = BASE_URL + "/?s=" + encodeURIComponent(title);
    var searchHtml = await fetchText(searchUrl, { headers: hdrs() });
    if (!searchHtml) return streams;

    // Fluid matching: targets any link layout containing the matching alphanumeric string
    var rx = /href=["'](https?:\/\/[^"'\s<>]+)["']/ig;
    var m, postUrl;
    var cleanTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    
    while ((m = rx.exec(searchHtml)) !== null) {
      var slug = m[1].toLowerCase();
      if (slug.indexOf(cleanTitle) > -1 && slug.indexOf("zinkmovies.wtf") > -1 && slug.indexOf("?s=") === -1) {
        postUrl = m[1];
        break;
      }
    }
    if (!postUrl) return streams;

    var postHtml = await fetchText(postUrl, { headers: hdrs() });
    if (!postHtml) return streams;

    if (isTv) {
      var lsUrls = [];
      var lsRx = /href=["'](https:\/\/linkstore\.zinkcloud\.net\/\d+\/)["']/ig;
      while ((m = lsRx.exec(postHtml)) !== null) {
        if (lsUrls.indexOf(m[1]) === -1) lsUrls.push(m[1]);
      }

      var targets = [];
      for (var i = 0; i < lsUrls.length; i++) {
        var lsHtml = await fetchText(lsUrls[i], { headers: hdrs() });
        if (!lsHtml) continue;
        
        var epRx = /href=["']https:\/\/new3\.zinkcloud\.net\/file\/([^"'\s>]+)["']/ig;
        while ((m = epRx.exec(lsHtml)) !== null) {
          if (targets.indexOf(m[1]) === -1) targets.push(m[1]);
        }
      }

      for (var i = 0; i < targets.length; i++) {
        var epStreams = await processFile(targets[i]);
        for (var j = 0; j < epStreams.length; j++) streams.push(epStreams[j]);
      }
    } else {
      var fileRx = /href=["']https:\/\/new3\.zinkcloud\.net\/file\/([^"'\s>]+)["']/ig;
      var files = [];
      while ((m = fileRx.exec(postHtml)) !== null) {
        if (files.indexOf(m[1]) === -1) files.push(m[1]);
      }
      
      for (var i = 0; i < files.length; i++) {
        var fileStreams = await processFile(files[i]);
        for (var j = 0; j < fileStreams.length; j++) streams.push(fileStreams[j]);
      }
    }
  } catch (e) {}
  return streams;
}

// ─── MAIN ENTRY POINT ───────────────────────────────────────────────

async function getStreams(tmdbId, mediaType, season, episode) {
  var isTv = (mediaType === "series" || mediaType === "tv");
  var streams = [];

  try {
    var tmdbData = await fetchJson("https://api.themoviedb.org/3/" + (isTv ? "tv" : "movie") + "/" + tmdbId + "?api_key=" + TMDB_API_KEY);
    if (tmdbData) {
      var title = isTv ? tmdbData.name : tmdbData.title;
      var year = isTv ? (tmdbData.first_air_date || "").split("-")[0] : (tmdbData.release_date || "").split("-")[0];
      
      var zinkStreams = await scrapeZinkCloud(title, year, isTv, season, episode);
      for (var i = 0; i < zinkStreams.length; i++) streams.push(zinkStreams[i]);
    }
  } catch (e) {}

  // --- SORT ENGINE ---
  streams.forEach(function(s) {
    var scan = (s.title || "").toLowerCase();
    if (scan.indexOf("2160p") !== -1 || scan.indexOf("4k") !== -1) s._resWeight = 4;
    else if (scan.indexOf("1080p") !== -1) s._resWeight = 3;
    else if (scan.indexOf("720p") !== -1) s._resWeight = 2;
    else s._resWeight = 1;

    var nameScan = (s.name || "").toLowerCase();
    if (nameScan.indexOf("fsl") !== -1) s._srcWeight = 3;
    else if (nameScan.indexOf("worker") !== -1) s._srcWeight = 2;
    else s._srcWeight = 1;
  });

  streams.sort(function(a, b) {
    if (b._resWeight !== a._resWeight) return b._resWeight - a._resWeight;
    return b._srcWeight - a._srcWeight;
  });

  streams.forEach(function(s) {
    delete s._resWeight;
    delete s._srcWeight;
  });

  return streams;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
