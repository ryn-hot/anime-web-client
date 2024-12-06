document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded Event Fired!"); 
    const menuButton = document.querySelector('.menu-button');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.overlay');


    // Event listener for menu button
    menuButton.addEventListener('click', () => {
        toggleSidebar();
    });
    

    // Event listener for overlay click
    overlay.addEventListener('click', closeSidebar);
    

    

    // Event listener for Escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeSidebar();
        }
    });


    // Fetch and populate genres
    fetchGenres();

    // Populate years
    populateYearSelect();


    // Query selectors for filters
    const titleInput = document.querySelector('.icon-input[placeholder="Any"]'); // Title field
    const genreSelect = document.querySelector('.icon-input[name="genre"]');
    const seasonSelect = document.querySelector('.icon-input-ss[name="season"]');
    const yearSelect = document.querySelector('.icon-input-ss[name="year"]');
    const formatSelect = document.querySelector('.icon-field:nth-child(4) .icon-input'); // 4th icon-field is Format
    const statusSelect = document.querySelector('.icon-field:nth-child(5) .icon-input'); // 5th is Status
    const sortSelect = document.querySelector('.icon-field:nth-child(6) .icon-input'); // 6th is Sort

    // Listen for changes in filters
    [titleInput, genreSelect, seasonSelect, yearSelect, formatSelect, statusSelect, sortSelect].forEach(el => {
        el.addEventListener('change', updateAnimeList);
        el.addEventListener('input', updateAnimeList); // For text fields on input
    });

    // Initial fetch on load
    updateAnimeList();

});


// Toggle sidebar expand/collapse
function toggleSidebar() {
    if (sidebar.classList.contains('expanded')) {
        sidebar.classList.remove('expanded');
        overlay.classList.remove('active'); // Hide overlay when collapsing
    } else {
        sidebar.classList.add('expanded');
        overlay.classList.add('active'); // Show overlay when expanding
    }
}

// Close overlay and sidebar
function closeSidebar() {
    sidebar.classList.remove('expanded');
    overlay.classList.remove('active');
}

function fetchGenres() {
    const query = `
        query {
            GenreCollection
        }
    `;
  
    fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ query: query }),
    })
    .then(response => response.json())
    .then(data => {
        const genres = data.data.GenreCollection;
        populateGenreSelect(genres);
    })
    .catch(error => {
        console.error('Error fetching genres:', error);
    });
}


/** NEW FUNCTION: Populate Genre Select **/
function populateGenreSelect(genres) {
    const genreSelect = document.querySelector('.icon-input[name="genre"]');
    // Remove existing options
    genreSelect.innerHTML = '';
  
    // Add 'Any' option
    const anyOption = document.createElement('option');
    anyOption.value = '';
    anyOption.textContent = 'Any';
    genreSelect.appendChild(anyOption);
  
    // Add genres
    genres.forEach(genre => {
        const option = document.createElement('option');
        option.value = genre;
        option.textContent = genre;
        genreSelect.appendChild(option);
    });
}


/** NEW FUNCTION: Populate Year Select **/
function populateYearSelect() {
    const currentYear = new Date().getFullYear();
    const startYear = 1950; // Adjust as needed
    const yearSelect = document.querySelector('.icon-input-ss[name="year"]');

    // Clear existing options
    yearSelect.innerHTML = '';

    // Optionally add an 'Any' option
    const anyOption = document.createElement('option');
    anyOption.value = '';
    anyOption.textContent = 'Any';
    yearSelect.appendChild(anyOption);

    for (let year = currentYear + 1; year >= startYear; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    }
}



// Function to highlight active sidebar link
function highlightActiveLink() {
    const sections = document.querySelectorAll('main section');
    const sidebarLinks = document.querySelectorAll('.sidebar-menu li a');

    let index = sections.length;

    while(--index && window.scrollY + 50 < sections[index].offsetTop) {}

    sidebarLinks.forEach((link) => link.classList.remove('active'));
    if(sidebarLinks[index]) {
        sidebarLinks[index].classList.add('active');
    }
}

/** 
 * Fetch and update anime list based on filters.
 * Display shimmering placeholders while loading.
 */
function updateAnimeList() {
    const titleInput = document.querySelector('.icon-input[placeholder="Any"]');
    const genreSelect = document.querySelector('.icon-input[name="genre"]');
    const seasonSelect = document.querySelector('.icon-input-ss[name="season"]');
    const yearSelect = document.querySelector('.icon-input-ss[name="year"]');
    const formatSelect = document.querySelectorAll('.icon-field')[3].querySelector('.icon-input');
    const statusSelect = document.querySelectorAll('.icon-field')[4].querySelector('.icon-input');
    const sortSelect = document.querySelectorAll('.icon-field')[5].querySelector('.icon-input');

    const title = titleInput.value.trim();
    const genre = genreSelect.value;
    const season = seasonSelect.value === "Any" ? null : seasonSelect.value.toUpperCase();
    const year = yearSelect.value ? parseInt(yearSelect.value) : null;
    let format = formatSelect.value;
    // AniList supports formats like TV, TV_SHORT, OVA, ONA, MOVIE, SPECIAL, etc.
    // Map user-friendly formats to AniList formats if needed:
    let mappedFormat = "";
    switch(format) {
        case "TV Show": mappedFormat = "TV"; break;
        case "Movie": mappedFormat = "MOVIE"; break;
        case "TV Short": mappedFormat = "TV_SHORT"; break;
        case "Special": mappedFormat = "SPECIAL"; break;
        case "OVA": mappedFormat = "OVA"; break;
        case "ONA": mappedFormat = "ONA"; break;
        default: mappedFormat = null;
    }

    const statusMap = {
        "Any": null,
        "Airing": "RELEASING",
        "Finished": "FINISHED",
        "Not Yet Aired": "NOT_YET_RELEASED",
        "Cancelled": "CANCELLED"
    };
    const status = statusMap[statusSelect.value] || null;

    // AniList sort options: ["POPULARITY_DESC", "TRENDING_DESC", "SCORE_DESC", "START_DATE_DESC", ...]
    let sortVal = [];
    switch(sortSelect.value) {
        case "Score": sortVal = ["SCORE_DESC"]; break;
        case "Popularity": sortVal = ["POPULARITY_DESC"]; break;
        case "Trending": sortVal = ["TRENDING_DESC"]; break;
        case "Release Date": sortVal = ["START_DATE_DESC"]; break;
        case "Updated Date": sortVal = ["UPDATED_AT_DESC"]; break;
        default: sortVal = ["POPULARITY_DESC"]; // Default sort
    }

    // Display placeholders
    showPlaceholders();

    const query = `
    query($page:Int,$perPage:Int,$search:String,$genre:[String],$season:MediaSeason,$seasonYear:Int,$format:MediaFormat,$status:MediaStatus,$sort:[MediaSort]) {
      Page(page:$page,perPage:$perPage) {
        media(search:$search,genre_in:$genre,season:$season,seasonYear:$seasonYear,format:$format,status:$status,sort:$sort,type:ANIME) {
          id
          title {
            english
            romaji
          }
          coverImage {
            medium
            extraLarge
          }
          season
          seasonYear
        }
      }
    }`;

    // We want 32 results per request, for simplicity set perPage=32
    const variables = {
        page: 1,
        perPage: 32,
        search: title || undefined,
        genre: genre || undefined,
        season: season || undefined,
        seasonYear: year || undefined,
        format: mappedFormat || undefined,
        status: status || undefined,
        sort: sortVal
    };

    // Clean up variables by removing undefined
    Object.keys(variables).forEach(key => {
        if (variables[key] === undefined) {
            delete variables[key];
        }
    });

    fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
    })
    .then(res => res.json())
    .then(data => {
        const animeList = data.data.Page.media;
        displayAnime(animeList);
    })
    .catch(error => {
        console.error('Error fetching anime:', error);
        displayAnime([]); // In case of error, show empty
    });
}

function showPlaceholders() {
    const grid = document.getElementById('anime-grid');
    grid.innerHTML = ''; // Clear existing content
    for (let i = 0; i < 32; i++) {
        const placeholder = document.createElement('div');
        placeholder.classList.add('placeholder-card');
        grid.appendChild(placeholder);
    }
}

function displayAnime(animeList) {
    const grid = document.getElementById('anime-grid');
    grid.innerHTML = ''; // Clear placeholders

    if (animeList.length === 0) {
        const msg = document.createElement('p');
        msg.style.color = 'white';
        msg.textContent = 'No results found.';
        grid.appendChild(msg);
        return;
    }

    animeList.forEach(anime => {
        const animeItem = document.createElement('div');
        animeItem.classList.add('anime-item'); // Use the same class as on the landing page

        const animeImage = document.createElement('img');
        // Use large if available, fallback to medium
        animeImage.src = anime.coverImage.extraLarge // || anime.coverImage.medium;
        animeImage.alt = anime.title.romaji;

        const animeTitle = document.createElement('h3');
        animeTitle.textContent = anime.title.english || anime.title.romaji;

        animeItem.appendChild(animeImage);
        animeItem.appendChild(animeTitle);

        grid.appendChild(animeItem);
    });
}

// Listen to scroll events
window.addEventListener('scroll', highlightActiveLink);

// Initial highlight
highlightActiveLink();