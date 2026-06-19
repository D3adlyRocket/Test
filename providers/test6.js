var PROVIDER_NAME = "CineFreak";
var BASE_URL = "https://cinefreak.nl";
var CINECLOUD_BASE = "https://new5.cinecloud.site";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var REQUEST_TIMEOUT = 12000;

const MOBILE_UAS = [
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
];

function getHeaders(sessionUA) {
  return {
    "User-Agent": sessionUA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5"
  };
}

async function fetchText(url, sessionUA) {
  try {
    var opts = { headers: getHeaders(sessionUA || MOBILE_UAS[0]) };
    const timeout = new Promise(function(_, r) { setTimeout(function() { r(new Error('timeout')); }, 4000); });
    const res = await Promise.race([fetch(url, opts), timeout]);
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    return null;
  }
}

async function fetchJson(url, sessionUA) {
  try {
    var text = await fetchText(url, sessionUA);
    if (!text) return null;
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function parseQuality(text) {
  var t = String(text || '').toLowerCase();
  if (t.indexOf('2160') >= 0 || t.indexOf('4k') >= 0) return '2160p';
  if (t.indexOf('1080') >= 0) return '1080p';
  if (t.indexOf('720') >= 0) return '720p';
  if (t.indexOf('480') >= 0) return '480p';
  return 'HD';
}

function extractFslUrl(html) {
  var fileRegex = /href="([^"]+)"[^>]*id="fsl"|href="([^"]+(?:\.workers\.dev|\.r2\.dev|\.buzz|\.cloudflarestorage\.com)\/[^"]+)"|href="(https?:\/\/[^"]+\.(?:mkv|mp4)[^"]*)"|href="(https:\/\/pub-[^"]+)"/ig;
  var fm;
  while ((fm = fileRegex.exec(html)) !== null) {
      var finalUrl = fm[1] || fm[2] || fm[3] || fm[4];
      if (finalUrl && !finalUrl.includes(".zip")) {
          return finalUrl.replace(/&amp;/g, '&');
      }
  }
  
  var marker = 'href="https://pub-';
  var idx = html.indexOf(marker);
  if (idx === -1) return null;
  var start = idx + 6;
  var end = html.indexOf('"', start);
  if (end === -1) return null;
  var url = html.substring(start, end);
  url = url.replace(/&amp;/g, '&');
  return url;
}

function decodeGenerateUrl(encoded) {
  try {
    var decoded = atob(encoded);
    decoded = decoded.replace(/newgo32$/, '');
    return decoded;
  } catch (e) {
    return null;
  }
}

function encodeUri(str) {
  try {
    return encodeURIComponent(str);
  } catch (e) {
    return str;
  }
}

function manifest() {
  return {
    id: "cinefreak",
    name: "CineFreak",
    description: "Direct MKV/MP4 streams from cinefreak.nl",
    version: "1.0.0",
    logo: "https://cinefreak.nl/wp-content/uploads/2024/08/cropped-cgk-192x192.png",
    background: "https://cinefreak.nl/wp-content/uploads/2024/08/cropped-cgk-192x192.png",
    types: ["movie", "tv"],
    resources: ["stream"],
    idPrefixes: ["tt", "tmdb"]
  };
}

async function search(query, type) {
  if (!query) return [];
  var searchUrl = BASE_URL + "/wp-json/wp/v2/search?search=" + encodeUri(query) + "&per_page=10";
  var data = await fetchJson(searchUrl);
  if (!data || !data.length) return [];

  var results = [];
  for (var i = 0; i < data.length; i++) {
    var item = data[i];
    if (!item || !item.title || !item.url) continue;
    var title = String(item.title).replace(/Download\s*/gi, '').trim();
    if (!title) continue;
    results.push({
      id: item.url,
      title: title,
      url: item.url
    });
  }
  return results;
}

async function getTMDBInfo(tmdbId, mediaType, sessionUA) {
  var isTv = (mediaType === 'tv' || mediaType === 'series');
  var url = isTv
    ? 'https://api.themoviedb.org/3/tv/' + tmdbId + '?api_key=' + TMDB_API_KEY
    : 'https://api.themoviedb.org/3/movie/' + tmdbId + '?api_key=' + TMDB_API_KEY;
  var data = await fetchJson(url, sessionUA);
  if (!data) return null;
  return {
    title: isTv ? data.name : data.title,
    year: isTv
      ? (data.first_air_date || '').substring(0, 4)
      : (data.release_date || '').substring(0, 4),
    isTv: isTv
  };
}

function wordMatchScore(searchTitle, postTitle) {
  var st = String(searchTitle || '').toLowerCase().trim();
  var pt = String(postTitle || '').toLowerCase();
  var stWords = st.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
  var matchCount = 0;
  var totalWords = 0;
  for (var w = 0; w < stWords.length; w++) {
    var word = stWords[w];
    if (word.length < 3) continue;
    totalWords++;
    // Use word boundary check to avoid partial word matches
    var re = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    if (re.test(postTitle)) matchCount++;
  }
  if (totalWords === 0) return 0;
  return matchCount / totalWords;
}

function titleStartsWith(title, searchTitle) {
  var t = String(title || '').toLowerCase().trim();
  var s = String(searchTitle || '').toLowerCase().trim();
  // Check if title starts with the search term (e.g. "FROM (2022)...")
  return t.indexOf(s) === 0 || t.indexOf(s + ' ') === 0 || t.indexOf('(' + s + ')') === 0;
}

function urlContains(url, searchTitle) {
  var u = String(url || '').toLowerCase();
  var slug = String(searchTitle || '').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  var words = slug.split('-').filter(function(w) { return w.length > 2; });
  var matchCount = 0;
  for (var i = 0; i < words.length; i++) {
    if (u.indexOf(words[i]) >= 0) matchCount++;
  }
  return words.length > 0 ? matchCount / words.length : 0;
}

function matchByTitleYear(searchTitle, searchYear, posts, targetSeason) {
  if (!posts || !posts.length) return null;
  var st = String(searchTitle || '').toLowerCase().trim();
  var sy = String(searchYear || '');

  // Helper: score a post
  function scorePost(p) {
    if (!p) return 0;
    var s = 0;
    // Title starts with search term = strong indicator
    if (titleStartsWith(p.title, searchTitle)) s += 10;
    // URL contains search term words
    s += urlContains(p.url, searchTitle) * 5;
    // Word match score
    s += wordMatchScore(searchTitle, p.title);
    // Year match bonus
    if (sy && String(p.title).toLowerCase().indexOf(sy) >= 0) s += 3;
    return s;
  }

  // Pass 0: TV — season mention takes priority (highest boost)
  if (targetSeason) {
    var seasonPattern = '(?:season|s)\\s*' + targetSeason + '\\b';
    var seasonRegex = new RegExp(seasonPattern, 'i');
    var best = null;
    var bestScore = -1;
    for (var i = 0; i < posts.length; i++) {
      var p = posts[i];
      if (!p || !p.title) continue;
      if (seasonRegex.test(p.title)) {
        var s = scorePost(p) + 10; // Big boost for season match
        if (s > bestScore) { bestScore = s; best = p; }
      }
    }
    if (best) return best;
  }

  // Pass 1: Use scoring for all posts
  var best = null;
  var bestScore = -1;
  for (var i = 0; i < posts.length; i++) {
    var p = posts[i];
    if (!p || !p.title) continue;
    var s = scorePost(p);
    if (s > bestScore) { bestScore = s; best = p; }
  }
  if (best && bestScore >= 3) return best;

  return null;
}

async function searchCinefreak(query, year, sessionUA) {
  if (!query) return [];
  var searchUrl = BASE_URL + "/wp-json/wp/v2/search?search=" + encodeUri(query) + "&per_page=10";
  var data = await fetchJson(searchUrl, sessionUA);
  if (!data || !data.length) return [];

  var posts = [];
  for (var i = 0; i < data.length; i++) {
    var item = data[i];
    if (!item || !item.title || !item.url) continue;
    posts.push({
      id: item.id,
      title: String(item.title).replace(/Download\s*/gi, '').trim(),
      url: item.url
    });
  }
  return posts;
}

async function fetchPostPage(url, sessionUA) {
  if (!url) return null;
  // Ensure full URL
  var fullUrl = url;
  if (url.indexOf('http') !== 0) {
    if (url.indexOf('/') === 0) fullUrl = BASE_URL + url;
    else fullUrl = BASE_URL + '/' + url;
  }
  return await fetchText(fullUrl, sessionUA);
}

function extractAllGenerateLinks(html) {
  if (!html) return [];
  var results = [];
  var searchStart = 0;
  var marker = '/generate.php?id=';
  while (true) {
    var idx = html.indexOf(marker, searchStart);
    if (idx === -1) break;

    // Find the start of the href attribute
    var hrefStart = html.lastIndexOf('<a ', idx);
    if (hrefStart === -1 || hrefStart < searchStart) {
      searchStart = idx + 1;
      continue;
    }

    // Find the closing </a> tag
    var closeA = html.indexOf('</a>', idx);
    if (closeA === -1) {
      searchStart = idx + 1;
      continue;
    }

    // Extract anchor text (quality label)
    var anchorStart = html.indexOf('>', idx);
    if (anchorStart === -1 || anchorStart > closeA) {
      searchStart = closeA + 4;
      continue;
    }
    var label = html.substring(anchorStart + 1, closeA).trim();

    // Extract the id parameter
    var idEnd = html.indexOf('"', idx);
    if (idEnd === -1) {
      searchStart = closeA + 4;
      continue;
    }
    var hrefAttr = html.substring(idx, idEnd);
    var idMatch = hrefAttr.match(/id=([a-zA-Z0-9+/=]+)/);
    if (!idMatch) {
      searchStart = closeA + 4;
      continue;
    }

    var encoded = idMatch[1];
    var decodedUrl = decodeGenerateUrl(encoded);

    results.push({
      encodedId: encoded,
      decodedUrl: decodedUrl || '',
      label: label,
      fullTag: html.substring(hrefStart, closeA + 4)
    });

    searchStart = closeA + 4;
  }
  return results;
}

function extractMovieQualities(html) {
  if (!html) return [];
  var results = [];

  // Split by dlbtn-container — parts[i-1] is the section before container i
  var parts = html.split('dlbtn-container');
  for (var i = 1; i < parts.length; i++) {
    var container = parts[i];
    var beforeSection = parts[i - 1]; // h4 heading is in the part RIGHT before this container

    // Extract generate.php link from this container
    var genMatch = container.match(/href="(?:https?:\/\/[^"]*?)?\/generate\.php\?id=([a-zA-Z0-9+/=]+)"/);
    if (!genMatch) continue;
    var encoded = genMatch[1];
    var decodedUrl = decodeGenerateUrl(encoded);
    if (!decodedUrl || decodedUrl.indexOf('/f/') === -1) continue;

    // Extract quality from h4 heading in beforeSection
    var qualityLabel = '';
    // Pattern: "...<span>[info]</span> HEVC 1080p [size]" or "...<span>[info]</span> 4K-2160p SDR HEVC [size]"
    var qualMatch = beforeSection.match(/<\/span>\s*([^<]*?(?:2160|1080|720|480|4K)[^<]*?)\s*\[/i);
    if (qualMatch) {
      qualityLabel = qualMatch[1].trim();
    }
    // Pattern 2: standalone quality
    if (!qualityLabel) {
      qualMatch = beforeSection.match(/\b(?:4K\s*2160p|UHD|2160p|1080p|720p|480p)\b/i);
      if (!qualMatch) qualMatch = beforeSection.match(/\b(?:SD|HD)\b/i);
      if (qualMatch) qualityLabel = qualMatch[0];
    }
    if (!qualityLabel) qualityLabel = decodedUrl;

    var quality = parseQuality(qualityLabel);

    // Deduplicate by decodedUrl
    var dup = false;
    for (var j = 0; j < results.length; j++) {
      if (results[j].decodedUrl === decodedUrl) { dup = true; break; }
    }
    if (dup) continue;

    results.push({
      encodedId: encoded,
      decodedUrl: decodedUrl,
      label: qualityLabel || quality,
      quality: quality
    });
  }
  return results;
}

function extractEpisodeQualities(html, targetEpisode) {
  if (!html) return [];

  // Find matching episode card
  var cards = html.split('<div class="ep-card"');
  var targetCard = null;
  for (var c = 1; c < cards.length; c++) {
    var card = cards[c];
    var epMatch = card.match(/episode-badge[^>]*>Episode\s*(\d+)/i);
    if (!epMatch) continue;
    var epNum = parseInt(epMatch[1], 10);
    if (epNum === targetEpisode) {
      targetCard = card;
      break;
    }
  }
  if (!targetCard) return [];

  var allLinks = extractAllGenerateLinks(targetCard);
  var results = [];
  for (var i = 0; i < allLinks.length; i++) {
    var link = allLinks[i];
    if (!link.decodedUrl || link.decodedUrl.indexOf('/f/') === -1) continue;

    var qualityLabel = link.label;
    var quality = parseQuality(qualityLabel || link.decodedUrl);

    // Deduplicate by decodedUrl
    var dup = false;
    for (var j = 0; j < results.length; j++) {
      if (results[j].decodedUrl === link.decodedUrl) { dup = true; break; }
    }
    if (dup) continue;

    results.push({
      encodedId: link.encodedId,
      decodedUrl: link.decodedUrl,
      label: qualityLabel || quality,
      quality: quality
    });
  }
  return results;
}

function filterQualities(qualities) {
  if (!qualities || !qualities.length) return [];
  // Exclude 480p / SD, keep 720p, 1080p, 2160p
  var keep = [];
  for (var i = 0; i < qualities.length; i++) {
    var q = qualities[i];
    if (q.quality === '480p' || q.quality === 'SD') continue;
    keep.push(q);
  }
  // Sort best first: 2160p > 1080p > 720p > HD
  var order = { '2160p': 0, '1080p': 1, '720p': 2, 'HD': 3 };
  keep.sort(function(a, b) {
    var oa = order[a.quality] !== undefined ? order[a.quality] : 99;
    var ob = order[b.quality] !== undefined ? order[b.quality] : 99;
    return oa - ob;
  });
  return keep;
}

function extractHash(decodedUrl) {
  if (!decodedUrl) return '';
  var fIdx = decodedUrl.indexOf('/f/');
  var xIdx = decodedUrl.indexOf('/x/');
  var slashIdx = fIdx >= 0 ? fIdx + 3 : (xIdx >= 0 ? xIdx + 3 : -1);
  if (slashIdx < 0) return '';
  return decodedUrl.substring(slashIdx);
}

async function resolveFslUrl(decodedUrl, sessionUA) {
  if (!decodedUrl) return null;
  var hash = extractHash(decodedUrl);
  if (!hash) return null;
  var pageUrl = CINECLOUD_BASE + '/f/' + hash;
  var html = await fetchText(pageUrl, sessionUA);
  if (!html) return null;
  return extractFslUrl(html);
}

function decodeEntities(encodedString) {
  if (!encodedString) return '';
  var translate_re = /&(nbsp|amp|quot|lt|gt|#038);/g;
  var translate = {
    "nbsp": " ",
    "amp" : "&",
    "quot": "\"",
    "lt"  : "<",
    "gt"  : ">",
    "#038": "&"
  };
  return encodedString.replace(translate_re, function(match, entity) {
    return translate[entity];
  }).replace(/&#(\d+);/g, function(match, num) {
    return String.fromCharCode(num);
  });
}

function makeStream(name, title, url, quality, headers, mediaInfo) {
    // 1. DECODE HTML ENTITIES & CLEAN UP RAW WEBSITE TITLES
    var cleanName = decodeEntities(name || '').replace(/[\n\t]+/g, '').trim();
    var cleanTitle = decodeEntities(title || "").replace(/[\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    
    // Trim massive fallback paragraphs down to just the clean film name
    if (cleanName.indexOf('(') > 0) {
        cleanName = cleanName.split('(')[0].trim();
    } else if (cleanName.match(/\d{3,4}p/i)) {
        cleanName = cleanName.split(/\d{3,4}p/i)[0].trim();
    }

    // 2. METADATA & SIZE SCANNING
    var fileSizeOnly = "N/A";
    // Check both the post context text and title details for bracketed file sizes
    var sizeMatch = cleanTitle.match(/\[\s*(\d+(?:\.\d+)?\s*[MG]B)\s*\]/i);
    if (sizeMatch) fileSizeOnly = sizeMatch[1].trim();

    var fileFormat = "MKV";
    if (url && url.toLowerCase().split('?')[0].endsWith(".mp4")) fileFormat = "MP4";

    var sourceTag = "WEB-DL";
    if (/bluray|blu\-ray|bdrip/i.test(cleanTitle)) sourceTag = "BluRay";
    else if (/hdrip|webrip/i.test(cleanTitle)) sourceTag = "WEBRip";

    // Dynamic Video Profiles Checking
    var videoRangeBlock = "";
    var rangeTag = "";
    if (/dolby\s*vision|dovi/i.test(cleanTitle.toLowerCase())) rangeTag = "Dolby Vision";
    else if (/hdr10/i.test(cleanTitle)) rangeTag = "HDR10";
    else if (/hdr/i.test(cleanTitle)) rangeTag = "HDR";
    else if (/10bit|10\-bit/i.test(cleanTitle)) rangeTag = "10Bit";

    var codecTag = "H.264";
    if (/hevc|x265|h265/i.test(cleanTitle) || /2160p|4k/i.test(quality.toLowerCase())) {
        codecTag = "HEVC";
    }

    if (rangeTag) {
        videoRangeBlock = " | 🔆 " + rangeTag + " • ⚡ " + codecTag;
    } else {
        videoRangeBlock = " | ⚡ " + codecTag;
    }

    var audioChannelTag = "Auto";
    var audioMatch = cleanTitle.match(/(TrueHD\s*7\.1|DDP\s*7\.1|DDP\s*5\.1|DD\s*5\.1|5\.1|AAC)/i);
    if (audioMatch) {
        audioChannelTag = audioMatch[1].toUpperCase().replace(/\s+/g, '');
        if (audioChannelTag === "5.1") audioChannelTag = "DDP5.1";
    }

    // 3. AUDIO TRACK TYPE & LANGUAGE MATRIX ENGINE
    var lowerContext = cleanTitle.toLowerCase();
    var isDualAudio = /dual|multi|dubbed|hindi/i.test(lowerContext);
    var audioType = isDualAudio ? "Dual-Audio" : "Single Audio";

    var displayLanguages = "English 🇺🇸";
    if (isDualAudio) {
        displayLanguages = "English 🇺🇸 • Hindi 🇮🇳";
    } else if (/dutch|nl/i.test(lowerContext)) {
        displayLanguages = "English 🇺🇸 • Dutch 🇳🇱";
    }

    // 4. HEADER LAYOUT GENERATOR
    var displayQuality = quality || "1080p";
    var label = PROVIDER_NAME + " | " + displayQuality + " | " + audioType;

    // 5. OUTPUT DISPLAY RENDERER
    var line1 = '🎬 ' + cleanName;
    var line2 = '💎 ' + displayQuality + ' | 🗣️ ' + displayLanguages + ' | 💾 ' + fileSizeOnly;
    var line3 = '🎞️ ' + fileFormat + ' | 🎧 ' + audioChannelTag + videoRangeBlock;
    var line4 = '🔗 FSL Server | ☁️ ' + sourceTag;

    var formattedTitle = line1 + '\n' + line2 + '\n' + line3 + '\n' + line4;

    return {
        name: label,
        title: formattedTitle,
        size: formattedTitle,
        url: url || "",
        _resWeight: displayQuality.includes("2160") || displayQuality.toLowerCase().includes("4k") ? 3 : (displayQuality.includes("1080") ? 2 : 1),
        _sizeWeight: sizeMatch ? parseFloat(sizeMatch[1]) * (sizeMatch[1].toUpperCase().includes("GB") ? 1024 : 1) : 0,
        behaviorHints: {
            notWebReady: true,
            proxyHeaders: {
                request: headers || { "Referer": CINECLOUD_BASE + "/" }
            }
        }
    };
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    var isTv = (mediaType === 'tv' || mediaType === 'series');
    console.log("[" + PROVIDER_NAME + "] Request: tmdbId=" + tmdbId + " type=" + mediaType + " S=" + season + " E=" + episode);

    var sessionUA = MOBILE_UAS[Math.floor(Math.random() * MOBILE_UAS.length)];

    // Step 1: Get TMDB info
    var tmdbInfo = await getTMDBInfo(tmdbId, mediaType, sessionUA);
    if (!tmdbInfo || !tmdbInfo.title) {
      console.log("[" + PROVIDER_NAME + "] TMDB info not found for " + tmdbId);
      return [];
    }
    console.log("[" + PROVIDER_NAME + "] TMDB: " + tmdbInfo.title + " (" + tmdbInfo.year + ")");

    // Step 2: Search cinefreak
    var targetSeason = isTv ? (parseInt(season, 10) || 1) : null;
    var searchResults = await searchCinefreak(tmdbInfo.title, null, sessionUA);
    if (!searchResults || searchResults.length < 3) {
      var results2 = await searchCinefreak(tmdbInfo.title + ' ' + tmdbInfo.year, null, sessionUA);
      if (results2 && results2.length) searchResults = results2;
    }
    if (!searchResults || !searchResults.length) {
      console.log("[" + PROVIDER_NAME + "] No search results for " + tmdbInfo.title);
      return [];
    }

    // Step 3: Match best result
    var bestPost = matchByTitleYear(tmdbInfo.title, tmdbInfo.year, searchResults, targetSeason);
    if (!bestPost) {
      console.log("[" + PROVIDER_NAME + "] No match found for " + tmdbInfo.title);
      return [];
    }
    console.log("[" + PROVIDER_NAME + "] Matched: " + bestPost.title);

    // Step 4: Fetch the post page
    var html = await fetchPostPage(bestPost.url, sessionUA);
    if (!html) {
      console.log("[" + PROVIDER_NAME + "] Failed to fetch post page");
      return [];
    }

    // Step 5: Extract qualities
    var qualities;
    if (isTv) {
      var targetEp = parseInt(episode, 10) || 1;
      qualities = extractEpisodeQualities(html, targetEp);
    } else {
      qualities = extractMovieQualities(html);
    }
    if (!qualities || !qualities.length) {
      console.log("[" + PROVIDER_NAME + "] No quality links found");
      return [];
    }

    // Step 6: Filter out 480p, dedupe, sort best first
    var filtered = filterQualities(qualities);
    if (!filtered.length) {
      console.log("[" + PROVIDER_NAME + "] No usable qualities after filtering");
      return [];
    }
    console.log("[" + PROVIDER_NAME + "] Qualities: " + filtered.map(function(q) { return q.quality; }).join(', '));

      // Step 7: Resolve FSL URLs for each quality
  var epLabel = '';
  if (isTv) {
    var s = parseInt(season, 10) || 1;
    var e = parseInt(episode, 10) || 1;
    epLabel = 'S' + (s < 10 ? '0' : '') + s + 'E' + (e < 10 ? '0' : '') + e + ' ';
  }

  var streams = [];
  for (var qi = 0; qi < filtered.length; qi++) {
    var q = filtered[qi];
    var fslUrl = await resolveFslUrl(q.decodedUrl, sessionUA);
    if (fslUrl) {
      // 🌟 Use your layout engine mapping variables:
      var streamName = bestPost.title + (epLabel ? " - " + epLabel.trim() : "");
      var lookupContextText = q.label + " " + bestPost.title; 
      
      var streamObj = makeStream(
          streamName, 
          lookupContextText, 
          fslUrl, 
          q.quality, 
          { 'Referer': CINECLOUD_BASE + '/', 'User-Agent': sessionUA },
          epLabel.trim()
      );
      
      streams.push(streamObj);
    }
  }

  // Deduplicate and Sort automatically by resolution group hierarchies
  var sortedStreams = streams.sort(function(a, b) {
      return b._resWeight - a._resWeight;
  });

  console.log("[" + PROVIDER_NAME + "] Returning " + sortedStreams.length + " stream(s)");
  return sortedStreams;

  } catch (e) {
    console.log("[" + PROVIDER_NAME + "] Fatal error: " + (e.message || e));
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { manifest: manifest, search: search, getStreams: getStreams };
} else {
  global.manifest = manifest;
  global.search = search;
  global.getStreams = getStreams;
}
