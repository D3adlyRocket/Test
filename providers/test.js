const cheerio = require('cheerio-without-node-native');

// Keeping your original configuration
const MAIN_URL = "https://new2.moviesdrives.my";
const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Referer": `${MAIN_URL}/`,
};

// Keeping your original utility
function formatBytes(bytes) {
    if (!bytes) return 'N/A';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + ['B', 'KB', 'MB', 'GB', 'TB'][i];
}

// Fixed Extractor: Uses Nuvio fetcher and finds the direct BusyCDN link
async function gdFlixExtractor(ctx, url, referer, label) {
    try {
        const res = await ctx.fetcher.get(url, { headers: { ...HEADERS, Referer: referer } });
        const $ = cheerio.load(res.body);
        const directLink = $('a[href*="busycdn"], a:contains("Instant")').attr('href');
        return directLink ? [{
            name: "MoviesDrives (GDFlix)",
            title: label,
            url: directLink,
            quality: label.match(/\d{3,4}p/)?.[0] || '1080p'
        }] : [];
    } catch (e) { return []; }
}

async function hubCloudExtractor(ctx, url, referer, label) {
    try {
        const res = await ctx.fetcher.get(url, { headers: { ...HEADERS, Referer: referer } });
        const $ = cheerio.load(res.body);
        const serverLink = $('a:contains("Download"), a:contains("Server")')
            .filter((i, el) => !$(el).attr('href').includes('hubcloud'))
            .attr('href');
        return serverLink ? [{
            name: "MoviesDrives (HubCloud)",
            title: label,
            url: serverLink,
            quality: label.match(/\d{3,4}p/)?.[0] || '720p'
        }] : [];
    } catch (e) { return []; }
}

// THE FIX: This replaces the old "find links on page" logic
async function getDownloadLinks(ctx, mediaUrl) {
    const res = await ctx.fetcher.get(mediaUrl, { headers: HEADERS });
    const $ = cheerio.load(res.body);
    const finalLinks = [];

    // Step A: Find all the 'Download Now' buttons (which are now mdrive.lol links)
    const archives = [];
    $('a[href*="mdrive.lol/archives"]').each((i, el) => {
        // Find the quality text (usually in the heading above the button)
        const label = $(el).closest('h5, p').prev().text().trim() || "Download";
        archives.push({ url: $(el).attr('href'), label: label });
    });

    // Step B: Visit each mdrive page to get the actual hosters
    for (const archive of archives) {
        try {
            const archiveRes = await ctx.fetcher.get(archive.url, { headers: { ...HEADERS, Referer: mediaUrl } });
            const $$ = cheerio.load(archiveRes.body);

            // Look for the GDFlix/HubCloud buttons on the mdrive page
            const hosterUrls = $$('a[href*="gdflix"], a[href*="hubcloud"]')
                .map((i, el) => $$(el).attr('href')).get();

            for (const hUrl of hosterUrls) {
                if (hUrl.includes('gdflix')) {
                    const links = await gdFlixExtractor(ctx, hUrl, archive.url, archive.label);
                    finalLinks.push(...links);
                } else if (hUrl.includes('hubcloud')) {
                    const links = await hubCloudExtractor(ctx, hUrl, archive.url, archive.label);
                    finalLinks.push(...links);
                }
            }
        } catch (e) { continue; }
    }
    return finalLinks;
}

// Entry point: Stays mostly the same, but uses JSON.parse for Nuvio compatibility
async function getStreams(ctx, tmdbId, type) {
    try {
        const tmdbRes = await ctx.fetcher.get(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=439c478a771f35c05022f9feabcca01c&append_to_response=external_ids`);
        const tmdbData = JSON.parse(tmdbRes.body);
        const query = tmdbData.external_ids?.imdb_id || tmdbData.title || tmdbData.name;

        const searchUrl = `${MAIN_URL}/searchapi.php?q=${encodeURIComponent(query)}&page=1`;
        const sRes = await ctx.fetcher.get(searchUrl, { headers: HEADERS });
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
