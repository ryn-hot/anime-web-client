delete globalThis.fetch;

import anitomy from 'anitomyscript';
import fetch from 'node-fetch';

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

async function parse_title(title) {
    let results = await anitomy(title);
    return results;
}

async function torrent_filter(torrent, season_number, episode_number, dub) {
    console.log(typeof torrent.title);
    console.log(torrent.title);
    const torrent_info = await parse_title(torrent.title);

    if (season_number != torrent_info.anime_season) {
        if (season_number != 1 && torrent_info.anime_season != undefined) {
            console.log(`Skipped For Season Not Matching: Season: ${torrent_info.anime_season}`)
        }
    } 

    if (torrent_info.episode_number == undefined) {
        const response = await fetch(torrent.url);
        const html = await response.text();
        const mkvFiles = extractMkvFiles(html);
        for (const mkvFile in mkvFiles) {
            const episode_info = await parse_title(mkvFile);
            if (episode_number == episode_info.episode_number) {
                torrentList.push(torrent);
            }
        }
        console.log();
    }

    const episode_int = convertToIntegers(torrent_info.episode_number);

    console.log(`\nTitle Eval: ${torrent.title}`);
    console.log(`episode_int: ${episode_int}`);

    if (episode_int.length >= 1) {
        const range = getRange(episode_int);
        console.log(`Range: ${range}`);
        if (!range.includes(episode_number)) {
            console.log(`Episode Not in Range: ${range}, Episode Number: ${episode_number}`);
        }
    }
    else {
        console.log(`Failed Length Range`);
    }


    if (dub === true && !hasDualAudioOrEnglishDub(torrent.title)) {
        console.log(`Episode does not have English Dub`);
    }

    /*if (!(season_number == torrent_info.anime_season) && season_number != 1 && torrent_info.anime_season != undefined) {
        console.log(`Season Number does Not match, Torrent Season Number: ${torrent_info.anime_season}, Required Season: ${season_number}`);
        continue;
    }*/

    console.log(`Torrent Succeeded`);

}

const torrent = {
    title: 'One Piece Episode 1086-1096 [English Dub][1080p][CR]',
    url: 'https://nyaa.si/view/1874882',
    magnetLink: 'magnet:?xt=urn:btih:95de93d043adb6fd58c574294816f3b17c1cb9d9&amp;dn=One%20Piece%20Episode%201086-1096%20%5BEnglish%20Dub%5D%5B1080p%5D%5BCR%5D&amp;tr=http%3A%2F%2Fnyaa.tracker.wf%3A7777%2Fannounce&amp;tr=udp%3A%2F%2Fopen.stealth.si%3A80%2Fannounce&amp;tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&amp;tr=udp%3A%2F%2Fexodus.desync.com%3A6969%2Fannounce&amp;tr=udp%3A%2F%2Ftracker.torrent.eu.org%3A451%2Fannounce',
    seeders: '7'
}

const _ = torrent_filter(torrent);