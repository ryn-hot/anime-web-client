function query_creator(english_title, romanji_title,  season_number, episode_number, dub) {
    let nyaa_queries = [];

    const season_pad = formatNumber(season_number);
    const episode_pad = formatNumber(episode_number);
    

    //nyaa queries
    const default_url = `https://nyaa.si/?f=0&c=1_2`;
    const yameii_url = `https://nyaa.si/user/Yameii?f=0&c=1_2`;
    const erai_url = `https://nyaa.si/user/Erai-raws?f=0&c=1_2`;
    const subsplease_url = `https://nyaa.si/user/subsplease?f=0&c=1_2`;
    const judas_url = `https://nyaa.si/user/Judas?f=0&c=1_2`;

    const query1 = [default_url, replaceSpacesWithHyphens(`${english_title} - S${season_pad}E${episode_pad}`), english_title, season_number, episode_number, dub];

    const query2 = [default_url, replaceSpacesWithHyphens(`${romanji_title} - S${season_pad}E${episode_pad}`), romanji_title, season_number, episode_number, dub];
    
    const query3 = [default_url, replaceSpacesWithHyphens(`${english_title} Season ${season_number} Episode ${episode_number}`), english_title, season_number, episode_number, dub];

    const query4 = [default_url, replaceSpacesWithHyphens(`${romanji_title} Season ${season_number} Episode ${episode_number}`), romanji_title, season_number, episode_number, dub];

    const query5 = [default_url, replaceSpacesWithHyphens(`${english_title}`), english_title, season_number, episode_number, dub];

    const query6 = [default_url, replaceSpacesWithHyphens(`${romanji_title}`), romanji_title, season_number, episode_number, dub];

    const query7 = [default_url, replaceSpacesWithHyphens(`${english_title} Season ${season_number}`), english_title, season_number, episode_number, dub];

    const query8 = [default_url, replaceSpacesWithHyphens(`${romanji_title} Season ${season_number}`), english_title, season_number, episode_number, dub];

    //nyaa special provider queries:
    if (dub == true) {

        const queryDub1 = [yameii_url, replaceSpacesWithHyphens(`${english_title}`), english_title, season_number, episode_number, dub];

        const queryDub2 = [yameii_url, replaceSpacesWithHyphens(`${romanji_title}`), romanji_title, season_number, episode_number, dub];
    }
    else {

        const queryErai1 = [erai_url, replaceSpacesWithHyphens(`${english_title}`), english_title, season_number, episode_number, dub];

        const queryErai2 = [erai_url, replaceSpacesWithHyphens(`${romanji_title}`, romanji_title, season_number, episode_number, dub)];

        const querySubsPlease1 = [subsplease_url, replaceSpacesWithHyphens(`${english_title}`), english_title, season_number, episode_number, dub];

        const querySubsPlease2 = [subsplease_url, replaceSpacesWithHyphens(`${romanji_title}`, romanji_title, season_number, episode_number, dub)];

        const queryJudas1 = [judas_url, replaceSpacesWithHyphens(`${english_title}`), english_title, season_number, episode_number, dub];

        const queryJudas2 = [judas_url, replaceSpacesWithHyphens(`${romanji_title}`, romanji_title, season_number, episode_number, dub)];
    }

    


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