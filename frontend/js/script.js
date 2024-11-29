// Helper function to get the current season
function getCurrentSeason() {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return 'SPRING';
    if (month >= 6 && month <= 8) return 'SUMMER';
    if (month >= 9 && month <= 11) return 'FALL';
    return 'WINTER';
}

// Function to fetch and display anime
function fetchAndDisplayAnime(variables, containerId) {
    const query = `
    query ($page: Int, $perPage: Int, $sort: [MediaSort], $season: MediaSeason, $seasonYear: Int) {
        Page(page: $page, perPage: $perPage) {
            media(sort: $sort, type: ANIME, season: $season, seasonYear: $seasonYear) {
                id
                title {
                    romaji
                    english
                    native
                }
                coverImage {
                    large
                }
            }
        }
    }`;

    fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ query, variables })
    })
    .then(response => response.json())
    .then(data => displayAnime(data, containerId))
    .catch(error => console.error('Error fetching data:', error));
}

// Function to display anime data
function displayAnime(data, containerId) {
    console.log("Display Anime Called");
    const animeList = data.data.Page.media;
    const container = document.getElementById(containerId);

    animeList.forEach(anime => {
        const animeItem = document.createElement('div');
        animeItem.classList.add('anime-item');

        const animeImage = document.createElement('img');
        animeImage.src = anime.coverImage.large;
        animeImage.alt = anime.title.english || anime.title.romaji;

        const animeTitle = document.createElement('h3');
        animeTitle.textContent = anime.title.english || anime.title.romaji;

        animeItem.appendChild(animeImage);
        animeItem.appendChild(animeTitle);

        container.appendChild(animeItem);
    });
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


// Fetch and display banners on page load
fetchTopAnimeBanner();
// Fetch data for each category

// Fetch Popular This Season
fetchAndDisplayAnime({
    page: 1,
    perPage: 20,
    sort: ['POPULARITY_DESC'],
    season: getCurrentSeason(),
    seasonYear: new Date().getFullYear()
}, 'popular-this-season');

// Fetch Trending Now
fetchAndDisplayAnime({
    page: 1,
    perPage: 20,
    sort: ['TRENDING_DESC']
}, 'trending-now');

// Fetch Popular All Time
fetchAndDisplayAnime({
    page: 1,
    perPage: 20,
    sort: ['POPULARITY_DESC']
}, 'popular-all-time');

// Fetch Top Rated
fetchAndDisplayAnime({
    page: 1,
    perPage: 20,
    sort: ['SCORE_DESC']
}, 'top-rated');


console.log("Script started - before all functions");

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded Event Fired!"); 
    const menuButton = document.querySelector('.menu-button');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.overlay');

    // Toggle sidebar expand/collapse
    function toggleSidebar() {
        if (sidebar.classList.contains('expanded')) {
            sidebar.classList.remove('expanded');
        } else {
            sidebar.classList.add('expanded');
        }
    }

    // Open overlay when sidebar is expanded
    function showOverlay() {
        overlay.classList.add('active');
    }

    // Close overlay and sidebar
    function closeSidebar() {
        sidebar.classList.remove('expanded');
        overlay.classList.remove('active');
    }

    // Event listener for menu button
    menuButton.addEventListener('click', () => {
        toggleSidebar();
        showOverlay();
    });

    // Event listener for overlay click
    overlay.addEventListener('click', closeSidebar);
    

    

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

// Listen to scroll events
window.addEventListener('scroll', highlightActiveLink);

// Initial highlight
highlightActiveLink();

