

function sea_dex_query_creator(alID, dub, episode) {
    const query = [alID, dub, episode];
    return query;
}

function nyaa_query_creator(english_title, romanji_title,  season_number, episode_number, dub, alID) {
    let nyaa_queries = [];

    const season_number_extract = extractSeasonFromTitle(english_title);

    // !!!! add a season in title flag so if the season number is in the title we dont use season queries. !!!!
    let season_in_title_flag = false;
    //extracts season # from title
    if (season_number_extract != null) {
        season_in_title_flag = true;
        season_number = season_number_extract;
    }

    const season_pad = formatNumber(season_number);
    const episode_pad = formatNumber(episode_number);
    

    //nyaa queries
    const default_url = `https://nyaa.si/?f=0&c=1_2`;
    const yameii_url = `https://nyaa.si/user/Yameii?f=0&c=1_2`;
    const erai_url = `https://nyaa.si/user/Erai-raws?f=0&c=1_2`;
    const subsplease_url = `https://nyaa.si/user/subsplease?f=0&c=1_2`;
    const judas_url = `https://nyaa.si/user/Judas?f=0&c=1_2`;
    const horribleSubs_url = `https://nyaa.si/user/HorribleSubs?f=0&c=1_2`;

    if (season_in_title_flag) {

        const query3 = [default_url, replaceSpacesWithPlus(`${english_title}`), english_title, season_number, episode_number, dub, alID];

        const query4 = [default_url, replaceSpacesWithPlus(`${romanji_title}`), romanji_title, season_number, episode_number, dub, alID];
    
        const query5 = [default_url, replaceSpacesWithPlus(`${english_title} Season ${season_number}`), english_title, season_number, episode_number, dub, alID];
    
        const query6 = [default_url, replaceSpacesWithPlus(`${romanji_title} Season ${season_number}`), english_title, season_number, episode_number, dub, alID];

        nyaa_queries.push(query3, query4, query5, query6);

    } else {

        const query1 = [default_url, replaceSpacesWithPlus(`${english_title} - S${season_pad}E${episode_pad}`), english_title, season_number, episode_number, dub, alID];

        const query2 = [default_url, replaceSpacesWithPlus(`${romanji_title} - S${season_pad}E${episode_pad}`), romanji_title, season_number, episode_number, dub, alID];

        const query3 = [default_url, replaceSpacesWithPlus(`${english_title}`), english_title, season_number, episode_number, dub, alID];

        const query4 = [default_url, replaceSpacesWithPlus(`${romanji_title}`), romanji_title, season_number, episode_number, dub, alID];

        const query5 = [default_url, replaceSpacesWithPlus(`${english_title} Season ${season_number}`), english_title, season_number, episode_number, dub, alID];

        const query6 = [default_url, replaceSpacesWithPlus(`${romanji_title} Season ${season_number}`), english_title, season_number, episode_number, dub, alID];

        nyaa_queries.push(query1, query2, query3, query4, query5, query6);
    }


    //nyaa special provider queries:
    if (dub == 'dub') {

        const queryDub1 = [yameii_url, replaceSpacesWithPlus(`${english_title}`), english_title, season_number, episode_number, dub, alID];

        const queryDub2 = [yameii_url, replaceSpacesWithPlus(`${romanji_title}`), romanji_title, season_number, episode_number, dub, alID];

        nyaa_queries.push(queryDub1, queryDub2);
    }
    else {

        const queryErai1 = [erai_url, replaceSpacesWithPlus(`${english_title}`), english_title, season_number, episode_number, dub, alID];

        const queryErai2 = [erai_url, replaceSpacesWithPlus(`${romanji_title}`), romanji_title, season_number, episode_number, dub, alID];

        const querySubsPlease1 = [subsplease_url, replaceSpacesWithPlus(`${english_title}`), english_title, season_number, episode_number, dub, alID];

        const querySubsPlease2 = [subsplease_url, replaceSpacesWithPlus(`${romanji_title}`), romanji_title, season_number, episode_number, dub, alID];

        const queryJudas1 = [judas_url, replaceSpacesWithPlus(`${english_title}`), english_title, season_number, episode_number, dub, alID];

        const queryJudas2 = [judas_url, replaceSpacesWithPlus(`${romanji_title}`), romanji_title, season_number, episode_number, dub, alID];

        const queryHorribleSubs1 = [horribleSubs_url, replaceSpacesWithPlus(`${english_title}`), english_title, season_number, episode_number, dub, alID];

        const queryHorribleSubs2 = [horribleSubs_url, replaceSpacesWithPlus(`${romanji_title}`), romanji_title, season_number, episode_number, dub, alID];

        nyaa_queries.push(queryErai1, queryErai2, querySubsPlease1, querySubsPlease2, queryJudas1, queryJudas2, queryHorribleSubs1, queryHorribleSubs2);
    }

    
    return nyaa_queries

}

function gogoanime_query_creator(romanji_title, episode, type) {
    const query = [romanji_title, episode, type];
    return query;
}

function nyaa_fallback_queries(english_title, romanji_title, episode_number, dub, alID) {

    let nyaa_queries = [];
    const default_url = `https://nyaa.si/?f=0&c=1_2`;
    const episode_pad = formatNumber(episode_number);

    const queryReserve1_text_input = `${english_title} - ${episode_pad}`;
    const queryReserve1_season_number = 1;
    const query_reserve_1 = [default_url, replaceSpacesWithPlus(queryReserve1_text_input), english_title, queryReserve1_season_number, episode_number, dub, alID];

    const query2_text_input = `${english_title}`;
    const queryReserve2_season_number = 1;
    const query_reserve_2 = [default_url, replaceSpacesWithPlus(query2_text_input), english_title, queryReserve2_season_number, episode_number, dub, alID];


    const queryReserve3_text_input = `${romanji_title} - ${episode_pad}`;
    const queryReserve3_season_number = 1;
    const query_reserve_3 = [default_url, replaceSpacesWithPlus(queryReserve3_text_input), romanji_title, queryReserve3_season_number, episode_number, dub, alID];

    const queryReserve4_text_input = `${romanji_title}`;
    const queryReserve4_season_number = 1;
    const query_reserve_4 = [default_url, replaceSpacesWithPlus(queryReserve4_text_input), romanji_title, queryReserve4_season_number, episode_number, dub, alID];

    nyaa_queries.push(query_reserve_1, query_reserve_2, query_reserve_3, query_reserve_4);

    return nyaa_queries
}


function extractSeasonFromTitle(title) {
    // Array of patterns to match different season number formats
    const patterns = [
      // "Season X" or "Season XX"
      /season\s*(\d{1,2})\b/i,
      // "SX" or "SXX" when it's part of the title
      /\bs(\d{1,2})\b(?!e\d{1,2})/i,  // negative lookahead to avoid matching SXXEXX format
      // Handle special cases like "2nd Season", "3rd Season"
      /(\d+)(?:st|nd|rd|th)\s+season/i,
      // Match just the number after a colon if followed by season-related words
      /:\s*(\d+)(?:\s+(?:season|part|cour))?/i
    ];
  
    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
  
    return null;
}

function replaceColonWithHyphen(str) {
    return str.replace(/\s*:\s*/g, ' - ');
}

function formatNumber(num) {
    return String(num).padStart(2, '0');
}

function replaceSpacesWithPlus(str) {
    return str.replace(/\s+/g, '+');
}

export {
    sea_dex_query_creator,
    nyaa_query_creator,
    gogoanime_query_creator,
    nyaa_fallback_queries
}
