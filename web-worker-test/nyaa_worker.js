importScripts(`anitomyscript.bundle.min.js`);
importScripts('worker_helpers.js');

self.onmessage = async function(event) {
    const { query, set_title, season_number, episode_number, dub } = event.data;

    try {
        const result = await nyaa_html_finder(query, set_title, season_number, episode_number, dub);
        self.postMessage({ result });
    } catch (error) {
        self.postMessage({ error: error.message });
    }
};

async function nyaa_html_finder(query, set_title, season_number, episode_number, dub) {
    let page_number = 1;
    let page_condition = true;
    let page_limit = 0;
    let torrentList = [];
    let ephemTrsList = [];

    while (page_condition) {
        const nyaa_query_url = `https://nyaa.si/?f=0&c=1_2&q=${query}&s=seeders&o=desc&p=${page_number}`; //&s=seeders&o=desc     `https://nyaa.si/?f=0&c=1_2&q=${query}&p=${page_number}`
        console.log(nyaa_query_url);
        const response = await fetch(nyaa_query_url);
        const html = await response.text();
        

        console.log(`processing page number ${page_number}`);

        ephemTrsList = ephemTrsList.concat(extractTorrentData(html));


        if (page_number == 1) {
            const last_page_num = extractPageNumberNyaa(html)
            //console.log(last_page_num);
            page_limit = last_page_num + 1;
        }

        page_number += 1;

        if (page_number >= page_limit) {
            page_condition = false;
        }

    }

    for (const torrent of ephemTrsList) {
        console.log(`\nTitle Eval: ${torrent.title}`);
        console.log(typeof torrent.title);
        let title = replaceTildeWithHyphen(torrent.title);
        title = removeSpacesAroundHyphens(title);
        const torrent_info = await parse_title(title);
        
        const lev_distance  = levenshteinDistance(set_title.toLowerCase(), torrent_info.anime_title.toLowerCase());

        if (lev_distance > 1) {
            console.log("Title Mismatch");
            console.log(`Set Title: ${set_title}, Torrent Info Title: ${torrent_info.anime_title}`)
            continue;
        }

        if (season_number != torrent_info.anime_season) {
            if ((season_number != 1 && season_number != undefined) || torrent_info.anime_season != undefined) {
                console.log("Season Number Mismatch");
                continue; 
            }
        } 


        const episode_int = convertToIntegers(torrent_info.episode_number);

        if (episode_int.length >= 1) {
            const range = getRange(episode_int);

            if (!range.includes(episode_number)) {
                console.log(`Episode Not in Range: ${range}, Episode Number: ${episode_number}`);
                continue;
            }
        }
        else {

            if (season_number != undefined && episode_number != undefined) {
                    console.log(`Episode Not in Range: Query for TV Series`);
                    continue;
            }
            
        }


        if (dub === true && !hasDualAudioOrEnglishDub(torrent.title)) {
            console.log(`Episode does not have English Dub`);
            continue;
        }

        console.log(`Torrent Added`);
        torrentList.push(torrent); 

    }

    return torrentList;

}