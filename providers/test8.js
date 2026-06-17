const cheerio = require('cheerio-without-node-native'); 
const PROVIDER_NAME = "VegaMovies"; 
const BASE_URL = "https://vegamovies.mq"; 
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c"; 
const DOMAINS_JSON_URL = "https://raw.githubusercontent.com/SaurabhKaperwan/Utils/refs/heads/main/urls.json"; 
const REQUEST_TIMEOUT = 12000; 
const HEADERS = { 
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", 
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8", 
    "Accept-Language": "en-US,en;q=0.5" 
}; 

const MOBILE_UAS = [ 
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", 
    "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36" 
]; 

function getMobileHeaders() { 
    const ua = MOBILE_UAS[Math.floor(Math.random() * MOBILE_UAS.length)]; 
    return { "User-Agent": ua, "Accept": "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9", "Referer": baseUrl + "/" }; 
} 

const EXCLUDED_BUTTONS = ['filepress', 'gdtot', 'dropgalaxy', 'gdflix', 'gdlink']; 

// ---- helpers ---- 
async function fetchSafe(url, options = {}, timeout = REQUEST_TIMEOUT) { 
    try { 
        const merged = { ...options, headers: { ...HEADERS, ...(options.headers || {}), 'Accept-Encoding': 'identity' } }; 
        const fetchPromise = fetch(url, merged); 
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout)); 
        return await Promise.race([fetchPromise, timeoutPromise]); 
    } catch (e) { return null; } 
} 

async function fetchJson(url, options = {}) { 
    try { 
        const res = await fetchSafe(url, options); 
        if (!res || !res.ok) return null; 
        const text = await res.text(); 
        return JSON.parse(text); 
    } catch (e) { return null; } 
} 

async function fetchHtml(url, options = {}) { 
    try { 
        const res = await fetchSafe(url, options); 
        if (!res || !res.ok) return null; 
        return cheerio.load(await res.text()); 
    } catch (e) { return null; } 
} 

function getOrigin(url) { 
    try { 
        const parts = url.split('//'); 
        if (parts.length < 2) return url; 
        return parts[0] + '//' + parts[1].split('/')[0]; 
    } catch (e) { return url; } 
} 

function fixUrl(url) { 
    if (!url) return ''; 
    if (url.startsWith('http://') || url.startsWith('https://')) return url; 
    if (url.startsWith('//')) return 'https:' + url; 
    if (url.startsWith('/')) return baseUrl + url; 
    return baseUrl + '/' + url; 
} 

function parseQuality(text) { 
    const t = String(text || ''); 
    const q = t.match(/(2160|1080|720|480)\s*P/i); 
    if (q) return q[1].toLowerCase() + 'p'; 
    if (/4K|UHD/i.test(t)) return '2160p'; 
    if (/1440|2K/i.test(t)) return '1440p'; 
    return '1080p'; 
} 

function decodeEntities(str) { 
    if (!str) return ''; 
    return str.replace(/&#8211;/g, '-').replace(/&#8212;/g, '-').replace(/&#038;/g, '&').replace(/&#8217;/g, "'").replace(/&amp;/g, '&').replace(/&ndash;/g, '-').replace(/&mdash;/g, '-').replace(/&quot;/g, '"'); 
} 

// ---- Spec Extractors ----
function parseAudioSpecs(filename, title) {
    const combined = String(filename + " " + title).toLowerCase();
    if (combined.includes("atmos")) return "Dolby Atmos";
    if (combined.includes("ddp5.1") || combined.includes("dd+5.1") || combined.includes("atmos 5.1")) return "DDP5.1";
    if (combined.includes("dd5.1") || combined.includes("dolby5.1") || combined.includes("dolby digital")) return "Dolby Digital";
    if (combined.includes("aac2.0") || combined.includes("aac")) return "AAC 2.0";
    return "Native Audio";
}

function parseVideoCodecAndTags(filename, title) {
    const combined = String(filename + " " + title).toLowerCase();
    let codec = "x264";
    if (combined.includes("x265") || combined.includes("h265") || combined.includes("hevc")) codec = "x265";
    
    let hdr = "";
    if (combined.includes("hdr10")) hdr = " • ⚡ HDR10";
    else if (combined.includes("hdr")) hdr = " • ⚡ HDR";
    else if (combined.includes("10bit")) hdr = " • ⚡ 10Bit";

    let source = "WEB-DL";
    if (combined.includes("bluray") || combined.includes("bdrip")) source = "BluRay";
    else if (combined.includes("hdtv")) source = "HDTV";

    return { codec, hdr, source };
}

function parseLanguagesAndFlags(filename, title) {
    const combined = String(filename + " " + title).toLowerCase();
    const matches = [];

    const languageMaps = [
        { keys: ["hindi", "hin"], name: "Hindi", flag: "🇮🇳" },
        { keys: ["english", "eng"], name: "English", flag: "🇺🇸" },
        { keys: ["spanish", "spa"], name: "Spanish", flag: "🇪🇸" },
        { keys: ["italian", "ita"], name: "Italian", flag: "🇮🇹" }
    ];

    languageMaps.forEach(m => {
        if (m.keys.some(k => combined.includes(k))) matches.push(m);
    });

    if (matches.length === 0) {
        if (combined.includes("dual")) return "Hindi 🇮🇳 • English 🇺🇸";
        return "English 🇺🇸";
    }
    return matches.map(m => `${m.name} ${m.flag}`).join(" • ");
}

// ---- Stream Maker Layer ----
function makeStream(name, title, url, quality, headers, mediaInfo, runtimeSec, mediaTitle, mediaYear) {
    let cleanTitle = decodeEntities(title || "").replace(/[\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    let filename = "";
    
    const fileMatch = cleanTitle.match(/\[\s*([^\]]+\.(?:mkv|mp4|avi|ts))\s*\]/i);
    if (fileMatch) {
        filename = fileMatch[1].trim();
    } else if (url.includes('/') && url.split('/').pop().includes('.')) {
        filename = url.split('/').pop();
    }

    const cleanQuality = quality || parseQuality(filename) || "1080p";
    const audioSpecs = parseAudioSpecs(filename, cleanTitle);
    const videoData = parseVideoCodecAndTags(filename, cleanTitle);
    const languages = parseLanguagesAndFlags(filename, cleanTitle);

    let durationText = runtimeSec && runtimeSec > 0 ? `${runtimeSec} min` : "98 min";
    
    // Switch to clean resolution text indicators to prevent mobile engine collapse
    let displayRes = "FHD";
    let qIcon = "💎";
    if (cleanQuality.includes("2160") || cleanQuality.includes("4k")) {
        displayRes = "4K UHD";
        qIcon = "🌟";
    } else if (cleanQuality.includes("720")) {
        displayRes = "HD";
    }

    const format = filename.toLowerCase().includes(".mp4") ? "MP4" : "MKV";
    
    // We remove duplicate resolution strings (like 1080p | 💎 1080p) which breaks mobile
    // This layouts the icons perfectly onto the mobile lines
    const cleanStreamTitle = `🎬 ${mediaTitle} (${mediaYear || '2026'})\n${qIcon} ${displayRes} | 🗣️ ${languages} | 🎧 ${audioSpecs}\n📦 ${format} | ⏳ ${durationText} | 📌 ${videoData.codec} • ${videoData.source}${videoData.hdr}`;

    // Main Card Title Header Component
    const cardHeader = `${PROVIDER_NAME} | ${cleanQuality} | Dual-Audio`;

    return { 
        name: cardHeader, 
        title: cleanStreamTitle, 
        quality: cleanQuality, 
        url: url || "", 
        behaviorHints: { 
            notWebReady: true, 
            proxyHeaders: { request: { "Referer": baseUrl + "/" } } 
        } 
    }; 
}

function dedupe(streams) { 
    const seen = new Set(); 
    return (streams || []).filter(s => { 
        if (!s || !s.url || seen.has(s.url)) return false; 
        seen.add(s.url); 
        return true; 
    }); 
} 

function isStrictMatch(requestedTitle, requestedYear, scrapedTitle, scrapedYear, altTitles = []) { 
    if (!scrapedTitle) return false; 
    const scrClean = scrapedTitle.toLowerCase().replace(/download\s*/gi, '').replace(/[^a-z0-9\s]/g, ' ').trim().replace(/\s+/g, ' '); 
    let validTitles = [requestedTitle, ...altTitles].filter(t => !!t); 
    let matched = false; 
    for (let t of validTitles) { 
        const reqClean = t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim().replace(/\s+/g, ' '); 
        if (reqClean.length > 0 && (scrClean.includes(reqClean) || scrClean.startsWith(reqClean))) { 
            matched = true; 
            break; 
        } 
    } 
    if (!matched) return false; 
    if (requestedYear && scrapedYear) { 
        const rY = parseInt(requestedYear); 
        const sY = parseInt(scrapedYear); 
        if (!isNaN(rY) && !isNaN(sY)) { 
            if (Math.abs(rY - sY) > 1) return false; 
        } 
    } 
    return true; 
} 

// ---- Dynamic Domain Updater ---- 
let cachedDomains = null; 
let domainCacheTime = 0; 
const DOMAIN_CACHE_TTL = 4 * 60 * 60 * 1000; 
let baseUrl = BASE_URL; 
let cachedHubDomain = 'https://hubcloud.foo'; 
let cachedVcDomain = 'https://vcloud.zip'; 

async function refreshDomains() { 
    const now = Date.now(); 
    if (cachedDomains && (now - domainCacheTime) < DOMAIN_CACHE_TTL) return cachedDomains; 
    try { 
        const data = await fetchJson(DOMAINS_JSON_URL, {}, 8000); 
        if (data) { 
            cachedDomains = data; 
            domainCacheTime = now; 
            if (data.vegamovies) baseUrl = data.vegamovies; 
            if (data.hubcloud) cachedHubDomain = data.hubcloud; 
            if (data.vcloud) cachedVcDomain = data.vcloud; 
        } 
    } catch (e) {} 
    return cachedDomains || {}; 
} 

function getLatestHubDomain() { return cachedHubDomain; } 
function getLatestVcDomain() { return cachedVcDomain; } 

// ---- TMDB Resolver ---- 
async function getTMDBInfo(id, type, season, episode) { 
    const idStr = String(id || '').trim(); 
    const isImdb = idStr.startsWith('tt'); 
    const tmdbType = (type === 'tv' || type === 'series') ? 'tv' : 'movie'; 
    const sNum = Number.isInteger(season) ? season : 1;
    const eNum = Number.isInteger(episode) ? episode : 1;

    try { 
        if (isImdb) { 
            const data = await fetchJson('https://api.themoviedb.org/3/find/' + idStr + '?api_key=' + TMDB_API_KEY + '&external_source=imdb_id'); 
            const list = data ? (tmdbType === 'tv' ? data.tv_results : data.movie_results) : null; 
            if (list && list.length > 0) { 
                const item = list[0]; 
                return { title: tmdbType === 'tv' ? item.name : item.title, year: (item.first_air_date || item.release_date || '').split('-')[0], imdbId: idStr, tmdbId: item.id, runtime: 0 }; 
            } 
            return { title: idStr, year: null, imdbId: idStr, tmdbId: null, runtime: 0 }; 
        } else { 
            const data = await fetchJson('https://api.themoviedb.org/3/' + tmdbType + '/' + idStr + '?api_key=' + TMDB_API_KEY + '&append_to_response=external_ids,alternative_titles'); 
            if (data) { 
                let altTitles = []; 
                if (data.alternative_titles && data.alternative_titles.titles) { 
                    altTitles = data.alternative_titles.titles.map(t => String(t.title || '')); 
                } else if (data.alternative_titles && data.alternative_titles.results) { 
                    altTitles = data.alternative_titles.results.map(t => String(t.title || '')); 
                } 

                let runtime = 0;
                if (tmdbType === 'tv') {
                    const epData = await fetchJson(`https://api.themoviedb.org/3/tv/${idStr}/season/${sNum}/episode/${eNum}?api_key=${TMDB_API_KEY}`);
                    if (epData && epData.runtime) runtime = epData.runtime;
                    else if (data.episode_run_time && data.episode_run_time.length > 0) runtime = data.episode_run_time[0];
                } else {
                    runtime = data.runtime || 0;
                }

                return { 
                    title: tmdbType === 'tv' ? data.name : data.title, 
                    year: (data.first_air_date || data.release_date || '').split('-')[0], 
                    imdbId: data.imdb_id || (data.external_ids && data.external_ids.imdb_id) || null, 
                    tmdbId: data.id, 
                    altTitles: altTitles,
                    runtime: runtime
                }; 
            } 
        } 
    } catch (e) {} 
    return { title: idStr, year: null, imdbId: null, tmdbId: null, runtime: 0 }; 
} 

// ---- Search Handler ---- 
async function searchByTitle(query, year) { 
    if (!query) return []; 
    const searchQuery = encodeURIComponent(query + (year ? ' ' + year : '')); 
    const url = baseUrl + '/search.php?q=' + searchQuery + '&page=1&per_page=15'; 
    const data = await fetchJson(url, { headers: { ...getMobileHeaders(), 'Accept-Encoding': 'identity' } }); 
    if (!data || !data.hits || data.hits.length === 0) return []; 
    return data.hits.map(h => { 
        const doc = h.document || {}; 
        return { 
            postId: String(doc.id || ''), 
            title: (doc.post_title || '').replace(/Download\s*/gi, '').trim(), 
            permalink: doc.permalink || '', 
            imdbId: doc.imdb_id || '', 
            year: (doc.category && Array.isArray(doc.category)) ? (doc.category.find(c => /^(19|20)\d{2}$/.test(String(c).trim())) || (((doc.post_title || '').match(/\b(19|20)\d{2}\b/) || [null])[0])) : (((doc.post_title || '').match(/\b(19|20)\d{2}\b/) || [null])[0]) 
        }; 
    }); 
} 

// ---- WP-JSON Content Fetcher ---- 
async function fetchPostContent(postId, link) { 
    if (!postId) return null; 
    const apiUrl = baseUrl + '/wp-json/wp/v2/posts/' + postId; 
    try { 
        const res = await fetchSafe(apiUrl, { headers: getMobileHeaders() }, 15000); 
        if (res && res.ok) { 
            const text = await res.text(); 
            try { 
                const json = JSON.parse(text); 
                if (json && json.content && json.content.rendered) { 
                    const rendered = json.content.rendered; 
                    if (!/nexdrive|vcloud|hubcloud|fastdl|genxfm/i.test(rendered)) throw new Error("Missing links"); 
                    return { title: (json.title && json.title.rendered || '').replace(/Download\s*/gi, '').trim(), html: rendered }; 
                } 
            } catch (parseError) {} 
        } 
    } catch (e) {} 
    try { 
        const fallbackUrl = link ? fixUrl(link) : (baseUrl + '/?p=' + postId); 
        const htmlRes = await fetchHtml(fallbackUrl, { headers: getMobileHeaders() }); 
        if (htmlRes) { 
            const contentHtml = htmlRes('.entry-content').html() || htmlRes('.post-content').html(); 
            if (contentHtml) return { title: htmlRes('title').text().replace(/Download\s*/gi, '').trim(), html: contentHtml }; 
        } 
    } catch (e) {} 
    return null; 
} 

function extractNexdriveLinks(contentHtml) { 
    if (!contentHtml) return []; 
    const links = []; 
    const $ = cheerio.load(contentHtml); 
    const seenUrls = new Set(); 
    $('a[href*="nexdrive"], a[href*="genxfm"], a[href*="fastdl"], a[href*="vcloud"], a[href*="hubcloud"]').each((i, el) => { 
        try { 
            const href = $(el).attr('href'); 
            if (!href) return; 
            const linkText = ($(el).text() || '').trim(); 
            if (EXCLUDED_BUTTONS.some(ex => linkText.toLowerCase().includes(ex))) return; 
            if (seenUrls.has(href)) return; 
            seenUrls.add(href); 
            let quality = '1080p'; 
            let fullLabel = linkText || 'Download'; 
            const hrefPos = contentHtml.indexOf(href); 
            if (hrefPos > 0) { 
                const beforeHref = contentHtml.substring(Math.max(0, hrefPos - 3000), hrefPos); 
                const hMatch = beforeHref.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi); 
                if (hMatch && hMatch.length > 0) { 
                    const headerContext = hMatch[hMatch.length - 1].replace(/<[^>]*>/g, '').trim().replace(/Download/ig, ''); 
                    if (headerContext.length > 5) fullLabel = headerContext; 
                } 
                const qualityPattern = /(?:^|>|\s)(\d{3,4}p|4K|UHD|HDR)(?:<|\s|$)/gi; 
                let qMatch; 
                let lastMatch = null; 
                let lastIndex = -1; 
                while ((qMatch = qualityPattern.exec(beforeHref)) !== null) { 
                    if (qMatch.index > lastIndex) { 
                        lastIndex = qMatch.index; 
                        lastMatch = qMatch[1]; 
                    } 
                } 
                if (lastMatch) quality = parseQuality(lastMatch); 
            } 
            if (quality === '480p') return; 
            links.push({ href: fixUrl(href), quality: quality || '1080p', label: fullLabel }); 
        } catch (e) {} 
    }); 
    return links; 
} 

function capLinksForEfficiency(links, maxTotal = 15) { 
    if (!links || links.length <= maxTotal) return links; 
    return links.slice(0, maxTotal); 
} 

function extractSeasonFromContent(contentHtml, targetSeason) { 
    if (!contentHtml || targetSeason == null) return contentHtml; 
    let cleanHtml = contentHtml.split('id="comments"')[0]; 
    const seasonRegex = /(?:Season|Saison|Staffel)\s+0*(\d+)\b/gi; 
    let match; 
    let seasonBlocks = []; 
    while ((match = seasonRegex.exec(cleanHtml)) !== null) { 
        let tagStartH = cleanHtml.lastIndexOf('<h', match.index); 
        let tagStartS = cleanHtml.lastIndexOf('<strong', match.index); 
        let tagStart = Math.max(tagStartH, tagStartS); 
        if (tagStart < 0 || match.index - tagStart > 500) tagStart = match.index; 
        let localContext = cleanHtml.substring(tagStart, match.index + 50); 
        if (localContext.toLowerCase().includes('download') || localContext.toLowerCase().includes('episode')) continue; 
        seasonBlocks.push({ season: parseInt(match[1]), index: tagStart }); 
    } 
    if (seasonBlocks.length === 0) return cleanHtml; 
    let targetBlock = seasonBlocks.find(b => b.season === targetSeason); 
    if (!targetBlock) return cleanHtml; 
    let startPos = targetBlock.index; 
    let nextBlock = seasonBlocks.find(b => b.index > startPos && b.season !== targetSeason); 
    let cutPos = nextBlock ? nextBlock.index : cleanHtml.length; 
    return cleanHtml.substring(startPos, cutPos); 
} 

// ---- Link Extractor Engine ---- 
async function extractSingleVc(vcUrl, referer, targetSeason, targetEpisode, displayLabel, fallbackQuality, mediaInfo, runtimeSec, mediaTitle, mediaYear) { 
    const streams = []; 
    const lower = vcUrl.toLowerCase(); 
    if (lower.includes('vcloud') || lower.includes('hubcloud') || lower.includes('nexdrive') || lower.includes('fastdl')) { 
        const isHub = lower.includes('hubcloud'); 
        const latestBase = isHub ? getLatestHubDomain() : getLatestVcDomain(); 
        const curBase = getOrigin(vcUrl); 
        let newUrl = vcUrl; 
        if (curBase !== latestBase && (vcUrl.includes('vcloud') || vcUrl.includes('hubcloud'))) { 
            newUrl = vcUrl.replace(curBase, latestBase); 
        } 
        const html = await fetchHtml(newUrl, { headers: { ...getMobileHeaders(), 'Referer': referer || baseUrl + '/', 'Cookie': 'xla=s4t' }, redirect: 'manual' }); 
        if (!html) return streams; 
        const rawHtml = html.html(); 
        const pageTitle = html('title').text() || ''; 
        
        if (targetSeason != null || targetEpisode != null) { 
            const seMatch = pageTitle.match(/[.\s_\-](?:S|Season)\s*0*(\d{1,2})[.\s_\-]*(?:E|Ep|Episode)\s*0*(\d{1,2})[.\s_\-]/i); 
            if (seMatch) { 
                if (targetSeason != null && parseInt(seMatch[1]) !== targetSeason) return streams; 
                if (targetEpisode != null && parseInt(seMatch[2]) !== targetEpisode) return streams; 
            } 
        } 
        let bridgeUrl = ''; 
        const varMatch = rawHtml.match(/var\s+url\s*=\s*['"]([^'"]+)['"]/); 
        if (varMatch) bridgeUrl = varMatch[1]; 
        const serverTasks = []; 
        const headerText = html('div.card-header').text() || ''; 
        let extractedQuality = parseQuality(headerText) || fallbackQuality || '1080p'; 

        if (bridgeUrl && bridgeUrl.includes('.workers.dev')) { 
            const synced = bridgeUrl + '?s=' + (1 + new Date().getMinutes()); 
            serverTasks.push(() => { 
                streams.push(makeStream('Worker', (displayLabel || 'Worker Server'), synced, extractedQuality, { 'Referer': newUrl }, mediaInfo, runtimeSec, mediaTitle, mediaYear)); 
            }); 
            bridgeUrl = ''; 
        } 
        html('a.btn, a').each((i, el) => { 
            try { 
                let href = html(el).attr('href') || ''; 
                let text = (html(el).text() || '').trim(); 
                let lowerText = text.toLowerCase(); 
                if (!href || href === '#') return; 
                if (lowerText.includes('10gbps') || lowerText.includes('gdflix') || lowerText.includes('telegram')) return; 
                if (lowerText.includes('fslv2')) { 
                    serverTasks.push(() => { streams.push(makeStream('FSLv2', (displayLabel || text), href, extractedQuality, { 'Referer': newUrl }, mediaInfo, runtimeSec, mediaTitle, mediaYear)); }); 
                } else if (lowerText.includes('fsl') || lowerText.includes('worker')) { 
                    const synced = href.includes('?') ? href + '&s=' + (1 + new Date().getMinutes()) : href + '?s=' + (1 + new Date().getMinutes()); 
                    serverTasks.push(() => { streams.push(makeStream('FSL', (displayLabel || text), synced, extractedQuality, { 'Referer': newUrl }, mediaInfo, runtimeSec, mediaTitle, mediaYear)); }); 
                } 
            } catch (e) {} 
        }); 
        if (serverTasks.length > 0) { 
            serverTasks.forEach(fn => fn()); 
            return streams; 
        } 
        if (!bridgeUrl) { 
            const downloadHref = html('#download').attr('href') || html('a').filter((i, el) => { 
                const href = html(el).attr('href') || ''; 
                return href.includes('hubcloud.php') || href.includes('token') || href.includes('dl'); 
            }).first().attr('href'); 
            if (downloadHref) bridgeUrl = downloadHref.startsWith('http') ? downloadHref : getOrigin(newUrl) + '/' + downloadHref.replace(/^\//, ''); 
        } 
        if (!bridgeUrl) return streams; 
        const bridgeHtml = await fetchHtml(bridgeUrl, { headers: { ...getMobileHeaders(), 'Referer': newUrl, 'Cookie': 'xla=s4t' } }); 
        if (!bridgeHtml) return streams; 
        const bridgeRaw = bridgeHtml.html(); 
        const bridgeHeaderText = bridgeHtml('div.card-header').text() || ''; 
        const bridgeQuality = parseQuality(bridgeHeaderText) || extractedQuality; 
        
        bridgeHtml('a.btn, a').each((i, el) => { 
            try { 
                let href = bridgeHtml(el).attr('href') || ''; 
                let text = (bridgeHtml(el).text() || '').trim(); 
                let lowerText = text.toLowerCase(); 
                if (!href || href === '#') return; 
                if (lowerText.includes('fslv2')) { 
                    serverTasks.push(() => { streams.push(makeStream('FSLv2', (displayLabel || text), href, bridgeQuality, { 'Referer': bridgeUrl }, mediaInfo, runtimeSec, mediaTitle, mediaYear)); }); 
                } else if (lowerText.includes('fsl')) { 
                    const synced = href + '?s=' + (1 + new Date().getMinutes()); 
                    serverTasks.push(() => { streams.push(makeStream('FSL', (displayLabel || text), synced, bridgeQuality, { 'Referer': bridgeUrl }, mediaInfo, runtimeSec, mediaTitle, mediaYear)); }); 
                } 
            } catch (e) {} 
        }); 
        serverTasks.forEach(fn => fn()); 
    } 
    return streams; 
} 

async function loadStreamsFromUrl(url, label, quality, referer, targetSeason, targetEpisode, mediaInfo, runtimeSec, mediaTitle, mediaYear) { 
    const lower = url.toLowerCase(); 
    if (lower.includes('vcloud') || lower.includes('hubcloud')) { 
        return await extractSingleVc(url, referer || url, targetSeason, targetEpisode, label, quality, mediaInfo, runtimeSec, mediaTitle, mediaYear); 
    } 
    if (lower.includes('nexdrive') || lower.includes('genxfm') || lower.includes('fastdl')) { 
        const $ = await fetchHtml(url, { headers: { ...getMobileHeaders(), 'Referer': referer || baseUrl + '/' }, redirect: 'manual' }); 
        if (!$) return []; 
        const streams = []; 
        const tasks = []; 
        $('a[href*="vcloud"], a[href*="hubcloud"]').each((i, el) => { 
            let vhref = $(el).attr('href'); 
            if (vhref) { 
                if (vhref.includes('/api/index.php?link=')) { 
                    tasks.push(async () => { 
                        const $api = await fetchHtml(vhref, { headers: { ...getMobileHeaders(), 'Referer': url }, redirect: 'manual' }); 
                        if (!$api) return []; 
                        let rVhref = $api('a.btn-success, a.btn').attr('href'); 
                        if (rVhref) return await extractSingleVc(fixUrl(rVhref), vhref, targetSeason, targetEpisode, label, quality, mediaInfo, runtimeSec, mediaTitle, mediaYear); 
                        return []; 
                    }); 
                    return; 
                } 
                tasks.push(async () => { return await extractSingleVc(vhref, url, targetSeason, targetEpisode, label, quality, mediaInfo, runtimeSec, mediaTitle, mediaYear); }); 
            } 
        }); 
        if (targetEpisode != null) { 
            const pIdx = targetEpisode - 1; 
            if (pIdx >= 0 && pIdx < tasks.length) { 
                try { 
                    const r = await tasks[pIdx](); 
                    if (Array.isArray(r)) r.forEach(s => { if (s && s.url) streams.push(s); }); 
                } catch(e) {} 
            } 
        } else { 
            for (let i = 0; i < tasks.length; i += 5) { 
                const chunk = tasks.slice(i, i + 5); 
                const results = await Promise.all(chunk.map(fn => fn())); 
                results.forEach(r => { if (Array.isArray(r)) r.forEach(s => streams.push(s)); }); 
            } 
        } 
        return streams; 
    } 
    return []; 
} 

async function extractFromPost(post, label, isTv, targetSeason, targetEpisode, mediaYear, runtimeSec, mediaTitle) { 
    try { 
        let contentHtml = post.html; 
        let seasonLabel = ''; 
        let formattedTitle = mediaTitle;

        if (isTv && targetSeason != null) { 
            const filtered = extractSeasonFromContent(contentHtml, targetSeason); 
            if (filtered) contentHtml = filtered; 
            seasonLabel = ' S' + targetSeason; 
            if (targetEpisode) seasonLabel += 'E' + targetEpisode; 
            formattedTitle = `${mediaTitle} - S${String(targetSeason).padStart(2, '0')}E${String(targetEpisode || 1).padStart(2, '0')}`;
        } 
        const mediaInfo = (seasonLabel.trim() || mediaYear || '').trim(); 
        const links = extractNexdriveLinks(contentHtml); 
        const efficientLinks = capLinksForEfficiency(links); 
        if (efficientLinks.length === 0) return []; 
        const streams = []; 
        const tasks = []; 
        for (const link of efficientLinks) { 
            const quality = link.quality || '1080p'; 
            const displayLabel = link.label || (seasonLabel + ' [' + quality + ']'); 
            tasks.push(() => loadStreamsFromUrl(link.href, displayLabel, quality, baseUrl + '/', targetSeason, targetEpisode, mediaInfo, runtimeSec, formattedTitle, mediaYear)); 
        } 
        const results = await Promise.all(tasks.map(fn => fn())); 
        results.forEach(r => { if (Array.isArray(r)) r.forEach(s => { if (s && s.url) streams.push(s); }); }); 
        return streams; 
    } catch (e) { return []; } 
} 

// ---- Main Entry Handler ---- 
async function getStreams(tmdbId, mediaType, season, episode) { 
    try { 
        await refreshDomains(); 
        const isTv = (mediaType === 'tv' || mediaType === 'series'); 
        const media = await getTMDBInfo(tmdbId, mediaType, season, episode); 
        let imdbId = media.imdbId; 
        let mediaTitle = media.title; 
        let mediaYear = media.year; 
        if ((!imdbId || !imdbId.startsWith('tt')) && String(tmdbId).startsWith('tt')) { imdbId = String(tmdbId); } 
        let searchResults = []; 
        
        if (imdbId && imdbId.startsWith('tt')) { 
            searchResults = await searchByTitle(imdbId, null); 
        } 
        const hasExactImdbMatch = searchResults.some(r => r.imdbId === imdbId); 
        if (searchResults.length === 0 || !hasExactImdbMatch) { 
            let query = mediaTitle; 
            if (isTv && season != null) query += ' season ' + Number(season); 
            else if (mediaYear) query += ' ' + mediaYear; 
            searchResults = await searchByTitle(query, mediaYear); 
            if (searchResults.length === 0 && isTv && season != null) { 
                searchResults = await searchByTitle(mediaTitle, mediaYear); 
            } 
        } 
        if (searchResults.length === 0) return []; 
        let bestMatch = null; 
        const targetImdb = (imdbId && imdbId.startsWith('tt')) ? imdbId : null; 
        for (const r of searchResults) { 
            if (targetImdb && r.imdbId === targetImdb) { 
                if (!isTv || !season) { bestMatch = r; break; } 
                const sMatchRange = /(?:s|season|staffel|saison)\s*0*(\d+)\s*(?:-|–|to|and|&|&#)\s*0*(\d+)\b/i.exec(r.title); 
                let sMatch = false; 
                if (sMatchRange) { 
                    if (parseInt(season) >= parseInt(sMatchRange[1]) && parseInt(season) <= parseInt(sMatchRange[2])) sMatch = true; 
                } 
                if (!sMatch) sMatch = new RegExp('(?:s|season|staffel|saison)\\s*0*' + Number(season) + '\\b', 'i').test(r.title); 
                if (sMatch) { bestMatch = r; break; } 
            } 
            if (!bestMatch) { 
                if (isStrictMatch(mediaTitle, mediaYear, r.title, r.year, media.altTitles)) bestMatch = r; 
            } 
        } 
        if (!bestMatch || !bestMatch.postId) return []; 
        const postData = await fetchPostContent(bestMatch.postId, bestMatch.permalink); 
        if (!postData) return []; 

        const streams = await extractFromPost(postData, postData.title || bestMatch.title, isTv, season != null ? Number(season) : null, episode != null ? Number(episode) : null, mediaYear, media.runtime, mediaTitle); 
        
        const qWeight = { '2160p': 1, '1440p': 2, '1080p': 3, '720p': 4, '480p': 5, 'HD': 6 }; 
        const srcPriority = (name) => { 
            if (/HubCloud|FSLv2/i.test(name)) return 2; 
            if (/Worker/i.test(name)) return 1; 
            return 0; 
        }; 
        return dedupe(streams).sort((a, b) => { 
            const pa = srcPriority(a.name); 
            const pb = srcPriority(b.name); 
            if (pa !== pb) return pb - pa; 
            return (qWeight[a.quality] || 99) - (qWeight[b.quality] || 99); 
        }); 
    } catch (e) { return []; } 
} 

if (typeof module !== 'undefined' && module.exports) { 
    module.exports = { getStreams }; 
} else { 
    global.getStreams = getStreams; 
}
