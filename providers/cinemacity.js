var API_BASE = 'https://betterflix.click/api/admin/get-source';
var HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://betterflix.click/',
    'Origin': 'https://betterflix.click'
};

function decodeUrl(encodedUrl) {
    try {
        return decodeURIComponent(encodedUrl);
    } catch (e) {
        return encodedUrl;
    }
}

function extractVideoUrl(responseUrl) {
    var decoded = decodeUrl(responseUrl);

    var urlMatch = decoded.match(/url=([^&]+)/);
    if (urlMatch && urlMatch[1]) {
        var videoUrl = decodeUrl(urlMatch[1]);
        if (videoUrl.indexOf('http') === 0) {
            return videoUrl;
        }
    }

    if (decoded.indexOf('http') === 0) {
        return decoded;
    }

    if (decoded.indexOf('.m3u8') !== -1 || decoded.indexOf('.mp4') !== -1) {
        return decoded;
    }

    return null;
}

function fetchSource(tmdbId, type, season, episode, source) {
    var params = 'id=' + tmdbId + '&type=' + type + '&season=' + (season || 1) + '&episode=' + (episode || 1) + '&source=' + source + '&lang=pt';
    var url = API_BASE + '?' + params;

    return fetch(url, { headers: HEADERS })
        .then(function(response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        })
        .then(function(data) {
            if (data.url) {
                var videoUrl = extractVideoUrl(data.url);
                if (videoUrl) {
                    return {
                        name: 'BetterFlix',
                        title: source.toUpperCase(),
                        url: videoUrl,
                        quality: 'HD',
                        headers: {
                            'User-Agent': HEADERS['User-Agent'],
                            'Referer': 'https://betterflix.click/',
                            'Origin': 'https://betterflix.click'
                        }
                    };
                }
            }
            return null;
        })
        .catch(function(e) {
            console.log('[Hypeflix BR] ' + source + ' error: ' + e.message);
            return null;
        });
}

function getStreams(tmdbId, mediaType, season, episode) {
    console.log('[Hypeflix BR] Getting streams for ' + mediaType + ' ' + tmdbId);

    var type = mediaType === 'movie' ? 'movie' : 'tv';
    var sources = ['source2', 'source3', 'source4', 'source5'];
    var promises = [];

    for (var i = 0; i < sources.length; i++) {
        promises.push(fetchSource(tmdbId, type, season, episode, sources[i]));
    }

    return Promise.all(promises).then(function(results) {
        var streams = [];
        for (var i = 0; i < results.length; i++) {
            if (results[i]) {
                streams.push(results[i]);
            }
        }
        console.log('[Hypeflix BR] Found ' + streams.length + ' streams');
        return streams;
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = getStreams;
}
