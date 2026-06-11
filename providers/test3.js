async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    if (mediaType !== "tv") return [];

    var [title, absoluteEp] = await Promise.all([
      getTmdbTitle(tmdbId, mediaType),
      getAbsoluteEpisodeNumber(tmdbId, season, episode)
    ]);

    if (!title) return [];

    var slugs = generateSlugs(title);
    for (var si = 0; si < slugs.length; si++) {
      var pageResults = await scrapeShowPage(slugs[si], title, absoluteEp);
      if (pageResults.length > 0) return pageResults;
    }
    return [];
  } catch (e) {
    console.error("SubsPlease error:", e.message);
    return [];
  }
}

async function getTmdbTitle(tmdbId, mediaType) {
  var url = "https://api.themoviedb.org/3/" + mediaType + "/" + tmdbId + "?api_key=" + TMDB_API_KEY;
  try {
    var resp = await fetch(url);
    var data = await resp.json();
    return data.title || data.name || null;
  } catch (e) {
    console.error("TMDB fetch failed:", e.message);
    return null;
  }
}

async function getAbsoluteEpisodeNumber(tmdbId, season, episode) {
  var url = "https://api.themoviedb.org/3/tv/" + tmdbId + "/season/" + season + "?api_key=" + TMDB_API_KEY;
  try {
    var resp = await fetch(url);
    var data = await resp.json();
    if (!data || !data.episodes) return null;
    var epIndex = parseInt(episode, 10) - 1;
    if (epIndex < 0 || epIndex >= data.episodes.length) return null;
    var absEp = data.episodes[epIndex].episode_number;
    return absEp ? parseInt(absEp, 10) : null;
  } catch (e) {
    console.error("TMDB season fetch failed:", e.message);
    return null;
  }
}

async function scrapeShowPage(slug, showTitle, absoluteEp) {
  try {
    var url = "https://subsplease.org/shows/" + slug + "/";
    var resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    });
    var html = await resp.text();
    if (!html || html.indexOf("404") !== -1) return [];

    var $ = cheerio.load(html);
    var sid = $('#show-release-table').attr('sid');
    if (!sid) return [];

    var apiResp = await fetch("https://subsplease.org/api/?f=show&tz=UTC&sid=" + sid);
    var apiData = await apiResp.json();
    if (!apiData || typeof apiData !== "object") return [];

    var episodes = apiData.episode;
    if (!episodes || typeof episodes !== "object") return [];

    var targetEp = absoluteEp;
    if (isNaN(targetEp)) targetEp = null;

    var results = [];
    var matched = false;
    for (var key in episodes) {
      var item = episodes[key];
      if (!item || !item.episode || !item.downloads) continue;

      var itemEp = parseInt(item.episode, 10);
      if (targetEp !== null && (isNaN(itemEp) || itemEp !== targetEp)) continue;
      if (!isNaN(itemEp)) matched = true;

      for (var di = 0; di < item.downloads.length; di++) {
        var dl = item.downloads[di];
        if (!dl.magnet) continue;

        var infoHash = null;
        var xtMatch = dl.magnet.match(/xt=urn:btih:([A-Za-z0-9-]+)/);
        if (xtMatch) {
          var raw = xtMatch[1].toUpperCase();
          if (raw.length === 40) {
            infoHash = raw;
          } else if (raw.length === 32) {
            infoHash = base32ToHex(raw);
          }
        }

        results.push({
          title: item.show + " - " + item.episode + " (" + dl.res + "p)",
          name: item.show + " - " + item.episode,
          url: dl.magnet,
          infoHash: infoHash,
          quality: dl.res + "p",
          size: null,
          provider: "SubsPlease",
          type: "tv"
        });
      }
    }

    if (results.length === 0 && targetEp !== null && !matched) {
      for (var key in episodes) {
        var item = episodes[key];
        if (!item || !item.episode || !item.downloads) continue;
        for (var di = 0; di < item.downloads.length; di++) {
          var dl = item.downloads[di];
          if (!dl.magnet) continue;
          var infoHash = null;
          var xtMatch = dl.magnet.match(/xt=urn:btih:([A-Za-z0-9-]+)/);
          if (xtMatch) {
            var raw = xtMatch[1].toUpperCase();
            if (raw.length === 40) infoHash = raw;
            else if (raw.length === 32) infoHash = base32ToHex(raw);
          }
          results.push({
            title: item.show + " - " + item.episode + " (" + dl.res + "p)",
            name: item.show + " - " + item.episode,
            url: dl.magnet,
            infoHash: infoHash,
            quality: dl.res + "p",
            size: null,
            provider: "SubsPlease",
            type: "tv"
          });
        }
      }
    }

    results.sort(function(a, b) {
      var qa = parseInt(a.quality, 10) || 0;
      var qb = parseInt(b.quality, 10) || 0;
      return qb - qa;
    });

    return results;
  } catch (e) {
    console.error("Show page scrape failed:", e.message);
    return [];
  }
}

function base32ToHex(b32) {
  var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  var bits = "";
  for (var bi = 0; bi < b32.length; bi++) {
    var val = alphabet.indexOf(b32[bi]);
    if (val === -1) continue;
    bits += ("00000" + val.toString(2)).slice(-5);
  }
  var hex = "";
  for (var ni = 0; ni + 4 <= bits.length; ni += 4) {
    hex += parseInt(bits.substr(ni, 4), 2).toString(16);
  }
  return hex.toUpperCase();
}

function generateSlugs(title) {
  var base = title.toLowerCase();
  var slugs = [];

  slugs.push(base.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));

  var parenless = base.replace(/\([^)]*\)/g, "").trim();
  if (parenless !== base) {
    slugs.push(parenless.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
  }

  var beforeColon = base.split(":")[0].trim();
  if (beforeColon !== base) {
    slugs.push(beforeColon.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
    var beforeColonParenless = beforeColon.replace(/\([^)]*\)/g, "").trim();
    if (beforeColonParenless !== beforeColon) {
      slugs.push(beforeColonParenless.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
    }
  }

  var clean = (beforeColon !== base ? beforeColon : parenless);
  var words = clean.split(/\s+/).filter(function(w) { return w.length > 0; });
  if (words.length > 3) {
    slugs.push(words.slice(0, 3).join("-"));
  }

  var deduped = [];
  for (var si = 0; si < slugs.length; si++) {
    if (deduped.indexOf(slugs[si]) === -1) {
      deduped.push(slugs[si]);
    }
  }
  return deduped;
}

module.exports = { getStreams };
