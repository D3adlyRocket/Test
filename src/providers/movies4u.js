/**
 * Movies4u - Hardened Android TV Provider
 * Optimized for CloudStream / Android JS Engines
 */

var TMDB_KEY = '1b3113663c9004682ed61086cf967c44';
var MAIN_URL = 'https://new1.movies4u.style';
var M4U_PLAY = 'https://m4uplay.store';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function httpGet(url, referer) {
    return fetch(url, {
        headers: {
            'User-Agent': UA,
            'Referer': referer || MAIN_URL + '/',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,webp,*/*;q=0.8'
        }
    }).then(function(r) { return r.text(); });
}

function getStreams(tmdbId, mediaType, season, episode) {
    return new Promise(function(resolve) {
        // 1. Get Title from TMDB
        var tmdbUrl = 'https://api.themoviedb.org/3/' + (mediaType === 'movie' ? 'movie' : 'tv') + '/' + tmdbId + '?api_key=' + TMDB_KEY;

        fetch(tmdbUrl).then(function(r) { return r.json(); })
            .then(function(data) {
                var title = data.title || data.name;
                // 2. Search the site
                return httpGet(MAIN_URL + '/?s=' + encodeURIComponent(title));
            })
            .then(function(searchHtml) {
                // Find the first valid post link
                var postMatch = searchHtml.match(/href="(https:\/\/new1\.movies4u\.style\/[^"]+)"/);
                if (!postMatch) throw new Error("No results found");
                return httpGet(postMatch[1], MAIN_URL + '/');
            })
            .then(function(pageHtml) {
                // 3. Find M4UPlay Embed Links (usually in buttons or iframes)
                var links = [];
                var re = /href="(https:\/\/m4uplay\.[^"]+)"/g;
                var m;
                while ((m = re.exec(pageHtml)) !== null) {
                    links.push(m[1]);
                }

                if (links.length === 0) throw new Error("No watch links found");
                
                // Try the first link
                return httpGet(links[0], MAIN_URL + '/');
            })
            .then(function(embedHtml) {
                // 4. Advanced Extraction (Looking for hidden m3u8 or packed sources)
                var source = null;
                
                // Look for direct .m3u8 or .txt (m4u uses .txt for playlists sometimes)
                var sourceMatch = embedHtml.match(/file\s*:\s*["']([^"']+\.(?:m3u8|txt)[^"']*)["']/) ||
                                 embedHtml.match(/source\s*:\s*["']([^"']+)["']/) ||
                                 embedHtml.match(/(https?:\/\/[^"']+\.(?:m3u8|txt)(?:\?[^"']*)?)/);

                if (sourceMatch) {
                    source = sourceMatch[1];
                } else if (embedHtml.indexOf('eval(function') !== -1) {
                    // It's packed - look for common patterns inside the pack
                    var packedUrl = embedHtml.match(/["'](https?:\/\/[^"']+\/master[^"']+)["']/);
                    if (packedUrl) source = packedUrl[1];
                }

                if (!source) throw new Error("Source extraction failed");

                // Normalize URL
                if (source.startsWith('/')) source = M4U_PLAY + source;

                resolve([{
                    name: '🎬 Movies4u',
                    title: 'Movies4u • High Quality',
                    url: source,
                    quality: 'Auto',
                    headers: {
                        'User-Agent': UA,
                        'Referer': M4U_PLAY + '/',
                        'Origin': M4U_PLAY
                    }
                }]);
            })
            .catch(function(err) {
                console.log("M4U Error: " + err.message);
                resolve([]);
            });
    });
}

module.exports = { getStreams };
