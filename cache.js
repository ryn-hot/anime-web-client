//add a range value to the torrent entries, simplify the rotating proxy. then test sequential. then create missing queue that probes deeply using gemini 1.5 flash. 

import { LRUCache } from 'lru-cache';

const globalTorrentCache = new LRUCache({ max: 100, ttl: 1000 * 60 * 60 }); 

function cacheTorrentRange(anilistId, startEp, endEp, audioType, magnetLink, seeders = 0) {
    // The cache key for this particular anime ID
    const cacheKey = `${anilistId}`;
  
    // Retrieve the existing slices array or create a new empty one
    const existingSlices = globalTorrentCache.get(cacheKey) || [];
  
    // Check if there's already a slice for (startEp, endEp, audioType)
    const dupeIndex = existingSlices.findIndex(slice =>
      slice.startEp === startEp &&
      slice.endEp === endEp &&
      slice.audioType === audioType
    );
  
    if (dupeIndex !== -1) {
        if (seeders > existingSlices[dupeIndex].seeders) {
            existingSlices[dupeIndex].magnetLink = magnetLink;
            existingSlices[dupeIndex].seeders = seeders;
        }
    } else {
        // Otherwise, push a new slice entry
        existingSlices.push({
            startEp,
            endEp,
            audioType,
            magnetLink,
            seeders
        });
    }
  
    // Store the updated array back into LRU
    globalTorrentCache.set(cacheKey, existingSlices);
  }
  

function findMagnetForEpisode(anilistId, episodeNumber, audioType) {
    const slices = globalTorrentCache.get(`${anilistId}`);
    if (!slices) return null;

    // Find a slice that covers episodeNumber and matches audioType
    const match = slices.find(slice =>
        slice.audioType === audioType &&
        episodeNumber >= slice.startEp &&
        episodeNumber <= slice.endEp
    );

    if (!match) return null;

    // Return magnet link and seeders (or the entire object)
    return {
        magnetLink: match.magnetLink,
        seeders: match.seeders
    };
}
  

export {
    cacheTorrentRange,
    findMagnetForEpisode,
    globalTorrentCache
}