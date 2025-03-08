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
        const videoPanel = document.querySelector('.video-panel') || document.getElementById('main-content');
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
    function createSeasonsSection() {
        const videoPanel = document.querySelector('.video-panel');
        if (!videoPanel) return;
        
        // Sample seasons data (in a real app, this would come from an API or database)
        const seasons = [
            { number: 1, episodes: 12, thumbnail: '/api/placeholder/160/90' },
            { number: 2, episodes: 13, thumbnail: '/api/placeholder/160/90' }
        ];
        
        // Only create the section if there's more than one season
        if (seasons.length <= 1) return;
        
        // Check if seasons section already exists
        let seasonsSection = document.querySelector('.seasons-section');
        if (seasonsSection) {
            // Clear existing content if it exists
            seasonsSection.innerHTML = '';
        } else {
            // Create new element if it doesn't exist
            seasonsSection = document.createElement('div');
            seasonsSection.className = 'seasons-section';
            
            // Append to video panel
            videoPanel.appendChild(seasonsSection);
        }
        
        // Create header with navigation
        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'section-header';
        
        const sectionTitle = document.createElement('h2');
        sectionTitle.className = 'section-title';
        sectionTitle.textContent = 'Seasons';
        
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
        
        // Create seasons container
        const seasonsContainer = document.createElement('div');
        seasonsContainer.className = 'seasons-container';
        
        // Add seasons
        seasons.forEach(season => {
            const seasonCard = document.createElement('div');
            seasonCard.className = 'season-card';
            seasonCard.dataset.season = season.number;
            
            // Add background image
            const bgImage = document.createElement('div');
            bgImage.className = 'season-bg';
            bgImage.style.backgroundImage = `url(${season.thumbnail})`;
            
            // Add season info
            const seasonInfo = document.createElement('div');
            seasonInfo.className = 'season-info';
            
            const seasonTitle = document.createElement('h3');
            seasonTitle.className = 'season-title';
            seasonTitle.textContent = `Season ${season.number}`;
            
            const episodeCount = document.createElement('span');
            episodeCount.className = 'episode-count';
            episodeCount.textContent = `${season.episodes} Eps`;
            
            seasonInfo.appendChild(seasonTitle);
            seasonInfo.appendChild(episodeCount);
            
            seasonCard.appendChild(bgImage);
            seasonCard.appendChild(seasonInfo);
            
            seasonsContainer.appendChild(seasonCard);
            
            // Add click event
            seasonCard.addEventListener('click', () => {
                console.log(`Switching to Season ${season.number}`);
                // Here you would handle season selection, update the UI, etc.
                
                // For example, update the episode number in the video info
                const episodeNumberEl = document.querySelector('.episode-number');
                if (episodeNumberEl) {
                    episodeNumberEl.textContent = `Season ${season.number}, Episode 1`;
                }
                
                // Mark this season as active
                document.querySelectorAll('.season-card').forEach(card => {
                    card.classList.remove('active');
                });
                seasonCard.classList.add('active');
            });
        });
        
        // Append all to section
        seasonsSection.appendChild(sectionHeader);
        seasonsSection.appendChild(seasonsContainer);
        
        // Set up navigation
        let scrollPosition = 0;
        const cardWidth = 220; // Approximate width including margins
        
        prevButton.addEventListener('click', () => {
            scrollPosition = Math.max(scrollPosition - cardWidth, 0);
            seasonsContainer.scrollTo({
                left: scrollPosition,
                behavior: 'smooth'
            });
        });
        
        nextButton.addEventListener('click', () => {
            scrollPosition = Math.min(
                scrollPosition + cardWidth,
                seasonsContainer.scrollWidth - seasonsContainer.clientWidth
            );
            seasonsContainer.scrollTo({
                left: scrollPosition,
                behavior: 'smooth'
            });
        });
        
        // Make first season active by default
        if (seasons.length > 0) {
            seasonsContainer.querySelector('.season-card').classList.add('active');
        }
    }

// Add call to createSeasonsSection after createVideoInfoSection
// In your existing code, after createVideoInfoSection() call, add:
// createSeasonsSection();
    
    // Call the functions to set up the video info section
    createVideoInfoSection();
    createSeasonsSection();
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