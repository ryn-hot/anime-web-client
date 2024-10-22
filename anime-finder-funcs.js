delete globalThis.fetch;

import anitomy from 'anitomyscript';
import fetch from 'node-fetch';



async function parse_title(title) {
    let results = await anitomy(title);
    return results;
}

// season_data is the data extracted from parse_title
async function seadex_finder(alID, dub, episode) {
    const rec_url = `https://releases.moe/api/collections/entries/records?filter=alID=${alID}`;
    const response = await fetch(rec_url);
    const data = await response.json();

    const trsList = data.items[0].trs;
    console.log(trsList);

    let entries = [];

    for (const trs of trsList) {
        const url = `https://releases.moe/api/collections/torrents/records/${trs}`;
        console.log(url)
        const response = await fetch(url);
        //console.log(response);
        const data = await response.json();
        if (!(data.url.includes("nyaa"))) {
            continue;
        }
        if (dub === true && data.dualAudio === false) {
            continue;
        }

        const nyaa_response = await fetch(data.url); 
        const html = await nyaa_response.text();
        //console.log(html);
        const mkvFiles = extractMkvFiles(html);
        let containsEpisode = false;
        let targetEpData = null; 

        if (!(episode === undefined)) {

            for (const mkvFile of mkvFiles) {
                console.log(mkvFile);
                const episode_info = await parse_title(mkvFile);
                if (episode_info.episode_number == episode) {
                    containsEpisode = true;
                    targetEpData = episode_info;
                }
            }

            if (!containsEpisode) {
                continue;
            }

        }
    
        
        const num_seeders = extractSeeders(html);
        console.log(num_seeders);
        const infoHash = extractInfoHash(html)
        console.log(infoHash);
        const magnetLink = extractMagnetLink(html);
        console.log(magnetLink);
        const items = data;
        const entry = {
            magnetLink: magnetLink,
            infoHash: infoHash,
            seeders: num_seeders,
            DualAudio: data.dualAudio,
            isBest: data.isBest,
            episodeData: targetEpData,
            
        };
        entries.push(entry);
    }

    console.log(entries);
    return entries
}

async function nyaa_html_finder(query, set_title, season_number, episode_number, dub) {
    let page_number = 1;
    let page_condition = true
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
            const last_page_num = extractPageNumber(html)
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
        
        if (set_title != torrent_info.anime_title) {
            console.log("Title Mismatch");
            console.log(`Set Title: ${set_title}, Torrent Info Title: ${torrent_info.anime_title}`)
            continue;
        }

        if (season_number != torrent_info.anime_season) {
            if (season_number != 1 || torrent_info.anime_season != undefined) {
                console.log("Season Number Mismatch");
                continue;
            }
        } 

        if (torrent_info.episode_number == undefined) {
            continue;
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
            continue;
        }


        if (dub === true && !hasDualAudioOrEnglishDub(torrent.title)) {
            console.log(`Episode does not have English Dub`);
            continue;
        }

        /*if (!(season_number == torrent_info.anime_season) && season_number != 1 && torrent_info.anime_season != undefined) {
            console.log(`Season Number does Not match, Torrent Season Number: ${torrent_info.anime_season}, Required Season: ${season_number}`);
            continue;
        }*/

        console.log(`Torrent Added`);
        torrentList.push(torrent); 

    }

    return torrentList;

}

function replaceTildeWithHyphen(title) {
    if (typeof title !== 'string') {
        throw new TypeError('The input must be a string.');
    }
    return title.replace(/~/g, '-');
}

function getRange(numbers) {
    if (!Array.isArray(numbers) || numbers.length === 0) {
      throw new Error("Input must be a non-empty array of numbers");
    }
  
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
  
    const range = [];
    for (let i = min; i <= max; i++) {
      range.push(i);
    }
  
    return range;
}

function convertToIntegers(input) {
    // Helper function to convert a single string to an integer
    function stringToInt(str) {
      return parseInt(str, 10);
    }
  
    // Helper function to handle interval strings
    function handleInterval(str) {
      const [start, end] = str.split('-').map(stringToInt);
      return [start, end];
    }
  
    // If input is a string
    if (typeof input === 'string') {
      // Check if it's an interval
      if (input.includes('-')) {
        return handleInterval(input);
      }
      // Otherwise, it's a single number
      return [stringToInt(input)];
    }
  
    // If input is an array
    if (Array.isArray(input)) {
      return input.map(stringToInt);
    }
  
    // If input is neither a string nor an array
    throw new Error('Input must be a string or an array of strings');
}

function hasDualAudioOrEnglishDub(title) {
    // Define the regex pattern
    const pattern = /\b(?:dual\s*[-_]?\s*audio|english\s*[-_]?\s*dub)\b/i;
    
    // Test the title against the regex
    return pattern.test(title);
}


function extractTorrentData(html) {
    const results = [];

    // Regex to match each <tr> with class default, danger, or success
    const trRegex = /<tr\s+class="(?:default|danger|success)">([\s\S]*?)<\/tr>/g;
    let trMatch;

    while ((trMatch = trRegex.exec(html)) !== null) {
        const trContent = trMatch[1];

        //console.log(trContent);

        // Extract the title and href from the <a> tag within the second <td colspan="2">
        // Use negative lookahead to skip <a> tags with class="comments"
        const titleHrefRegex = /<td\s+colspan="2">[\s\S]*?<a(?![^>]*class=["']comments["'])[^>]*href="([^"#]+)"[^>]*title="([^"]+)">[^<]+<\/a>/;
        const titleHrefMatch = trContent.match(titleHrefRegex);
        const href = titleHrefMatch ? titleHrefMatch[1] : null;
        const title = titleHrefMatch ? titleHrefMatch[2] : null;
        const url = `https://nyaa.si` + href;

        //console.log(`Title: ${title}`);
        //console.log(`URL: ${url}`);

        // Extract the magnet link
        const magnetRegex = /<a[^>]*href="(magnet:\?xt=urn:btih:[^"]+)"[^>]*><i[^>]*class="fa fa-fw fa-magnet"><\/i><\/a>/;
        const magnetMatch = trContent.match(magnetRegex);
        const magnetLink = magnetMatch ? magnetMatch[1] : null;

        //console.log(`magnetLink: ${magnetLink}`);

        // Extract the first text-center value after data-timestamp
        const timestampRegex = /data-timestamp="\d+">[^<]+<\/td>\s*<td\s+class="text-center">([^<]+)<\/td>/;
        const timestampMatch = trContent.match(timestampRegex);
        const firstTextAfterTimestamp = timestampMatch ? timestampMatch[1].trim() : null;

        if (firstTextAfterTimestamp == 0) {
            continue;
        }
        //console.log(`Seeders: ${firstTextAfterTimestamp}\n`);

        //break;

        // Push the extracted data to the results array
        if (title && url && magnetLink && firstTextAfterTimestamp !== null) {
            /*console.log(`Torrent Entry:`);
            console.log(`Title: ${title}`);
            console.log(`URL: ${url}`);
            console.log(`magnetLink: ${magnetLink}`);
            console.log(`Seeders: ${firstTextAfterTimestamp}\n`);*/

            results.push({
                title: title,
                url: url,
                magnetLink: magnetLink,
                seeders : firstTextAfterTimestamp
            });
        }
    }

    //console.log(`Results: ${results}`); 
    return results;
}


function extractPageNumber(html) {
    const regex = /<a href="[^"]*p=(\d+)">(\d+)<\/a>/g;
    let lastNumber = null;
    let match;
    
    // Iterate through all matches and keep updating lastNumber
    while ((match = regex.exec(html)) !== null) {
        lastNumber = parseInt(match[1], 10); // or match[2] since both capture the same number
    }
    
    return lastNumber;
}

function extractMkvFiles(html) {
    const regex = /(?<=i>)[^\/]+\.mkv/g;
    return html.match(regex) || [];
}

function extractSeeders(html) {
    const regex = /Seeders:<\/div>\s*<div[^>]*><span[^>]*>(\d+)<\/span>/;
    const match = html.match(regex);
    return match ? parseInt(match[1], 10) : null;
}

function extractInfoHash(html) {
    const regex = /Info hash:<\/div>\s*<div[^>]*><kbd>([a-fA-F0-9]+)<\/kbd>/;
    const match = html.match(regex);
    return match ? match[1] : null;
}

function extractMagnetLink(html) {
    const magnetRegex = /href="(magnet:\?xt=urn:btih:[^"]+)"/gi;
    const links = [];
    let match;

    while ((match = magnetRegex.exec(html)) !== null) {
        // Replace HTML entities with their corresponding characters
        const magnetLink = match[1].replace(/&amp;/g, '&');
        links.push(magnetLink);
    }

    return links;
}

function removeSpacesAroundHyphens(str) {
    return str.replace(/(\b[+-]?\d+(?:\.\d+)?\b)\s*([-–—])\s*(\b[+-]?\d+(?:\.\d+)?\b)/g, '$1$2$3');
}

  
let query = `Attack+on+Titan+Season+1`;
let output = await nyaa_html_finder(query, `Attack on Titan`, 1, 1, false);
// output = await seadex_finder(16498, true, 1);

console.log(output);
//console.log(output)
//let results  = await parse_title(title); let title = "[tlacatlc6] Natsume Yuujinchou Shi Vol. 1v2 & Vol. 2 (BD 1280x720 x264 AAC)";
