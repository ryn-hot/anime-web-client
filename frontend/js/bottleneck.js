export class AniListAPI {
    constructor() {
        this.rateLimitRemaining = 30; // Start conservatively with new temporary limit
        this.lastRequestTime = 0;
        this.cooldownMs = 300;
        this.retryQueue = [];
        this.isProcessingQueue = false;
        this.maxRetries = 3;
    }

    async makeRequest(options, retryCount = 0) {
        // Wait for cooldown period
        const now = Date.now();
        const timeToWait = Math.max(0, this.lastRequestTime + this.cooldownMs - now);
        if (timeToWait > 0) {
            await new Promise(resolve => setTimeout(resolve, timeToWait));
        }

        // If we're out of requests, queue the request
        if (this.rateLimitRemaining <= 0) {
            return new Promise((resolve, reject) => {
                this.retryQueue.push({ options, resolve, reject });
                this.processQueue();
            });
        }

        try {
            const response = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                mode: 'cors', // Add this line
                credentials: 'omit', // Add this line
                body: JSON.stringify({
                    query: options.query,
                    variables: options.variables || {}
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }


            // Update rate limit info
            this.rateLimitRemaining = parseInt(response.headers.get('X-RateLimit-Remaining') ?? '30');
            this.lastRequestTime = Date.now();

            // Handle rate limiting
            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get('Retry-After') ?? '60');
                console.log(`Rate limited. Attempt ${retryCount + 1} of ${this.maxRetries}. Waiting ${retryAfter} seconds.`);

                if (retryCount < this.maxRetries) {
                    // Wait for the retry-after period plus a small buffer
                    await new Promise(resolve => setTimeout(resolve, (retryAfter * 1000) + 100));
                    return this.makeRequest(options, retryCount + 1);
                } else {
                    throw new Error(`Failed after ${this.maxRetries} retry attempts due to rate limiting`);
                }
            }

            const data = await response.json();
            
            // Check for GraphQL errors
            if (data.errors) {
                const error = new Error(data.errors[0].message);
                error.response = response;
                error.errors = data.errors;
                throw error;
            }

            return data;
        } catch (error) {
            if (!error.response && retryCount < this.maxRetries) {
                console.log(`Network error. Attempt ${retryCount + 1} of ${this.maxRetries}. Retrying in 5 seconds.`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                return this.makeRequest(options, retryCount + 1);
            }
            throw error;
        }
    }

    async processQueue() {
        if (this.isProcessingQueue || this.retryQueue.length === 0) return;
        this.isProcessingQueue = true;

        while (this.retryQueue.length > 0) {
            const { options, resolve, reject } = this.retryQueue[0];
            
            try {
                const result = await this.makeRequest(options);
                resolve(result);
                this.retryQueue.shift();
            } catch (error) {
                reject(error);
                this.retryQueue.shift();
            }

            // Break if we're out of requests
            if (this.rateLimitRemaining <= 0) break;
        }

        this.isProcessingQueue = false;
    }
}