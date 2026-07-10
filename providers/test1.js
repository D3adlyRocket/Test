const PROVIDER_NAME = "ZinkMovies";
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const MAIN_URL = "https://zinkmovies.wtf";
const DOMAINS_JSON_URL = "https://raw.githubusercontent.com/PirateZoro9/asura-providers/main/urls.json";

let baseUrl = MAIN_URL;
let cachedDomains = null;
let domainCacheTime = 0;
const DOMAIN_CACHE_TTL = 4 * 60 * 60 * 1000;
let currentUA = "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

const UAS = [
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
];

const log = msg => console.log(`[${PROVIDER_NAME}] ${msg}`);

async function refreshDomains() {
  if (cachedDomains && Date.now() - domainCacheTime < DOMAIN_CACHE_TTL) return;
  try {
    const res = await fetch(DOMAINS_JSON_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (res?.ok) {
      const data = JSON.parse(await res.text());
      if (data?.zinkmovies) {
        cachedDomains = data;
        domainCacheTime = Date.now();
        baseUrl = data.zinkmovies;
      }
    }
  } catch (e) {}
}

function hdrs(extra = {}) {
  return { "User-Agent": currentUA, "Accept-Language": "en-US,en;q=0.9", ...extra };
}

const FETCH_TIMEOUT = 12000;

function raceTimeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));
}

async function fetchText(url, opts) {
  try {
    const r = await Promise.race([fetch(url, opts || {}), raceTimeout(FETCH_TIMEOUT)]);
    if (r.ok) return await r.text();
  } catch (e) {}
  return null;
}

async function fetchJson(url, opts) {
  try {
    const r = await Promise.race([fetch(url, opts || {}), raceTimeout(FETCH_TIMEOUT)]);
    if (r.ok) return await r.json();
  } catch (e) {}
  return null;
}

function parseQuality(label) {
  const m = label.match(/(2160|1080|720|480)\s*P/i);
  if (m) return `${m[1]}p`;
  if (/4K|UHD/i.test(label)) return "2160p";
  return "HD";
}

function parseSize(text) {
  if (!text) return "Unknown Size";
  const m = text.match(/(\d+(?:\.\d+)?\s*(?:GB|MB|gb|mb))/);
  return m ? m[1].toUpperCase() : "Unknown Size";
}

function siteTitle(html) {
  const tm = html.match(/<title>(.*?)<\/title>/i);
  if (!tm) return "";
  const clean = tm[1].match(/Download\s+(.+?)\s+In HD Free/i);
  return clean ? clean[1].trim() : tm[1].trim();
}

function cleanHubTitle(raw) {
  let t = raw.replace(/\.(mkv|mp4|avi)$/i, "").trim();
  t = t.replace(/\s*[-–—]\s*ZINKMOVIES.*/i, "").trim();
  t = t.replace(/\s*[-–—]\s*JiTU.*/i, "").trim();
  t = t.replace(/\s+(IMAX\s+)?(2160|1080|720|480)\s*[pP].*/i, "").trim();
  t = t.replace(/\s+4K\s+.*/i, "").trim();
  return t.trim() || raw;
}

function buildDropdownMetadata(tmdbData, qualityLabel, isTv, season, episode, serverType, labelText, targetUrl) {
  const title = (isTv ? tmdbData.name : tmdbData.title) || "Unknown Title";
  const releaseYear = isTv ? (tmdbData.first_air_date || "").split("-")[0] : (tmdbData.release_date || "").split("-")[0];
  const yearStr = releaseYear ? ` (${releaseYear})` : "";
  
  let decodedUrl = "";
  try { if (targetUrl) decodedUrl = decodeURIComponent(targetUrl); } catch(e) { decodedUrl = targetUrl || ""; }
  const searchPool = `${String(labelText)} ${decodedUrl}`.toLowerCase();

  // Subheading Line 1
  let line1 = `🎬 ${title} - ${yearStr}`;
  if (isTv && season && episode) {
    line1 += ` | S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
  }

  // Subheading Line 2
  let normQual = String(qualityLabel).toLowerCase().replace(/p/g, "") + "p";
  if (searchPool.includes("2160p") || searchPool.includes("4k") || searchPool.includes("uhd")) normQual = "2160p";
  else if (searchPool.includes("1080p")) normQual = "1080p";
  else if (searchPool.includes("720p")) normQual = "720p";

  let qIcon = "💎";
  if (normQual.includes("2160") || normQual.includes("4k")) qIcon = "🌟";
  else if (normQual.includes("1080")) qIcon = "🔥";
  
  let langStr = "Original-Audio"; 
  const multiAudioKeywords = ["multi", "dual", "hindi", "tamil", "telugu", "bengali", "malayalam", "kannada", "marathi", "punjabi"];
  if (multiAudioKeywords.some(keyword => searchPool.includes(keyword))) {
    langStr = "Multi-Audio";
  }

  const parsedSize = parseSize(labelText);
  const line2 = `${qIcon} ${normQual} | 🌍 ${langStr} | 💾 ${parsedSize}`;

  // Subheading Line 3
  const formatVal = targetUrl.includes(".mp4") ? "MP4" : "MKV";
  let codecVal = "🎥 H.264";
  if (searchPool.includes("hevc") || searchPool.includes("x265") || searchPool.includes("h265")) {
    codecVal = searchPool.includes("hevc") ? "⚡ HEVC" : "🎥 H.265";
  } else if (searchPool.includes("x264")) {
    codecVal = "🎥 H.264";
  }

  let hdrVal = "";
  if (searchPool.includes("hdr10+")) hdrVal = " | 🌈 HDR10+";
  else if (searchPool.includes("hdr")) hdrVal = " | 🌈 HDR";
  else if (searchPool.includes("sdr")) hdrVal = " | 🌈 SDR";

  let sourceVal = "";
  if (searchPool.includes("web-dl") || searchPool.includes("webdl")) sourceVal = " | 📥 WEB-DL";
  else if (searchPool.includes("web-rip") || searchPool.includes("webrip")) sourceVal = " | 🌐 WEB-Rip";
  else if (searchPool.includes("hd-rip") || searchPool.includes("hdrip")) sourceVal = " | 📺 HD-Rip";
  else if (searchPool.includes("bluray")) sourceVal = " | 💿 BluRay";

  const line3 = `🎞️ ${formatVal}${hdrVal} | ${codecVal}${sourceVal}`;

  // Subheading Line 4
  let audioCodec = "🎵 AAC";
  if (searchPool.includes("ddp5.1") || searchPool.includes("ddp 5.1") || searchPool.includes("atmos")) audioCodec = "🎵 DDP 5.1";
  else if (searchPool.includes("truehd")) audioCodec = "🎵 TrueHD";
  
  let audioProfile = "";
  if (searchPool.includes("atmos")) audioProfile = " | 🔊 Dolby Atmos";
  else if (searchPool.includes("dv") || searchPool.includes("dolby vision")) audioProfile = " | ♾ Dolby Vision";
  
  const line4 = audioCodec + audioProfile;

  // Subheading Line 5
  const line5 = `🔗 ${serverType}`;

  return `${line1}\n${line2}\n${line3}\n${line4}\n${line5}`;
}

function makeStream(tmdbData, name, q, server, url, isTv, season, episode) {
  const cleanQ = q.toLowerCase();
  const metadata = buildDropdownMetadata(tmdbData, cleanQ, isTv, season, episode, server, name, url);
  
  let displayLang = "Original-Audio";
  const searchPool = `${name} ${url}`.toLowerCase();
  const multiAudioKeywords = ["multi", "dual", "hindi", "tamil", "telugu", "bengali", "malayalam", "kannada", "marathi", "punjabi"];
  if (multiAudioKeywords.some(keyword => searchPool.includes(keyword))) {
    displayLang = "Multi-Audio";
  }

  return {
    name: `${PROVIDER_NAME} | ${cleanQ} | ${displayLang}`,
    title: metadata,
    size: metadata,
    description: metadata,
    url,
    quality: "",
    language: ""
  };
}

async function resolveTpiLink(tpiUrl) {
  try {
    const html = await fetchText(tpiUrl, { headers: hdrs({ Referer: `${baseUrl}/` }) });
    if (!html) return null;
    const tm = html.match(/<input\s+type="hidden"\s+name="token"\s+value="([^"]+)"/i);
    if (!tm) return null;
    const b64Idx = tm[1].indexOf('aHR0c');
    if (b64Idx < 0) return null;
    const decoded = atob(tm[1].substring(b64Idx));
    return decoded.startsWith("http") ? decoded : null;
  } catch (e) {}
  return null;
}

async function serverHandler(id, server) {
  try {
    const r = await Promise.race([fetch("https://new4.zinkcloud.net/server-handler.php", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", "User-Agent": currentUA },
      body: JSON.stringify({ server, random_id: id })
    }), raceTimeout(FETCH_TIMEOUT)]);
    const d = await r.json();
    if (d?.success && d.url) return d.url;
  } catch (e) {}
  return null;
}

async function processFile(tmdbData, id, label, quality, isTv, season, episode) {
  const q = quality || parseQuality(label);
  const streams = [];
  if (q.toUpperCase() === "480P") return streams;

  const [hcUrl, workerUrl] = await Promise.all([
    serverHandler(id, "hubcloud"),
    serverHandler(id, "worker")
  ]);

  let displayName = label;

  if (hcUrl) {
    const hcHtml = await fetchText(hcUrl, { headers: hdrs() });
    if (hcHtml) {
      const rawTitle = (hcHtml.match(/<title>(.*?)<\/title>/i) || [])[1] || "";
      const cleanTitle = cleanHubTitle(rawTitle);
      displayName = cleanTitle ? `${cleanTitle} ${parseSize(label)}` : label;

      const gamer = hcHtml.match(/href="(https:\/\/gamerxyt\.com[^"]+)"/i);
      if (gamer) {
        const gUrl = gamer[1].replace(/&amp;/g, "&");
        const gHtml = await fetchText(gUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:152.0) Gecko/20100101 Firefox/152.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Referer": hcUrl,
            "DNT": "1",
            "Cookie": "xla=s4t"
          }
        });
        if (gHtml && gHtml.length > 500) {
          const links = [];
          const linkRx = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
          let lm;
          while ((lm = linkRx.exec(gHtml)) !== null) {
            const url = lm[1].replace(/&amp;/g, "&");
            const text = lm[2].replace(/<[^>]+>/g, "").trim();
            if (!url || url.includes("javascript:") || /telegram|tg\/|pixeldrain|hubcloud\.cx|gpdl2/i.test(url)) continue;
            if (!/cdn\.fsl-buckets\.life|r2\.cloudflarestorage|r2\.dev|workers\.dev|hub\.(latent|whistle)/i.test(url)) continue;
            const type = /workers\.dev/i.test(url) ? "Worker" : "FSLv2";
            const qm = text.match(/(2160|1080|720|480)\s*[pP]/i);
            links.push({ url, type, quality: qm ? qm[1] + "p" : "" });
          }
          for (const l of links) streams.push(makeStream(tmdbData, displayName, l.quality || q, l.type, l.url, isTv, season, episode));
        }
      }
    }
  }

  if (workerUrl) streams.push(makeStream(tmdbData, displayName, q, "Worker", workerUrl, isTv, season, episode));

  return streams;
}

function extractConfig(html) {
  try {
    const m = html.match(/new HDVBPlayer\((\{[\s\S]*?\})\)/);
    if (m) return JSON.parse(m[1]);
    const m2 = html.match(/(?:let|var|const)\s+\w+\s*=\s*(\{[\s\S]*?"file":[\s\S]*?\});/);
    if (m2) return JSON.parse(m2[1]);
  } catch (e) {}
  return null;
}

async function getGemmaStreams(tmdbData, imdbId, isTv, season, episode, title) {
  const streams = [];
  try {
    const playerUrl = `https://gemma416okl.com/play/${imdbId}`;
    const html = await fetchText(playerUrl, { headers: hdrs({ "Referer": `${baseUrl}/` }) });
    if (!html) return streams;
    const config = extractConfig(html);
    if (!config?.file || !config?.key) return streams;

    let masterUrl = config.file;
    if (!masterUrl.includes("://")) masterUrl = `https://gemma416okl.com${masterUrl}`;
    const token = config.key;
    const data = await fetchJson(masterUrl, {
      method: "POST",
      headers: { "X-CSRF-TOKEN": token, "Content-Type": "application/x-www-form-urlencoded", "Origin": "https://gemma416okl.com", "Referer": playerUrl }
    });
    if (!data) return streams;

    const base = masterUrl.substring(0, masterUrl.lastIndexOf("/") + 1);
    let langs = [];

    if (isTv) {
      for (const s of data) {
        if (langs.length) break;
        if (s.id == season || (s.title && s.title.includes(String(season)))) {
          if (!s.folder) continue;
          for (const ep of s.folder) {
            if (ep.episode == episode || ep.id == `${season}-${episode}`) {
              if (!ep.folder) continue;
              for (const f of ep.folder) {
                if (f.file && f.file.startsWith("~")) langs.push(f);
              }
            }
          }
        }
      }
    } else {
      for (const item of data) {
        if (item.file && item.file.startsWith("~")) langs.push(item);
      }
    }

    for (const lang of langs) {
      const fetchUrl = `${base}${lang.file.substring(1)}.txt`;
      const m3u8 = await fetchText(fetchUrl, {
        method: "POST",
        headers: { "X-CSRF-TOKEN": token, "Content-Type": "application/x-www-form-urlencoded", "Origin": "https://gemma416okl.com", "Referer": playerUrl }
      });
      if (m3u8 && m3u8.includes(".m3u8")) {
        const metadata = buildDropdownMetadata(tmdbData, "HD", isTv, season, episode, "Embed", lang.title || "Gemma", m3u8);
        const langLabel = lang.title ? ` | ${lang.title}` : "";
        
        streams.push({
          name: `${PROVIDER_NAME} | hd | Gemma${langLabel}`,
          title: metadata,
          size: metadata,
          description: metadata,
          url: m3u8.trim(),
          quality: "",
          language: "",
          headers: { "origin": "https://i-arch-400.keymi417exx.com", "referer": "https://i-arch-400.keymi417exx.com/" }
        });
      }
    }
  } catch (e) {}
  return streams;
}

async function scrapeZinkCloud(tmdbData, title, year, isTv, season, episode) {
  const streams = [];
  try {
    const searchHtml = await fetchText(`${baseUrl}/?s=${encodeURIComponent(title)}`);
    if (!searchHtml) return streams;

    const path = isTv ? "tvshows" : "movies";
    const rx = new RegExp(`href="(https?:\\/\\/[^\\/]+\\/${path}\\/([^"]+))"`, "ig");
    let postUrl;
    let m;
    while ((m = rx.exec(searchHtml)) !== null) {
      if (!year || m[1].includes(year)) { postUrl = m[1]; break; }
    }
    if (!postUrl) return streams;

    const postHtml = await fetchText(postUrl);
    if (!postHtml) return streams;

    if (isTv) {
      let selectedTpiUrl = null;
      let selectedQuality = "";
      let selectedLabel = "";

      const parts = postHtml.split('<div class="seriecontainer">');
      for (let pi = 1; pi < parts.length; pi++) {
        const endIdx = parts[pi].indexOf('<div class="seriecontainer">');
        const container = endIdx >= 0 ? parts[pi].substring(0, endIdx) : parts[pi];
        const langMatch = container.match(/<p>([\s\S]*?)<\/p>/i);
        if (!langMatch) continue;
        const sMatch = langMatch[1].match(/Season\s*0?(\d+)/i);
        if (!sMatch || parseInt(sMatch[1]) !== season) continue;

        const qLinks = [];
        const btnRx = /href="(https:\/\/tpi\.li\/[^"]+)"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/ig;
        let bm;
        while ((bm = btnRx.exec(container)) !== null) {
          const label = bm[2].replace(/<[^>]+>/g, "").trim();
          const q = parseQuality(label);
          if (q.toUpperCase() !== "480P") qLinks.push({ tpiUrl: bm[1], quality: q, label });
        }

        qLinks.sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0));
        if (qLinks.length) {
          selectedTpiUrl = qLinks[0].tpiUrl;
          selectedQuality = qLinks[0].quality;
          selectedLabel = qLinks[0].label;
        }
        break;
      }

      if (selectedTpiUrl) {
        const hiddenUrl = await resolveTpiLink(selectedTpiUrl);
        if (hiddenUrl) {
          const lsHtml = await fetchText(hiddenUrl, { headers: hdrs() });
          if (lsHtml) {
            const targets = [];
            const epRx = /href="(https:\/\/new3\.zinkcloud\.net\/file\/([^"]+))"[^>]*>\s*<span[^>]*>(.*?)<\/span>/ig;
            while ((m = epRx.exec(lsHtml)) !== null) {
              const label = m[3].replace(/<[^>]+>/g, "").trim();
              if (label.toLowerCase().includes("all episodes")) continue;
              const epNum = label.match(/(?:EPISODE|EP|E)\s*[-_]?\s*0?(\d+)/i);
              if (epNum && parseInt(epNum[1]) === episode) {
                targets.push({ id: m[2], label: `${label} ${selectedLabel}`, quality: selectedQuality });
              }
            }
            const nested = await Promise.all(targets.map(t => processFile(tmdbData, t.id, t.label, t.quality, true, season, episode)));
            for (const s of nested.flat()) streams.push(s);
          }
        }
      }
    } else {
      const files = [];
      const fileRx = /href="(https:\/\/tpi\.li\/[^"]+)"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/ig;
      while ((m = fileRx.exec(postHtml)) !== null) {
        files.push({ tpiUrl: m[1], label: m[2].replace(/<[^>]+>/g, "").trim() });
      }

      if (files.length) {
        const resolved = await Promise.all(files.map(async (f) => {
          const hiddenUrl = await resolveTpiLink(f.tpiUrl);
          if (!hiddenUrl) return null;
          const idMatch = hiddenUrl.match(/\/file\/([^\/]+)$/);
          return idMatch ? { id: idMatch[1], label: f.label } : null;
        }));
        const valid = resolved.filter(Boolean);
        const nested = await Promise.all(valid.map(f => processFile(tmdbData, f.id, f.label, null, false, 0, 0)));
        for (const s of nested.flat()) streams.push(s);
      }
    }
  } catch (e) {}
  return streams;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  await refreshDomains();
  currentUA = UAS[Math.floor(Math.random() * UAS.length)];
  const isTv = (mediaType === "series" || mediaType === "tv");
  const allStreams = [];

  let gemmaTitle = "";
  let globalTmdbData = null;

  try {
    globalTmdbData = await fetchJson(`https://api.themoviedb.org/3/${isTv ? "tv" : "movie"}/${tmdbId}?api_key=${TMDB_API_KEY}`);
    if (globalTmdbData) {
      const title = isTv ? globalTmdbData.name : globalTmdbData.title;
      const year = isTv ? (globalTmdbData.first_air_date || "").split("-")[0] : (globalTmdbData.release_date || "").split("-")[0];
      gemmaTitle = isTv
        ? `${title} S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`
        : `${title}${year ? ` (${year})` : ""}`;
      const zinkStreams = await scrapeZinkCloud(globalTmdbData, title, year, isTv, season, episode);
      for (const s of zinkStreams) allStreams.push(s);
    }
  } catch (e) {}

  if (globalTmdbData) {
    try {
      const extData = await fetchJson(`https://api.themoviedb.org/3/${isTv ? "tv" : "movie"}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
      if (extData?.imdb_id) {
        const gemmaStreams = await getGemmaStreams(globalTmdbData, extData.imdb_id, isTv, season, episode, gemmaTitle);
        for (const s of gemmaStreams) allStreams.push(s);
      }
    } catch (e) {}
  }

  function getQualityValue(name) {
    const pool = name.toLowerCase();
    if (pool.includes("2160p") || pool.includes("4k")) return 2160;
    if (pool.includes("1080p")) return 1080;
    if (pool.includes("720p")) return 720;
    return 0;
  }

  return allStreams.sort((a, b) => {
    return getQualityValue(b.name) - getQualityValue(a.name);
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
