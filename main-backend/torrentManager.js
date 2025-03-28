import { dynamicFinder } from "../dynamic_fetch";
import { getGlobalClient } from "../webtorrent-client";

let activeTorrent = null;

/**
 * Starts a WebTorrent stream for the given torrent parameters.
 *
 * @param {string|number} alID - The identifier (e.g. from AniList).
 * @param {number} episodeNum - Episode number.
 * @param {string} audio - Audio type (e.g. 'sub' or 'dub').
 * @returns {Promise<Object>} An object containing the file stream and metadata.
 * @throws {Error} If the torrent cannot be started or the file index is invalid.
 */
export async function startStream(alID, episodeNum, audio) {
  // Clean up any active torrent first.
  if (activeTorrent) {
    try {
      activeTorrent.destroy();
    } catch (err) {
      console.warn("Error destroying previous torrent:", err);
    }
    activeTorrent = null;
  }

  // Use dynamicFinder to obtain torrent details.
  const result = await dynamicFinder(alID, episodeNum, audio);
  if (!result || !result.magnetLink || result.fileIndex === undefined) {
    throw new Error("Invalid torrent lookup result.");
  }
  const { magnetLink, fileIndex } = result;

  const client = getGlobalClient();

  // Wrap client.add in a Promise for cleaner async/await flow.
  const torrent = await new Promise((resolve, reject) => {
    try {
      client.add(magnetLink, { destroyStoreOnDestroy: true }, (torrent) => {
        resolve(torrent);
      });
    } catch (err) {
      return reject(err);
    }
  });
  activeTorrent = torrent;

  if (!torrent.files[fileIndex]) {
    torrent.destroy();
    throw new Error("The specified file index does not exist in the torrent.");
  }

  const file = torrent.files[fileIndex];
  // Optionally, you can derive MIME type based on file extension here.
  const extension = file.name.split('.').pop().toLowerCase();

  return {
    stream: file.createReadStream(), // This is a non-seekable, progressive stream.
    fileName: file.name,
    length: file.length,
    extension,
  };
}

/**
 * Stops the currently active torrent stream if one exists.
 */
export function stopStream() {
  if (activeTorrent) {
    try {
      activeTorrent.destroy();
    } catch (err) {
      console.warn("Error stopping active torrent:", err);
    }
    activeTorrent = null;
  }
}

export default {
  startStream,
  stopStream,
};
