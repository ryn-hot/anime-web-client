import WebTorrent from "webtorrent";



let globalClient = null;

export function getGlobalClient() {
    if (!globalClient) {
      // Create client once
      globalClient = new WebTorrent();
      console.log('Global WebTorrent client created');
    }
    return globalClient;
}

