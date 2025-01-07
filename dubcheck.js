import * as cheerio from "cheerio";
import fetch from "node-fetch";

console.log(await animescheduleDubCheck('Eyeshield 21'));

console.log(await checkMALDubs(15));

async function checkMALDubs(malID) {
    try {
        // Fetch the raw JSON file from GitHub
        const response = await fetch('https://raw.githubusercontent.com/MAL-Dubs/MAL-Dubs/main/data/dubInfo.json');
        const data = await response.json();
        
        // Check if the ID exists in either array
        const isDubbed = data.dubbed.includes(malID);
        const isIncomplete = data.incomplete.includes(malID);

        if (isDubbed || isIncomplete) {
            return true;
        } else {
            return false;
        }
        
        
    } catch (error) {
        console.error('Error fetching MAL dubs data:', error);
        return false;
    }
}

// Usage example:
// const result = await checkMALDubs(1234);
// console.log(result); // { isDubbed: true/false, isIncomplete: true/false }


async function animescheduleDubCheck(title) {
    const query_title = formatString(title);
    console.log(`Query: `, query_title);

    const url = `https://animeschedule.net/anime/${query_title}`;
    console.log(`Url: ${url}`);
    try {
        const response = await fetch(url);
        const html = await response.text(); 


        const dubCheck = checkDubbed(html);
    
        // console.log(dubCheck);
        return dubCheck;

    } catch {
        return false; 
    }
    
   

}

function checkDubbed(html) {
    // Load the HTML with cheerio
    const $ = cheerio.load(html);
    
    // Check if section with ID exists
    const section = $('#air-types-section');
    if (!section.length) {
      return false;
    }
    
    // Find all air-type divs
    const airTypes = section.find('.air-type');
    
    // Find the one containing "Dub:"
    const dubDiv = airTypes.filter(function() {
      return $(this).text().trim().includes('Dub:');
    });
    
    // If we found the dub div, check if it has an SVG with class="checkmark"
    if (dubDiv.length) {
      const checkmark = dubDiv.find('svg.checkmark');
      return checkmark.length > 0;
    }
    
    return false;
}

  
function formatString(str) {
    return str
      .toLowerCase()
      // Replace special character and any following space with just a hyphen
      .replace(/[^a-z0-9\s]\s*/g, '-')
      // Replace remaining spaces with hyphens
      .replace(/\s+/g, '-')
      // Clean up multiple hyphens
      .replace(/-+/g, '-')
      // Remove any trailing/leading hyphens
      .replace(/^-+|-+$/g, '');
}

export {
    animescheduleDubCheck,
    checkMALDubs
}