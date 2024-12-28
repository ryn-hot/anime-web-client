// proxy-manager.js
let proxies = [
    'http://user1:pass1@zproxy.lum-superproxy.io:22225',
    'http://user2:pass2@zproxy.lum-superproxy.io:22225',
    // ...
  ];
  let currentIndex = 0;
  
  function nextProxy() {
    if (!proxies.length) {
      throw new Error('No proxies available');
    }
    const proxy = proxies[currentIndex];
    currentIndex = (currentIndex + 1) % proxies.length;
    return proxy;
  }
  
  function reportFailure(proxy) {
    // Optionally remove or deprioritize the failing proxy
    const idx = proxies.indexOf(proxy);
    if (idx !== -1) {
      // e.g. remove from list so we don't use it again
      proxies.splice(idx, 1);
    }
  }
  
  export { nextProxy, reportFailure };