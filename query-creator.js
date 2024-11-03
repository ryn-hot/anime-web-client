function query_creator(english_title, romanji_title,  season_number, episode_number) {
    let queries = [];

    const season_pad = formatNumber(season_number);
    const episode_pad = formatNumber(episode_number);
    

    const query1 = replaceSpacesWithHyphens(`${english_title} - S${season_pad}E${episode_pad}`);
    const query2 = replaceSpacesWithHyphens(`${romanji_title} - S${season_pad}E${episode_pad}`);
    const query3 = replaceSpacesWithHyphens(`${english_title} Season ${season_number} Episode ${episode_number}`);
    const query4 = replaceSpacesWithHyphens(`${romanji_title} Season ${season_number} Episode ${episode_number}`);
    const query5 = replaceSpacesWithHyphens(`${english_title}`);
    const query6 = replaceSpacesWithHyphens(`${romanji_title}`);
    const query7 = replaceSpacesWithHyphens(`${english_title} Season ${season_number}`);
    const query8 = replaceSpacesWithHyphens(`${romanji_title} Season ${season_number}`);

    


    /* const queryReserve1_text_input = `${english_title} - ${episode_pad}`;
    const queryReserve1_season_number = 1;
    const query_reserve_1 = [queryReserve1_text_input, queryReserve1_season_number, episode_number];


    const queryReserve2_text_input = `${romanji_title} - ${episode_pad}`;
    const queryReserve2_season_number = 1;
    const query_reserve_2 = [queryReserve2_text_input, queryReserve2_season_number, episode_number]; */

}

function replaceColonWithHyphen(str) {
    return str.replace(/\s*:\s*/g, ' - ');
}

function formatNumber(num) {
    return String(num).padStart(2, '0');
}

function replaceSpacesWithHyphens(str) {
    return str.replace(/\s+/g, '-');
}