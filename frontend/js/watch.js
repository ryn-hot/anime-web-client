document.addEventListener('DOMContentLoaded', () => {
    // Sidebar navigation functionality
    const menuButton = document.querySelector('.menu-button');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.overlay');

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

    // Event listeners
    menuButton.addEventListener('click', toggleSidebar);
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
            const searchInput = document.querySelector('.search-input[name="keyword"]');
            const searchValue = searchInput ? searchInput.value.trim() : '';
            window.location.href = `search.html${searchValue ? `?search=${encodeURIComponent(searchValue)}` : ''}`;
        });
    }
    
    const searchForm = document.querySelector('.search-content form');
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Prevent the default form submission
            const searchInput = document.querySelector('.search-input[name="keyword"]');
            const searchValue = searchInput ? searchInput.value.trim() : '';
            window.location.href = `search.html${searchValue ? `?search=${encodeURIComponent(searchValue)}` : ''}`;
        });
    }

    const filterButton = document.getElementById('filter-button');
    if (filterButton) {
        filterButton.addEventListener('click', () => {
            const searchInput = document.querySelector('.search-input[name="keyword"]');
            const searchValue = searchInput ? searchInput.value.trim() : '';
            window.location.href = `search.html${searchValue ? `?search=${encodeURIComponent(searchValue)}` : ''}`;
        });
    }

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
    totalTimeDisplay.textContent = "24:30"; // Example duration
    
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
        
        fullscreenButton.innerHTML = isFullscreen ? 
            '<i class="fas fa-compress"></i>' : 
            '<i class="fas fa-expand"></i>';
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
    
    // Episode items click event
    const episodeItems = document.querySelectorAll('.episode-item');
    episodeItems.forEach(item => {
        item.addEventListener('click', () => {
            // Here you would load the selected episode in your embedded player
            // For now, let's update the title as an example
            const episodeTitle = item.querySelector('.episode-title').textContent;
            document.querySelector('.video-title').textContent = episodeTitle;
            
            // Reset player to initial state
            isPlaying = false;
            playPauseButton.innerHTML = '<i class="fas fa-play"></i>';
            currentProgress = 0;
            progressBar.style.width = '0%';
            currentTimeDisplay.textContent = '00:00';
            
            // Scroll to top of video player
            videoPlayer.scrollIntoView({ behavior: 'smooth' });
        });
    });
    
});

