import { nyaa_html_finder, nyaa_reserve_extract } from "./anime-finder-funcs.js";
import pLimit from "p-limit";

async function nyaa_function_dispatch(nyaa_queries, release_status_complete, fallback) {
    const limit = pLimit(3);
    const nyaa_finder_promises = nyaa_queries.map(query => limit(() => nyaa_html_finder(...query)))

    console.time('nyaa_html_finder Execution Time');

    const results = await Promise.all(nyaa_finder_promises);

    console.timeEnd('nyaa_html_finder Execution Time');
    
    // Extract torrentList and reserve_cache from each result
    const torrents = results.map(result => result.torrentList);
    const reserve = results.map(result => result.reserve_cache);


    const reserve_torrents = reserve.flat();
    const uniq_reserve_torrentes = dedupeTorrents(reserve_torrents);

    const allTorrents = torrents.flat();
    console.log('All Torrents:', allTorrents);

    const unique_torrents = dedupeTorrents(allTorrents);
    
    if (unique_torrents.length >= 1) {
        return unique_torrents;
    }
    else {

        if (release_status_complete && !fallback) {
            const episode = nyaa_queries[0][4];
            const checked_reserve_torrents = nyaa_reserve_extract(uniq_reserve_torrentes, episode);
            return checked_reserve_torrents;
        }
        else {
            return unique_torrents;
        }
        
    }
}


function dedupeTorrents(torrents) {
    const uniqueTorrentsMap = new Map();
    
    for (const torrent of torrents) {
        try {
            const normalizedTitle = torrent.title.trim().toLowerCase();
            const normalizedSeeders = Number(torrent.seeders);

            if (isNaN(normalizedSeeders)) {
                throw new Error("Invalid seeders value");
            }

            const key = `${normalizedTitle}-${normalizedSeeders}`;

            if (!uniqueTorrentsMap.has(key)) {
                uniqueTorrentsMap.set(key, torrent);
            }
        } catch (error) {
            console.error(`Error processing torrent: ${error.message}`);
        }
    }
    
    return Array.from(uniqueTorrentsMap.values());
}

export {
    nyaa_function_dispatch
}
