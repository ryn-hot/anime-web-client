delete globalThis.fetch;

import anitomy from 'anitomyscript';


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


let title = `[LostYears] Attack on Titan S03E01 (38) (WEB 1080p Hi10 AAC) [Dual Audio] (Shingeki no Kyojin)`;
title = removeSpacesAroundHyphens(title)
console.log(title);
const results = await anitomy(title);


const season_num = 1;

console.log(season_num == results.anime_season);

//const output = convertToIntegers(results.episode_number);

console.log(results)



//	[Judas] Bleach 338-366 [BD 1080p][HEVC x265 10bit][Dual-Audio][Multi-Subs] (Batch) One Piece Episode 1086-1096 [English Dub][1080p][CR]
// console.log(results.episode_number);
// console.log(typeof results.episode_number);


