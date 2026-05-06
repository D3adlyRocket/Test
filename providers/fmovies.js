// providers/4KHDhub.js
// Android TV FIXED version for Nuvio
// Full copy-paste provider

const DOMAINS_URL =
  "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";

const TMDB_API_KEY =
  "439c478a771f35c05022f9feabcca01c";

const PROVIDER_NAME = "4KHDHub";

const FALLBACK_DOMAINS = [
  "https://4khdhub.click",
  "https://4khdhub.dad",
  "https://4khdhub.moe",
  "https://4khdhub.lol",
  "https://4khdhub.buzz",
];

// Android TV safe headers
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 11; Android TV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",

  "Accept": "*/*",
  "Accept-Language": "en-US,en;q=0.9",

  // IMPORTANT FOR TV
  "Accept-Encoding": "gzip, deflate",

  "Connection": "keep-alive",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
};

const REDIRECT_REGEX =
  /s\('o','([A-Za-z0-9+/=]+)'|ck\('_wp_http_\d+','([^']+)'/g;

// ─────────────────────────────────────────────
// Timeout-safe fetch
// ─────────────────────────────────────────────

async function fetchWithTimeout(
  url,
  options = {},
  timeout = 15000
) {
  return Promise.race([
    fetch(url, options),

    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("timeout")),
        timeout
      )
    )
  ]);
}

// ─────────────────────────────────────────────
// Domain resolver
// ─────────────────────────────────────────────

async function getMainUrl() {
  // Try domains.json first
  try {
    const res = await fetchWithTimeout(
      DOMAINS_URL,
      {
        headers: HEADERS
      }
    );

    if (res.ok) {
      const data = await res.json();

      const fromJson =
        data["4khdhub"] ||
        data["n4khdhub"];

      if (fromJson) {
        try {
          const test = await fetchWithTimeout(
            fromJson,
            {
              method: "HEAD",
              headers: HEADERS
            }
          );

          if (test.ok) {
            console.log(
              `[4KHDHub] using ${fromJson}`
            );

            return fromJson;
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  // Fallback domains
  for (const domain of FALLBACK_DOMAINS) {
    try {
      const res = await fetchWithTimeout(
        domain,
        {
          method: "HEAD",
          headers: HEADERS
        }
      );

      if (res.ok) {
        console.log(
          `[4KHDHub] fallback ${domain}`
        );

        return domain;
      }
    } catch (_) {}
  }

  return null;
}

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

function fixUrl(url, baseUrl) {
  if (!url) return "";

  if (
    url.startsWith("http://") ||
    url.startsWith("https://")
  ) {
    return url;
  }

  if (url.startsWith("//")) {
    return "https:" + url;
  }

  try {
    return new URL(url, baseUrl).toString();
  } catch (_) {
    return url;
  }
}

function decodeBase64(value) {
  try {
    if (typeof atob !== "undefined") {
      return atob(value);
    }

    if (typeof Buffer !== "undefined") {
      return Buffer
        .from(value, "base64")
        .toString("utf-8");
    }

    return "";
  } catch (_) {
    return "";
  }
}

async function fetchText(
  url,
  options = {}
) {
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "GET",

        // IMPORTANT FOR TV
        redirect: "manual",

        headers: {
          ...HEADERS,

          Referer: url,

          Origin: (() => {
            try {
              return new URL(url).origin;
            } catch {
              return "";
            }
          })(),

          ...(options.headers || {})
        }
      }
    );

    // Manual redirects for Android TV
    if (
      res.status >= 300 &&
      res.status < 400
    ) {
      const location =
        res.headers.get("location");

      if (location) {
        const redirectUrl =
          fixUrl(location, url);

        return fetchText(
          redirectUrl,
          options
        );
      }
    }

    if (!res.ok) {
      throw new Error(
        `HTTP ${res.status}`
      );
    }

    return await res.text();

  } catch (e) {
    console.error(
      `[4KHDHub] fetchText error`,
      url,
      e.message
    );

    throw e;
  }
}

function rot13(value) {
  return value.replace(
    /[A-Za-z]/g,
    (char) => {
      const base =
        char <= "Z" ? 65 : 97;

      return String.fromCharCode(
        ((char.charCodeAt(0) - base + 13) %
          26) +
          base
      );
    }
  );
}

function normalizeTitle(value) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseQuality(text) {
  const v = (text || "").toLowerCase();

  const m = v.match(/\d{3,4}p/);

  if (m) return m[0];

  if (/2160p|4k|uhd/.test(v))
    return "2160p";

  if (/1440p/.test(v))
    return "1440p";

  if (/1080p/.test(v))
    return "1080p";

  if (/720p/.test(v))
    return "720p";

  if (/480p/.test(v))
    return "480p";

  return "Auto";
}

function inferLanguageLabel(
  text = ""
) {
  const v = text.toLowerCase();

  const langs = [];

  if (v.includes("hindi"))
    langs.push("Hindi");

  if (v.includes("tamil"))
    langs.push("Tamil");

  if (v.includes("telugu"))
    langs.push("Telugu");

  if (v.includes("english"))
    langs.push("English");

  if (langs.length > 1)
    return "Multi Audio";

  if (langs.length === 1)
    return langs[0];

  return "EN";
}

function buildDisplayMeta(
  sourceTitle = "",
  quality = "Auto"
) {
  const lang =
    inferLanguageLabel(sourceTitle);

  const titleParts = [
    quality,
    lang
  ].filter(Boolean);

  return {
    displayName:
      `${PROVIDER_NAME} - ${lang}`,

    displayTitle:
      titleParts.join(" | ")
  };
}

function buildStream(
  title,
  url,
  quality = "Auto",
  headers = {}
) {
  if (!url) return null;

  let finalUrl = url.trim();

  if (finalUrl.startsWith("//")) {
    finalUrl = "https:" + finalUrl;
  }

  finalUrl =
    finalUrl.replace(/ /g, "%20");

  try {
    new URL(finalUrl);
  } catch (_) {
    return null;
  }

  // TV parser fix
  if (
    !/\.(m3u8|mp4|mkv)(\?|$)/i.test(
      finalUrl
    )
  ) {
    finalUrl += "#.mkv";
  }

  const meta = buildDisplayMeta(
    title,
    quality
  );

  return {
    name: meta.displayName,

    title: meta.displayTitle,

    url: finalUrl,

    quality,

    headers: {
      Referer:
        headers.Referer ||
        headers.referer ||
        "",

      Origin:
        headers.Origin ||
        headers.origin ||
        (() => {
          try {
            return new URL(finalUrl)
              .origin;
          } catch {
            return "";
          }
        })()
    }
  };
}

function dedupeStreams(streams) {
  const seen = new Set();

  return streams.filter((s) => {
    if (!s) return false;

    const fp =
      `${s.url}|${s.quality}`;

    if (seen.has(fp))
      return false;

    seen.add(fp);

    return true;
  });
}

// ─────────────────────────────────────────────
// TMDB
// ─────────────────────────────────────────────

async function getTmdbTitle(
  tmdbId,
  mediaType
) {
  try {
    const type =
      mediaType === "movie"
        ? "movie"
        : "tv";

    const res =
      await fetchWithTimeout(
        `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`,
        {
          headers: HEADERS
        }
      );

    if (!res.ok) {
      throw new Error(
        `TMDB ${res.status}`
      );
    }

    const data = await res.json();

    const title =
      data.name ||
      data.title ||
      "";

    const origTitle =
      data.original_name ||
      data.original_title ||
      title;

    return {
      trTitle: title,
      origTitle
    };

  } catch (e) {
    console.error(
      `[4KHDHub] TMDB error`,
      e.message
    );

    return {
      trTitle: "",
      origTitle: ""
    };
  }
}

// ─────────────────────────────────────────────
// Redirect resolver
// ─────────────────────────────────────────────

async function getRedirectLinks(url) {
  try {
    const html =
      await fetchText(url);

    let combined = "";

    let match;

    const re = new RegExp(
      REDIRECT_REGEX.source,
      "g"
    );

    while (
      (match = re.exec(html)) !== null
    ) {
      combined +=
        match[1] || match[2] || "";
    }

    if (!combined) return "";

    const decoded = decodeBase64(
      rot13(
        decodeBase64(
          decodeBase64(combined)
        )
      )
    );

    const json = JSON.parse(decoded);

    const encodedUrl =
      decodeBase64(json.o || "").trim();

    return encodedUrl || "";

  } catch (_) {
    return "";
  }
}

// ─────────────────────────────────────────────
// HTML parsers
// ─────────────────────────────────────────────

function extractAnchors(html) {
  const results = [];

  const re =
    /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  let m;

  while ((m = re.exec(html)) !== null) {
    results.push({
      href: m[1],

      text: m[2]
        .replace(/<[^>]+>/g, "")
        .trim()
    });
  }

  return results;
}

// ─────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────

async function searchContent(
  query,
  mainUrl
) {
  try {
    const searchUrl =
      `${mainUrl}/?s=${encodeURIComponent(
        query
      )}`;

    const html =
      await fetchText(searchUrl);

    const anchors =
      extractAnchors(html);

    const normalized =
      normalizeTitle(query);

    for (const a of anchors) {
      const href = fixUrl(
        a.href,
        mainUrl
      );

      if (
        !href.startsWith(mainUrl)
      ) {
        continue;
      }

      const title =
        normalizeTitle(a.text);

      if (
        title.includes(normalized)
      ) {
        return href;
      }
    }

    return null;

  } catch (e) {
    console.error(
      `[4KHDHub] search error`,
      e.message
    );

    return null;
  }
}

// ─────────────────────────────────────────────
// Movie links
// ─────────────────────────────────────────────

function collectMovieLinks(
  html,
  pageUrl
) {
  const links = [];

  const anchors =
    extractAnchors(html);

  for (const a of anchors) {
    const href = fixUrl(
      a.href,
      pageUrl
    );

    if (!href) continue;

    if (
      /hubcloud|hubdrive|hubcdn|pixeldrain/i.test(
        href
      )
    ) {
      links.push({
        url: href,
        label: a.text || "Movie"
      });
    }
  }

  return links;
}

// ─────────────────────────────────────────────
// Resolvers
// ─────────────────────────────────────────────

async function resolveHubcdnDirect(
  url,
  sourceTitle,
  quality
) {
  try {
    const html =
      await fetchText(url, {
        headers: {
          Referer: url
        }
      });

    const encoded =
      html.match(
        /r=([A-Za-z0-9+/=]+)/
      )?.[1] ||
      html
        .match(
          /reurl\s*=\s*"([^"]+)"/
        )?.[1]
        ?.split("?r=")
        .pop();

    if (!encoded) return [];

    const decoded =
      decodeBase64(encoded);

    if (!decoded) return [];

    const finalUrl =
      decoded.split("link=").pop();

    if (!finalUrl) return [];

    return [
      buildStream(
        `${sourceTitle} - HUBCDN`,
        finalUrl,
        quality,
        {
          Referer: url,

          Origin:
            new URL(finalUrl)
              .origin
        }
      )
    ].filter(Boolean);

  } catch (e) {
    console.error(
      `[4KHDHub] hubcdn error`,
      e.message
    );

    return [];
  }
}

async function resolveLink(
  rawUrl,
  sourceTitle,
  referer = "",
  quality = "Auto"
) {
  let url = rawUrl;

  if (!url) return [];

  try {
    if (
      url.includes("id=")
    ) {
      const redirected =
        await getRedirectLinks(
          url
        );

      if (redirected) {
        url = redirected;
      }
    }

    const lower =
      url.toLowerCase();

    if (
      /\.(m3u8|mp4|mkv)(\?|$)/i.test(
        url
      )
    ) {
      return [
        buildStream(
          sourceTitle,
          url,
          quality,
          referer
            ? {
                Referer:
                  referer
              }
            : {}
        )
      ].filter(Boolean);
    }

    if (
      lower.includes("hubcdn")
    ) {
      return await resolveHubcdnDirect(
        url,
        sourceTitle,
        quality
      );
    }

    if (
      lower.includes(
        "pixeldrain"
      )
    ) {
      const pdId =
        url.split("/").pop();

      return [
        buildStream(
          `${sourceTitle} - Pixeldrain`,
          `https://pixeldrain.com/api/file/${pdId}?download`,
          quality,
          referer
            ? {
                Referer:
                  referer
              }
            : {}
        )
      ].filter(Boolean);
    }

    return [];

  } catch (e) {
    console.error(
      `[4KHDHub] resolve error`,
      e.message
    );

    return [];
  }
}

// ─────────────────────────────────────────────
// Main extractor
// ─────────────────────────────────────────────

async function extractStreams(
  tmdbId,
  mediaType,
  season,
  episode
) {
  const {
    trTitle,
    origTitle
  } = await getTmdbTitle(
    tmdbId,
    mediaType
  );

  if (!trTitle && !origTitle) {
    return [];
  }

  const mainUrl =
    await getMainUrl();

  if (!mainUrl) {
    return [];
  }

  let contentUrl =
    await searchContent(
      trTitle,
      mainUrl
    );

  if (
    !contentUrl &&
    origTitle &&
    origTitle !== trTitle
  ) {
    contentUrl =
      await searchContent(
        origTitle,
        mainUrl
      );
  }

  if (!contentUrl) {
    return [];
  }

  const html =
    await fetchText(
      contentUrl
    );

  const links =
    collectMovieLinks(
      html,
      contentUrl
    );

  const allStreams = [];

  for (const linkItem of links) {
    const quality =
      parseQuality(
        linkItem.label
      );

    const resolved =
      await resolveLink(
        linkItem.url,
        linkItem.label,
        contentUrl,
        quality
      );

    for (const s of resolved) {
      if (s) {
        allStreams.push(s);
      }
    }
  }

  return dedupeStreams(
    allStreams.filter(Boolean)
  );
}

// ─────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────

export async function getStreams(
  tmdbId,
  mediaType,
  season,
  episode
) {
  try {
    return await extractStreams(
      tmdbId,
      mediaType,
      season,
      episode
    );
  } catch (e) {
    console.error(
      `[4KHDHub] fatal`,
      e.message
    );

    return [];
  }
}
