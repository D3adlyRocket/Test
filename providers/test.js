const cheerio = require('cheerio-without-node-native');

const MAIN_URL = "https://new2.moviesdrives.my";
const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

/**
 * FIXED GDFlix Resolver (Based on SkyStream)
 * Handles the 'new17.gdflix.net/file' landing pages
 */
async function resolveGDFlix(ctx, url, referer) {
    try {
        const res = await ctx.fetcher.get(url, { headers: { ...HEADERS, Referer: referer } });
        const $ = cheerio.load(res.body);
        
        // SkyStream looks for the "Instant Download" button or a specific 'busycdn' script
        let direct = $('a[href*="busycdn"]').attr('href') || 
                     $('a:contains("Instant")').attr('href');

        // If not found, GDFlix sometimes has a "Generate Link" button
        if (!direct) {
            const genLink = $('a:contains("Download Now")').attr('href');
            if (genLink && genLink !== url) {
                const res2 = await ctx.fetcher.get(genLink, { headers: { ...HEADERS, Referer: url } });
                const $2 = cheerio.load(res2.body);
                direct = $2('a[href*="busycdn"]').attr('href');
            }
        }
        return direct;
    } catch (e) { return null; }
}

/**
 * FIXED HubCloud Resolver (Based on SkyStream)
 * Handles the 'hubcloud.foo/drive' landing pages
 */
async function resolveHubCloud(ctx, url, referer) {
    try {
        const res = await ctx.fetcher.get(url, { headers: { ...HEADERS, Referer: referer } });
        const $ = cheerio.load(res.body);
        
        // SkyStream logic: HubCloud usually has multiple "Download" buttons. 
        // We need the one that points to a file server (fsl, vcloud, etc.)
        const streamUrl = $('a[href]').filter((i, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().toLowerCase();
            return (text.includes('download') || text.includes('server')) && 
                   !href.includes('hubcloud') && !href.includes('cryptonewz');
        }).attr('href');

        return streamUrl;
    } catch (e) { return null; }
}

async function getDownloadLinks(ctx, mediaUrl) {
    const res = await ctx.fetcher.get(mediaUrl, { headers: { ...HEADERS, Referer: MAIN_URL } });
    const $ = cheerio.load(res.body);
    const streams = [];

    // SkyStream logic: Find 'mdrive.lol/archives' links
    const archives = [];
    $('a[href*="mdrive.lol/archives"]').each((i, el) => {
        // Find quality from the nearest heading or the button text itself
        const containerText = $(el).closest('div, h5, p').text() + $(el).prev().text();
        const quality = containerText.match(/\d{3,4}p/i)?.[0] || "720p";
        archives.push({ url: $(el).attr('href'), quality: quality });
    });

    for (const archive of archives) {
        try {
            const mRes = await ctx.fetcher.get(archive.url, { headers: { ...HEADERS, Referer: mediaUrl } });
            const $$ = cheerio.load(mRes.body);

            // Find HubCloud and GDFlix buttons
            const buttons = $$('a[href*="hubcloud"], a[href*="gdflix"]').map((i, el) => $$(el).attr('href')).get();

            for (const bUrl of buttons) {
                let finalUrl = null;
                let server = "MD";

                if (bUrl.includes('gdflix')) {
                    finalUrl = await resolveGDFlix(ctx, bUrl, archive.url);
                    server = "GDFlix";
                } else if (bUrl.includes('hubcloud')) {
                    finalUrl = await resolveHubCloud(ctx, bUrl, archive.url);
                    server = "HubCloud";
                }

                if (finalUrl) {
                    streams.push({
                        name: `MoviesDrive [${server}]`,
                        title: `Quality: ${archive.quality}`,
                        url: finalUrl,
                        quality: archive.quality,
                        headers: { "Referer": bUrl }
                    });
                }
            }
        } catch (e) { continue; }
    }
    return streams;
}

async function getStreams(ctx, tmdbId, type, season, episode) {
    try {
        // 1. TMDB Details
        const tmdbRes = await ctx.fetcher.get(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=439c478a771f35c05022f9feabcca01c&append_to_response=external_ids`);
        const tmdbData = JSON.parse(tmdbRes.body);
        const name = tmdbData.title || tmdbData.name;
        const imdbId = tmdbData.external_ids?.imdb_id;

        // 2. Search using IMDB ID if possible (SkyStream preference)
        const searchUrl = `${MAIN_URL}/searchapi.php?q=${encodeURIComponent(imdbId || name)}&page=1`;
        const sRes = await ctx.fetcher.get(searchUrl, { headers: { "Referer": MAIN_URL } });
        const sJson = JSON.parse(sRes.body);

        if (!sJson?.hits?.length) return [];

        // 3. Score search results (SkyStream logic: check title/year)
        const match = sJson.hits.find(h => {
            const t = h.document.post_title.toLowerCase();
            if (type === 'series' && season) return t.includes(name.toLowerCase()) && t.includes(`season ${season}`);
            return t.includes(name.toLowerCase());
        }) || sJson.hits[0];

        const pageUrl = match.document.permalink.startsWith('http') 
            ? match.document.permalink 
            : `${MAIN_URL}${match.document.permalink}`;

        return await getDownloadLinks(ctx, pageUrl);
    } catch (e) {
        return [];
    }
}

module.exports = { getStreams };
