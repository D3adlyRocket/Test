/**
 * ShowBox Direct Scraper for Nuvio
 * Version: 2026.05.09 - Direct Path (No Middleman)
 */

var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var LOCAL_COOKIE_URL = "http://192.168.1.176:8080/cookie.txt"; // Host your Febbox 'ui' cookie here

async function getStreams(tmdbId, type, s, e) {
    try {
        // 1. Get Authentication (Your Private Cookie)
        const cookieResp = await fetch(LOCAL_COOKIE_URL, { timeout: 3000 });
        const uiCookie = (await cookieResp.text()).trim();
        if (!uiCookie) return [];

        // 2. Resolve TMDB ID to Title (Required for Search)
        const tmdbUrl = `https://api.themoviedb.org/3/${type === 'tv' ? 'tv/' : 'movie/'}${tmdbId}?api_key=${TMDB_KEY}`;
        const meta = await (await fetch(tmdbUrl)).json();
        const title = type === 'tv' ? meta.name : meta.title;
        if (!title) return [];

        // 3. Search Showbox Direct (Simplified Search)
        // We use the public showbox web index to find the ID
        const searchUrl = `https://www.showbox.media/index/search?keyword=${encodeURIComponent(title)}`;
        const searchResp = await (await fetch(searchUrl)).json();
        const match = searchResp?.data?.list?.find(i => 
            (type === 'tv' ? i.box_type === 2 : i.box_type === 1)
        );
        if (!match) return [];

        // 4. Get the Febbox Share Key
        const shareApi = `https://www.showbox.media/index/share_link?id=${match.id}&type=${match.box_type}`;
        const shareData = await (await fetch(shareApi)).json();
        const shareKey = shareData?.data?.link?.split('/share/')[1];
        if (!shareKey) return [];

        // 5. List Files in Febbox and find the video
        let fileId = null;
        const listUrl = `https://www.febbox.com/file/file_share_list?share_key=${shareKey}&parent_id=0`;
        const listResp = await (await fetch(listUrl, {
            headers: { 'Cookie': `ui=${uiCookie}` }
        })).json();
        
        const files = listResp?.data?.file_list || [];

        if (type === 'movie') {
            const video = files.find(f => f.file_icon === 'video_icon');
            fileId = video?.fid;
        } else {
            // TV: Find Season Folder -> Find Episode
            const seasonFolder = files.find(f => f.file_name.toLowerCase().includes(`season ${s}`));
            if (seasonFolder) {
                const epUrl = `https://www.febbox.com/file/file_share_list?share_key=${shareKey}&parent_id=${seasonFolder.fid}`;
                const epResp = await (await fetch(epUrl, { headers: { 'Cookie': `ui=${uiCookie}` } })).json();
                const episode = epResp?.data?.file_list?.find(f => 
                    f.file_name.toLowerCase().includes(`e${String(e).padStart(2, '0')}`) || 
                    f.file_name.toLowerCase().includes(`ep${e}`)
                );
                fileId = episode?.fid;
            }
        }

        if (!fileId) return [];

        // 6. Final Step: Get Stream Links via Player POST
        const playerUrl = "https://www.febbox.com/file/player";
        const playerResp = await fetch(playerUrl, {
            method: 'POST',
            headers: {
                'Cookie': `ui=${uiCookie}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `fid=${fileId}&share_key=${shareKey}`
        });

        const playerHtml = await playerResp.text();
        
        // Extract links from the sources array in HTML
        const streamMatches = [...playerHtml.matchAll(/\"file\":\"(http.*?)\",\"label\":\"(.*?)\"/g)];
        
        return streamMatches.map(m => ({
            name: "ShowBox " + m[2],
            url: m[1].replace(/\\/g, ''), // Unescape slashes
            quality: m[2],
            provider: "Direct-Febbox"
        }));

    } catch (err) {
        console.log("Scraper Error: ", err);
        return [];
    }
}

global.getStreams = getStreams;
