import { AniListAPI } from "./bottleneck.js";

const anilistAPI = new AniListAPI();

function getAnimeData() {
    const animeDataStr = sessionStorage.getItem('currentAnimeData');
    if (animeDataStr) {
        try {
            return JSON.parse(animeDataStr);
        } catch (e) {
            console.error('Error parsing anime data:', e);
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {

    const animeData = getAnimeData();
    
    // If data is flagged as loading or incomplete, show skeleton UI
    if (!animeData || animeData.isLoading) {
        showSkeletonUI();
        
        // Get the ID from URL params
        const urlParams = new URLSearchParams(window.location.search);
        const animeId = urlParams.get('id');
        
        if (animeId) {
            // Fetch complete data in the background
            await fetchCompleteAnimeData(animeId);
        }
    }

    // Sidebar functionality
    const menuButton = document.querySelector('.menu-button');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.overlay');

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

    // Search functionality
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


    function updateUIWithCompleteData(animeData) {
        function updateEpisodeInfo(episodeNumber) {
            const animeData = getAnimeData();
            const animeTitle = animeData?.title || 'Anime';
            
            const watchingTitleEl = document.querySelector('.watching-title');
            if (watchingTitleEl) {
                watchingTitleEl.textContent = `You are watching: ${animeTitle} Episode ${episodeNumber}`;
            }

            // You could also update other elements like episode title, etc.
            const episodeData = getEpisodeData(episodeNumber);
            const videoTitleEl = document.querySelector('.video-title');
            if (videoTitleEl && episodeData.title) {
                videoTitleEl.textContent = `You are watching: ${episodeData.title}`;
            }
        }


        // Helper function to get episode data
        function getEpisodeData(episodeNumber) {
            if (animeData.episodeData && Array.isArray(animeData.episodeData)) {
                // Adjust index since episodeData is likely 0-indexed but our display is 1-indexed
                const episodeIndex = episodeNumber - 1;
                if (episodeIndex >= 0 && episodeIndex < animeData.episodeData.length) {
                    return animeData.episodeData[episodeIndex];
                }
            }
            // Return fallback data if episode not found
            return {
                title: `Episode ${episodeNumber}`,
                overview: 'No description available.',
                img: '/api/placeholder/213/120',
                duration: null
            };
        }
        
        // Update video info section
        updateEpisodeInfo(1); // Start with episode 1
        
        // Create UI sections with complete data
        createVideoInfoSection();
        createVideoControlBar();
        createRelatedSeriesSection();
        createEpisodesPanel();
        
        // Remove any skeleton classes
        document.querySelectorAll('.skeleton-loading').forEach(el => {
            el.classList.remove('skeleton-loading');
        });
    }

    async function fetchCompleteAnimeData(animeId) {
        try {
            // Fetch data from API
            const mappingsResponse = await fetch('https://api.ani.zip/mappings?anilist_id=' + animeId);
            const mappingsjson = await mappingsResponse.json();
    
            const episodeCount = mappingsjson?.episodeCount;
            
            
            // console.log(relations.length);
            // Process episode metadata
            const episodeMetadata = [];
            if (episodeCount) {
                const episodes = mappingsjson?.episodes || -1;
                if (episodes !== -1) {
                    for (let i = 1; i <= episodeCount; i++) {
                        const epKey = i.toString();
                        if (episodes[epKey]) {
                            episodeMetadata.push({
                                episodeNumber: i,
                                overview: episodes[epKey].overview,
                                img: episodes[epKey].image,
                                title: episodes[epKey].title?.en,
                                duration: episodes[epKey].duration
                            });
                        }
                    }
                }
            }
            
            const relationalDataFetch = await alIdFetch(animeId);
            const relationalData = relationalDataFetch?.data?.Media || {};

            // Calculate episodes
            let anilistEpisodes;
            if (relationalData.status === 'RELEASING' && relationalData.nextAiringEpisode) {
                if (episodeCount >= relationalData.nextAiringEpisode.episode) {
                    anilistEpisodes = relationalData.nextAiringEpisode.episode - 1;
                } else {
                    anilistEpisodes = episodeCount;
                }
            } else {
                if (relationalData.episodes !== undefined) {
                    anilistEpisodes = relationalData.episodes;
                } else {
                    anilistEpisodes = episodeCount;
                }
            }
            
            // Fetch relational data
            
            const relations = seasonsResolver(relationalData?.relations?.edges || [], relationalData?.format || '', relationalData.coverImage.extraLarge || '/api/placeholder/160/90', anilistEpisodes, relationalData.title?.english || relationalData.title?.romaji);
            

            // Prepare complete anime data
            const completeAnimeData = {
                id: animeId,
                idMal: relationalData.idMal,
                title: relationalData.title?.english || relationalData.title?.romaji,
                description: relationalData.description,
                status: relationalData.status,
                format: relationalData.format,
                episodes: anilistEpisodes,
                duration: relationalData.duration || 0,
                genres: relationalData.genres || [],
                relations: relations,
                episodeData: episodeMetadata,
                isLoading: false // Mark as loaded
            };
            
            // Store complete data
            sessionStorage.setItem('currentAnimeData', JSON.stringify(completeAnimeData));
            
            // Update UI with complete data
            updateUIWithCompleteData(completeAnimeData);
        } catch (error) {
            console.error('Error fetching complete anime data:', error);
            
            // Update UI anyway, with an error state if needed
            const currentData = getAnimeData();
            if (currentData) {
                currentData.isLoading = false;
                currentData.loadError = true;
                sessionStorage.setItem('currentAnimeData', JSON.stringify(currentData));
            }
        }
    }

    function showSkeletonUI() {
        // Create skeleton for video player
        const videoContainer = document.querySelector('.video-container');
        if (videoContainer) {
            videoContainer.innerHTML = `
                <div class="video-placeholder skeleton-loading">
                    <div class="skeleton-player"></div>
                </div>
            `;  
        }
        
        // Create skeleton for video info
        const videoInfo = document.querySelector('.video-info');
        if (videoInfo) {
            videoInfo.innerHTML = `
                <div class="episode-info skeleton-loading">
                    <div class="title-container">
                        <div class="skeleton-text-large"></div>
                        <div class="skeleton-text-small"></div>
                    </div>
                </div>
                <div class="audio-options skeleton-loading">
                    <div class="skeleton-button"></div>
                    <div class="skeleton-button"></div>
                </div>
            `;
        }
        
        // Create skeleton for episodes panel
        const episodesPanel = document.querySelector('.episodes-panel');
        if (episodesPanel) {
            const episodesGrid = episodesPanel.querySelector('.episodes-grid');
            if (episodesGrid) {
                episodesGrid.innerHTML = '';
                
                // Create skeleton episode buttons or cards based on view mode
                const viewMode = episodesPanel.classList.contains('card-mode') ? 'card' : 'grid';
                
                if (viewMode === 'grid') {
                    // Create 24 skeleton grid buttons
                    for (let i = 0; i < 24; i++) {
                        const skeletonButton = document.createElement('div');
                        skeletonButton.className = 'episode-button skeleton-loading';
                        episodesGrid.appendChild(skeletonButton);
                    }
                } else {
                    // Create 6 skeleton episode cards
                    for (let i = 0; i < 6; i++) {
                        const skeletonCard = document.createElement('div');
                        skeletonCard.className = 'episode-card skeleton-loading';
                        
                        const thumbnail = document.createElement('div');
                        thumbnail.className = 'skeleton-thumbnail';
                        
                        const content = document.createElement('div');
                        content.className = 'skeleton-content';
                        content.innerHTML = `
                            <div class="skeleton-text-large"></div>
                            <div class="skeleton-text-small"></div>
                            <div class="skeleton-text-small"></div>
                        `;
                        
                        skeletonCard.appendChild(thumbnail);
                        skeletonCard.appendChild(content);
                        episodesGrid.appendChild(skeletonCard);
                    }
                }
            }
        }
        
        // Create skeleton for related series section
        const seasonsSection = document.querySelector('.seasons-section');
        if (seasonsSection) {
            const seasonsContainer = seasonsSection.querySelector('.seasons-container');
            if (seasonsContainer) {
                seasonsContainer.innerHTML = '';
                
                // Create 4 skeleton season cards
                for (let i = 0; i < 4; i++) {
                    const skeletonCard = document.createElement('div');
                    skeletonCard.className = 'season-card skeleton-loading';
                    seasonsContainer.appendChild(skeletonCard);
                }
            }
        }
    }

    function alIdFetch(alID) {
        const query = `
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            episodes
            status
            title {
              romaji
              english
              native
            }
            coverImage {
                large
                extraLarge
            }
            nextAiringEpisode {
                airingAt
                timeUntilAiring
                episode
              }
            format
            relations {
                    edges {
                        node {
                            type
                            id
                            title {
                                english
                                romaji
                            }
                            format
                            episodes
                            coverImage {
                                large
                                extraLarge
                            }
                        }
                    relationType
                }
            }
          }
        }
        `;
    
        return anilistAPI.makeRequest({ query, variables: { id: parseInt(alID) }})
            .catch(error => console.error('Error fetching data:', error));
      
    }
    
    function seasonsResolver(edges, format, img, episodes, title) {

        const filter = edges.filter(edge => edge.node.format === format && (edge.relationType === "PREQUEL" || edge.relationType === "SEQUEL" ));
        let relations = []
        for (const edge of filter) {
            relations.push({id: edge.node.id, relationType: edge.relationType, episodeNum: edge.node.episodes, img: edge.node.coverImage.extraLarge, title: edge.node.title.english || edge.node.title.romaji})
        }
        
        relations.sort((a, b) => getOrder(a) - getOrder(b));
        console.log(relations);
        const middleIndex = Math.floor(relations.length / 2);
        const newElement = {relationType: "SOURCE", episodeNum: episodes, img: img, title: title };

        if (relations.length > 1) {
            relations.splice(middleIndex, 0, newElement);
        } else if (relations.length > 0 && relations[0].relationType === "PREQUEL") {
            relations.push(newElement);
        } else if (relations.length > 0 && relations[0].relationType === "PREQUEL") {
            relations.unshift(newElement);
        }
        

        console.log(relations)
        return relations
        
        function getOrder(item) {
            if (item.relationType === "PREQUEL") return -1;
            if (item.relationType === "SEQUEL") return 1;
            return 0;
        }
    }

    // Dynamically create video info section
    // Function to create video info section
    // Function to create video info section
    // Function to create video info section
    // Function to create video info section
    function createVideoInfoSection() {
        const videoPanel = document.querySelector('.video-panel') || document.getElementById('main-content-watch');
        if (!videoPanel) return;
        
        // Check if video-info already exists
        let videoInfo = document.querySelector('.video-info');
        if (videoInfo) {
            videoInfo.innerHTML = '';
        } else {
            videoInfo = document.createElement('div');
            videoInfo.className = 'video-info';
            const videoContainer = document.querySelector('.video-container');
            if (videoContainer && videoContainer.parentNode) {
                videoContainer.parentNode.insertBefore(videoInfo, videoContainer.nextSibling);
            } else {
                videoPanel.appendChild(videoInfo);
            }
        }
        
        // Left side: Episode info
        const episodeInfo = document.createElement('div');
        episodeInfo.className = 'episode-info';
        
        const titleContainer = document.createElement('div');
        titleContainer.className = 'title-container';
        
        const watchingText = document.createElement('h2');
        watchingText.className = 'watching-title';
        const animeData = getAnimeData();
        const animeTitle = animeData?.title || '';
        watchingText.textContent = `You are watching: ${animeTitle} Episode 1`;
        
        const serverMessage = document.createElement('p');
        serverMessage.className = 'server-message';
        serverMessage.textContent = "If the current server is not working, please try switching to other servers.";
        
        titleContainer.appendChild(watchingText);
        titleContainer.appendChild(serverMessage);
        episodeInfo.appendChild(titleContainer);
        
        // Right side: Audio options
        const audioOptions = document.createElement('div');
        audioOptions.className = 'audio-options';
        
        // Create SUB button
        const subButton = document.createElement('button');
        subButton.className = 'source-button active';
        subButton.dataset.type = 'sub';
        subButton.innerHTML = '<i class="fas fa-closed-captioning"></i> SUB';
        
        // Create DUB button
        const dubButton = document.createElement('button');
        dubButton.className = 'source-button';
        dubButton.dataset.type = 'dub';
        dubButton.innerHTML = '<i class="fas fa-microphone"></i> DUB';
        
        // Add buttons to audio options
        audioOptions.appendChild(subButton);
        audioOptions.appendChild(dubButton);
        
        // Append to video info
        videoInfo.appendChild(episodeInfo);
        videoInfo.appendChild(audioOptions);
        
        // Add CSS for the updated design
        addVideoInfoStyles();
        
        // Initialize event listeners for source buttons
        initSourceButtons();
    }

    // Function to add CSS for the updated video info section
    // Function to add CSS for the updated video info section
    // Function to add CSS for the updated video info section
    function addVideoInfoStyles() {
        // First, let's remove any previous style element we've added to avoid duplicates
        const existingStyle = document.getElementById('video-info-styles');
        if (existingStyle) {
            existingStyle.remove();
        }
        
        const style = document.createElement('style');
        style.id = 'video-info-styles';
        
        // Important: Use !important tags to override any conflicting CSS
        style.textContent = `
            .video-info {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                background-color: #1a1a1a !important;
                padding: 15px 20px !important;
                color: #fff !important;
                box-shadow: none !important;
                margin: 0 !important;
            }
            
            .episode-info {
                flex: 1 !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            
            .title-container {
                display: flex !important;
                flex-direction: column !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            
            .watching-title {
                font-size: 18px !important;
                margin: 0 0 10px 0 !important; /* Increased bottom margin for spacing */
                padding: 0 !important;
                font-weight: 500 !important;
                color: #fff !important;
                line-height: 1.2 !important;
            }
            
            .server-message {
                font-size: 14px !important;
                color: #888 !important;
                margin: 0 !important;
                padding: 0 !important;
                line-height: 1.4 !important;
                font-weight: normal !important;
                max-width: 600px !important;
                text-align: left !important;
            }
            
            .audio-options {
                display: flex !important;
                align-items: center !important;
                gap: 10px !important;
                flex-shrink: 0 !important;
            }
            
            .source-button {
                padding: 8px 20px !important;
                border-radius: 25px !important;
                border: none !important;
                background-color: #333 !important;
                color: #fff !important;
                cursor: pointer !important;
                transition: all 0.2s !important;
                font-size: 14px !important;
                display: flex !important;
                align-items: center !important;
                gap: 5px !important;
            }
            
            .source-button i {
                font-size: 16px !important;
            }
            
            .source-button.active {
                background-color: #e74c3c !important;
            }
            
            .source-button:hover:not(.active) {
                background-color: #444 !important;
            }
        `;
        
        document.head.appendChild(style);
    }

    // Function to initialize source button events
    function initSourceButtons() {
        const sourceButtons = document.querySelectorAll('.source-button');
        
        sourceButtons.forEach(button => {
            button.addEventListener('click', function() {
                const type = this.dataset.type;
                
                // Remove active class from all buttons
                document.querySelectorAll('.source-button').forEach(btn => {
                    btn.classList.remove('active');
                });
                
                // Add active class to clicked button
                this.classList.add('active');
                
                // Show notification
                const videoContainer = document.querySelector('.video-container');
                if (videoContainer) {
                    const notification = document.createElement('div');
                    notification.className = 'source-change-notification';
                    notification.textContent = `Loading ${type === 'sub' ? 'Subtitled' : 'Dubbed'} version`;
                    
                    videoContainer.appendChild(notification);
                    
                    // Remove notification after 3 seconds
                    setTimeout(() => {
                        notification.classList.add('fade-out');
                        setTimeout(() => notification.remove(), 500);
                    }, 3000);
                }
                
                console.log(`Switched to ${type.toUpperCase()}`);
            });
        });
    }
    // Function to initialize server button events
    
    
    // Add CSS for notification
    function addNotificationStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .source-change-notification {
                position: absolute;
                top: 20px;
                right: 20px;
                background-color: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 10px 15px;
                border-radius: 5px;
                z-index: 10;
                animation: fadeIn 0.3s;
            }
            
            .source-change-notification.fade-out {
                animation: fadeOut 0.5s;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            @keyframes fadeOut {
                from { opacity: 1; transform: translateY(0); }
                to { opacity: 0; transform: translateY(-10px); }
            }
        `;
        document.head.appendChild(style);
    }


    // Add this function to your watch.js file

    // Function to create seasons section
    // Function to create related series section (formerly seasons section)
    function createRelatedSeriesSection() {
        const animeData = getAnimeData();
        const mainContent = document.getElementById('main-content-watch');
        
        // If main content doesn't exist, we can't create the section
        if (!mainContent) return;
        
        // Get relations array from animeData
        const relations = animeData.relations || [];
        
        console.log('Relations: ', relations.length);
        // Only create the section if there are relations
        if (relations.length === 0) return;
        
        // Check if section already exists
        let relatedSection = document.querySelector('.seasons-section');
        if (relatedSection) {
            // Clear existing content if it exists
            relatedSection.innerHTML = '';
        } else {
            // Create new element if it doesn't exist
            relatedSection = document.createElement('div');
            relatedSection.className = 'seasons-section';
            
            // Find the appropriate place to insert the related section
            const videoPanel = document.querySelector('.video-panel');
            const episodesPanel = document.querySelector('.episodes-panel');
            
            if (videoPanel) {
                // Insert after video panel but before episodes panel
                if (episodesPanel && episodesPanel.parentNode === mainContent) {
                    mainContent.insertBefore(relatedSection, episodesPanel);
                } else {
                    // Append to video panel if episodes panel not found or not in main content
                    videoPanel.appendChild(relatedSection);
                }
            } else {
                // If no video panel, insert at beginning of main content
                if (mainContent.firstChild) {
                    mainContent.insertBefore(relatedSection, mainContent.firstChild);
                } else {
                    mainContent.appendChild(relatedSection);
                }
            }
        }
        
        // Create header with navigation
        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'section-header';
        
        const sectionTitle = document.createElement('h2');
        sectionTitle.className = 'section-title';
        sectionTitle.textContent = 'Related Series';
        
        const navigationControls = document.createElement('div');
        navigationControls.className = 'navigation-controls';
        
        const prevButton = document.createElement('button');
        prevButton.className = 'nav-button prev';
        prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
        
        const nextButton = document.createElement('button');
        nextButton.className = 'nav-button next';
        nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
        
        navigationControls.appendChild(prevButton);
        navigationControls.appendChild(nextButton);
        
        sectionHeader.appendChild(sectionTitle);
        sectionHeader.appendChild(navigationControls);
        
        // Create container
        const relatedContainer = document.createElement('div');
        relatedContainer.className = 'seasons-container';
        
        // Add relation cards
        relations.forEach(relation => {
            const relationCard = document.createElement('div');
            relationCard.className = 'season-card';
            relationCard.dataset.relationType = relation.relationType;
            
            // Add background image
            const bgImage = document.createElement('div');
            bgImage.className = 'season-bg';
            bgImage.style.backgroundImage = `url(${relation.img || '/api/placeholder/160/90'})`;
            
            // Add relation info
            const relationInfo = document.createElement('div');
            relationInfo.className = 'season-info';
            
            const relationTitle = document.createElement('h3');
            relationTitle.className = 'season-title';
            
            // Format the title based on relation type
            if (relation.relationType === 'PREQUEL') {
                relationTitle.textContent = relation.title || 'Prequel';
            
            } else if (relation.relationType === 'SEQUEL') {
                relationTitle.textContent = relation.title || 'Sequel';

            } else if (relation.relationType === 'SOURCE') {

                relationTitle.textContent = relation.title || 'Source';
            }
            
            const episodeCount = document.createElement('span');
            episodeCount.className = 'episode-count';
            episodeCount.textContent = `${relation.episodeNum || '?'} Eps`;
            
            relationInfo.appendChild(relationTitle);
            relationInfo.appendChild(episodeCount);
            
            relationCard.appendChild(bgImage);
            relationCard.appendChild(relationInfo);
            
            relatedContainer.appendChild(relationCard);
            
            // Add click event
            relationCard.addEventListener('click', () => {
                console.log(`Switching to ${relation.relationType}`);
                
                // Mark this relation as active
                document.querySelectorAll('.season-card').forEach(card => {
                    card.classList.remove('active');
                });
                relationCard.classList.add('active');
                
                 // Don't navigate if this is a SOURCE type or if it's already the active card
                if (relation.relationType === 'SOURCE' && relationCard.classList.contains('active')) {
                    console.log('Already on source anime');
                    return;
                }

                if (!relation.id) {
                    console.error('No anime ID available for related series');
                    return;
                }

                try {
                    // Store minimal initial data
                    const initialData = {
                        id: relation.id,
                        title: relation.title || '',
                        status: relation.status || '',
                        format: relation.format || '',
                        isLoading: true // Flag to indicate data is still loading
                    };
                    
                    // Store the minimal data in sessionStorage
                    sessionStorage.setItem('currentAnimeData', JSON.stringify(initialData));
                    
                    // Navigate to the watch page with the related anime ID
                    window.location.href = `watch.html?id=${relation.id}`;
                } catch (error) {
                    console.error('Error navigating to related series:', error);
                }
                // Here you would navigate to the related anime
                // For now, just log it
                console.log(`Navigate to related series`);
            });
        });
        
        // Append all to section
        relatedSection.appendChild(sectionHeader);
        relatedSection.appendChild(relatedContainer);
        
        // Set up navigation
        let scrollPosition = 0;
        const cardWidth = 220; // Approximate width including margins
        
        prevButton.addEventListener('click', () => {
            scrollPosition = Math.max(scrollPosition - cardWidth, 0);
            relatedContainer.scrollTo({
                left: scrollPosition,
                behavior: 'smooth'
            });
        });
        
        nextButton.addEventListener('click', () => {
            scrollPosition = Math.min(
                scrollPosition + cardWidth,
                relatedContainer.scrollWidth - relatedContainer.clientWidth
            );
            relatedContainer.scrollTo({
                left: scrollPosition,
                behavior: 'smooth'
            });
        });
        
        // Make first relation card active by default
        const sourceCard = relatedContainer.querySelector('.season-card[data-relation-type="SOURCE"]');
    
        if (sourceCard) {
            // If SOURCE card exists, make it active
            sourceCard.classList.add('active');
        } else {
            // Otherwise fall back to selecting the first card
            relatedContainer.querySelector('.season-card').classList.add('active');
        }
    }

    // Function to create episodes panel
    function createEpisodesPanel() {
        // Find the main content container
        const animeData = getAnimeData();
        const mainContent = document.getElementById('main-content-watch');
        if (!mainContent) return;
        
        // Get total episodes
        const totalEpisodes = animeData.episodes || 0;
        if (totalEpisodes <= 0) return; // Don't create panel if no episodes
        
        // View mode state
        let viewMode = 'card'; // 'grid' or 'card'
        
        let currentlySelectedEpisode = 1;

        // Pagination settings - dynamic based on view mode
        function getEpisodesPerPage() {
            return viewMode === 'grid' ? 100 : 6    ; // 100 for grid view, 5 for card view
        }
        
        let currentPage = 0; // 0-based index for pages
        
        // Calculate pagination details based on current view mode
        function calculatePagination() {
            const episodesPerPage = getEpisodesPerPage();
            const totalPages = Math.ceil(totalEpisodes / episodesPerPage);
            return { episodesPerPage, totalPages };
        }
        
        let { episodesPerPage, totalPages } = calculatePagination();
        
        // Calculate current range
        function updateEpisodeRange() {
            const startEp = currentPage * episodesPerPage + 1;
            const endEp = Math.min((currentPage + 1) * episodesPerPage, totalEpisodes);
            return {
                start: startEp,
                end: endEp,
                display: `${String(startEp).padStart(3, '0')}-${String(endEp).padStart(3, '0')}`
            };
        }
        
        let currentRange = updateEpisodeRange();
        
        // Create the episodes section
        const episodesSection = document.createElement('div');
        episodesSection.className = 'episodes-panel';
        
        // Create header
        const header = document.createElement('div');
        header.className = 'episodes-header';
        
        const title = document.createElement('h2');
        title.textContent = 'Episodes';
        header.appendChild(title);
        
        // Create search and control buttons
        const controls = document.createElement('div');
        controls.className = 'episodes-controls';
        
        const searchInput = document.createElement('div');
        searchInput.className = 'episode-search';
        searchInput.innerHTML = '<span class="search-hash">#</span><input type="text" placeholder="Find">';
        
        const listView1Button = document.createElement('button');
        listView1Button.className = 'episode-list-button active'; // Now active by default
        listView1Button.id = 'card-view-button';
        listView1Button.innerHTML = '<i class="fas fa-list"></i>'; // List icon for card view

        const listView2Button = document.createElement('button');
        listView2Button.className = 'episode-list-button'; // No longer active by default
        listView2Button.id = 'grid-view-button'; 
        listView2Button.innerHTML = '<i class="fas fa-th-large"></i>'; // Grid icon for grid view
        
        controls.appendChild(searchInput);
        controls.appendChild(listView1Button);
        controls.appendChild(listView2Button);
        
        header.appendChild(controls);
        
        // Create navigation bar
        const navigation = document.createElement('div');
        navigation.className = 'episodes-navigation';
        
        const prevButton = document.createElement('button');
        prevButton.className = 'nav-button prev';
        prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
        if (currentPage === 0) {
            prevButton.disabled = true;
            prevButton.style.opacity = '0.5';
            prevButton.style.cursor = 'not-allowed';
        }
        
        const rangeText = document.createElement('span');
        rangeText.className = 'episodes-range';
        rangeText.textContent = currentRange.display;
        
        const nextButton = document.createElement('button');
        nextButton.className = 'nav-button next';
        nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
        if (currentPage === totalPages - 1 || totalPages <= 1) {
            nextButton.disabled = true;
            nextButton.style.opacity = '0.5';
            nextButton.style.cursor = 'not-allowed';
        }
        
        navigation.appendChild(prevButton);
        navigation.appendChild(rangeText);
        navigation.appendChild(nextButton);
        
        // Add CSS for the card view
        // Add this CSS to the addCardViewStyles function
        function addCardViewStyles() {
            const style = document.createElement('style');
            style.textContent = `
                /* Base episodes panel styles with transitions */
                .episodes-panel {
                    transition: width 0.3s ease, max-width 0.3s ease;
                    width: 300px; /* Default width for grid view */
                }
                
                /* Expanded panel for card view */
                .episodes-panel.card-mode {
                    width: 650px; /* Wider width for card view */
                    max-width: calc(100vw - 40px); /* Responsive limit */
                }
                
                /* Adjust main content layout when panel is in card mode */
                #main-content-watch {
                    transition: grid-template-columns 0.3s ease;
                }
                
                /* Responsive adjustment for main content */
                @media (max-width: 1000px) {
                    .episodes-panel.card-mode {
                        width: 550px;
                    }
                }
                
                @media (max-width: 850px) {
                    .episodes-panel.card-mode {
                        width: 100%;
                        max-width: 100%;
                    }
                }
                
                /* Card view specific styles */
                .episodes-grid.card-view {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                
                .episode-card {
                    display: flex;
                    background-color: #292929;
                    border-radius: 8px;
                    overflow: hidden;
                    height: 120px;
                    transition: transform 0.2s, box-shadow 0.2s;
                    cursor: pointer;
                }
                
                .episode-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                }
                
                .episode-card.active {
                    border: 2px solid #e74c3c;
                }
                
                .episode-card-thumbnail {
                    width: 213px; /* 16:9 ratio based on height */
                    height: 120px;
                    background-size: cover;
                    background-position: center;
                    flex-shrink: 0;
                    position: relative;
                }
                
                .episode-number-overlay {
                    position: absolute;
                    top: 8px;
                    left: 8px;
                    background-color: rgba(0, 0, 0, 0.7);
                    color: white;
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: bold;
                }
                
                .episode-duration {
                    position: absolute;
                    bottom: 8px;
                    right: 8px;
                    background-color: rgba(0, 0, 0, 0.7);
                    color: white;
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                }
                
                .episode-card-content {
                    padding: 12px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                }
                
                .episode-card-title {
                    font-weight: bold;
                    margin: 0 0 8px 0;
                    font-size: 14px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                .episode-card-overview {
                    font-size: 12px;
                    color: #ccc;
                    line-height: 1.4;
                    overflow: hidden;
                    display: -webkit-box;
                    -webkit-line-clamp: 3;
                    -webkit-box-orient: vertical;
                    max-height: 4.2em;
                }
                
                /* Button styles */
                .episode-button {
                    transition: transform 0.2s, background-color 0.2s;
                }
                
                .episode-button:hover {
                    transform: scale(1.05);
                    background-color: #3a3a3a;
                }
                
                .episode-button.active {
                    background-color: #e74c3c;
                    color: white;
                    font-weight: bold;
                }
                
                .episode-list-button {
                    background: none;
                    border: none;
                    color: #aaa;
                    font-size: 18px;
                    padding: 5px 10px;
                    cursor: pointer;
                    transition: color 0.2s;
                }
                
                .episode-list-button:hover {
                    color: white;
                }
                
                .episode-list-button.active {
                    color: #e74c3c;
                }
            `;
            document.head.appendChild(style);
        }
        // Add the custom styles
        addCardViewStyles();
        
        // Function to generate episode grid (compact view)
        // Function to generate episode grid (compact view)
        function generateEpisodeGrid() {
            const grid = document.createElement('div');
            grid.className = 'episodes-grid';
            
            // Only generate buttons for current page
            for (let i = currentRange.start; i <= currentRange.end; i++) {
                const episodeButton = document.createElement('button');
                episodeButton.className = 'episode-button';
                episodeButton.textContent = i;
                
                // Highlight current episode based on currentlySelectedEpisode
                if (i === currentlySelectedEpisode) {
                    episodeButton.classList.add('active');
                }
                
                // Add click event
                episodeButton.addEventListener('click', () => {
                    const episodeNumber = parseInt(episodeButton.textContent);
                    
                    // Remove active class from all buttons
                    document.querySelectorAll('.episode-button').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    
                    // Add active class to clicked button
                    episodeButton.classList.add('active');
                    
                    // Update episode info in the video info panel
                    updateEpisodeInfo(episodeNumber);
                    
                    // Update the currently selected episode
                    currentlySelectedEpisode = episodeNumber;
                    
                    console.log(`Switching to episode ${episodeNumber}`);
                });
                
                grid.appendChild(episodeButton);
            }
            
            return grid;
        }
        
        // Function to generate episode cards (detailed view)
        function generateEpisodeCards() {
            const grid = document.createElement('div');
            grid.className = 'episodes-grid card-view';
            
            // Only generate cards for current page
            for (let i = currentRange.start; i <= currentRange.end; i++) {
                // Get episode data
                const episodeData = getEpisodeData(i);
                
                const episodeCard = document.createElement('div');
                episodeCard.className = 'episode-card';
                
                episodeCard.style.maxWidth = '100%';

                // Highlight active episode
                if (i === currentlySelectedEpisode) {
                    episodeCard.classList.add('active');
                }
                
                // Create thumbnail area
                const thumbnail = document.createElement('div');
                thumbnail.className = 'episode-card-thumbnail';
                thumbnail.style.backgroundImage = `url(${episodeData.img || '/api/placeholder/213/120'})`;
                
                // Episode number overlay
                const episodeNumber = document.createElement('div');
                episodeNumber.className = 'episode-number-overlay';
                episodeNumber.textContent = `EP ${i}`;
                thumbnail.appendChild(episodeNumber);
                
                // Duration if available
                if (episodeData.duration) {
                    const duration = document.createElement('div');
                    duration.className = 'episode-duration';
                    duration.textContent = formatDuration(episodeData.duration);
                    thumbnail.appendChild(duration);
                }
                
                // Create content area
                const content = document.createElement('div');
                content.className = 'episode-card-content';
                
                // Episode title
                const title = document.createElement('h3');
                title.className = 'episode-card-title';
                title.textContent = episodeData.title || `Episode ${i}`;
                content.appendChild(title);
                
                // Episode overview
                const overview = document.createElement('p');
                overview.className = 'episode-card-overview';
                overview.textContent = episodeData.overview || 'No description available.';
                content.appendChild(overview);
                
                // Assemble card
                episodeCard.appendChild(thumbnail);
                episodeCard.appendChild(content);
                
                // Add click event
                episodeCard.addEventListener('click', () => {
                    const episodeNumber = parseInt(episodeCard.querySelector('.episode-number-overlay').textContent.replace('EP ', ''));
                    
                    // Remove active class from all cards
                    document.querySelectorAll('.episode-card').forEach(card => {
                        card.classList.remove('active');
                    });
                    
                    // Add active class to clicked card
                    episodeCard.classList.add('active');
                    
                    // Update episode info in the video info panel
                    updateEpisodeInfo(episodeNumber);
                    
                    // Update the currently selected episode
                    currentlySelectedEpisode = episodeNumber;
                    
                    console.log(`Switching to episode ${episodeNumber}`);
                });
                
                grid.appendChild(episodeCard);
            }
            
            return grid;
        }
        
        // Function to update episode info in the video panel
        function updateEpisodeInfo(episodeNumber) {
            const animeData = getAnimeData();
            const animeTitle = animeData?.title || 'Anime';
            
            const watchingTitleEl = document.querySelector('.watching-title');
            if (watchingTitleEl) {
                watchingTitleEl.textContent = `You are watching: ${animeTitle} Episode ${episodeNumber}`;
            }

            // You could also update other elements like episode title, etc.
            const episodeData = getEpisodeData(episodeNumber);
            const videoTitleEl = document.querySelector('.video-title');
            if (videoTitleEl && episodeData.title) {
                videoTitleEl.textContent = `You are watching: ${episodeData.title}`;
            }
        }


        // Helper function to get episode data
        function getEpisodeData(episodeNumber) {
            if (animeData.episodeData && Array.isArray(animeData.episodeData)) {
                // Adjust index since episodeData is likely 0-indexed but our display is 1-indexed
                const episodeIndex = episodeNumber - 1;
                if (episodeIndex >= 0 && episodeIndex < animeData.episodeData.length) {
                    return animeData.episodeData[episodeIndex];
                }
            }
            // Return fallback data if episode not found
            return {
                title: `Episode ${episodeNumber}`,
                overview: 'No description available.',
                img: '/api/placeholder/213/120',
                duration: null
            };
        }
        
        // Format duration from minutes to MM:SS
        function formatDuration(minutes) {
            if (!minutes) return '??:??';
            const hrs = Math.floor(minutes / 60);
            const mins = minutes % 60;
            if (hrs > 0) {
                return `${hrs}:${String(mins).padStart(2, '0')}`;
            }
            return `${mins}:00`;
        }
        
        
        
        // Function to generate the appropriate view based on current mode
        function generateCurrentView() {
            return viewMode === 'grid' ? generateEpisodeGrid() : generateEpisodeCards();
        }
        
        // Initial view
        const initialView = generateCurrentView();
        
        // Assemble the panel
        episodesSection.appendChild(header);
        episodesSection.appendChild(navigation);
        episodesSection.appendChild(initialView);
        episodesSection.classList.add('card-mode');
        // Insert at the beginning of main content, before the video panel
        const videoPanel = document.querySelector('.video-panel');
        if (videoPanel) {
            mainContent.insertBefore(episodesSection, videoPanel);
        } else {
            mainContent.appendChild(episodesSection);
        }
        
        // Function to update the episode display when page or view mode changes
        function updateEpisodeDisplay() {
            // Recalculate pagination
            const newPagination = calculatePagination();
            episodesPerPage = newPagination.episodesPerPage;
            totalPages = newPagination.totalPages;
            
            // Ensure current page is valid with new pagination
            if (currentPage >= totalPages) {
                currentPage = totalPages - 1;
            }
            
            // Update range text
            currentRange = updateEpisodeRange();
            rangeText.textContent = currentRange.display;
            
            // Enable/disable pagination buttons
            prevButton.disabled = currentPage === 0;
            prevButton.style.opacity = currentPage === 0 ? '0.5' : '1';
            prevButton.style.cursor = currentPage === 0 ? 'not-allowed' : 'pointer';
            
            nextButton.disabled = currentPage === totalPages - 1;
            nextButton.style.opacity = currentPage === totalPages - 1 ? '0.5' : '1';
            nextButton.style.cursor = currentPage === totalPages - 1 ? 'not-allowed' : 'pointer';
            
            // Replace the grid with a new one
            const oldGrid = episodesSection.querySelector('.episodes-grid');
            const newGrid = generateCurrentView();
            episodesSection.replaceChild(newGrid, oldGrid);
        }
        
        

        // Set up view mode toggle buttons
        // Set up view mode toggle buttons
        listView1Button.addEventListener('click', () => {
            if (viewMode !== 'card') {
                viewMode = 'card';
                listView1Button.classList.add('active');
                listView2Button.classList.remove('active');
                
                // Calculate which page contains the currently selected episode in card view
                const episodesPerPageInCardView = 6; // Card view shows 6 episodes per page
                const targetPage = Math.floor((currentlySelectedEpisode - 1) / episodesPerPageInCardView);
                
                // Update current page to ensure the selected episode is visible
                currentPage = targetPage;
                
                // Add card-mode class to expand the panel
                episodesSection.classList.add('card-mode');
                
                // Update content after a short delay to allow for transition
                setTimeout(() => {
                    updateEpisodeDisplay();
                    
                    // Find and highlight the currently selected episode in the new view
                    setTimeout(() => {
                        const episodeCards = episodesSection.querySelectorAll('.episode-card');
                        episodeCards.forEach(card => {
                            const episodeNumber = parseInt(card.querySelector('.episode-number-overlay').textContent.replace('EP ', ''));
                            if (episodeNumber === currentlySelectedEpisode) {
                                card.classList.add('active');
                            }
                        });
                    }, 50);
                }, 50);
            }
        });

        listView2Button.addEventListener('click', () => {
            if (viewMode !== 'grid') {
                viewMode = 'grid';
                listView2Button.classList.add('active');
                listView1Button.classList.remove('active');
                
                // Calculate which page contains the currently selected episode in grid view
                const episodesPerPageInGridView = 100; // Grid view shows 100 episodes per page
                const targetPage = Math.floor((currentlySelectedEpisode - 1) / episodesPerPageInGridView);
                
                // Update current page to ensure the selected episode is visible
                currentPage = targetPage;
                
                // Remove card-mode class to shrink the panel
                episodesSection.classList.remove('card-mode');
                
                // Update content after a short delay to allow for transition
                setTimeout(() => {
                    updateEpisodeDisplay();
                    
                    // Find and highlight the currently selected episode in the new view
                    setTimeout(() => {
                        const episodeButtons = episodesSection.querySelectorAll('.episode-button');
                        episodeButtons.forEach(button => {
                            if (parseInt(button.textContent) === currentlySelectedEpisode) {
                                button.classList.add('active');
                            }
                        });
                    }, 50);
                }, 50);
            }
        });
        
        // Set up navigation buttons
        prevButton.addEventListener('click', () => {
            if (currentPage > 0) {
                currentPage--;
                updateEpisodeDisplay();
                // Scroll to top of episodes grid
                episodesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages - 1) {
                currentPage++;
                updateEpisodeDisplay();
                // Scroll to top of episodes grid
                episodesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        
        // Search functionality
        const searchInputElement = searchInput.querySelector('input');
        searchInputElement.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                const searchValue = parseInt(searchInputElement.value);
                if (!isNaN(searchValue) && searchValue > 0 && searchValue <= totalEpisodes) {
                    // Calculate which page this episode is on
                    const targetPage = Math.floor((searchValue - 1) / episodesPerPage);
                    
                    // Only change page if needed
                    if (targetPage !== currentPage) {
                        currentPage = targetPage;
                        updateEpisodeDisplay();
                    }
                    
                    // Find and click the target episode button or card
                    setTimeout(() => {
                        if (viewMode === 'grid') {
                            const targetButton = Array.from(
                                episodesSection.querySelectorAll('.episode-button')
                            ).find(btn => parseInt(btn.textContent) === searchValue);
                            
                            if (targetButton) {
                                targetButton.click();
                                targetButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                        } else {
                            const targetCards = episodesSection.querySelectorAll('.episode-card');
                            const targetIndex = searchValue - currentRange.start;
                            if (targetIndex >= 0 && targetIndex < targetCards.length) {
                                targetCards[targetIndex].click();
                                targetCards[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                        }
                    }, 100); // Small delay to ensure the grid has updated
                }
            }
        });
    }


    // Add call to createSeasonsSection after createVideoInfoSection
    // In your existing code, after createVideoInfoSection() call, add:
    // createSeasonsSection();
    // Function to create video control bar
    function createVideoControlBar() {
        const videoContainer = document.querySelector('.video-container');
        if (!videoContainer) return;
        
        // Check if control bar already exists to prevent duplication
        if (videoContainer.querySelector('.video-control-bar')) {
            console.log('Control bar already exists, skipping creation');
            return;
        }
    
        // Create the control bar
        const controlBar = document.createElement('div');
        controlBar.className = 'video-control-bar';
        
        // Create buttons
        const buttons = [
            { icon: 'download', label: 'Download' },
            { icon: 'bookmark', label: 'Bookmark' },
            { icon: 'play-circle', label: 'AutoPlay' },
            { icon: 'forward', label: 'AutoSkip' },
            { icon: 'users', label: 'W2G' }
        ];
        
        buttons.forEach(button => {
            const buttonEl = document.createElement('button');
            buttonEl.className = 'control-button';
            buttonEl.setAttribute('aria-label', button.label);
            buttonEl.dataset.action = button.label.toLowerCase();
            
            const icon = document.createElement('i');
            icon.className = `fas fa-${button.icon}`;
            
            const text = document.createElement('span');
            text.textContent = button.label;
            
            buttonEl.appendChild(icon);
            buttonEl.appendChild(text);
            
            // Add click event listener
            buttonEl.addEventListener('click', function() {
                console.log(`${button.label} button clicked`);
                // Toggle active state for some buttons
                if (['autoplay', 'autoskip'].includes(button.label.toLowerCase())) {
                    this.classList.toggle('active');
                }
            });
            
            controlBar.appendChild(buttonEl);
        });
        
        // Insert the control bar after the video player
        videoContainer.appendChild(controlBar);
        
        // Add CSS styles for the control bar
        addVideoControlBarStyles();
    }

    // Function to add CSS styles for the control bar
    function addVideoControlBarStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .video-control-bar {
                display: flex;
                justify-content: space-around;
                align-items: center;
                background-color: #1a1a1a;
                border-radius: 0 0 8px 8px;
                padding: 10px 15px;
                margin-top: -5px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            
            .control-button {
                display: flex;
                flex-direction: column;
                align-items: center;
                background: none;
                border: none;
                color: #aaa;
                font-size: 12px;
                padding: 5px 10px;
                cursor: pointer;
                transition: color 0.2s, transform 0.2s;
            }
            
            .control-button:hover {
                color: #e74c3c;
                transform: translateY(-2px);
            }
            
            .control-button.active {
                color: #e74c3c;
            }
            
            .control-button i {
                font-size: 18px;
                margin-bottom: 5px;
            }
        `;
        document.head.appendChild(style);
    }
    // Call the functions to set up the video info section
    /* createVideoInfoSection();
    createVideoControlBar();
    createRelatedSeriesSection();
    createEpisodesPanel(); 
    addNotificationStyles(); */
    
    // Episode items click event
    const episodeItems = document.querySelectorAll('.episode-item');
    episodeItems.forEach(item => {
        item.addEventListener('click', () => {
            // Here you would load the selected episode in your embedded player
            // For now, let's update the title as an example
            const episodeTitle = item.querySelector('.episode-title').textContent;
            const videoTitleElement = document.querySelector('.video-title');
            if (videoTitleElement) {
                videoTitleElement.textContent = episodeTitle;
            }
            
            // Reset player to initial state
            isPlaying = false;
            if (playPauseButton) {
                playPauseButton.innerHTML = '<i class="fas fa-play"></i>';
            }
            currentProgress = 0;
            if (progressBar) {
                progressBar.style.width = '0%';
            }
            if (currentTimeDisplay) {
                currentTimeDisplay.textContent = '00:00';
            }
            
            // Scroll to top of video player
            if (videoPlayer) {
                videoPlayer.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

   

});