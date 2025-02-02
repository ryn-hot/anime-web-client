//add a range value to the torrent entries, simplify the rotating proxy. then test sequential. then create missing queue that probes deeply using gemini 1.5 flash. 

import { LRUCache } from 'lru-cache';

const globalTorrentCache = new LRUCache({ max: 100, ttl: 1000 * 60 * 60 }); 

function cacheTorrentRange(anilistId, startEp, endEp, audioType, magnetLink, seeders = 0, infoHash) {
    // The cache key for this particular anime ID
    const cacheKey = `anime-slices:${anilistId}`;
  
    // Retrieve the existing slices array or create a new empty one
    const existingSlices = globalTorrentCache.get(cacheKey) || [];
  
    // Check if there's already a slice for (startEp, endEp, audioType)
    const dupeIndex = existingSlices.findIndex(slice =>
      slice.startEp === startEp &&
      slice.endEp === endEp &&
      slice.audioType === audioType && 
      slice.infoHash === infoHash
    );
  
    if (dupeIndex !== -1) {
        if (seeders > existingSlices[dupeIndex].seeders) {
            existingSlices[dupeIndex].magnetLink = magnetLink;
            existingSlices[dupeIndex].seeders = seeders;
        }
    } else {
        console.log('Torrent Cached')
        // Otherwise, push a new slice entry
        existingSlices.push({
            startEp,
            endEp,
            audioType,
            magnetLink,
            seeders,
            infoHash
        });
    }
  
    // Store the updated array back into LRU
    globalTorrentCache.set(cacheKey, existingSlices);
}
  

function findMagnetForEpisode(anilistId, episodeNumber, audioType) {
    const slices = globalTorrentCache.get(`anime-slices:${anilistId}`);
    if (!slices) return null;

    // Find a slice that covers episodeNumber and matches audioType
    const candidates = slices.filter(slice =>
        slice.audioType === audioType &&
        episodeNumber >= slice.startEp &&
        episodeNumber <= slice.endEp
    );

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.seeders - a.seeders);

    // Return magnet link and seeders (or the entire object)
    const best = candidates[0];
    return {
        magnetLink: best.magnetLink,
        seeders: best.seeders
    };
}

function findAllTorrentsForEpisode(anilistId, episodeNumber, audioType) {
    const slices = globalTorrentCache.get(`anime-slices:${anilistId}`);
    if (!slices) return null;

    // Find a slice that covers episodeNumber and matches audioType
    const candidates = slices.filter(slice =>
        slice.audioType === audioType &&
        episodeNumber >= slice.startEp &&
        episodeNumber <= slice.endEp
    );

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.seeders - a.seeders);

    return candidates;
}

function storeTorrentMetadata(infoHash, fileList) {
    const key = `torrent-infoHash:${infoHash}`;
    globalTorrentCache.set(key, {
        fileList
    });
}

function wipeInfoHashFromCache(anilistId, infoHash) {
    // Remove the slice from the anime-slices cache
    const slicesKey = `anime-slices:${anilistId}`;
    const slices = globalTorrentCache.get(slicesKey);

    if (slices) {
        const filteredSlices = slices.filter(slice => slice.infoHash !== infoHash);
        globalTorrentCache.set(slicesKey, filteredSlices);
    }

    // Remove any stored torrent metadata for this infoHash
    const metadataKey = `torrent-infoHash:${infoHash}`;
    globalTorrentCache.delete(metadataKey);
}
  
function getTorrentMetadata(infoHash) {
    const key = `torrent-infoHash:${infoHash}`;
    return globalTorrentCache.get(key) || null;
}

function isInfoHashInCache(infoHash, anilistId, audioType) {
    const slices = globalTorrentCache.get(`anime-slices:${anilistId}`);
    if (!slices) return false;
    return slices.some(slice => slice.infoHash === infoHash && slice.audioType === audioType);
}


export {
    isInfoHashInCache,
    cacheTorrentRange,
    findMagnetForEpisode,
    storeTorrentMetadata,
    getTorrentMetadata,
    findAllTorrentsForEpisode,
    wipeInfoHashFromCache,
    globalTorrentCache
}