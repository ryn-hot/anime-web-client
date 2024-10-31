async function parse_title(title) {
    let results = await anitomy(title);
    return results;
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

function levenshteinDistance(str1, str2) {
    // Create a matrix of size (str2.length + 1) x (str1.length + 1)
    const matrix = Array(str2.length + 1).fill().map(() => 
      Array(str1.length + 1).fill(0)
    );
    
    // Initialize first row and column
    for (let i = 0; i <= str2.length; i++) {
      matrix[i][0] = i;
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    // Fill in the rest of the matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        const cost = str1[j - 1] === str2[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }
    
    // Return the bottom-right cell of the matrix
    return matrix[str2.length][str1.length];
  }
  