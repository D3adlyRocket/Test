const PROVIDER_NAME = "ZinkMovies";
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://zinkmovies.wtf";
var currentUA = "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

var UAS = [
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
];

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

function parseQuality(label) {
  var m = label.match(/(2160|1080|720|480)\s*P/i);
  if (m) return m[1] + "P";
  if (/4K|UHD/i.test(label)) return "2160P";
  return "HD";
}

function siteTitle(html) {
  var tm = html.match(/<title>(.*?)<\/title>/i);
  if (!tm) return "";
  var clean = tm[1].match(/Download\s+(.+?)\s+In HD Free/i);
  return clean ? clean[1].trim() : tm[1].trim();
}

function cleanHubTitle(raw) {
  var t = raw.replace(/\.(mkv|mp4|avi)$/i, "").trim();
  t = t.replace(/\s*[-–—]\s*ZINKMOVIES.*/i, "").trim();
  t = t.replace(/\s*[-–—]\s*JiTU.*/i, "").trim();
  t = t.replace(/\s+(IMAX\s+)?(2160|1080|720|480)\s*[pP].*/i, "").trim();
  t = t.replace(/\s+4K\s+.*/i, "").trim();
  return t.trim() || raw;
}

// ==================== FLAWLESS STRATIFIED LAYOUT ENGINE ====================
function makeStream(name, title, url, quality, serverType, referer, fileSize) {
  var internalQuality = quality ? quality.toLowerCase() : "1080p";
  var encodedUrl = url.replace(/ /g, "%20");
  
  var cleanNameText = String(name || "").replace(/\./g, " ");
  var cleanTitleText = String(title || "").replace(/\./g, " ");
  var combinedScanText = (cleanNameText + " " + cleanTitleText + " " + encodedUrl).toLowerCase();
  var audioScan = combinedScanText.replace(/[\s\.]+/g, "");

  // 1. STRICT LANGUAGE MATRIX ENGINE (Defaulted to Dual-Audio for ZinkMovies)
  var shortLangLabel = "Dual-Audio"; 
  var hasHindi = /\bhindi\b/i.test(combinedScanText);
  var hasEng = /\b(english|eng)\b/i.test(combinedScanText);
  var hasTamil = /\btamil\b/i.test(combinedScanText);
  var hasTelugu = /\btelugu\b/i.test(combinedScanText);
  
  var langCount = 0;
  if (hasHindi) langCount++;
  if (hasEng) langCount++;
  if (hasTamil) langCount++;
  if (hasTelugu) langCount++;

  if (/\b(multi|multi-audio|multi\.audio)\b/i.test(combinedScanText) || langCount >= 3) {
    shortLangLabel = "Multi-Audio";
  } else if (/\b(dual|dual-audio|dual\.audio|dubbed)\b/i.test(combinedScanText) || langCount === 2) {
    shortLangLabel = "Dual-Audio";
  } else if (langCount === 1) {
    if (hasHindi) shortLangLabel = "Hindi";
    else if (hasTamil) shortLangLabel = "Tamil";
    else if (hasTelugu) shortLangLabel = "Telugu";
    else if (hasEng) shortLangLabel = "English";
  }

  // 2. SERIES & MOVIE TITLE CLEANING ENGINE
  var cleanDisplayTitle = cleanNameText;
  var seasonEpisodeBlock = "";
  
  var tvMatch = cleanNameText.match(/\b(S\d{1,2}\s*E\d{1,2})\b/i);
  if (tvMatch) {
    seasonEpisodeBlock = " | " + tvMatch[1].toUpperCase().replace(/\s+/g, "");
    var tvIdx = cleanNameText.toLowerCase().indexOf(tvMatch[0].toLowerCase());
    if (tvIdx > 0) cleanDisplayTitle = cleanNameText.substring(0, tvIdx);
  }

  var yearBlock = "";
  var yearMatch = cleanDisplayTitle.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    yearBlock = yearMatch[0];
    var titleEndIdx = cleanDisplayTitle.indexOf(yearBlock);
    if (titleEndIdx > 0) cleanDisplayTitle = cleanDisplayTitle.substring(0, titleEndIdx);
  }

  cleanDisplayTitle = cleanDisplayTitle
    .replace(/AMZN|WEB-DL|AVC|x264|x265|HEVC|STAN|WEBRip|SDR|10bit/gi, "")
    .replace(/[-_()\[\]|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  cleanDisplayTitle = cleanDisplayTitle.replace(/\b\w/g, function (c) { return c.toUpperCase(); });

  // 3. SUBHEADING LINE CONFIGURATIONS
  var qUpper = internalQuality.toUpperCase();
  var qEmoji = (internalQuality === "2160p" || internalQuality.includes("4k")) ? "🌟" : "💎";
  var line2 = qEmoji + " " + qUpper + " | 🌍 " + shortLangLabel + " | 💾 " + (fileSize || "N/A");

  var dynamicHdr = "";
  var showLightning = false;
  if (/\b(hdr10\+|hdr10p)\b/i.test(combinedScanText)) { dynamicHdr = "HDR10+"; showLightning = true; }
  else if (/\bhdr10\b/i.test(combinedScanText)) { dynamicHdr = "HDR10"; showLightning = true; }
  else if (/\bhdr\b/i.test(combinedScanText)) { dynamicHdr = "HDR"; showLightning = true; }
  else if (/\bsdr\b/i.test(combinedScanText)) { dynamicHdr = "SDR"; showLightning = true; }

  var bitDepth = /\b10bit\b/i.test(combinedScanText) ? "🔆 10Bit" : "";
  var dv = /\b(dv|dolby\s*vision)\b/i.test(combinedScanText) ? "🕵️‍♀️ DV" : "";
  var isBluRay = /\bbluray\b/i.test(combinedScanText);
  
  var codecTag = "x264";
  if (/\b(hevc|x265|265)\b/i.test(combinedScanText) || internalQuality === "2160p") codecTag = "HEVC x265";

  var line3Part1Elements = [];
  if (dynamicHdr) line3Part1Elements.push(dynamicHdr);
  if (bitDepth) line3Part1Elements.push(bitDepth);
  var line3Part1 = line3Part1Elements.join(" • ");

  var line3Part2Elements = [];
  if (isBluRay) line3Part2Elements.push("📀 BluRay");
  if (dv) line3Part2Elements.push(dv);
  var line3Part2 = line3Part2Elements.join(" • ");

  var metaParts = [];
  if (line3Part1) metaParts.push(line3Part1);
  if (line3Part2) metaParts.push(line3Part2);

  var line3 = "";
  if (metaParts.length > 0) {
    var prefix = showLightning ? "⚡ " : "";
    line3 = prefix + metaParts.join(" | ") + " | 🎥 " + codecTag;
  } else {
    line3 = "🎥 " + codecTag;
  }

  var formatTag = "🎞️ MKV";
  if (/\bmp4\b/i.test(combinedScanText) || encodedUrl.toLowerCase().split('?')[0].endsWith(".mp4")) {
    formatTag = "🎞️ MP4";
  }

  var audioChannelTag = "DDP 5.1";
  var displayAtmos = /\batmos\b/i.test(combinedScanText);

  if (audioScan.indexOf("ddp51") !== -1 && audioScan.indexOf("truehd") !== -1 && audioScan.indexOf("71") !== -1) {
    audioChannelTag = "DDP 5.1 + TrueHD 7.1";
    displayAtmos = true;
  }
  else if (audioScan.indexOf("ddp51") !== -1 && audioScan.indexOf("ddp71") !== -1) {
    audioChannelTag = "DDP 5.1 + DDP 7.1";
  }
  else if (audioScan.indexOf("ddp51") !== -1 && audioScan.indexOf("aac71") !== -1) {
    audioChannelTag = "DDP 5.1 + AAC 7.1";
  }
  else if (audioScan.indexOf("ddp51") !== -1) {
    audioChannelTag = "DDP 5.1";
  }
  else {
    if (audioScan.indexOf("truehd") !== -1) {
      audioChannelTag = "TrueHD 7.1";
    } else if (audioScan.indexOf("aac") !== -1) {
      audioChannelTag = (audioScan.indexOf("71") !== -1) ? "AAC 7.1" : "AAC 5.1";
    } else {
      audioChannelTag = "DDP 5.1";
    }
  }

  var atmosBlock = displayAtmos ? " • 🔊 Atmos" : "";
  var line4 = formatTag + " | 🎧 " + audioChannelTag + atmosBlock + " |";

  var sourceOrigin = "WEB-DL";
  if (isBluRay) sourceOrigin = "BluRay";
  else if (/\b(webrip|hdrip)\b/i.test(combinedScanText)) sourceOrigin = "WEB-Rip";

  var imaxBlock = /\bimax\b/i.test(combinedScanText) ? " | 👁️ iMAX" : "";
  var line5 = "🔗 " + (serverType || "Worker") + " | ☁️ " + sourceOrigin + imaxBlock;

  // 4. STRATIFIED LAYOUT GENERATION
  var finalName = "ZinkMovies | " + qUpper + " | " + shortLangLabel;
  var finalTitle = 
    "🎬 " + cleanDisplayTitle + (yearBlock ? " - (" + yearBlock + ")" : "") + seasonEpisodeBlock + "\n" +
    line2 + "\n" +
    line3 + "\n" +
    line4 + "\n" +
    line5;

  var baseStream = {
    name: finalName,
    title: finalTitle,
    size: finalTitle, 
    url: encodedUrl,
    behaviorHints: {
      notWebReady: true,
      proxyHeaders: { request: { "Referer": referer || "https://zinkmovies.wtf/" } }
    }
  };

  try {
    Object.defineProperties(baseStream, {
      qualityTag: { get: function() { return ""; }, enumerable: true, configurable: true },
      quality: { get: function() { return "\x08"; }, enumerable: true, configurable: true },
      language: { get: function() { return ""; }, enumerable: true, configurable: true }
    });
  } catch (e) {}

  return baseStream;
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

async function processFile(id, label, quality, isTv, season, episode) {
  var q = quality || parseQuality(label);
  var streams = [];
  if (q === "480P") return streams;

  var hcUrl = await serverHandler(id, "hubcloud");
  if (!hcUrl) return streams;

  var hcHtml = await fetchText(hcUrl, { headers: hdrs() });
  if (!hcHtml) return streams;

  var rawTitle = (hcHtml.match(/<title>(.*?)<\/title>/i) || [])[1] || "";
  var cleanTitle = cleanHubTitle(rawTitle);
  var displayName = cleanTitle || label;

  // --- Dynamic Size Extraction ---
  var detectedSize = "";
  var sizeMatch = hcHtml.match(/<td[^>]*>\s*File\s*Size\s*:\s*<\/td>\s*<td[^>]*>\s*([\d\.]+\s*[MGBtbi]+)\s*<\/td>/i);
  if (!sizeMatch) {
    sizeMatch = hcHtml.match(/Size\s*:\s*<\/strong>\s*([\d\.]+\s*[MGBtbi]+)/i);
  }
  if (sizeMatch) {
    detectedSize = sizeMatch[1].trim();
  }

  var gamer = hcHtml.match(/href="(https:\/\/gamerxyt\.com[^"]+)"/i);
  if (gamer) {
    var gHtml = await fetchText(gamer[1].replace(/&amp;/g, "&"), { headers: hdrs() });
    if (gHtml) {
      var fm = gHtml.match(/href="([^"]+)"[^>]*id="fsl"/);
      if (fm) {
        streams.push(makeStream(displayName, "FSL", fm[1], q, "FSL", gamer[1], detectedSize));
      }
    }
  }

  var workerUrl = await serverHandler(id, "worker");
  if (workerUrl) {
    streams.push(makeStream(displayName, "Worker", workerUrl, q, "Worker", BASE_URL, detectedSize));
  }

  return streams;
}

// ─── Gemma Embedded Player ──────────────────────────────────────────

function extractConfig(html) {
  try {
    var m = html.match(/new HDVBPlayer\((\{[\s\S]*?\})\)/);
    if (m) return JSON.parse(m[1]);
    var m2 = html.match(/(?:let|var|const)\s+\w+\s*=\s*(\{[\s\S]*?"file":[\s\S]*?\});/);
    if (m2) return JSON.parse(m2[1]);
  } catch (e) {}
  return null;
}

async function getGemmaStreams(imdbId, isTv, season, episode, title) {
  var streams = [];
  try {
    var playerUrl = "https://gemma416okl.com/play/" + imdbId;
    var html = await fetchText(playerUrl, { headers: hdrs({ "Referer": BASE_URL + "/" }) });
    if (!html) return streams;
    var config = extractConfig(html);
    if (!config || !config.file || !config.key) return streams;

    var masterUrl = config.file;
    if (masterUrl.indexOf("://") === -1) masterUrl = "https://gemma416okl.com" + masterUrl;
    var token = config.key;
    var data = await fetchJson(masterUrl, {
      method: "POST",
      headers: { "X-CSRF-TOKEN": token, "Content-Type": "application/x-www-form-urlencoded", "Origin": "https://gemma416okl.com", "Referer": playerUrl }
    });
    if (!data) return streams;

    var base = masterUrl.substring(0, masterUrl.lastIndexOf("/") + 1);
    var langs = [];
    if (isTv) {
      for (var i = 0; i < data.length && !langs.length; i++) {
        var s = data[i];
        if (s.id == season || (s.title && s.title.indexOf(String(season)) > -1)) {
          if (!s.folder) continue;
          for (var j = 0; j < s.folder.length; j++) {
            var ep = s.folder[j];
            if (ep.episode == episode || ep.id == (season + "-" + episode)) {
              if (!ep.folder) continue;
              for (var k = 0; k < ep.folder.length; k++) {
                if (ep.folder[k].file && ep.folder[k].file.indexOf("~") === 0) langs.push(ep.folder[k]);
              }
            }
          }
        }
      }
    } else {
      for (var i = 0; i < data.length; i++) {
        if (data[i].file && data[i].file.indexOf("~") === 0) langs.push(data[i]);
      }
    }

    for (var i = 0; i < langs.length; i++) {
      var fetchUrl = base + langs[i].file.substring(1) + ".txt";
      var m3u8 = await fetchText(fetchUrl, {
        method: "POST",
        headers: { "X-CSRF-TOKEN": token, "Content-Type": "application/x-www-form-urlencoded", "Origin": "https://gemma416okl.com", "Referer": playerUrl }
      });
      if (m3u8 && m3u8.indexOf(".m3u8") > -1) {
        var langLabel = langs[i].title ? " | " + langs[i].title : "";
        var embedStream = makeStream(title + langLabel, "Embed", m3u8.trim(), "1080P", "Embed", playerUrl, "");
        
        embedStream.behaviorHints.proxyHeaders = {
          request: {
            "origin": "https://i-arch-400.keymi417exx.com",
            "referer": "https://i-arch-400.keymi417exx.com/"
          }
        };
        streams.push(embedStream);
      }
    }
  } catch (e) {}
  return streams;
}

// ─── ZinkCloud (HubCloud/Worker/FSL) ─────────────────────────────────

async function scrapeZinkCloud(title, year, isTv, season, episode) {
  var streams = [];
  try {
    var searchHtml = await fetchText(BASE_URL + "/?s=" + encodeURIComponent(title));
    if (!searchHtml) return streams;

    var path = isTv ? "tvshows" : "movies";
    var rx = new RegExp('href="(https?:\\/\\/[^\\/]+\\/' + path + '\\/[^"]+)"', "ig");
    var m, postUrl;
    while ((m = rx.exec(searchHtml)) !== null) {
      if (!year || m[1].indexOf(year) > -1) { postUrl = m[1]; break; }
    }
    if (!postUrl) return streams;

    var postHtml = await fetchText(postUrl);
    if (!postHtml) return streams;

    if (isTv) {
      var lsUrls = [];
      var lsRx = /href="(https:\/\/linkstore\.zinkcloud\.net\/\d+\/)"/ig;
      while ((m = lsRx.exec(postHtml)) !== null) {
        if (lsUrls.indexOf(m[1]) === -1) lsUrls.push(m[1]);
      }

      var targets = [];
      await Promise.all(lsUrls.map(async (lsUrl) => {
        var lsHtml = await fetchText(lsUrl);
        if (!lsHtml) return;
        var lsTitle = (lsHtml.match(/<title>(.*?)<\/title>/i) || [])[1] || "";
        var sMatch = lsTitle.match(/Season\s*0?(\d+)/i);
        if (sMatch && parseInt(sMatch[1]) != season) return;
        var q = parseQuality(lsTitle);
        if (q === "480P") return;

        var epRx = /href="(https:\/\/new3\.zinkcloud\.net\/file\/([^"]+))"[^>]*>\s*<span[^>]*>(.*?)<\/span>/ig;
        while ((m = epRx.exec(lsHtml)) !== null) {
          var label = m[3].replace(/<[^>]+>/g, "").trim();
          if (label.toLowerCase().indexOf("all episodes") > -1) continue;
          var epNum = label.match(/(?:EPISODE|EP|E)\s*[-_]?\s*0?(\d+)/i);
          if (epNum && parseInt(epNum[1]) == episode) {
            targets.push({ id: m[2], label: label, quality: q });
          }
        }
      }));

      for (var i = 0; i < targets.length; i++) {
        var epStreams = await processFile(targets[i].id, targets[i].label, targets[i].quality, true, season, episode);
        for (var j = 0; j < epStreams.length; j++) streams.push(epStreams[j]);
      }
    } else {
      var fileRx = /href="(https:\/\/new3\.zinkcloud\.net\/file\/([^"]+))"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/ig;
      var files = [];
      while ((m = fileRx.exec(postHtml)) !== null) {
        files.push({ id: m[2], label: m[3].replace(/<[^>]+>/g, "").trim() });
      }
      await Promise.all(files.map(async (f) => {
        var fileStreams = await processFile(f.id, f.label, null, false, 0, 0);
        for (var i = 0; i < fileStreams.length; i++) streams.push(fileStreams[i]);
      }));
    }
  } catch (e) {}
  return streams;
}

// ─── Entry Point ────────────────────────────────────────────────────

async function getStreams(tmdbId, mediaType, season, episode) {
  currentUA = UAS[Math.floor(Math.random() * UAS.length)];
  var isTv = (mediaType === "series" || mediaType === "tv");
  var streams = [];
  var gemmaTitle = "";

  try {
    var tmdbData = await fetchJson("https://api.themoviedb.org/3/" + (isTv ? "tv" : "movie") + "/" + tmdbId + "?api_key=" + TMDB_API_KEY);
    if (tmdbData) {
      var title = isTv ? tmdbData.name : tmdbData.title;
      var year = isTv ? (tmdbData.first_air_date || "").split("-")[0] : (tmdbData.release_date || "").split("-")[0];
      gemmaTitle = isTv ? title + " S" + String(season).padStart(2, "0") + "E" + String(episode).padStart(2, "0") : title + (year ? " (" + year + ")" : "");
      var zinkStreams = await scrapeZinkCloud(title, year, isTv, season, episode);
      for (var i = 0; i < zinkStreams.length; i++) streams.push(zinkStreams[i]);
    }
  } catch (e) {}

  try {
    var extData = await fetchJson("https://api.themoviedb.org/3/" + (isTv ? "tv" : "movie") + "/" + tmdbId + "/external_ids?api_key=" + TMDB_API_KEY);
    if (extData && extData.imdb_id) {
      var gemmaStreams = await getGemmaStreams(extData.imdb_id, isTv, season, episode, gemmaTitle);
      for (var i = 0; i < gemmaStreams.length; i++) streams.push(gemmaStreams[i]);
    }
  } catch (e) {}

  // --- DIRECT ATTRIBUTE SORT ENGINE ---
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
