/**
 * flixstream - Nuvio Provider
 * Sources: VidLink Pro, VidKing Pro, VidSrc, VidSrc Pro, AutoEmbed
 */

var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try { step(generator.next(value)); } catch (e) { reject(e); }
    };
    var rejected = (value) => {
      try { step(generator.throw(value)); } catch (e) { reject(e); }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

var BASE_URL = "https://www.flixstream.ca";

var USER_AGENT = "Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

var BASE_HEADERS = {
  "User-Agent": USER_AGENT,
  "Referer": BASE_URL + "/",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// Resolve each iframe source to a direct stream URL
// Each entry: { name, iframeSrc, referer }
var SOURCES = [
  {
    name: "FlixStream - VidLink",
    buildUrl: function(tmdbId, mediaType, season, episode) {
      if (mediaType === "movie") {
        return "https://vidlink.pro/movie/" + tmdbId;
      }
      return "https://vidlink.pro/tv/" + tmdbId + "/" + season + "/" + episode;
    }
  },
  {
    name: "FlixStream - VidSrc",
    buildUrl: function(tmdbId, mediaType, season, episode) {
      if (mediaType === "movie") {
        return "https://vidsrc.to/embed/movie/" + tmdbId;
      }
      return "https://vidsrc.to/embed/tv/" + tmdbId + "/" + season + "/" + episode;
    }
  },
  {
    name: "FlixStream - VidSrc Pro",
    buildUrl: function(tmdbId, mediaType, season, episode) {
      if (mediaType === "movie") {
        return "https://vidsrc.pro/embed/movie/" + tmdbId;
      }
      return "https://vidsrc.pro/embed/tv/" + tmdbId + "/" + season + "/" + episode;
    }
  },
  {
    name: "FlixStream - AutoEmbed",
    buildUrl: function(tmdbId, mediaType, season, episode) {
      if (mediaType === "movie") {
        return "https://autoembed.co/movie/tmdb/" + tmdbId;
      }
      return "https://autoembed.co/tv/tmdb/" + tmdbId + "-" + season + "-" + episode;
    }
  },
  {
    name: "FlixStream - VidKing",
    buildUrl: function(tmdbId, mediaType, season, episode) {
      if (mediaType === "movie") {
        return "https://vidking.pro/embed/movie?tmdb=" + tmdbId;
      }
      return "https://vidking.pro/embed/tv?tmdb=" + tmdbId + "&season=" + season + "&episode=" + episode;
    }
  }
];

// Fetch the flixstream watch page and extract iframe sources
function fetchIframeSources(tmdbId, mediaType, title, season, episode) {
  return __async(this, null, function* () {
    var watchUrl;
    if (mediaType === "movie") {
      watchUrl = BASE_URL + "/watch/" + tmdbId + "?type=movie&title=" + encodeURIComponent(title);
    } else {
      watchUrl = BASE_URL + "/watch/" + tmdbId + "?type=tv&title=" + encodeURIComponent(title) + "&episode=" + episode;
    }

    console.log("[FlixStream] Fetching watch page: " + watchUrl);

    var resp = yield fetch(watchUrl, { headers: BASE_HEADERS });
    var html = yield resp.text();

    // Extract all iframe src attributes
    var iframes = [];
    var iframeRegex = /<iframe[^>]+src=["']([^"']+)["'][^>]*>/gi;
    var match;
    while ((match = iframeRegex.exec(html)) !== null) {
      var src = match[1];
      // Skip ads and irrelevant iframes
      if (src && (
        src.includes("vidlink") ||
        src.includes("vidsrc") ||
        src.includes("vidking") ||
        src.includes("autoembed") ||
        src.includes("embed")
      )) {
        iframes.push(src);
      }
    }

    // Also extract data-src attributes (lazy loaded iframes)
    var dataSrcRegex = /<iframe[^>]+data-src=["']([^"']+)["'][^>]*>/gi;
    while ((match = dataSrcRegex.exec(html)) !== null) {
      var src = match[1];
      if (src && src.includes("embed")) {
        iframes.push(src);
      }
    }

    // Extract source button data attributes (common pattern for multi-source players)
    var btnRegex = /data-(?:url|src|iframe|source)=["']([^"']*(?:vidlink|vidsrc|vidking|autoembed|embed)[^"']*)["']/gi;
    while ((match = btnRegex.exec(html)) !== null) {
      iframes.push(match[1]);
    }

    // Deduplicate
    return [...new Set(iframes)];
  });
}

// Try to resolve a vidlink iframe to m3u8
function resolveVidLink(iframeSrc) {
  return __async(this, null, function* () {
    try {
      var resp = yield fetch(iframeSrc, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": BASE_URL + "/",
        }
      });
      var html = yield resp.text();

      // Extract m3u8 or mp4 URLs from the page
      var streamRegex = /["'](https?:\/\/[^"']*\.(?:m3u8|mp4)[^"']*)["']/gi;
      var match;
      var streams = [];
      while ((match = streamRegex.exec(html)) !== null) {
        streams.push(match[1]);
      }

      // Also look for jwplayer / hls setup patterns
      var hlsRegex = /file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/gi;
      while ((match = hlsRegex.exec(html)) !== null) {
        streams.push(match[1]);
      }

      return [...new Set(streams)];
    } catch(e) {
      console.error("[FlixStream] resolveVidLink error: " + e.message);
      return [];
    }
  });
}

// Build streams from known embed URLs directly (no scraping needed for these)
function buildEmbedStreams(tmdbId, mediaType, season, episode) {
  return SOURCES.map(function(source) {
    return {
      name: source.name,
      title: source.name,
      url: source.buildUrl(tmdbId, mediaType, season, episode),
      quality: "Unknown",
      headers: {
        "Referer": BASE_URL + "/",
        "User-Agent": USER_AGENT,
      }
    };
  });
}

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    console.log("[FlixStream] Fetching streams for " + mediaType + " " + tmdbId);
    try {
      var streams = [];

      // Step 1: Fetch the watch page and extract iframes
      // We need the title to build the URL — use a placeholder and let the redirect handle it
      var watchUrl;
      if (mediaType === "movie") {
        watchUrl = BASE_URL + "/watch/" + tmdbId + "?type=movie";
      } else {
        watchUrl = BASE_URL + "/watch/" + tmdbId + "?type=tv&episode=" + (episode || 1);
      }

      console.log("[FlixStream] Watch URL: " + watchUrl);

      var resp = yield fetch(watchUrl, { headers: BASE_HEADERS });
      var html = yield resp.text();

      // Extract title from page for reference
      var titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      var pageTitle = titleMatch ? titleMatch[1].replace(/\s*[-|].*$/, "").trim() : "Unknown";

      // Look for iframe sources in HTML
      var iframeSrcs = [];
      var patterns = [
        /src=["'](https?:\/\/(?:vidlink|vidsrc|vidking|autoembed)[^"']+)["']/gi,
        /data-src=["'](https?:\/\/(?:vidlink|vidsrc|vidking|autoembed)[^"']+)["']/gi,
        /data-url=["'](https?:\/\/(?:vidlink|vidsrc|vidking|autoembed)[^"']+)["']/gi,
        /"(?:url|src|iframe)"\s*:\s*"(https?:\/\/(?:vidlink|vidsrc|vidking|autoembed)[^"]+)"/gi,
      ];

      patterns.forEach(function(pattern) {
        var match;
        while ((match = pattern.exec(html)) !== null) {
          iframeSrcs.push(match[1]);
        }
      });

      iframeSrcs = [...new Set(iframeSrcs)];
      console.log("[FlixStream] Found " + iframeSrcs.length + " iframe sources in page");

      // Step 2: If we got iframe srcs from the page, use them
      if (iframeSrcs.length > 0) {
        iframeSrcs.forEach(function(src, i) {
          var sourceName = "FlixStream";
          if (src.includes("vidlink")) sourceName = "FlixStream - VidLink";
          else if (src.includes("vidsrc.pro")) sourceName = "FlixStream - VidSrc Pro";
          else if (src.includes("vidsrc")) sourceName = "FlixStream - VidSrc";
          else if (src.includes("vidking")) sourceName = "FlixStream - VidKing";
          else if (src.includes("autoembed")) sourceName = "FlixStream - AutoEmbed";

          streams.push({
            name: sourceName,
            title: pageTitle,
            url: src,
            quality: "Unknown",
            headers: {
              "Referer": BASE_URL + "/",
              "User-Agent": USER_AGENT,
            }
          });
        });
      } else {
        // Step 3: Fallback — build embed URLs directly using TMDB ID
        console.log("[FlixStream] No iframes found in page, using direct embed URLs");
        streams = buildEmbedStreams(tmdbId, mediaType, season, episode);
      }

      console.log("[FlixStream] Returning " + streams.length + " streams");
      return streams;

    } catch (error) {
      console.error("[FlixStream] Error: " + error.message);
      return [];
    }
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
