function getCurrentSeason() {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return 'SPRING';
    if (month >= 6 && month <= 8) return 'SUMMER';
    if (month >= 9 && month <= 11) return 'FALL';
    return 'WINTER';
}

// Function to fetch the top anime banner
function fetchTopAnimeBanner() {
    const query = `
    query ($page: Int, $perPage: Int, $sort: [MediaSort], $season: MediaSeason, $seasonYear: Int) {
        Page(page: $page, perPage: $perPage) {
            media(sort: $sort, type: ANIME, season: $season, seasonYear: $seasonYear) {
                id
                title {
                    romaji
                    english
                }
                bannerImage
            }
        }
    }`;

    const variables = {
        page: 1,
        perPage: 1, // Fetch only the top anime
        sort: ['POPULARITY_DESC'],
        season: getCurrentSeason(),
        seasonYear: new Date().getFullYear()
    };

    fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ query, variables })
    })
    .then(response => response.json())
    .then(data => {
        console.log(data.data.Page.media[0].bannerImage);
        //displayBanner(data)
    
    })
    .catch(error => console.error('Error fetching banner data:', error));
}


fetchTopAnimeBanner();