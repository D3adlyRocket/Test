"use strict";
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
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
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

var require_formatter = __commonJS({
  "src/formatter.js"(exports2, module2) {
    function normalizePlaybackHeaders(headers) {
      if (!headers || typeof headers !== "object") return headers;
      const normalized = {};
      for (const [key, value] of Object.entries(headers)) {
        if (value == null) continue;
        const lowerKey = String(key).toLowerCase();
        if (lowerKey === "user-agent") normalized["User-Agent"] = value;
        else if (lowerKey === "referer" || lowerKey === "referrer") normalized["Referer"] = value;
        else if (lowerKey === "origin") normalized["Origin"] = value;
        else if (lowerKey === "accept") normalized["Accept"] = value;
        else if (lowerKey === "accept-language") normalized["Accept-Language"] = value;
        else normalized[key] = value;
      }
      return normalized;
    }

    function shouldForceNotWebReadyForPlugin(stream, providerName, headers, behaviorHints) {
      const text = [
        stream == null ? void 0 : stream.url,
        stream == null ? void 0 : stream.name,
        stream == null ? void 0 : stream.title,
        stream == null ? void 0 : stream.server,
        providerName
      ].filter(Boolean).join(" ").toLowerCase();
      if (text.includes("loadm") || text.includes("loadm.cam") || text.includes("mixdrop") || text.includes("mxcontent")) {
        return true;
      }
      return false;
    }

    function normalizeProviderId(providerName) {
      const normalized = String(providerName || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
      return normalized || void 0;
    }

    function normalizeEpisodeTemplate(value) {
      return String(value || "").replace(
        /\b(\d{1,3})[xX](\d{1,3})\b/g,
        (_, season, episode) => `S${season.padStart(1, "0")}E${episode.padStart(1, "0")}`
      ).replace(
        /\bS(\d{1,3})\s*E(\d{1,3})\b/gi,
        (_, season, episode) => `S${season.padStart(1, "0")}E${episode.padStart(1, "0")}`
      );
    }

    function formatStream2(stream, providerName) {
      if (!stream) return stream;

      let rawQuality = stream.quality || "1080p";
      let normQual = rawQuality.toLowerCase().replace(/p/g, "") + "p";
      if (normQual.includes("2160") || normQual.includes("4k")) normQual = "2160p";
      else if (normQual.includes("1080")) normQual = "1080p";
      else if (normQual.includes("720")) normQual = "720p";
      else if (normQual.includes("480")) normQual = "480p";

      let pName = stream.server || providerName || "CinemaCity";
      pName = pName.charAt(0).toUpperCase() + pName.slice(1);

      let rawTitle = stream.originalTitle || stream.title || "Unknown";
      let cleanTitle = normalizeEpisodeTemplate(rawTitle)
        .replace(/^[📁🎬]\s*/, "")
        .replace(/\b(2160p|1080p|720p|480p|360p|4k|uhd|hd|sd)\b\s*•?\s*/gi, "")
        .replace(/\s*\|\s*S\d+E\d+/gi, "")
        .replace(/\s+S\d+E\d+/gi, "")
        .replace(/•\s*/g, "")
        .replace(/\s+/g, " ")
        .trim();

      if (!cleanTitle || cleanTitle.toLowerCase() === "unknown") {
        cleanTitle = stream.name || "Movie";
      }

      const yearStr = stream.year ? ` (${stream.year})` : "";

      // Subheading Line 1
      let line1 = "";
      if (stream.season && stream.episode) {
        line1 = `🎬 ${cleanTitle}${yearStr} | S${stream.season}E${stream.episode}`;
      } else {
        line1 = `🎬 ${cleanTitle}${yearStr}`;
      }

      // Subheading Line 2
      const durationVal = stream.duration ? `⌛ ${stream.duration}` : `⌛ N/A`;
      const line2 = `🌟 ${normQual} | 🔉 Multi-Audio | ${durationVal}`;

      // Subheading Line 3
      const formatVal = stream.format || ((stream.type === "hls" || (stream.url && stream.url.includes(".m3u8"))) ? "HLS" : "MP4");
      const sourceVal = stream.source || "WEB-DL";
      const codecVal = stream.codec || "H.264";
      const line3 = `🎞️ ${formatVal} | 📥 ${sourceVal} | ⚡ ${codecVal}`;

      // Final Header & Subheading assembly
      const finalHeader = `${pName} | ${normQual} | Multi-Audio`;
      const finalSubheadings = `${line1}\n${line2}\n${line3}`;

      const behaviorHints = stream.behaviorHints && typeof stream.behaviorHints === "object" ? __spreadValues({}, stream.behaviorHints) : {};
      let finalHeaders = stream.headers;
      if (behaviorHints.proxyHeaders && behaviorHints.proxyHeaders.request) {
        finalHeaders = behaviorHints.proxyHeaders.request;
      } else if (behaviorHints.headers) {
        finalHeaders = behaviorHints.headers;
      }
      finalHeaders = normalizePlaybackHeaders(finalHeaders);

      const isStreamingCommunityProvider = String(providerName || "").toLowerCase() === "streamingcommunity" || String((stream == null ? void 0 : stream.name) || "").toLowerCase().includes("streamingcommunity");
      if (isStreamingCommunityProvider && !finalHeaders) {
        delete behaviorHints.proxyHeaders;
        delete behaviorHints.headers;
        delete behaviorHints.notWebReady;
      }
      if (finalHeaders) {
        behaviorHints.proxyHeaders = behaviorHints.proxyHeaders || {};
        behaviorHints.proxyHeaders.request = finalHeaders;
        behaviorHints.headers = finalHeaders;
      }
      const providerExplicitNotWebReady = stream.behaviorHints && "notWebReady" in stream.behaviorHints;
      const shouldForceNotWebReady = shouldForceNotWebReadyForPlugin(stream, providerName, finalHeaders, behaviorHints);
      if (!isStreamingCommunityProvider && shouldForceNotWebReady) {
        behaviorHints.notWebReady = true;
      } else if (!providerExplicitNotWebReady) {
        delete behaviorHints.notWebReady;
      }

      const playbackReferer = stream.referer || (finalHeaders == null ? void 0 : finalHeaders.Referer) || (finalHeaders == null ? void 0 : finalHeaders.referer);
      const playbackUserAgent = stream.userAgent || (finalHeaders == null ? void 0 : finalHeaders["User-Agent"]) || (finalHeaders == null ? void 0 : finalHeaders["user-agent"]);

      const cleanStreamObj = __spreadValues({}, stream);
      delete cleanStreamObj.language; // Prevents UI from rendering fallback "Italian" string

      return __spreadProps(cleanStreamObj, {
        name: finalHeader,
        title: finalSubheadings,
        description: finalSubheadings,
        details: finalSubheadings,
        overview: finalSubheadings,
        providerName: pName,
        qualityTag: normQual,
        originalTitle: cleanTitle,
        _nuvio_formatted: true,
        _formatted: true,
        formatted: true,
        isFormatted: true,
        behaviorHints,
        provider: stream.provider || normalizeProviderId(providerName),
        referer: playbackReferer,
        userAgent: playbackUserAgent,
        headers: finalHeaders
      });
    }
    module2.exports = { formatStream: formatStream2 };
  }
});
