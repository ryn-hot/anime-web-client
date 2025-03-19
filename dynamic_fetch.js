import { crawler_dispatch, addSpacesAroundHyphens, cleanLeadingZeroes, seasonFlattener } from "./crawler_dispatch.js";
import { AnimeDatabase } from "./passive_index.js";
import { torrentEmitter } from './torrentEmitter.js';
import { getGlobalClient } from "./webtorrent-client.js";
import { cacheTorrentRange, storeTorrentMetadata, isInfoHashInCache } from "./cache.js";
import fetch from 'node-fetch';
import { parse_title_reserve } from "./anime-finder-funcs.js";
import path from "path"; 



//test function
// await dynamic_manager();
async function dynamic_manager() {
    const results = await dynamicFinder(151807, 2, 'sub'); 
    console.log('results: ', results);
}



//this function is untested I have no idea if it will work. So if you see a problem or need to change something for the integration to work do it
export async function streamTorrent(req, res, alID, episodeNum, audio) {
    try {
        const result = await dynamicFinder(alID, episodeNum, audio);
        if (!result) {
            return res.status(404).send("No torrents found for the requested episode");
        }

        const videoFileFormat = extractFileSuffix(result.fileName);
        const client = getGlobalClient();

        client.add(result.magnetLink, { sequential: true }, torrent => {
            console.log(`Torrent ${torrent.infoHash} added for streaming.`);
            
            // Get the specific file using fileIndex
            const file = torrent.files[result.fileIndex];
            if (!file) {
                res.status(404).send("File not found in torrent");
                return;
            }
            
            // Set appropriate headers for streaming
            res.writeHead(200, {
                "Content-Type": `video/${videoFileFormat}`,
                "Content-Disposition": `inline; filename="${result.fileName}"`
            });
            
            // Create and pipe the read stream
            const stream = file.createReadStream();
            
            stream.on("error", err => {
                console.error("Stream error:", err);
                res.end();
            });
            
            stream.pipe(res);
            
            // Clean up when streaming finishes
            stream.on("end", () => {
                console.log("Streaming finished.");
                torrent.destroy();
            });
        });
    } catch (error) {
        console.error("Error streaming torrent:", error);
        res.status(500).send("Error streaming the requested episode");
    }
}


export async function dynamicFinder(alID, episodeNum, audio) { 
    const db = new AnimeDatabase('./anime.db');

    console.log(alID, episodeNum, audio);
    const mode = 'fetch'
    const source = db.getTorrentSource(alID, episodeNum, audio);

    if (source) {
        console.log('database hit');
        console.log('source: ', source);

        return source
    } else {
        let anime_info, altAnimeTitles;
        anime_info = db.getAnime(alID);
        if (anime_info) {
            altAnimeTitles = await getAltTitles(alID)
            
    
        } else {
            const fetched_info = await alIdAnimeFetch(alID, episodeNum);
            anime_info = fetched_info.animeInfo;
            db.insertAnime({
                anilistId: anime_info.anilist_id, 
                malId: anime_info.mal_id, 
                anidbId: anime_info.anidb_id, 
                englishTitle: anime_info.english_title, 
                romanjiTitle: anime_info.romanji_title, 
                episode_list: null, 
                format: anime_info.format
            });
            altAnimeTitles = fetched_info.animeAltTitles;
    
        }

        const eventKey = `torrentFound-${alID}-${episodeNum}-${audio}`;
        
        const crawlerAbortController = new AbortController();

        return new Promise((resolve, reject) => {
            let finished = false;
            const abortControllers = []; // Holds AbortControllers for each candidate
      
            // Function to abort all pending torrentResolve calls.
            function abortAll() {
              abortControllers.forEach((controller) => controller.abort());
              crawlerAbortController.abort();
            }
      
            const torrentEventHandler = (torrentData) => {
              // console.log("Event fired:");
              // console.log(torrentData);
      
              // Ensure torrentData is an array.
              const candidates = Array.isArray(torrentData) ? torrentData : [torrentData];
      
              // Map each candidate to a promise from torrentResolve with its own AbortController.
              const candidatePromises = candidates.map((candidate) => {
                const controller = new AbortController();
                abortControllers.push(controller);
                return torrentResolve(
                  candidate.magnetLink,
                  episodeNum,
                  candidate.seeders, // assuming candidate includes seeder count
                  audio,
                  alID,
                  anime_info.anidb_id,
                  db,
                  anime_info.format,
                  anime_info.english_title,
                  anime_info.romanji_title,
                  candidate,
                  controller.signal // pass the abort signal
                );
              });
      
              // Use Promise.any to resolve with the first successful candidate.
              Promise.any(candidatePromises)
                .then((result) => {
                  if (!finished) {
                    finished = true;
                    abortAll(); // Cancel all remaining candidate calls.
                    torrentEmitter.removeListener(eventKey, torrentEventHandler);
                    resolve(result);
                  }
                })
                .catch((err) => {
                  console.error("All candidates from this event failed:", err);
                });
            };
      
            torrentEmitter.on(eventKey, torrentEventHandler);
      
            // Set a timeout to avoid waiting forever.
            setTimeout(() => {
              if (!finished) {
                finished = true;
                abortAll();
                torrentEmitter.removeListener(eventKey, torrentEventHandler);
                reject(new Error("Timeout: No torrent candidate succeeded"));
              }
            }, 120000);
      
            // Start the crawler after the listener is active.
            crawler_dispatch(
              db,
              anime_info.english_title,
              anime_info.romanji_title,
              audio,
              alID,
              anime_info.anidb_id,
              episodeNum,
              anime_info.format,
              mode,
              altAnimeTitles,
              crawlerAbortController.signal
            );
        });
    }

}

async function alIdAnimeFetch(alID , episodeNum) {
    const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
            id
            idMal
            title {
                romaji
                english
            }
            status
            episodes
            format
            nextAiringEpisode {
                airingAt
                timeUntilAiring
                episode
            }
            relations {
                edges {
                    node {
                        type
                        title {
                            english
                            romaji
                        }
                    }
                    relationType
                }
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
    const anime = data.data.Media;
    
    const anilistId = anime.id;
    const myAnimeListId = anime.idMal; 
    const format = anime.format;

    let englishTitle = anime.title?.english || '';
    let romanjiTitle = anime.title?.romaji || '';
    const episodesResponse = anime.episodes || anime.nextAiringEpisode.episode || 0;   // AniList-supplied total
    const animestatus = anime.status;

    const animeAlternatives = anime.relations.edges.filter(edge => edge.node.type === "ANIME" && edge.relationType === "ALTERNATIVE");
    let animeAltTitles = [];

    for (const edge of animeAlternatives) {
        const eng_title = edge.node.title.english
        const rom_title = edge.node.title.romaji

        animeAltTitles.push(eng_title);
        animeAltTitles.push(rom_title); 
    }

    // console.log('animeAltTitle: ', animeAltTitles);
    animeAltTitles = animeAltTitles.filter(title => title !== null );

    // console.log('anime.episodes: ', anime.episodes);
    // console.log('anime airing episode: ', anime.nextAiringEpisode?.episode);
    // console.log('episodesResponse', episodesResponse);

    if (englishTitle === '' && romanjiTitle !== '') {
        englishTitle = romanjiTitle;
    }
    if (romanjiTitle === '' && englishTitle !== '') {
        romanjiTitle = englishTitle;
    }



    const mappingsResponse = await fetch('https://api.ani.zip/mappings?anilist_id=' + anilistId);
    const mappingsjson = await mappingsResponse.json();

   

    const anidbId = mappingsjson?.mappings?.anidb_id || -1;
    console.log('anidbId: ', anidbId);


    const anime_info = {anilist_id: anilistId, mal_id: myAnimeListId, anidb_id: anidbId, english_title: englishTitle, romanji_title: romanjiTitle, episode_number: episodeNum, format: format};
    return {animeInfo: anime_info,  animeAltTitles: animeAltTitles}

}


async function getAltTitles(alID) {
    const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
            id
            idMal
            title {
                romaji
                english
            }
            status
            episodes
            format
            nextAiringEpisode {
                airingAt
                timeUntilAiring
                episode
            }
            relations {
                edges {
                    node {
                        type
                        title {
                            english
                            romaji
                        }
                    }
                    relationType
                }
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
    const anime = data.data.Media;

    const animeAlternatives = anime.relations.edges.filter(edge => edge.node.type === "ANIME" && edge.relationType === "ALTERNATIVE");
    let animeAltTitles = [];

    for (const edge of animeAlternatives) {
        const eng_title = edge.node.title.english
        const rom_title = edge.node.title.romaji

        animeAltTitles.push(eng_title);
        animeAltTitles.push(rom_title); 
    }

    // console.log('animeAltTitle: ', animeAltTitles);
    animeAltTitles = animeAltTitles.filter(title => title !== null );

    return animeAltTitles


}


async function torrentResolve(magnetURI, episode_number, seeders, audio_type, alID, anidbId, db, format, eng_title, rom_title, raw_torrent, abortSignal) {
    return new Promise((resolve, reject) => {

        if (abortSignal && abortSignal.aborted) {
            return reject(new Error("Aborted before starting"));
        }

        const client = getGlobalClient();
        const torrent = client.add(magnetURI)


        const onAbort = () => {
            console.log("Aborting torrentResolve for", magnetURI);
            torrent.destroy();
            reject(new Error("Aborted"));
          };
      
          if (abortSignal) {
            abortSignal.addEventListener("abort", onAbort);
        }

        torrent.on('metadata', async () => {
            console.log('Metadata event fired!')

            try {
                // clearTimeout(metadataTimeout);

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
                                console.log(`Caching From FetchTorrentMetadata: anilistId=${alID}, episodes [${sortedRange[0]}..${sortedRange[sortedRange.length - 1]}], audio: ${audio_type}, title: ${torrent.name}`);
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
                            info_hash: raw_torrent.infoHash,
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
                        info_hash: raw_torrent.infoHash,
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

function extractFileSuffix(filename) {
    // Get the extension including the period (e.g., '.mp4')
    const extension = path.extname(filename);
    
    // Remove the leading period to get just the suffix
    return extension.slice(1);
}
  