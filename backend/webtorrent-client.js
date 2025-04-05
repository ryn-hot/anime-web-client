import WebTorrent from "webtorrent";
// import wrtc from "wrtc";


let globalClient = null;

export function getGlobalClient() {
    if (!globalClient) {
      // Create client once
      globalClient = new WebTorrent();
      console.log('Global WebTorrent client created');
    }
    return globalClient;
}

