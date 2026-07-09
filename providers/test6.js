/**
 * toonstream - Built from src/toonstream/
 * Generated: 2026-06-14T05:04:41.957Z
 */
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/toonstream/index.js
var cheerio = require("cheerio-without-node-native");
var TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
var DOMAINS_JSON_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
var FALLBACK_DOMAIN = "https://toonstream.vip";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var cachedDomain = "";
var domainCachedAt = 0;
var DOMAIN_TTL_MS = 36e5;
function safeAtob(str) {
  if (typeof atob === "function")
    return atob(str);
  return Buffer.from(str, "base64").toString("binary");
}
function getDomain() {
  return __async(this, null, function* () {
    const now = Date.now();
    if (cachedDomain && now - domainCachedAt < DOMAIN_TTL_MS)
      return cachedDomain;
    try {
      const r = yield fetch(DOMAINS_JSON_URL, { headers: { "User-Agent": USER_AGENT } });
      const data = yield r.json();
      cachedDomain = data.toonstream || FALLBACK_DOMAIN;
      domainCachedAt = now;
      return cachedDomain;
    } catch (_) {
      return FALLBACK_DOMAIN;
    }
  });
}
function getTmdbTitle(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const tmdbType = mediaType === "tv" ? "tv" : "movie";
    const r = yield fetch(
      "https://api.themoviedb.org/3/" + tmdbType + "/" + tmdbId + "?api_key=" + TMDB_API_KEY,
      { headers: { "User-Agent": USER_AGENT, "Accept": "application/json" } }
    );
    const data = yield r.json();
    const title = mediaType === "tv" ? data.name : data.title;
    const dateStr = data.release_date || data.first_air_date || "";
    const year = dateStr ? parseInt(dateStr.slice(0, 4), 10) : null;
    return { title: title || "", year };
  });
}
function normalize(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function rankResults(results, wantedTitle) {
  const want = normalize(wantedTitle);
  const exact = [];
  const prefix = [];
  for (let i = 0; i < results.length; i++) {
    const n = normalize(results[i].title);
    if (n === want)
      exact.push(results[i]);
    else if (n.startsWith(want))
      prefix.push(results[i]);
  }
  return exact.concat(prefix);
}
function searchSite(domain, query) {
  return __async(this, null, function* () {
    const results = [];
    const seen = {};
    for (let page = 1; page <= 3; page++) {
      let html;
      try {
        const r = yield fetch(domain + "/page/" + page + "/?s=" + encodeURIComponent(query), {
          headers: { "User-Agent": USER_AGENT }
        });
        html = yield r.text();
      } catch (_) {
        break;
      }
      const $ = cheerio.load(html);
      const items = $("#movies-a > ul > li");
      if (!items.length)
        break;
      let added = 0;
      items.each(function(i, el) {
        const href = $(el).find("article > a").attr("href") || "";
        const title = $(el).find("article > header > h2").text().trim().replace("Watch Online", "").trim();
        if (href && title && !seen[href]) {
          seen[href] = true;
          results.push({ url: href, title });
          added++;
        }
      });
      if (added === 0)
        break;
    }
    return results;
  });
}
function loadPost(url) {
  return __async(this, null, function* () {
    const r = yield fetch(url, { headers: { "User-Agent": USER_AGENT } });
    const html = yield r.text();
    const $ = cheerio.load(html);
    const title = $("header.entry-header > h1").text().trim().replace("Watch Online", "").trim();
    const bodyText = $("body").text();
    const yearMatch = bodyText.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? parseInt(yearMatch[0], 10) : null;
    const isSeries = url.indexOf("/series/") !== -1;
    const seasons = [];
    if (isSeries) {
      $("div.aa-drp.choose-season > ul > li > a").each(function(i, el) {
        seasons.push({
          dataPost: $(el).attr("data-post") || "",
          dataSeason: $(el).attr("data-season") || ""
        });
      });
    }
    return { title, year, isSeries, seasons };
  });
}
function getSeasonEpisodes(domain, dataPost, dataSeason) {
  return __async(this, null, function* () {
    const body = "action=action_select_season&season=" + encodeURIComponent(dataSeason) + "&post=" + encodeURIComponent(dataPost);
    const r = yield fetch(domain + "/wp-admin/admin-ajax.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": USER_AGENT
      },
      body
    });
    const html = yield r.text();
    const $ = cheerio.load(html);
    const episodes = [];
    $("article").each(function(i, el) {
      const href = $(el).find("a").first().attr("href") || "";
      const numEpi = $(el).find("span.num-epi").text().trim();
      const parts = numEpi.split("x");
      const s = parseInt(parts[0] || "1", 10) || 1;
      const ep = parseInt(parts[1] || "1", 10) || 1;
      if (href)
        episodes.push({ url: href, season: s, episode: ep });
    });
    return episodes;
  });
}
function findInSeason(domain, s, targetSeason, targetEpisode) {
  return __async(this, null, function* () {
    let eps;
    try {
      eps = yield getSeasonEpisodes(domain, s.dataPost, s.dataSeason);
    } catch (_) {
      return null;
    }
    for (let ei = 0; ei < eps.length; ei++) {
      if (eps[ei].season === targetSeason && eps[ei].episode === targetEpisode) {
        return eps[ei].url;
      }
    }
    return null;
  });
}
function findEpisodeUrl(domain, post, targetSeason, targetEpisode) {
  return __async(this, null, function* () {
    const preferred = [];
    const rest = [];
    for (let si = 0; si < post.seasons.length; si++) {
      const s = post.seasons[si];
      if (parseInt(s.dataSeason, 10) === targetSeason)
        preferred.push(s);
      else
        rest.push(s);
    }
    const groups = [preferred, rest];
    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      if (!group.length)
        continue;
      const found = yield Promise.all(group.map(function(s) {
        return findInSeason(domain, s, targetSeason, targetEpisode);
      }));
      for (let i = 0; i < found.length; i++) {
        if (found[i])
          return found[i];
      }
    }
    return null;
  });
}
function getTrembedSrc(dataSrc, pageUrl) {
  return __async(this, null, function* () {
    try {
      const r2 = yield fetch(dataSrc, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": pageUrl,
          "Sec-Fetch-Dest": "iframe",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "same-origin"
        }
      });
      const html2 = yield r2.text();
      const $2 = cheerio.load(html2);
      let src = $2("iframe").first().attr("src") || $2("iframe").first().attr("data-src") || "";
      if (!src)
        return null;
      if (src.indexOf("//") === 0)
        src = "https:" + src;
      return src;
    } catch (_) {
      return null;
    }
  });
}
function getVideoLinks(pageUrl) {
  return __async(this, null, function* () {
    const r = yield fetch(pageUrl, { headers: { "User-Agent": USER_AGENT } });
    const html = yield r.text();
    const $ = cheerio.load(html);
    const iframes = $("#aa-options > div > iframe");
    const dataSrcs = [];
    for (let i = 0; i < iframes.length; i++) {
      const dataSrc = $(iframes[i]).attr("data-src") || $(iframes[i]).attr("src") || "";
      if (dataSrc)
        dataSrcs.push(dataSrc);
    }
    const resolved = yield Promise.all(dataSrcs.map(function(ds) {
      return getTrembedSrc(ds, pageUrl);
    }));
    const links = [];
    for (let i = 0; i < resolved.length; i++) {
      if (resolved[i])
        links.push(resolved[i]);
    }
    return links;
  });
}
function extractAWSStream(url) {
  return __async(this, null, function* () {
    const hash = url.split("/").pop().split("?")[0];
    const m = url.match(/^(https?:\/\/[^/]+)/);
    const origin = m ? m[1] : url.slice(0, url.lastIndexOf("/"));
    const r = yield fetch(
      origin + "/player/index.php?data=" + hash + "&do=getVideo",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "x-requested-with": "XMLHttpRequest",
          "Referer": url,
          "User-Agent": USER_AGENT
        },
        body: "hash=" + encodeURIComponent(hash) + "&r=" + encodeURIComponent(origin)
      }
    );
    const data = yield r.json();
    if (data && data.videoSource) {
      return { url: data.videoSource, headers: {} };
    }
    return null;
  });
}
function extractStreamruby(url) {
  return __async(this, null, function* () {
    const clean = url.replace(/\/e\/(?=\w)/, "/");
    const r = yield fetch(clean, { headers: { "User-Agent": USER_AGENT } });
    const text = yield r.text();
    const m = text.match(/file:\s*"(.*?\.m3u8.*?)"/);
    if (m && m[1])
      return { url: m[1], headers: { Referer: "streamruby.com" } };
    return null;
  });
}
function extractGDMirrorbot(url) {
  return __async(this, null, function* () {
    const embedIdx = url.indexOf("/embed/");
    const sid = embedIdx !== -1 ? url.slice(embedIdx + 7).split("?")[0] : "";
    const host = embedIdx !== -1 ? url.slice(0, embedIdx) : "";
    if (!sid || !host)
      return null;
    const r = yield fetch(host + "/embedhelper.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT
      },
      body: "sid=" + encodeURIComponent(sid)
    });
    const data = yield r.json();
    const siteUrls = data.siteUrls || {};
    let mresult = data.mresult || {};
    if (typeof mresult === "string") {
      try {
        mresult = JSON.parse(safeAtob(mresult));
      } catch (_) {
        return null;
      }
    }
    const keys = Object.keys(siteUrls);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (!mresult[key])
        continue;
      const base = (siteUrls[key] || "").replace(/\/$/, "");
      const path = (mresult[key] || "").replace(/^\//, "");
      const subUrl = base + "/" + path;
      let result = null;
      try {
        if (subUrl.indexOf("awstream") !== -1 || subUrl.indexOf("zephyrflick") !== -1) {
          result = yield extractAWSStream(subUrl);
        } else if (subUrl.indexOf("streamruby") !== -1) {
          result = yield extractStreamruby(subUrl);
        }
      } catch (_) {
      }
      if (result && result.url)
        return result;
    }
    return null;
  });
}
function resolveVideoLink(url) {
  return __async(this, null, function* () {
    try {
      if (url.indexOf("awstream") !== -1 || url.indexOf("zephyrflick") !== -1 || url.indexOf("as-cdn") !== -1)
        return yield extractAWSStream(url);
      if (url.indexOf("streamruby") !== -1)
        return yield extractStreamruby(url);
      if (url.indexOf("gdmirrorbot") !== -1 || url.indexOf("techinmind") !== -1)
        return yield extractGDMirrorbot(url);
    } catch (_) {
    }
    return null;
  });
}
function orderVideoLinks(links) {
  return links.slice().sort(function(a, b) {
    const aw = a.indexOf("as-cdn") !== -1 || a.indexOf("awstream") !== -1 || a.indexOf("zephyrflick") !== -1 ? 1 : 0;
    const bw = b.indexOf("as-cdn") !== -1 || b.indexOf("awstream") !== -1 || b.indexOf("zephyrflick") !== -1 ? 1 : 0;
    return bw - aw;
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const { title, year } = yield getTmdbTitle(tmdbId, mediaType);
      if (!title)
        return [];
      console.log("[Toonstream] " + mediaType + ' "' + title + '" S' + season + "E" + episode);
      const domain = yield getDomain();
      const rawResults = yield searchSite(domain, title);
      const ranked = rankResults(rawResults, title);
      for (let ci = 0; ci < Math.min(3, ranked.length); ci++) {
        const candidate = ranked[ci];
        let post;
        try {
          post = yield loadPost(candidate.url);
        } catch (_) {
          continue;
        }
        if (year && post.year && Math.abs(post.year - year) > 2)
          continue;
        let pageUrl = candidate.url;
        if (mediaType === "tv") {
          let episodeUrl = null;
          try {
            episodeUrl = yield findEpisodeUrl(domain, post, season, episode);
          } catch (_) {
          }
          if (!episodeUrl)
            continue;
          pageUrl = episodeUrl;
        }
        let videoLinks = [];
        try {
          videoLinks = orderVideoLinks(yield getVideoLinks(pageUrl));
        } catch (_) {
          continue;
        }
        for (let vi = 0; vi < videoLinks.length; vi++) {
          let resolved = null;
          try {
            resolved = yield resolveVideoLink(videoLinks[vi]);
          } catch (_) {
          }
          if (resolved && resolved.url) {
            const label = mediaType === "tv" ? title + " S" + String(season).padStart(2, "0") + "E" + String(episode).padStart(2, "0") + " \u2022 HLS" : title + " \u2022 HLS";
            console.log("[Toonstream] stream found: " + resolved.url);
            return [{
              name: "Toonstream",
              title: label,
              url: resolved.url,
              quality: "Auto",
              headers: resolved.headers || {}
            }];
          }
        }
      }
      console.log("[Toonstream] no streams found");
      return [];
    } catch (e) {
      console.error("[Toonstream] Fatal: " + e.message);
      return [];
    }
  });
}
module.exports = { getStreams };
