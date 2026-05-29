// movies4u.js
// Fixed Nuvio-compatible Movies4u provider with Custom 4-Line Layout
// MINIMAL SAFE PATCH VERSION (keeps original scraper logic intact)

const cheerio = require("cheerio");

const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const FALLBACK_URL = "https://new1.movies4u.finance";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const HUB_CLOUD_API = "https://hc-zf3c.vercel.app";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Referer": FALLBACK_URL,
  "Cookie": "xla=s4t"
};

let cachedBaseUrl = null;

async function getBaseUrl() {
  if (cachedBaseUrl) return cachedBaseUrl;

  try {
    const resp = await fetch(DOMAINS_URL, { skipSizeCheck: true });
    const data = await resp.json();

    cachedBaseUrl =
      data.movies4u ||
      data.movies4uhd ||
      FALLBACK_URL;

  } catch (_) {
    cachedBaseUrl = FALLBACK_URL;
  }

  return cachedBaseUrl;
}

// =======================
// FIXED QUALITY ENGINE
// =======================

function extractQuality(text) {
  const u = (text || "").toLowerCase();

  if (/\b2160p\b|\b4k\b|\buhd\b/.test(u)) return "4K";
  if (/\b1080p\b|\b1080\b/.test(u)) return "1080p";
  if (/\b720p\b|\b720\b/.test(u)) return "720p";
  if (/\b480p\b|\b480\b/.test(u)) return "480p";
  if (/\b360p\b|\b360\b/.test(u)) return "360p";

  return "Unknown";
}

// =======================
// EXTRA META
// =======================

function parseExtraMetadata(text) {
  const norm = (text || "").toUpperCase();

  let lang = "Multi-Audio";

  if (norm.includes("DUAL")) lang = "Multi Audio";

  if (
    norm.includes("ENGLISH") &&
    !norm.includes("HINDI")
  ) {
    lang = "English";
  }

  const sizeMatch = norm.match(/(\d+(?:\.\d+)?\s*[MGB]B)/i);

  let size = sizeMatch
    ? sizeMatch[0].replace(/\s+/g, "")
    : "N/A";

  if (size === "N/A") {
    const backupMatch = norm.match(/(\d+\.\d+)\s?G/i);

    if (backupMatch) {
      size = backupMatch[1] + "GB";
    }
  }

  let format = "MKV";

  if (norm.includes("MP4")) format = "MP4";

  if (
    norm.includes("HEVC") ||
    norm.includes("X265") ||
    norm.includes("H265")
  ) {
    format += " (x265)";
  } else if (
    norm.includes("X264") ||
    norm.includes("H264")
  ) {
    format += " (x264)";
  }

  const extras = [];

  if (norm.includes("HDR")) extras.push("HDR");

  if (
    norm.includes("DOLBY") ||
    norm.includes("DV") ||
    norm.includes("VISION") ||
    norm.includes("ATMOS") ||
    norm.includes("DD5")
  ) {
    extras.push("Dolby Vision/5.1");
  }

  if (norm.includes("10BIT")) extras.push("10-Bit");

  if (norm.includes("REMUX")) extras.push("Remux");

  return {
    language: lang,
    size,
    format,
    extras:
      extras.length > 0
        ? extras.join(" | ")
        : "Standard Dynamic Range"
  };
}

// =======================
// SERVER CLEANER
// =======================

function cleanServerName(serverText) {
  if (!serverText) return "HubCloud";

  let clean = serverText.toLowerCase();

  if (
    clean.includes("fsl") ||
    clean.includes("fast")
  ) {
    return "FSL Server";
  }

  if (clean.includes("pixel")) {
    return "PixelDrain";
  }

  if (
    clean.includes("drive") ||
    clean.includes("gdrive")
  ) {
    return "Cloud Drive";
  }

  clean = clean
    .replace(/download|links?|button|server|\s+/gi, " ")
    .trim();

  clean = clean.replace(/[\[\]\(\)]/g, "").trim();

  return (
    clean
      .split(" ")
      .map(
        word =>
          word.charAt(0).toUpperCase() +
          word.slice(1)
      )
      .join(" ") + " Server"
  );
}

// =======================
// HUBCLOUD EXTRACTOR
// =======================

async function resolveAllHubCloudLinks(hubCloudUrl) {
  try {

    const apiURL =
      `${HUB_CLOUD_API}/api/extract?url=` +
      encodeURIComponent(hubCloudUrl);

    const resp = await fetch(apiURL, {
      headers: {
        "Accept": "application/json"
      },
      skipSizeCheck: true
    });

    const data = await resp.json();

    if (
      data &&
      data.links &&
      data.links.length > 0
    ) {
      return data.links;
    }

  } catch (err) {
    console.error(
      "[Movies4u] HubCloud resolution failed:",
      err
    );
  }

  return [];
}

// =======================
// REAL M3U8 QUALITY PARSER
// =======================

async function detectM3U8Quality(url, headers = {}) {

  try {

    // first try filename/url
    const fromUrl = extractQuality(
      decodeURIComponent(url)
    );

    if (fromUrl !== "Unknown") {
      return fromUrl;
    }

    // fetch actual playlist
    const resp = await fetch(url, {
      headers,
      skipSizeCheck: true
    });

    const text = await resp.text();

    // parse master playlist resolutions
    const matches = [
      ...text.matchAll(
        /RESOLUTION=(\d+)x(\d+)/g
      )
    ];

    if (!matches.length) return null;

    let highest = 0;

    for (const m of matches) {

      const h = parseInt(m[2]);

      if (h > highest) {
        highest = h;
      }
    }

    if (highest >= 2160) return "4K";
    if (highest >= 1080) return "1080p";
    if (highest >= 720) return "720p";
    if (highest >= 480) return "480p";

  } catch (_) {}

  return null;
}

    async function detectRealQuality(url, fallback = "1080p") {

  try {

    const decoded =
      decodeURIComponent(url);

    // STRICT filename parsing ONLY
    const filenameMatch = decoded.match(
      /(?:2160p|1080p|720p|480p|360p)/i
    );

    if (filenameMatch) {

      return extractQuality(
        filenameMatch[0]
      );
    }

    // REAL filesize heuristic
    const size =
      await detectFileSize(url);

    if (size) {

      const value =
        parseFloat(size);

      if (!isNaN(value)) {

        const gb =
          size.toUpperCase().includes("MB")
            ? value / 1024
            : value;

        // MUCH BETTER RANGES
        if (gb >= 15) return "4K";
        if (gb >= 3.5) return "1080p";
        if (gb >= 1.2) return "720p";
        if (gb >= 0.45) return "480p";
        return "360p";
      }
    }

  } catch (_) {}

  return fallback || "720p";
}

    // 3. Filesize heuristic
    const size = await detectFileSize(url);

    if (size) {

      const gb =
        parseFloat(size);

      if (!isNaN(gb)) {

        if (gb >= 12) return "4K";
        if (gb >= 3) return "1080p";
        if (gb >= 1.2) return "720p";
        if (gb >= 0.5) return "480p";
      }
    }

  } catch (_) {}

  return fallback || "1080p";
}

// =======================
// FILE SIZE DETECTOR
// =======================

async function detectFileSize(url, headers = {}) {

  try {

    const resp = await fetch(url, {
      method: "HEAD",
      headers,
      skipSizeCheck: true,
      redirect: "follow"
    });

    const size =
      resp.headers.get("content-length");

    if (!size) return null;

    const bytes = parseInt(size);

    if (bytes >= 1024 * 1024 * 1024) {

      return (
        (
          bytes /
          (1024 * 1024 * 1024)
        ).toFixed(1) + "GB"
      );
    }

    return Math.round(
      bytes / (1024 * 1024)
    ) + "MB";

  } catch (_) {}

  return null;
}

// =======================
// URL META
// =======================

function extractMetadataFromUrl(url) {

  const decoded =
    decodeURIComponent(url);

  return {
    quality:
      extractQuality(decoded),

    meta:
      parseExtraMetadata(decoded)
  };
}

// =======================
// JS UNPACKER
// =======================

function unpackJS(p, a, c, k) {

  while (c--) {

    if (k[c]) {

      p = p.replace(
        new RegExp(
          "\\b" +
          c.toString(a) +
          "\\b",
          "g"
        ),
        k[c]
      );
    }
  }

  return p;
}

// =======================
// DIRECT PLAYER PARSER
// =======================

async function extractDirectM3u8(playerUrl) {

  try {

    const resp = await fetch(playerUrl, {
      headers: {
        ...HEADERS,
        Referer:
          "https://m4uplay.store/"
      },
      skipSizeCheck: true
    });

    const html = await resp.text();

    let m3u8 =
      html.match(
        /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i
      )?.[0] ||

      html.match(
        /https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/i
      )?.[0];

    if (!m3u8) {

      const rel = html.match(
        /\/(?:3o|stream)\/[^\s"'<>]+(?:m3u8|txt)/i
      )?.[0];

      if (rel) {
        m3u8 =
          "https://m4uplay.store" + rel;
      }
    }

    // packed js fallback
    if (!m3u8) {

      const packedMatch = html.match(
        /eval\(function\(p,a,c,k,e,d\).*?\}\('(.*)',(\d+),(\d+),'(.*)'\.split\('\|'\)/s
      );

      if (packedMatch) {

        const unpacked = unpackJS(
          packedMatch[1],
          parseInt(packedMatch[2]),
          parseInt(packedMatch[3]),
          packedMatch[4].split("|")
        );

        m3u8 =
          unpacked.match(
            /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i
          )?.[0] ||

          unpacked.match(
            /https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/i
          )?.[0];

        if (!m3u8) {

          const rel = unpacked.match(
            /\/(?:3o|stream)\/[^\s"'<>]+(?:m3u8|txt)/i
          )?.[0];

          if (rel) {
            m3u8 =
              "https://m4uplay.store" + rel;
          }
        }
      }
    }

    if (m3u8) {
      return m3u8.replace(
        "master.txt",
        "master.m3u8"
      );
    }

  } catch (e) {
    console.error(
      "[Movies4u] Player direct parsing failed:",
      e
    );
  }

  return null;
}

// =======================
// MAIN STREAM ENGINE
// =======================

async function getStreams(
  tmdbId,
  mediaType = "movie",
  season = null,
  episode = null
) {

  try {

    const BASE_URL =
      await getBaseUrl();

    // TMDB
    const tmdbUrl =
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    const mediaInfo =
      await (
        await fetch(tmdbUrl, {
          skipSizeCheck: true
        })
      ).json();

    const title =
      mediaInfo.title ||
      mediaInfo.name;

    if (!title) return [];

    const releaseYear =
      (
        mediaInfo.release_date ||
        mediaInfo.first_air_date ||
        ""
      ).split("-")[0] || "N/A";

    const runTime =
      mediaInfo.runtime
        ? `${mediaInfo.runtime} min`
        : "N/A";

    // SEARCH
    const searchResp = await fetch(
      `${BASE_URL}/?s=${encodeURIComponent(title)}`,
      {
        headers: HEADERS,
        skipSizeCheck: true
      }
    );

    const searchHtml =
      await searchResp.text();

    const $ =
      cheerio.load(searchHtml);

    const results = [];

    $("article").each((i, el) => {

      const a = $(el)
        .find(
          "h2 a, h3 a, a[rel='bookmark']"
        )
        .first();

      let href = a.attr("href");

      const name =
        a.text().trim();

      if (href && name) {

        if (!href.startsWith("http")) {
          href =
            BASE_URL +
            "/" +
            href.replace(/^\/+/, "");
        }

        results.push({
          href,
          name
        });
      }
    });

    if (!results.length) return [];

    const match =
      results.find(r =>
        r.name
          .toLowerCase()
          .includes(title.toLowerCase())
      ) ||
      results[0];

    if (!match) return [];

    // PAGE
    const pageResp = await fetch(
      match.href,
      {
        headers: HEADERS,
        skipSizeCheck: true
      }
    );

    const pageHtml =
      await pageResp.text();

    const $page =
      cheerio.load(pageHtml);

    const rawStreamsList = [];

    const siteTitleContext =
      match.name;

    // =======================
    // DIRECT PLAYER LINKS
    // =======================

    const directWatchLinks = [];

    $page(
      "a.btn.btn-zip, a[href*='m4uplay.store']"
    ).each((i, el) => {

      const href =
        $(el).attr("href");

      const textContext =
        $(el).text() || "";

      if (
        href &&
        !directWatchLinks.some(
          item => item.href === href
        )
      ) {
        directWatchLinks.push({
          href,
          text: textContext
        });
      }
    });

    for (const item of directWatchLinks) {

      const directM3u8 =
        await extractDirectM3u8(
          item.href
        );

      if (directM3u8) {

        let quality =
          extractQuality(
            item.text +
            " " +
            item.href +
            " " +
            siteTitleContext
          );

        const meta =
          parseExtraMetadata(
            item.text +
            " " +
            item.href +
            " " +
            siteTitleContext
          );

        const urlMeta =
          extractMetadataFromUrl(
            directM3u8
          );

        const detectedQuality =
          await detectM3U8Quality(
            directM3u8,
            {
              Referer:
                "https://m4uplay.store/"
            }
          );

        const detectedSize =
          await detectFileSize(
            directM3u8,
            {
              Referer:
                "https://m4uplay.store/"
            }
          );

        rawStreamsList.push({

          server:
            "Player Direct",

          quality:
            quality !== "Unknown"
              ? quality
              : (
                  urlMeta.quality !==
                  "Unknown"
                    ? urlMeta.quality
                    : (
                        detectedQuality ||
                        "1080p"
                      )
                ),

          meta: {
            ...meta,
            ...urlMeta.meta,

            // FIXED
            size:
              detectedSize ||
              urlMeta.meta.size ||
              meta.size
          },

          url:
            directM3u8,

          headers: {
            Referer:
              "https://m4uplay.store/",
            Origin:
              "https://m4uplay.store",
            "User-Agent":
              HEADERS["User-Agent"]
          }
        });
      }
    }

    // =======================
    // MOVIES
    // =======================

    const uniqueRedirectPages = [];

    $page("a[href]").each((i, el) => {

      const href =
        $(el).attr("href") || "";

      const text =
        $(el).text() || "";

      if (
        href.includes("m4ulinks.com") &&
        text
          .toLowerCase()
          .includes("download links")
      ) {

        if (
          !uniqueRedirectPages.some(
            p => p.href === href
          )
        ) {

          uniqueRedirectPages.push({
            href,
            parentText: text
          });
        }
      }
    });

    for (const redirectPage of uniqueRedirectPages) {

      try {

        const innerResp = await fetch(
          redirectPage.href,
          {
            headers: HEADERS,
            skipSizeCheck: true
          }
        );

        const innerHtml =
          await innerResp.text();

        const $inner =
          cheerio.load(innerHtml);

        const targetUrls = [];

        $inner(
          "h1, h2, h3, h4, h5, h6, p, a.btn, a[href]"
        ).each((i, el) => {

          const currentElement =
            $inner(el);

          let href =
            currentElement.attr("href") || "";

          let contextText =
            currentElement.text() || "";

          if (!href) {

            const localAnchor =
              currentElement
                .find("a[href]")
                .first();

            if (localAnchor.length) {

              href =
                localAnchor.attr("href") || "";

              contextText +=
                " " +
                localAnchor.text();
            }
          }

          if (
            href.includes("hubcloud") ||
            href.includes("hub-cloud") ||
            href.includes("m4uplay.store")
          ) {

            if (
              !targetUrls.some(
                t => t.href === href
              )
            ) {

              const nearText =
                currentElement
                  .parent()
                  .text() || "";

              targetUrls.push({
                href,
                contextualText:
                  contextText +
                  " " +
                  nearText
              });
            }
          }
        });

        for (const target of targetUrls) {

          let quality =
            extractQuality(
              target.contextualText +
              " " +
              redirectPage.parentText +
              " " +
              siteTitleContext
            );

          const meta =
            parseExtraMetadata(
              target.contextualText +
              " " +
              redirectPage.parentText +
              " " +
              siteTitleContext
            );

          // =======================
          // M4UPLAY
          // =======================

          if (
            target.href.includes(
              "m4uplay.store"
            )
          ) {

            const directM3u8 =
              await extractDirectM3u8(
                target.href
              );

            if (directM3u8) {

              const urlMeta =
                extractMetadataFromUrl(
                  directM3u8
                );

              const detectedQuality =
                await detectM3U8Quality(
                  directM3u8,
                  {
                    Referer:
                      "https://m4uplay.store/"
                  }
                );

              const detectedSize =
                await detectFileSize(
                  directM3u8,
                  {
                    Referer:
                      "https://m4uplay.store/"
                  }
                );

              if (
                quality === "Unknown"
              ) {

                quality =
                  extractQuality(
                    target.href +
                    " " +
                    directM3u8
                  );
              }

              rawStreamsList.push({

                server:
                  "M4U Player",

                quality:
                  quality !== "Unknown"
                    ? quality
                    : (
                        urlMeta.quality !==
                        "Unknown"
                          ? urlMeta.quality
                          : (
                              detectedQuality ||
                              "1080p"
                            )
                      ),

                meta: {
                  ...meta,
                  ...urlMeta.meta,

                  // FIXED
                  size:
                    detectedSize ||
                    urlMeta.meta.size ||
                    meta.size
                },

                url:
                  directM3u8,

                headers: {
                  Referer:
                    "https://m4uplay.store/",
                  Origin:
                    "https://m4uplay.store",
                  "User-Agent":
                    HEADERS["User-Agent"]
                }
              });
            }

          } else {

            // =======================
            // HUBCLOUD
            // =======================

            const extractedLinks =
              await resolveAllHubCloudLinks(
                target.href
              );

            for (const linkItem of extractedLinks) {

              const searchString =
                `${linkItem.label || ""} ${linkItem.url || ""} ${target.contextualText} ${redirectPage.parentText} ${siteTitleContext}`;

              const innerMeta =
                parseExtraMetadata(
                  searchString
                );

              let finalQuality =
                extractQuality(
                  searchString
                );

              if (
                finalQuality === "Unknown"
              ) {

                finalQuality =
                  quality !== "Unknown"
                    ? quality
                    : "1080p";
              }

              const urlMeta =
                extractMetadataFromUrl(
                  linkItem.url
                );

              const detectedSize =
                await detectFileSize(
                  linkItem.url,
                  {
                    "User-Agent":
                      HEADERS["User-Agent"]
                  }
                );

              rawStreamsList.push({

                server:
                  cleanServerName(
                    linkItem.label ||
                    "HubCloud"
                  ),

                quality: await detectRealQuality(linkItem.url, finalQuality),

                meta: {

                  language:
                    innerMeta.language !==
                    "Multi-Audio"
                      ? innerMeta.language
                      : meta.language,

                  size:
                    detectedSize ||
                    (
                      innerMeta.size !== "N/A"
                        ? innerMeta.size
                        : (
                            urlMeta.meta.size !==
                            "N/A"
                              ? urlMeta.meta.size
                              : (
                                  meta.size !==
                                  "N/A"
                                    ? meta.size
                                    : "1.4GB"
                                )
                          )
                    ),

                  format:
                    innerMeta.format,

                  extras:
                    innerMeta.extras
                },

                url:
                  linkItem.url,

                headers: {
                  "User-Agent":
                    HEADERS["User-Agent"]
                }
              });
            }
          }
        }

      } catch (_) {}
    }

    // =======================
    // SORTING
    // =======================

    const qualityWeights = {
      "4K": 100,
      "1080p": 50,
      "720p": 25,
      "480p": 10,
      "360p": 5,
      "Unknown": 0
    };

    rawStreamsList.sort((a, b) => {

      return (
        (qualityWeights[b.quality] || 0) -
        (qualityWeights[a.quality] || 0)
      );
    });

    // =======================
    // FINAL OUTPUT
    // =======================

    const finalStreams =
      rawStreamsList.map(stream => {

        const epInfo =
          mediaType === "series"
            ? ` - S${season || 1}E${episode || 1}`
            : "";

        return {

          name:
            `Movies4u | ${stream.quality} | [${stream.server}]`,

          title:
            `🎬 ${title}${epInfo} - ${releaseYear}\n` +
            `⚡ ${stream.quality} | 🌍 ${stream.meta.language} | 💾 ${stream.meta.size}\n` +
            `🎞️ ${stream.meta.format} | ⏱️ ${runTime} | 🛠️ ${stream.meta.extras}`,

          quality:
            stream.quality,

          url:
            stream.url,

          headers:
            stream.headers,

          subtitles: []
        };
      });

    return finalStreams;

  } catch (e) {

    console.error(
      "[Movies4u Code Error]",
      e
    );

    return [];
  }
}

module.exports = {
  getStreams
};
