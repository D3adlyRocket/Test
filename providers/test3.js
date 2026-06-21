const PROVIDER_NAME = "VegaMovies";
const BASE_URL = "https://vegamovies.mq";
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DOMAINS_JSON_URL = "https://raw.githubusercontent.com/SaurabhKaperwan/Utils/refs/heads/main/urls.json";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5"
};

const MOBILE_UAS = [
  "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
];

let baseUrl = BASE_URL;
let cachedDomains = null;
let domainCacheTime = 0;
const DOMAIN_CACHE_TTL = 4 * 60 * 60 * 1000;

function getMobileHeaders() {
  const ua = MOBILE_UAS[Math.floor(Math.random() * MOBILE_UAS.length)];
  return { "User-Agent": ua, "Accept": "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9", "Referer": baseUrl + "/" };
}

async function refreshDomains() {
  if (cachedDomains && Date.now() - domainCacheTime < DOMAIN_CACHE_TTL) return;
  try {
    const res = await fetch(DOMAINS_JSON_URL, { headers: { ...HEADERS, 'Accept-Encoding': 'identity' } });
    if (res && res.ok) {
      const data = JSON.parse(await res.text());
      if (data && data.vegamovies) {
        cachedDomains = data;
        domainCacheTime = Date.now();
        baseUrl = data.vegamovies;
      }
    }
  } catch (e) {}
}

async function fetchJson(url, options = {}) {
  try {
    const res = await fetch(url, { ...options, headers: { ...HEADERS, 'Accept-Encoding': 'identity', ...(options.headers || {}) } });
    if (!res || !res.ok) return null;
    return JSON.parse(await res.text());
  } catch (e) { return null; }
}

async function fetchHtml(url, options = {}) {
  try {
    const res = await fetch(url, { ...options, headers: { ...HEADERS, 'Accept-Encoding': 'identity', ...(options.headers || {}) } });
    if (!res || !res.ok) return null;
    return await res.text();
  } catch (e) { return null; }
}

function decodeEntities(str) {
  if (!str) return '';
  return str.replace(/&#038;/g, '&').replace(/&amp;/g, '&').replace(/&#8211;/g, '-').replace(/&#8212;/g, '-').replace(/&#8217;/g, "'").replace(/&ndash;/g, '-').replace(/&mdash;/g, '-').replace(/&quot;/g, '"');
}

function parseQuality(text) {
  const t = String(text || '');
  const m = t.match(/(2160|1080|720|480)\s*P/i);
  if (m) return m[1].toLowerCase() + 'p';
  if (/4K|UHD/i.test(t)) return '2160p';
  if (/1440|2K/i.test(t)) return '1440p';
  return 'HD';
}

function makeStream(name, title, url, quality, headers, mediaInfo) {
    const cleanName = decodeEntities(name).replace(/[\n\t]+/g, '').trim();
    let cleanTitle = decodeEntities(title || "").replace(/[\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    
    let filename = "";
    const fileMatch = cleanTitle.match(/\[\s*([^\]]+\.(?:mkv|mp4|avi|zip|rar|ts))\s*\]/i);
    if (fileMatch) {
        filename = fileMatch[1].trim();
        cleanTitle = cleanTitle.replace(fileMatch[0], '').trim();
    }

    // 1. METADATA SCANNING
    let fileSizeOnly = "N/A";
    const sizeMatch = cleanTitle.match(/(?:\[|\(|\s|^)(\d+(?:\.\d+)?\s*[MG]B)(?:\]|\)|\s|$)/i);
    if (sizeMatch) {
        fileSizeOnly = sizeMatch[1].trim();
    } else if (url) {
        // Fallback: Scan stream path URL
        const urlSize = url.match(/(\d+(?:\.\d+)?\s*[mg]b)/i);
        if (urlSize) fileSizeOnly = urlSize[1].toUpperCase().trim();
    }

    let fileFormat = "MKV";
    if (url && url.toLowerCase().includes(".mp4")) fileFormat = "MP4";
    else if (cleanTitle.toLowerCase().includes(".mp4")) fileFormat = "MP4";

    let sourceTag = "WEB-DL";
    if (/bluray|blu\-ray|bdrip/i.test(cleanTitle)) sourceTag = "BluRay";
    else if (/hdrip|webrip/i.test(cleanTitle)) sourceTag = "WEBRip";

    let imaxTag = "";
    if (/imax/i.test(cleanTitle)) imaxTag = " | 👁️ iMAX";

    // Dynamic Video Profiles Checking
    let videoRangeBlock = "";
    let rangeTag = "";
    if (/dolby\s*vision|dovi|\bdv\b/i.test(cleanTitle) || /dolby\s*vision|dovi|\bdv\b/i.test(url)) rangeTag = "Dolby Vision";
    else if (/hdr10/i.test(cleanTitle) || /hdr10/i.test(url)) rangeTag = "HDR10";
    else if (/hdr/i.test(cleanTitle) || /hdr/i.test(url)) rangeTag = "HDR";
    else if (/10bit|10\-bit/i.test(cleanTitle)) rangeTag = "10Bit";
    else if (/sdr/i.test(cleanTitle)) rangeTag = "SDR";

    let codecTag = "H.264";
    if (/hevc|\bx265\b|\bh265\b/i.test(cleanTitle) || /hevc|\bx265\b|\bh265\b/i.test(url)) {
        codecTag = "HEVC";
    } else if (/x264|h264/i.test(cleanTitle)) {
        codecTag = "H.264";
    }

    if (rangeTag) {
        videoRangeBlock = ` | 🔆 ${rangeTag} • ⚡ ${codecTag}`;
    } else {
        videoRangeBlock = ` | ⚡ ${codecTag}`;
    }

    // Audio Layout Pipeline
    let audioChannelTag = "";
    const audioMatch = cleanTitle.match(/(TrueHD\s*7\.1|DDP\s*7\.1|DDP\s*5\.1|DD\s*5\.1|5\.1|AAC)/i) || url.match(/(TrueHD\s*7\.1|DDP\s*7\.1|DDP\s*5\.1|DD\s*5\.1|5\.1|AAC)/i);
    if (audioMatch) {
        let matchedTag = audioMatch[1].toUpperCase().replace(/\s+/g, '');
        if (matchedTag === "5.1") matchedTag = "DDP5.1";
        if (matchedTag.includes("TRUEHD")) matchedTag = "TrueHD 7.1";
        audioChannelTag = matchedTag;
    } else if (/dolby\s*digital|dd\d/i.test(cleanTitle) || /dd\d/i.test(url)) {
        audioChannelTag = 'Dolby Digital';
    } else if (/dolby|dsnp/i.test(cleanTitle) || /dolby/i.test(url)) {
        audioChannelTag = 'Dolby';
    }

    if (/atmos/i.test(cleanTitle) || /atmos/i.test(url)) {
        audioChannelTag = audioChannelTag ? `${audioChannelTag} • 🔊 Atmos` : '🔊 Atmos';
    }
    if (!audioChannelTag) audioChannelTag = "Auto";

    // 2. LANGUAGE MATRIX ENGINE
    let langFlags = [];
    const lowerTitle = cleanTitle.toLowerCase() + " " + url.toLowerCase();
    const isDual = /dual|hindi\-eng|eng\-hin|multi/i.test(cleanTitle) || /dual|hindi\-eng|eng\-hin|multi/i.test(url);
    
    if (isDual) {
        langFlags.push("English 🇺🇸 • Hindi 🇮🇳");
    } else {
        if (/hindi|hin/i.test(lowerTitle)) langFlags.push("Hindi 🇮🇳");
        if (/english|eng/i.test(lowerTitle)) langFlags.push("English 🇺🇸");
        if (langFlags.length === 0) langFlags.push("English 🇺🇸");
    }
    const displayLanguages = langFlags.join(' • ');

    // 3. TITLE RENDERING SYSTEM
    let cleanedMainTitle = "";
    const yearMatch = cleanTitle.match(/\b(19\d{2}|20\d{2})\b/);
    const displayYear = yearMatch ? `(${yearMatch[1]})` : "";
    const searchString = filename || cleanTitle;
    const preciseSAndEMatch = searchString.match(/[sS](\d+)\s*[eE](\d+)/);

    if (preciseSAndEMatch) {
        let rawShowName = searchString.split(/[sS]\d+/i)[0]
                            .replace(/[\.\-_]/g, ' ')
                            .replace(/[\{\[\(].*$/g, '')
                            .trim();
        let sNum = parseInt(preciseSAndEMatch[1], 10);
        let eNum = parseInt(preciseSAndEMatch[2], 10);
        cleanedMainTitle = `${rawShowName} - S${sNum} E${eNum}`;
    } else {
        let movieName = cleanTitle.split(/[\.\-_]\d{3,4}p/i)[0]
                                  .replace(/[\.\-_]/g, ' ')
                                  .replace(/\d{3,4}p.*/i, '')
                                  .replace(/[\{\[\(].*$/g, '')
                                  .trim();
        cleanedMainTitle = movieName + (displayYear ? ` - ${displayYear}` : "");
    }
    
    cleanedMainTitle = cleanedMainTitle.replace(/\s+/g, ' ').replace(/\s+-\s+-\s+/g, ' - ').replace(/-\s*$/, '').trim();

    const displayQuality = quality || "1080p";
    const audioType = isDual ? "Multi-Audio" : "Single Audio";
    const label = `${PROVIDER_NAME} | ${displayQuality} | ${audioType}`;

    // 4. GATEWAY HOST MAPPER
    let hostLabel = "Play Stream";
    const lowerUrl = (url || "").toLowerCase();
    if (lowerUrl.includes("/hub2/") || lowerUrl.includes("hubcloud") || lowerUrl.includes("homelander.buzz") || lowerUrl.includes("whistle.lat") || lowerUrl.includes("mandalorian.buzz")) {
        hostLabel = "HubCloud";
    } else if (lowerUrl.includes(".r2.dev") || lowerUrl.includes("vcloud")) {
        hostLabel = "vCloud";
    }

    // 5. OUTPUT LAYOUT STRUCTURE 
    const line1 = '🎬 ' + cleanedMainTitle;
    const line2 = '💎 ' + displayQuality + ' | 🗣️ ' + displayLanguages + ' | 💾 ' + fileSizeOnly;
    const line3 = '🎞️ ' + fileFormat + ' | 🎧 ' + audioChannelTag + videoRangeBlock;
    const line4 = '🔗 ' + hostLabel + ' | ☁️ ' + sourceTag + imaxTag;

    const formattedStream = {
        name: label,
        title: `${line1}\n${line2}\n${line3}\n${line4}`,
        size: `${line1}\n${line2}\n${line3}\n${line4}`,
        url: url || "",
        _resWeight: displayQuality.includes("2160") || displayQuality.toLowerCase().includes("4k") ? 3 : (displayQuality.includes("1080") ? 2 : 1),
        behaviorHints: {
            notWebReady: true,
            proxyHeaders: {
                request: headers || { "Referer": baseUrl + "/" }
            }
        }
    };

    try {
        Object.defineProperties(formattedStream, {
            qualityTag: { get: () => "", enumerable: true, configurable: true },
            quality: { get: () => "", enumerable: true, configurable: true },
            language: { get: () => "", enumerable: true, configurable: true },
            resolution: { get: () => "", enumerable: true, configurable: true }
        });
    } catch (e) {}

    return formattedStream;
}
        
// --- Deduplication & Helper Methods ---
function dedupe(streams) {
  const seen = new Set();
  return (streams || []).filter(s => {
    if (!s || !s.url || seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}

function getOrigin(url) {
  try {
    const p = url.split('//');
    return p[0] + '//' + p[1].split('/')[0];
  } catch (e) { return url; }
}

function isStrictMatch(requestedTitle, requestedYear, scrapedTitle, scrapedYear, altTitles) {
  if (!scrapedTitle) return false;
  const scrClean = scrapedTitle.toLowerCase().replace(/download\s*/gi, '').replace(/[^a-z0-9\s]/g, ' ').trim().replace(/\s+/g, ' ');
  const validTitles = [requestedTitle, ...(altTitles || [])].filter(Boolean);
  let matched = false;
  for (const t of validTitles) {
    const reqClean = t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim().replace(/\s+/g, ' ');
    if (reqClean && (scrClean.includes(reqClean) || scrClean.startsWith(reqClean))) {
      matched = true;
      break;
    }
  }
  if (!matched) return false;
  if (requestedYear && scrapedYear) {
    const rY = parseInt(requestedYear);
    const sY = parseInt(scrapedYear);
    if (!isNaN(rY) && !isNaN(sY) && Math.abs(rY - sY) > 1) return false;
  }
  return true;
}

async function getTMDBInfo(id, type) {
  const idStr = String(id || '').trim();
  const isImdb = idStr.startsWith('tt');
  const tmdbType = (type === 'tv' || type === 'series') ? 'tv' : 'movie';

  try {
    if (isImdb) {
      const data = await fetchJson('https://api.themoviedb.org/3/find/' + idStr + '?api_key=' + TMDB_API_KEY + '&external_source=imdb_id');
      const list = data ? (tmdbType === 'tv' ? data.tv_results : data.movie_results) : null;
      if (list && list.length > 0) {
        const item = list[0];
        const title = tmdbType === 'tv' ? item.name : item.title;
        const year = (item.first_air_date || item.release_date || '').split('-')[0];
        return { title: title, year: year, imdbId: idStr, altTitles: [] };
      }
      return { title: idStr, year: null, imdbId: idStr, altTitles: [] };
    }

    const data = await fetchJson('https://api.themoviedb.org/3/' + tmdbType + '/' + idStr + '?api_key=' + TMDB_API_KEY + '&append_to_response=external_ids,alternative_titles');
    if (data && (data.title || data.name)) {
      let altTitles = [];
      if (data.alternative_titles) {
        const src = data.alternative_titles.titles || data.alternative_titles.results || [];
        altTitles = src.map(t => String(t.title || ''));
      }
      const title = tmdbType === 'tv' ? data.name : data.title;
      const year = (data.first_air_date || data.release_date || '').split('-')[0];
      const imdbId = data.imdb_id || (data.external_ids && data.external_ids.imdb_id) || null;
      return { title: title, year: year, imdbId: imdbId, altTitles: altTitles };
    }
  } catch (e) {}
  return { title: idStr, year: null, imdbId: null, altTitles: [] };
}

async function searchByTitle(query, year) {
  if (!query) return [];
  const searchQuery = encodeURIComponent(query + (year ? ' ' + year : ''));
  const url = baseUrl + '/search.php?q=' + searchQuery + '&page=1&per_page=15';
  const data = await fetchJson(url, { headers: { ...getMobileHeaders(), 'Accept-Encoding': 'identity' } });
  if (!data || !data.hits) return [];
  return data.hits.map(h => {
    const doc = h.document || {};
    return {
      postId: String(doc.id || ''),
      title: (doc.post_title || '').replace(/Download\s*/gi, '').trim(),
      permalink: doc.permalink || '',
      imdbId: doc.imdb_id || '',
      year: Array.isArray(doc.category) ? doc.category.find(c => /^(19|20)\d{2}$/.test(String(c).trim())) || '' : ''
    };
  }).filter(r => r.postId);
}

async function fetchPostContent(permalink) {
  const url = permalink.startsWith('http') ? permalink : baseUrl + permalink;
  const html = await fetchHtml(url, { headers: getMobileHeaders() });
  if (!html) return null;
  const tMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = tMatch ? tMatch[1].replace(/<[^>]*>/g, '').replace(/Download\s*/gi, '').trim() : '';
  let content = '';
  const cMatch = html.match(/class="(?:entry-content|page-body|post-content)[^"]*"[^>]*>([\s\S]*?)(?:<\/main>|<div class="post-tags"|<footer)/i);
  if (cMatch) content = cMatch[1];
  else content = html;
  return { title, content };
}

function filterSeason(html, targetSeason) {
  const patterns = [
    new RegExp('<span[^>]*style="[^"]*color:\\s*#ff0000[^"]*"[^>]*>\\s*Season\\s+0*' + targetSeason + '\\b', 'i'),
    new RegExp('<h[1-6][^>]*>\\s*<strong>\\s*<span[^>]*>\\s*Season\\s+0*' + targetSeason + '\\b', 'i'),
    new RegExp('<h[1-6][^>]*>\\s*Season\\s+0*' + targetSeason + '\\b', 'i'),
    new RegExp('Season\\s+0*' + targetSeason + '\\b', 'i')
  ];
  let startIdx = -1;
  for (const pat of patterns) {
    const m = pat.exec(html);
    if (m) { startIdx = m.index; break; }
  }
  if (startIdx < 0) return html;

  const afterStart = html.substring(startIdx + 1);
  const nextPatterns = [
    /<span[^>]*style="[^"]*color:\s*#ff0000[^"]*"[^>]*>\s*Season\s+0*(\d+)\b/i,
    /<h[1-6][^>]*>\s*<strong>\s*<span[^>]*>\s*Season\s+0*(\d+)\b/i,
    /<h[1-6][^>]*>\s*Season\s+0*(\d+)\b/i,
    /Season\s+0*(\d+)\b/i
  ];
  let endIdx = html.length;
  for (const pat of nextPatterns) {
    const m = pat.exec(afterStart);
    if (m) {
      const n = parseInt(m[1]);
      if (!isNaN(n) && n !== targetSeason) {
        endIdx = startIdx + 1 + m.index;
        break;
      }
    }
  }
  return html.substring(startIdx, endIdx);
}

function qualityNear(html, pos) {
  const before = html.substring(Math.max(0, pos - 1500), pos);
  let lastQ = null;
  const hRegex = /<(h[1-6]|strong)[^>]*>[\s\S]*?(\d{3,4}p|4K|UHD)[\s\S]*?<\/\1>/gi;
  let hMatch;
  while ((hMatch = hRegex.exec(before)) !== null) lastQ = hMatch[2];
  if (lastQ) return parseQuality(lastQ);
  const lastMatch = before.match(/[\s\S]*(\d{3,4}p|4K|UHD)/i);
  if (lastMatch) return parseQuality(lastMatch[1]);
  return 'HD';
}

function isBatchZip(html, linkPos) {
  const aStart = html.lastIndexOf('<a ', linkPos);
  if (aStart < 0) return false;
  const aEnd = html.indexOf('</a>', linkPos);
  if (aEnd < 0) return false;
  const aTag = html.substring(aStart, aEnd + 4);
  if (/Batch\/Zip/i.test(aTag)) return true;
  if (/linear-gradient\(135deg,#2ea1cf,#ff19d0\)/.test(aTag)) return true;
  return false;
}

function extractNexdriveLinks(html) {
  const links = [];
  const seen = new Set();
  const regex = /href="(https:\/\/nexdrive\.pro\/genxfm\d+[^"]*)"/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const url = m[1];
    if (seen.has(url)) continue;
    seen.add(url);
    if (isBatchZip(html, m.index)) continue;
    const quality = qualityNear(html, m.index);
    links.push({ url, quality });
  }
  return links;
}

async function resolveNexdrive(nexdriveUrl, referer, fallbackQuality) {
  const html = await fetchHtml(nexdriveUrl, { headers: { ...getMobileHeaders(), 'Referer': referer } });
  if (!html) return [];
  let quality = fallbackQuality;
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1].replace(/&#(\d+);/g, (_, c) => String.fromCharCode(c));
    const qMatch = title.match(/(\d{3,4}p|4K|2160p|UHD)/i);
    if (qMatch) quality = parseQuality(qMatch[1]);
  }
  const vclouds = [];
  const dRegex = /href="(https:\/\/vcloud\.zip\/(?!api)[^"]+)"/gi;
  let m;
  while ((m = dRegex.exec(html)) !== null) vclouds.push({ url: m[1], quality });
  if (vclouds.length > 0) return vclouds;
  const aRegex = /href="(https:\/\/vcloud\.zip\/api\/index\.php\?link=[^"]+)"/gi;
  while ((m = aRegex.exec(html)) !== null) {
    const bridgeHtml = await fetchHtml(m[1], { headers: { ...getMobileHeaders(), 'Referer': nexdriveUrl } });
    if (bridgeHtml) {
      const rMatch = bridgeHtml.match(/href="(https:\/\/vcloud\.zip\/(?!api)[^"]+)"/i);
      if (rMatch) vclouds.push({ url: rMatch[1], quality });
    }
  }
  return vclouds;
}

// --- Modified Inner Scanner ---
async function extractVcloud(vcloudUrl, referer, quality, showTitle, mediaInfo) {
  const streams = [];
  const headers = { ...getMobileHeaders(), 'Referer': referer, 'Cookie': 'xla=s4t' };

  const html = await fetchHtml(vcloudUrl, { headers });
  if (!html) return streams;

  // Start with a fallback text string
  let deepMetaString = showTitle || "";

  try {
    // 1. Convert the entire HTML body into a clean, flat text string
    const textDump = html
      .replace(/<script[\s\S]*?<\/script>/gi, '') // Remove scripts
      .replace(/<style[\s\S]*?<\/style>/gi, '')   // Remove styles
      .replace(/<[^>]*>/g, ' ')                   // Strip all HTML tags
      .replace(/Download/gi, '')                  // Remove common page boilerplate
      .replace(/[\n\t\r]+/g, ' ')                 // Flatten spacing
      .replace(/\s{2,}/g, ' ')
      .trim();

    // 2. Locate an exact file footprint anywhere in the text dump (e.g., "Movie Name 1080p Dual Audio 2.5GB")
    // This finds any sentence chunk containing size metric flags
    const footprintMatch = textDump.match(/[^.!?]*?\b\d+(?:\.\d+)?\s*(?:GB|MB)\b[^.!?]*/i);
    
    if (footprintMatch && footprintMatch[0].length > 10) {
        deepMetaString = footprintMatch[0].trim();
    } else {
        // Fallback: Check if there's any text in a standard header container
        const fileTextContainer = html.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/i) || html.match(/<title>([\s\S]*?)<\/title>/i);
        if (fileTextContainer) {
            const extractedText = fileTextContainer[1].replace(/<[^>]*>/g, '').replace(/Download/gi, '').replace(/[\n\t\r]+/g, ' ').trim();
            if (extractedText.length > 5) deepMetaString = extractedText;
        }
    }
  } catch (err) {
      console.log("Meta extraction error, using fallback title: ", err);
  }

  let tokenUrl = '';
  const db64Match = html.match(/var\s+url\s*=\s*atob\(atob\('([^']+)'\)\)/);
  if (db64Match) {
    try { tokenUrl = atob(atob(db64Match[1])); } catch (e) {}
  } else {
    const sMatch = html.match(/var\s+url\s*=\s*['"]([^'"]+)['"]/);
    if (sMatch) tokenUrl = sMatch[1];
  }
  if (!tokenUrl) return streams;

  const tokenHtml = await fetchHtml(tokenUrl, { headers: { ...headers, 'Referer': vcloudUrl } });
  if (!tokenHtml) return streams;

  // FSLv2
  const s3 = tokenHtml.match(/<a[^>]*href="([^"]+)"[^>]*id="s3"[^>]*>/i);
  if (s3) {
    const name = showTitle + ' - ' + PROVIDER_NAME + ' | ' + quality + ' (FSLv2)';
    streams.push(makeStream(name, deepMetaString, s3[1], quality, vcloudUrl));
  }

  // FSL
  const fsl = tokenHtml.match(/<a[^>]*href="([^"]+)"[^>]*id="fsl"[^>]*>/i);
  if (fsl) {
    const name = showTitle + ' - ' + PROVIDER_NAME + ' | ' + quality + ' (FSL)';
    streams.push(makeStream(name, deepMetaString, fsl[1], quality, vcloudUrl));
  }

  // Worker
  const worker = tokenHtml.match(/var\s+url\s*=\s*['"]([^'"]*workers\.dev[^'"]*)['"]/i);
  if (worker) {
    const name = showTitle + ' - ' + PROVIDER_NAME + ' | ' + quality + ' (Worker)';
    streams.push(makeStream(name, deepMetaString, worker[1], quality, vcloudUrl));
  }

  const btnRegex = /<a[^>]*href="([^"]+)"[^>]*class="btn[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let bm;
  while ((bm = btnRegex.exec(tokenHtml)) !== null) {
    const href = bm[1];
    const text = bm[2].replace(/<[^>]*>/g, '').trim().toLowerCase();
    if (!href || href === '#') continue;
    if (href.includes('.zip') || href.includes('pixeldrain') || href.includes('telegram')) continue;
    if (text.includes('worker') && !text.includes('fsl')) {
      const name = showTitle + ' - ' + PROVIDER_NAME + ' | ' + quality + ' (Worker)';
      streams.push(makeStream(name, deepMetaString, href, quality, vcloudUrl));
    }
  }

  return streams;
}

// --- Main Entry point ---
async function getStreams(tmdbId, mediaType, season, episode) {
  await refreshDomains();

  const targetSeason = season != null ? Number(season) : null;
  const targetEpisode = episode != null ? Number(episode) : null;
  const isTv = (mediaType === 'tv' || mediaType === 'series');

  const media = await getTMDBInfo(tmdbId, mediaType);
  let results = [];

  if (media.imdbId && media.imdbId.startsWith('tt')) {
    results = await searchByTitle(media.imdbId, null);
  }
  if (results.length === 0 && !isNaN(parseInt(tmdbId))) {
    results = await searchByTitle('tt' + String(tmdbId), null);
  }
  if (results.length === 0) {
    let query = media.title;
    if (isTv && targetSeason) query += ' season ' + targetSeason;
    else if (media.year) query += ' ' + media.year;
    results = await searchByTitle(query, media.year);

    if (results.length === 0) {
      results = await searchByTitle(media.title, null);
    }
    if (results.length === 0 && isTv && targetSeason) {
      results = await searchByTitle(media.title, media.year);
    }
  }
  if (results.length === 0) return [];

  let best = null;
  const targetImdb = (media.imdbId && media.imdbId.startsWith('tt')) ? media.imdbId : null;
  const tmdbResolved = !!targetImdb || (media.title !== String(tmdbId) && media.title.length > 4);

  for (const r of results) {
    if (targetImdb && r.imdbId === targetImdb) {
      if (!isTv || !targetSeason) { best = r; break; }
      const sRange = r.title.match(/(?:s|season)\s*0*(\d+)\s*(?:-|–|to)\s*0*(\d+)/i);
      if (sRange) {
        if (targetSeason >= parseInt(sRange[1]) && targetSeason <= parseInt(sRange[2])) { best = r; break; }
      } else if (new RegExp('(?:s|season)\\s*0*' + targetSeason + '\\b', 'i').test(r.title)) {
        best = r; break;
      }
    }
    if (!best && tmdbResolved && isStrictMatch(media.title, media.year, r.title, r.year, media.altTitles)) {
      best = r;
    }
  }

  if (!best && tmdbResolved) {
    let query = media.title;
    if (media.year) query += ' ' + media.year;
    results = await searchByTitle(query, media.year);
    for (const r of results) {
      if (isStrictMatch(media.title, media.year, r.title, r.year, media.altTitles)) {
        best = r; break;
      }
    }
  }

  if (!best && !tmdbResolved && results.length > 0) {
    for (const r of results) {
      if (r.imdbId && r.imdbId.startsWith('tt')) { best = r; break; }
    }
    if (!best) best = results[0];
  }

  if (!best || !best.postId) return [];

  const post = await fetchPostContent(best.permalink);
  if (!post || !post.content) return [];

  let content = post.content;
  if (isTv && targetSeason != null) {
    const filtered = filterSeason(content, targetSeason);
    if (filtered) content = filtered;
  }

  const nexLinks = extractNexdriveLinks(content);
  if (nexLinks.length === 0) return [];

  const mediaInfo = (isTv && targetSeason ? 'S' + targetSeason + (targetEpisode ? 'E' + targetEpisode : '') : media.year || '').trim();
  const allStreams = [];

  for (let li = 0; li < nexLinks.length; li++) {
      const link = nexLinks[li];
      const vcloudEntries = await resolveNexdrive(link.url, baseUrl + '/', link.quality);
      let startIdx = 0;
      let endIdx = vcloudEntries.length;
      if (isTv && targetEpisode != null) {
        startIdx = targetEpisode - 1;
        endIdx = targetEpisode;
      }
      for (let i = startIdx; i < endIdx && i < vcloudEntries.length; i++) {
        const entry = vcloudEntries[i];
        if (entry.quality === '480p') continue;
        const streams = await extractVcloud(entry.url, entry.url, entry.quality, post.title, mediaInfo);
        streams.forEach(s => { if (s && s.url) allStreams.push(s); });
    }
  }

  const qWeight = { '2160p': 1, '1440p': 2, '1080p': 3, '720p': 4, '480p': 5, 'HD': 6 };
  const srcPriority = (n) => {
    if (/FSLv2/i.test(n)) return 2;
    if (/FSL/i.test(n)) return 1;
    if (/Worker/i.test(n)) return 0;
    return 0;
  };

  return dedupe(allStreams).sort((a, b) => {
    const pa = srcPriority(a.name);
    const pb = srcPriority(b.name);
    if (pa !== pb) return pb - pa;
    return (qWeight[a.quality] || 99) - (qWeight[b.quality] || 99);
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
