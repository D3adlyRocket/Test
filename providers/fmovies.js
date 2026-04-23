// src/embed69/index.js
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var EMBED_BASE = "https://embed69.org";
var TV_UA = "Mozilla/5.0 (Linux; Android 10; TV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.50 Safari/537.36";

function get(url, extraHeaders) {
    var headers = { "User-Agent": TV_UA };
    if (extraHeaders) {
        for (var key in extraHeaders) { headers[key] = extraHeaders[key]; }
    }
    // Using standard fetch without "redirect" property for max compatibility
    return fetch(url, { headers: headers }).then(function(res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text().then(function(text) {
            try { return JSON.parse(text); } catch (e) { return text; }
        });
    });
}

function b64decode(str) {
    try {
        var base64 = str.replace(/-/g, "+").replace(/_/g, "/");
        return atob(base64);
    } catch (e) { return null; }
}

function resolveVoe(url) {
    return get(url, { "Referer": url }).then(function(data) {
        var match = data.match(/'hls'\s*:\s*'([^']+)'/i);
        if (match) {
            var finalUrl = (match[1].indexOf("aHR0") === 0) ? b64decode(match[1]) : match[1];
            return { url: finalUrl, quality: "1080p", headers: { "User-Agent": TV_UA, "Referer": url } };
        }
        return null;
    });
}

function resolveStreamWish(url) {
    return get(url, { "Referer": "https://embed69.org/" }).then(function(data) {
        var match = data.match(/file\s*:\s*["']([^"']+)["']/i);
        if (match) {
            return { url: match[1], quality: "1080p", headers: { "User-Agent": TV_UA, "Referer": url } };
        }
        return null;
    });
}

function getStreams(tmdbId, mediaType, season, episode) {
    var type = (mediaType === "series" || mediaType === "tv") ? "tv" : "movie";
    var imdbUrl = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "/external_ids?api_key=" + TMDB_API_KEY;

    return get(imdbUrl).then(function(tmdbData) {
        var imdbId = tmdbData.imdb_id;
        if (!imdbId) return [];

        var target;
        if (type === "movie") {
            target = EMBED_BASE + "/f/" + imdbId;
        } else {
            var ep = String(episode).length < 2 ? "0" + episode : episode;
            target = EMBED_BASE + "/f/" + imdbId + "-" + season + "x" + ep;
        }

        return get(target, { "Referer": "https://sololatino.net/" });
    }).then(function(html) {
        if (typeof html !== "string") return [];
        
        var dataMatch = html.match(/let\s+dataLink\s*=\s*(\[.+\]);/);
        if (!dataMatch) return [];

        var dataLinks = JSON.parse(dataMatch[1]);
        var streams = [];
        
        // Priority: Latino -> Spanish -> Sub
        var langs = ["LAT", "ESP", "SUB"];
        
        // We use a promise chain to avoid "async" keyword while maintaining order
        var sequence = Promise.resolve();

        langs.forEach(function(langKey) {
            sequence = sequence.then(function() {
                // If we already found streams for a higher priority language, skip the rest
                if (streams.length > 0) return;

                var category = null;
                for (var i = 0; i < dataLinks.length; i++) {
                    if (dataLinks[i].video_language === langKey) {
                        category = dataLinks[i];
                        break;
                    }
                }

                if (category && category.sortedEmbeds) {
                    var embedSequence = Promise.resolve();
                    category.sortedEmbeds.forEach(function(embed) {
                        embedSequence = embedSequence.then(function() {
                            var parts = embed.link.split(".");
                            if (parts.length < 2) return;
                            
                            var decoded = JSON.parse(b64decode(parts[1]));
                            var rawUrl = decoded.link;
                            var resolver = null;

                            if (rawUrl.indexOf("voe.sx") !== -1) resolver = resolveVoe;
                            else if (rawUrl.indexOf("streamwish") !== -1 || rawUrl.indexOf("swish") !== -1) resolver = resolveStreamWish;

                            if (resolver) {
                                return resolver(rawUrl).then(function(res) {
                                    if (res) {
                                        streams.push({
                                            name: "Embed69",
                                            title: embed.servername + " [" + langKey + "]",
                                            url: res.url,
                                            quality: res.quality,
                                            headers: res.headers
                                        });
                                    }
                                });
                            }
                        });
                    });
                    return embedSequence;
                }
            });
        });

        return sequence.then(function() { return streams; });
    }).catch(function(err) {
        return [];
    });
}

// Global Export
if (typeof module !== "undefined" && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = getStreams;
}
