/* ==========================================================================
   UHDMOVIES SCRAPER
   ========================================================================== */

// --------------------------------------------------------------------------
// ## 1. HELPER UTILITIES & ASYNC RUNNER
// --------------------------------------------------------------------------
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

function getInvertedSortTag(val) {
  const safeVal = Math.max(0, parseInt(val, 10) || 0);
  const binaryStr = safeVal.toString(2).padStart(20, '0');
  return binaryStr.split('').map(bit => bit === '1' ? "\uFEFF" : "\u200B").join('');
}

// --------------------------------------------------------------------------
// ## 2. CONSTANTS & CONFIGURATION
// --------------------------------------------------------------------------
var BASE_URLS = ["https://uhdmovies.autos", "https://uhdmovies.pink"];
var DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
var TMDB_URL = "https://api.themoviedb.org/3";
var TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";
var HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9"
};

// --------------------------------------------------------------------------
// ## 3. STRING & DOM PARSING HELPERS
// --------------------------------------------------------------------------
function fetchText(url, options) {
  return __async(this, null, function* () {
    const response = yield fetch(url, options);
    if (!response.ok)
      throw new Error(`HTTP ${response.status}`);
    return response.text();
  });
}

function getOrigin(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch (e) {
    return "";
  }
}

function absoluteUrl(url, base) {
  if (!url)
    return "";
  try {
    return new URL(decodeHtml(url), base).toString();
  } catch (e) {
    return "";
  }
}

function isDirectVideo(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.endsWith(".workers.dev") || host.endsWith(".r2.cloudflarestorage.com") || host.endsWith(".r2.dev") || host === "video-downloads.googleusercontent.com" || host.endsWith(".googlevideo.com");
  } catch (e) {
    return false;
  }
}

function unique(values) {
  const seen = {};
  return values.filter((value) => {
    if (!value || seen[value])
      return false;
    seen[value] = true;
    return true;
  });
}

function findDirectVideos(html, base) {
  const found = anchors(html).map((item) => absoluteUrl(item.href, base)).filter(isDirectVideo);
  const pattern = /https?:\\?\/\\?\/[^\s"'<>\\]+(?:workers\.dev|r2\.cloudflarestorage\.com|r2\.dev|googleusercontent\.com|googlevideo\.com)[^\s"'*]*/gi;
  const matches = String(html || "").match(pattern) || [];
  matches.forEach((match) => {
    const candidate = decodeHtml(match.replace(/\\\//g, "/"));
    if (isDirectVideo(candidate))
      found.push(candidate);
  });
  return unique(found).filter(
    (candidate, index, values) => !values.some(
      (other, otherIndex) => otherIndex !== index && other.length > candidate.length && other.startsWith(candidate)
    )
  );
}

function formBody(fields) {
  return Object.keys(fields).map(
    (key) => `${encodeURIComponent(key)}=${encodeURIComponent(fields[key] || "")}`
  ).join("&");
}

function decodeHtml(value) {
  return String(value || "").replace(/&amp;/gi, "&").replace(/&#0*39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}

function stripTags(value) {
  return decodeHtml(String(value || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function attribute(tag, name) {
  const match = String(tag || "").match(
    new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i")
  );
  return match ? decodeHtml(match[2]) : "";
}

function anchors(html) {
  const found = [];
  const pattern = /<a\b[^>]*>[\s\S]*?<\/a>/gi;
  let match;
  while (match = pattern.exec(String(html || ""))) {
    found.push({
      tag: match[0],
      href: attribute(match[0], "href"),
      title: attribute(match[0], "title"),
      text: stripTags(match[0])
    });
  }
  return found;
}

function readLandingForm(html) {
  var _a;
  const forms = String(html || "").match(/<form\b[^>]*>[\s\S]*?<\/form>/gi) || [];
  const form = forms.find((item) => /\bid\s*=\s*["']landing["']/i.test(item)) || "";
  const fields = {};
  const inputs = form.match(/<input\b[^>]*>/gi) || [];
  inputs.forEach((input) => {
    const name = attribute(input, "name");
    if (name)
      fields[name] = attribute(input, "value");
  });
  return {
    action: attribute(((_a = form.match(/<form\b[^>]*>/i)) == null ? void 0 : _a[0]) || "", "action"),
    fields
  };
}

// --------------------------------------------------------------------------
// ## 4. GATEWAY & SHORTENER BYPASS
// --------------------------------------------------------------------------
function bypassGateway(url) {
  return __async(this, null, function* () {
    const origin = getOrigin(url);
    const firstHtml = yield fetchText(url, { headers: HEADERS });
    const firstForm = readLandingForm(firstHtml);
    if (!firstForm.action)
      return "";
    const firstAction = absoluteUrl(firstForm.action, url);
    if (!firstAction)
      return "";
    const secondHtml = yield fetchText(firstAction, {
      method: "POST",
      headers: Object.assign({}, HEADERS, {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: url
      }),
      body: formBody(firstForm.fields)
    });
    const secondForm = readLandingForm(secondHtml);
    if (!secondForm.action)
      return "";
    const secondAction = absoluteUrl(secondForm.action, firstAction);
    if (!secondAction)
      return "";
    const thirdHtml = yield fetchText(secondAction, {
      method: "POST",
      headers: Object.assign({}, HEADERS, {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: firstAction
      }),
      body: formBody(secondForm.fields)
    });
    const goMatch = thirdHtml.match(/\?go=([^"'&]+)/);
    if (!goMatch)
      return "";
    const token = goMatch[1];
    const cookieValue = secondForm.fields._wp_http2 || "";
    const redirectHtml = yield fetchText(`${origin}/?go=${token}`, {
      headers: Object.assign({}, HEADERS, {
        Cookie: `${token}=${cookieValue}`,
        Referer: secondAction
      })
    });
    const refreshMatch = redirectHtml.match(
      /http-equiv=["']refresh["'][^>]+content=["'][^"']*url\s*=\s*([^"']+)/i
    );
    const scriptMatch = redirectHtml.match(
      /(?:window\.)?location(?:\.href|\.replace)?\s*(?:=|\()\s*["']([^"']+)/i
    );
    return absoluteUrl((refreshMatch == null ? void 0 : refreshMatch[1]) || (scriptMatch == null ? void 0 : scriptMatch[1]), `${origin}/`);
  });
}

function redirectedDownloadUrl(url) {
  const match = String(url || "").match(/[?&]url=([^&]+)/i);
  if (!match)
    return "";
  try {
    return decodeURIComponent(match[1]);
  } catch (e) {
    return match[1];
  }
}

function resolveDriveSeed(url) {
  return __async(this, null, function* () {
    let pageUrl = url;
    if (/\/r\?key=/i.test(pageUrl)) {
      const redirectHtml = yield fetchText(pageUrl, { headers: HEADERS });
      const redirectMatch = redirectHtml.match(
        /(?:window\.location\.)?replace\(["']([^"']+)["']\)/i
      );
      if (!redirectMatch)
        return [];
      pageUrl = absoluteUrl(redirectMatch[1], pageUrl);
    }
    const fileHtml = yield fetchText(pageUrl, { headers: HEADERS });
    const fileLinks = anchors(fileHtml);
    const directUrls = findDirectVideos(fileHtml, pageUrl);
    const sourceLinks = fileLinks.filter(
      (link) => /resume cloud|cloud download|instant download|direct download|download now/i.test(
        link.text
      )
    );
    if (directUrls.length)
      return [directUrls[0]];
    function resolveSource(link) {
      return __async(this, null, function* () {
        const sourceUrl = absoluteUrl(link && link.href, pageUrl);
        if (!sourceUrl)
          return "";
        if (isDirectVideo(sourceUrl))
          return sourceUrl;
        try {
          const response = yield fetch(sourceUrl, {
            headers: Object.assign({}, HEADERS, { Referer: pageUrl }),
            redirect: "follow"
          });
          const redirected = redirectedDownloadUrl(response.url);
          if (isDirectVideo(redirected))
            return redirected;
          if (isDirectVideo(response.url))
            return response.url;
          const html = yield response.text();
          return findDirectVideos(html, sourceUrl)[0] || "";
        } catch (e) {
          return "";
        }
      });
    }
    const cloudLink = sourceLinks.find(
      (link) => /resume cloud|cloud download/i.test(link.text)
    );
    const cloudUrl = yield resolveSource(cloudLink);
    if (cloudUrl)
      return [cloudUrl];
    const instantLink = sourceLinks.find(
      (link) => /instant download|direct download|download now/i.test(link.text)
    );
    const instantUrl = yield resolveSource(instantLink);
    return instantUrl ? [instantUrl] : [];
  });
}

// --------------------------------------------------------------------------
// ## 5. TMDB & SEARCH METADATA
// --------------------------------------------------------------------------
function fetchMetadata(tmdbId) {
  return __async(this, null, function* () {
    const response = yield fetch(
      `${TMDB_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}`,
      { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } }
    );
    if (!response.ok)
      throw new Error(`TMDB HTTP ${response.status}`);
    const data = yield response.json();
    return {
      title: data.title || data.original_title || "",
      originalTitle: data.original_title || "",
      year: String(data.release_date || "").slice(0, 4)
    };
  });
}

function normalizeTitle(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function domainCandidates() {
  return __async(this, null, function* () {
    try {
      const response = yield fetch(DOMAINS_URL, { headers: HEADERS });
      if (response.ok) {
        const data = yield response.json();
        return unique([data.UHDMovies, ...BASE_URLS]);
      }
    } catch (e) {
    }
    return BASE_URLS;
  });
}

function findMoviesInSearch(searchHtml, metadata) {
  const expectedTitle = normalizeTitle(metadata.title);
  const expectedOriginal = normalizeTitle(metadata.originalTitle);
  const matches = [];
  const articles = searchHtml.match(/<article\b[^>]*>[\s\S]*?<\/article>/gi) || [];
  articles.forEach((article) => {
    const link = anchors(article)[0] || {};
    const href = link.href;
    const title = link.title || link.text || stripTags(article);
    if (!href || !title)
      return;
    const normalized = normalizeTitle(title);
    const yearMatch = title.match(/\b(19|20)\d{2}\b/);
    const resultYear = yearMatch ? Number(yearMatch[0]) : null;
    const expectedYear = metadata.year ? Number(metadata.year) : null;
    if (expectedYear && resultYear && Math.abs(resultYear - expectedYear) > 1) {
      return;
    }
    if (/\bseason\b|\bs\d{1,2}\b/i.test(title))
      return;
    let score = 0;
    if (expectedTitle && normalized.includes(expectedTitle))
      score += 4;
    if (expectedOriginal && normalized.includes(expectedOriginal))
      score += 3;
    if (metadata.year && normalized.includes(metadata.year))
      score += 2;
    if (score >= 4)
      matches.push({ href, score });
  });
  matches.sort((a, b) => b.score - a.score);
  return unique(matches.map((item) => item.href));
}

function findMoviePages(metadata) {
  return __async(this, null, function* () {
    const domains = yield domainCandidates();
    for (const domain of domains) {
      try {
        const searchHtml = yield fetchText(
          `${domain}/?s=${encodeURIComponent(metadata.title)}`,
          { headers: HEADERS }
        );
        const moviePages = findMoviesInSearch(searchHtml, metadata).map(
          (page) => absoluteUrl(page, domain)
        );
        if (moviePages.length)
          return unique(moviePages);
      } catch (e) {
      }
    }
    return [];
  });
}

// --------------------------------------------------------------------------
// ## 6. QUALITY, SIZE & DROPDOWN FORMATTING
// --------------------------------------------------------------------------
function parseQuality(label) {
  if (/\b2160p\b|\b4k\b|\buhd\b/i.test(label))
    return "2160p";
  const match = label.match(/\b(1080|720|480)p\b/i);
  return match ? `${match[1]}p` : "Unknown";
}

function parseSize(label) {
  const match = label.match(/\[\s*(\d+(?:\.\d+)?\s*(?:GB|MB))\s*\]/i);
  return match ? match[1].replace(/\s+/g, " ") : "";
}

function compactReleaseLabel(label) {
  return label
    .replace(/^.*?\(\d{4}\)\s*/i, "")
    .replace(/\([^()]*UHDMovies[^()]*\)/gi, "")
    .replace(/\b(2160p|1080p|720p|480p|4k|uhd|showuyin)\b/gi, "")
    .replace(/[-•\s]+/g, " ")
    .trim();
}

function buildDropdownMetadata(metadata, release, details) {
  const quality = release.quality || "Unknown";
  let qualityBadge = "💎 " + quality;
  if (quality.includes("2160") || quality.toLowerCase().includes("4k")) {
    qualityBadge = "🌟 2160p";
  } else if (quality.includes("1080")) {
    qualityBadge = "🚀 1080p";
  } else if (quality.includes("720")) {
    qualityBadge = "🛰️ 720p";
  }

  const sizeStr = release.size ? `📦 ${release.size}` : "📦 Size Unknown";
  const langStr = release.language ? `🗣️ ${release.language.toUpperCase()}` : "🗣️ EN";

  const line1 = `🎬 ${metadata.title || "Unknown"}${metadata.year ? ` (${metadata.year})` : ""}`;
  const line2 = `${qualityBadge} | ${sizeStr} | ${langStr}`;
  const line3 = `🎞️ MKV | ⚡ Direct DriveSeed | 📥 WEB-DL`;

  let result = `${line1}\n${line2}\n${line3}`;
  if (details) {
    result += `\n📝 ${details}`;
  }
  return result;
}

function extractReleases(html) {
  const releases = [];
  const pageHeading = stripTags(
    (String(html || "").match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i) || [""])[0]
  );
  const language = /english audio/i.test(pageHeading) && !/dual[ -]?audio/i.test(pageHeading) ? "en" : "hi \u2022 en";
  const paragraphs = String(html || "").match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [];
  paragraphs.forEach((paragraph, index) => {
    const label = stripTags(paragraph);
    if (!/\[\s*(?:\d+(?:\.\d+)?\s*)?(?:GB|MB)\s*\]/i.test(label))
      return;
    const nearby = paragraphs.slice(index, index + 3).join("");
    const link = anchors(nearby).find(
      (item) => /unblockedgames/i.test(item.href)
    );
    const url = link ? link.href : "";
    if (!url)
      return;
    releases.push({
      label,
      url,
      quality: parseQuality(label),
      size: parseSize(label),
      language
    });
  });
  return releases;
}

// --------------------------------------------------------------------------
// ## 7. STREAM RESOLUTION & MAIN EXPORT
// --------------------------------------------------------------------------
function resolveRelease(release, metadata) {
  return __async(this, null, function* () {
    try {
      console.log(
        `[UHDMovies] Resolving ${release.quality} ${release.size || ""}`.trim()
      );
      const driveSeedUrl = yield bypassGateway(release.url);
      if (!driveSeedUrl) {
        console.log("[UHDMovies] Gateway did not return a DriveSeed link");
        return null;
      }
      const streamUrls = yield resolveDriveSeed(driveSeedUrl);
      if (!streamUrls.length) {
        console.log("[UHDMovies] DriveSeed did not return a direct link");
        return [];
      }
      const details = compactReleaseLabel(release.label);
      const resNum = parseInt(release.quality, 10) || 0;
      const sortTag = getInvertedSortTag(resNum);
      const formattedTitle = sortTag + buildDropdownMetadata(metadata, release, details);

      return streamUrls.map((streamUrl) => ({
        name: `UHDMovies | ${release.size || "Direct"}`,
        title: formattedTitle,
        size: formattedTitle,
        description: formattedTitle,
        url: streamUrl,
        quality: "",
        language: release.language,
        type: "video/x-matroska",
        headers: {
          "User-Agent": USER_AGENT,
          Referer: driveSeedUrl
        },
        provider: "uhdmovies"
      }));
    } catch (error) {
      console.log(`[UHDMovies] Release unavailable: ${error.message}`);
      return [];
    }
  });
}

function getStreams(tmdbId, mediaType) {
  return __async(this, null, function* () {
    if (!tmdbId || mediaType !== "movie")
      return [];
    try {
      console.log(`[UHDMovies] Looking up movie ${tmdbId}`);
      const metadata = yield fetchMetadata(tmdbId);
      if (!metadata.title) {
        console.log("[UHDMovies] TMDB returned no title");
        return [];
      }
      const moviePages = yield findMoviePages(metadata);
      if (!moviePages.length) {
        console.log(`[UHDMovies] No result for ${metadata.title}`);
        return [];
      }
      console.log(`[UHDMovies] Found ${moviePages.length} matching post(s)`);
      const releaseGroups = yield Promise.all(
        moviePages.map((moviePage) => __async(this, null, function* () {
          const movieHtml = yield fetchText(moviePage, { headers: HEADERS });
          return extractReleases(movieHtml);
        }))
      );
      const releases = releaseGroups.reduce(
        (all, group) => all.concat(group),
        []
      );
      console.log(`[UHDMovies] Found ${releases.length} release(s)`);
      if (!releases.length)
        return [];
      const resolved = yield Promise.all(releases.map((rel) => resolveRelease(rel, metadata)));
      const streams = resolved.reduce((all, item) => all.concat(item || []), []);
      
      streams.sort((a, b) => {
        const extractRes = (str) => {
          if (str.includes("2160p") || str.includes("🌟")) return 2160;
          if (str.includes("1080p") || str.includes("🚀")) return 1080;
          if (str.includes("720p") || str.includes("🛰️")) return 720;
          if (str.includes("480p")) return 480;
          return 0;
        };
        return extractRes(b.title) - extractRes(a.title);
      });

      console.log(`[UHDMovies] Returning ${streams.length} stream(s)`);
      if (!streams.length) {
        console.log(
          "[UHDMovies] The download gateway rejected all requests in this runtime"
        );
      }
      const seen = {};
      return streams.filter((stream) => {
        if (seen[stream.url])
          return false;
        seen[stream.url] = true;
        return true;
      });
    } catch (error) {
      console.error(`[UHDMovies] Error: ${error.message}`);
      return [];
    }
  });
}

module.exports = { getStreams };
