import { seadex_finder, nyaa_html_finder, gogo_anime_finder } from "./anime-finder-funcs.js";
import { sea_dex_query_creator, nyaa_query_creator, nyaa_fallback_queries, gogoanime_query_creator } from "./query-creator.js";
import { nyaa_function_dispatch } from "./query-dispatcher.js";

async function main() {
    const trs_results = [];
    const english_title = 'One Piece'//'Tower of God';
    const romanji_title = 'Wan Pīsu';
    const type = false;
    const alID = 21;
    let season_number = 1;
    const episode_number = 5; 

    const sea_dex_query = sea_dex_query_creator(alID, type,  5);

    const nyaa_queries = nyaa_query_creator(english_title, romanji_title, season_number, episode_number, type);
    const nyaa_results = await nyaa_function_dispatch(nyaa_queries, true, false);
    console.log(nyaa_results);
    trs_results.concat(nyaa_results);

    if (nyaa_results.length < 1) {
        const nyaa_fallback_q = nyaa_fallback_queries(english_title, romanji_title, episode_number, type);
        const nyaa_fallback_results = await nyaa_function_dispatch(nyaa_fallback_q, false, false);
        trs_results.concat(nyaa_fallback_results);
    }

    if (trs_results.length == 0) {
        const gogo_query = gogoanime_query_creator(romanji_title, episode_number, 'sub');
    }

    
    // const sea_dex_result = await seadex_finder(sea_dex_query[0], sea_dex_query[1], sea_dex_query[2]);

    console.log(trs_results);
}

await main();