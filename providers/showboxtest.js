/**
 * ShowBox "Universal" Direct Scraper
 * Bypasses encryption using a web-index fallback
 * Version: 2026.05.09
 */

const LOCAL_COOKIE_URL = "http://192.168.1.176:8080/cookie.txt";

async function getStreams(tmdbId, type, s, e) {
    try {
        // 1. Fetch the user's Febbox Cookie
        const cookieFetch = await fetch(LOCAL_COOKIE_URL).catch(() => null);
        if (!cookieFetch) {
            console.log("[ShowBox] Error: Could not reach cookie.txt at " + LOCAL_COOKIE_URL);
            return [];
        }
        const uiCookie = (await cookieFetch.text()).trim();
        const headers = { 'Cookie': `ui=${uiCookie}`, 'User-Agent': 'Mozilla/5.0' };

        // 2. Map TMDB ID to a Title (Showbox search needs titles)
        const metaUrl = `https://api.themoviedb.org/3/${type === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=439c478a771f35c05022f9feabcca01c`;
        const meta = await (await fetch(metaUrl)).json();
        const title = type === 'tv' ? meta.name : meta.title;

        // 3. Search using the Public Web Index (Bypasses Triple-DES encryption requirements)
        const searchUrl = `https://www.showbox.media/index/search?keyword=${encodeURIComponent(title)}`;
        const searchData = await (await fetch(searchUrl)).json();
        const match = searchData?.data?.list?.find(i => 
            (type === 'tv' ? i.box_type === 2 : i.box_type === 1)
        );
        if (!match) return [];

        // 4. Get the Febbox Share ID
        const shareApi = `https://www.showbox.media/index/share_link?id=${match.id}&type=${match.box_type}`;
        const shareData = await (await fetch(shareApi)).json();
        const shareKey = shareData?.data?.link?.split('/share/')[1];
        if (!shareKey) return [];

        // 5. Navigate the Febbox folder structure
        let listUrl = `https://www.febbox.com/file/file_share_list?share_key=${shareKey}&parent_id=0`;
        let listData = await (await fetch(listUrl, { headers })).json();
        let files = listData?.data?.file_list || [];

        let targetFid = null;
        if (type === 'movie') {
            const video = files.find(f => f.file_icon === 'video_icon' || f.file_name.match(/\.(mp4|mkv|mov)$/i));
            targetFid = video?.fid;
        } else {
            // TV Logic: Look for Season Folder -> Look for Episode File
            const seasonFolder = files.find(f => f.file_name.toLowerCase().includes(`season ${s}`));
            if (seasonFolder) {
                const epUrl = `https://www.febbox.com/file/file_share_list?share_key=${shareKey}&parent_id=${seasonFolder.fid}`;
                const epData = await (await fetch(epUrl, { headers })).json();
                const epFile = epData?.data?.file_list?.find(f => 
                    f.file_name.toLowerCase().includes(`e${String(e).padStart(2, '0')}`) || 
                    f.file_name.toLowerCase().includes(`ep${e}`)
                );
                targetFid = epFile?.fid;
            }
        }

        if (!targetFid) return [];

        // 6. Extraction: Scrape the direct stream links from the file info API
        const infoUrl = `https://www.febbox.com/file/file_info?fid=${targetFid}&share_key=${shareKey}`;
        const infoData = await (await fetch(infoUrl, { headers })).json();
        const videoList = infoData?.data?.video_list || {};

        const results = [];
        for (const [quality, data] of Object.entries(videoList)) {
            if (data.url) {
                results.push({
                    name: `Showbox [${quality.toUpperCase()}]`,
                    url: data.url,
                    quality: quality.replace('p', ''),
                    provider: "Febbox-Direct"
                });
            }
        }

        return results;

    } catch (err) {
        console.log("[ShowBox Scraper] Critical Error: " + err.message);
        return [];
    }
}

// Export for Nuvio
global.getStreams = getStreams;
