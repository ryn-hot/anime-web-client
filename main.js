//https://api.ani.zip/mappings?anilist_id=' + media.id storing future api call

import { seadex_finder, gogo_anime_finder, parse_title_reserve, find_best_match, animeToshoEpisodeFilter, animeToshoBatchFilter, fetchWithRetry } from "./anime-finder-funcs.js";
import { nyaa_query_creator, nyaa_fallback_queries, gogoanime_query_creator } from "./query-creator.js";
import { nyaa_function_dispatch } from "./query-dispatcher.js";
import { findMagnetForEpisode, storeTorrentMetadata, getTorrentMetadata, findAllTorrentsForEpisode, cacheTorrentRange, isMagnetInCache } from "./cache.js";
import { getGlobalClient, getGlobalClientTest } from "./webtorrent-client.js";


// todo cache update all torrents with file metadata should be added, also advanced handling for cached torrents with no fileData, if they fail their metadata retrieval remove them from the cache.

process.on('unhandledRejection', (reason, promise) => {
    // reason might be a RuntimeError with message: "abort(AbortError: The operation was aborted.)"
    if (
      reason instanceof Error &&
      reason.message &&
      reason.message.includes('AbortError: The operation was aborted.')
    ) {
      // We know we forcibly destroyed a torrent; ignore it
      console.debug('Global ignore: node-fetch AbortError from forced torrent destroy');
    } else {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      // Possibly process.exit(1), etc.
    }
});
  
process.on('uncaughtException', (err) => {
    // err might be a RuntimeError with message: "abort(AbortError: The operation was aborted.)"
    if (
      err instanceof Error &&
      err.message &&
      err.message.includes('AbortError: The operation was aborted.')
    ) {
      // We know we forcibly destroyed a torrent; ignore it
      console.debug('Global ignore: node-fetch AbortError from forced torrent destroy');
    } else {
      console.error('Uncaught Exception:', err);
      // Possibly process.exit(1), etc.
    }
});

// await main();
// let db = null; 
// await crawler_dispatch(null, 'Hungry Heart: Wild Striker', 'Hungry Heart: Wild Striker', 'sub', 17, 612, 1, 'TV');
function bestCachedTorrent(candidates) {
    if (candidates) {
        for (const candidate of candidates) {
            const magnetLink = Array.isArray(candidate.magnetLink) 
                ? candidate.magnetLink[0].replace(/&amp;/g, '&')
                : candidate.magnetLink.replace(/&amp;/g, '&');
    
            const fileData = getTorrentMetadata(magnetLink);

            console.log('Cache Candidate:');
            console.log(candidate);
            // console.log('fileData');
            // console.log(fileData);


            if (fileData) {
                return { torrent: candidate, fileData: fileData }
            }
        } 
    }
    return {torrent: false, fileData: false};
}

async function crawler_dispatch(db, english_title, romanji_title, audio, alID, anidbId, episode_number, format, mode, proxy = null) {
    /* const trs_results = [];
    const english_title = 'Your Name.';
    const romanji_title = 'Kimi no Na Wa';
    const type = true; 
    const alID = 21519;
    const episode_number = null; null for movies */
    // console.log(`crawler format: `, format);
    // console.log('Crawler Dispatch Watch');

   
    

    if (mode === 'build' && episode_number > 1) {
        // Database look back goes here. returns true for any source being present need to change to just torrents!
        const hasEpisode1 = db.hasTypeEpisodeSource(alID, 1, audio, 'torrent');
        console.log('Has Episode 1 Check: ', hasEpisode1)
        if (!hasEpisode1) {
          console.log(`No torrent for Episode 1 with audio ${audio}. Skipping...`);
          return; // Avoid further crawling
        }
    }

    const yearsFound = extractYears(english_title); 

    // const cached = findMagnetForEpisode(alID, episode_number, audio);
    const cached = findAllTorrentsForEpisode(alID, episode_number, audio);
    const cacheResults = bestCachedTorrent(cached);
    const bestTorrent = cacheResults.torrent;
    const fileData = cacheResults.fileData;

    console.log(`bestTorrentCached: ${bestTorrent}, fileData: ${fileData}`);

    if (fileData) {
        // console.log('Crawler Dispatch Cache Branch');
        console.log(`cache hit: ${ english_title } episode: ${ episode_number } audio: ${audio} magnetLink ${cached.magnetLink} `);

        const magnetLink = Array.isArray(bestTorrent.magnetLink) 
            ? bestTorrent.magnetLink[0].replace(/&amp;/g, '&')
            : bestTorrent.magnetLink.replace(/&amp;/g, '&');
    
        const seeders = bestTorrent.seeders; 

        if (fileData) {
            console.log(`cache hit for torrent metadata`)
            //console.log(`fileData: ` + `\n`, fileData);
            await writeTorrentMetadataFromCache(fileData, magnetLink, episode_number, seeders, audio, alID, anidbId, db, english_title, romanji_title);

        } else {
            console.log('No file data for torrent')
        }

    } else {
        let anidbEid;
        let epCount;
        if (format !== 'MOVIE') {
            const mappingsResponse = await fetchWithRetry('https://api.ani.zip/mappings?anilist_id=' + alID);
            const json = await mappingsResponse.json();
            const episodes = json?.episodes || -1;
            epCount = json?.episodeCount || null; 
            const epKey = episode_number.toString();
    
            if (episodes[epKey]) {
                anidbEid = episodes[epKey].anidbEid;
            }
    
            console.log('Episode ID: ', anidbEid);
            console.log('Total Episode Count ', epCount);
        }

        // console.log('Crawler Dispatch Fetch Branch');
        let season_number = 1; // hardcoded for better fetching accuracy
    
        const trs_results = [];
    
        
        const sea_dex_query_results = await seadex_finder(alID, audio, episode_number, format, english_title, romanji_title);
        trs_results.push(...sea_dex_query_results)
        
        if (format !== 'MOVIE' && anidbEid) {
            const toshoEpisodeResults = await animeToshoEpisodeFilter(anidbEid, audio); 
            console.log('toshoEpisodeResults Length: ', toshoEpisodeResults.length);
            trs_results.push(...toshoEpisodeResults);

            if (epCount) {
                const toshoBatchResults = await animeToshoBatchFilter(anidbId, epCount, episode_number, audio);
                console.log('toshoBatchResults Length: ', toshoBatchResults.length);
                trs_results.push(...toshoBatchResults);
            }
        }
        
        // console.log('sea_dex returned');


        if (yearsFound.length === 0) {
            console.log('Nyaa Finders Called');

            const nyaa_queries = nyaa_query_creator(english_title, romanji_title, season_number, episode_number, audio, alID);
            const nyaa_results = await nyaa_function_dispatch(nyaa_queries, true, false);
            // console.log('Nyaa Results'); 
            // console.log(nyaa_results);
            // console.log('\n');
            trs_results.push(...nyaa_results);

            if (nyaa_results.length < 3) {
                const nyaa_fallback_q = nyaa_fallback_queries(english_title, romanji_title, episode_number, audio, alID);
                const nyaa_fallback_results = await nyaa_function_dispatch(nyaa_fallback_q, false, true);
                // console.log('Nyaa Fall Back Results'); 
                // console.log(nyaa_fallback_results);
                // console.log('\n');
                trs_results.push(...nyaa_fallback_results);
            }
        }
    
        
        
        // console.log('Nyaa Results Returned');
        

        /* if (trs_results.length === 0) {
            console.log('nyaa results empty fetching animeTosho results');

            const {animeToshoTorrents = [], nzbEntries = [] } = await animetosho_torrent_exctracter(anidbId, english_title, episode_number, format, audio, alID, 'shallow');
            if (animeToshoTorrents.length === 0) {
                const { animeToshoTorrentsDeep = [], nzbEntriesDeep = [] } = await animetosho_torrent_exctracter(anidbId, english_title, episode_number, audio, format, alID, 'deep');
                trs_results.push(...animeToshoTorrentsDeep);
            }
            
            trs_results.push(...animeToshoTorrents); 
            console.log(`animeToshoResults number of entries found: ${trs_results.length} `);
        } */
        
        /* const gogo_query = gogoanime_query_creator(romanji_title, episode_number, audio);
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
        } */
        
        if (trs_results.length === 0) {
            console.log('No torrents found for this episode');
        } else {
            // console.log('Torrent Results > 1');
            const trs_results_deduped = dedupeMagnetLinks(trs_results);
        
            // console.log(`trs_results deduped: `, trs_results);
            const trs_results_sorted = sortTorrentList(trs_results_deduped);
            // console.log(`trs_results sorted: `, trs_results_sorted);
            // console.log('Trs Results: ', trs_results_deduped.length);
            // sconsole.log(trs_results_deduped);
        
            // const trs_final = []; 
            await processTorrents(trs_results_sorted, episode_number, audio, alID, anidbId, db, format, english_title, romanji_title);

            /* for (let i = 0; i < Math.min(trs_results_sorted.length, 6); i++) {
                const raw_torrent = trs_results_sorted[i];
                // console.log(`raw_torrent magnetLink:`, raw_torrent.magnetLink);
                
            
                // console.log(`Potential Torrent:`);
                // console.log(raw_torrent);


                let magnetLink = Array.isArray(raw_torrent.magnetLink)
                    ? raw_torrent.magnetLink[0] 
                    : raw_torrent.magnetLink;
                
                magnetLink = magnetLink.replace(/&amp;/g, '&');
        
                const seeders = raw_torrent.seeders;
                // const audio_type = raw_torrent.audio_type; 
                

                /*console.log(`processed magnetLink:`,magnetLink);
                console.log(`\naudio_type:`, audio_type);
                console.log(`\nseeders:`, seeders); */
                /* console.log('\nProcessing Torrent: ', raw_torrent.title);
                if (raw_torrent.title === undefined) {
                    console.log(raw_torrent);
                } 

                await fetchTorrentMetadata(magnetLink, episode_number, seeders, audio, alID, anidbId, db, format, english_title, romanji_title);
            } */

        }
    } 
}

async function processTorrents(trs_results_sorted, episode_number, audio, alID, anidbId, db, format, english_title, romanji_title) {
    // Take only the first 6 results
    const torrentsToProcess = trs_results_sorted.slice(0, 6);
    const client = getGlobalClient();

    console.log('torrents left before execution: ', client.torrents.length);
    // Map each torrent to a promise
    const torrentPromises = torrentsToProcess.map(raw_torrent => {
        // Process the magnet link
        let magnetLink = Array.isArray(raw_torrent.magnetLink)
            ? raw_torrent.magnetLink[0]
            : raw_torrent.magnetLink;
        
        magnetLink = magnetLink.replace(/&amp;/g, '&');
        const seeders = raw_torrent.seeders;

        // Return the promise without awaiting it
        return fetchTorrentMetadata(
            magnetLink,
            episode_number,
            seeders,
            audio,
            alID,
            anidbId,
            db,
            format,
            english_title,
            romanji_title
        ).catch(error => {
            // Handle individual torrent errors without failing the entire batch
            console.error(`Error processing torrent: ${error.message}`);
            return null;
        });
    });

    try {
        // Wait for all promises to settle
        const results = await Promise.all(torrentPromises);
        console.log('All results returned')
        // Filter out null results and return successful ones
        return results.filter(result => result !== null);
    } catch (error) {
        console.error('Error processing torrents batch:', error);
        throw error;
    } finally {
        console.log('torrents left after execution: ', client.torrents.length);
    }
};

async function writeTorrentMetadataFromCache(fileData, magnetURI, episode_number, seeders, audio_type, alID, anidbId, db, eng_title, rom_title) {
    const fileList = fileData.fileList;
    
    let fileInfo = null;
  
    if (episode_number !== undefined) {
        let desiredFileFound = false;
        let desiredFileIndex = null;
        let desiredFileName = null;
        const potential_files = [];

        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            // console.log(`Checking file: ${file.name}`);

            if (file.name.toLowerCase().endsWith('.mkv') || file.name.toLowerCase().endsWith('.avi') || file.name.toLowerCase().endsWith('.mp4')) {
                let file_name = addSpacesAroundHyphens(file.name);
                file_name = cleanLeadingZeroes(file_name)
                let file_title_data = await parse_title_reserve(file_name);

                if (file_title_data.episode_number === undefined) {
                    if (isPureNumber(file_title_data.file_name)) {
                        file_title_data.episode_number = parseInt(file_title_data.file_name);
                    }
                }


                if (parseInt(file_title_data.episode_number) === episode_number) {
                    // console.log(`Found the desired episode (Episode ${episode_number}): ${file.name}`);

                    desiredFileFound = true;
                    desiredFileIndex = i;
                    desiredFileName = file.name;
                    potential_files.push({animeTitle: file_title_data.anime_title, fileIndex: i, fileName: file.name });
                }
            }
        }

        let bestMatch;
        if (potential_files.length > 1) {
            bestMatch = find_best_match(potential_files, eng_title, rom_title);
        } else if (potential_files.length > 0) {
            bestMatch = potential_files[0];
        } else {
            desiredFileFound = false
        }

        if (desiredFileFound) {
            desiredFileIndex = bestMatch.fileIndex;
            desiredFileName = bestMatch.fileName;

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
async function fetchTorrentMetadata(magnetURI, episode_number, seeders, audio_type, alID, anidbId, db, format, eng_title, rom_title) {
    return new Promise((resolve, reject) => {
        const client = getGlobalClient();

        const torrent = client.add(magnetURI)
        
        const metadataTimeout = setTimeout(async () => {
            console.log(`Metadata event did not fire within 60 seconds for ${magnetURI}, destroying torrent...`);
            torrent.destroy()
            // await destroyTorrentSafely(torrent);
            console.log('Resolved fetchTorrentMetadata');
            resolve(null);
        }, 30000);
    

        torrent.on('metadata', async () => {
            console.log('Metadata event fired!')

            try {
                clearTimeout(metadataTimeout);
                
                console.log(`Entry Format: `, format);

                let fileInfo = null;

                if (format !== 'MOVIE') {


                    let desiredFileFound = false;
                    let desiredFileIndex = null;
                    let desiredFileName = null;
                    const potential_files = [];
                    const episode_set = new Set();

                    for (let i = 0; i < torrent.files.length; i++) {
                        const file = torrent.files[i];
                        // console.log(`Checking file: ${file.name}`);

                        if (file.name.toLowerCase().endsWith('.mkv') || file.name.toLowerCase().endsWith('.avi') || file.name.toLowerCase().endsWith('.mp4')) {
                            let file_name = addSpacesAroundHyphens(file.name);
                            file_name = cleanLeadingZeroes(file_name);
                            // console.log('file name: ', file_name);
                            let file_title_data = await parse_title_reserve(file_name);

                            if (file_title_data.episode_number !== undefined) {
                                episode_set.add(parseInt(file_title_data.episode_number));
                            } else {
                                if (isPureNumber(file_title_data.file_name)) {
                                    file_title_data.episode_number = parseInt(file_title_data.file_name);
                                    episode_set.add(file_title_data.episode_number)
                                }
                            }

                            if (parseInt(file_title_data.episode_number) == episode_number) {
                                // console.log(`Found the desired episode (Episode ${episode_number}): ${file.name}`);
                                desiredFileFound = true;
                                // console.log(`Potential File Candidate: ${file_title_data.anime_title}`);
                                potential_files.push({animeTitle: file_title_data.anime_title, fileIndex: i, fileName: file.name })
                            }
                        }
                    }

                    let bestMatch;
                    if (potential_files.length > 1) {
                        bestMatch = find_best_match(potential_files, eng_title, rom_title);
                    } else if (potential_files.length > 0) {
                        bestMatch = potential_files[0];
                    } else {
                        desiredFileFound = false
                    }


                    if (desiredFileFound) {

                    
                        desiredFileIndex = bestMatch.fileIndex;
                        desiredFileName = bestMatch.fileName;

                        const fileList = torrent.files.map((file, idx) => ({
                            name: file.name,
                            index: idx
                        }));

                        if(!isMagnetInCache(magnetURI, alID, audio_type)) {
                            const sortedRange = [...episode_set].sort((a, b) => a - b);
                            if (sortedRange.length > 1) {
                                console.log(`Caching From FetchTorrentMetadata: anilistId=${alID}, episodes [${sortedRange[0]}..${sortedRange[sortedRange.length - 1]}], audio: ${audio_type}, title: ${torrent.name}`);
                                cacheTorrentRange(alID, sortedRange[0], sortedRange[sortedRange.length - 1], audio_type, magnetURI, seeders);
                            }
                        } else {
                            console.log('Is Magnet In Cache: ', isMagnetInCache(magnetURI, alID));
                        }

                    
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
                        console.log(`No file matching episode ${episode_number} was found in this torrent.\n`);

                    
                    }
                } else {
                    console.log('Checking for movie file...');
                    const mkvFiles = torrent.files.filter(file => file.name.toLowerCase().endsWith('.mkv'));
                    if (mkvFiles.length === 0) {
                        console.log('No MKV files found. Could not identify a movie file.');
                        torrent.destroy(() => {
                            console.log('Torrent destroyed. No valid movie file found.' + `\n`);
                            // resolve the main promise here so caller can continue
                            console.log('Resolved fetchTorrentMetadata');
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

                console.log('Destorying Torrent')
                // await destroyTorrentSafely(torrent)
                torrent.destroy()
                console.log('Torrent Destoryed')
                console.log('Resolved fetchTorrentMetadata');
                resolve(fileInfo);
            } catch (err) {
                torrent.destroy()
                // await destroyTorrentSafely(torrent);
                console.error('Error in metadata handler:', err);
                console.log('Resolved fetchTorrentMetadata');
                reject(err);

            }
        });

        torrent.on('error', async (err) => {  
            torrent.destroy()
            // await destroyTorrentSafely(torrent);
            console.error('Error in torrent on handler:', err);
            reject(err);
        });
    });
}
  

function dedupeMagnetLinks(entries) {
    const seenHashes = new Set();
    console.log(`Filtering Torrent`);
    
    return entries.filter(entry => {    
        
        // Extract the info hash using regex
        const infoHash = extractInfoHash(entry.magnetLink);


        if (!infoHash) {
            console.log(`No infoHash Extracted Removing: ${infoHash}`)
            return false
        }

        // Check if the info hash has already been seen
        if (!seenHashes.has(infoHash)) {
            console.log(`Torrent is Unique Adding: ${infoHash}`)
            seenHashes.add(infoHash);
            return true; // Keep the entry
        }
        
        // Duplicate found; filter it out
        console.log(`Torrent is duplicate: ${infoHash}`)
        return false;
    });
}

function extractInfoHash(magnetLink) {
    magnetLink = Array.isArray(magnetLink) 
                    ? magnetLink[0].replace(/&amp;/g, '&').trim()
                    : magnetLink.replace(/&amp;/g, '&').trim();

    const hashMatch = magnetLink.match(/xt=urn:btih:([a-fA-F0-9]{40}|[A-Z0-9]{32})/);

    if (!hashMatch) {
        console.warn(`Could not extract info hash from magnet link: ${magnetLink}`);
        return '';
    }

    const infoHash = hashMatch[1].toLowerCase()
    return infoHash
                
}

function extractYears(text) {
    // match() returns an array of all matched substrings or null if none found
    const regex = /\b(19[0-9]{2}|20[0-9]{2})\b/g;
    const matches = text.match(regex);
    return matches || [];
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


function cleanLeadingZeroes(str) {
    return str.replace(/(?<=\s|^|-)0+(?=\d+)/g, '');
}

function addSpacesAroundHyphens(str) {
    return str.replace(/(\b[+-]?\d+(?:\.\d+)?\b)([-–—])(\b[+-]?\d+(?:\.\d+)?\b)/g, '$1 $2 $3');

}

function isPureNumber(str) {
    // Remove leading/trailing whitespace, then check if the entire string is digits.
    return /^\d+$/.test(str.trim());
}

export {
    crawler_dispatch,
    cleanLeadingZeroes,
    extractInfoHash,
}
