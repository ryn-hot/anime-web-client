import { seadex_finder, nyaa_html_finder, gogo_anime_finder } from "./anime-finder-funcs.js";
import { sea_dex_query_creator, nyaa_query_creator, nyaa_fallback_queries, gogoanime_query_creator } from "./query-creator.js";
import { nyaa_function_dispatch } from "./query-dispatcher.js";

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


async function main() {
    const trs_results = [];
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
    const gogo_link = gogo_anime_finder(...gogo_query);
    server_mirror.push(gogo_link);

    const trs_results_deduped = dedupeMagnetLinks(trs_results);

    // const sea_dex_result = await seadex_finder(sea_dex_query[0], sea_dex_query[1], sea_dex_query[2]);
    
    console.log(trs_results_deduped);
}

await main();