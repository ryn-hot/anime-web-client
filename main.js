//https://api.ani.zip/mappings?anilist_id=' + media.id storing future api call

import { seadex_finder, gogo_anime_finder, parse_title_reserve } from "./anime-finder-funcs.js";
import { sea_dex_query_creator, nyaa_query_creator, nyaa_fallback_queries, gogoanime_query_creator } from "./query-creator.js";
import { nyaa_function_dispatch } from "./query-dispatcher.js";
import { findMagnetForEpisode, storeTorrentMetadata, getTorrentMetadata } from "./cache.js";
import { getGlobalClient } from "./webtorrent-client.js";

// await main();
// let db = null; 
// await crawler_dispatch(db, 'Re:ZERO -Starting Life in Another World- Season 2', 'Re:ZERO kara Hajimeru Isekai Seikatsu 2nd Season', 'dub', 108632, 14792, 3);

async function crawler_dispatch(db, english_title, romanji_title, audio, alID, anidbId, episode_number, format, proxy = null) {
    /* const trs_results = [];
    const english_title = 'Your Name.';
    const romanji_title = 'Kimi no Na Wa';
    const type = true; 
    const alID = 21519;
    const episode_number = null; null for movies */
    // console.log(`crawler format: `, format);
    const cached = findMagnetForEpisode(alID, episode_number, audio);

    if (cached) {
        
        console.log(`cache hit: ${ english_title } episode: ${ episode_number } audio: ${audio} magnetLink ${cached.magnetLink} `);

        const magnetLink = Array.isArray(cached.magnetLink) 
            ? cached.magnetLink[0].replace(/&amp;/g, '&')
            : cached.magnetLink.replace(/&amp;/g, '&');
    
        const seeders = cached.seeders; 
        const fileData = getTorrentMetadata(magnetLink);

        if (fileData) {
            console.log(`cache hit for torrent metadata`)
            //console.log(`fileData: ` + `\n`, fileData);
            await writeTorrentMetadataFromCache(fileData, magnetLink, episode_number, seeders, audio, alID, anidbId, db);

        } else {

            await fetchTorrentMetadata(magnetLink, episode_number, seeders, audio, alID, anidbId, db, format);
        }
        


    } else {

        let season_number = 1; // hardcoded for better fetching accuracy
    
        const trs_results = [];
    
        
        const sea_dex_query_results = await seadex_finder(alID, audio, episode_number, format, english_title, romanji_title);
        trs_results.push(...sea_dex_query_results)
    
        const nyaa_queries = nyaa_query_creator(english_title, romanji_title, season_number, episode_number, audio, alID);
        const nyaa_results = await nyaa_function_dispatch(nyaa_queries, true, false);
        // console.log(nyaa_results);
        trs_results.push(...nyaa_results);
    
        if (nyaa_results.length < 3) {
            const nyaa_fallback_q = nyaa_fallback_queries(english_title, romanji_title, episode_number, audio, alID);
            const nyaa_fallback_results = await nyaa_function_dispatch(nyaa_fallback_q, false, true);
            trs_results.push(...nyaa_fallback_results);
        }
    
        
        const gogo_query = gogoanime_query_creator(romanji_title, episode_number, audio);
        const gogo_link = await gogo_anime_finder(...gogo_query);
        
        if (gogo_link) {
            db.storeEpisodeAndSource({
                anilistId: alID, 
                anidbId: anidbId, 
                episodeNumber: episode_number, 
                audioType: audio, 
                category: 'http', 
                videoUrl: gogo_link
            });
        }
    
        const trs_results_deduped = dedupeMagnetLinks(trs_results);
        
        // console.log(`trs_results deduped: `, trs_results);
        const trs_results_sorted = sortTorrentList(trs_results_deduped);
        // console.log(`trs_results sorted: `, trs_results_sorted);
        // console.log(trs_results_deduped);
    
        // const trs_final = []; 

        for (let i = 0; i < Math.min(trs_results_sorted.length, 3); i++) {
            const raw_torrent = trs_results_sorted[i];
            // console.log(`raw_torrent magnetLink:`, raw_torrent.magnetLink);
           // Ensure we get a single magnet link string
           let magnetLink = Array.isArray(raw_torrent.magnetLink)
                ? raw_torrent.magnetLink[0] 
                : raw_torrent.magnetLink;
            
            magnetLink = magnetLink.replace(/&amp;/g, '&');
    
            const seeders = raw_torrent.seeders;
            const audio_type = raw_torrent.audio_type; 
            

            /*console.log(`processed magnetLink:`,magnetLink);
            console.log(`\naudio_type:`, audio_type);
            console.log(`\nseeders:`, seeders); */
            await fetchTorrentMetadata(magnetLink, episode_number, seeders, audio_type, alID, anidbId, db, format);
        } 
    } 
}

async function writeTorrentMetadataFromCache(fileData, magnetURI, episode_number, seeders, audio_type, alID, anidbId, db) {
    const fileList = fileData.fileList;
    
    let fileInfo = null;
  
    if (episode_number !== undefined) {
        let desiredFileFound = false;
        let desiredFileIndex = null;
        let desiredFileName = null;

        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            // console.log(`Checking file: ${file.name}`);

            if (file.name.toLowerCase().endsWith('.mkv')) {
                const file_title_data = await parse_title_reserve(file.name);
                if (file_title_data.episode_number == episode_number) {
                    // console.log(`Found the desired episode (Episode ${episode_number}): ${file.name}`);
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

            db.storeEpisodeAndSource({
                anilistId: alID,
                anidbId: anidbId,
                episodeNumber: episode_number,
                audioType: audio_type,
                category: 'torrent',
                magnetLink: fileInfo.magnetLink,
                fileIndex: fileInfo.fileIndex,
                fileName: fileInfo.fileName,
                seeders: seeders,
            }); 

            console.log('Storing episode file info:', fileInfo);
        } else {
            console.log(`No MKV file matching episode ${episode_number} was found in this torrent.`);
        }
    }
}
//cache file meta data. 
async function fetchTorrentMetadata(magnetURI, episode_number, seeders, audio_type, alID, anidbId, db, format) {
    return new Promise((resolve, reject) => {
        const client = getGlobalClient();
        // console.log('Torrent added. Waiting for metadata...');

        const metadataTimeout = setTimeout(() => {
            console.log(`Metadata event did not fire within 15 seconds for ${magnetURI}, destroying torrent...`);
            torrent.destroy(() => {
              resolve(null); // or reject, depending on how you want to handle it
            });
          }, 30000);

        const torrent = client.add(magnetURI)

        torrent.on('infoHash', () => {
        console.log(`InfoHash event fired: ${torrent.infoHash}`)
        })

        torrent.on('metadata', async () => {
        console.log('Metadata event fired!')

        try {
            clearTimeout(metadataTimeout);
            
            console.log(`Entry Format: `, format);
            
            clearTimeout(metadataTimeout);

            let fileInfo = null;

            if (format !== 'MOVIE') {

            console.log('Entering Episode Matching'); 

            let desiredFileFound = false;
            let desiredFileIndex = null;
            let desiredFileName = null;

            for (let i = 0; i < torrent.files.length; i++) {
                const file = torrent.files[i];
                // console.log(`Checking file: ${file.name}`);

                if (file.name.toLowerCase().endsWith('.mkv')) {
                const file_title_data = await parse_title_reserve(file.name);
                if (file_title_data.episode_number == episode_number) {
                    // console.log(`Found the desired episode (Episode ${episode_number}): ${file.name}`);
                    desiredFileFound = true;
                    desiredFileIndex = i;
                    desiredFileName = file.name;

                    break;
                }
                }
            }

            if (desiredFileFound) {

                const fileList = torrent.files.map((file, idx) => ({
                    name: file.name,
                    index: idx
                    // you could parse episode_number here if you want
                }));

                storeTorrentMetadata(magnetURI, fileList);

                fileInfo = {
                magnetLink: magnetURI,
                fileIndex: desiredFileIndex,
                fileName: desiredFileName
                };

                db.storeEpisodeAndSource({
                anilistId: alID,
                anidbId: anidbId,
                episodeNumber: episode_number,
                audioType: audio_type,
                category: 'torrent',
                magnetLink: fileInfo.magnetLink,
                fileIndex: fileInfo.fileIndex,
                fileName: fileInfo.fileName,
                seeders: seeders,
                }); 

                console.log('Storing episode file info:' + `\n`, fileInfo);
            } else {
                console.log(`No MKV file matching episode ${episode_number} was found in this torrent.\n`);
            }
            } else {
                console.log('Checking for movie file...');
                const mkvFiles = torrent.files.filter(file => file.name.toLowerCase().endsWith('.mkv'));
                if (mkvFiles.length === 0) {
                    console.log('No MKV files found. Could not identify a movie file.');
                    torrent.destroy(() => {
                        console.log('Torrent destroyed. No valid movie file found.' + `\n`);
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
                
                db.storeEpisodeAndSource({
                    anilistId: alID,
                    anidbId: anidbId,
                    episodeNumber: episode_number,
                    audioType: audio_type,
                    category: 'torrent',
                    magnetLink: fileInfo.magnetLink,
                    fileIndex: fileInfo.fileIndex,
                    fileName: fileInfo.fileName,
                    seeders: seeders,
                }); 

                console.log('Storing file info:' + `\n`, fileInfo);
            }

            // Cleanup and resolve once done
            torrent.destroy(() => {
            // console.log('Client destroyed. Test complete.');
            resolve(fileInfo); // Resolve the main promise
            });

        } catch (err) {
            console.error('Health check failed or torrent error:', err.message);
            torrent.destroy(() => {
            console.log('Client destroyed due to health check failure.');
            reject(err); // Reject the main promise to indicate failure
            });
        }
        });

        torrent.on('error', (err) => {
        console.error('Torrent error:', err);
        torrent.destroy(() => {
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

async function torrentHealthCheck(torrent) {
    await new Promise((resolveHealth, rejectHealth) => {
        const healthCheckTimeout = setTimeout(() => {
          // console.log('Health check timeout triggered');
          if (torrent.numPeers === 0) {
            // console.log('Peer Health Check Failed - no peers found.');
            rejectHealth(new Error('No peers found, torrent likely unhealthy.'));
          } else {
            // console.log(`Peer Health Passed - ${torrent.numPeers} peer(s) connected.`);
            resolveHealth();
          }
        }, 10000);

        torrent.on('error', (err) => {
          clearTimeout(healthCheckTimeout);
          rejectHealth(err);
        });
    });

}
function sortTorrentList(torrents) {
    return [...torrents].sort((a, b) => {
        return b.seeders - a.seeders;
    });
}

export {
    crawler_dispatch
}
