import { seadex_finder, nyaa_html_finder, gogo_anime_finder } from "./anime-finder-funcs.js";
import { sea_dex_query_creator, nyaa_query_creator, gogoanime_query_creator } from "./query-creator.js";
import { nyaa_function_dispatch } from "./query-dispatcher.js";

async function main() {
    const english_title = 'Tower of God';
    const romanji_title = 'Kami no Tou';
    const type = false;
    const alID = 115230;
    let season_number = 1;
    const episode_number = 5; 

    const sea_dex_query = sea_dex_query_creator(alID, type,  5);

    const nyaa_queries = nyaa_query_creator(english_title, romanji_title,  season_number, episode_number, type);
    const nyaa_results = await nyaa_function_dispatch(nyaa_queries)
    const gogo_query = gogoanime_query_creator(romanji_title, 5, 'sub')

    // const sea_dex_result = await seadex_finder(sea_dex_query[0], sea_dex_query[1], sea_dex_query[2]);

    console.log(nyaa_results);
}

await main();