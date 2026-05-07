function getStreams(tmdbId, mediaType, season, episode) {
  var isMovie = mediaType !== "tv";
  var url = isMovie
    ? "https://cinemaos.live/embed/movie/" + tmdbId
    : "https://cinemaos.live/embed/tv/" + tmdbId + "/" + season + "/" + episode;

  return Promise.resolve([{
    name: "CinemaOS",
    title: "CinemaOS - cinemaos.live",
    url: url,
    quality: "Auto",
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Referer": "https://cinemaos.live/"
    },
    isM3U8: false,
    supportsExternalPlayer: false
  }]);
}

module.exports = { getStreams };
