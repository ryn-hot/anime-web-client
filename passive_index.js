import Database from "better-sqlite3";
import fs from 'fs/promises';




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
}

// Example usage:
async function main() {
    const db = new AnimeDatabase('./anime.db');
    
    try {
        // Reset database (optional)
        await db.reset();
        
        // Initialize with schema
        await db.initializeFromSchema('./node.sql');
        
        // Check if anime exists
        const exists = db.checkAnimeExists(123);
        console.log('Anime exists:', exists);
    } catch (error) {
        console.error('Database operation failed:', error);
    } finally {
        db.close();
    }
}

async function passive_index(db) {
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
        }
        }
    }
    `;

    let page = 1;
    let hasNextPage = true;

    const tasksQueue = [];

    while (hasNextPage) {
        const pageData = await fetchAnimeData(page);
        
        if (!pageData || !pageData.media) {
            console.log('No page data or media found. Stopping pagination.');
            break;
        }

        const pageIds = pageData.media.map(anime => anime.id);
        console.log(`Processing page ${page} with ${pageIds.length} anime...`);

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
            const englishTitle = anime.title?.english || null;
            const romanjiTitle = anime.title?.romaji || null;
            const anilistEpisodes = anime.episodes || 0;   // AniList-supplied total
            
            if (anilistEpisodes == 0 && format != 'Movie') {
                const mappingsResponse = await fetch('https://api.ani.zip/mappings?anilist_id=' + anime.id)
                const json = await mappingsResponse.json()
            }   
        


            // 4.1 If the anime does NOT exist in the local DB
            if (!existingPageIds.has(anilistId)) {
                // We queue a 'season-level' task
                tasksQueue.push({
                type: 'anime',
                anilistId,
                format,
                myAnimeListId,
                englishTitle,
                romanjiTitle,
                // We also store "localAiringStatus" or original AniList status
                airingStatus: localAiringStatus,
                anilistEpisodes,
                });

                console.log(`Queueing missing anime ID ${anilistId} for insertion.`);
                // We do NOT insert into DB yet, as per your instructions

            } else {
                // 4.2 The anime already exists
                // Let's see if the local DB's anime row has a different airing_status
                const existingAnime = existingPageIds.get(anilistId);

                // 4.3 Now check episodes
                const localStats = episodeStats.get(anilistId) || { localCount: 0, maxEpisode: 0 };
                const localMaxEp = localStats.maxEpisode || 0;

                if (anilistEpisodes > localMaxEp) {
                // There's a difference in episode counts 
                // We queue missing episodes individually
                for (let epNum = localMaxEp + 1; epNum <= anilistEpisodes; epNum++) {
                    tasksQueue.push({
                    type: 'episode',
                    anilistId,
                    episodeNumber: epNum
                    // In your instructions, you said "We don't update the database 
                    // for these new episodes until they are found." So we only queue them.
                    });
                }
                console.log(`Queueing ${anilistEpisodes - localMaxEp} missing episodes for anime ${anilistId}`);
                }
            }
        } // end for loop of media

        // Move to next page
        hasNextPage = pageData.pageInfo.hasNextPage;
        page++;

        // Throttle requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

  // At this point, tasksQueue contains all season-level and episode-level tasks
  return tasksQueue;
          
      
}

async function fetchAnimeData(page = 1, perPage = 50) {
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


await main()