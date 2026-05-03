const cheerio = require('cheerio-without-node-native');

const MAIN_URL = "https://new2.moviesdrives.my";
const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

// --- Extractors based on Cloudstream Kotlin logic ---

async function resolveHubCloud(ctx, url, referer) {
    try {
        // Cloudstream logic: Visit /drive/ or /vfile/ page
        const res = await ctx.fetcher.get(url, { headers: { ...HEADERS, Referer: referer } });
        const $ = cheerio.load(res.body);
        
        // Find the "Download" or "Stream" button that isn't a redirect
        const streamUrl = $('a.btn-success, a.btn-primary, a:contains("Download")')
            .filter((i, el) => {
                const href = $(el).attr('href') || '';
                return !href.includes('hubcloud') && !href.includes('cryptonewz');
            }).attr('href');

        return streamUrl ? [{ name: "HubCloud", url: streamUrl }] : [];
    } catch (e) { return []; }
}

async function resolveGDFlix(ctx, url, referer) {
    try {
        // Cloudstream logic: Visit the /file/ landing page
        const res = await ctx.fetcher.get(url, { headers: { ...HEADERS, Referer: referer } });
        const $ = cheerio.load(res.body);
        
        // Look for the "Instant Download" button or the link to busycdn/pixeldrain
        const directLink = $('a[href*="busycdn"], a[href*="pixeldrain"], a:contains("Instant")').attr('href');
        
        if (directLink) {
            return [{ name: "GDFlix", url: directLink }];
        }
        
        // If not found, look for a "Generate Link" script or button
        const generate = $('a:contains("Download Now")').attr('href');
        if (generate && generate !== url) return await resolveGDFlix(ctx, generate, url);
        
    } catch (e) { return []; }
    return [];
}

// --- Main Scraper Flow ---

async function getDownloadLinks(ctx, mediaUrl) {
    const res = await ctx.fetcher.get(mediaUrl, { headers: { ...HEADERS, Referer: MAIN_URL } });
    const $ = cheerio.load(res.body);
    const finalStreams = [];

    // 1. Get all mdrive.lol archives
    const archives = [];
    $('a[href*="mdrive.lol/archives"]').each((i, el) => {
        const parentText = $(el).closest('h5, p').text() || "";
        const qualityMatch = parentText.match(/\d{3,4}p/i);
        archives.push({
            url: $(el).attr('href'),
            quality: qualityMatch ? qualityMatch[0] : '720p'
        });
    });

    for (const archive of archives) {
        try {
            // 2. Fetch the mdrive intermediate page
            const archiveRes = await ctx.fetcher.get(archive.url, { headers: { ...HEADERS, Referer: mediaUrl } });
            const $$ = cheerio.load(archiveRes.body);

            // 3. Find HubCloud (hubcloud.foo/drive) and GDFlix (gdflix.net/file)
            const links = $$('a[href*="hubcloud"], a[href*="gdflix"]').map((i, el) => $$(el).attr('href')).get();

            for (const link of links) {
                let resolved = [];
                if (link.includes('hubcloud')) {
                    resolved = await resolveHubCloud(ctx, link, archive.url);
                } else if (link.includes('gdflix')) {
                    resolved = await resolveGDFlix(ctx, link, archive.url);
                }

                resolved.forEach(s => {
                    finalStreams.push({
                        name: `MoviesDrive [${s.name}]`,
                        title: `Quality: ${archive.quality}`,
                        url: s.url,
                        quality: archive.quality,
                        headers: { "Referer": link }
                    });
                });
            }
        } catch (e) { continue; }
    }
    return finalStreams;
}

// --- Nuvio getStreams ---

async function getStreams(ctx, tmdbId, type) {
    try {
        // Use TMDB API to get the name/IMDB ID
        const tmdbRes = await ctx.fetcher.get(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=439c478a771f35c05022f9feabcca01c&append_to_response=external_ids`);
        const tmdbData = JSON.parse(tmdbRes.body);
        const query = tmdbData.external_ids?.imdb_id || tmdbData.title || tmdbData.name;

        // Search API
        const searchUrl = `${MAIN_URL}/searchapi.php?q=${encodeURIComponent(query)}&page=1`;
        const sRes = await ctx.fetcher.get(searchUrl, { headers: { "Referer": MAIN_URL } });
        const sJson = JSON.parse(sRes.body);

        if (!sJson?.hits?.length) return [];

        const match = sJson.hits[0];
        const pageUrl = match.document.permalink.startsWith('http') 
            ? match.document.permalink 
            : `${MAIN_URL}${match.document.permalink}`;

        return await getDownloadLinks(ctx, pageUrl);
    } catch (e) {
        return [];
    }
}

module.exports = { getStreams };
