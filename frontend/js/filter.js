
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded Event Fired!"); 
    const urlParams = new URLSearchParams(window.location.search);
    const seasonParam = urlParams.get('season');
    const seasonYearParam = urlParams.get('seasonYear');
    const sortParam = urlParams.get('sort');
    const genreParam = urlParams.get('genre');
    
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

    window.addEventListener('scroll', handleInfiniteScroll);


    // Fetch and populate genres
    fetchGenres();

    // Populate years
    populateYearSelect();


    // Query selectors by name attribute
    const searchInput = document.querySelector('.search-input[name="keyword"]');
    const genreSelect = document.querySelector('.icon-input[name="genre"]');
    const seasonSelect = document.querySelector('.icon-input[name="season"]');
    const yearSelect = document.querySelector('.icon-input[name="year"]');
    const formatSelect = document.querySelector('.icon-input[name="format"]');
    const statusSelect = document.querySelector('.icon-input[name="status"]');
    const sortSelect = document.querySelector('.icon-input[name="sort"]');

    if (seasonParam && seasonSelect) {
        seasonSelect.value = capitalizeFirstLetter(seasonParam.toLowerCase()); 
        // If your select uses "Spring" "Winter" etc. ensure the case matches or map them
    }

    if (seasonYearParam && yearSelect) {
        yearSelect.value = seasonYearParam;
    }

    if (sortParam && sortSelect) {
        // Ensure the sort options in search.html match AniList sort naming or map them
        // Example: if sortParam=TRENDING_DESC and you have an option named "Trending"
        // you might need to handle mapping. Or ensure the search page logic supports it.
        setSortByParam(sortSelect, sortParam);
    }
    

    if (genreParam && genreSelect) {
        genreSelect.value = genreParam;
    }

    // Put all filter elements into an array (excluding searchInput if you only want update on user typing)
    // If you want updates on search input typing, include searchInput as well.
    const filterElements = [genreSelect, seasonSelect, yearSelect, formatSelect, statusSelect, sortSelect].filter(el => el !== null);

    // Attach listeners to each filter
    filterElements.forEach(el => {
        el.addEventListener('change', () => updateAnimeList());
        el.addEventListener('input', ()  => updateAnimeList());
    });

    // Initial fetch on load
    updateAnimeList();

    /** 
     * Polling logic for the search bar:
     * We'll check every 500ms if the search text has changed.
     */
    let lastSearchValue = searchInput ? searchInput.value.trim() : '';  

    setInterval(() => {
        if (!searchInput) return;
        const currentValue = searchInput.value.trim();
        if (currentValue !== lastSearchValue) {
            lastSearchValue = currentValue;
            updateAnimeList();
        }
    }, 1000); // Poll every 500ms

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

    function handleInfiniteScroll() {
        const scrollTop = window.scrollY;
        const windowHeight = window.innerHeight;
        const docHeight = document.documentElement.offsetHeight;
    
        const scrolledRatio = (scrollTop + windowHeight) / docHeight;
    
        // If scrolledRatio > 0.9 means user is at 90% down
        if (scrolledRatio > 0.9 && !isFetching) {
            isFetching = true;
            updateAnimeList(true); // append = true
        }
    }

});

let currentPage = 1;
let lastFilters = {};
let isFetching = false;

function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function setSortByParam(select, sortVal) {
  // If your search page's "Sort" field uses human-readable names,
  // you may need to map AniList sort options to those names.
  // If your code already supports these exact strings, just set select.value = ...
  // For example:
  switch(sortVal) {
    case 'TRENDING_DESC': select.value = 'Trending'; break;
    case 'POPULARITY_DESC': select.value = 'Popularity'; break;
    // Add other mappings as needed
    default: break;
  }
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
    const yearSelect = document.querySelector('.icon-input[name="year"]');

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




/** 
 * Fetch and update anime list based on filters.
 * Display shimmering placeholders while loading.
 */
function updateAnimeList(append = false) {
    console.log("append: ", append);
    const searchInput = document.querySelector('.search-input[name="keyword"]');
    const genreSelect = document.querySelector('select[name="genre"]');
    const seasonSelect = document.querySelector('select[name="season"]');
    const yearSelect = document.querySelector('select[name="year"]');
    const formatSelect = document.querySelector('select[name="format"]');
    const statusSelect = document.querySelector('select[name="status"]');
    const sortSelect = document.querySelector('select[name="sort"]');

    const title = searchInput ? searchInput.value.trim() : '';
    const genre = genreSelect ? genreSelect.value : '';
    const seasonVal = (seasonSelect && seasonSelect.value !== "Any") ? seasonSelect.value.toUpperCase() : null;
    const year = yearSelect && yearSelect.value ? parseInt(yearSelect.value) : null;

    // AniList supports formats like TV, TV_SHORT, OVA, ONA, MOVIE, SPECIAL, etc.
    // Map user-friendly formats to AniList formats if needed:
    let mappedFormat = undefined;
    if (formatSelect) {
        switch(formatSelect.value) {
            case "Any": mappedFormat = undefined; break;
            case "TV Show": mappedFormat = "TV"; break;
            case "Movie": mappedFormat = "MOVIE"; break;
            case "TV Short": mappedFormat = "TV_SHORT"; break;
            case "Special": mappedFormat = "SPECIAL"; break;
            case "OVA": mappedFormat = "OVA"; break;
            case "ONA": mappedFormat = "ONA"; break;
            default: mappedFormat = null;
        }
    }

    const statusMap = {
        "Any": null,
        "Airing": "RELEASING",
        "Finished": "FINISHED",
        "Not Yet Aired": "NOT_YET_RELEASED",
        "Cancelled": "CANCELLED"
    };
    const status = (statusSelect && statusSelect.value in statusMap) ? statusMap[statusSelect.value] : null;

    let sortVal = ["POPULARITY_DESC"];
    if (sortSelect) {
        switch(sortSelect.value) {
            case "Score": sortVal = ["SCORE_DESC"]; break;
            case "Popularity": sortVal = ["POPULARITY_DESC"]; break;
            case "Trending": sortVal = ["TRENDING_DESC"]; break;
            case "Release Date": sortVal = ["START_DATE_DESC"]; break;
            case "Updated Date": sortVal = ["UPDATED_AT_DESC"]; break;
            case "Name":
            default: sortVal = ["POPULARITY_DESC"];
        }
    }

    // Current filter set to detect changes
    const currentFilters = {
        title,
        genre,
        seasonVal,
        year,
        mappedFormat,
        status,
        sortVal: sortVal.toString() // Convert array to string for comparison
    };

    // Check if filters changed (compare with lastFilters)
    // If filters changed, reset currentPage = 1 and clear old results
    const filtersChanged = JSON.stringify(currentFilters) !== JSON.stringify(lastFilters);
    if (filtersChanged) {
        console.log("filters changed")
        currentPage = 1;
        lastFilters = currentFilters;
    }


    // Show placeholders only if we are not appending
    if (!append) {
        showPlaceholders();
    }



    const query = `
    query($page:Int,$perPage:Int,$search:String,$genre:[String],$season:MediaSeason,$seasonYear:Int,$format:MediaFormat,$status:MediaStatus,$sort:[MediaSort]) {
        Page(page:$page, perPage:$perPage) {
            media(search:$search, genre_in:$genre, season:$season, seasonYear:$seasonYear, format:$format, status:$status, sort:$sort, type:ANIME) {
                id
                title {
                    english
                    romaji
                }
                coverImage {
                    medium
                    extraLarge
                    color
                }
                season
                seasonYear
            }
        }
    }`;

    const variables = {
        page: currentPage,
        perPage: 32,
        search: title || undefined,
        genre: genre || undefined,
        season: seasonVal || undefined,
        seasonYear: year || undefined,
        format: mappedFormat || undefined,
        status: status || undefined,
        sort: sortVal
    };

    Object.keys(variables).forEach(key => {
        if (variables[key] === undefined) delete variables[key];
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
        if (animeList.length > 0) {
            currentPage++;
        }
        displayAnime(animeList, append);
        isFetching = false; // Allow more fetches
        
    })
    .catch(error => {
        console.error('Error fetching anime:', error);
        if (!append) displayAnime([]);
        isFetching = false;
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

function displayAnime(animeList, append = false) {
    const grid = document.getElementById('anime-grid');

    if (!append) {
        // If not appending, clear placeholders
        console.log("clearing grid in display anime");
        grid.innerHTML = ''; 
    } 

    if (animeList.length === 0 && !append) {
        const msg = document.createElement('p');
        msg.style.color = 'white';
        msg.textContent = 'No results found.';
        grid.appendChild(msg);
        return;
    }

    if (animeList.length === 0 && append) {
        // No more data
        // Potentially remove the event listener or set a flag that no more data is available
        window.removeEventListener('scroll', handleInfiniteScroll);
    }

    animeList.forEach(anime => {
        const animeItem = document.createElement('div');
        animeItem.classList.add('anime-item'); // Use the same class as on the landing page

        // Create the image wrapper
        const imageWrapper = document.createElement('div');
        imageWrapper.classList.add('image-wrapper');

        const img = document.createElement('img');
        // Use large if available, fallback to medium
        img.src = anime.coverImage.extraLarge || anime.coverImage.medium;
        img.alt = anime.title.romaji;

        imageWrapper.appendChild(img);
        animeItem.appendChild(imageWrapper);

        const title = document.createElement('h3');
        title.textContent = anime.title.english || anime.title.romaji;

        animeItem.appendChild(title);

        grid.appendChild(animeItem);
    });
}
