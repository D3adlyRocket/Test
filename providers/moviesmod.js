"use strict";

const uhdmovies = require("./uhdmovies");
const fourkhdhub = require("./4khdhub");
const hdhub4u = require("./hdhub4u");
const moviesdrive = require("./moviesdrive");

const SOURCES = [
  { key: "uhdmovies", label: "UHDMovies", provider: uhdmovies },
  { key: "4khdhub", label: "4KHDHub", provider: fourkhdhub },
  { key: "hdhub4u", label: "HDHub4u", provider: hdhub4u },
  { key: "moviesdrive", label: "Moviesdrive", provider: moviesdrive }
];

function withSiteLabel(stream, source) {
  const cloned = Object.assign({}, stream);
  const safeName = (cloned.name || "").trim();
  const safeTitle = (cloned.title || "").trim();

  cloned.name = safeName.includes(source.label) ? safeName : `[${source.label}] ${safeName || "Link"}`;
  cloned.title = safeTitle.includes(`[${source.label}]`) ? safeTitle : `[${source.label}] ${safeTitle || "Direct Link"}`;
  cloned.provider = "hdmulti";
  cloned.sourceSite = source.key;

  return cloned;
}

async function runSource(source, tmdbId, mediaType, season, episode) {
  try {
    const result = await source.provider.getStreams(tmdbId, mediaType, season, episode);
    if (!Array.isArray(result)) return [];
    return result.map((stream) => withSiteLabel(stream, source));
  } catch (error) {
    console.log(`[HDMulti] ${source.label} failed: ${error && error.message ? error.message : error}`);
    return [];
  }
}

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  const settled = await Promise.allSettled(
    SOURCES.map((source) => runSource(source, tmdbId, mediaType, season, episode))
  );

  const streams = [];
  for (const item of settled) {
    if (item.status === "fulfilled" && Array.isArray(item.value)) {
      streams.push(...item.value);
    }
  }

  return streams;
}

module.exports = { getStreams };
