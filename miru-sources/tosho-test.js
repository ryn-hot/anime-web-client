import ToshoSource from './tosho.js';

// await miruToshoEpisode(200729, '', []);

export async function miruToshoEpisode(anidbEid, res, exclusions) {
    // For a single episode:
    try {
        const singleEpisodeResult = await ToshoSource.single({
            anidbEid: anidbEid,  // AniDB episode ID
            resolution: res, // Optional: "2160" | "1080" | "720" | "540" | "480" | ""
            exclusions: exclusions // Optional: keywords to exclude
        });
        // console.log("Single episode results:", singleEpisodeResult);
        return singleEpisodeResult
    } catch (error) {
        console.error("Single episode error:", error);
    }
    
}

export async function miruToshoMovie(anidb_id, res, exclusions) {
    try {
        const movieResult = await ToshoSource.movie({
            anidbAid: anidb_id,   // AniDB anime ID
            resolution: res, // Optional
            exclusions: exclusions //["dub", "dubbed"] // Optional
        });
        // console.log("Movie results:", movieResult);
        return movieResult;
    } catch (error) {
        console.error("Movie error:", error);
    } 
}


// For a batch/complete series:
export async function miruToshoBatchAnime(anidbAid, episodeCount, res, exclusions) {
    try {
        const batchResult = await ToshoSource.batch({
            anidbAid: anidbAid,   // AniDB anime ID
            episodeCount: episodeCount,   // Total number of episodes
            resolution: res, // Optional
            exclusions: exclusions // Optional
        });
        return batchResult;
        // console.log("Batch results:", batchResult);
    } catch (error) {
        console.error("Batch error:", error);
    }
}


export async function miruToshoAllAnime(anidbAid) {
    try {
        const allResult = await ToshoSource.all({anidbAid});
        return allResult;
        // console.log("All results:", allResult);
        // console.log("Results Length", allResult.length);
    } catch (error) {
        console.error("All error:", error);
    }
}


