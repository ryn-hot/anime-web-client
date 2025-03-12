
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

document.addEventListener('DOMContentLoaded', () => {
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

    // Video Player Controls
    const videoContainer = document.querySelector('.video-container');
    const videoPlayer = document.getElementById('video-player');
    const playPauseButton = document.querySelector('.play-pause');
    const volumeButton = document.querySelector('.volume');
    const fullscreenButton = document.querySelector('.fullscreen');
    const settingsButton = document.querySelector('.settings');
    const progressBar = document.querySelector('.progress-bar-fill');
    const progressBarBg = document.querySelector('.progress-bar-bg');
    const currentTimeDisplay = document.querySelector('.current-time');
    const totalTimeDisplay = document.querySelector('.total-time');
    
    // Variables to track state
    let isPlaying = false;
    let isMuted = false;
    let isFullscreen = false;
    let currentProgress = 20; // Default progress percentage
    
    // Initialize placeholder values
    if (totalTimeDisplay) {
        totalTimeDisplay.textContent = "24:30"; // Example duration
    }
    
    // Play/Pause button functionality
    if (playPauseButton) {
        playPauseButton.addEventListener('click', () => {
            isPlaying = !isPlaying;
            
            // Update button icon
            if (isPlaying) {
                playPauseButton.innerHTML = '<i class="fas fa-pause"></i>';
                // Here you would call the play method of your embedded player
                currentTimeDisplay.textContent = formatTime(Math.floor(currentProgress * 1470 / 100)); // Example: calculate time based on progress
            } else {
                playPauseButton.innerHTML = '<i class="fas fa-play"></i>';
                // Here you would call the pause method of your embedded player
            }
        });
    }
    
    // Volume button functionality
    if (volumeButton) {
        volumeButton.addEventListener('click', () => {
            isMuted = !isMuted;
            
            // Update button icon
            volumeButton.innerHTML = isMuted ? 
                '<i class="fas fa-volume-mute"></i>' : 
                '<i class="fas fa-volume-up"></i>';
            
            // Here you would call the mute/unmute method of your embedded player
        });
    }
    
    // Fullscreen button functionality
    if (fullscreenButton) {
        fullscreenButton.addEventListener('click', () => {
            isFullscreen = !isFullscreen;
            
            if (isFullscreen) {
                // Enter fullscreen
                if (videoContainer.requestFullscreen) {
                    videoContainer.requestFullscreen();
                } else if (videoContainer.webkitRequestFullscreen) {
                    videoContainer.webkitRequestFullscreen();
                } else if (videoContainer.msRequestFullscreen) {
                    videoContainer.msRequestFullscreen();
                }
                
                fullscreenButton.innerHTML = '<i class="fas fa-compress"></i>';
            } else {
                // Exit fullscreen
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
                
                fullscreenButton.innerHTML = '<i class="fas fa-expand"></i>';
            }
        });
    }
    
    // Track fullscreen changes
    document.addEventListener('fullscreenchange', updateFullscreenButton);
    document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
    document.addEventListener('mozfullscreenchange', updateFullscreenButton);
    document.addEventListener('MSFullscreenChange', updateFullscreenButton);
    
    function updateFullscreenButton() {
        isFullscreen = !!document.fullscreenElement || 
                      !!document.webkitFullscreenElement || 
                      !!document.mozFullScreenElement ||
                      !!document.msFullscreenElement;
        
        if (fullscreenButton) {
            fullscreenButton.innerHTML = isFullscreen ? 
                '<i class="fas fa-compress"></i>' : 
                '<i class="fas fa-expand"></i>';
        }
    }
    
    // Settings button functionality
    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            // Create settings dropdown if it doesn't exist
            let settingsDropdown = document.querySelector('.settings-dropdown');
            
            if (!settingsDropdown) {
                settingsDropdown = document.createElement('div');
                settingsDropdown.className = 'settings-dropdown';
                
                const settingsList = document.createElement('ul');
                
                // Add settings options
                const qualityOption = document.createElement('li');
                qualityOption.textContent = 'Quality: 1080p';
                settingsList.appendChild(qualityOption);
                
                const speedOption = document.createElement('li');
                speedOption.textContent = 'Playback Speed: Normal';
                settingsList.appendChild(speedOption);
                
                const subtitlesOption = document.createElement('li');
                subtitlesOption.textContent = 'Subtitles: English';
                settingsList.appendChild(subtitlesOption);
                
                settingsDropdown.appendChild(settingsList);
                videoContainer.appendChild(settingsDropdown);
            }
            
            // Toggle dropdown visibility
            settingsDropdown.classList.toggle('active');
        });
        
        // Close settings dropdown when clicking outside
        document.addEventListener('click', (event) => {
            const settingsDropdown = document.querySelector('.settings-dropdown');
            if (settingsDropdown && settingsDropdown.classList.contains('active')) {
                if (!settingsDropdown.contains(event.target) && event.target !== settingsButton) {
                    settingsDropdown.classList.remove('active');
                }
            }
        });
    }
    
    // Progress bar functionality
    if (progressBarBg) {
        progressBarBg.addEventListener('click', (event) => {
            // Calculate click position relative to the progress bar width
            const rect = progressBarBg.getBoundingClientRect();
            const clickPosition = event.clientX - rect.left;
            const progressBarWidth = rect.width;
            
            // Calculate percentage
            currentProgress = Math.min(Math.max((clickPosition / progressBarWidth) * 100, 0), 100);
            
            // Update progress bar width
            progressBar.style.width = `${currentProgress}%`;
            
            // Update current time display based on progress percentage
            const totalTimeInSeconds = 1470; // Example: 24:30 in seconds
            const currentTimeInSeconds = Math.floor(currentProgress * totalTimeInSeconds / 100);
            currentTimeDisplay.textContent = formatTime(currentTimeInSeconds);
            
            // Here you would call the seek method of your embedded player
        });
    }
    
    // Format seconds to MM:SS
    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        const formattedMinutes = String(minutes).padStart(2, '0');
        const formattedSeconds = String(remainingSeconds).padStart(2, '0');
        
        return `${formattedMinutes}:${formattedSeconds}`;
    }
    
    // Dynamically create video info section
    function createVideoInfoSection() {
        // Find the video panel or main content to append to
        // const animeData = getAnimeData();

        const videoPanel = document.querySelector('.video-panel') || document.getElementById('main-content-watch');
        if (!videoPanel) return; // Exit if no container is found
        
        // Check if video-info already exists
        let videoInfo = document.querySelector('.video-info');
        if (videoInfo) {
            // Clear existing content if it exists
            videoInfo.innerHTML = '';
        } else {
            // Create new element if it doesn't exist
            videoInfo = document.createElement('div');
            videoInfo.className = 'video-info';
            // Insert after video container
            const videoContainer = document.querySelector('.video-container');
            const relatedEpisodes = document.querySelector('.related-episodes');
            if (videoContainer && videoContainer.parentNode) {
                videoContainer.parentNode.insertBefore(videoInfo, relatedEpisodes);
            } else {
                videoPanel.appendChild(videoInfo);
            }
        }
        
        // Create main container
        const videoInfoContainer = document.createElement('div');
        videoInfoContainer.className = 'video-info-container';
        
        const episodeDetailsPanel = document.createElement('div');
        episodeDetailsPanel.className = 'episode-details-panel';

        // Create a content wrapper for better margin control
        const episodeDetailsContent = document.createElement('div');
        episodeDetailsContent.className = 'episode-details-content';

        const videoTitle = document.createElement('h1');
        videoTitle.className = 'video-title';
        videoTitle.textContent = 'You are watching';

        const episodeInfo = document.createElement('div');
        episodeInfo.className = 'episode-info';

        const episodeNumber = document.createElement('span');
        episodeNumber.className = 'episode-number';
        episodeNumber.textContent = 'Episode 1';
        episodeInfo.appendChild(episodeNumber);

        const serverMessage = document.createElement('p');
        serverMessage.className = 'server-message';
        serverMessage.textContent = "If current server doesn't work please try other servers beside.";

        // Append to content wrapper first
        episodeDetailsContent.appendChild(videoTitle);
        episodeDetailsContent.appendChild(episodeInfo);
        episodeDetailsContent.appendChild(serverMessage);

        // Then append content wrapper to panel
        episodeDetailsPanel.appendChild(episodeDetailsContent);
        
        // Create right panel (source selection)
        const sourceSelection = document.createElement('div');
        sourceSelection.className = 'source-selection';
        
        // Create SUB section
        const subSection = createLanguageSection('SUB', ['HD-1', 'HD-2'], true);
        
        // Create DUB section
        const dubSection = createLanguageSection('DUB', ['HD-1', 'HD-2'], false);
        
        sourceSelection.appendChild(subSection);
        sourceSelection.appendChild(dubSection);
        
        // Append panels to container
        videoInfoContainer.appendChild(episodeDetailsPanel);
        videoInfoContainer.appendChild(sourceSelection);
        
        // Create action buttons
        
        // Append all sections to video info
        videoInfo.appendChild(videoInfoContainer);
        
        // Initialize event listeners for source buttons
        initSourceButtons();
    }
    
    // Helper function to create language sections (SUB/DUB)
    function createLanguageSection(label, options, isFirstActive) {
        const section = document.createElement('div');
        section.className = 'language-section';
        
        const labelDiv = document.createElement('div');
        labelDiv.className = 'language-label';
        
        const icon = document.createElement('i');
        icon.className = `fas fa-${label === 'SUB' ? 'closed-captioning' : 'microphone'}`;
        
        const labelText = document.createElement('span');
        labelText.textContent = `${label}:`;
        
        labelDiv.appendChild(icon);
        labelDiv.appendChild(labelText);
        
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'source-buttons';
        
        options.forEach((option, index) => {
            const button = document.createElement('button');
            button.className = 'source-button';
            if (index === 0 && isFirstActive) {
                button.classList.add('active');
            }
            button.dataset.source = `${label.toLowerCase()}-${index + 1}`;
            button.textContent = option;
            
            buttonsDiv.appendChild(button);
        });
        
        section.appendChild(labelDiv);
        section.appendChild(buttonsDiv);
        
        return section;
    }
    
    
    // Initialize event listeners for source buttons
    function initSourceButtons() {
        const sourceButtons = document.querySelectorAll('.source-button');
        
        sourceButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Get data-source attribute
                const source = this.getAttribute('data-source');
                
                // Remove active class from all buttons in the same group
                const parentSection = this.closest('.language-section');
                parentSection.querySelectorAll('.source-button').forEach(btn => {
                    btn.classList.remove('active');
                });
                
                // Add active class to the clicked button
                this.classList.add('active');
                
                // Change video source (placeholder functionality for now)
                console.log(`Switched to source: ${source}`);
                
                // Show a temporary notification
                const notification = document.createElement('div');
                notification.className = 'source-change-notification';
                notification.textContent = `Loading ${source.includes('sub') ? 'Subtitled' : 'Dubbed'} version, ${source.slice(-1)}`;
                
                const videoContainer = document.querySelector('.video-container');
                if (videoContainer) {
                    videoContainer.appendChild(notification);
                    
                    // Remove notification after 3 seconds
                    setTimeout(() => {
                        notification.classList.add('fade-out');
                        setTimeout(() => notification.remove(), 500);
                    }, 3000);
                }
            });
        });
    }
    
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
        const videoPanel = document.querySelector('.video-panel');
        if (!videoPanel) return;
        
        // Get relations array from animeData
        const relations = animeData.relations || [];
        
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
            
            // Append to video panel
            videoPanel.appendChild(relatedSection);
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
        if (relations.length > 0) {
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
        let viewMode = 'grid'; // 'grid' or 'card'
        
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
        listView1Button.className = 'episode-list-button'; // No longer active by default
        listView1Button.id = 'card-view-button';
        listView1Button.innerHTML = '<i class="fas fa-list"></i>'; // List icon for card view

        const listView2Button = document.createElement('button');
        listView2Button.className = 'episode-list-button active'; // Now active by default
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
        function generateEpisodeGrid() {
            const grid = document.createElement('div');
            grid.className = 'episodes-grid';
            
            // Only generate buttons for current page
            for (let i = currentRange.start; i <= currentRange.end; i++) {
                const episodeButton = document.createElement('button');
                episodeButton.className = 'episode-button';
                episodeButton.textContent = i;
                
                // Highlight current episode (assuming episode 1 is active by default)
                if (i === 1 && currentPage === 0) {
                    episodeButton.classList.add('active');
                }
                
                // Add click event
                episodeButton.addEventListener('click', () => {
                    // Remove active class from all buttons
                    document.querySelectorAll('.episode-button').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    
                    // Add active class to clicked button
                    episodeButton.classList.add('active');
                    
                    // Update episode info in the video info panel
                    updateEpisodeInfo(i);
                    
                    console.log(`Switching to episode ${i}`);
                    // Here you would load the new episode video
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
                if (i === 1 && currentPage === 0) {
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
                    // Remove active class from all cards
                    document.querySelectorAll('.episode-card').forEach(card => {
                        card.classList.remove('active');
                    });
                    
                    // Add active class to clicked card
                    episodeCard.classList.add('active');
                    
                    // Update episode info in the video info panel
                    updateEpisodeInfo(i);
                    
                    console.log(`Switching to episode ${i}`);
                    // Here you would load the new episode video
                });
                
                grid.appendChild(episodeCard);
            }
            
            return grid;
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
        
        // Function to update episode info in the video panel
        function updateEpisodeInfo(episodeNumber) {
            const episodeNumberEl = document.querySelector('.episode-number');
            if (episodeNumberEl) {
                episodeNumberEl.textContent = `Episode ${episodeNumber}`;
            }
            
            // You could also update other elements like episode title, etc.
            const episodeData = getEpisodeData(episodeNumber);
            const videoTitleEl = document.querySelector('.video-title');
            if (videoTitleEl && episodeData.title) {
                videoTitleEl.textContent = `You are watching: ${episodeData.title}`;
            }
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
        listView1Button.addEventListener('click', () => {
            if (viewMode !== 'card') {
                viewMode = 'card';
                listView1Button.classList.add('active');
                listView2Button.classList.remove('active');
                
                // Add card-mode class to expand the panel
                episodesSection.classList.add('card-mode');
                
                // Update content after a short delay to allow for transition
                setTimeout(() => {
                    updateEpisodeDisplay();
                }, 50);
            }
        });
        
        listView2Button.addEventListener('click', () => {
            if (viewMode !== 'grid') {
                viewMode = 'grid';
                listView2Button.classList.add('active');
                listView1Button.classList.remove('active');
                
                // Remove card-mode class to shrink the panel
                episodesSection.classList.remove('card-mode');
                
                // Update content after a short delay to allow for transition
                setTimeout(() => {
                    updateEpisodeDisplay();
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
    
    // Call the functions to set up the video info section
    createVideoInfoSection();
    createRelatedSeriesSection();
    createEpisodesPanel(); 
    addNotificationStyles();
    
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