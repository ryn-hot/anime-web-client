delete globalThis.fetch;

import anitomy from 'anitomyscript';

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

/**
 * Checks if the given title contains "Dual Audio" or "English Dub".
 * The check is case-insensitive and accounts for variations like hyphens, underscores, and extra spaces.
 *
 * @param {string} title - The title string to be checked.
 * @returns {boolean} - Returns true if the title contains "Dual Audio" or "English Dub", otherwise false.
 */
function hasDualAudioOrEnglishDub(title) {
    // Define the regex pattern
    const pattern = /\b(?:dual\s*[-_]?\s*audio|english\s*[-_]?\s*dub)\b/i;
    
    // Test the title against the regex
    return pattern.test(title);
}

function convertToIntegers(input) {
    // Helper function to convert a single string to an integer
    function stringToInt(str) {
      return parseInt(str, 10);
    }
  
    // Helper function to handle interval strings
    function handleInterval(str) {
      const [start, end] = str.split('-').map(stringToInt);
      return { start, end };
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
  
function removeSpacesAroundHyphens(str) {
    return str.replace(/(\b[+-]?\d+(?:\.\d+)?\b)\s*([-–—])\s*(\b[+-]?\d+(?:\.\d+)?\b)/g, '$1$2$3');
}


let title = "[Saizen]_Hungry_Heart_Wild_Striker_01-52_[Complete_DVD]";
// title = removeSpacesAroundHyphens(title)
console.log(title);
const results = await modified_anitomy(title);

console.log(results[0]); 

console.log(parseInt(results[0].episode_number)); 

const bool = (results[0].episode_number === undefined);
//const output = convertToIntegers(results.episode_number);
console.log(bool);



//	[Judas] Bleach 338-366 [BD 1080p][HEVC x265 10bit][Dual-Audio][Multi-Subs] (Batch) One Piece Episode 1086-1096 [English Dub][1080p][CR]
// console.log(results.episode_number);
// console.log(typeof results.episode_number);


