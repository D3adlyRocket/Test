const cheerio = require('cheerio-without-node-native');

// The function MUST be named getStreams and MUST be exported at the end
async function getStreams(ctx, tmdbId, type, season, episode) {
    const fetcher = ctx.fetcher; 
    const baseUrl = 'https://new2.moviesdrives.my';
    const streams = [];

    try {
        // 1. TMDB Meta Data
        const tmdbRes = await fetcher.get(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=439c478a771f35c05022f9feabcca01c&append_to_response=external_ids`);
        const tmdbData = JSON.parse(tmdbRes.body);
        const query = tmdbData.external_ids?.imdb_id || tmdbData.title || tmdbData.name;

        // 2. Search MoviesDrives (API)
        const searchUrl = `${baseUrl}/searchapi.php?q=${encodeURIComponent(query)}&page=1`;
        const searchRes = await fetcher.get(searchUrl, {
            headers: { 'Referer': baseUrl }
        });
        const searchData = JSON.parse(searchRes.body);

        if (!searchData?.hits?.length) return [];

        // 3. Resolve Movie Page
        const match = searchData.hits[0];
        const pageUrl = match.document.permalink.startsWith('http') 
            ? match.document.permalink 
            : `${baseUrl}${match.document.permalink}`;
        
        const pageRes = await fetcher.get(pageUrl);
        const $ = cheerio.load(pageRes.body);

        // 4. Find Mdrive Archive links
        const archives = [];
        $('a[href*="mdrive.lol/archives"]').each((i, el) => {
            const label = $(el).closest('h5, p').prev().text().trim() || "Download";
            archives.push({
                url: $(el).attr('href'),
                label: label
            });
        });

        // 5. Follow the path: Mdrive -> Hoster -> Direct Link
        for (const archive of archives) {
            try {
                const archiveRes = await fetcher.get(archive.url, {
                    headers: { 'Referer': pageUrl }
                });
                const $$ = cheerio.load(archiveRes.body);

                // Look for HubCloud or GDFlix
                const hosterLinks = $$('a[href*="gdflix"], a[href*="hubcloud"]')
                    .map((i, el) => $$(el).attr('href')).get();

                for (const hUrl of hosterLinks) {
                    const hRes = await fetcher.get(hUrl, { headers: { 'Referer': archive.url } });
                    const $$$ = cheerio.load(hRes.body);

                    if (hUrl.includes('gdflix')) {
                        const direct = $$$('a[href*="busycdn"], a:contains("Instant")').attr('href');
                        if (direct) {
                            streams.push({
                                name: "MoviesDrives (GDFlix)",
                                title: archive.label,
                                url: direct,
                                quality: archive.label.match(/\d{3,4}p/)?.[0] || '1080p'
                            });
                        }
                    } else if (hUrl.includes('hubcloud')) {
                        const server = $$$('a:contains("Download"), a:contains("Server")')
                            .filter((i, el) => !$$$(el).attr('href').includes('hubcloud'))
                            .attr('href');
                        if (server) {
                            streams.push({
                                name: "MoviesDrives (HubCloud)",
                                title: archive.label,
                                url: server,
                                quality: archive.label.match(/\d{3,4}p/)?.[0] || '720p'
                            });
                        }
                    }
                }
            } catch (e) {
                continue; 
            }
        }
    } catch (err) {
        console.error("MoviesDrives Error: ", err.message);
    }

    // Crucial: return the array to Nuvio
    return streams;
}

// THIS IS THE PART NUVIO NEEDS TO RECOGNIZE THE FILE
module.exports = { getStreams };
