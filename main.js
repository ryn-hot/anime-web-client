import { seadex_finder, nyaa_html_finder, gogo_anime_finder, parse_title_reserve } from "./anime-finder-funcs.js";
import { sea_dex_query_creator, nyaa_query_creator, nyaa_fallback_queries, gogoanime_query_creator } from "./query-creator.js";
import { nyaa_function_dispatch } from "./query-dispatcher.js";
import WebTorrent from "webtorrent";
import wrtc from 'wrtc'

await main();


async function main() {
    /*const trs_results = [];
    const english_title = 'BLEACH: Thousand-Year Blood War';
    const romanji_title = 'Bleach: Sennen Kessen-hen';
    const type = true; 
    const alID = 116674;
    let season_number = 1; // hardcoded for better fetching accuracy
    const episode_number = 5; 
    const server_mirror = [];
  

    
    const sea_dex_query = sea_dex_query_creator(alID, type,  episode_number);
    const sea_dex_query_results = await seadex_finder(...sea_dex_query);
    trs_results.push(...sea_dex_query_results)

    const nyaa_queries = nyaa_query_creator(english_title, romanji_title, season_number, episode_number, type);
    const nyaa_results = await nyaa_function_dispatch(nyaa_queries, true, false);
    // console.log(nyaa_results);
    trs_results.push(...nyaa_results);

    if (nyaa_results.length < 1) {
        const nyaa_fallback_q = nyaa_fallback_queries(english_title, romanji_title, episode_number, type);
        const nyaa_fallback_results = await nyaa_function_dispatch(nyaa_fallback_q, false, true);
        trs_results.push(...nyaa_fallback_results);
    }

    
    const gogo_query = gogoanime_query_creator(romanji_title, episode_number, 'sub');
    const gogo_link = await gogo_anime_finder(...gogo_query);
    server_mirror.push(gogo_link);

    const trs_results_deduped = dedupeMagnetLinks(trs_results);

    console.log(trs_results_deduped);

    const trs_final = []; 

    for (let i = 0; i < trs_results_deduped.length; i++) {
        const raw_torrent = trs_results_deduped[i];
        console.log(`raw_torrent magnetLink:`, raw_torrent.magnetLink);
       // Ensure we get a single magnet link string
        let magnetLink = Array.isArray(raw_torrent.magnetLink)
            ? raw_torrent.magnetLink[0] 
            : raw_torrent.magnetLink;

        console.log(`processed magnetLink:`,magnetLink);

        const specific_torrent = await fetchTorrentMetadata(magnetLink, episode_number);
        console.log(`specific_torrent:`, specific_torrent);
    } */ 

    const magnetLink = 'magnet:?xt=urn:btih:b5b435316e592b642db961fd63abae9af3799662&amp;dn=%5BEMBER%5D%20Bleach%3A%20Thousand-Year%20Blood%20War%20%282022%29%20%28Season%201%29%20%5B1080p%5D%20%5BDual%20Audio%20HEVC%20WEBRip%5D%20%28Bleach%3A%20Sennen%20Kessen-hen%29%20%28Batch%29&amp;tr=http%3A%2F%2Fnyaa.tracker.wf%3A7777%2Fannounce&amp;tr=udp%3A%2F%2Fopen.stealth.si%3A80%2Fannounce&amp;tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&amp;tr=udp%3A%2F%2Fexodus.desync.com%3A6969%2Fannounce&amp;tr=udp%3A%2F%2Ftracker.torrent.eu.org%3A451%2Fannounce';

        
    const specific_torrent = await fetchTorrentMetadata(magnetLink, 5);
    
    // const sea_dex_result = await seadex_finder(sea_dex_query[0], sea_dex_query[1], sea_dex_query[2]);
    
}

async function fetchTorrentMetadata(magnetURI, episode_number) {
    const client = new WebTorrent({ wrtc })

    //const magnetURI = 'magnet:?xt=urn:btih:b5b435316e592b642db961fd63abae9af3799662&amp;dn=%5BEMBER%5D%20Bleach%3A%20Thousand-Year%20Blood%20War%20%282022%29%20%28Season%201%29%20%5B1080p%5D%20%5BDual%20Audio%20HEVC%20WEBRip%5D%20%28Bleach%3A%20Sennen%20Kessen-hen%29%20%28Batch%29&amp;tr=http%3A%2F%2Fnyaa.tracker.wf%3A7777%2Fannounce&amp;tr=udp%3A%2F%2Fopen.stealth.si%3A80%2Fannounce&amp;tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&amp;tr=udp%3A%2F%2Fexodus.desync.com%3A6969%2Fannounce&amp;tr=udp%3A%2F%2Ftracker.torrent.eu.org%3A451%2Fannounce';

    console.log('Torrent added. Waiting for metadata...');
    const torrent = client.add(magnetURI)

    torrent.on('infoHash', () => {
    console.log(`InfoHash event fired: ${torrent.infoHash}`)
    })

    torrent.on('metadata', async () => {
    console.log('Metadata event fired!')

    console.log('Starting health check...')

    try {
        // Wait 10 seconds to see if we connect to any peers
        await new Promise((resolveHealth, rejectHealth) => {
        const healthCheckTimeout = setTimeout(() => {
            console.log('Health check timeout triggered');
            if (torrent.numPeers === 0) {
            console.log('Peer Health Check Failed - no peers found.');
            rejectHealth(new Error('No peers found, torrent likely unhealthy.'));
            } else {
            console.log(`Peer Health Passed - ${torrent.numPeers} peer(s) connected.`);
            resolveHealth();
            }
        }, 10000); // 10 seconds

        // If the torrent errors during this period, abort
        torrent.on('error', (err) => {
            clearTimeout(healthCheckTimeout);
            rejectHealth(err);
        });
        });

        // If we got here, it means we have peers and the torrent is considered healthy.
        console.log('Torrent is healthy. Proceeding with file inspection.');

        // Print out file names
        console.log('Files in torrent:')
        let desiredFileFound = false;
        let desiredFileIndex = null;
        let desiredFileName = null;

        // Iterate over files in the torrent
        for (let i = 0; i < torrent.files.length; i++) {
            const file = torrent.files[i];
            console.log(`Checking file: ${file.name}`);

            if (file.name.toLowerCase().endsWith('.mkv')) {
                // Parse the file name to extract episode info
                const file_title_data = await parse_title_reserve(file.name);

                // Check if the parsed episode number matches the target episode
                if (file_title_data.episode_number == episode_number) {
                    console.log(`Found the desired episode (Episode ${episode_number}): ${file.name}`);
                    desiredFileFound = true;
                    desiredFileIndex = i;
                    desiredFileName = file.name;
                    break;
                }
            }
        }

        if (desiredFileFound) {
            // At this point, we have the magnet link, file index, and file name
            // Store this information in your database for future retrieval:
            // Example structure:
            const fileInfo = {
              magnetLink: magnetURI,
              fileIndex: desiredFileIndex,
              fileName: desiredFileName
            };
    
            console.log('Storing file info:', fileInfo);
    
            // TODO: Insert fileInfo into your DB. For example:
            // await db.insertEpisodeSource(alID, episode_number, fileInfo);
    
        } else {
            console.log(`No MKV file matching episode ${episode_number} was found in this torrent.`);
        }

        // Once done, destroy the client
        client.destroy(() => {
        console.log('Client destroyed. Test complete.')
        });

    } catch (err) {
        // If we failed the health check (no peers) or had another error
        console.error('Health check failed or torrent error:', err.message);

        // Destroy the client to clean up resources
        client.destroy(() => {
        console.log('Client destroyed due to health check failure.');
        });
    }
    });

    torrent.on('error', (err) => {
    console.error('Torrent error:', err)
    });
}
  

function dedupeMagnetLinks(entries) {
    // Use Set to track unique magnet links
    const seenMagnetLinks = new Set();
    
    return entries.filter(entry => {
        // Handle both array and string magnet links
        const magnetLink = Array.isArray(entry.magnetLink)
            ? entry.magnetLink[0] 
            : entry.magnetLink;
            
        // Remove HTML entities from magnet links (like &amp;)
        const cleanMagnetLink = magnetLink.replace(/&amp;/g, '&');
        
        // If we haven't seen this magnet link before, keep the entry
        if (!seenMagnetLinks.has(cleanMagnetLink)) {
            seenMagnetLinks.add(cleanMagnetLink);
            return true;
        }
        return false;
    });
}