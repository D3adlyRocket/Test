// movies4u.js
// Fixed Nuvio-compatible Movies4u provider
// CLEAN RESOLUTION-MAPPED VERSION

const cheerio = require("cheerio");

const DOMAINS_URL =
  "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";

const FALLBACK_URL =
  "https://new1.movies4u.finance";

const TMDB_API_KEY =
  "1865f43a0549ca50d341dd9ab8b29f49";

const HUB_CLOUD_API =
  "https://hc-zf3c.vercel.app";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",

  Referer: FALLBACK_URL,

  Cookie: "xla=s4t"
};

let cachedBaseUrl = null;

// =======================
// BASE URL
// =======================

async function getBaseUrl() {

  if (cachedBaseUrl)
    return cachedBaseUrl;

  try {

    const resp = await fetch(
      DOMAINS_URL,
      {
        skipSizeCheck: true
      }
    );

    const data =
      await resp.json();

    cachedBaseUrl =
      data.movies4u ||
      data.movies4uhd ||
      FALLBACK_URL;

  } catch (_) {

    cachedBaseUrl =
      FALLBACK_URL;
  }

  return cachedBaseUrl;
}

// =======================
// QUALITY PARSER
// =======================

function extractResolutionFromBlock(text) {

  const t =
    (text || "")
      .toLowerCase();

  if (
    t.includes("2160p") ||
    t.includes("4k")
  ) {
    return "4K";
  }

  if (t.includes("1080p")) {
    return "1080p";
  }

  if (t.includes("720p")) {
    return "720p";
  }

  if (t.includes("480p")) {
    return "480p";
  }

  if (t.includes("360p")) {
    return "360p";
  }

  return "Unknown";
}

// =======================
// EXTRA META
// =======================

function parseExtraMetadata(text) {

  const norm =
    (text || "")
      .toUpperCase();

  let lang =
    "Multi-Audio";

  if (
    norm.includes("DUAL")
  ) {
    lang = "Multi Audio";
  }

  if (
    norm.includes("ENGLISH") &&
    !norm.includes("HINDI")
  ) {
    lang = "English";
  }

  const sizeMatch =
    norm.match(
      /(\d+(?:\.\d+)?\s*[MGB]B)/i
    );

  let size =
    sizeMatch
      ? sizeMatch[0]
          .replace(/\s+/g, "")
      : "N/A";

  let format = "MKV";

  if (
    norm.includes("MP4")
  ) {
    format = "MP4";
  }

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

  if (
    norm.includes("HDR")
  ) {
    extras.push("HDR");
  }

  if (
    norm.includes("DOLBY") ||
    norm.includes("DV") ||
    norm.includes("VISION") ||
    norm.includes("ATMOS") ||
    norm.includes("DD5")
  ) {
    extras.push(
      "Dolby Vision/5.1"
    );
  }

  if (
    norm.includes("10BIT")
  ) {
    extras.push("10-Bit");
  }

  if (
    norm.includes("REMUX")
  ) {
    extras.push("Remux");
  }

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

function cleanServerName(
  serverText
) {

  if (!serverText)
    return "HubCloud";

  let clean =
    serverText.toLowerCase();

  if (
    clean.includes("fsl") ||
    clean.includes("fast")
  ) {
    return "FSL Server";
  }

  if (
    clean.includes("pixel")
  ) {
    return "PixelDrain";
  }

  if (
    clean.includes("drive") ||
    clean.includes("gdrive")
  ) {
    return "Cloud Drive";
  }

  clean = clean
    .replace(
      /download|links?|button|server|\s+/gi,
      " "
    )
    .trim();

  clean = clean
    .replace(
      /[\[\]\(\)]/g,
      ""
    )
    .trim();

  return (
    clean
      .split(" ")
      .map(
        word =>
          word.charAt(0)
            .toUpperCase() +
          word.slice(1)
      )
      .join(" ") +
    " Server"
  );
}

// =======================
// HUBCLOUD EXTRACTOR
// =======================

async function resolveAllHubCloudLinks(
  hubCloudUrl
) {

  try {

    const apiURL =
      `${HUB_CLOUD_API}/api/extract?url=` +
      encodeURIComponent(
        hubCloudUrl
      );

    const resp = await fetch(
      apiURL,
      {
        headers: {
          Accept:
            "application/json"
        },

        skipSizeCheck: true
      }
    );

    const data =
      await resp.json();

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
// FILESIZE
// =======================

async function detectFileSize(
  url,
  headers = {}
) {

  try {

    const resp = await fetch(
      url,
      {
        method: "HEAD",

        headers,

        skipSizeCheck: true,

        redirect: "follow"
      }
    );

    const size =
      resp.headers.get(
        "content-length"
      );

    if (!size)
      return null;

    const bytes =
      parseInt(size);

    if (
      bytes >=
      1024 *
        1024 *
        1024
    ) {

      return (
        (
          bytes /
          (
            1024 *
            1024 *
            1024
          )
        ).toFixed(1) + "GB"
      );
    }

    return (
      Math.round(
        bytes /
          (1024 * 1024)
      ) + "MB"
    );

  } catch (_) {}

  return null;
}

// =======================
// JS UNPACKER
// =======================

function unpackJS(
  p,
  a,
  c,
  k
) {

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

async function extractDirectM3u8(
  playerUrl
) {

  try {

    const resp =
      await fetch(
        playerUrl,
        {
          headers: {
            ...HEADERS,

            Referer:
              "https://m4uplay.store/"
          },

          skipSizeCheck: true
        }
      );

    const html =
      await resp.text();

    let m3u8 =
      html.match(
        /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i
      )?.[0] ||

      html.match(
        /https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/i
      )?.[0];

    if (!m3u8) {

      const rel =
        html.match(
          /\/(?:3o|stream)\/[^\s"'<>]+(?:m3u8|txt)/i
        )?.[0];

      if (rel) {

        m3u8 =
          "https://m4uplay.store" +
          rel;
      }
    }

    if (!m3u8) {

      const packedMatch =
        html.match(
          /eval\(function\(p,a,c,k,e,d\).*?\}\('(.*)',(\d+),(\d+),'(.*)'\.split\('\|'\)/s
        );

      if (packedMatch) {

        const unpacked =
          unpackJS(
            packedMatch[1],

            parseInt(
              packedMatch[2]
            ),

            parseInt(
              packedMatch[3]
            ),

            packedMatch[4].split(
              "|"
            )
          );

        m3u8 =
          unpacked.match(
            /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i
          )?.[0];
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
// MAIN ENGINE
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

    const tmdbUrl =
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    const mediaInfo =
      await (
        await fetch(
          tmdbUrl,
          {
            skipSizeCheck: true
          }
        )
      ).json();

    const title =
      mediaInfo.title ||
      mediaInfo.name;

    if (!title)
      return [];

    const releaseYear =
      (
        mediaInfo.release_date ||
        mediaInfo.first_air_date ||
        ""
      ).split("-")[0] ||
      "N/A";

    const runTime =
      mediaInfo.runtime
        ? `${mediaInfo.runtime} min`
        : "N/A";

    // =======================
    // SEARCH
    // =======================

    const searchResp =
      await fetch(
        `${BASE_URL}/?s=${encodeURIComponent(title)}`,
        {
          headers: HEADERS,
          skipSizeCheck: true
        }
      );

    const searchHtml =
      await searchResp.text();

    const $ =
      cheerio.load(
        searchHtml
      );

    const results = [];

    $("article").each(
      (i, el) => {

        const a = $(el)
          .find(
            "h2 a, h3 a, a[rel='bookmark']"
          )
          .first();

        let href =
          a.attr("href");

        const name =
          a.text().trim();

        if (
          href &&
          name
        ) {

          if (
            !href.startsWith(
              "http"
            )
          ) {

            href =
              BASE_URL +
              "/" +
              href.replace(
                /^\/+/,
                ""
              );
          }

          results.push({
            href,
            name
          });
        }
      }
    );

    if (!results.length)
      return [];

    const match =
      results.find(r =>
        r.name
          .toLowerCase()
          .includes(
            title.toLowerCase()
          )
      ) || results[0];

    if (!match)
      return [];

    // =======================
    // PAGE
    // =======================

    const pageResp =
      await fetch(
        match.href,
        {
          headers: HEADERS,
          skipSizeCheck: true
        }
      );

    const pageHtml =
      await pageResp.text();

    const $page =
      cheerio.load(
        pageHtml
      );

    const rawStreamsList =
      [];

    // =======================
    // REDIRECT PAGES
    // =======================

    const uniqueRedirectPages =
      [];

    $page("a[href]").each(
      (i, el) => {

        const href =
          $(el).attr(
            "href"
          ) || "";

        const text =
          $(el).text() || "";

        if (
          href.includes(
            "m4ulinks.com"
          ) &&
          text
            .toLowerCase()
            .includes(
              "download links"
            )
        ) {

          if (
            !uniqueRedirectPages.some(
              p =>
                p.href ===
                href
            )
          ) {

            uniqueRedirectPages.push(
              {
                href
              }
            );
          }
        }
      }
    );

    // =======================
    // PROCESS PAGES
    // =======================

    for (const redirectPage of uniqueRedirectPages) {

      try {

        const innerResp =
          await fetch(
            redirectPage.href,
            {
              headers:
                HEADERS,

              skipSizeCheck: true
            }
          );

        const innerHtml =
          await innerResp.text();

        const $inner =
          cheerio.load(
            innerHtml
          );

        const downloadBlocks =
          [];

        $inner(
          "div, p, li"
        ).each((i, el) => {

          const block =
            $inner(el);

          const text =
            block
              .text()
              .replace(
                /\s+/g,
                " "
              )
              .trim();

          if (
            !text ||
            text.length < 20
          ) {
            return;
          }

          const links =
            [];

          block
            .find("a[href]")
            .each(
              (_, a) => {

                const href =
                  $inner(a).attr(
                    "href"
                  ) || "";

                if (
                  href.includes(
                    "hubcloud"
                  ) ||
                  href.includes(
                    "hub-cloud"
                  ) ||
                  href.includes(
                    "m4uplay.store"
                  )
                ) {

                  links.push(
                    href
                  );
                }
              }
            );

          if (!links.length)
            return;

          downloadBlocks.push(
            {
              text,
              links
            }
          );
        });

        // =======================
        // PROCESS BLOCKS
        // =======================

        for (const block of downloadBlocks) {

          const quality =
            extractResolutionFromBlock(
              block.text
            );

          const meta =
            parseExtraMetadata(
              block.text
            );

          for (const href of block.links) {

            // =======================
            // M4UPLAY
            // =======================

            if (
              href.includes(
                "m4uplay.store"
              )
            ) {

              const directM3u8 =
                await extractDirectM3u8(
                  href
                );

              if (
                directM3u8
              ) {

                const detectedSize =
                  await detectFileSize(
                    directM3u8,
                    {
                      Referer:
                        "https://m4uplay.store/"
                    }
                  );

                rawStreamsList.push(
                  {
                    server:
                      "M4U Player",

                    quality:
                      quality !==
                      "Unknown"
                        ? quality
                        : "720p",

                    meta: {
                      ...meta,

                      size:
                        meta.size !==
                        "N/A"
                          ? meta.size
                          : (
                              detectedSize ||
                              "N/A"
                            )
                    },

                    url:
                      directM3u8,

                    headers: {
                      Referer:
                        "https://m4uplay.store/",

                      Origin:
                        "https://m4uplay.store",

                      "User-Agent":
                        HEADERS[
                          "User-Agent"
                        ]
                    }
                  }
                );
              }

            } else {

              // =======================
              // HUBCLOUD
              // =======================

              const extractedLinks =
                await resolveAllHubCloudLinks(
                  href
                );

              for (const linkItem of extractedLinks) {

                const detectedSize =
                  await detectFileSize(
                    linkItem.url,
                    {
                      "User-Agent":
                        HEADERS[
                          "User-Agent"
                        ]
                    }
                  );

                rawStreamsList.push(
                  {
                    server:
                      cleanServerName(
                        linkItem.label ||
                          "HubCloud"
                      ),

                    quality:
                      quality !==
                      "Unknown"
                        ? quality
                        : "720p",

                    meta: {
                      language:
                        meta.language,

                      size:
                        meta.size !==
                        "N/A"
                          ? meta.size
                          : (
                              detectedSize ||
                              "N/A"
                            ),

                      format:
                        meta.format,

                      extras:
                        meta.extras
                    },

                    url:
                      linkItem.url,

                    headers: {
                      "User-Agent":
                        HEADERS[
                          "User-Agent"
                        ]
                    }
                  }
                );
              }
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
      Unknown: 0
    };

    rawStreamsList.sort(
      (a, b) => {

        return (
          (qualityWeights[
            b.quality
          ] || 0) -
          (qualityWeights[
            a.quality
          ] || 0)
        );
      }
    );

    // =======================
    // FINAL OUTPUT
    // =======================

    const finalStreams =
      rawStreamsList.map(
        stream => {

          const epInfo =
            mediaType ===
            "series"
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
        }
      );

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
