
// providers/jellyfin.js
// Jellyfin Personal Provider - kompatibel dengan index.js
// Hermes JS Compatible (no async/await, no modern array methods)
// v1.6.0 - Fallback by title with year filter

var SERVER = "https://spread.thepebbles.tech";
var TOKEN = "5a5d5c9c400a48a098554ffcc7524e06";
var USER_ID = "684edc4317c4491095c3a7c37587c7c4";

// ─── Core Fetch ─────────────────────────────────────────────────────────────
function _get(path) {
  var sep = path.indexOf("?") >= 0 ? "&" : "?";
  var url = SERVER + path + sep + "api_key=" + TOKEN;
  console.log("[JELLYFIN] Fetch URL: " + url);
  return fetch(url, {
    headers: {
      "X-Emby-Token": TOKEN,
      "Accept": "application/json"
    }
  }).then(function(r) {
    if (!r.ok) throw new Error("HTTP " + r.status + " — " + url);
    return r.json();
  });
}

// ─── Helper: Cek kecocokan ProviderIds ──────────────────────────────────────
function _itemMatchesProviderId(item, id) {
  if (!item.ProviderIds) return false;
  var keys = Object.keys(item.ProviderIds);
  for (var i = 0; i < keys.length; i++) {
    if (item.ProviderIds[keys[i]] === id) {
      console.log("[JELLYFIN] Provider match: " + keys[i] + " = " + id + " for item " + item.Name);
      return true;
    }
  }
  return false;
}

function _filterItemsById(items, id) {
  var matched = [];
  for (var i = 0; i < items.length; i++) {
    if (_itemMatchesProviderId(items[i], id)) matched.push(items[i]);
  }
  console.log("[JELLYFIN] Filtered " + items.length + " items, found " + matched.length + " matching ID " + id);
  return matched;
}

// ─── Filter by title & year ─────────────────────────────────────────────────
function _filterItemsByTitleAndYear(items, title, year) {
  if (!title) return [];
  var lowerTitle = title.toLowerCase();
  var candidates = [];

  // Tahap 1: cocokkan judul
  for (var i = 0; i < items.length; i++) {
    if (items[i].Name && items[i].Name.toLowerCase() === lowerTitle) {
      candidates.push(items[i]);
    }
  }
  console.log("[JELLYFIN] Title filter found " + candidates.length + " items matching \"" + title + "\"");

  if (candidates.length === 0) return [];

  // Jika ada tahun, coba filter berdasarkan ProductionYear
  if (year) {
    var yearMatches = [];
    for (var j = 0; j < candidates.length; j++) {
      var prodYear = candidates[j].ProductionYear;
      if (prodYear && prodYear == year) {
        console.log("[JELLYFIN] Year match: " + candidates[j].Name + " (" + prodYear + ")");
        yearMatches.push(candidates[j]);
      }
    }
    if (yearMatches.length > 0) {
      console.log("[JELLYFIN] Found " + yearMatches.length + " items with matching year " + year);
      return yearMatches;
    }
    console.log("[JELLYFIN] No exact year match, falling back to all title-matched items");
  }
  // Jika tidak ada tahun atau tidak ada yang cocok tahun, kembalikan semua yang judulnya cocok
  return candidates;
}

// ─── Stream Helpers ─────────────────────────────────────────────────────────
function _parseQuality(mediaStreams) {
  for (var i = 0; i < mediaStreams.length; i++) {
    var s = mediaStreams[i];
    if (s.Type === "Video") {
      var h = s.Height || 0;
      if (h >= 2160) return "4K";
      if (h >= 1080) return "1080p";
      if (h >= 720) return "720p";
      if (h >= 480) return "480p";
      return h > 0 ? h + "p" : "SD";
    }
  }
  return "Unknown";
}

function _parseCodec(mediaStreams) {
  for (var i = 0; i < mediaStreams.length; i++) {
    if (mediaStreams[i].Type === "Video") return (mediaStreams[i].Codec || "").toUpperCase();
  }
  return "";
}

function _parseHDR(mediaStreams) {
  for (var i = 0; i < mediaStreams.length; i++) {
    var s = mediaStreams[i];
    if (s.Type === "Video" && s.VideoRangeType && s.VideoRangeType !== "SDR") return s.VideoRangeType;
  }
  return "";
}

function _buildStreams(item) {
  var result = [];
  if (!item || !item.Id) return result;
  console.log("[JELLYFIN] Building streams for item: " + item.Name + " (" + (item.ProductionYear || '?') + ") (ID: " + item.Id + ")");
  var sources = item.MediaSources;

  if (!sources || sources.length === 0) {
    result.push({
      name: "🎬 Jellyfin",
      title: "Direct Stream",
      url: SERVER + "/Videos/" + item.Id + "/stream?api_key=" + TOKEN + "&static=true",
      quality: "Unknown"
    });
    return result;
  }

  for (var i = 0; i < sources.length; i++) {
    var src = sources[i];
    var ms = src.MediaStreams || [];
    var quality = _parseQuality(ms);
    var codec   = _parseCodec(ms);
    var hdr     = _parseHDR(ms);

    var label = quality;
    if (codec) label += " · " + codec;
    if (hdr)   label += " · " + hdr;
    if (src.Size) {
      var gb = Math.round(src.Size / 1073741824 * 10) / 10;
      label += " · " + gb + " GB";
    }

    var streamUrl = SERVER + "/Videos/" + item.Id + "/stream" +
      "?api_key=" + TOKEN +
      "&static=true" +
      "&MediaSourceId=" + encodeURIComponent(src.Id || item.Id);

    result.push({
      name: "🎬 Jellyfin",
      title: label,
      url: streamUrl,
      quality: quality
    });
  }
  return result;
}

// ─── Search by ID (with manual filter) ──────────────────────────────────────
function _searchByProvider(id, includeItemTypes, additionalParams) {
  var prefixes = (id && id.toString().indexOf("tt") === 0) ? ["Imdb.", "imdb."] : ["Tmdb.", "tmdb."];
  var attempt = 0;

  function tryNext() {
    if (attempt >= prefixes.length) {
      console.log("[JELLYFIN] ID search exhausted.");
      return Promise.resolve([]);
    }
    var prefix = prefixes[attempt];
    var providerQuery = prefix + id;
    console.log("[JELLYFIN] Attempt " + (attempt+1) + " with prefix: " + prefix);
    var path = "/Users/" + USER_ID + "/Items" +
      "?Recursive=true" +
      "&IncludeItemTypes=" + encodeURIComponent(includeItemTypes) +
      "&Fields=MediaSources,MediaStreams,ProviderIds,Path" +
      "&AnyProviderIdEquals=" + encodeURIComponent(providerQuery) +
      (additionalParams ? additionalParams : "");

    return _get(path).then(function(data) {
      if (!data || !data.Items) {
        attempt++;
        return tryNext();
      }
      var filtered = _filterItemsById(data.Items, id);
      if (filtered.length > 0) return filtered;
      attempt++;
      return tryNext();
    });
  }

  return tryNext().then(function(filtered) {
    if (filtered.length === 0) {
      console.log("[JELLYFIN] No item found by ID.");
      return [];
    }
    if (filtered.length > 1) {
      console.warn("[JELLYFIN] Warning: Multiple items match ID, using first.");
    }
    return filtered;
  });
}

// ─── Search by title (with optional year) ───────────────────────────────────
function _searchByTitle(title, includeItemTypes, year) {
  console.log("[JELLYFIN] Falling back to title search: \"" + title + "\"" + (year ? " (year: " + year + ")" : ""));
  // Tambahkan Fields=ProductionYear agar tahun tersedia
  var path = "/Users/" + USER_ID + "/Items" +
    "?Recursive=true" +
    "&IncludeItemTypes=" + encodeURIComponent(includeItemTypes) +
    "&searchTerm=" + encodeURIComponent(title) +
    "&Fields=ProviderIds,MediaSources,MediaStreams,ProductionYear";

  return _get(path).then(function(data) {
    if (!data || !data.Items || !data.Items.length) return [];
    return _filterItemsByTitleAndYear(data.Items, title, year);
  });
}

// ─── Movie ──────────────────────────────────────────────────────────────────
function _getMovie(id, title, year) {
  return _searchByProvider(id, "Movie", "&Fields=MediaSources,MediaStreams").then(function(filtered) {
    if (filtered.length > 0) {
      var item = filtered[0];
      console.log("[JELLYFIN] Selected movie by ID: " + item.Name + " (" + (item.ProductionYear || '?') + ")");
      return _buildStreams(item);
    }
    if (title) {
      return _searchByTitle(title, "Movie", year).then(function(titleMatches) {
        if (titleMatches.length === 0) {
          console.log("[JELLYFIN] Movie not found by title.");
          return [];
        }
        var item = titleMatches[0];
        console.log("[JELLYFIN] Selected movie by title: " + item.Name + " (" + (item.ProductionYear || '?') + ")");
        return _buildStreams(item);
      });
    }
    return [];
  });
}

// ─── Series ─────────────────────────────────────────────────────────────────
function _getEpisode(id, season, episode, title, year) {
  return _searchByProvider(id, "Series", "").then(function(filtered) {
    if (filtered.length === 0) {
      if (title) {
        return _searchByTitle(title, "Series", year).then(function(titleMatches) {
          if (titleMatches.length === 0) {
            console.log("[JELLYFIN] Series not found by title.");
            return [];
          }
          var series = titleMatches[0];
          console.log("[JELLYFIN] Found series by title: " + series.Name + " (" + (series.ProductionYear || '?') + ")");
          return _getEpisodesForSeries(series, season, episode);
        });
      }
      return [];
    }
    var series = filtered[0];
    console.log("[JELLYFIN] Found series by ID: " + series.Name);
    return _getEpisodesForSeries(series, season, episode);
  });
}

function _getEpisodesForSeries(series, season, episode) {
  var epPath = "/Shows/" + series.Id +
    "/Episodes?Season=" + season +
    "&UserId=" + USER_ID +
    "&Fields=MediaSources,MediaStreams";

  return _get(epPath).then(function(epData) {
    if (!epData || !epData.Items || !epData.Items.length) {
      console.log("[JELLYFIN] No episodes found for season " + season);
      return [];
    }
    console.log("[JELLYFIN] Episodes count for season " + season + ": " + epData.Items.length);
    for (var i = 0; i < epData.Items.length; i++) {
      var ep = epData.Items[i];
      if (ep.IndexNumber == episode) {
        console.log("[JELLYFIN] Found episode S" + season + "E" + episode + " -> " + ep.Name);
        return _buildStreams(ep);
      }
    }
    console.warn("[JELLYFIN] Episode S" + season + "E" + episode + " not found");
    return [];
  });
}

// ─── Main Handler ──────────────────────────────────────────────────────────
function getStreams(imdbId, type, season, episode, title, year) {
  console.log("[JELLYFIN] Request: type=" + type + " id=" + imdbId + " S=" + season + " E=" + episode + " title=" + (title || "none") + " year=" + (year || "none"));
  if (!imdbId && !title) {
    console.error("[JELLYFIN] No ID or title provided");
    return Promise.resolve([]);
  }

  if (type === "movie") {
    return _getMovie(imdbId, title, year).catch(function(err) {
      console.error("[JELLYFIN] Movie error:", err.message);
      return [];
    });
  } else {
    return _getEpisode(imdbId, season, episode, title, year).catch(function(err) {
      console.error("[JELLYFIN] Series error:", err.message);
      return [];
    });
  }
}

module.exports = { getStreams: getStreams };
