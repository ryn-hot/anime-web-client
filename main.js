//https://api.ani.zip/mappings?anilist_id=' + media.id storing future api call

import { seadex_finder, parse_title_reserve, find_best_match, animeToshoEpisodeFilter, animeToshoBatchFilter, fetchWithRetry, hasDualAudioOrEnglishDub, modified_anitomy, normalizeTitle } from "./anime-finder-funcs.js";
import { nyaa_query_creator, nyaa_fallback_queries, gogoanime_query_creator } from "./query-creator.js";
import { nyaa_function_dispatch } from "./query-dispatcher.js";
import { findMagnetForEpisode, storeTorrentMetadata, getTorrentMetadata, findAllTorrentsForEpisode, cacheTorrentRange, isInfoHashInCache, wipeInfoHashFromCache, addToBlackList, isInfoHashInBlackList } from "./cache.js";
import { getGlobalClient, getGlobalClientTest } from "./webtorrent-client.js";
import levenshtein from 'fast-levenshtein';
import { torrentEmitter } from "./torrentEmitter.js";


// last thing to add is an anilist call for year abstraction    

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

// await testSeasonFlattener();

async function testSeasonFlattener() {
    const raw_torrent = {
        infoHash: '62a52fd3a549e478d866e9cb1a6fcc5f8766238f'
    }

    const magnetURI = 'magnet:?xt=urn:btih:MKSS7U5FJHSHRWDG5HFRU36ML6DWMI4P&tr=http%3A%2F%2Fnyaa.tracker.wf%3A7777%2Fannounce&tr=udp%3A%2F%2Fopen.stealth.si%3A80%2Fannounce&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=udp%3A%2F%2Fexodus.desync.com%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.torrent.eu.org%3A451%2Fannounce&dn=%5BShadoWalkeR%5D%20The%20Prince%20of%20Tennis%20%281-178%29%20%5B1080p%20HEVC%20x265%2010bit%5D%5BAAC%5D%5BSoft%20Eng%20Subs%5D';

    const episode_number = 1;

    const seeders = 14;

    const audio_type = 'sub'

    const alID = 22;

    const anidbId = 56;

    const db = null;

    const format = 'TV';

    const eng_title = 'The Prince of Tennis';

    const rom_title = 'Tennis no Ouji-sama';

    await fetchTorrentMetadata(magnetURI, episode_number, seeders, audio_type, alID, anidbId, db, format, eng_title, rom_title, raw_torrent) 

}


async function crawler_dispatch(db, english_title, romanji_title, audio, alID, anidbId, episode_number, format, mode, altAnimeTitles, proxy = null) {
    // console.log(altAnimeTitles)
    if (mode === 'build' && episode_number > 1) {
        // Database look back goes here. returns true for any source being present need to change to just torrents!
        const hasEpisode1 = db.hasTypeEpisodeSource(alID, 1, audio, 'torrent');
        console.log('Has Episode 1 Check: ', hasEpisode1)
        if (!hasEpisode1) {
          console.log(`No torrent for Episode 1 with audio ${audio}. Skipping...`);
          return; // Avoid further crawling
        }

        if (episode_number > 1) {
            const hasPreviousEpisode = db.hasTypeEpisodeSource(alID, episode_number - 1, audio, 'torrent');
            if (!hasPreviousEpisode) {
                console.log(`No Previous Episode`);
                return;
            }
        }
        
    }

    // const yearsFound = extractYears(english_title); 

    // const cached = findMagnetForEpisode(alID, episode_number, audio);
    const cached = findAllTorrentsForEpisode(alID, episode_number, audio);
    /* const cacheResults = bestCachedTorrent(cached);
    const bestTorrent = cacheResults.torrent;
    const fileData = cacheResults.fileData; */

    // console.log(`bestTorrentCached: ${bestTorrent}, fileData: ${fileData}`);
    // console.log(`Cached Candidates for ${english_title} Episode: ${episode_number} Audio: ${audio}`);
    // console.log(cached)
    // console.log('----------------------------------------------------------------------\n');


    if (cached && mode !== 'fetch') {
        // console.log('Crawler Dispatch Cache Branch');
        await processCachedTorrents(cached, episode_number, audio, alID, anidbId, db, format, english_title, romanji_title);

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

        console.log('sea dex length: ', sea_dex_query_results.length);

        if (sea_dex_query_results.length >= 0 && mode === 'fetch') {
            const results = dedupeMagnetLinks(sea_dex_query_results);

            const sorted_res = sortTorrentList(results);

            const eventKey = `torrentFound-${alID}-${episode_number}-${audio}`;
            torrentEmitter.emit(eventKey, sorted_res);
            console.log(`seadex event emmitted`)
        }


        trs_results.push(...sea_dex_query_results)
        
        if (format !== 'MOVIE' && anidbEid) {
            const toshoEpisodeResults = await animeToshoEpisodeFilter(anidbEid, audio); 
            console.log('toshoEpisodeResults Length: ', toshoEpisodeResults.length);
            trs_results.push(...toshoEpisodeResults);
        }
        
        if (epCount) {
            const toshoBatchResults = await animeToshoBatchFilter(anidbId, epCount, episode_number, audio);
            console.log('toshoBatchResults Length: ', toshoBatchResults.length);
            trs_results.push(...toshoBatchResults);
        }
        
        // consol   e.log('sea_dex returned');
        console.log('tosho length: ', trs_results.length);

        if (trs_results.length >= 0 && mode === 'fetch') {
            const results = dedupeMagnetLinks(trs_results);

            const healthy_res = blacklistFilter(results);

            const sorted_res = sortTorrentList(healthy_res);

            const eventKey = `torrentFound-${alID}-${episode_number}-${audio}`;
            torrentEmitter.emit(eventKey, sorted_res);
            console.log(`tosho event emmitted`)

        }

        
        console.log('Nyaa Finders Called');
        console.log(altAnimeTitles);
        const nyaa_queries = nyaa_query_creator(english_title, romanji_title, season_number, episode_number, audio, alID);
        const nyaa_results = await nyaa_function_dispatch(nyaa_queries, true, false);
        const nyaa_results_filtered = nyaa_results.filter(trs => filterAltTitles(alID, trs, english_title, romanji_title, altAnimeTitles));
        // console.log('Nyaa Results'); 
        // console.log(nyaa_results);
        // console.log('\n');
        trs_results.push(...nyaa_results_filtered);

        if (nyaa_results.length < 3) {
            const nyaa_fallback_q = nyaa_fallback_queries(english_title, romanji_title, episode_number, audio, alID);
            const nyaa_fallback_results = await nyaa_function_dispatch(nyaa_fallback_q, false, true);
            const nyaa_fallback_results_filtered = nyaa_fallback_results.filter(trs => filterAltTitles(alID, trs, english_title, romanji_title, altAnimeTitles));
            // console.log('Nyaa Fall Back Results'); 
            // console.log(nyaa_fallback_results);
            // console.log('\n');
            trs_results.push(...nyaa_fallback_results_filtered);
        }
        

        if (trs_results.length >= 0 && mode === 'fetch') {
            const results = dedupeMagnetLinks(trs_results);

            const healthy_res = blacklistFilter(results);

            const sorted_res = sortTorrentList(healthy_res);

            const eventKey = `torrentFound-${alID}-${episode_number}-${audio}`;
            torrentEmitter.emit(eventKey, sorted_res);
            console.log(`nyaa event emmitted`)

        }

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
            if (mode !== 'fetch') {
                const trs_results_deduped = dedupeMagnetLinks(trs_results);

                const trs_healthy = blacklistFilter(trs_results_deduped);
                // console.log(`trs_results deduped: `, trs_results);
                const trs_results_sorted = sortTorrentList(trs_healthy);
                // console.log(`trs_results sorted: `, trs_results_sorted);
                // console.log('Trs Results: ', trs_results_deduped.length);
                // sconsole.log(trs_results_deduped);
            
                // const trs_final = []; 
                await processTorrents(trs_results_sorted, episode_number, audio, alID, anidbId, db, format, english_title, romanji_title);
            }
        }
    } 
}

async function processCachedTorrents(cached, episode_number, audio, alID, anidbId, db, format, english_title, romanji_title) {

    const cachePromises = cached.map(candidate => {

        const magnetLink = Array.isArray(candidate.magnetLink) 
                ? candidate.magnetLink[0].replace(/&amp;/g, '&')
                : candidate.magnetLink.replace(/&amp;/g, '&');
        
        const seeders = candidate.seeders; 
            
        const fileData = getTorrentMetadata(candidate.infoHash);

        if (fileData) {
            // console.log(`cache hit for torrent metadata`)
            //console.log(`fileData: ` + `\n`, fileData);
            return writeTorrentMetadataFromCache(
                fileData, 
                magnetLink,
                episode_number, 
                seeders, 
                audio, 
                alID, 
                anidbId, 
                db, 
                english_title, 
                romanji_title
            ).catch(error => {
                console.error(`Error processing torrent: ${error.message}, magnetLink: ${raw_torrent.infoHash}\n`);
                return null;
            });

        } else {
            console.log('No file data for torrent')
            return fetchTorrentMetadata(
                candidate.magnetLink, 
                episode_number, 
                candidate.seeders, 
                audio, 
                alID, 
                anidbId, 
                db, 
                format, 
                english_title, 
                romanji_title, 
                candidate
            ).catch(error => {
                console.error(`Error processing torrent: ${error.message}, magnetLink: ${raw_torrent.infoHash}\n`);
                return null;
            });
        }

    })

    try {
        const results = await Promise.all(cachePromises);
        console.log('All results returned\n');
        return results.filter(result => result !== null);

    } catch(error) {
        console.error('Error processing torrents batch:', error);
        throw error;

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
        // console.log(`magnetLink of torrent being dispatched: ${magnetLink}`);
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
            romanji_title,
            raw_torrent
        ).catch(error => {
            // Handle individual torrent errors without failing the entire batch
            console.error(`Error processing torrent: ${error.message}, magnetLink: ${magnetLink}\n`);
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
        const season_tracker = [];

        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            // console.log(`Checking file: ${file.name}`);

            if (file.name.toLowerCase().endsWith('.mkv') || file.name.toLowerCase().endsWith('.avi') || file.name.toLowerCase().endsWith('.mp4')) {
                let file_name = addSpacesAroundHyphens(file.name);
                file_name = cleanLeadingZeroes(file_name)
                let file_title_data = await parse_title_reserve(file_name);

                const episodeNum = parseInt(file_title_data.episode_number);
                const seasonNum = parseInt(file_title_data.anime_season);

                season_tracker.push({seasonNum: seasonNum, episodeNum: episodeNum});
                season_tracker.filter(n => !Number.isNaN(n.seasonNum) && !Number.isNaN(n.episodeNum));
            }
        }


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

                const episodeNum = parseInt(file_title_data.episode_number);
                const seasonNum = parseInt(file_title_data.anime_season);

                file_title_data.episode_number = await seasonFlattener(season_tracker, seasonNum, episodeNum);

                season_tracker.push({seasonNum: seasonNum, episodeNum: episodeNum});
                season_tracker.filter(n => !Number.isNaN(n.seasonNum) && !Number.isNaN(n.episodeNum));

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
            console.log('\n')
        } else {
            console.log(`No MKV file matching episode ${episode_number} was found in this torrent.`);
            console.log('\n')

        }
    }
}

//cache file meta data. 
async function fetchTorrentMetadata(magnetURI, episode_number, seeders, audio_type, alID, anidbId, db, format, eng_title, rom_title, raw_torrent) {
    return new Promise((resolve, reject) => {
        const client = getGlobalClient();

        const torrent = client.add(magnetURI)
        

        const metadataTimeout = setTimeout(async () => {
            console.log(`Metadata event did not fire within 60 seconds for ${magnetURI}, destroying torrent...`);
            torrent.destroy();
            // await destroyTorrentSafely(torrent);
            console.log('Resolved fetchTorrentMetadata');
            console.log('\n')
            wipeInfoHashFromCache(alID, raw_torrent.infoHash);
            addToBlackList(raw_torrent.infoHash);

            resolve(null);
        }, 30000);
    

        torrent.on('metadata', async () => {
            console.log('Metadata event fired!')

            try {
                clearTimeout(metadataTimeout);

                console.log(`torrent name: ${torrent.name}`);
                console.log('Magnet Link: ', magnetURI);
                console.log('InfoHash: ', raw_torrent.infoHash);
                console.log(`Entry Format: `, format);

                let fileInfo = null;

                if (format !== 'MOVIE') {


                    let desiredFileFound = false;
                    let desiredFileIndex = null;
                    let desiredFileName = null;
                    const potential_files = [];
                    const episode_set = new Set();
                    const season_tracker = [];
            

                    for (let i = 0; i < torrent.files.length; i++) {
                        const file = torrent.files[i];
                        
                        if (file.name.toLowerCase().endsWith('.mkv') || file.name.toLowerCase().endsWith('.avi') || file.name.toLowerCase().endsWith('.mp4')) {
                            let file_name = addSpacesAroundHyphens(file.name);
                            file_name = cleanLeadingZeroes(file_name);
                            // console.log('file name: ', file_name);
                            let file_title_data = await parse_title_reserve(file_name);
                            // console.log('file title data:');
                            // console.log(file_title_data);

                            if (file_title_data.episode_number !== undefined) {
                                const episodeNum = parseInt(file_title_data.episode_number);
                                const seasonNum = parseInt(file_title_data.anime_season);
                    
                                season_tracker.push({seasonNum: seasonNum, episodeNum: episodeNum});
                                season_tracker.filter(n => !Number.isNaN(n.seasonNum) && !Number.isNaN(n.episodeNum));

                                
                            } 
                        }
                    }


                    for (let i = 0; i < torrent.files.length; i++) {
                        const file = torrent.files[i];
                        
                        if (file.name.toLowerCase().endsWith('.mkv') || file.name.toLowerCase().endsWith('.avi') || file.name.toLowerCase().endsWith('.mp4')) {
                            let file_name = addSpacesAroundHyphens(file.name);
                            file_name = cleanLeadingZeroes(file_name);
                            // console.log('file name: ', file_name);
                            let file_title_data = await parse_title_reserve(file_name);
                            // console.log('file title data:');
                            // console.log(file_title_data);

                            if (file_title_data.episode_number !== undefined) {
                                const episodeNum = parseInt(file_title_data.episode_number);
                                const seasonNum = parseInt(file_title_data.anime_season);

                                const absEpisodeNum = await seasonFlattener(season_tracker, seasonNum, episodeNum);

                                file_title_data.episode_number = absEpisodeNum;
                                
                                episode_set.add(absEpisodeNum);
                            } else {
                                if (isPureNumber(file_title_data.file_name)) {
                                    file_title_data.episode_number = parseInt(file_title_data.file_name);
                                    episode_set.add(parseInt(file_title_data.episode_number))
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

                        if(!isInfoHashInCache(raw_torrent.infoHash, alID, audio_type)) {
                            const sortedRange = [...episode_set]
                                .filter(n => n !== undefined && !Number.isNaN(n))
                                .sort((a, b) => a - b);

                            if (sortedRange.length > 1) {
                                // console.log(`Caching From FetchTorrentMetadata: anilistId=${alID}, episodes [${sortedRange[0]}..${sortedRange[sortedRange.length - 1]}], audio: ${audio_type}, title: ${torrent.name}`);
                                cacheTorrentRange(alID, sortedRange[0], sortedRange[sortedRange.length - 1], audio_type, magnetURI, seeders, raw_torrent.infoHash);
                                if (hasDualAudioOrEnglishDub(torrent.name) && audio_type !== 'dub') {
                                    cacheTorrentRange(alID, sortedRange[0], sortedRange[sortedRange.length - 1], 'dub', magnetURI, seeders, raw_torrent.infoHash);
                                }
                            }
                        } else {
                            console.log('Is InfoHash In Cache: ', isInfoHashInCache(raw_torrent.infoHash, alID));
                        }

                    
                        storeTorrentMetadata(raw_torrent.infoHash, fileList);
                        
                        
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
                        console.log('\n');

                    } else {
                        console.log(`No file matching episode ${episode_number} was found in this torrent.\n`);
                        console.log('\n');
                    
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
                            console.log('\n');
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
                console.log('Resolved fetchTorrentMetadata \n');
                resolve(fileInfo);
            } catch (err) {
                torrent.destroy()
                // await destroyTorrentSafely(torrent);
                console.error('Error in metadata handler:', err);
                console.log('Resolved fetchTorrentMetadata \n');
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
            // console.log(`Torrent is Unique Adding: ${infoHash}`)
            seenHashes.add(infoHash);
            return true; // Keep the entry
        }
        
        // Duplicate found; filter it out
        // console.log(`Torrent is duplicate: ${infoHash}`)
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

    let infoHash = hashMatch[1].toLowerCase()

    //convert infoHash to hexadecimal, if already hexadecimal no change occurs
    infoHash = convertToHex(infoHash);

    return infoHash
                
}

function extractYears(text) {
    // match() returns an array of all matched substrings or null if none found
    const regex = /\b(19[0-9]{2}|20[0-9]{2})\b/g;
    const matches = text.match(regex);
    return matches || [];
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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function convertToHex(str) {
    // Trim any extraneous whitespace
    str = str.trim();
  
    // Check if the string is already a valid hexadecimal string.
    // For torrent info hashes in hex, we expect 40 hex digits.
    if (str.length === 40 && /^[0-9a-fA-F]+$/.test(str)) {
      return str.toLowerCase();
    }
    
    // If the string is 32 characters and contains any characters outside the hex range,
    // it is most likely a Base32 representation.
    if (str.length === 32 && /[^0-9a-fA-F]/.test(str)) {
      return base32ToHex(str).toLowerCase();
    }
    
    // As a fallback, if the string only contains valid Base32 characters (A-Z and 2-7),
    // assume it is Base32.
    if (/^[A-Z2-7]+$/i.test(str)) {
      return base32ToHex(str).toLowerCase();
    }
    
    // If the input appears to be a hex string but with unexpected length,
    // you might decide to return it unchanged or throw an error.
    if (/^[0-9a-fA-F]+$/.test(str)) {
      return str.toLowerCase();
    }
    
    throw new Error("Input does not appear to be a valid hexadecimal or Base32 string.");
}


function base32ToHex(base32) {
    // Normalize to uppercase and remove any padding characters.
    base32 = base32.toUpperCase().replace(/=+$/, '');
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "";
    
    // Convert each Base32 character to its 5-bit binary representation.
    for (let i = 0; i < base32.length; i++) {
      const val = alphabet.indexOf(base32[i]);
      if (val === -1) {
        throw new Error("Invalid base32 character: " + base32[i]);
      }
      bits += val.toString(2).padStart(5, '0');
    }
    
    // Convert the binary string to hexadecimal (4 bits per hex digit).
    let hex = "";
    for (let i = 0; i < bits.length; i += 4) {
      // If the last chunk is less than 4 bits, ignore it (shouldn't happen for a full torrent info hash)
      const chunk = bits.substring(i, i + 4);
      if (chunk.length < 4) break;
      hex += parseInt(chunk, 2).toString(16);
    }
    
    return hex;
}

function blacklistFilter(entries) {
    return entries.filter(entry => !isInfoHashInBlackList(entry.infoHash))
}

async function seasonFlattener(list, seasonNum, episodeNum) {
    // console.log('Season List: ')
    // console.log(list);
    // console.log(`Relative Season: ${seasonNum}, Relative Episode ${episodeNum}`);

    /* if (seasonNum === 5 && episodeNum === 10) {
        console.log(`---------------Relative Season: ${seasonNum}, Relative Episode ${episodeNum}---------------------`)
    } */

    if (Number.isNaN(seasonNum) || seasonNum === undefined || seasonNum === null || seasonNum == false) {
        // console.log(`SeasonNum is NaN or falsy returning episode number: `, episodeNum);
        // console.log('\n\n');
        return episodeNum
    } else if (seasonNum === 1) {
        // console.log(`Season Num is 1 returing episode number: `, episodeNum)
        // console.log('\n\n');
        return episodeNum
    } else if (list.length === 0){
        // console.log(`Season list is empty returing episode number: `, episodeNum)
        // console.log('\n\n');
        return episodeNum
    } else {
        // console.log(`Season flattener finding absolute episode number for given season number: ${seasonNum} episode number: ${episodeNum}`);

        // const minSeason = Math.min(...list.map(pair => pair.seasonNum));

        const seasonMap = {};

        for (const pair of list) {
            // If the season is not yet in the map or this pair's episode is greater than what we have, update it.
            if (!seasonMap[pair.seasonNum] || pair.episodeNum > seasonMap[pair.seasonNum].episodeNum) {
              seasonMap[pair.seasonNum] = pair;
            }
        }

        const seasonData = Object.values(seasonMap);

        const sortedSeasons = seasonData.slice().sort((a, b) => a.seasonNum - b.seasonNum);

        let cumulativeEpisodes = 0;
        for (const season of sortedSeasons) {
            if (season.seasonNum < seasonNum) {
                // console.log(`Adding season.seasonNum: ${season.seasonNum} with season.episodeNum: ${season.episodeNum} to cumlativeEpisodes: ${cumulativeEpisodes}`);
                cumulativeEpisodes += season.episodeNum;
            }
        }

        // console.log('Cumulative Sum:', cumulativeEpisodes);
        // console.log('Episode Number: ', episodeNum);

        // console.log('Absolute Episode Number Found: ', cumulativeEpisodes + episodeNum)
        //console.log('\n\n');
        return cumulativeEpisodes + episodeNum;

    }
}


function cleanTorrentTitle(title) {
    let cleaned = title.toLowerCase();
    cleaned = cleaned.replace(/\[[^\]]*\]/g, '');
    cleaned = cleaned.replace(/\bS\d+E\d+\b/gi, '');

    cleaned = cleaned.replace(/\(([^)]*)\)/g, (match, inner) => {
        if (/^[\d\s]+$/.test(inner)) {
            return match; // Keep the parentheses as they are.
        } else {
            return ''; // Remove the parentheses and everything inside them.
        }
    });


    cleaned = cleaned.replace(/[^\w\s()]/g, '').trim();
    return cleaned;
}


function filterAltTitles(alID, trs, engTargetTitle, romTargetTitle, altAnimeTitles) {
   
    let cleaned = cleanTorrentTitle(trs.title);
    cleaned = normalizeTitle(cleaned);

    // console.log(`trs: ${cleaned}, endTargetTitle: ${normalizeTitle(engTargetTitle)}, romTargetTitle: ${normalizeTitle(romTargetTitle)}`)

    const engTargetLevDist = levenshtein.get(cleaned, normalizeTitle(engTargetTitle));
    const romTargetDist = levenshtein.get(cleaned, normalizeTitle(romTargetTitle));

    const targetMinDist = Math.min(engTargetLevDist, romTargetDist);
    // console.log('targetMinDist: ', targetMinDist);

    for (const altTitle of altAnimeTitles) {
        // console.log(`altTitle: ${normalizeTitle(altTitle)}`);

        const altDist = levenshtein.get(cleaned, normalizeTitle(altTitle));
        // console.log('altDist: ', altDist);

        if (altDist < targetMinDist) {
            // console.log('altDis less than targetMinDist');

            wipeInfoHashFromCache(alID, trs.infoHash);
            return false
        }
    }

    return true
}

export {
    crawler_dispatch,
    cleanLeadingZeroes,
    extractInfoHash,
    addSpacesAroundHyphens,
    fetchTorrentMetadata,
    seasonFlattener
}
