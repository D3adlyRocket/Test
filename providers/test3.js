var TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://tracker.coppersurfer.tk:6969/announce",
  "udp://tracker.leechers-paradise.org:6969/announce",
  "udp://p4p.arenabg.ch:1337/announce",
  "udp://tracker.internetwarriors.net:1337/announce",
  "udp://tracker.cyberia.is:6969/announce",
  "udp://tracker.tiny-vps.com:6969/announce",
  "udp://exodus.desync.com:6969/announce",
  "https://tracker.bt-hash.com:443/announce",
  "udp://open.demonii.com:1337/announce"
];

var NYAA_CATEGORIES = {
  ALL: "1_0",
  ENGLISH: "1_2"
};

var EPISODE_PATTERNS = [
  { re: /S(\d+)\s*E(\d+)/i, seasonGroup: 1, epGroup: 2 },
  { re: /S(\d+)\s*\.\s*E(\d+)/i, seasonGroup: 1, epGroup: 2 },
  { re: /Season\s+(\d+)\s+Episode\s+(\d+)/i, seasonGroup: 1, epGroup: 2 },
  { re: /(\d+)x(\d+)/i, seasonGroup: 1, epGroup: 2 },
  { re: /\[(\d+)\]$/i, seasonGroup: null, epGroup: 1 },
  { re: /\bE(\d+)\b/i, seasonGroup: null, epGroup: 1 },
  { re: /\bEP(\d+)\b/i, seasonGroup: null, epGroup: 1 },
  { re: /\bEpisodes?\s*(\d+)\b/i, seasonGroup: null, epGroup: 1 },
  { re: /\[(\d+)v\d\]/i, seasonGroup: null, epGroup: 1 }
];

var DASH_EP_PATTERN = /-\s*(\d{1,2})\b(?!\s*[pP])/i;
var BATCH_PATTERN = /\b(batch|complete|season\s+\d+\s+pack)\b/i;
var RANGE_PATTERN = /S(\d+)\s*E(\d+)\s*[-–]\s*E?(\d+)/i;
var RES_PATTERN = /\b(4K|2160p|1080p|720p|480p|360p)\b/i;
var TRUSTED_PATTERN = /\b(trusted|v2|remaster)\b/i;

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    if (mediaType !== "tv") return [];

    var titles = await getTitles(tmdbId);
    if (!titles || titles.length === 0) return [];

    var seen = {};
    var results = [];

    for (var ti = 0; ti < titles.length; ti++) {
      var query = titles[ti] + " S" + padZero(season, 2);
      var rssItems = await searchNyaa(query, NYAA_CATEGORIES.ENGLISH);
      if (!rssItems || rssItems.length === 0) {
        rssItems = await searchNyaa(query, NYAA_CATEGORIES.ALL);
      }

      for (var ri = 0; ri < rssItems.length; ri++) {
        var item = rssItems[ri];
        if (seen[item.infoHash]) continue;
        seen[item.infoHash] = true;

        var match = matchEpisode(item.title, season, episode);
        if (!match) continue;

        var quality = parseQuality(item.title);
        var magnet = buildMagnet(item.infoHash, item.title);

        results.push({
          title: item.title,
          name: item.title,
          url: magnet,
          infoHash: item.infoHash.toLowerCase(),
          quality: quality,
          size: item.size,
          seeders: item.seeders,
          provider: "Nyaa",
          type: "tv"
        });
      }

      if (results.length > 0) break;
    }

    results.sort(function(a, b) {
      var sa = a.seeders || 0;
      var sb = b.seeders || 0;
      return sb - sa;
    });

    return results;
  } catch (e) {
    console.error("Nyaa plugin error:", e.message || e);
    return [];
  }
}

async function getTitles(tmdbId) {
  var titles = [];
  try {
    var resp = await fetch("https://api.themoviedb.org/3/tv/" + tmdbId + "?api_key=" + TMDB_API_KEY);
    var data = await resp.json();
    if (!data) return titles;

    if (data.name) titles.push(data.name);
    if (data.original_name && data.original_name !== data.name) titles.push(data.original_name);

    var altResp = await fetch("https://api.themoviedb.org/3/tv/" + tmdbId + "/alternative_titles?api_key=" + TMDB_API_KEY);
    var altData = await altResp.json();
    if (altData && altData.results) {
      for (var i = 0; i < altData.results.length; i++) {
        var alt = altData.results[i];
        if (alt.title && titles.indexOf(alt.title) === -1) {
          titles.push(alt.title);
        }
      }
    }
  } catch (e) {
    console.error("TMDB title fetch failed:", e.message);
  }
  return titles;
}

async function searchNyaa(query, category) {
  try {
    var encoded = encodeURIComponent(query);
    var url = "https://nyaa.si/?page=rss&q=" + encoded + "&c=" + category + "&s=seeders&o=desc&limit=100";
    console.log("Nyaa RSS URL:", url);

    var resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/rss+xml, application/xml, text/xml, */*"
      }
    });
    var xml = await resp.text();
    if (!xml || xml.length < 100) return [];

    return parseRssItems(xml);
  } catch (e) {
    console.error("Nyaa search failed:", e.message);
    return [];
  }
}

function parseRssItems(xml) {
  var items = [];
  var itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  var match;

  while ((match = itemRegex.exec(xml)) !== null) {
    var block = match[1];
    var item = {};

    item.title = extractTag(block, "title");
    item.link = extractTag(block, "link");
    item.guid = extractTag(block, "guid");
    item.infoHash = extractNsTag(block, "nyaa:infoHash");
    item.seeders = parseInt(extractNsTag(block, "nyaa:seeders"), 10) || 0;
    item.leechers = parseInt(extractNsTag(block, "nyaa:leechers"), 10) || 0;
    item.size = extractNsTag(block, "nyaa:size") || "";
    item.categoryId = extractNsTag(block, "nyaa:categoryId") || "";
    item.trusted = extractNsTag(block, "nyaa:trusted") || "No";

    if (item.title && item.infoHash) {
      items.push(item);
    }
  }

  return items;
}

function extractTag(block, tagName) {
  var re = new RegExp("<" + tagName + "[^>]*>([\\s\\S]*?)<\\/" + tagName + ">", "i");
  var m = re.exec(block);
  return m ? m[1].trim() : "";
}

function extractNsTag(block, tagName) {
  var re = new RegExp("<" + tagName.replace(":", "\\:") + "[^>]*>([\\s\\S]*?)<\\/" + tagName.replace(":", "\\:") + ">", "i");
  var m = re.exec(block);
  return m ? m[1].trim() : "";
}

function matchEpisode(title, requestedSeason, requestedEpisode) {
  var reqEp = parseInt(requestedEpisode, 10);
  var reqSeason = parseInt(requestedSeason, 10);

  if (isNaN(reqEp)) return false;

  var rangeMatch = title.match(RANGE_PATTERN);
  if (rangeMatch) {
    var rangeSeason = parseInt(rangeMatch[1], 10);
    var rangeStart = parseInt(rangeMatch[2], 10);
    var rangeEnd = parseInt(rangeMatch[3], 10);
    if (rangeSeason === reqSeason && reqEp >= rangeStart && reqEp <= rangeEnd) {
      return true;
    }
  }

  for (var pi = 0; pi < EPISODE_PATTERNS.length; pi++) {
    var pat = EPISODE_PATTERNS[pi];
    var m = title.match(pat.re);
    if (!m) continue;

    if (pat.seasonGroup !== null) {
      var foundSeason = parseInt(m[pat.seasonGroup], 10);
      if (foundSeason !== reqSeason) continue;
    }

    var foundEp = parseInt(m[pat.epGroup], 10);
    if (foundEp === reqEp) return true;
  }

  var dashMatch = title.match(DASH_EP_PATTERN);
  if (dashMatch) {
    var dashEp = parseInt(dashMatch[1], 10);
    var knownSeasonInTitle = /\bS(\d+)\b/i.test(title);
    if (!knownSeasonInTitle && dashEp === reqEp) {
      return true;
    }
  }

  var isBatch = BATCH_PATTERN.test(title);
  if (isBatch) {
    var batchSeasonMatch = title.match(/\bSeason\s+(\d+)\b/i);
    if (!batchSeasonMatch) {
      batchSeasonMatch = title.match(/S(\d+)/i);
    }
    if (batchSeasonMatch) {
      var batchSeason = parseInt(batchSeasonMatch[1], 10);
      if (batchSeason === reqSeason) return true;
    }
  }

  return false;
}

function parseQuality(title) {
  var m = title.match(RES_PATTERN);
  if (m) return m[1];
  if (/\b4K\b/i.test(title) || /\b2160\b/i.test(title)) return "2160p";
  if (/\b1080\b/i.test(title)) return "1080p";
  if (/\b720\b/i.test(title)) return "720p";
  if (/\b480\b/i.test(title)) return "480p";
  return null;
}

function buildMagnet(infoHash, title) {
  var encodedName = encodeURIComponent(title.replace(/\[[^\]]*\]/g, "").trim());
  var magnet = "magnet:?xt=urn:btih:" + infoHash + "&dn=" + encodedName;
  for (var ti = 0; ti < TRACKERS.length; ti++) {
    magnet += "&tr=" + encodeURIComponent(TRACKERS[ti]);
  }
  return magnet;
}

function padZero(num, len) {
  var s = String(num);
  while (s.length < len) s = "0" + s;
  return s;
}

module.exports = { getStreams };
