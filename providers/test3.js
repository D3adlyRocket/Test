var MAIN_URL = "https://www.bollyzone.to";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
var DATE_RE = /\b\d{1,2}(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/;

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    var title = await getTmdbTitle(tmdbId, mediaType);
    if (!title) return [];

    var searchResults = await searchShow(title);
    if (!searchResults || searchResults.length === 0) return [];

    var bestMatch = findBestMatch(searchResults, title, mediaType);
    if (!bestMatch) return [];

    if (mediaType === "movie") {
      return await resolveMovie(bestMatch.url);
    }

    return await resolveEpisode(bestMatch.url, season, episode);
  } catch (e) {
    console.error("Bollyzon error:", e.message || e);
    return [];
  }
}

async function getTmdbTitle(tmdbId, mediaType) {
  try {
    var url = "https://api.themoviedb.org/3/" + mediaType + "/" + tmdbId + "?api_key=" + TMDB_API_KEY;
    var resp = await fetch(url, {
      headers: { "User-Agent": UA }
    });
    var data = await resp.json();
    return data.title || data.name || null;
  } catch (e) {
    console.error("TMDB fetch failed:", e.message);
    return null;
  }
}

async function searchShow(query) {
  try {
    var url = MAIN_URL + "/?s=" + encodeURIComponent(query);
    var html = await fetchPage(url);
    if (!html || html.indexOf("404") !== -1) return null;

    var $ = cheerio.load(html);
    var results = [];
    $("ul.MovieList li.TPostMv").each(function(i, el) {
      var titleEl = $(el).find("h2.Title");
      var anchor = $(el).find("a").first();
      var title = titleEl.text().trim();
      var href = anchor.attr("href");
      var img = $(el).find("img").first();
      var poster = img.attr("data-src") || img.attr("src") || "";

      if (title && href) {
        results.push({
          title: title,
          url: href,
          poster: poster
        });
      }
    });
    return results.length > 0 ? results : null;
  } catch (e) {
    console.error("Search failed:", e.message);
    return null;
  }
}

function findBestMatch(results, targetTitle, mediaType) {
  var best = null;
  var bestScore = 0;
  var target = targetTitle.toLowerCase().trim();

  for (var i = 0; i < results.length; i++) {
    var title = results[i].title.toLowerCase().trim();
    var score = similarity(title, target);
    if (score > bestScore) {
      bestScore = score;
      best = results[i];
    }
  }

  return bestScore >= 0.5 ? best : null;
}

function similarity(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;

  var aNorm = a.replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  var bNorm = b.replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();

  if (aNorm === bNorm) return 0.95;

  if (aNorm.indexOf(bNorm) !== -1 || bNorm.indexOf(aNorm) !== -1) {
    var ratio = Math.min(aNorm.length, bNorm.length) / Math.max(aNorm.length, bNorm.length);
    if (ratio >= 0.8) return 0.85;
  }

  var dist = levenshtein(aNorm, bNorm);
  var maxLen = Math.max(aNorm.length, bNorm.length);
  return maxLen > 0 ? 1 - dist / maxLen : 0;
}

function levenshtein(s1, s2) {
  var m = s1.length, n = s2.length;
  var dp = [];
  for (var i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (var j = 0; j <= n; j++) {
    dp[0][j] = j;
  }
  for (var i = 1; i <= m; i++) {
    for (var j = 1; j <= n; j++) {
      var cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

async function resolveMovie(url) {
  try {
    var html = await fetchPage(url);
    if (!html) return [];

    var $ = cheerio.load(html);
    var title = $("h1").first().text().trim() || "Movie";
    var episodes = [];

    $(".MovieList .OptionBx").each(function(i, el) {
      var name = $(el).find("p.AAIco-dns").text().trim() || "Stream " + (i + 1);
      var link = $(el).find("a").attr("href");
      if (link) {
        episodes.push({ name: name, url: link });
      }
    });

    if (episodes.length === 0) return [];

    var results = [];
    for (var ei = 0; ei < episodes.length; ei++) {
      var streamUrl = await resolveVideoUrl(episodes[ei].url);
      if (streamUrl) {
        results.push({
          title: title,
          name: episodes[ei].name,
          url: streamUrl,
          quality: null,
          provider: "Bollyzon",
          type: "movie"
        });
      }
    }
    return results;
  } catch (e) {
    console.error("Movie resolve failed:", e.message);
    return [];
  }
}

async function resolveEpisode(showUrl, season, episode) {
  try {
    var episodes = await getEpisodeList(showUrl);
    if (!episodes || episodes.length === 0) return [];

    var targetEp = null;
    var reqEp = parseInt(episode, 10);

    if (!isNaN(reqEp)) {
      var idx = reqEp - 1;
      if (idx >= 0 && idx < episodes.length) targetEp = episodes[idx];
    }

    if (!targetEp && episodes.length > 0) targetEp = episodes[0];
    if (!targetEp) return [];

    return await resolveEpisodePage(targetEp.url, targetEp.name);
  } catch (e) {
    console.error("Episode resolve failed:", e.message);
    return [];
  }
}

async function getEpisodeList(showUrl) {
  try {
    var html = await fetchPage(showUrl);
    if (!html) return null;

    var $ = cheerio.load(html);
    var title = $("meta[property=og:title]").attr("content") || $("h1").first().text().trim() || "Show";

    var lastPage = 1;
    var navLinks = $("section > nav > div > a");
    navLinks.each(function(i, el) {
      var num = parseInt($(el).text().trim(), 10);
      if (!isNaN(num) && num > lastPage) lastPage = num;
    });

    var episodes = [];

    for (var p = 1; p <= lastPage; p++) {
      var pageHtml = p === 1 ? html : await fetchPage(showUrl.replace(/\/?$/, "") + "/page/" + p + "/");
      if (!pageHtml) continue;

      var $page = p === 1 ? $ : cheerio.load(pageHtml);
      $page("ul.MovieList li").each(function(i, el) {
        var epUrl = $page(el).find("a").attr("href");
        if (!epUrl) return;

        var epTitleEl = $page(el).find("a h2");
        var epTitle = epTitleEl.text().trim();
        var match = epTitle ? epTitle.match(DATE_RE) : null;
        var epName = match ? match[0] : (epTitle || "Episode");
        episodes.push({ name: epName, url: epUrl });
      });
    }

    return episodes.length > 0 ? episodes : null;
  } catch (e) {
    console.error("Episode list failed:", e.message);
    return null;
  }
}

async function resolveEpisodePage(epUrl, epName) {
  try {
    var html = await fetchPage(epUrl);
    if (!html) return [];

    var $ = cheerio.load(html);
    var results = [];

    $(".MovieList .OptionBx").each(function(i, el) {
      var name = $(el).find("p.AAIco-dns").text().trim() || "Stream " + (i + 1);
      var link = $(el).find("a").attr("href");
      if (link) {
        results.push({ name: name, url: link });
      }
    });

    if (results.length === 0) return [];

    var streams = [];
    for (var ri = 0; ri < results.length; ri++) {
      var streamUrl = await resolveVideoUrl(results[ri].url);
      if (streamUrl) {
        streams.push({
          title: epName + " - " + results[ri].name,
          name: epName,
          url: streamUrl,
          quality: null,
          provider: "Bollyzon",
          type: "tv"
        });
      }
    }
    return streams;
  } catch (e) {
    console.error("Episode page resolve failed:", e.message);
    return [];
  }
}

async function resolveVideoUrl(initialUrl) {
  try {
    var iframeUrl = await resolveIframeSrc(initialUrl);
    if (!iframeUrl) return null;

    var m3u8Url = await extractM3u8(iframeUrl);
    if (m3u8Url) return m3u8Url;

    return iframeUrl;
  } catch (e) {
    console.error("Video URL resolve failed:", e.message);
    return null;
  }
}

async function resolveIframeSrc(initialUrl) {
  try {
    var resp = await fetch(initialUrl, {
      method: "GET",
      headers: {
        "User-Agent": UA,
        "Referer": MAIN_URL,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
      },
      redirect: "manual"
    });
    var html = await resp.text();
    if (!html) return null;

    var $ = cheerio.load(html);

    var proceedLink = $("#Proceed a[href], a.button.button1, a.button1").first().attr("href");
    if (!proceedLink) {
      proceedLink = $("iframe").attr("src");
    }
    if (!proceedLink) return null;

    return await followMetaRefresh(proceedLink);
  } catch (e) {
    console.error("Iframe resolve failed:", e.message);
    return null;
  }
}

async function followMetaRefresh(startUrl) {
  try {
    var resp1 = await fetch(startUrl, {
      method: "GET",
      headers: { "User-Agent": UA },
      redirect: "manual"
    });
    var html1 = await resp1.text();
    if (!html1) return null;

    var $1 = cheerio.load(html1);
    var metaContent = $1("meta[http-equiv=refresh]").attr("content");
    if (!metaContent) return startUrl;

    var refreshUrl = metaContent;
    var urlIdx = refreshUrl.indexOf("url=");
    if (urlIdx !== -1) {
      refreshUrl = refreshUrl.substring(urlIdx + 4);
    }
    var urlIdx2 = refreshUrl.indexOf("URL=");
    if (urlIdx2 !== -1) {
      refreshUrl = refreshUrl.substring(urlIdx2 + 4);
    }
    refreshUrl = refreshUrl.trim().replace(/^['"]/, "").replace(/['"]$/, "");

    if (!refreshUrl) return startUrl;

    if (!refreshUrl.startsWith("http")) {
      var base = getBaseUrl(startUrl);
      if (refreshUrl.startsWith("//")) {
        refreshUrl = "https:" + refreshUrl;
      } else if (refreshUrl.startsWith("/")) {
        refreshUrl = base + refreshUrl;
      } else {
        refreshUrl = base + "/" + refreshUrl;
      }
    }

    var resp2 = await fetch(refreshUrl, {
      method: "GET",
      headers: { "User-Agent": UA },
      redirect: "manual"
    });

    var cookies = resp2.headers.get("set-cookie") || "";
    var cookieVal = cookies.split(";")[0] || "";

    var baseUrl = getBaseUrl(refreshUrl);
    var headers = { "User-Agent": UA };
    if (cookieVal) headers["Cookie"] = cookieVal;

    var resp3 = await fetch(baseUrl, {
      method: "GET",
      headers: headers
    });
    var html3 = await resp3.text();
    if (!html3) return null;

    var $3 = cheerio.load(html3);
    var iframeSrc = $3("iframe").attr("src");
    if (!iframeSrc) return null;

    if (!iframeSrc.startsWith("http")) {
      var base2 = getBaseUrl(baseUrl);
      if (iframeSrc.startsWith("//")) {
        iframeSrc = "https:" + iframeSrc;
      } else if (iframeSrc.startsWith("/")) {
        iframeSrc = base2 + iframeSrc;
      } else {
        iframeSrc = base2 + "/" + iframeSrc;
      }
    }

    return iframeSrc;
  } catch (e) {
    console.error("Meta refresh follow failed:", e.message);
    return null;
  }
}

async function extractM3u8(pageUrl) {
  try {
    var resp = await fetch(pageUrl, {
      method: "GET",
      headers: {
        "User-Agent": UA,
        "Referer": MAIN_URL
      }
    });
    var body = await resp.text();
    if (!body) return null;

    var srcMatch = body.match(/"src"\s*:\s*"(https?:\/\/[^"]*\.m3u8[^"]*)"/);
    if (srcMatch) return srcMatch[1];

    var fileMatch = body.match(/"file"\s*:\s*"(https?:\/\/[^"]*\.m3u8[^"]*)"/);
    if (fileMatch) return fileMatch[1];

    var directMatch = body.match(/(https?:\/\/[^"'\s]*\.m3u8[^"'\s]*)/);
    if (directMatch) return directMatch[1];

    return null;
  } catch (e) {
    console.error("M3U8 extraction failed:", e.message);
    return null;
  }
}

async function fetchPage(url) {
  try {
    var resp = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": UA,
        "Referer": MAIN_URL,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
      }
    });
    if (!resp.ok) return null;
    return await resp.text();
  } catch (e) {
    console.error("Page fetch failed:", e.message);
    return null;
  }
}

function getBaseUrl(url) {
  var m = url.match(/^(https?:\/\/[^\/]+)/);
  return m ? m[1] : "";
}

module.exports = { getStreams };
