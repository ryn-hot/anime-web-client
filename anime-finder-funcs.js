delete globalThis.fetch;

import anitomy from 'anitomyscript';
import fetch from 'node-fetch';
import levenshtein from 'fast-levenshtein';
import { JSDOM } from 'jsdom';
import { load } from 'cheerio';
import { globalTorrentCache, cacheTorrentRange } from './cache.js';


async function parse_title(title) {
    let results = await anitomy(title);
    return results;
}


async function modified_anitomy(...args) {
    const res = await anitomy(...args);

    const parseObjs = Array.isArray(res) ? res : [res]

    for (const obj of parseObjs) {
        obj.anime_title ??= ''
        const seasonMatch = obj.anime_title.match(/S(\d{2})E(\d{2})/)
        if (seasonMatch) {
          obj.anime_season = seasonMatch[1]
          obj.episode_number = seasonMatch[2]
          obj.anime_title = obj.anime_title.replace(/S(\d{2})E(\d{2})/, '')
        }
        const yearMatch = obj.anime_title.match(/ (19[5-9]\d|20\d{2})/)
        if (yearMatch && Number(yearMatch[1]) <= (new Date().getUTCFullYear() + 1)) {
          obj.anime_year = yearMatch[1]
          obj.anime_title = obj.anime_title.replace(/ (19[5-9]\d|20\d{2})/, '')
        }
        if (Number(obj.anime_season) > 1) obj.anime_title += ' S' + obj.anime_season
    }
    
    return parseObjs
}
    
async function parse_title_reserve(title) {
    
    let results = await anitomy(title);
    if (results.episode_number == undefined) {
        const regex = /(?:[Ss](?:eason)?\s*\d+\s*[Ee](?:pisode)?\s*(\d+))|(?:Season\s*\d+\s*Episode\s*(\d+))|\b[Ee](\d{1,2})\b|-\s*(\d{1,2})\s*-/;
        const match = title.match(regex);
        if (match) {
            // console.log(`regex matched`)
              // Iterate through capturing groups to find the one that matched
            for (let i = 1; i < match.length; i++) {
                if (match[i] !== undefined) {
                    // console.log(`episode found: `, parseInt(match[i], 10))
                    results.episode_number = parseInt(match[i], 10);
                }
            }
        }
    }
    return results;
}

async function animetosho_torrent_exctracter(anidb_id, title, episode, format, dub, anilistID) {
    
    const query = replaceSpacesWithPlus(title);
    let url;
    let page = 1;
    
    const html_list = [];
    let nextPage = true;
    while (nextPage) {
        console.log(`Fetching page: ${page}`);

        if (format != `TV`) {
            url = `https://animetosho.org/search?q=${query}&aids=${anidb_id}&page=${page}`
        } else {
            url = `https://animetosho.org/search?q=${episode}&aids=${anidb_id}&page=${page}`;
        }
        
        console.log(`url: ${url}`);
        const response = await fetchWithRetry(url);
        const html = await response.text();
        if (html.includes('<div>No items found!</div>')) {
            nextPage = false;
        } else {
            html_list.push(html);
            page += 1;
        }

    }

    const entries = [];

    for (const html of html_list) {
        const $ = load(html);

        $('div[class^="home_list_entry"]').each((index, element) => {
            const entry = {  
                title: $(element).find('.link').text().trim(),
                page_url: $(element).find('.link a').attr('href'),
                magnet_link: $(element).find('a[href^="magnet:"]').attr('href') || null,
                nzb_link: $(element).find('a[href$=".nzb.gz"]').attr('href') || null,
                seeders: parseInt($(element).find('span[title*="Seeders"]').text().match(/\d+/) || 0),
                leechers: parseInt($(element).find('span[title*="Leechers"]').text().match(/\d+/) || 0),
                torrent_cachable: false,
                cache_range: null, 
            };
            
            entries.push(entry);
        });
    }

    // console.log(entries);

    const filteredEntries = await animeToshoEpisodeFilter(entries, format, episode, dub);

    const nzbEntries = filteredEntries.filter(entry => entry.nzb_link !== null);
    const torrentEntries = filteredEntries.filter(entry => entry !== null);  
    let validTorrentEntries;

    if (format !== 'MOVIE') {
        validTorrentEntries = await processAnimeToshoTorrents(torrentEntries, episode);
    } else {
        validTorrentEntries = torrentEntries;
    }
   
    const allEntries = validTorrentEntries
        .sort((a, b) => b.seeders - a.seeders)
        .slice(0, Math.min(3, validTorrentEntries.length));

    for (const torrent of allEntries) {
        if (torrent.torrent_cachable) {
            cacheTorrentRange(anilistID, torrent.cache_range[0], torrent.cache_range[torrent.cache_range.length - 1], dub, torrent.magnet_link, torrent.seeders);
        }
    }
    // console.log(`Valid Torrent Entries: ${JSON.stringify(allEntries, null, 2)}\n`);

    // console.log(`NZB entries: ${JSON.stringify(nzbEntries, null, 2)}`);  

    return {allEntries, nzbEntries}
}

async function processAnimeToshoTorrents(torrentEntries, episode) {
    const valid_trs = [];

    for (const torrent of torrentEntries) {
        // console.log(`\nChecking Torrent: `, torrent.title);
        // console.log('fetching url: ', torrent.page_url);

        const response = await fetchWithRetry(torrent.page_url);
        const html = await response.text();

        let nyaa_link = null;

        const $ = load(html);
        const nyaaElement = $('a:contains("Nyaa")');

        const hasFiles = $('th:contains("Files")').length > 0;
        if (hasFiles) {
            // Find all divs with classes containing 'view_list_entry'
            // console.log(`Files Found on Page`);
            const titles = [];
            $('div[class*="view_list_entry"]').each((index, element) => {
                // For each div, find the link div, get the anchor tag, and extract its text
                const title = $(element).find('.link a').text().trim();
                titles.push(title);
            });

            if (titles.length >= 1) {
                // console.log(`Checking Files`);

                const mkvFiles = titles.filter(title => title.includes('.mkv'));
                let fileFound = false;
                const cache_set = new Set();

                for (const mkvFile of mkvFiles) {
                    
                    const episode_info = await modified_anitomy(mkvFile);
                    const episode_number =  parseInt(episode_info[0].episode_number);
                    cache_set.add(episode_number);

                    if (episode === episode_number) {
                        // onsole.log(`Found Episode`);
                        valid_trs.push(torrent);
                        fileFound = true;
                    }
                }

                if (fileFound) {
                    const sortedRange = [...cache_set].sort((a, b) => a - b);
                    torrent.cache_range = sortedRange;
                    torrent.torrent_cachable = true; 
                }
            }
        } else if (nyaaElement.length > 0) {
            // console.log(`Nyaa Link Found and Called`);
            const files = [];

            nyaa_link = nyaaElement.attr('href');

            const nyaa_response = await fetchWithRetry(nyaa_link);
            const nyaa_html =  await nyaa_response.text();

            if (nyaa_html === '') {
                // console.log('Nyaa Fetching HTML Error Status: ', nyaa_response.status);
                // console.log('Error Url: ', nyaa_response.url);
            }

            const nyaa_parser = load(nyaa_html);

            nyaa_parser('li:has(i.fa.fa-file)').each((index, element) => {
                // Get the text content of the li, excluding the icon and file size
                const fullText = $(element).text().trim();
                // Remove the file size portion (which is in the span)
                const file = fullText.replace(/\s*\(\d+\.?\d*\s*MiB\)$/, '').trim();
                // console.log('Found File: ', file);
                files.push(file);
            });

            const mkvFiles = files.filter(file => file.includes('.mkv'));

            let fileFound = false;
            const cache_set = new Set();

            for (const mkvFile of mkvFiles) {
                const episode_info = await modified_anitomy(mkvFile);
                // console.log('Nyaa Episode Being Processed: ', parseInt(episode_info[0].episode_number));
                cache_set.add(episode_info);
                const episode_number =  parseInt(episode_info[0].episode_number);
                if (episode === episode_number) {
                    // console.log(`Found Episode`);
                    valid_trs.push(torrent);
                    fileFound = true;
                }

            }

            if (fileFound) {
                const sortedRange = [...cache_set].sort((a, b) => a - b);
                torrent.cache_range = sortedRange;
                torrent.torrent_cachable = true; 
            }

        } else {
            // console.log('No Files or Nyaa link found');
        }
    } 

    //console.log('Valid TRS: ', valid_trs);
    return valid_trs;
}

async function animeToshoEpisodeFilter(entries, format, episode, dub) {
    // console.log(`filtering entries`);
    const filteredEntries = [];

    for (const entry of entries) {
        // console.log(`\n\nEntry Title: ${entry.title}`);
        // console.log(`Entry Magnet Link: ${entry.magnet_link}`);

        if (dub == 'dub' && !hasDualAudioOrEnglishDub(entry.title)) {
            continue;
        }

        filteredEntries.push(entry);

    }

    return filteredEntries
}


function replaceSpacesWithPlus(str) {
    return str.replace(/\s+/g, '+');
}

// season_data is the data extracted from parse_title
async function seadex_finder(alID, audio, episode, format, english_title, romanji_title) {
    console.log(`seadex finder`)
    const rec_url = `https://releases.moe/api/collections/entries/records?filter=alID=${alID}`;
    const response = await fetchWithRetry(rec_url);
    const data = await response.json();



    

    // console.log(data)
    if (!data?.items?.length || !data.items[0]?.trs) {
        // No valid data found, return empty array
        console.log(`No SeaDex entries found for anime ID: ${alID}`);
        return [];
    }


    const trsList = data.items[0].trs;

    console.log(`trsList Length: `, trsList.length);

    let entries = [];

    if (trsList.length > 0) {
        for (const trs of trsList) {
            const url = `https://releases.moe/api/collections/torrents/records/${trs}`;
            // console.log(url)
            const response = await fetchWithRetry(url);
            // console.log(`Response: `, response);
            const data = await response.json();
            // console.log(`Data: `, data);
            if (!(data.url.includes("nyaa"))) {
                // console.log(`non nyaa trs src`);
                continue;
            }
            if (audio === 'dub' && data.dualAudio === false) {
                // console.log(`trs not dual audio`);
                continue;
            }
    
            const nyaa_response = await fetchWithRetry(data.url); 
            const html = await nyaa_response.text();

            // console.log(html);

            const mkvFiles  = data.files
                .map(file => file.name)
                .filter(name => name.toLowerCase().endsWith('.mkv'));
            
            
            console.log(`mkvFiles Length: `, mkvFiles.length);
                
            let containsEpisode = false;
            let targetEpData = null; 
    
            if (format == 'TV' || format == 'ONA') {
    
                for (const mkvFile of mkvFiles) {
                    // console.log(mkvFile);
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
            // console.log(num_seeders);
            const infoHash = extractInfoHash(html)
            // console.log(infoHash);
            const magnetLink = extractMagnetLink(html);
            // console.log(magnetLink);
            const items = data;
            const entry = {
                magnetLink: magnetLink,
                infoHash: infoHash,
                seeders: num_seeders,
                DualAudio: data.dualAudio,
                isBest: data.isBest,
                episodeData: targetEpData,
                
            };

            // console.log(`seadex entry found: ` + `\n`, entry);
            if (mkvFiles.length > 1) {
                let episodeNum;
                const startRange = episode;
                let endRange;

                const anilist_episodes = await alIdFetchEpisodes(alID);
                

                if (anilist_episodes == null || anilist_episodes == undefined) {
                    episodeNum = mkvFiles.length; 
                } else {
                    episodeNum = Math.min(mkvFiles.length, anilist_episodes);
                }

                endRange = episode + episodeNum - 1;
                
                if (anilist_episodes) {
                    endRange = Math.min(endRange, anilist_episodes);
                }
            
                console.log(`anilist episodes: `, anilist_episodes);
                
        
                console.log(`Inserted into cache from seadex: anilistId=${alID}, episodes [${startRange}..${endRange}], audio: ${audio}`);

                if (startRange < endRange) {
                    cacheTorrentRange(alID, startRange, endRange, audio, magnetLink, num_seeders);
                }
                
            }
            

            entries.push(entry);
        }
    }


    // console.log(entries);
    return entries
}

//async function anime_tosho_finder(anidb_id, )

async function nyaa_html_finder(url, query, set_title, season_number, episode_number, dub, alID) {
    let torrentList = [];
    let reserve_cache = []; 
    let ephemTrsList = [];

    // Fetch the first page
    const nyaa_query_url_first = `${url}&q=${query}&s=seeders&o=desc&p=1`;
    // console.log(nyaa_query_url_first);
    const response_first = await fetchWithRetry(nyaa_query_url_first);


    // console.log(`First page status: ${response_first.status}, url: `, nyaa_query_url_first);
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
        fetchPromises.push(fetchWithRetry(nyaa_query_url).then(response => {
            // console.log(`Page ${i} status: ${response.status}`);
            return response.text()
        }));     
    }

    // Fetch all pages in parallel
    const htmlPages = await Promise.all(fetchPromises);

    // Process each page's HTML content
    for (let html of htmlPages) {
        ephemTrsList = ephemTrsList.concat(extractTorrentData(html));
    }

    // Process the torrent list as per your existing logic
    for (let torrent of ephemTrsList) {
        // console.log(`\nTitle Eval: ${torrent.title}`);
        let title = replaceTildeWithHyphen(torrent.title);
        title = removeSpacesAroundHyphens(title);
        let torrent_info = await parse_title(title);
        
        //Additional season checking logic 
        const season_num_extract = extractSeasonFromTitle(torrent_info.anime_title);

        if (season_num_extract != null) {
            torrent_info.anime_season = season_num_extract;
        }
        
        torrent_info.anime_title = processTitle(torrent_info.anime_title, set_title);

        if (dub === 'dub' && !hasDualAudioOrEnglishDub(torrent.title)) {
            // console.log(`Episode does not have English Dub`);
            continue;
        }

        const lev_distance  = levenshtein.get(normalizeTitle(set_title.toLowerCase()), normalizeTitle(torrent_info.anime_title.toLowerCase()));

        if (lev_distance > 1) {
            // console.log("Title Mismatch");
            // console.log(`Set Title: ${set_title}, Torrent Info Title: ${torrent_info.anime_title}`);
            continue;
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

            // Insert episode slice into cache here.
            let magnetLink = torrent.magnetLink;
            if (Array.isArray(magnetLink)) {
              magnetLink = magnetLink[0]; 
            }

            if (alID !== undefined) {
                cacheTorrentRange(alID, range[0], range[range.length - 1], dub, magnetLink, parseInt(torrent.seeders, 10));

                //console.log(`Inserted into cache: anilistId=${alID}, episodes [${range[0]}..${range[range.length - 1]}], magnetLink=${magnetLink}`);
            }
            

        } else {
            if (season_number == torrent_info.anime_season && torrent_info.episode_number == undefined) {
                // console.log(`Torrent Added to Reserve Cache`)
                reserve_cache.push(torrent)
            }
            if (season_number != undefined && episode_number != undefined) {
                // console.log(`Episode Not in Range: Query for TV Series`);
                continue;
            }
        }


        // console.log(`Torrent Added`);
        torrent.seeders = parseInt(torrent.seeders, 10);
        torrentList.push(torrent); 
    }

    if (torrentList.length >= 3) {
        reserve_cache.length = 0;
    }

    // console.log(torrentList);
    return { torrentList, reserve_cache };
}

async function nyaa_reserve_extract(reserve_torrents, episode) {
    const trsContainingEpisode = [];

    for (const trs of reserve_torrents) {
        // console.log(`\n\n\nTorrent Currently being processed:`, trs);

        const nyaa_response = await fetch(trs.url); 
        // console.log(`Fetching Torrent Url: `, trs.url);
        const html = await nyaa_response.text();
        // console.log(html);
        const mkvFiles = extractMkvFiles(html);

        if (!(episode === undefined)) {

            for (const mkvFile of mkvFiles) {
                // console.log(`mkvfile: `, mkvFile);
                const episode_info = await parse_title_reserve(mkvFile);
                // console.log(`episode_info: \n`, episode_info);
                if (episode_info.episode_number == episode) {
                    trsContainingEpisode.push(trs);
                }
            }

        }
        // console.log('\n\n\n');
    }

    return trsContainingEpisode;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to fetch with retry
async function fetchWithRetry(url, retries = 3, delayDuration = 1000) {
    for (let i = 0; i <= retries; i++) {
        try {
            // console.log(`Attempting to fetch url:`, url);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        // console.log(`Fetch Success Status: ${response.status}, url`, url);
        return response; // Return the successful response
        } catch (error) {
            if (i < retries) {
                // console.log(`Fetch failed (attempt ${i + 1}), retrying in ${delayDuration}ms...`);
                // console.log(error);
                await delay(delayDuration);
            } else {
                return {
                    text: async () => '',    // Empty string for HTML
                    json: async () => ({}),  // Empty object for JSON
                    ok: true,
                    status: error.status || 500,
                    statusText: error.message,
                    url: url,
                    error: error
                };; // Throw the error if retries are exhausted
            }
        }
    }
}

async function alIdFetchEpisodes(alID) {
    const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        episodes
        status
        nextAiringEpisode {
            airingAt
            timeUntilAiring
            episode
          }
      }
    }
    `
  
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { id: alID }
      })
    });
    const data = await response.json();
    //console.log(data.data);
    return data.data.Media.episodes;
  
}

function normalizeTitle(title) {
    return title
        .toLowerCase()
        .replace(/[:\-–—_]/g, ' ')       // Replace punctuation with a space
        .replace(/\s+/g, ' ')            // Replace multiple spaces with one
        .trim();                         // Remove leading and trailing spaces
}


function processTitle(title, given_title) {
    // Regular expression to match 'S' followed by one or more digits
    // console.log(title);
    const regex = /S(\d+)/;
    const match = title.match(regex);

    if (match) {
        // Extract the number after 'S'
        const number = parseInt(match[1], 10);
        // Remove 'S{number}' from the title string
        let newTitle;
        const contSeason1 = containsSeason1(given_title);
        if (number == 1 && !contSeason1) {
            newTitle = title.replace(regex, '').trim();
        }
        else {
            newTitle = title.replace(regex, `Season ${number}`)
        }
            
        return newTitle;
    } else {

        return title;
    }
}

function containsSeason1(str) {
    // Regular expression to match 'Season' followed by any non-digit characters (including none), and then '1'
    // The \b ensures that '1' is a whole word (not part of a larger number like '12')
    const regex = /Season\D*1\b/i;
    return regex.test(str);
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
        
        // console.log(slugTitle);
        // console.log(episode);
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
        
        return extractGogoLink(rawText);
        
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
        
        // console.log('Iframe Source URL:', iframeSrc);
        return iframeSrc;
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
    nyaa_reserve_extract,
    animetosho_torrent_exctracter,
    parse_title_reserve,
    fetchWithRetry,
    delay
}

// console.log(results); 
// const title = 'fullmetal alchemist';
// const url = `https://nyaa.si/?f=0&c=1_2`;
// const query = 'Bleach:+Sennen+Kessen-hen';
// const season_number = 1;
// const episode_number = 5;
// const set_title = 'Bleach: Sennen Kessen-hen';
// const dub = false;
// const results = await nyaa_html_finder(url, query, set_title, season_number, episode_number, dub); 
// console.log(results);
// console.log(globalTorrentCache);
// gogo_anime_finder(title, 1, 'dub');
// test_server_id();
// const title_romanji = `Shingeki no Kyojin`;
// const result = await hikaritv_anime_extract(16498, 1);
// Add looser title matching, strict matching but not exact.
// let query = `One+Piece`;

//const result = await nyaa_html_finder('Tower+Of+God', 'Tower of God', 1, 5);
//console.log(result);


// console.log(output)
// let results  = await parse_title(title); let title = "[tlacatlc6] Natsume Yuujinchou Shi Vol. 1v2 & Vol. 2 (BD 1280x720 x264 AAC)"; 

// console.log(await parse_title_reserve(`[SubsPlease] Dandadan - 11 (1080p) [8748535F].mkv `));

// const results = await animetosho_torrent_exctracter(69, 'One Piece', 100, 'TV', 'sub');


