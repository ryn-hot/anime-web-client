//https://api.ani.zip/mappings?anilist_id=' + media.id storing future api call

import { seadex_finder, gogo_anime_finder, parse_title_reserve } from "./anime-finder-funcs.js";
import { sea_dex_query_creator, nyaa_query_creator, nyaa_fallback_queries, gogoanime_query_creator } from "./query-creator.js";
import { nyaa_function_dispatch } from "./query-dispatcher.js";
import WebTorrent from "webtorrent";
import wrtc from 'wrtc'

await main();


async function main() {
    const trs_results = [];
    const english_title = 'Your Name.';
    const romanji_title = 'Kimi no Na Wa';
    const type = true; 
    const alID = 21519;
    let season_number = null // 1; // hardcoded for better fetching accuracy
    const episode_number = null; 
    const server_mirror = [];
  

    
    const sea_dex_query = sea_dex_query_creator(alID, type,  episode_number);
    const sea_dex_query_results = await seadex_finder(...sea_dex_query);
    trs_results.push(...sea_dex_query_results)

    const nyaa_queries = nyaa_query_creator(english_title, romanji_title, season_number, episode_number, type);
    const nyaa_results = await nyaa_function_dispatch(nyaa_queries, true, false);
    // console.log(nyaa_results);
    trs_results.push(...nyaa_results);

    if (nyaa_results.length < 1) {
        const nyaa_fallback_q = nyaa_fallback_queries(english_title, romanji_title, episode_number, type);
        const nyaa_fallback_results = await nyaa_function_dispatch(nyaa_fallback_q, false, true);
        trs_results.push(...nyaa_fallback_results);
    }

    
    const gogo_query = gogoanime_query_creator(romanji_title, episode_number, 'sub');
    const gogo_link = await gogo_anime_finder(...gogo_query);
    server_mirror.push(gogo_link);

    const trs_results_deduped = dedupeMagnetLinks(trs_results);

    console.log(trs_results_deduped);

    const trs_final = []; 

    for (let i = 0; i < trs_results_deduped.length; i++) {
        const raw_torrent = trs_results_deduped[i];
        console.log(`raw_torrent magnetLink:`, raw_torrent.magnetLink);
       // Ensure we get a single magnet link string
       let magnetLink = Array.isArray(raw_torrent.magnetLink)
            ? raw_torrent.magnetLink[0] 
            : raw_torrent.magnetLink;

        magnetLink = magnetLink.replace(/&amp;/g, '&');

        console.log(`processed magnetLink:`,magnetLink);

        await fetchTorrentMetadata(magnetLink, episode_number);
    } 
z
    
}

//episode is undefined for movies 
async function fetchTorrentMetadata(magnetURI, episode_number) {
    return new Promise((resolve, reject) => {
      const client = new WebTorrent({ wrtc })
      console.log('Torrent added. Waiting for metadata...');
    
      const torrent = client.add(magnetURI)
  
      torrent.on('infoHash', () => {
        console.log(`InfoHash event fired: ${torrent.infoHash}`)
      })
    
      torrent.on('metadata', async () => {
        console.log('Metadata event fired!')
        console.log('Starting health check...')
    
        try {
          // Health check promise
          await new Promise((resolveHealth, rejectHealth) => {
            const healthCheckTimeout = setTimeout(() => {
              console.log('Health check timeout triggered');
              if (torrent.numPeers === 0) {
                console.log('Peer Health Check Failed - no peers found.');
                rejectHealth(new Error('No peers found, torrent likely unhealthy.'));
              } else {
                console.log(`Peer Health Passed - ${torrent.numPeers} peer(s) connected.`);
                resolveHealth();
              }
            }, 10000);
  
            torrent.on('error', (err) => {
              clearTimeout(healthCheckTimeout);
              rejectHealth(err);
            });
          });
    
          console.log('Torrent is healthy. Proceeding with file inspection.');
          console.log('Files in torrent:')
  
          let fileInfo = null;
  
          if (episode_number !== undefined) {
            let desiredFileFound = false;
            let desiredFileIndex = null;
            let desiredFileName = null;
  
            for (let i = 0; i < torrent.files.length; i++) {
              const file = torrent.files[i];
              console.log(`Checking file: ${file.name}`);
  
              if (file.name.toLowerCase().endsWith('.mkv')) {
                const file_title_data = await parse_title_reserve(file.name);
                if (file_title_data.episode_number == episode_number) {
                  console.log(`Found the desired episode (Episode ${episode_number}): ${file.name}`);
                  desiredFileFound = true;
                  desiredFileIndex = i;
                  desiredFileName = file.name;
                  break;
                }
              }
            }
  
            if (desiredFileFound) {
              fileInfo = {
                magnetLink: magnetURI,
                fileIndex: desiredFileIndex,
                fileName: desiredFileName
              };
              console.log('Storing episode file info:', fileInfo);
            } else {
              console.log(`No MKV file matching episode ${episode_number} was found in this torrent.`);
            }
          } else {
            console.log('Checking for movie file...');
            const mkvFiles = torrent.files.filter(file => file.name.toLowerCase().endsWith('.mkv'));
            if (mkvFiles.length === 0) {
              console.log('No MKV files found. Could not identify a movie file.');
              client.destroy(() => {
                console.log('Client destroyed. No valid movie file found.');
                // resolve the main promise here so caller can continue
                resolve(null);
              });
              return;
            }
  
            mkvFiles.sort((a, b) => b.length - a.length);
            const mainMovieFile = mkvFiles[0];
            console.log(`Selected movie file: ${mainMovieFile.name} (size: ${mainMovieFile.length})`);
  
            fileInfo = {
              magnetLink: magnetURI,
              fileIndex: torrent.files.indexOf(mainMovieFile),
              fileName: mainMovieFile.name
            };
  
            console.log('Storing file info:', fileInfo);
          }
  
          // Cleanup and resolve once done
          client.destroy(() => {
            console.log('Client destroyed. Test complete.');
            resolve(fileInfo); // Resolve the main promise
          });
  
        } catch (err) {
          console.error('Health check failed or torrent error:', err.message);
          client.destroy(() => {
            console.log('Client destroyed due to health check failure.');
            reject(err); // Reject the main promise to indicate failure
          });
        }
      });
    
      torrent.on('error', (err) => {
        console.error('Torrent error:', err);
        client.destroy(() => {
          reject(err); 
        });
      });
    });
  }
  

function dedupeMagnetLinks(entries) {
    // Use Set to track unique magnet links
    const seenMagnetLinks = new Set();
    
    return entries.filter(entry => {
        // Handle both array and string magnet links
        const magnetLink = Array.isArray(entry.magnetLink)
            ? entry.magnetLink[0] 
            : entry.magnetLink;
            
        // Remove HTML entities from magnet links (like &amp;)
        const cleanMagnetLink = magnetLink.replace(/&amp;/g, '&');
        
        // If we haven't seen this magnet link before, keep the entry
        if (!seenMagnetLinks.has(cleanMagnetLink)) {
            seenMagnetLinks.add(cleanMagnetLink);
            return true;
        }
        return false;
    });
}