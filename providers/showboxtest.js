/**
 * ShowBox Robust Scraper 2026
 * No external APIs, direct extraction only.
 */

const LOCAL_COOKIE_URL = "http://192.168.1.176:8080/cookie.txt";

async function getStreams(tmdbId, type, s, e) {
    try {
        // 1. Get Authentication
        const cookieResp = await fetch(LOCAL_COOKIE_URL).catch(() => null);
        if (!cookieResp) return [];
        const uiCookie = (await cookieResp.text()).trim();

        // 2. Resolve Title via TMDB
        const meta = await (await fetch(`https://api.themoviedb.org/3/${type === 'tv' ? 'tv/' : 'movie/'}${tmdbId}?api_key=439c478a771f35c05022f9feabcca01c`)).json();
        const title = type === 'tv' ? meta.name : meta.title;

        // 3. Find the Showbox Item ID
        const searchUrl = `https://www.showbox.media/index/search?keyword=${encodeURIComponent(title)}`;
        const searchData = await (await fetch(searchUrl)).json();
        const item = searchData?.data?.list?.find(i => (type === 'tv' ? i.box_type === 2 : i.box_type === 1));
        if (!item) return [];

        // 4. Get Febbox Share Key (The "Handshake")
        const shareApi = `https://www.showbox.media/index/share_link?id=${item.id}&type=${item.box_type}`;
        const shareData = await (await fetch(shareApi)).json();
        const shareKey = shareData?.data?.link?.split('/share/')[1];
        if (!shareKey) return [];

        // 5. Fetch the Player Page (This is where the direct links live)
        // We go straight to the file list for this share key
        const listUrl = `https://www.febbox.com/file/file_share_list?share_key=${shareKey}&parent_id=0`;
        const listData = await (await fetch(listUrl, { headers: { 'Cookie': `ui=${uiCookie}` } })).json();
        let files = listData?.data?.file_list || [];

        // For TV Shows: Drill down into Season -> Episode
        if (type === 'tv') {
            const season = files.find(f => f.file_name.toLowerCase().includes(`season ${s}`));
            if (season) {
                const epUrl = `https://www.febbox.com/file/file_share_list?share_key=${shareKey}&parent_id=${season.fid}`;
                const epData = await (await fetch(epUrl, { headers: { 'Cookie': `ui=${uiCookie}` } })).json();
                files = epData?.data?.file_list || [];
            }
        }

        // Filter for the actual video file
        const targetFile = files.find(f => {
            const name = f.file_name.toLowerCase();
            if (type === 'movie') return f.file_icon === 'video_icon';
            return name.includes(`e${String(e).padStart(2, '0')}`) || name.includes(`ep${e}`);
        });

        if (!targetFile) return [];

        // 6. Extraction (The "Magic" part)
        // Instead of calling an API, we ask for the file info which returns raw stream URLs
        const infoUrl = `https://www.febbox.com/file/file_info?fid=${targetFile.fid}&share_key=${shareKey}`;
        const infoResp = await (await fetch(infoUrl, { headers: { 'Cookie': `ui=${uiCookie}` } })).json();
        
        // Febbox returns an array of "oss_url" or "video_list"
        const streams = [];
        const videoList = infoResp?.data?.video_list || {};
        
        Object.keys(videoList).forEach(quality => {
            if (videoList[quality]?.url) {
                streams.push({
                    name: `ShowBox [${quality.toUpperCase()}]`,
                    url: videoList[quality].url,
                    quality: quality,
                    provider: "Febbox-Direct"
                });
            }
        });

        return streams;

    } catch (err) {
        return [];
    }
}

global.getStreams = getStreams;
