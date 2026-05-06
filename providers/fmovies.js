// providers/4KHDhub.js
// v4: Fix HTTP 403 — full browser headers + domain auto-cycling

const DOMAINS_URL  = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const PROVIDER_NAME = "4KHDHub";

// Domain fallback — dicoba urut kalau yang dari domains.json 403
const FALLBACK_DOMAINS = [
  "https://4khdhub.click",
  "https://4khdhub.dad",
  "https://4khdhub.moe",
  "https://4khdhub.lol",
  "https://4khdhub.buzz",
];

// Header lengkap seperti Chrome browser asli
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

const REDIRECT_REGEX = /s\('o','([A-Za-z0-9+/=]+)'|ck\('_wp_http_\d+','([^']+)'/g;

// ─── Domain resolver dengan fallback ──────────────────────────────────────────
// 1. Coba ambil dari domains.json
// 2. Kalau 403 atau gagal, coba domain fallback satu per satu
async function getMainUrl() {
  // Coba dari domains.json dulu
  try {
    const res = await fetch(DOMAINS_URL, { headers: HEADERS });
    if (res.ok) {
      const data = await res.json();
      console.log(`[4KHDHub] domains.json:`, JSON.stringify(data).slice(0, 200));
      const fromJson = data["4khdhub"] || data["n4khdhub"];
      if (fromJson) {
        // Verifikasi domain tidak 403
        const test = await fetch(`${fromJson}/`, { headers: HEADERS, redirect: "follow" });
        if (test.status !== 403) {
          console.log(`[4KHDHub] mainUrl (domains.json): ${fromJson} (${test.status})`);
          return fromJson;
        }
        console.warn(`[4KHDHub] domains.json URL ${fromJson} returned 403, trying fallbacks`);
      }
    }
  } catch (e) {
    console.warn(`[4KHDHub] domains.json error: ${e.message}`);
  }

  // Coba fallback domains
  for (const domain of FALLBACK_DOMAINS) {
    try {
      const test = await fetch(`${domain}/`, { headers: HEADERS, redirect: "follow" });
      if (test.status !== 403 && test.status < 500) {
        console.log(`[4KHDHub] mainUrl (fallback): ${domain} (${test.status})`);
        return domain;
      }
      console.warn(`[4KHDHub] fallback ${domain} = ${test.status}`);
    } catch (e) {
      console.warn(`[4KHDHub] fallback ${domain} error: ${e.message}`);
    }
  }

  console.error(`[4KHDHub] all domains failed`);
  return null;
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function fixUrl(url, baseUrl) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return "https:" + url;
  if (!baseUrl) return url;
  try { return new URL(url, baseUrl).toString(); } catch (_) { return url; }
}

async function fetchText(url, options = {}) {
  const res = await fetch(url, {
    redirect: "follow",
    ...options,
    headers: { ...HEADERS, ...(options.headers || {}) }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} -> ${url}`);
  return res.text();
}

function rot13(value) {
  return value.replace(/[A-Za-z]/g, (char) => {
    const base = char <= "Z" ? 65 : 97;
    return String.fromCharCode((char.charCodeAt(0) - base + 13) % 26 + base);
  });
}
function decodeBase64(value) {
  try { return atob(value); } catch (_) { return ""; }
}
function normalizeTitle(value) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function parseQuality(text) {
  const v = (text || "").toLowerCase();
  const m = v.match(/\d{3,4}p/);
  if (m) return m[0];
  if (/2160p|4k|uhd/.test(v)) return "2160p";
  if (/1440p/.test(v)) return "1440p";
  if (/1080p/.test(v)) return "1080p";
  if (/720p/.test(v))  return "720p";
  if (/480p/.test(v))  return "480p";
  return "Auto";
}
function cleanFileDetails(title) {
  const normalized = (title || "")
    .replace(/\.[a-z0-9]{2,4}$/i, "")
    .replace(/WEB[-_. ]?DL/gi, "WEB-DL")
    .replace(/WEB[-_. ]?RIP/gi, "WEBRIP")
    .replace(/H[ .]?265/gi, "H265")
    .replace(/H[ .]?264/gi, "H264")
    .replace(/DDP[ .]?([0-9]\.[0-9])/gi, "DDP$1");
  const allowed = new Set(["WEB-DL","WEBRIP","BLURAY","HDRIP","DVDRIP","HDTV","CAM","TS","BRRIP","BDRIP","H264","H265","X264","X265","HEVC","AVC","AAC","AC3","DTS","MP3","FLAC","DD","ATMOS","HDR","HDR10","HDR10+","DV","DOLBYVISION","NF","CR","SDR"]);
  const parts    = normalized.split(/[ ._]+/).map(p => p.toUpperCase());
  const filtered = [];
  for (const part of parts) {
    if (allowed.has(part)) filtered.push(part === "DV" ? "DOLBYVISION" : part);
    else if (/^DDP\d\.\d$/.test(part)) filtered.push(part);
  }
  return [...new Set(filtered)].join(" ");
}
function inferLanguageLabel(text = "") {
  const v = text.toLowerCase();
  const langs = [];
  if (v.includes("hindi"))     langs.push("Hindi");
  if (v.includes("tamil"))     langs.push("Tamil");
  if (v.includes("telugu"))    langs.push("Telugu");
  if (v.includes("malayalam")) langs.push("Malayalam");
  if (v.includes("kannada"))   langs.push("Kannada");
  if (v.includes("bengali"))   langs.push("Bengali");
  if (v.includes("punjabi"))   langs.push("Punjabi");
  if (v.includes("english"))   langs.push("English");
  if (langs.length > 2)  return "Multi Audio";
  if (langs.length === 2) return langs.join("-");
  if (langs.length === 1) return langs[0];
  if (v.includes("dual audio") || v.includes("dual")) return "Dual Audio";
  return "EN";
}
function buildDisplayMeta(sourceTitle = "", quality = "Auto", size = "", tech = "") {
  const lang       = inferLanguageLabel(sourceTitle);
  const titleParts = [quality, lang, size, tech].filter(p => p && p !== "Auto");
  const baseInfo   = titleParts.join(" | ") || "Stream";
  if (/^S\d+/i.test(sourceTitle)) {
    return { displayName: `${PROVIDER_NAME} - ${lang}`, displayTitle: `${sourceTitle} | ${baseInfo}` };
  }
  return { displayName: `${PROVIDER_NAME} - ${lang}`, displayTitle: baseInfo };
}
function buildStream(title, url, quality = "Auto", headers = {}, size = "", tech = "") {
  let finalUrl = url;
  if (!/\.(m3u8|mp4|mkv)/i.test(finalUrl)) finalUrl += finalUrl.includes("#") ? "" : "#.mkv";
  const meta = buildDisplayMeta(title, quality, size, tech);
  return {
    name:    meta.displayName,
    title:   meta.displayTitle,
    url:     finalUrl,
    quality: quality,
    headers: Object.keys(headers).length ? headers : undefined
  };
}
function dedupeStreams(streams) {
  const seen = new Set();
  return streams.filter(s => {
    const fp = `${s.title}|${s.quality}`.toLowerCase().replace(/\s/g, "");
    if (seen.has(fp)) return false;
    seen.add(fp);
    return true;
  });
}

// ─── TMDB ──────────────────────────────────────────────────────────────────────

async function getTmdbTitle(tmdbId, mediaType) {
  try {
    const type = mediaType === "movie" ? "movie" : "tv";
    const res  = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`, { headers: HEADERS });
    if (!res.ok) throw new Error(`TMDB ${res.status}`);
    const data      = await res.json();
    const title     = data.name || data.title || "";
    const origTitle = data.original_name || data.original_title || title;
    let shortTitle  = "";
    if (origTitle && (origTitle.includes(":") || /\band\b/i.test(origTitle))) {
      shortTitle = origTitle.split(":")[0].split(/ and /i)[0].trim();
    }
    console.log(`[4KHDHub] titles: tr="${title}" orig="${origTitle}" short="${shortTitle}"`);
    return { trTitle: title, origTitle, shortTitle };
  } catch (e) {
    console.error(`[4KHDHub] getTmdbTitle error: ${e.message}`);
    return { trTitle: "", origTitle: "", shortTitle: "" };
  }
}

// ─── Redirect resolver ─────────────────────────────────────────────────────────

async function getRedirectLinks(url) {
  let html = "";
  try { html = await fetchText(url); } catch (_) { return ""; }
  let combined = "";
  let match;
  const re = new RegExp(REDIRECT_REGEX.source, "g");
  while ((match = re.exec(html)) !== null) combined += match[1] || match[2] || "";
  if (!combined) return "";
  try {
    const decoded    = decodeBase64(rot13(decodeBase64(decodeBase64(combined))));
    const json       = JSON.parse(decoded);
    const encodedUrl = decodeBase64(json.o || "").trim();
    if (encodedUrl) return encodedUrl;
    const data    = decodeBase64(json.data || "");
    const blogUrl = json.blog_url || "";
    if (!data || !blogUrl) return "";
    return (await fetchText(`${blogUrl}?re=${encodeURIComponent(data)}`)).trim();
  } catch (_) { return ""; }
}

// ─── HTML parsers ──────────────────────────────────────────────────────────────

function extractAnchors(html) {
  const results = [];
  const re = /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    results.push({ href: m[1], text: m[2].replace(/<[^>]+>/g, "").trim() });
  }
  return results;
}

function getInnerText(html, selector) {
  let tagRe;
  const idMatch    = selector.match(/^(\w+)#([\w-]+)$/);
  const classMatch = selector.match(/^(\w+)\.([\w-]+)$/);
  const plainMatch = selector.match(/^(\w+)$/);
  if (idMatch) {
    tagRe = new RegExp(`<${idMatch[1]}[^>]*id="${idMatch[2]}"[^>]*>([\\s\\S]*?)<\\/${idMatch[1]}>`, "i");
  } else if (classMatch) {
    tagRe = new RegExp(`<${classMatch[1]}[^>]*class="[^"]*${classMatch[2]}[^"]*"[^>]*>([\\s\\S]*?)<\\/${classMatch[1]}>`, "i");
  } else if (plainMatch) {
    tagRe = new RegExp(`<${plainMatch[1]}[^>]*>([\\s\\S]*?)<\\/${plainMatch[1]}>`, "i");
  } else {
    return "";
  }
  const m = html.match(tagRe);
  return m ? m[1].replace(/<[^>]+>/g, "").trim() : "";
}

function findDivsByClass(html, className) {
  const results = [];
  const openRe  = new RegExp(`<div[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>`, "gi");
  let m;
  while ((m = openRe.exec(html)) !== null) {
    const start = m.index + m[0].length;
    let depth   = 1;
    let i       = start;
    while (i < html.length && depth > 0) {
      if (html[i] === "<") {
        if (html.substr(i, 6) === "</div>") { depth--; i += 6; continue; }
        if (/^<div[\s>]/i.test(html.substr(i, 5))) depth++;
      }
      i++;
    }
    results.push({
      outerHtml: m[0] + html.slice(start, i - 6),
      innerHtml: html.slice(start, i - 6)
    });
  }
  return results;
}

// ─── Search ────────────────────────────────────────────────────────────────────

async function searchContent(query, mainUrl) {
  const searchUrl = `${mainUrl}/?s=${encodeURIComponent(query)}`;
  console.log(`[4KHDHub] search: ${searchUrl}`);

  let html;
  try {
    html = await fetchText(searchUrl);
  } catch (e) {
    console.error(`[4KHDHub] search error: ${e.message}`);
    return null;
  }

  console.log(`[4KHDHub] search HTML: ${html.length} chars`);

  // Log class samples untuk debug struktur
  const classHits = [...html.matchAll(/class="([^"]*(?:card|post|item|grid|result)[^"]*)"/gi)]
    .slice(0, 6).map(m => m[1]);
  console.log(`[4KHDHub] class samples: ${classHits.join(" | ")}`);

  let cardBlocks = findDivsByClass(html, "card-grid");
  if (!cardBlocks.length) cardBlocks = findDivsByClass(html, "card-grid-small");
  if (!cardBlocks.length) cardBlocks = findDivsByClass(html, "post-item");
  if (!cardBlocks.length) cardBlocks = findDivsByClass(html, "search-item");
  if (!cardBlocks.length) cardBlocks = findDivsByClass(html, "result-item");
  if (!cardBlocks.length) {
    const articleRe = /<article[^>]*>([\s\S]*?)<\/article>/gi;
    let am;
    while ((am = articleRe.exec(html)) !== null) {
      cardBlocks.push({ innerHtml: am[1], outerHtml: am[0] });
    }
  }
  if (!cardBlocks.length) cardBlocks = [{ innerHtml: html, outerHtml: html }];

  console.log(`[4KHDHub] card blocks: ${cardBlocks.length}`);

  const results = [];
  for (const block of cardBlocks) {
    const anchors = extractAnchors(block.innerHtml);
    for (const { href, text } of anchors) {
      const fullHref = fixUrl(href, mainUrl);
      if (!fullHref) continue;
      if (fullHref.includes("/category/") || fullHref.includes("/tag/") ||
          fullHref.includes("/page/") || fullHref === mainUrl + "/" ||
          fullHref === mainUrl) continue;
      if (!fullHref.startsWith(mainUrl)) continue;
      const h3Match  = block.innerHtml.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/i);
      const imgMatch = block.innerHtml.match(/<img[^>]*alt="([^"]+)"/i);
      const title    = (h3Match ? h3Match[1].replace(/<[^>]+>/g, "").trim() : "") ||
                       (imgMatch ? imgMatch[1] : "") || text;
      if (title && fullHref) results.push({ title, href: fullHref });
    }
  }

  const unique = results.filter((r, i) => results.findIndex(x => x.href === r.href) === i);
  console.log(`[4KHDHub] results: ${unique.length} — ${unique.slice(0, 3).map(r => `"${r.title}"`).join(", ")}`);
  if (!unique.length) return null;

  const q       = normalizeTitle(query);
  const exact   = unique.find(r => normalizeTitle(r.title) === q);
  const starts  = unique.find(r => normalizeTitle(r.title).startsWith(q));
  const includes = unique.find(r => normalizeTitle(r.title).includes(q));
  const chosen  = (exact || starts || includes)?.href || null;
  console.log(`[4KHDHub] chosen: ${chosen} (q="${q}")`);
  return chosen;
}

// ─── Movie links ───────────────────────────────────────────────────────────────

function collectMovieLinks(html, pageUrl) {
  let blocks = findDivsByClass(html, "download-item");
  if (!blocks.length) blocks = findDivsByClass(html, "dl-item");
  console.log(`[4KHDHub] download blocks: ${blocks.length}`);

  const links = [];
  for (const block of blocks) {
    const anchors = extractAnchors(block.innerHtml);
    if (!anchors[0]) continue;
    const href = fixUrl(anchors[0].href, pageUrl);
    if (!href) continue;
    links.push({ url: href, label: block.innerHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "Movie", rawHtml: block.innerHtml });
  }

  if (!links.length) {
    console.log(`[4KHDHub] download fallback: scanning anchors`);
    const anchors = extractAnchors(html);
    for (const { href, text } of anchors) {
      const full = fixUrl(href, pageUrl);
      if (!full) continue;
      if (/hubdrive|hubcloud|hubcdn|pixeldrain|gdrive|google.*drive/i.test(full) && !full.startsWith(pageUrl)) {
        links.push({ url: full, label: text || "Movie", rawHtml: "" });
      }
    }
  }
  console.log(`[4KHDHub] movie links: ${links.length}`);
  return links;
}

// ─── Episode links ─────────────────────────────────────────────────────────────

function collectEpisodeLinks(html, pageUrl, season, episode) {
  const sNum         = Number(season);
  const eNum         = Number(episode);
  const displayLabel = `S${sNum} E${eNum}`;
  const foundLinks   = [];

  const episodeBlocks = findDivsByClass(html, "episode-item");
  console.log(`[4KHDHub] episode-item: ${episodeBlocks.length}`);
  for (const block of episodeBlocks) {
    if (!new RegExp(`S(?:eason)?\\s*0*${sNum}\\b`, "i").test(block.innerHtml)) continue;
    for (const { href, text } of extractAnchors(block.innerHtml)) {
      if (new RegExp(`(?:Episode|Ep|E)\\s*0*${eNum}\\b`, "i").test(text)) {
        const full = fixUrl(href, pageUrl);
        if (full) foundLinks.push({ url: full, label: displayLabel, rawHtml: block.innerHtml });
      }
    }
  }
  if (foundLinks.length) { console.log(`[4KHDHub] ep via episode-item: ${foundLinks.length}`); return foundLinks; }

  const seasonBlocks = findDivsByClass(html, "season-item");
  console.log(`[4KHDHub] season-item: ${seasonBlocks.length}`);
  for (const block of seasonBlocks) {
    const snText  = getInnerText(block.innerHtml, "div.episode-number");
    const snMatch = snText.match(/S?([0-9]+)/i);
    if (!snMatch || parseInt(snMatch[1], 10) !== sNum) continue;
    for (const ep of findDivsByClass(block.innerHtml, "episode-download-item")) {
      const epText  = ep.innerHtml.replace(/<[^>]+>/g, " ");
      const epMatch = epText.match(/Episode-?0*([0-9]+)/i) || epText.match(/E0*([0-9]+)/i);
      if (epMatch && parseInt(epMatch[1], 10) === eNum) {
        for (const { href } of extractAnchors(ep.innerHtml)) {
          const full = fixUrl(href, pageUrl);
          if (full) foundLinks.push({ url: full, label: displayLabel, rawHtml: ep.innerHtml });
        }
      }
    }
  }
  if (foundLinks.length) { console.log(`[4KHDHub] ep via season-item: ${foundLinks.length}`); return foundLinks; }

  const dlBlocks = findDivsByClass(html, "download-item");
  for (const block of dlBlocks) {
    const text = block.innerHtml.replace(/<[^>]+>/g, " ");
    if (!new RegExp(`S(?:eason)?\\s*0*${sNum}\\b`, "i").test(text)) continue;
    for (const { href } of extractAnchors(block.innerHtml)) {
      const full = fixUrl(href, pageUrl);
      if (full) foundLinks.push({ url: full, label: `S${sNum} Pack`, rawHtml: block.innerHtml });
    }
  }
  if (foundLinks.length) { console.log(`[4KHDHub] ep via dl-item: ${foundLinks.length}`); return foundLinks; }

  console.log(`[4KHDHub] ep full-page scan for S${sNum}E${eNum}`);
  for (const { href, text } of extractAnchors(html)) {
    if (new RegExp(`S0*${sNum}[\\s._-]*E0*${eNum}\\b`, "i").test(text)) {
      const full = fixUrl(href, pageUrl);
      if (full) foundLinks.push({ url: full, label: displayLabel, rawHtml: text });
    }
  }
  console.log(`[4KHDHub] ep total: ${foundLinks.length}`);
  return foundLinks;
}

// ─── Link resolvers ────────────────────────────────────────────────────────────

async function resolveHubcdnDirect(url, sourceTitle, quality) {
  const html    = await fetchText(url, { headers: { Referer: url } });
  const encoded = html.match(/r=([A-Za-z0-9+/=]+)/)?.[1] ||
                  html.match(/reurl\s*=\s*"([^"]+)"/)?.[1]?.split("?r=").pop();
  if (!encoded) { console.warn(`[4KHDHub] hubcdn: no encoded URL`); return []; }
  const decoded = decodeBase64(encoded).split("link=").pop();
  if (!decoded || decoded === encoded) { console.warn(`[4KHDHub] hubcdn: decode failed`); return []; }
  return [buildStream(`${sourceTitle} - HUBCDN`, decoded, quality, { Referer: url })];
}

async function resolveHubdrive(url, sourceTitle, quality) {
  const html = await fetchText(url);
  const m    = html.match(/<a[^>]*class="[^"]*btn-success1[^"]*"[^>]*href="([^"]+)"/i) ||
               html.match(/<a[^>]*href="([^"]+)"[^>]*class="[^"]*btn-success1[^"]*"/i);
  if (!m) { console.warn(`[4KHDHub] hubdrive: btn-success1 not found`); return []; }
  return resolveLink(fixUrl(m[1], url), `${sourceTitle} - HubDrive`, url, quality);
}

async function resolveHubcloud(url, sourceTitle, referer, quality) {
  const baseHeaders = referer ? { Referer: referer } : {};
  let entryUrl = url;

  if (!/hubcloud\.php/i.test(url)) {
    const html2 = await fetchText(url, { headers: baseHeaders });
    const m     = html2.match(/<[^>]*id="download"[^>]*href="([^"]+)"/i) ||
                  html2.match(/href="([^"]+)"[^>]*id="download"/i);
    if (!m) { console.warn(`[4KHDHub] hubcloud: #download not found at ${url}`); return []; }
    entryUrl = fixUrl(m[1], url);
  }

  const html = await fetchText(entryUrl, { headers: { Referer: url, ...baseHeaders } });
  const sizeM    = html.match(/<i[^>]*id="size"[^>]*>([\s\S]*?)<\/i>/i);
  const size     = sizeM ? sizeM[1].replace(/<[^>]+>/g, "").trim() : "";
  const headerM  = html.match(/<div[^>]*class="[^"]*card-header[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const header   = headerM ? headerM[1].replace(/<[^>]+>/g, "").trim() : "";
  const tech     = cleanFileDetails(header);
  const fq       = quality !== "Auto" ? quality : parseQuality(header);
  const streams  = [];
  const btnRe    = /<a[^>]*class="[^"]*btn[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let bm;
  while ((bm = btnRe.exec(html)) !== null) {
    const link = fixUrl(bm[1], entryUrl);
    const text = bm[2].replace(/<[^>]+>/g, "").trim().toLowerCase();
    if (!link) continue;
    let sub = sourceTitle;
    if (text.includes("buzzserver")) sub += " - BuzzServer";
    else if (text.includes("pixel"))  sub += " - Pixeldrain";
    let finalUrl = link;
    if (text.includes("pixel") && !link.includes("/api/file/")) {
      try {
        const pdId = new URL(link).pathname.split("/").pop();
        if (pdId) finalUrl = `${new URL(link).origin}/api/file/${pdId}?download`;
      } catch (_) {}
    }
    streams.push(buildStream(sub, finalUrl, fq, { Referer: entryUrl }, size, tech));
  }
  console.log(`[4KHDHub] hubcloud → ${streams.length} streams`);
  return streams;
}

async function resolveLink(rawUrl, sourceTitle, referer = "", quality = "Auto") {
  let url = rawUrl;
  if (!url) return [];
  console.log(`[4KHDHub] resolveLink: ${url}`);

  if (url.includes("id=")) {
    const redirected = await getRedirectLinks(url);
    if (redirected) { console.log(`[4KHDHub] redirect → ${redirected}`); url = redirected; }
  }

  const lower = url.toLowerCase();
  try {
    if (/\.(m3u8|mp4|mkv)(\?|$)/i.test(url))
      return [buildStream(sourceTitle, url, quality, referer ? { Referer: referer } : {})];
    if (lower.includes("hubdrive"))   return await resolveHubdrive(url, sourceTitle, quality);
    if (lower.includes("hubcloud"))   return await resolveHubcloud(url, sourceTitle, referer, quality);
    if (lower.includes("hubcdn"))     return await resolveHubcdnDirect(url, sourceTitle, quality);
    if (lower.includes("pixeldrain")) {
      const pdId = url.split("/").pop();
      return [buildStream(`${sourceTitle} - Pixeldrain`,
        `https://pixeldrain.com/api/file/${pdId}?download`,
        quality, referer ? { Referer: referer } : {})];
    }
    console.warn(`[4KHDHub] unrecognized link: ${url}`);
  } catch (e) {
    console.error(`[4KHDHub] resolveLink error: ${e.message}`);
  }
  return [];
}

// ─── Main extractor ────────────────────────────────────────────────────────────

async function extractStreams(tmdbId, mediaType, season, episode) {
  const { trTitle, origTitle, shortTitle } = await getTmdbTitle(tmdbId, mediaType);
  if (!trTitle && !origTitle) { console.warn(`[4KHDHub] no title`); return []; }

  // Resolve domain aktif (dengan fallback kalau 403)
  const mainUrl = await getMainUrl();
  if (!mainUrl) return [];

  // Coba cari dengan berbagai variasi judul
  let contentUrl = await searchContent(trTitle, mainUrl);
  if (!contentUrl && origTitle && origTitle !== trTitle)
    contentUrl = await searchContent(origTitle, mainUrl);
  if (!contentUrl && shortTitle)
    contentUrl = await searchContent(shortTitle, mainUrl);

  if (!contentUrl) { console.warn(`[4KHDHub] not found: "${trTitle}"`); return []; }

  console.log(`[4KHDHub] content: ${contentUrl}`);
  const html = await fetchText(contentUrl);
  console.log(`[4KHDHub] page: ${html.length} chars | dl-item:${html.includes("download-item")} ep-item:${html.includes("episode-item")}`);

  const isMoviePage = !html.includes("episode-item") && !html.includes("season-item") && !html.includes("episodes-list");
  const links = (mediaType === "movie" || isMoviePage)
    ? collectMovieLinks(html, contentUrl)
    : collectEpisodeLinks(html, contentUrl, season, episode);

  if (!links.length) { console.warn(`[4KHDHub] no links on page`); return []; }

  const allStreams   = [];
  const resolvedUrls = new Set();
  for (const linkItem of links) {
    const quality  = parseQuality(linkItem.rawHtml || linkItem.label);
    const resolved = await resolveLink(linkItem.url, linkItem.label || PROVIDER_NAME, contentUrl, quality);
    for (const stream of resolved) {
      const key = stream.url.split("#")[0].toLowerCase();
      if (!resolvedUrls.has(key)) { resolvedUrls.add(key); allStreams.push(stream); }
    }
  }

  console.log(`[4KHDHub] done: ${allStreams.length} streams`);
  return dedupeStreams(allStreams);
}

// ─── Export ────────────────────────────────────────────────────────────────────
export async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    return await extractStreams(tmdbId, mediaType, season, episode);
  } catch (e) {
    console.error(`[4KHDHub] fatal: ${e.message}`);
    return [];
  }
}
