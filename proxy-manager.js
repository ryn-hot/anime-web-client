// proxy-manager.js
class ProxyManager {
    constructor(proxyList) {
        this.indexBuffer = new SharedArrayBuffer(4);
        this.indexArray = new Int32Array(this.indexBuffer);
        this.proxies = [...proxyList]; // Make a copy
        
        // Track proxy health with a Map
        this.healthMap = new Map(
            this.proxies.map(proxy => [proxy, true])
        );
    }
    
    nextProxy() {
        if (this.proxies.length === 0) {
            throw new Error('No proxies available');
        }
        
        // Get next index atomically
        const index = Atomics.add(this.indexArray, 0, 1);
        
        // Try up to proxies.length times to find a healthy proxy
        for (let i = 0; i < this.proxies.length; i++) {
            const proxyIndex = (index + i) % this.proxies.length;
            const proxy = this.proxies[proxyIndex];
            
            if (this.healthMap.get(proxy)) {
                return proxy;
            }
        }
        
        throw new Error('No healthy proxies available');
    }
    
    reportFailure(proxy) {
        this.healthMap.set(proxy, false);
        
        // Optional: Remove completely after N failures
        // You could add a failure counter if needed
        const failedProxies = Array.from(this.healthMap.entries())
            .filter(([_, healthy]) => !healthy)
            .map(([proxy]) => proxy);
            
        if (failedProxies.length > this.proxies.length / 2) {
            console.warn('Over 50% of proxies have failed');
        }
    }
    
    get healthyCount() {
        return Array.from(this.healthMap.values())
            .filter(healthy => healthy)
            .length;
    }
}

const manager = new ProxyManager([
    'http://user1:pass1@zproxy.lum-superproxy.io:22225',
    'http://user2:pass2@zproxy.lum-superproxy.io:22225',
    // ...
]);

export const nextProxy = () => manager.nextProxy();
export const reportFailure = (proxy) => manager.reportFailure(proxy);