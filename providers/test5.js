const axios = require("axios")
const cheerio = require("cheerio")

async function getStreams(imdbId) {
    const mapping = {
        "tt39018552": "https://chiptaylor.org/alas-roban-2026/"
    }

    const movieUrl = mapping[imdbId]

    if (!movieUrl) {
        console.log("NO MATCH:", imdbId)
        return []
    }

    console.log("IMDb ID:", imdbId)
    console.log("MOVIE PAGE:", movieUrl)

    try {
        const page = await axios.get(movieUrl, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36"
            }
        })

        const $ = cheerio.load(page.data)

        const iframe = $("iframe").first().attr("src")

        if (!iframe) {
            console.log("NO IFRAME FOUND")
            return []
        }

        console.log("IFRAME:", iframe)

        const match = iframe.match(/video\/([a-zA-Z0-9]+)/)

        if (!match) {
            console.log("NO VIDEO ID FOUND")
            return []
        }

        const videoId = match[1]

        console.log("VIDEO ID:", videoId)

        const api = await axios.post(
            `https://embedpyrox.xyz/player/index.php?data=${videoId}&do=getVideo`,
            {},
            {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36",
                    "Referer": iframe,
                    "Origin": "https://embedpyrox.xyz",
                    "X-Requested-With": "XMLHttpRequest",
                    "Accept": "application/json, text/plain, */*"
                }
            }
        )

        console.log(
            "API RESPONSE:",
            JSON.stringify(api.data, null, 2)
        )

        const streamUrl =
            api.data.securedLink ||
            api.data.videoSource ||
            api.data.file ||
            api.data.url

        if (!streamUrl) {
            console.log("NO STREAM URL FOUND")
            return []
        }

        console.log("STREAM URL:", streamUrl)

        return [
            {
                title: "Chiptaylor",
                url: streamUrl,
                behaviorHints: {
                    notWebReady: false,
                    proxyHeaders: {
                        request: {
                            Referer: iframe,
                            Origin: "https://embedpyrox.xyz",
                            "User-Agent":
                                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36"
                        }
                    }
                }
            }
        ]
    } catch (err) {
        console.error("ERROR:", err.response?.status || err.message)
        console.error(err.response?.data || "")
        return []
    }
}

module.exports = {
    getStreams
}
