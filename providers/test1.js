"use strict";

const PROVIDER_NAME = "WebStreamrMBG";
const DEFAULT_MANIFEST_URL = "https://87d6a6ef6b58-webstreamrmbg.baby-beamup.club/manifest.json";

function configuredBaseUrl() {
  const raw = process.env.WEBSTREAMRMBG_MANIFEST_URL
    || process.env.WEBSTREAMRMBG_BASE_URL
    || DEFAULT_MANIFEST_URL;
  if (!raw) {
    return "";
  }
  return raw.replace(/\/manifest\.json$/i, "").replace(/\/+$/, "");
}

function streamId(tmdbId, imdbId, mediaType, season, episode) {
  const baseId = tmdbId ? `tmdb:${tmdbId}` : imdbId;
  if ((mediaType === "series" || mediaType === "tv") && season != null && episode != null) {
    return `${baseId}:${season}:${episode}`;
  }
  return baseId;
}

async function fetchWebStreamrStreams(tmdbId, mediaType, season, episode, imdbId) {
  const baseUrl = configuredBaseUrl();
  const id = streamId(tmdbId, imdbId, mediaType, season, episode);
  if (!baseUrl || !id) {
    return [];
  }

  const stremioType = mediaType === "tv" ? "series" : mediaType;
  const url = `${baseUrl}/stream/${encodeURIComponent(stremioType)}/${encodeURIComponent(id)}.json`;
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Doom-addon/2.1"
    },
    redirect: "follow"
  });
  if (!response.ok) {
    throw new Error(`${PROVIDER_NAME} returned HTTP ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.streams) ? payload.streams : [];
}

function streamText(stream) {
  const behaviorHints = stream && stream.behaviorHints;
  return [
    stream && stream.name,
    stream && stream.title,
    stream && stream.description,
    stream && stream.quality,
    stream && stream.language,
    behaviorHints && behaviorHints.filename,
    behaviorHints && behaviorHints.bingeGroup
  ].filter(Boolean).join(" ");
}

function isSeekableCandidate(stream) {
  return !/\bno\s*seek\b/i.test(streamText(stream));
}

function hasAllowedLanguage(stream) {
  return /\b(?:hindi|hin|english|eng|dual|multi|original)\b|en_hi|hi_en|\u{1F1FA}\u{1F1F8}|\u{1F1EE}\u{1F1F3}/iu.test(streamText(stream));
}

function firstUsefulTitleLine(stream) {
  return String(stream.title || stream.description || stream.name || "")
    .split(/\r?\n/)
    .map((line) => line
      .replace(/\bno\s*seek\b/ig, "")
      .replace(/\s*[\u26A0\uFE0F]+\s*/g, " ")
      .trim())
    .find((line) => line && !/^\s*(?:\u{1F4BE}|size|source|\u{1F517})/iu.test(line));
}

function normalizeWebStreamrStream(stream) {
  if (!stream || !stream.url) {
    return null;
  }

  const behaviorHints = Object.assign({}, stream.behaviorHints || {});
  const filename = behaviorHints.filename || firstUsefulTitleLine(stream);
  if (filename) {
    behaviorHints.filename = filename;
  }

  return {
    name: stream.name || PROVIDER_NAME,
    title: stream.title || stream.description || stream.name || PROVIDER_NAME,
    description: stream.description || stream.title || stream.name || PROVIDER_NAME,
    url: stream.url,
    quality: stream.quality,
    language: stream.language,
    size: stream.size,
    videoSize: stream.videoSize || behaviorHints.videoSize,
    behaviorHints,
    headers: stream.headers
  };
}

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null, imdbId = "") {
  try {
    const streams = await fetchWebStreamrStreams(tmdbId, mediaType, season, episode, imdbId);
    return streams
      .filter((stream) => stream && stream.url)
      .filter(isSeekableCandidate)
      .filter(hasAllowedLanguage)
      .map(normalizeWebStreamrStream)
      .filter(Boolean);
  } catch (error) {
    console.error(`[${PROVIDER_NAME}] ${error.message || error}`);
    return [];
  }
}

module.exports = { getStreams };
