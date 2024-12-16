import { nyaa_html_finder, nyaa_reserve_extract, delay } from "./anime-finder-funcs.js";
import chalk from "chalk";
import pLimit from "p-limit";

async function nyaa_function_dispatch(nyaa_queries, release_status_complete, fallback) {
    /*const limit = pLimit(2);
    const nyaa_finder_promises = nyaa_queries.map(query => limit(() => nyaa_html_finder(...query)))
    
    const results = await Promise.all(nyaa_finder_promises); */
    const results = [];
    // console.time('nyaa_html_finder Execution Time');

    let i = 0;
    for (const query of nyaa_queries) {
        // Print the query index
        i += 1;
        console.log(chalk.blue.bold('\n========================================\n'));
        console.log(chalk.yellow.bold(`Query ${i}:`));
        console.log(chalk.greenBright(JSON.stringify(query, null, 2)));
        console.log(chalk.blue.bold('\n========================================\n'));

        const result = await nyaa_html_finder(...query);
        results.push(result);

        // Introduce a delay before the next function call
        // Delay of 500 milliseconds
    }
    // console.timeEnd('nyaa_html_finder Execution Time');
    // Extract torrentList and reserve_cache from each result
    const torrents = results.map(result => result.torrentList);
    const reserve = results.map(result => result.reserve_cache);


    const reserve_torrents = reserve.flat();
    const uniq_reserve_torrents = dedupeTorrents(reserve_torrents);

    const allTorrents = torrents.flat();

    const unique_torrents = dedupeTorrents(allTorrents);
    
    if (unique_torrents.length >= 1) {
        return unique_torrents;
    }
    else {

        if (release_status_complete && !fallback) {
            console.log(`checking reserve torrents:`, uniq_reserve_torrents);
            const episode = nyaa_queries[0][4];
            const checked_reserve_torrents = await nyaa_reserve_extract(uniq_reserve_torrents, episode);
            console.log(`checked_reserve_torrents:`, checked_reserve_torrents);
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
