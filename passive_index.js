import Database from "better-sqlite3";
import fs from 'fs/promises';
import { enqueue, dequeue, size } from './tasks-queue.js';
import { nextProxy, reportFailure} from './proxy-manager.js';
import { crawler_dispatch } from "./crawler_dispatch.js";
import { checkMALDubs, animescheduleDubCheck } from "./dubcheck.js";
import fetch from 'node-fetch';

class AnimeDatabase {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.db = null;
    }

    connect() {
        if (!this.db) {
            this.db = new Database(this.dbPath);
        }
        return this.db;
    }

    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    async initializeFromSchema(schemaPath) {
        try {
            // Read the schema file
            const schema = await fs.readFile(schemaPath, 'utf-8');
            
            // Connect and execute schema
            this.connect();
            this.db.exec(schema);
            
            return true;
        } catch (error) {
            console.error('Error initializing database:', error);
            throw error;
        }
    }

    checkMultipleAnimeExists(anilistIds) {
        try {
            const placeholders = anilistIds.map(() => '?').join(',');
            const query = `
                SELECT anilist_id, mal_id, anidb_id, english_title, romanji_title
                FROM anime 
                WHERE anilist_id IN (${placeholders})
            `;
            
            // Now returns all columns for matching rows
            const rows = this.db.prepare(query).all(anilistIds);
            
            // Create a Map of ID to full anime data instead of just a Set
            return new Map(rows.map(row => [row.anilist_id, row]));
        } catch (error) {
            console.error('Error checking multiple anime:', error);
            throw error;
        }
    }

    getEpisodeStatsForAnimeIDs(anilistIds) {
        // connect to ensure db is available
        this.connect();
    
        // Build placeholders
        const placeholders = anilistIds.map(() => '?').join(',');
        // Example SQL: SELECT anilist_id, COUNT(*) as localCount, MAX(episode_number) as maxEpisode
        //              FROM episodes
        //              WHERE anilist_id IN (?,?,...,?)
        //              GROUP BY anilist_id
        const sql = `
          SELECT anilist_id,
                 COUNT(*) AS localCount,
                 MAX(episode_number) AS maxEpisode
          FROM episodes
          WHERE anilist_id IN (${placeholders})
          GROUP BY anilist_id
        `;
    
        const rows = this.db.prepare(sql).all(anilistIds);
    
        // Convert to a Map for easy lookup
        const statsMap = new Map();
        for (const row of rows) {
          statsMap.set(row.anilist_id, {
            localCount: row.localCount,
            maxEpisode: row.maxEpisode
          });
        }
        return statsMap;
    }
    
    insertAnime({ anilistId, malId, anidbId, englishTitle, romanjiTitle, episodeNumber, format }) {
        try {

            const episodeList = episodeNumber !== undefined && episodeNumber !== null 
            ? JSON.stringify([episodeNumber])
            : JSON.stringify([]);

            const stmt = this.db.prepare(`
                INSERT INTO anime (
                    anilist_id,
                    mal_id,
                    anidb_id,
                    english_title,
                    romanji_title,
                    episode_number,
                    format
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
    
            const result = stmt.run(
                anilistId,
                malId || null,
                anidbId || null,
                englishTitle || null,
                romanjiTitle || null,
                episodeList || null,
                format || null
            );
    
            return result;
        } catch (error) {
            console.error('Error inserting anime:', error);
            throw error;
        }
    }
    

    storeEpisodeAndSource({
        anilistId,
        anidbId = null,
        episodeNumber,
        episodeTitle = null,
        audioType,      // 'sub', 'dub', or 'dual'
        category,       // 'torrent', 'http', or 'nzb'
        magnetLink = null,
        infoHash = null,
        fileIndex = null,
        fileName = null,
        seeders = null,
        videoUrl = null,
        nzbData = null
      }) {
        this.connect(); // Ensure DB is connected
      
        const insertOrIgnoreEpisode = `
          INSERT OR IGNORE INTO episodes (anilist_id, anidb_id, episode_number, episode_title)
          VALUES (@anilistId, @anidbId, @episodeNumber, @episodeTitle)
        `;
      
        const updateAnimeEpisodeList = `
            UPDATE anime
            SET episode_list = CASE
            WHEN episode_list IS NULL THEN json('[' || ? || ']')
            ELSE json_insert(episode_list, '$[' || json_array_length(episode_list) || ']', ?)
            END
            WHERE anilist_id = ?
        `;
      
        const insertSource = `
          INSERT OR IGNORE INTO sources (
            anilist_id,
            anidb_id,
            episode_number,
            audio_type,
            category,
            magnet_link,
            info_hash,
            file_index,
            file_name,
            seeders,
            video_url,
            nzb_data
          ) VALUES (
            @anilistId,
            @anidbId,
            @episodeNumber,
            @audioType,
            @category,
            @magnetLink,
            @infoHash,
            @fileIndex,
            @fileName,
            @seeders,
            @videoUrl,
            @nzbData
          )
        `;
      
        // Start a single transaction that:
        // 1. Tries to insert the episode row (IGNORE if already exists)
        // 2. If a new row was inserted, increment the anime.episode_number
        // 3. Inserts the source row (since multiple sources can exist)
        const tx = this.db.transaction(() => {
          // 1) Insert or ignore the episode row
          const episodeStmt = this.db.prepare(insertOrIgnoreEpisode);
          const result = episodeStmt.run({
            anilistId,
            anidbId,
            episodeNumber,
            episodeTitle
          });
      
          // result.changes == 1 if a new row was inserted
          if (result.changes === 1) {
            // 2) Since we inserted a new row for that (anilist_id, episode_number),
            //    increment the anime's episode_number
            const animeStmt = this.db.prepare(updateAnimeEpisodeList);
            animeStmt.run(episodeNumber, episodeNumber, anilistId );
          }
      
          // 3) Insert the source row unconditionally
          const sourceStmt = this.db.prepare(insertSource);
          sourceStmt.run({
            anilistId,
            anidbId,
            episodeNumber,
            audioType,
            category,
            magnetLink,
            infoHash,
            fileIndex,
            fileName,
            seeders,
            videoUrl,
            nzbData
          });
        });
      
        // Execute the transaction
        tx();
      
        return true;
    }
      

    async reset() {
        try {
            // Close existing connection if any
            this.close();
            
            // Delete the database file if it exists
            try {
                await fs.unlink(this.dbPath);
            } catch (error) {
                if (error.code !== 'ENOENT') { // Ignore if file doesn't exist
                    throw error;
                }
            }
            
            // Reconnect to create new database
            this.connect();
            
            return true;
        } catch (error) {
            console.error('Error resetting database:', error);
            throw error;
        }
    }

    checkAnimeExists(anilistId) {
        try {
            const row = this.db.prepare('SELECT EXISTS(SELECT 1 FROM anime WHERE anilist_id = ?) as exists_in_db')
                .get(anilistId);
            return row.exists_in_db === 1;
        } catch (error) {
            console.error('Error checking anime existence:', error);
            throw error;
        }
    }

    hasEpisodeSource(anilistId, episodeNumber, audioType) {
        // Ensure the raw DB connection is ready
        this.connect();
    
        // Prepare or reuse a statement
        // (In a real system, you might store this in a property to avoid re-preparing each time.)
        const stmt = this.db.prepare(`
          SELECT 1
          FROM sources
          WHERE anilist_id = ?
            AND episode_number = ?
            AND audio_type = ?
          LIMIT 1
        `);
            
 

        // Execute synchronously
        const row = stmt.get(anilistId, episodeNumber, audioType);
    
        return row; 
    }

    hasTypeEpisodeSource(anilistId, episodeNumber, audioType, category) {
        // Ensure the raw DB connection is ready
        this.connect();
    
        // Prepare or reuse a statement
        // (In a real system, you might store this in a property to avoid re-preparing each time.)
        const stmt = this.db.prepare(`
          SELECT 1
          FROM sources
          WHERE anilist_id = ?
            AND episode_number = ?
            AND audio_type = ?
            AND category = ?
          LIMIT 1
        `);
    
        // Execute synchronously
        const row = stmt.get(anilistId, episodeNumber, audioType, category);
    
        return row; 
    }

    getTorrentSource(anilistId, episodeNumber, audioType) {
        try {
          this.connect();
          const stmt = this.db.prepare(`
            SELECT *
            FROM sources
            WHERE anilist_id = ?
              AND episode_number = ?
              AND audio_type = ?
              AND category = 'torrent'
            LIMIT 1
          `);
          const source = stmt.get(anilistId, episodeNumber, audioType);
          return source ? source : false;
        } catch (error) {
          console.error('Error fetching torrent source:', error);
          throw error;
        }
    }


    getAnime(anilistId) {
        try {
          this.connect();
          const stmt = this.db.prepare(`
            SELECT *
            FROM anime
            WHERE anilist_id = ?
          `);
          const animeRow = stmt.get(anilistId);
          return animeRow ? animeRow : false;
        } catch (error) {
          console.error('Error fetching anime:', error);
          throw error;
        }
    }

}

// const tasksQueue = [];

// await main()
async function main() {
    const db = new AnimeDatabase('./anime.db');
    
    try {
        // Reset database (optional)
        await db.reset();
        
        // Initialize with schema
        await db.initializeFromSchema('./node.sql');
        
        await passive_index_queuer(db);

        await passive_index_process({ mode: 'sequential' }, db); 

    } catch (error) {
        console.error('Database operation failed:', error);
    } finally {
        db.close();
    }
}

async function passive_index_queuer(db) {
    const query = `
    query ($page: Int, $perPage: Int) {
            Page(page: $page, perPage: $perPage) {
            pageInfo {
                currentPage
                hasNextPage
            }
            media {
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
    }
    `;

    let page = 1;
    let hasNextPage = true;
    const mode = 'build';

    while (hasNextPage) {
        const pageData = await fetchAnimeData(query, page);
        
        if (!pageData || !pageData.media) {
            console.log('No page data or media found. Stopping pagination.');
            break;
        }

        const pageIds = pageData.media.map(anime => anime.id);
        console.log(`Processing page ${page} with ${pageIds.length} anime...`);

        // FIX the Naruto JyZ Naruto Parsing. 
        // 2) For DB calls, find out which anime are new vs. existing
        const existingPageIds = db.checkMultipleAnimeExists(pageIds); 
        // This returns a Map of anilist_id -> row (or empty if not found)

        // 3) Also fetch local episode counts
        const episodeStats = db.getEpisodeStatsForAnimeIDs(pageIds);
        // Returns a Map: anilist_id -> { localCount, maxEpisode }

        // 4) For each anime in AniList response, decide what to do
        for (const anime of pageData.media) {
            const anilistId = anime.id;
            const myAnimeListId = anime.idMal; 
            const format = anime.format;
            console.log(`format in anilsit: `, format);
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


            const isDubbed = await checkMALDubs(myAnimeListId) || await animescheduleDubCheck(romanjiTitle);

            let anilistEpisodes; 
            
            if (animestatus == 'RELEASING') {
                console.log('releasing branch')
                if (episodesResponse == 0) {
                    //unlimited tag -1 means to use indefinite iteration to find the boundaries of episodes. 
                    anilistEpisodes = -1;
                } else if (anime.episodes > anime.nextAiringEpisode.episode && anime.nextAiringEpisode.episode) {
                    anilistEpisodes = anime.nextAiringEpisode.episode - 1;
                    console.log('Assigned airing next episode'); 
                } else  if (anime.episodes) {
                    anilistEpisodes = anime.episodes;
                } else {
                    anilistEpisodes = -1;
                }

            } else {

                if (anime.episodes) {
                    anilistEpisodes = anime.episodes;
                } else {
                    anilistEpisodes = -1; 
                }
                
            }

            
            // 4.1 If the anime does NOT exist in the local DB
            if (!existingPageIds.has(anilistId)) {
                // We queue a 'season-level' task
               
                const mappingsResponse = await fetch('https://api.ani.zip/mappings?anilist_id=' + anilistId);
                const mappingsjson = await mappingsResponse.json();

                if (anilistEpisodes === -1) {
                    console.log('Setting Episode Count via mappingsjson');
                    anilistEpisodes = mappingsjson?.episodeCount || -1;
                }

                const anidbId = mappingsjson?.mappings?.anidb_id || -1;
                console.log('anidbId: ', anidbId);
                console.log('anilistEpisodes', anilistEpisodes);

                enqueue({
                    type: 'anime',
                    anilistId,
                    myAnimeListId,
                    anidbId,
                    format,
                    englishTitle,
                    romanjiTitle,
                    episodeNumber: anilistEpisodes,
                    isDubbed: isDubbed,
                    mode: mode,
                    animeAltTitles: animeAltTitles,

                });

                console.log(`Queueing missing anime ID ${anilistId} for insertion.`);
                // We do NOT insert into DB yet, as per your instructions

            } else {
                // 4.2 The anime already exists

                // 4.3 Now check episodes
                const localCount = episodeStats.get(anilistId).localCount || 0;



                if (anilistEpisodes > localCount) {
                    // There's a difference in episode counts 
                    // We queue missing episodes individually
                    const anime = db.getAnime(anilistId);
                    let episodeList = [];
    
                    if (anime && anime.episode_list) {
                        episodeList = JSON.parse(anime.episode_list);
                    }
                    
                    const lastEpisode = episodeList[episodeList.length - 1];
                    let tempList = episodeList;
    
                    if (lastEpisode < anilistEpisodes) {
                        tempList.push(anilistEpisodes)
                    }
    
                    let missingEpisodes = findMissingIntegers(tempList);
                    missingEpisodes.push(lastEpisode);

                    for (const ep of missingEpisodes) {
                        enqueue({
                            type: 'episode',
                            anilistId,
                            myAnimeListId,
                            anidbId,
                            englishTitle,
                            romanjiTitle,
                            episodeNumber: ep,
                            audio: 'sub',
                            format: format,
                            mode: mode,
                            animeAltTitles: animeAltTitles,
                        });

                        if (isDubbed) {
                            enqueue({
                                type: 'episode',
                                anilistId,
                                myAnimeListId,
                                anidbId,
                                englishTitle,
                                romanjiTitle,
                                episodeNumber: epNum,
                                audio: 'dub',
                                format: format,
                                mode: mode,
                                animeAltTitles: animeAltTitles,
                            });
                        }
                       
                    }
                    console.log(`Queueing ${anilistEpisodes - localMaxEp} missing episodes for anime ${anilistId}`);
                }
            }
        } // end for loop of media

        // Move to next page
        hasNextPage = false // pageData.pageInfo.hasNextPage;
        page++;
    
        // Throttle requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

  // At this point, tasksQueue contains all season-level and episode-level tasks
  //return tasksQueue;
}



async function passive_index_process({ mode = 'sequential', concurrency = 1 }, db) {
    if (mode === 'sequential') {
        // Start a single worker that processes tasks one by one
        await processTasksSequentially(db, concurrency);
      } else if (mode === 'concurrent') {
        // Start a worker pool that can handle multiple tasks concurrently
        processTasksConcurrently(concurrency, db);
      }
}




async function processTasksSequentially(db, concurrency) {
    while (true) {
      const task = dequeue();
      if (!task) {
        // no tasks, wait a bit or break
        await sleep(500);
        continue;
      }
      await handleTask(task, db, concurrency);  // do one at a time
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function processTasksConcurrently(concurrency, db) {
    let activeCount = 0;
    
    async function next() {
      if (activeCount >= concurrency) return;
      const task = dequeue();
      if (!task) return;
      
      activeCount++;
      handleTask(task, db)
        .finally(() => {
          activeCount--;
          next();  // check if more tasks are waiting
        });
      // Trigger next again to possibly start more tasks right away
      next();
    }
    
    // Kick off concurrency workers
    for (let i = 0; i < concurrency; i++) {
      next();
    }
}
  
async function handleTask(task, db, concurrency) {
    switch (task.type) {
      case 'anime':
        await processAnimeTask(task, db);
        break;
      case 'episode':
        await processEpisodeTask(task, db, concurrency);
        break;
      default:
        console.warn('Unknown task type:', task);
    }
}

async function processAnimeTask(task, db) {
    // Insert or update the anime row in DB if needed
    // If indefinite, store that indefinite flag in DB
    console.log(`Inserting Anime: ${task.englishTitle}, Episode Count: ${task.episodeNumber}, Format: ${task.format}`);
    // console.log('altTitle List: ', task.animeAltTitles);

    db.insertAnime({
        anilistId: task.anilistId,
        malId: task.myAnimeListId,
        anidbId: task.anidbId,
        englishTitle: task.englishTitle,
        romanjiTitle: task.romanjiTitle,
        episode_list: null,
        format: task.format,
    });

    if (task.episodeNumber === -1) {
        console.log(`Anime ${anilistId} is indefinite. We won't mass-queue episodes. Possibly rely on dynamic or partial checks.`);
    } else {
        // consider that a anime task is only created when it currently doesnt exist in the database, this means all episodes are missing.

        for (let i = 1; i <= task.episodeNumber; i++) {
            enqueue({
                type: 'episode',
                anilistId: task.anilistId,
                myAnimeListId: task.myAnimeListId,
                anidbId: task.anidbId,
                englishTitle: task.englishTitle,
                romanjiTitle: task.romanjiTitle,
                episodeNumber: i,
                audio: 'sub',
                format: task.format,
                mode: task.mode,
                animeAltTitles: task.animeAltTitles
            });

            if (task.isDubbed) {
                enqueue({
                    type: 'episode',
                    anilistId: task.anilistId,
                    myAnimeListId: task.myAnimeListId,
                    anidbId: task.anidbId,
                    englishTitle: task.englishTitle,
                    romanjiTitle: task.romanjiTitle,
                    episodeNumber: i,
                    audio: 'dub',
                    format: task.format,
                    mode: task.mode,
                    animeAltTitles: task.animeAltTitles
                });
            } 
        }
    }
}

async function processEpisodeTask(task, db, concurrency) {
    // const { anilistId, episodeNumber } = task;
    // Otherwise, do your crawler dispatch logic:
    // 1. Obtain a proxy if concurrency > 1
    // 2. Call your crawler to get the magnet link / direct link
    // 3. Insert results into DB if found
    // 4. Store partial or final results in global cache
    if (concurrency > 1) {
        const proxy = nextProxy();
        await crawler_dispatch(
            db,
            task.englishTitle,
            task.romanjiTitle,
            task.audio,
            task.anilistId,
            task.anidbId,
            task.episodeNumber,
            task.format,
            task.mode,
            task.animeAltTitles,
            proxy,
        );
        
            // e.g. round-robin
        // Then pass this proxy to your crawler logic 
    } else {
        console.log(`\n\n\nfetching: ${task.englishTitle}, Episode: ${task.episodeNumber}, Audio: ${ task.audio }, Format ${task.format}`);
        //console.log(task.animeAltTitles);

        await crawler_dispatch(
            db,
            task.englishTitle,
            task.romanjiTitle,
            task.audio,
            task.anilistId,
            task.anidbId,
            task.episodeNumber,
            task.format,
            task.mode,
            task.animeAltTitles
        ); 

        /* if (task.anilistId === 45) {
            console.log(`\n\n\nfetching: ${task.englishTitle}, Episode: ${task.episodeNumber}, Audio: ${ task.audio }, Format ${task.format}`);

            await crawler_dispatch(
                db,
                task.englishTitle,
                task.romanjiTitle,
                task.audio,
                task.anilistId,
                task.anidbId,
                task.episodeNumber,
                task.format,
                task.mode,
                task.animeAltTitles
            ); 
        } */
       
    

 
    }
  
    // In indefinite mode, if the crawler finds no sign of epNumber,
    // you can decide to re-queue epNumber again later or increment epNumber by 1, etc.
}


// perPage = 50
async function fetchAnimeData(query, page = 1, perPage = 50) {
    const variables = { page, perPage };

    try {
    const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
    });

    const data = await response.json();
    return data.data.Page;
    } catch (error) {
    console.error('Error fetching data:', error);
    }
};

function findMissingIntegers(nums) {
    const missingRanges = [];
    
    // Iterate through the array, comparing consecutive elements
    for (let i = 0; i < nums.length - 1; i++) {
      const current = nums[i];
      const next = nums[i + 1];
      
      // Check if there are missing numbers between current and next
      if (next - current > 1) {
        const start = current + 1;
        const end = next - 1;
        
        // Add the range to our result
        missingRanges.push([start, end]);
      }
    }
    
    return missingRanges;
}


export {
    AnimeDatabase
}
// await main()