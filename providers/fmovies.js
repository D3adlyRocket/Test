/**
 * 4khdhub - Built from src/4khdhub/
 * Generated: 2026-05-11T13:43:18.788Z
 */
var __create = Object.create;
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
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

// src/4khdhub/index.js
var import_cheerio_without_node_native2 = __toESM(require("cheerio-without-node-native"));

// src/4khdhub/utils.js
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  "Cookie": "xla=s4t"
};
function getLatestDomains() {
  return __async(this, null, function* () {
    try {
      const res = yield fetch("https://raw.githubusercontent.com/SaurabhKaperwan/Utils/refs/heads/main/urls.json");
      if (!res.ok)
        throw new Error();
      return yield res.json();
    } catch (e) {
      return {
        "4khdhub": "https://4khdhub.link",
        "hubcloud": "https://hubcloud.foo"
      };
    }
  });
}
var BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
function atob(value) {
  if (!value)
    return "";
  let input = String(value).replace(/=+$/, "");
  let output = "";
  let bc = 0, bs, buffer, idx = 0;
  while (buffer = input.charAt(idx++)) {
    buffer = BASE64_CHARS.indexOf(buffer);
    if (~buffer) {
      bs = bc % 4 ? bs * 64 + buffer : buffer;
      if (bc++ % 4) {
        output += String.fromCharCode(255 & bs >> (-2 * bc & 6));
      }
    }
  }
  return output;
}
function rot13(value) {
  return value.replace(/[a-zA-Z]/g, function(c) {
    return String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26);
  });
}
function cleanTitle(title) {
  let name = title.replace(/\.[a-zA-Z0-9]{2,4}$/, "");
  const normalized = name.replace(/WEB[-_. ]?DL/gi, "WEB-DL").replace(/WEB[-_. ]?RIP/gi, "WEBRIP").replace(/H[ .]?265/gi, "H265").replace(/H[ .]?264/gi, "H264").replace(/(DDP|DD\+|EAC3|AC3)[ .]?([0-9][._ ]?[0-9])/gi, "$1$2").replace(/(DDP|DD\+|EAC3|AC3)[ .]?([0-9])/gi, "$1$2").replace(/([0-9])[._ ]([0-9])(?=(?:p|GB|MB|KB))/gi, "$1.$2");
  const parts = normalized.split(/[\s_.\[\]()]/);
  const sourceTags = /* @__PURE__ */ new Set(["WEB-DL", "WEBRIP", "BLURAY", "HDRIP", "DVDRIP", "HDTV", "CAM", "TS", "BRRIP", "BDRIP"]);
  const codecTags = /* @__PURE__ */ new Set(["H264", "H265", "X264", "X265", "HEVC", "AVC"]);
  const audioTags = ["AAC", "AC3", "DTS", "MP3", "FLAC", "DD", "DDP", "EAC3"];
  const audioExtras = /* @__PURE__ */ new Set(["ATMOS"]);
  const hdrTags = /* @__PURE__ */ new Set(["SDR", "HDR", "HDR10", "HDR10+", "DV", "DOLBYVISION"]);
  const filtered = parts.map((part) => {
    const p = part.toUpperCase();
    if (sourceTags.has(p))
      return p;
    if (codecTags.has(p))
      return p;
    if (audioTags.some((tag) => p.startsWith(tag)))
      return p;
    if (audioExtras.has(p))
      return p;
    if (hdrTags.has(p))
      return p === "DOLBYVISION" || p === "DV" ? "DOLBYVISION" : p;
    if (p === "NF" || p === "CR")
      return p;
    return null;
  }).filter(Boolean);
  return [...new Set(filtered)].join(" ");
}

// src/4khdhub/extractors.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
function getRedirectLinks(url) {
  return __async(this, null, function* () {
    try {
      const response = yield fetch(url, { headers: HEADERS });
      if (!response.ok)
        throw new Error(`HTTP ${response.status}`);
      const doc = yield response.text();
      const regex = /s\s*\(\s*['"]o['"]\s*,\s*['"]([A-Za-z0-9+/=]+)['"]|ck\s*\(\s*['"]_wp_http_\d+['"]\s*,\s*['"]([^'"]+)['"]/g;
      let combinedString = "";
      let match;
      while ((match = regex.exec(doc)) !== null) {
        const extractedValue = match[1] || match[2];
        if (extractedValue)
          combinedString += extractedValue;
      }
      if (!combinedString) {
        const redirectMatch = doc.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/);
        if (redirectMatch && redirectMatch[1]) {
          const newUrl = redirectMatch[1];
          if (newUrl !== url && !newUrl.includes(url)) {
            return yield getRedirectLinks(newUrl);
          }
        }
        return null;
      }
      const decodedString = atob(rot13(atob(atob(combinedString))));
      const jsonObject = JSON.parse(decodedString);
      const encodedUrl = atob(jsonObject.o || "").trim();
      if (encodedUrl)
        return encodedUrl;
      const data = atob(jsonObject.data || "").trim();
      const wpHttp = (jsonObject.blog_url || "").trim();
      if (wpHttp && data) {
        const directLinkResponse = yield fetch(`${wpHttp}?re=${data}`, { headers: HEADERS });
        const html = yield directLinkResponse.text();
        const $ = import_cheerio_without_node_native.default.load(html);
        return ($("body").text() || html).trim();
      }
      return null;
    } catch (e) {
      return null;
    }
  });
}
function vidStackExtractor(url) {
  return __async(this, null, function* () {
    try {
      const hash = url.split("#").pop().split("/").pop();
      const baseUrl = new URL(url).origin;
      const apiUrl = `${baseUrl}/api/v1/video?id=${hash}`;
      const response = yield fetch(apiUrl, { headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: url }) });
      const encoded = (yield response.text()).trim();
      const decryptApi = "https://keys.smashystream.top/dec-vidstack";
      const decryptRes = yield fetch(decryptApi, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": HEADERS["User-Agent"]
        },
        body: JSON.stringify({ text: encoded, type: "1" })
      });
      const decryptedJson = yield decryptRes.json();
      const resultObject = decryptedJson.result;
      if (resultObject && resultObject.source) {
        const m3u8 = resultObject.source.replace(/\\/g, "");
        const subtitles = [];
        if (resultObject.subtitle) {
          const subtitleObject = resultObject.subtitle;
          for (const lang of Object.keys(subtitleObject)) {
            const subPath = subtitleObject[lang].split("#")[0].replace(/\\/g, "");
            if (subPath) {
              subtitles.push({
                language: lang,
                url: subPath.startsWith("http") ? subPath : `${baseUrl}${subPath}`
              });
            }
          }
        }
        return [{
          source: "HubStream",
          quality: "M3U8",
          url: m3u8.replace("https:", "http:"),
          headers: {
            "Referer": url,
            "Origin": url.split("/").pop()
          },
          subtitles
        }];
      }
      return [];
    } catch (e) {
      return [];
    }
  });
}
function hbLinksExtractor(url) {
  return __async(this, null, function* () {
    try {
      const response = yield fetch(url, { headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: url }) });
      const data = yield response.text();
      const $ = import_cheerio_without_node_native.default.load(data);
      const links = $("h3 a, h5 a, div.entry-content p a").map((i, el) => $(el).attr("href")).get();
      const results = yield Promise.all(links.map((l) => loadExtractor(l, url)));
      return results.flat().map((link) => __spreadProps(__spreadValues({}, link), {
        server: link.server || link.source
      }));
    } catch (e) {
      return [];
    }
  });
}
function hubCloudExtractor(url, referer) {
  return __async(this, null, function* () {
    var _a;
    try {
      let currentUrl = url.replace("hubcloud.ink", "hubcloud.dad");
      const pageResponse = yield fetch(currentUrl, { headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: referer }) });
      let pageData = yield pageResponse.text();
      let finalUrl = currentUrl;
      if (!currentUrl.includes("hubcloud.php")) {
        let nextHref = "";
        const $first = import_cheerio_without_node_native.default.load(pageData);
        const downloadBtn = $first("#download");
        if (downloadBtn.length) {
          nextHref = downloadBtn.attr("href");
        } else {
          const scriptUrlMatch = pageData.match(/var url = '([^']*)'/);
          if (scriptUrlMatch)
            nextHref = scriptUrlMatch[1];
        }
        if (nextHref) {
          if (!nextHref.startsWith("http")) {
            const urlObj = new URL(currentUrl);
            nextHref = `${urlObj.protocol}//${urlObj.hostname}/${nextHref.replace(/^\//, "")}`;
          }
          finalUrl = nextHref;
          const secondResponse = yield fetch(finalUrl, { headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: currentUrl }) });
          pageData = yield secondResponse.text();
        }
      }
      const $ = import_cheerio_without_node_native.default.load(pageData);
      const size = $("i#size").text().trim();
      const header = $("div.card-header").text().trim();
      const qualityStr = (_a = header.match(/(\d{3,4})[pP]/)) == null ? void 0 : _a[1];
      const quality = qualityStr ? parseInt(qualityStr) : 1080;
      const headerDetails = cleanTitle(header);
      const sizeInBytes = (() => {
        const sizeMatch = size.match(/([\d.]+)\s*(GB|MB|KB)/i);
        if (!sizeMatch)
          return 0;
        const multipliers = { GB: 1024 ** 3, MB: 1024 ** 2, KB: 1024 };
        return parseFloat(sizeMatch[1]) * (multipliers[sizeMatch[2].toUpperCase()] || 0);
      })();
      const links = [];
      const elements = $("a.btn").get();
      for (const element of elements) {
        const link = $(element).attr("href");
        const text = $(element).text().toLowerCase();
        const fileName = header || headerDetails || "Unknown";
        if (text.includes("download file") || text.includes("fsl server") || text.includes("s3 server") || text.includes("fslv2") || text.includes("mega server")) {
          let label = "HubCloud";
          if (text.includes("fsl server"))
            label = "HubCloud - FSL";
          else if (text.includes("s3 server"))
            label = "HubCloud - S3";
          else if (text.includes("fslv2"))
            label = "HubCloud - FSLv2";
          else if (text.includes("mega server"))
            label = "HubCloud - Mega";
          links.push({ server: label, tags: headerDetails, quality, url: link, size: sizeInBytes, fileName });
        } else if (text.includes("buzzserver")) {
          try {
            const buzzResp = yield fetch(`${link}/download`, { method: "GET", headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: link }), redirect: "manual" });
            let dlink = buzzResp.headers.get("hx-redirect") || buzzResp.headers.get("HX-Redirect");
            if (!dlink && buzzResp.url && buzzResp.url !== `${link}/download`) {
              dlink = buzzResp.url;
            }
            if (dlink) {
              links.push({ server: "HubCloud - BuzzServer", tags: headerDetails, quality, url: dlink, size: sizeInBytes, fileName });
            }
          } catch (e) {
          }
        } else if (text.includes("10gbps")) {
          try {
            const resp = yield fetch(link, { method: "GET", redirect: "manual" });
            const loc = resp.headers.get("location");
            if (loc && loc.includes("link=")) {
              const dlink = loc.substring(loc.indexOf("link=") + 5);
              links.push({ server: "HubCloud - 10Gbps", tags: headerDetails, quality, url: dlink, size: sizeInBytes, fileName });
            }
          } catch (e) {
          }
        } else if (link && link.includes("pixeldra")) {
          const results = yield pixelDrainExtractor(link);
          links.push(...results.map((l) => __spreadProps(__spreadValues({}, l), { server: l.source, tags: headerDetails, size: sizeInBytes, fileName })));
        }
      }
      return links;
    } catch (e) {
      console.error(`[4Khdhub] HubCloud extractor error:`, e.message);
      return [];
    }
  });
}
function hubCdnExtractor(url, referer) {
  return __async(this, null, function* () {
    var _a, _b;
    try {
      const response = yield fetch(url, { headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: referer }) });
      const data = yield response.text();
      const encoded = (_a = data.match(/r=([A-Za-z0-9+/=]+)/)) == null ? void 0 : _a[1];
      if (encoded) {
        const m3u8Link = atob(encoded).substring(atob(encoded).lastIndexOf("link=") + 5);
        return [{ source: "HubCdn", quality: 1080, url: m3u8Link }];
      }
      const scriptEncoded = (_b = data.match(/reurl\s*=\s*["']([^"']+)["']/)) == null ? void 0 : _b[1];
      if (scriptEncoded) {
        const queryPart = scriptEncoded.split("?r=").pop();
        const m3u8Link = atob(queryPart).substring(atob(queryPart).lastIndexOf("link=") + 5);
        return [{ source: "HubCdn", quality: 1080, url: m3u8Link }];
      }
      return [];
    } catch (e) {
      return [];
    }
  });
}
function pixelDrainExtractor(link) {
  return __async(this, null, function* () {
    var _a;
    try {
      const urlObj = new URL(link);
      const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
      const fileId = ((_a = link.match(/(?:file|u)\/([A-Za-z0-9]+)/)) == null ? void 0 : _a[1]) || link.split("/").pop();
      if (!fileId)
        return [{ source: "Pixeldrain", quality: 0, url: link }];
      const finalUrl = link.includes("?download") ? link : `${baseUrl}/api/file/${fileId}?download`;
      return [{ source: "Pixeldrain", quality: 0, url: finalUrl }];
    } catch (e) {
      return [{ source: "Pixeldrain", quality: 0, url: link }];
    }
  });
}
function loadExtractor(url, referer) {
  return __async(this, null, function* () {
    try {
      const hostname = new URL(url).hostname;
      const isRedirect = url.includes("?id=") || hostname.includes("techyboy4u") || hostname.includes("gadgetsweb.xyz") || hostname.includes("cryptoinsights.site") || hostname.includes("bloggingvector") || hostname.includes("ampproject.org");
      if (isRedirect) {
        const finalLink = yield getRedirectLinks(url);
        if (finalLink && finalLink !== url)
          return yield loadExtractor(finalLink, url);
        return [];
      }
      if (hostname.includes("hubcloud"))
        return yield hubCloudExtractor(url, referer);
      if (hostname.includes("hubcdn"))
        return yield hubCdnExtractor(url, referer);
      if (hostname.includes("pixeldrain"))
        return yield pixelDrainExtractor(url);
      if (hostname.includes("hblinks") || hostname.includes("hubstream.dad"))
        return yield hbLinksExtractor(url);
      if (hostname.includes("hubstream") || hostname.includes("vidstack"))
        return yield vidStackExtractor(url);
      if (hostname.includes("hubdrive")) {
        const res = yield fetch(url, { headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: referer }) });
        const data = yield res.text();
        const href = import_cheerio_without_node_native.default.load(data)(".btn.btn-primary.btn-user.btn-success1.m-1").attr("href");
        if (href)
          return yield loadExtractor(href, url);
      }
      return [];
    } catch (e) {
      return [];
    }
  });
}

// src/4khdhub/index.js
function getMediaMetadata(tmdbId, mediaType) {
  return __async(this, null, function* () {
    try {
      const type = mediaType === "tv" ? "tv" : "movie";
      const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;
      const res = yield fetch(url);
      const data = yield res.json();
      const title = mediaType === "tv" ? data.name : data.title;
      const date = mediaType === "tv" ? data.first_air_date : data.release_date;
      const year = date ? date.split("-")[0] : "";
      return { title, year };
    } catch (e) {
      return { title: "", year: "" };
    }
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    console.log(`[4Khdhub] Triggering fetch for ID ${tmdbId}`);
    const streams = [];
    try {
      const domains = yield getLatestDomains();
      const base4k = domains["4khdhub"] || "https://4khdhub.link";
      const baseHub = domains["hubcloud"] || "https://hubcloud.foo";
      const meta = yield getMediaMetadata(tmdbId, mediaType);
      if (!meta.title)
        return [];
      const searchQuery = encodeURIComponent(meta.title);
      const searchUrl = `${base4k}/?s=${searchQuery}`;
      console.log(`[4Khdhub] Searching: ${searchUrl}`);
      const searchResp = yield fetch(searchUrl);
      const searchHtml = yield searchResp.text();
      const $search = import_cheerio_without_node_native2.default.load(searchHtml);
      let detailPageUrl = "";
      $search("div.card-grid > a").each((i, el) => {
        const content = $search(el).find("div.movie-card-content").text().toLowerCase();
        const href = $search(el).attr("href");
        if (content.includes(meta.title.toLowerCase())) {
          detailPageUrl = href;
          return false;
        }
      });
      if (!detailPageUrl) {
        console.warn(`[4Khdhub] No local match found for query "${meta.title}".`);
        return [];
      }
      if (!detailPageUrl.startsWith("http")) {
        detailPageUrl = base4k.replace(/\/+$/, "") + "/" + detailPageUrl.replace(/^\/+/, "");
      }
      console.log(`[4Khdhub] Found target details page: ${detailPageUrl}`);
      const pageResp = yield fetch(detailPageUrl);
      const pageHtml = yield pageResp.text();
      const $page = import_cheerio_without_node_native2.default.load(pageHtml);
      const linksToProcess = [];
      if (mediaType === "movie" || season == null) {
        $page("div.download-item a").each((i, el) => {
          const href = $page(el).attr("href");
          if (href)
            linksToProcess.push(href);
        });
      } else {
        const sStr = String(season).padStart(2, "0");
        const eStr = String(episode).padStart(2, "0");
        const targetTag = `S${sStr}E${eStr}`;
        console.log(`[4Khdhub] Locating specific episode code: ${targetTag}`);
        $page("div.episode-download-item").each((i, el) => {
          const rowHtml = $page(el).html();
          if (rowHtml && rowHtml.includes(targetTag)) {
            $page(el).find("div.episode-links > a").each((j, linkEl) => {
              const href = $page(linkEl).attr("href");
              if (href)
                linksToProcess.push(href);
            });
          }
        });
      }
      console.log(`[4Khdhub] Identified ${linksToProcess.length} raw download anchors to follow.`);
      for (let entryUrl of linksToProcess) {
        try {
          console.log(`[DEBUG] Processing anchor: ${entryUrl}`);
          const extracted = yield loadExtractor(entryUrl, detailPageUrl);
          if (extracted && extracted.length > 0) {
            extracted.forEach((link) => {
              const qualityStr = typeof link.quality === "number" ? `${link.quality}p` : link.quality;
              const sizeStr = link.size ? `${(link.size / (1024 * 1024 * 1024)).toFixed(2)} GB` : "";
              const tagsStr = link.tags ? link.tags.trim() : "";
              const nameParts = [link.server || link.source || "HubCloud", tagsStr].filter((p) => p && p.trim() !== "");
              const titleParts = [qualityStr, sizeStr].filter((p) => p && p.trim() !== "");
              streams.push({
                name: nameParts.join(" \u2022 "),
                title: titleParts.join(" \u2022 "),
                url: link.url,
                quality: qualityStr,
                size: sizeStr,
                subtitles: link.subtitles,
                provider: "4khdhub"
              });
            });
          }
        } catch (err) {
          console.warn(`[4Khdhub] Skipping single node extraction failure.`);
        }
      }
    } catch (error) {
      console.error(`[4Khdhub] Critical crash during run:`, error.message);
    }
    console.log(`[4Khdhub] Successfully produced ${streams.length} finalized streams.`);
    return streams;
  });
}
module.exports = { getStreams };
