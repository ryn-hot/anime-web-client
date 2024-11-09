delete globalThis.fetch;

import anitomy from 'anitomyscript';
import fetch from 'node-fetch';
import levenshtein from 'fast-levenshtein';
import { JSDOM } from 'jsdom';
import { load } from 'cheerio';



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
    // console.log(trsList);

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


async function nyaa_html_finder(url, query, set_title, season_number, episode_number, dub) {
    let torrentList = [];
    let reserve_cache = []; 
    let ephemTrsList = [];

    // Fetch the first page
    const nyaa_query_url_first = `${url}&q=${query}&s=seeders&o=desc&p=1`;
    // console.log(nyaa_query_url_first);
    const response_first = await fetch(nyaa_query_url_first);
    console.log(`First page status: ${response_first.status}`)
    const html_first = await response_first.text();

    // console.log(`Processing page number 1`);

    // Extract data from the first page
    ephemTrsList = ephemTrsList.concat(extractTorrentData(html_first));

    // Extract the total number of pages
    const last_page_num = extractPageNumberNyaa(html_first);

    // Create an array of fetch promises for the remaining pages
    let fetchPromises = [];
    for (let i = 2; i <= last_page_num; i++) {
        const nyaa_query_url = `https://nyaa.si/?f=0&c=1_2&q=${query}&s=seeders&o=desc&p=${i}`;
        // console.log(nyaa_query_url);
        fetchPromises.push(fetch(nyaa_query_url).then(response => {
            console.log(`Page ${i} status: ${response.status}`);
            response.text()
        }));     
    }

    // Fetch all pages in parallel
    const htmlPages = await Promise.all(fetchPromises);

    // Process each page's HTML content
    for (let html of htmlPages) {
        ephemTrsList = ephemTrsList.concat(extractTorrentData(html));
    }

    // Process the torrent list as per your existing logic
    for (const torrent of ephemTrsList) {
        // console.log(`\nTitle Eval: ${torrent.title}`);
        let title = replaceTildeWithHyphen(torrent.title);
        title = removeSpacesAroundHyphens(title);
        let torrent_info = await parse_title(title);
        
        const lev_distance  = levenshtein.get(set_title.toLowerCase(), torrent_info.anime_title.toLowerCase());

        if (lev_distance > 1) {
            // console.log("Title Mismatch");
            // console.log(`Set Title: ${set_title}, Torrent Info Title: ${torrent_info.anime_title}`);
            continue;
        }

        //Additional season checking logic 
        const season_num_extract = extractSeasonFromTitle(torrent_info.anime_title);

        if (season_num_extract != null) {
            torrent_info.anime_season = season_num_extract;
        }

        if (season_number != torrent_info.anime_season) {
            if ((season_number != 1 && season_number != undefined) || torrent_info.anime_season != undefined) {
                // console.log("Season Number Mismatch");
                continue; 
            }
        } 

        const episode_int = convertToIntegers(torrent_info.episode_number);

        if (episode_int.length >= 1) {
            const range = getRange(episode_int);

            if (!range.includes(episode_number)) {
                // console.log(`Episode Not in Range: ${range}, Episode Number: ${episode_number}`);
                continue;
            }
        } else {
            if (season_number != undefined && episode_number != undefined) {
                // console.log(`Episode Not in Range: Query for TV Series`);
                continue;
            }
        }

        if (dub === true && !hasDualAudioOrEnglishDub(torrent.title)) {
            // console.log(`Episode does not have English Dub`);
            continue;
        }

        if (season_number == torrent_info.anime_season && torrent_info.episode_number == undefined) {
            reserve_cache.push(torrent)
        }

        // console.log(`Torrent Added`);
        torrentList.push(torrent); 
    }

    if (torrentList.length >= 1) {
        reserve_cache.length = 0;
    }

    // console.log(torrentList);
    return { torrentList, reserve_cache };
}

async function nyaa_reserve_extract(reserve_torrents, episode) {
    const trsContainingEpisode = [];

    for (const trs of reserve_torrents) {

        const nyaa_response = await fetch(trs.url); 
        const html = await nyaa_response.text();
        // console.log(html);
        const mkvFiles = extractMkvFiles(html);

        if (!(episode === undefined)) {

            for (const mkvFile of mkvFiles) {
                // console.log(mkvFile);
                const episode_info = await parse_title(mkvFile);
                if (episode_info.episode_number == episode) {
                    trsContainingEpisode.push(trs);
                }
            }

        }
    }

    return trsContainingEpisode;
}

async function test_server_id() {
    const server_url = `https://watch.hikaritv.xyz/ajax/embedserver/16498/1`;
    const server_response = await fetch(server_url);
    const data = await server_response.json();
    const embedID = data.embedFirst;

    const response = await fetch(`https://watch.hikaritv.xyz/ajax/embed/16498/1/${embedID}`);
    const embedData = await response.text();
    const htmlArray = JSON.parse(embedData);
    const src = extractSrcUsingRegex(htmlArray[0]);
    /*const dom = new JSDOM(htmlArray[0]);
    console.log(embedData);
    const iframe = dom.window.document.querySelector(`iframe`);
    const src = iframe.getAttribute(`src`);*/
}

async function hikaritv_anime_finder(alID, episode) {
    try {
        const server_url = `https://watch.hikaritv.xyz/ajax/embedserver/${alID}/${episode}`;
        const server_response = await fetch(server_url);
        const serverData = await server_response.json();
        const embedID = serverData.embedFirst;
        

        if (embedID) {
            const response = await fetch(`https://watch.hikaritv.xyz/ajax/embed/${alID}/${episode}/${embedID}`);
            const embedData = await response.text();
            const htmlArray = JSON.parse(embedData);
            const embeddedLink = extractSrcUsingRegex(htmlArray[0]);
            return [embeddedLink];
        }
        else {
            return []
        }
    }
    catch (error) {
        console.error('Error extracting iframe src:', error);
        throw error; // Re-throw the error after logging it
    }
}

async function gogo_anime_finder(title, episode, type) {
    try {
        const slugTitle = title.toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-');     // Replace spaces with hyphens
        
        console.log(slugTitle);
        console.log(episode);
        // Construct the epid
        let sourceUrl;

        if (type == 'dub') {
            sourceUrl = `https://anitaku.pe/${slugTitle}-dub-episode-${episode}`;
        }
        else {
            sourceUrl = `https://anitaku.pe/${slugTitle}-episode-${episode}`;
        }
        
        // First try to get the server/source data
        //const sourceUrl = `https://anitaku.pe/shingeki-no-kyojin-dub-episode-1`;
        console.log(sourceUrl);
        const sourceResponse = await fetch(sourceUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
        });

        // Let's see what the raw response looks like
        const rawText = await sourceResponse.text();
        //console.log('Raw response:', rawText);
        
        extractGogoLink(rawText);
        //extractGogoLink(rawText);
        /*const possibleVideoLinks = extractVideoLinks(rawText);
        console.log('--- Printing Links Using For Loop ---');
        for (let i = 0; i < possibleVideoLinks.length; i++) {
            console.log(possibleVideoLinks [i]);
        }*/

    }
    catch (err) {
        console.error('Error fetching video source:', err);
        throw err;
    }
} 

function extractGogoLink(html) {
    const $ = load(html);
    const iframeElement = $('iframe');

    // Check if the element exists
    if (iframeElement.length > 0) {
        // Extract the src attribute
        let iframeSrc = iframeElement.attr('src');
      
        // Decode HTML entities in the URL
        // iframeSrc = he.decode(iframeSrc);
      
        console.log('Iframe Source URL:', iframeSrc);
      } else {
        console.log('No iframe element found.');
      }
  
}

function findHtmlElement(html) {
    const $ = load(html);
    const targetLink = 'https://s3taku.com/abpl1245?id=MjYzMw==&title=Shingeki+no+Kyojin+Episode+1';
    // Attributes to check (e.g., 'href', 'src', 'data')
    const attributesToCheck = ['href', 'src', 'data'];

    // Initialize an array to hold matching elements
    const matchingElements = [];

    // Iterate over each attribute
    attributesToCheck.forEach((attr) => {
    // Use the attribute equals selector to find exact matches
    const elements = $(`[${attr}="${targetLink}"]`);

    elements.each((_, element) => {
        // Get the outer HTML of the element
        const elementHtml = $.html(element);

        // Add to the array if not already included
        if (!matchingElements.includes(elementHtml)) {
        matchingElements.push(elementHtml);
        }
    });
    });

    if (matchingElements.length > 0) {
        console.log('Found the following elements containing the target link:\n');
        matchingElements.forEach((elementHtml, index) => {
          console.log(`Element ${index + 1}:\n${elementHtml}\n`);
        });
      } else {
        console.log('No elements found with the given link.');
      }
}

function extractVideoLinks(html) {
    const $ = load(html);
    const videoLinks = [];

    // Array of selectors for elements that may contain video stream links
  const selectors = [
    'iframe[src]',
    'video[src]',
    'embed[src]',
    'source[src]',
    'object[data]',
    'a[href]',
    'link[href]',
    'script[src]',
  ];

  selectors.forEach((selector) => {
    $(selector).each((index, element) => {
      let url = $(element).attr('src') || $(element).attr('data') || $(element).attr('href');
      if (url && !videoLinks.includes(url)) {
        videoLinks.push(url);
      }
    });
  });

  return videoLinks;
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

function spaceToUnderscore(str) {
    return str.replace(/\s/g, '_');
}

function extractSrcUsingRegex(iframeHtml) {
    const srcRegex = /src="([^"]+)"/;
    const match = iframeHtml.match(srcRegex);
    return match ? match[1] : null;
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
    
    if (input == undefined) {
        return 0;
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


function extractPageNumberNyaa(html) {
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


export {
    seadex_finder,
    nyaa_html_finder,
    gogo_anime_finder,
    nyaa_reserve_extract
}
// console.log(results); 
// const title = 'fullmetal alchemist';
const url = `https://nyaa.si/?f=0&c=1_2`;
const query = 'Kami+no+Tou';
const season_number = 1;
const episode_number = 5;
const set_title = 'Kami no Tou';

const dub = false;
nyaa_html_finder(url, query, set_title, season_number, episode_number, dub); 
// gogo_anime_finder(title, 1, 'dub');
// test_server_id();
// const title_romanji = `Shingeki no Kyojin`;
// const result = await hikaritv_anime_extract(16498, 1);
// Add looser title matching, strict matching but not exact.
// let query = `One+Piece`;
//const result = await nyaa_html_finder('Tower+Of+God', 'Tower of God', 1, 5);
// console.log(result);
// console.log(output)
//let results  = await parse_title(title); let title = "[tlacatlc6] Natsume Yuujinchou Shi Vol. 1v2 & Vol. 2 (BD 1280x720 x264 AAC)"; 
