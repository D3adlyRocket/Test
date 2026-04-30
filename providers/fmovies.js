/**
 * FourKHDHub - Built from src/FourKHDHub/
 * Generated: 2026-04-29T15:14:47.784Z
 */

// ------------------ ORIGINAL BOILERPLATE (UNCHANGED) ------------------
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
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ------------------ 🔥 FIXED QUALITY FUNCTION ------------------
function parseQuality(text = "") {
  const value = text.toLowerCase();
  if (/2160p|4k|uhd/.test(value)) return "2160p";
  if (/1440p|2k/.test(value)) return "1440p";
  if (/1080p|fullhd|fhd/.test(value)) return "1080p";
  if (/720p|hd/.test(value)) return "720p";
  if (/480p/.test(value)) return "480p";
  if (/360p/.test(value)) return "360p";
  return "Unknown";
}

// ------------------ 🔥 FIXED BUILD STREAM ------------------
function buildStream(title, url, quality = null, headers = {}) {
  const combined = `${title} ${url}`;
  const finalQuality = quality || parseQuality(combined);

  let finalUrl = url;
  if (!/\.(m3u8|mp4|mkv)/i.test(finalUrl)) {
    finalUrl += finalUrl.includes("#") ? "" : "#.mkv";
  }

  return {
    name: "FourKHDHub",
    title: title,
    url: finalUrl,
    quality: finalQuality,
    headers: Object.keys(headers).length ? headers : void 0
  };
}

// ------------------ 🔥 PATCHED HUBCLOUD ------------------
async function resolveHubcloud(url, sourceTitle, referer) {
  const html = await fetch(url).then(r => r.text());
  const sizeMatch = html.match(/id="size">([^<]+)/);
  const headerMatch = html.match(/card-header[^>]*>([^<]+)/);

  const size = sizeMatch ? sizeMatch[1] : "";
  const header = headerMatch ? headerMatch[1] : "";

  // ✅ FIX HERE
  const quality = parseQuality(header + " " + size);

  const links = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);

  return links.map(link =>
    buildStream(`${sourceTitle}`, link, quality, { Referer: url })
  );
}

// ------------------ 🔥 PATCHED DIRECT LINKS ------------------
function buildDirectLinks(links, contentUrl, PROVIDER_NAME) {
  return links
    .filter((l) => /\.(m3u8|mp4|mkv)(\?|$)/i.test(l.url))
    .map((l) =>
      buildStream(
        l.label || PROVIDER_NAME,
        l.url,
        parseQuality((l.label || "") + " " + l.url),
        { Referer: contentUrl }
      )
    );
}

// ------------------ EXPORT ------------------
module.exports = {
  getStreams: async () => {
    return [];
  }
};
