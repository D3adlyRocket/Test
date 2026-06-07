// ================= XDmovies =================
const cheerio = require('cheerio-without-node-native');

const XDMOVIES_API = "https://top.xdmovies.wtf";

// TMDB API Configuration
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const XDMOVIES_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
    "Referer": `${XDMOVIES_API}/`,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8"
};

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
    "Referer": `${XDMOVIES_API}/`,
};

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return 'Unknown';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function cleanTitle(title) {
    if (!title) return '';
    const parts = title.split(/[.\-_]/);
    const qualityTags = ["WEBRip", "WEB-DL", "WEB", "BluRay", "HDRip", "DVDRip", "HDTV", "CAM", "TS", "R5", "DVDScr", "BRRip", "BDRip", "DVD", "PDTV", "HD"];
    const audioTags = ["AAC", "AC3", "DTS", "MP3", "FLAC", "DD5", "EAC3", "Atmos"];
    const subTags = ["ESub", "ESubs", "Subs", "MultiSub", "NoSub", "EnglishSub", "HindiSub"];
    const codecTags = ["x264", "x265", "H264", "HEVC", "AVC"];

    const startIndex = parts.findIndex(part => qualityTags.some(tag => part.toLowerCase().includes(tag.toLowerCase())));
    const endIndex = parts.findLastIndex(part => 
        subTags.some(tag => part.toLowerCase().includes(tag.toLowerCase())) ||
        audioTags.some(tag => part.toLowerCase().includes(tag.toLowerCase())) ||
        codecTags.some(tag => part.toLowerCase().includes(tag.toLowerCase()))
    );

    if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
        return parts.slice(startIndex, endIndex + 1).join(".");
    } else if (startIndex !== -1) {
        return parts.slice(startIndex).join(".");
    } else {
        return parts.slice(-3).join(".");
    }
}

function extractServerName(source) {
    if (!source) return 'Unknown';
    const src = source.trim();
    if (/HubCloud/i.test(src)) {
        if (/FSL/i.test(src)) return 'HubCloud FSL Server';
        if (/FSL V2/i.test(src)) return 'HubCloud FSL V2 Server';
        if (/S3/i.test(src)) return 'HubCloud S3 Server';
        if (/Buzz/i.test(src)) return 'HubCloud BuzzServer';
        if (/10\s*Gbps/i.test(src)) return 'HubCloud 10Gbps';
        return 'HubCloud';
    }
    if (/Pixeldrain/i.test(src)) return 'Pixeldrain';
    if (/StreamTape/i.test(src)) return 'StreamTape';
    if (/HubCdn/i.test(src)) return 'HubCdn';
    if (/HbLinks/i.test(src)) return 'HbLinks';
    if (/Hubstream/i.test(src)) return 'Hubstream';
    return src.replace(/^www\./i, '').split(/[.\s]/)[0];
}

function pixelDrainExtractor(link, quality) {
    return Promise.resolve().then(() => {
        let fileId;
        const match = link.match(/(?:file|u)\/([A-Za-z0-9]+)/);
        if (match) fileId = match[1];
        else fileId = link.split('/').pop();
        
        if (!fileId) return [{ source: 'Pixeldrain', quality: 'Unknown', url: link }];

        const infoUrl = `https://pixeldrain.com/api/file/${fileId}/info`;
        return fetch(infoUrl, { headers: HEADERS })
            .then(res => res.json())
            .then(info => {
                let inferredQuality = 'Unknown';
                let name = '';
                let size = 0;
                if (info && info.name) {
                    name = info.name;
                    size = info.size || 0;
                    const qualityMatch = info.name.match(/(\d{3,4})p/);
                    if (qualityMatch) inferredQuality = qualityMatch[0];
                }
                return [{
                    source: 'Pixeldrain',
                    quality: quality ? quality : inferredQuality,
                    url: `https://pixeldrain.com/api/file/${fileId}?download`,
                    name: name,
                    size: size,
                }];
            })
            .catch(() => [{ source: 'Pixeldrain', quality: 'Unknown', url: `https://pixeldrain.com/api/file/${fileId}?download` }]);
    });
}

function streamTapeExtractor(link) {
    try {
        const url = new URL(link);
        url.hostname = 'streamtape.com';
        return fetch(url.toString(), { headers: HEADERS })
            .then(res => res.text())
            .then(data => {
                const match = data.match(/document\.getElementById\('videolink'\)\.innerHTML = (.*?);/);
                if (match && match[1]) {
                    const urlPartMatch = match[1].match(/'(\/\/streamtape\.com\/get_video[^']+)'/);
                    if (urlPartMatch && urlPartMatch[1]) return [{ source: 'StreamTape', quality: 'Stream', url: 'https:' + urlPartMatch[1] }];
                }
                const simpleMatch = data.match(/'(\/\/streamtape\.com\/get_video[^']+)'/);
                if (simpleMatch && simpleMatch[0]) return [{ source: 'StreamTape', quality: 'Stream', url: 'https:' + simpleMatch[0].slice(1, -1) }];
                return [];
            }).catch(() => []);
    } catch (_) { return Promise.resolve([]); }
}

function hubStreamExtractor(url, referer) {
    return Promise.resolve([{ source: 'Hubstream', quality: 'Unknown', url }]);
}

function hbLinksExtractor(url, referer) {
    return fetch(url, { headers: { ...HEADERS, Referer: referer } })
        .then(res => res.text())
        .then(data => {
            const $ = cheerio.load(data);
            const links = $('h3 a, div.entry-content p a').map((i, el) => $(el).attr('href')).get();
            return Promise.all(links.map(link => loadExtractor(link, url))).then(results => results.flat());
        }).catch(() => []);
}

function hubCdnExtractor(url, referer) {
    return Promise.resolve([]);
}

function hubDriveExtractor(url, referer) {
    return fetch(url, { headers: { ...HEADERS, Referer: referer } })
        .then(res => res.text())
        .then(data => {
            const $ = cheerio.load(data);
            const href = $('.btn.btn-primary.btn-user.btn-success1.m-1').attr('href');
            return href ? loadExtractor(href, url) : [];
        }).catch(() => []);
}

function hubCloudExtractor(url, referer) {
    let currentUrl = url;
    if (currentUrl.includes("hubcloud.ink")) currentUrl = currentUrl.replace("hubcloud.ink", "hubcloud.dad");

    if (/\/(video|drive)\//i.test(currentUrl)) {
        return fetch(currentUrl, { headers: { ...HEADERS, Referer: referer } })
            .then(r => r.text())
            .then(html => {
                const $ = cheerio.load(html);
                const hubPhp = $('a[href*="hubcloud.php"]').attr('href');
                return hubPhp ? hubCloudExtractor(hubPhp, currentUrl) : [];
            }).catch(() => []);
    }

    const initialFetch = currentUrl.includes("hubcloud.php")
        ? fetch(currentUrl, { headers: { ...HEADERS, Referer: referer } }).then(res => res.text().then(html => ({ pageData: html, finalUrl: currentUrl })))
        : fetch(currentUrl, { headers: { ...HEADERS, Referer: referer } }).then(r => r.text()).then(pageData => {
            let finalUrl = currentUrl;
            const scriptUrlMatch = pageData.match(/var url = '([^']*)'/);
            if (scriptUrlMatch && scriptUrlMatch[1]) {
                finalUrl = scriptUrlMatch[1];
                return fetch(finalUrl, { headers: { ...HEADERS, Referer: currentUrl } }).then(r => r.text()).then(secondData => ({ pageData: secondData, finalUrl }));
            }
            return { pageData, finalUrl };
        });

    return initialFetch.then(({ pageData, finalUrl }) => {
        const $ = cheerio.load(pageData);
        const size = $('i#size').text().trim();
        const header = $('div.card-header').text().trim();
        
        const getIndexQuality = (str) => {
            const match = (str || '').match(/(\d{3,4})[pP]/);
            return match ? parseInt(match[1]) : 1080;
        };

        const quality = getIndexQuality(header);
        const headerDetails = cleanTitle(header);
        let labelExtras = headerDetails ? `[${headerDetails}]` : '';
        if (size) labelExtras += `[${size}]`;

        const sizeInBytes = (() => {
            if (!size) return 0;
            const m = size.match(/([\d.]+)\s*(GB|MB|KB)/i);
            if (!m) return 0;
            const v = parseFloat(m[1]);
            if (m[2].toUpperCase() === 'GB') return v * 1024 ** 3;
            if (m[2].toUpperCase() === 'MB') return v * 1024 ** 2;
            return v * 1024;
        })();

        const links = [];
        const elements = $('a.btn[href]').get();

        const processElements = elements.map(el => {
            const link = $(el).attr('href');
            const text = $(el).text();
            if (/telegram/i.test(text) || /telegram/i.test(link)) return Promise.resolve();

            const fileName = header || headerDetails || 'Unknown';

            if (text.includes("Download File") || text.includes("FSL V2") || text.includes("FSL") || text.includes("S3 Server")) {
                links.push({ source: `HubCloud ${labelExtras}`, quality, url: link, size: sizeInBytes, fileName });
                return Promise.resolve();
            }

            if (link.includes("pixeldra")) {
                return pixelDrainExtractor(link, quality).then(ext => {
                    links.push(...ext.map(l => ({ ...l, quality: typeof l.quality === 'number' ? l.quality : quality, size: l.size || sizeInBytes, fileName })));
                }).catch(() => {});
            }
            return loadExtractor(link, finalUrl).then(r => { links.push(...r); });
        });

        return Promise.all(processElements).then(() => links);
    }).catch(() => []);
}

function loadExtractor(url, referer) {
    if (!url) return Promise.resolve([]);
    try {
        const hostname = new URL(url).hostname;
        const ref = referer || XDMOVIES_API;

        if (hostname.includes('hubcloud')) return hubCloudExtractor(url, ref);
        if (hostname.includes('hubdrive')) return hubDriveExtractor(url, ref);
        if (hostname.includes('hubcdn')) return Promise.resolve([]);
        if (hostname.includes('hblinks')) return hbLinksExtractor(url, ref);
        if (hostname.includes('hubstream')) return hubStreamExtractor(url, ref);
        if (hostname.includes('pixeldrain')) return pixelDrainExtractor(url);
        if (hostname.includes('streamtape')) return streamTapeExtractor(url);
        
        if (hostname.includes('linkrit') || hostname.includes('google.') || hostname.includes('gstatic.')) return Promise.resolve([]);

        const sourceName = hostname.replace(/^www\./, '');
        return Promise.resolve([{ source: sourceName, quality: 'Unknown', url }]);
    } catch (_) {
        return Promise.resolve([]);
    }
}

function getTMDBDetails(tmdbId, mediaType) {
    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;

    return fetch(url, { method: 'GET', headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
            if (!data) return null;
            return {
                title: mediaType === 'tv' ? data.name : data.title,
                year: (mediaType === 'tv' ? data.first_air_date : data.release_date)?.split('-')[0] || null
            };
        }).catch(() => null);
}

function extractCodec(text) {
    const m = (text || '').match(/x264|x265|h\.?264|hevc/i);
    return m ? m[0].toUpperCase() : '';
}

function getStreams(tmdbId, mediaType = 'movie', season = null, episode = null) {
    return getTMDBDetails(tmdbId, mediaType)
        .then(mediaInfo => {
            if (!mediaInfo?.title) return [];

            // CHANGED: Querying the main search HTML page instead of the broken search_api.php backend endpoint
            return fetch(`${XDMOVIES_API}/search.html?q=${encodeURIComponent(mediaInfo.title)}`, { headers: XDMOVIES_HEADERS })
                .then(r => r.ok ? r.text() : '')
                .then(html => {
                    if (!html) return [];
                    const $ = cheerio.load(html);
                    let matchedPath = null;

                    // Scrape movie cards dynamically from search results page
                    $('div.movie-grid a.movie-card').each((_, el) => {
                        const href = $(el).attr('href');
                        const cardTitle = $(el).find('.movie-title').text() || '';
                        
                        // String matching validation check
                        if (href && cardTitle.toLowerCase().includes(mediaInfo.title.toLowerCase())) {
                            matchedPath = href;
                        }
                    });

                    if (!matchedPath) return [];

                    return fetch(XDMOVIES_API + matchedPath, { headers: XDMOVIES_HEADERS })
                        .then(r => r.ok ? r.text() : '')
                        .then(htmlPage => {
                            if (!htmlPage) return [];
                            const $page = cheerio.load(htmlPage);
                            const collectedUrls = [];

                            const resolveRedirect = (url) => 
                                fetch(url, { headers: XDMOVIES_HEADERS, method: 'HEAD' })
                                    .then(res => res.url || url)
                                    .catch(() => url);

                            if (!season) {
                                const rawLinks = $page('div.download-item a[href]').map((_, a) => $page(a).attr('href')).get();
                                return Promise.all(rawLinks.map(raw => resolveRedirect(raw).then(u => { if (u) collectedUrls.push(u); }))).then(() => collectedUrls);
                            }

                            const epRegex = new RegExp(`S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`, 'i');
                            const jobs = [];

                            $page('div.episode-card').each((_, card) => {
                                const $card = $page(card);
                                if (!epRegex.test($card.find('.episode-title').text() || '')) return;

                                $card.find('a[href]').each((_, a) => {
                                    const raw = $page(a).attr('href');
                                    if (raw) jobs.push(resolveRedirect(raw).then(u => { if (u) collectedUrls.push(u); }));
                                });
                            });

                            return Promise.all(jobs).then(() => collectedUrls);
                        })
                        .then(collectedUrls => {
                            if (!collectedUrls.length) return [];

                            return Promise.all(collectedUrls.map(url => loadExtractor(url, XDMOVIES_API).catch(() => [])))
                                .then(results => {
                                    const flat = results.flat();
                                    const seen = new Set();

                                    return flat.filter(link => link && link.url && !seen.has(link.url) && seen.add(link.url)).map(link => {
                                        let title = mediaInfo.title;
                                        if (mediaType === 'tv') title += ` S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
                                        else if (mediaInfo.year) title += ` (${mediaInfo.year})`;

                                        let quality = 'Unknown';
                                        if (link.quality >= 2160) quality = '2160p';
                                        else if (link.quality >= 1080) quality = '1080p';
                                        else if (link.quality >= 720) quality = '720p';

                                        return {
                                            name: `XDmovies ${extractServerName(link.source)}`,
                                            title,
                                            url: link.url,
                                            quality,
                                            size: formatBytes(link.size),
                                            provider: 'XDmovies',
                                            behaviorHints: { notWebReady: true, proxyHeaders: { request: Object.assign({}, HEADERS) } }
                                        };
                                    });
                                });
                        });
                });
        })
        .catch(() => []);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = { getStreams };
}
