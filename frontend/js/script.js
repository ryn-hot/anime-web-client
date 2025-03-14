import { AniListAPI } from "./bottleneck.js";

// Create a singleton instance
const anilistAPI = new AniListAPI();


// Helper function to get the current season
function getCurrentSeason() {
    const month = new Date().getMonth() + 1;
    if (month > 3 && month <= 6) return 'SPRING';
    if (month >= 7 && month <= 9) return 'SUMMER';
    if (month >= 10 && month <= 12) return 'FALL';
    return 'WINTER';
}

// Function to fetch and display anime
function fetchAndDisplayAnime(variables, containerId) {
    const query = `
    query ($page: Int, $perPage: Int, $sort: [MediaSort], $season: MediaSeason, $seasonYear: Int, $genre: [String]) {
        Page(page: $page, perPage: $perPage) {
            media(sort: $sort, genre_in: $genre, season: $season, seasonYear: $seasonYear, type: ANIME) {
                id
                idMal
                title {
                    romaji
                    english
                    native
                }
                coverImage {
                    large
                    extraLarge
                }
                description(asHtml: false)
                bannerImage
                format,
                status,
                episodes,
                duration,
                genres,
                nextAiringEpisode {
                    airingAt
                    timeUntilAiring
                    episode
                }
                trailer {
                    site
                }
            }
        }
    }`;

    // Adjust if genre is present:
    if (variables.genre) {
        variables.genre = [variables.genre];
    }


    anilistAPI.makeRequest({ query, variables })
        .then(data => displayAnime(data, containerId))
        .catch(error => console.error('Error fetching data:', error));
}




// Function to display anime data
function displayAnime(data, containerId) {
    console.log("Display Anime Called");
    const animeList = data.data.Page.media;
    const container = document.getElementById(containerId);

    // Clear container if needed
    container.innerHTML = '';

    animeList.forEach(anime => {
        const animeItem = document.createElement('div');
        animeItem.classList.add('anime-item');

        // recording anime data
        animeItem.dataset.id = anime.id;
        animeItem.dataset.idMal = anime.idMal
        animeItem.dataset.title = anime.title.english || anime.title.romanji;
        animeItem.dataset.description = anime.description;
        animeItem.dataset.idtrailer = anime.trailer?.id || '';
        animeItem.dataset.site = anime.trailer?.site || '';
        
        if (!animeItem.dataset.id || !animeItem.dataset.site || animeItem.dataset.site != 'youtube' ) {
            animeItem.dataset.bannerImage = anime.bannerImage || '';
        }

        animeItem.dataset.status = anime.status;
        animeItem.dataset.format = anime.format;
        animeItem.dataset.episodes = anime.episodes;
        animeItem.dataset.duration = anime.duration;
        animeItem.dataset.genres = anime.genres;
        animeItem.dataset.nextAiringEpisode = anime.nextAiringEpisode?.episode || 0 
        animeItem.dataset.nextAiringEpisodeTimeUntil = anime.nextAiringEpisode?.timeUntilAiring || 0
        // animeItem.dataset.img = anime.coverImage.extraLarge || anime.coverImage.large;


        // Create the image wrapper
        const imageWrapper = document.createElement('div');
        imageWrapper.classList.add('image-wrapper');

        const img = document.createElement('img');
        img.src = anime.coverImage.extraLarge || anime.coverImage.large;
        img.alt = anime.title.english || anime.title.romaji;

        imageWrapper.appendChild(img);
        animeItem.appendChild(imageWrapper);

        const animeTitle = document.createElement('h3');
        animeTitle.textContent = anime.title.english || anime.title.romaji;
        animeItem.appendChild(animeTitle);

        container.appendChild(animeItem);
    });

    addAnimeItemClickHandlers();
}

let genres = [];
let genreData = {};
let genreIndex = 0; // Tracks how many genres we've already used
let isAppendingGenres = false; // To prevent multiple triggers
let isGenreDataReady = false;
const genresPerBatch = 4; // Number of genre containers per load

function fetchGenres() {
    const query = `
        query {
            GenreCollection
        }
    `;
  
    return anilistAPI.makeRequest({ query })
        .then(data => {
            const genres = data.data.GenreCollection;
            return genres;
        })
        .catch(error => {
            console.error('Error fetching genres:', error);
        });
}

// Function to prefetch all genres and their data
function prefetchAllGenres() {
    console.log("prefetchAllGenres Called")
    return fetchGenres().then(g => {
        genres = g;
        return fetchGenreAnimeData(genres);
    }).then(map => {
        genreData = map;
        isGenreDataReady = true;
        // Now all genre data is ready to be appended on scroll
        console.log("All genre data prefetched!");
    });
}


// Fetch all genres data at once and store in memory
async function fetchGenreAnimeData(genreList) {
    const start = performance.now();
    const query = `
    query {
        ${genreList.map((genre, index) => `
        g${index}: Page(page: 1, perPage: 20) {
            media(genre_in: "${genre}", sort: POPULARITY_DESC, type: ANIME) {
                id
                title {
                    romaji
                    english
                    native
                }
                coverImage {
                    extraLarge
                    large
                }
                description(asHtml: false)
                bannerImage
                format,
                status,
                episodes,
                duration,
                genres,
                trailer {
                    site
                }
            }
        }`).join('\n')}
    }`;
    
    
    console.log('fetchGenreAnimeData Called'); // Debug log to see the constructed query

    try {
        const data = await anilistAPI.makeRequest({ query });
        
        const end = performance.now();
        console.log(`api response time taken: ${end - start}`);

        // Transform the response into the same format as before
        const map = {};
        genreList.forEach((genre, index) => {
            map[genre] = data.data[`g${index}`].media;
        });
        
        return map;
    } catch (error) {
        console.error('Error fetching genre data:', error);
        return {};
    }
}

// Create a placeholder function for genre containers
function showGenrePlaceholders(batchSize) {
    const mainContent = document.getElementById('main-content');
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < batchSize; i++) {
        const section = document.createElement('section');
        
        // Add placeholder title
        const titlePlaceholder = document.createElement('h2');
        titlePlaceholder.classList.add('section-title', 'placeholder-title');
        const titleBar = document.createElement('div');
        titleBar.classList.add('placeholder-card');
        titleBar.style.width = '150px';  // Adjust width as needed
        titleBar.style.height = '30px';  // Adjust height as needed
        titlePlaceholder.appendChild(titleBar);
        section.appendChild(titlePlaceholder);

        const scrollContainer = document.createElement('div');
        scrollContainer.classList.add('scroll-container');
        
        // Create placeholder anime list with proper horizontal layout
        const animeListDiv = document.createElement('div');
        animeListDiv.classList.add('anime-list');
        animeListDiv.style.display = 'flex';
        animeListDiv.style.gap = '20px';  // Match your regular gap
        
        // Add placeholder cards
        for (let j = 0; j < 20; j++) {
            const placeholderCard = document.createElement('div');
            placeholderCard.classList.add('placeholder-card');
            placeholderCard.style.width = '150px';  // Match your anime-item width
            placeholderCard.style.height = '200px'; // Match your anime-item height
            placeholderCard.style.flexShrink = '0'; // Prevent shrinking
            animeListDiv.appendChild(placeholderCard);
        }

        scrollContainer.appendChild(animeListDiv);
        section.appendChild(scrollContainer);
        fragment.appendChild(section);

        // Add margin between sections
        section.style.marginBottom = '20px';
    }

    mainContent.appendChild(fragment);
}

// Function to display anime from memory (similar to displayAnime but no fetch)
function displayAnimeListFromMemory(animeList, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    animeList.forEach(anime => {
        const animeItem = document.createElement('div');
        animeItem.classList.add('anime-item');

        //anime data store
        animeItem.dataset.id = anime.id;
        animeItem.dataset.idMal = anime.idMal;
        animeItem.dataset.title = anime.title.english || anime.title.romanji;
        animeItem.dataset.description = anime.description;
        animeItem.dataset.idtrailer = anime.trailer?.id || '';
        animeItem.dataset.site = anime.trailer?.site || '';
        
        if (!animeItem.dataset.id || !animeItem.dataset.site || animeItem.dataset.site != 'youtube' ) {
            animeItem.dataset.bannerImage = anime.bannerImage || '';
        }

        animeItem.dataset.status = anime.status;
        animeItem.dataset.format = anime.format;
        animeItem.dataset.episodes = anime.episodes;
        animeItem.dataset.duration = anime.duration;
        animeItem.dataset.genres = anime.genres;

        const imageWrapper = document.createElement('div');
        imageWrapper.classList.add('image-wrapper');

        const img = document.createElement('img');
        img.src = anime.coverImage.large;
        img.alt = anime.title.english || anime.title.romaji;

        imageWrapper.appendChild(img);
        animeItem.appendChild(imageWrapper);

        const animeTitle = document.createElement('h3');
        animeTitle.textContent = anime.title.english || anime.title.romaji;
        animeItem.appendChild(animeTitle);

        container.appendChild(animeItem);
    });

    addAnimeItemClickHandlers();
}


function appendGenreContainersFromMemory() {
    if (!isGenreDataReady) {
        // Show placeholders if data isn't ready
        console.log("Showing placeholders while waiting for genre data");
        showGenrePlaceholders(genresPerBatch);
        
        // Wait for data to be ready
        const checkInterval = setInterval(() => {
            if (isGenreDataReady) {
                clearInterval(checkInterval);
                // Remove placeholders and show real content
                const mainContent = document.getElementById('main-content');
                const existingPlaceholders = mainContent.querySelectorAll('.placeholder-card');
                existingPlaceholders.forEach(placeholder => {
                    placeholder.closest('section').remove();
                });
                appendRealGenreContainers();
            }
        }, 100); // Check every 100ms
        
        isAppendingGenres = false;
        return;
    }

    // If data is ready, append real containers
    appendRealGenreContainers();
}

// Function to append the next batch of genre containers from memory
function appendRealGenreContainers() {
    const mainContent = document.getElementById('main-content');
    const end = Math.min(genreIndex + genresPerBatch, genres.length);
    const batch = genres.slice(genreIndex, end);

    const fragment = document.createDocumentFragment();
    const containersToPopulate = []; // Store the data for later

    batch.forEach((genre, localIndex) => {
        const section = document.createElement('section');
        const h2 = document.createElement('h2');
        h2.classList.add('section-title');

        const a = document.createElement('a');
        a.href = `search.html?genre=${encodeURIComponent(genre)}&sort=POPULARITY_DESC`;
        a.textContent = genre;
        const i = document.createElement('i');
        i.classList.add('fas', 'fa-chevron-right');

        a.appendChild(i);
        h2.appendChild(a);
        section.appendChild(h2);

        const scrollContainer = document.createElement('div');
        scrollContainer.classList.add('scroll-container');

        const leftButton = document.createElement('button');
        leftButton.classList.add('scroll-button', 'left');
        const leftIcon = document.createElement('i');
        leftIcon.classList.add('fas', 'fa-chevron-left');
        leftButton.appendChild(leftIcon);

        const rightButton = document.createElement('button');
        rightButton.classList.add('scroll-button', 'right');
        const rightIcon = document.createElement('i');
        rightIcon.classList.add('fas', 'fa-chevron-right');
        rightButton.appendChild(rightIcon);

        const containerId = `genre-${genreIndex + localIndex}-${genre.replace(/\s+/g, '-')}`;
        const animeListDiv = document.createElement('div');
        animeListDiv.id = containerId;
        animeListDiv.classList.add('anime-list');

        leftButton.setAttribute('data-container', containerId);
        rightButton.setAttribute('data-container', containerId);

        scrollContainer.appendChild(leftButton);
        scrollContainer.appendChild(animeListDiv);
        scrollContainer.appendChild(rightButton);

        section.appendChild(scrollContainer);
        fragment.appendChild(section);

        // Store the data instead of displaying immediately
        containersToPopulate.push({
            genre,
            containerId,
            animeList: genreData[genre] || []
        });
    });

    mainContent.appendChild(fragment);

    // Now populate the containers after they exist in the DOM
    containersToPopulate.forEach(({ containerId, animeList }) => {
        displayAnimeListFromMemory(animeList, containerId);
    });

    initializeScrollButtons();
    genreIndex = end;
    isAppendingGenres = false;
}

// Event listener for scroll buttons
document.querySelectorAll('.scroll-button').forEach(button => {
    const containerId = button.getAttribute('data-container');
    const container = document.getElementById(containerId);
    const direction = button.classList.contains('left') ? 'left' : 'right';

    // Hover effect for fast auto-scrolling
    button.addEventListener('mouseover', () => {
        const speed = direction === 'left' ? -20 : 20; // Significantly increased speed
        startAutoScroll(container, speed);
    });

    button.addEventListener('mouseout', () => {
        stopAutoScroll();
    });

    // Click event to slide over titles
    button.addEventListener('click', () => {
        stopAutoScroll();
        const scrollAmount = direction === 'left' ? -container.offsetWidth : container.offsetWidth;
        container.scrollBy({
            left: scrollAmount,
            behavior: 'smooth'
        });
    });
});

// Variables for auto-scrolling
let autoScrollInterval;

function startAutoScroll(container, speed) {
    stopAutoScroll(); // Ensure no previous interval is running
    autoScrollInterval = setInterval(() => {
        container.scrollBy({
            left: speed,
            behavior: 'auto'
        });
    }, 10); // Decreased interval for smoother scrolling
}

function stopAutoScroll() {
    clearInterval(autoScrollInterval);
}

// Increase passive scrolling speed
document.querySelectorAll('.anime-list').forEach(container => {
    container.addEventListener('wheel', (event) => {
        event.preventDefault();
        let delta = event.deltaY;

        // Normalize deltaY according to deltaMode
        if (event.deltaMode === 1) {
            // The deltaY is in lines, convert to pixels
            delta *= 16; // Approximate line height in pixels
        } else if (event.deltaMode === 2) {
            // The deltaY is in pages, convert to pixels
            delta *= container.clientHeight;
        }

        // Apply a high multiplier to increase scroll speed
        const scrollAmount = delta * 1; // Adjust multiplier as needed

        container.scrollLeft += scrollAmount;
    });
}); 

//banner funcs
// Function to fetch the top anime banner
function fetchTopAnimeBanner() {
    const query = `
    query ($page: Int, $perPage: Int, $sort: [MediaSort], $season: MediaSeason, $seasonYear: Int) {
        Page(page: $page, perPage: $perPage) {
            media(sort: $sort, type: ANIME, season: $season, seasonYear: $seasonYear) {
                id
                idMal
                title {
                    romaji
                    english
                }
                description
                bannerImage
                genres
                format
                episodes
                season
                seasonYear
                status,
                duration,
                nextAiringEpisode {
                    airingAt
                    timeUntilAiring
                    episode
                }
            }
        }
    }`;

    const variables = {
        page: 1,
        perPage: 4, // Fetch only the top anime
        sort: ['POPULARITY_DESC'],
        season: getCurrentSeason(),
        seasonYear: new Date().getFullYear()
    };

    anilistAPI.makeRequest({ query, variables })
       .then(data => {
           createBannerCarousel(data.data.Page.media);
       })
       .catch(error => console.error('Error fetching banner data:', error));
}


// Function to create banner carousel
function createBannerCarousel(animeList) {
    const bannerContainer = document.getElementById('banner');

    // Clear any existing banners
    bannerContainer.innerHTML = '';

    // Create a wrapper for all banners
    const bannerWrapper = document.createElement('div');
    bannerWrapper.classList.add('banner-wrapper');
    bannerContainer.appendChild(bannerWrapper);

    // Create progress bar container
    const progressContainer = document.createElement('div');
    progressContainer.classList.add('progress-container');

    // Generate banners for each anime
    animeList.forEach((anime, index) => {
        const bannerSlide = document.createElement('div');
        bannerSlide.classList.add('banner-slide');
    
        bannerSlide.dataset.title = anime.title.english || anime.title.romaji;
        bannerSlide.dataset.id = anime.id;
        bannerSlide.dataset.idMal = anime.idMal;
        bannerSlide.dataset.episodes = anime.episodes;
        bannerSlide.dataset.status = anime.status;
        bannerSlide.dataset.format = anime.format;
        bannerSlide.dataset.duration = anime.duration;
        // Add additional data attributes if available
        if (anime.nextAiringEpisode) {
            bannerSlide.dataset.nextAiringEpisode = anime.nextAiringEpisode.episode;
        }

        // Incorporate the gradient into the background image
        bannerSlide.style.backgroundImage = `linear-gradient(to right, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0) 80%), url(${anime.bannerImage})`;
        bannerSlide.style.backgroundSize = 'cover';
        bannerSlide.style.backgroundPosition = 'center';

        const bannerContent = document.createElement('div');
        bannerContent.classList.add('banner-content');

        // Add title
        const title = document.createElement('h1');
        title.classList.add('banner-title');
        title.textContent = anime.title.english || anime.title.romaji;
        bannerContent.appendChild(title);

        // Add info
        const info = document.createElement('p');
        info.classList.add('banner-info');
        const animeInfo = [];
        if (anime.format) animeInfo.push(anime.format);
        if (anime.episodes) animeInfo.push(`${anime.episodes} Episodes`);
        if (anime.season && anime.seasonYear) animeInfo.push(`${anime.season} ${anime.seasonYear}`);
        info.textContent = animeInfo.join(' · ');
        bannerContent.appendChild(info);

        // Add description
        const description = document.createElement('p');
        description.classList.add('banner-description');
        description.textContent = anime.description
            ? anime.description.replace(/<[^>]*>?/gm, '').slice(0, 200) + '...'
            : 'No description available.';
        bannerContent.appendChild(description);

        // Add genres
        const genresInfo = document.createElement('p');
        genresInfo.classList.add('banner-genres');
        genresInfo.textContent = anime.genres.join(' · ');
        bannerContent.appendChild(genresInfo);

        // Add "Watch Now" button
        const watchNowButton = document.createElement('button');
        watchNowButton.classList.add('banner-button');
        watchNowButton.textContent = 'Watch Now';
        bannerContent.appendChild(watchNowButton);
        

        watchNowButton.addEventListener('click', async function() {
            // Get the parent banner slide element to access its data
            const bannerSlide = this.closest('.banner-slide');
            if (!bannerSlide) return;
            
            const animeId = bannerSlide.dataset.id;
            
            // Store minimal initial data
            const initialData = {
                id: bannerSlide.dataset.id,
                title: bannerSlide.dataset.title || '',
                status: bannerSlide.dataset.status || '',
                format: bannerSlide.dataset.format || '',
                isLoading: true // Flag to indicate data is still loading
            };
            
            
            // Store anime data and redirect
            sessionStorage.setItem('currentAnimeData', JSON.stringify(initialData));
            
            // Redirect immediately to watch page
            window.location.href = `watch.html?id=${initialData.id}`;
        });


        bannerSlide.appendChild(bannerContent);
        bannerWrapper.appendChild(bannerSlide);

        // Create individual progress bars
        const progressBar = document.createElement('div');
        progressBar.classList.add('progress-bar');
        if (index === 0) progressBar.classList.add('active');
        progressContainer.appendChild(progressBar);

        // **Add event listener to the progress bar**
        progressBar.addEventListener('click', () => {
            // Call a function to handle the banner change
            goToSlide(index);
        });
        
    });

    // After the forEach loop
    bannerContainer.appendChild(progressContainer);
    // Initialize auto-scrolling
    initAutoScrolling(bannerWrapper);
}

// Function to initialize auto-scrolling
function initAutoScrolling(wrapper) {
    const slides = wrapper.querySelectorAll('.banner-slide');
    const progressBars = document.querySelectorAll('.progress-bar');
    let currentIndex = 0;
    const intervalTime = 10000; // Duration for each slide (5 seconds)
    let interval;

    // Function to start the progress bar animation
    function startProgressBar(index) {
        const activeBar = progressBars[index];
        const progressFill = document.createElement('div');
        progressFill.classList.add('progress-fill');
        activeBar.appendChild(progressFill);

        // Start the width animation
        setTimeout(() => {
            progressFill.style.width = '100%';
            progressFill.style.transition = `width ${intervalTime}ms linear`;
        }, 50);
    }

    // Function to reset the progress bar
    function resetProgressBar(index) {
        const activeBar = progressBars[index];
        const progressFill = activeBar.querySelector('.progress-fill');
        if (progressFill) {
            progressFill.remove();
        }
    }

    // Function to show the next slide
    function showSlide(index) {
        resetProgressBar(currentIndex);
        slides[currentIndex].classList.remove('active');
        progressBars[currentIndex].classList.remove('active');

        currentIndex = index; // Cycle back to the first slide

        slides[currentIndex].classList.add('active');
        progressBars[currentIndex].classList.add('active');

        startProgressBar(currentIndex);
    }

    // Function to show the next slide
    function showNextSlide() {
        let nextIndex = (currentIndex + 1) % slides.length;
        showSlide(nextIndex);
    }

    // Function to reset and restart the interval
    function resetInterval() {
        clearInterval(interval);
        interval = setInterval(showNextSlide, intervalTime);
    }

    // Add click event listeners to progress bars
    progressBars.forEach((bar, index) => {
        bar.addEventListener('click', () => {
            showSlide(index);
            resetInterval();
        });
    });

    // Set initial active slide and progress bar
    slides[currentIndex].classList.add('active');
    progressBars[currentIndex].classList.add('active');
    startProgressBar(currentIndex);

    // Start auto-scrolling
    interval = setInterval(showNextSlide, intervalTime); // Change slide every 5 seconds
}



// Fetch data for each category

// Sequential category fetches
async function fetchAllCategories() {

    try {
        // Fetch Popular This Season
        await fetchAndDisplayAnime({
            page: 1,
            perPage: 20,
            sort: ['POPULARITY_DESC'],
            season: getCurrentSeason(),
            seasonYear: new Date().getFullYear()
        }, 'popular-this-season');

        // Fetch Trending Now
        await fetchAndDisplayAnime({
            page: 1,
            perPage: 20,
            sort: ['TRENDING_DESC']
        }, 'trending-now');

        // Fetch Popular All Time
        await fetchAndDisplayAnime({
            page: 1,
            perPage: 20,
            sort: ['POPULARITY_DESC']
        }, 'popular-all-time');

        // Fetch Top Rated
        await fetchAndDisplayAnime({
            page: 1,
            perPage: 20,
            sort: ['SCORE_DESC']
        }, 'top-rated');
    }
    catch (error) {
        console.error('Error fetching categories:', error);
    }
    
}



console.log("Script started - before all functions");

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded Event Fired!"); 
    const menuButton = document.querySelector('.menu-button');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.overlay');
    initializeScrollButtons();

    // Fetch and display banners on page load
    fetchTopAnimeBanner();

    fetchAllCategories();
    
    // Now we can listen for scroll events
    window.addEventListener('scroll', () => {
        highlightActiveLink();

        const scrollTop = window.scrollY;
        const windowHeight = window.innerHeight;
        const docHeight = document.documentElement.offsetHeight;
        const scrolledRatio = (scrollTop + windowHeight) / docHeight;

        // If scrolled more than 90% and not currently appending genres
        if (scrolledRatio > 0.9 && !isAppendingGenres) {
            // Add genre containers if we still have genres left
            if (genreIndex < genres.length) {
                isAppendingGenres = true;
                appendGenreContainersFromMemory();
            }
        }
    });

    prefetchAllGenres()

    const currentYear = new Date().getFullYear();
    const currentSeason = getCurrentSeason(); 

    const popularThisSeasonLink = document.getElementById('popular-this-season-link');
    if (popularThisSeasonLink) {
        popularThisSeasonLink.href = `search.html?season=${currentSeason}&seasonYear=${currentYear}&sort=POPULARITY_DESC`;
    }


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

    // Event listener for menu button
    menuButton.addEventListener('click', () => {
        toggleSidebar();
    });
    

    // Event listener for overlay click
    overlay.addEventListener('click', closeSidebar);

    const searchButton = document.getElementById('search-button');
    if (searchButton) {
        searchButton.addEventListener('click', () => {
            const searchSelect = document.querySelector('.search-input[name="keyword"]');
            const searchValue = searchSelect ? searchSelect.value.trim() : '';
            window.location.href = `search.html${searchValue ? `?search=${encodeURIComponent(searchValue)}` : ''}`;
        });
    }
    
    const searchForm = document.querySelector('.search-content form');
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Prevent the default form submission
            const searchSelect = document.querySelector('.search-input[name="keyword"]');
            const searchValue = searchSelect ? searchSelect.value.trim() : '';
            window.location.href = `search.html${searchValue ? `?search=${encodeURIComponent(searchValue)}` : ''}`;
        });
    }


    const filterButton = document.getElementById('filter-button');
    if (filterButton) {
        filterButton.addEventListener('click', () => {
            const searchSelect = document.querySelector('.search-input[name="keyword"]');
            const searchValue = searchSelect ? searchSelect.value.trim() : '';
            window.location.href = `search.html${searchValue ? `?search=${encodeURIComponent(searchValue)}` : ''}`;
        });
    }

    // Event listener for Escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeSidebar();
        }
    });

});




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




// Re-initialize scroll buttons after dynamically adding them
function initializeScrollButtons() {
    document.querySelectorAll('.scroll-button').forEach(button => {
        const containerId = button.getAttribute('data-container');
        const container = document.getElementById(containerId);
        const direction = button.classList.contains('left') ? 'left' : 'right';

        button.removeEventListener('mouseover', handleMouseOverScroll); // Remove any old listeners first
        button.removeEventListener('mouseout', handleMouseOutScroll);
        button.removeEventListener('click', handleClickScroll);

        function handleMouseOverScroll() {
            const speed = direction === 'left' ? -20 : 20;
            startAutoScroll(container, speed);
        }

        function handleMouseOutScroll() {
            stopAutoScroll();
        }

        function handleClickScroll() {
            stopAutoScroll();
            const scrollAmount = direction === 'left' ? -container.offsetWidth : container.offsetWidth;
            container.scrollBy({
                left: scrollAmount,
                behavior: 'smooth'
            });
        }

        button.addEventListener('mouseover', handleMouseOverScroll);
        button.addEventListener('mouseout', handleMouseOutScroll);
        button.addEventListener('click', handleClickScroll);
    });
}

function addAnimeItemClickHandlers() {
    document.querySelectorAll('.anime-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Store minimal initial data
            const initialData = {
                id: this.dataset.id,
                title: this.dataset.title || '',
                status: this.dataset.status || '',
                format: this.dataset.format || '',
                isLoading: true // Flag to indicate data is still loading
            };
            
            // Store the minimal data in sessionStorage
            sessionStorage.setItem('currentAnimeData', JSON.stringify(initialData));
            
            // Redirect immediately to watch page
            window.location.href = `watch.html?id=${initialData.id}`;
        });
    });
}

// Function to add click handlers to anime items

// Initial highlight
highlightActiveLink();

