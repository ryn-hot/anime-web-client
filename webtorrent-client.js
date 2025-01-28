import WebTorrent from "webtorrent";
import wrtc from 'wrtc';


let globalClient = null;

export function getGlobalClient() {
    if (!globalClient) {
      // Create client once
      globalClient = new WebTorrent({ wrtc });
      console.log('Global WebTorrent client created');
    }
    return globalClient;
}

const TRACKERS = [
  // WebSocket (WSS) trackers
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.webtorrent.dev',
  'wss://tracker.files.fm:7073/announce',
  'wss://tracker.btorrent.xyz/',
  
  // UDP trackers
  'udp://open.stealth.si:80/announce',
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://tracker.coppersurfer.tk:6969/announce',
  'udp://9.rarbg.to:2710/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  
  // HTTP trackers
  'http://nyaa.tracker.wf:7777/announce',
  'http://open.acgnxtracker.com:80/announce',
  'http://anidex.moe:6969/announce',
  'http://tracker.anirena.com:80/announce'
];


export function getGlobalClientTest() {
  if (!globalClient) {
    globalClient = new WebTorrent({ 
      wrtc,
      tracker: {
          announce: TRACKERS,
          getAnnounceOpts: () => ({
              numwant: 50 // Request more peers initially for faster metadata
          })
      },
      dht: {
          bootstrap: [
              'router.bittorrent.com:6881',
              'dht.transmissionbt.com:6881',
              'router.utorrent.com:6881'
          ]
      }
    });
  }
  return globalClient
}