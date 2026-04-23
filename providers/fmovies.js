// src/embed69/index.js
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var EMBED_BASE = "https://embed69.org";
var DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 11; BRAVIA 4K Build/RP1A.200720.011) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.50 Safari/537.36"
};

// Helper: Generic fetch wrapper for ES5
function get(url, extraHeaders) {
    var headers = Object.assign({}, DEFAULT_HEADERS, extraHeaders || {});
    return fetch(url, { headers: headers, redirect: "follow" }).then(function(res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        var ct = res.headers.get("content-type") || "";
        if (ct.indexOf("json") !== -1) return res.json();
        return res.text();
    });
}

// Helper: Base64 Decoder (Native fallback)
function b64decode(str) {
    try {
        return atob(str.replace(/-/g, "+").replace(/_/g, "/"));
    } catch (e) {
        return null;
    }
}

// --- RESOLVERS ---

function resolveVoe(embedUrl) {
    return get(embedUrl, { "Referer": embedUrl }).then(function(html) {
        var o = html.match(/'hls'\s*:\s*'([^']+)'/i);
        if (o) {
            var url = o[1].indexOf("aHR0") === 0 ? b64decode(o[1]) : o[1];
            return { url: url, quality: "1080p", headers: { "User-Agent": DEFAULT_HEADERS["User-Agent"], "Referer": embedUrl } };
        }
        return null;
    });
}

function resolveStreamWish(embedUrl) {
    var hostMatch = embedUrl.match(/^(https?:\/\/[^/]+)/);
    var host = hostMatch ? hostMatch[1] : "https://streamwish.to";
    return get(embedUrl, { "Referer": "https://embed69.org/" }).then(function(html) {
        var m = html.match(/file\s*:\s*["']([^"']+)["']/i);
        if (m) {
            return { url: m[1], quality: "1080p", headers: { "User-Agent": DEFAULT_HEADERS["User-Agent"], "Referer": host + "/" } };
        }
        return null;
    });
}

// --- CORE LOGIC ---

function getImdbId(tmdbId, type) {
    var url = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "/external_ids?api_key=" + TMDB_API_KEY;
    return get(url).then(function(data) {
        return data.imdb_id || null;
    });
}

function parseDataLink(html) {
    try {
        var t = html.match(/let\s+dataLink\s*=\s*(\[.+\]);/);
        return t ? JSON.parse(t[1]) : null;
    } catch (e) { return null; }
}

function decodeLink(str) {
    try {
        var parts = str.split(".");
        if (parts.length < 2) return null;
        return JSON.parse(b64decode(parts[1]));
    } catch (e) { return null; }
}

function getStreams(tmdbId, mediaType, season, episode) {
    var type = (mediaType === "series" || mediaType === "tv") ? "tv" : "movie";
    console.log("[Embed69] Start: " + tmdbId + " " + type);

    return getImdbId(tmdbId, type).then(function(imdbId) {
        if (!imdbId) throw new Error("No IMDB ID found");

        var targetUrl = (type === "movie") 
            ? EMBED_BASE + "/f/" + imdbId 
            : EMBED_BASE + "/f/" + imdbId + "-" + season + "x" + (String(episode).length < 2 ? "0" + episode : episode);

        return get(targetUrl, { "Referer": "https://sololatino.net/" });
    }).then(function(html) {
        var dataLinks = parseDataLink(html);
        if (!dataLinks) return [];

        var results = [];
        var languages = ["LAT", "ESP", "SUB"];
        
        // Use a recursive function to resolve embeds sequentially (Better for TV memory)
        function processLanguages(langIdx) {
            if (langIdx >= languages.length || results.length > 0) return Promise.resolve(results);
            
            var langKey = languages[langIdx];
            var category = null;
            for(var i=0; i<dataLinks.length; i++) {
                if(dataLinks[i].video_language === langKey) { category = dataLinks[i]; break; }
            }

            if (!category || !category.sortedEmbeds) return processLanguages(langIdx + 1);

            var embeds = category.sortedEmbeds;
            
            function processEmbed(embedIdx) {
                if (embedIdx >= embeds.length) return processLanguages(langIdx + 1);
                
                var embed = embeds[embedIdx];
                var decoded = decodeLink(embed.link);
                if (!decoded || !decoded.link) return processEmbed(embedIdx + 1);

                var resolver = null;
                var url = decoded.link;
                if (url.indexOf("voe.sx") !== -1) resolver = resolveVoe;
                if (url.indexOf("streamwish") !== -1 || url.indexOf("swish") !== -1) resolver = resolveStreamWish;

                if (resolver) {
                    return resolver(url).then(function(res) {
                        if (res) {
                            var langLabel = langKey === "LAT" ? "Latino" : (langKey === "ESP" ? "Castellano" : "Sub");
                            results.push({
                                name: "Embed69",
                                title: "[" + res.quality + "] " + embed.servername + " (" + langLabel + ")",
                                url: res.url,
                                quality: res.quality,
                                headers: res.headers
                            });
                        }
                        return processEmbed(embedIdx + 1);
                    });
                }
                return processEmbed(embedIdx + 1);
            }

            return processEmbed(0);
        }

        return processLanguages(0);
    }).catch(function(err) {
        console.log("[Embed69] Error: " + err.message);
        return [];
    });
}

// Export for TV app environment
if (typeof module !== "undefined" && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = getStreams;
}
