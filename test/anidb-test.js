async function getOnePieceEpisodeCount() {
    try {
        // Add headers to make the request more reliable
        const options = {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0' // Some APIs require a user agent
            }
        };

        // Make request to TV Maze API
        const response = await fetch('https://api.tvmaze.com/singlesearch/shows?q=one-piece&embed=episodes', options);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Check if we have the expected data structure
        if (!data || !data._embedded || !data._embedded.episodes) {
            throw new Error('Unexpected API response structure');
        }
        
        // The episodes are in the _embedded.episodes array
        const episodeCount = data._embedded.episodes.length;
        
        console.log(`Total One Piece episodes: ${episodeCount}`);
        
        // Get the latest episode info
        const latestEpisode = data._embedded.episodes[episodeCount - 1];
        console.log(`Latest episode: Episode ${latestEpisode.number} - "${latestEpisode.name}"`);
        console.log(`Aired on: ${latestEpisode.airdate}`);
        
        return {
            totalEpisodes: episodeCount,
            latestEpisode: latestEpisode
        };
    } catch (error) {
        console.error('Error fetching One Piece data:', error);
        console.error('You might be experiencing one of these issues:');
        console.error('1. CORS restrictions - Try running this in a Node.js environment');
        console.error('2. Rate limiting - Wait a few minutes and try again');
        console.error('3. Network connectivity issues');
        console.error('4. API endpoint changes - Check TV Maze API documentation');
        return null;
    }
}

// Call the function
getOnePieceEpisodeCount();