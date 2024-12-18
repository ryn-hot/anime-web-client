import WebTorrent from 'webtorrent'
import wrtc from 'wrtc'

const client = new WebTorrent({ wrtc })

const magnetURI = 'magnet:?xt=urn:btih:b5b435316e592b642db961fd63abae9af3799662&amp;dn=%5BEMBER%5D%20Bleach%3A%20Thousand-Year%20Blood%20War%20%282022%29%20%28Season%201%29%20%5B1080p%5D%20%5BDual%20Audio%20HEVC%20WEBRip%5D%20%28Bleach%3A%20Sennen%20Kessen-hen%29%20%28Batch%29&amp;tr=http%3A%2F%2Fnyaa.tracker.wf%3A7777%2Fannounce&amp;tr=udp%3A%2F%2Fopen.stealth.si%3A80%2Fannounce&amp;tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&amp;tr=udp%3A%2F%2Fexodus.desync.com%3A6969%2Fannounce&amp;tr=udp%3A%2F%2Ftracker.torrent.eu.org%3A451%2Fannounce';

console.log('Torrent added. Waiting for metadata...');
const torrent = client.add(magnetURI)

torrent.on('infoHash', () => {
  console.log(`InfoHash event fired: ${torrent.infoHash}`)
})

torrent.on('metadata', async () => {
  console.log('Metadata event fired!')
  console.log('Starting health check...')

  try {
    // Wait 10 seconds to see if we connect to any peers
    await new Promise((resolveHealth, rejectHealth) => {
      const healthCheckTimeout = setTimeout(() => {
        console.log('Health check timeout triggered');
        if (torrent.numPeers === 0) {
          console.log('Peer Health Check Failed - no peers found.');
          rejectHealth(new Error('No peers found, torrent likely unhealthy.'));
        } else {
          console.log(`Peer Health Passed - ${torrent.numPeers} peer(s) connected.`);
          resolveHealth();
        }
      }, 10000); // 10 seconds

      // If the torrent errors during this period, abort
      torrent.on('error', (err) => {
        clearTimeout(healthCheckTimeout);
        rejectHealth(err);
      });
    });

    // If we got here, it means we have peers and the torrent is considered healthy.
    console.log('Torrent is healthy. Proceeding with file inspection.');

    // Print out file names
    console.log('Files in torrent:')
    torrent.files.forEach(file => console.log('  ' + file.name))

    // Once done, destroy the client
    client.destroy(() => {
      console.log('Client destroyed. Test complete.')
    });

  } catch (err) {
    // If we failed the health check (no peers) or had another error
    console.error('Health check failed or torrent error:', err.message);

    // Destroy the client to clean up resources
    client.destroy(() => {
      console.log('Client destroyed due to health check failure.');
    });
  }
});

torrent.on('error', (err) => {
  console.error('Torrent error:', err)
});