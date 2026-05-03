const cheerio = require('cheerio-without-node-native');

const MoviesDrives = {
    baseUrl: "https://new2.moviesdrives.my",

    /**
     * NUVIO ENTRY POINT
     */
    getStreams: async function (ctx, tmdbId, type, season, episode) {
        const fetcher = ctx.fetcher;
        const streams = [];

        try {
            // 1. Get IMDB ID (MoviesDrive search works 100x better with tt ID)
            const tmdbRes = await fetcher.get(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=439c478a771f35c05022f9feabcca01c&append_to_response=external_ids`);
            const tmdbData = JSON.parse(tmdbRes.body);
            const imdbId = tmdbData.external_ids?.imdb_id;
            const title = tmdbData.title || tmdbData.name;

            // 2. SEARCH API (Mirroring Skystream/Cloudstream)
            // Use IMDB ID if available, otherwise title
            const searchUrl = `${this.baseUrl}/searchapi.php?q=${encodeURIComponent(imdbId || title)}&page=1`;
            const searchRes = await fetcher.get(searchUrl, {
                headers: { 'Referer': this.baseUrl, 'X-Requested-With': 'XMLHttpRequest' }
            });
            
            const searchData = JSON.parse(searchRes.body);
            if (!searchData?.hits?.length) return [];

            // 3. FIND MATCHING POST
            const match = searchData.hits.find(h => {
                const postTitle = h.document.post_title.toLowerCase();
                if (type === 'series' && season) {
                    return postTitle.includes(`season ${season}`) || postTitle.includes(`s${season.toString().padStart(2, '0')}`);
                }
                return true;
            }) || searchData.hits[0];

            const pageUrl = match.document.permalink.startsWith('http') 
                ? match.document.permalink 
                : `${this.baseUrl}${match.document.permalink}`;

            // 4. SCRAPE MOVIE PAGE FOR MDRIVE ARCHIVES
            const pageRes = await fetcher.get(pageUrl);
            const $ = cheerio.load(pageRes.body);

            const archives = [];
            $('a[href*="mdrive.lol/archives"]').each((i, el) => {
                const href = $(el).attr('href');
                // Get quality from the text inside the button or the parent <h5>
                const label = $(el).text() + " " + $(el).closest('h5, p').text();
                const quality = label.match(/\d{3,4}p/i)?.[0] || "720p";
                archives.push({ url: href, quality });
            });

            // 5. RESOLVE MDRIVE -> HOSTER -> DIRECT LINK
            for (const archive of archives) {
                try {
                    const archiveRes = await fetcher.get(archive.url, { headers: { 'Referer': pageUrl } });
                    const $$ = cheerio.load(archiveRes.body);

                    // Find HubCloud (hubcloud.foo/drive) and GDFlix (gdflix.net/file) links
                    const hosterLinks = $$('a[href*="hubcloud"], a[href*="gdflix"]').map((i, el) => $$(el).attr('href')).get();

                    for (const hUrl of hosterLinks) {
                        const stream = await this.resolveHoster(ctx, hUrl, archive.url, archive.quality);
                        if (stream) streams.push(stream);
                    }
                } catch (e) { continue; }
            }
        } catch (err) {
            console.error("MoviesDrive Error: ", err);
        }

        return streams;
    },

    /**
     * RESOLVER FOR HUBCLOUD / GDFLIX
     */
    resolveHoster: async function (ctx, url, referer, quality) {
        try {
            const res = await ctx.fetcher.get(url, { headers: { 'Referer': referer } });
            const $ = cheerio.load(res.body);

            // CASE 1: GDFlix (new17.gdflix.net/file/...)
            if (url.includes('gdflix')) {
                // Look for "Instant Download" or BusyCDN
                let direct = $('a[href*="busycdn"]').attr('href') || $('a:contains("Instant")').attr('href');
                
                // If not there, click the "Download Now" button to get to the final page
                if (!direct) {
                    const next = $('a:contains("Download Now")').attr('href');
                    if (next && next !== url) {
                        const res2 = await ctx.fetcher.get(next, { headers: { 'Referer': url } });
                        const $2 = cheerio.load(res2.body);
                        direct = $2('a[href*="busycdn"]').attr('href');
                    }
                }
                
                if (direct) return { name: "MoviesDrive (GDFlix)", url: direct, quality };
            }

            // CASE 2: HubCloud (hubcloud.foo/drive/...)
            if (url.includes('hubcloud')) {
                // Find the button that isn't a redirect/ad
                const direct = $('a[href]').filter((i, el) => {
                    const href = $(el).attr('href') || "";
                    const text = $(el).text().toLowerCase();
                    return (text.includes('download') || text.includes('server')) && 
                           !href.includes('hubcloud') && !href.includes('cryptonewz');
                }).attr('href');

                if (direct) return { name: "MoviesDrive (HubCloud)", url: direct, quality };
            }
        } catch (e) { return null; }
        return null;
    }
};

module.exports = MoviesDrives;
