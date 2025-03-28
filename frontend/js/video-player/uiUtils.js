// Helper to show a loading overlay on the video container.
function showLoadingOverlay() {
    const videoContainer = document.querySelector('.video-container');
    if (videoContainer) {
        // Create an overlay element if it doesn't already exist.
        let overlay = document.getElementById('loadingOverlay');
        if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.innerHTML = `
            <div class="spinner">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading stream...</p>
            </div>
        `;
        // Style the overlay (or put this in your CSS file)
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
        overlay.style.zIndex = '1000';
        videoContainer.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    }
}
  
  // Helper to hide the loading overlay.
function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}
  
  // Helper to disable episode controls (assuming your episode cards have a common class)
function disableEpisodeControls() {
    const episodeCards = document.querySelectorAll('.episode-card, .episode-button');
    episodeCards.forEach(card => {
        card.style.pointerEvents = 'none';
        card.style.opacity = '0.5';
    });
}
  
  // Helper to enable episode controls.
function enableEpisodeControls() {
    const episodeCards = document.querySelectorAll('.episode-card, .episode-button');
    episodeCards.forEach(card => {
        card.style.pointerEvents = 'auto';
        card.style.opacity = '1';
    });
}
  
  // Helper to show error messages.
function showErrorMessage(message) {
    const videoContainer = document.querySelector('.video-container');
    if (videoContainer) {
        // Create or reuse an error message element.
        let errorElem = document.getElementById('streamError');
        if (!errorElem) {
        errorElem = document.createElement('div');
        errorElem.id = 'streamError';
        errorElem.style.position = 'absolute';
        errorElem.style.top = '20px';
        errorElem.style.left = '50%';
        errorElem.style.transform = 'translateX(-50%)';
        errorElem.style.backgroundColor = 'rgba(255,0,0,0.8)';
        errorElem.style.color = '#fff';
        errorElem.style.padding = '10px 20px';
        errorElem.style.borderRadius = '5px';
        errorElem.style.zIndex = '1100';
        videoContainer.appendChild(errorElem);
        }
        errorElem.textContent = message;
        errorElem.style.display = 'block';
        // Hide after 5 seconds.
        setTimeout(() => {
        errorElem.style.display = 'none';
        }, 5000);
    }
}

function populateTrackOptions(audioTracks, subtitleTracks) {
    const subtitleSelect = document.getElementById('subtitleSelect');
    const audioSelect = document.getElementById('audioSelect');

    // Clear existing options.
    subtitleSelect.innerHTML = '';
    audioSelect.innerHTML = '';

    // Populate subtitle options.
    if (!subtitleTracks || subtitleTracks.length === 0) {
        const option = document.createElement('option');
        option.value = 'none';
        option.text = 'No subtitles';
        subtitleSelect.appendChild(option);
    } else {
        subtitleTracks.forEach(track => {
        const option = document.createElement('option');
        option.value = track.id;
        option.text = track.label || track.language || 'Subtitle';
        subtitleSelect.appendChild(option);
        });
    }

    // Populate audio options.
    if (!audioTracks || audioTracks.length === 0) {
        const option = document.createElement('option');
        option.value = 'default';
        option.text = 'Default';
        audioSelect.appendChild(option);
    } else {
        audioTracks.forEach(track => {
        const option = document.createElement('option');
        option.value = track.id;
        option.text = track.label || track.language || 'Audio';
        audioSelect.appendChild(option);
        });
    }
}

  export {
    showLoadingOverlay,
    hideLoadingOverlay,
    showErrorMessage,
    disableEpisodeControls,
    enableEpisodeControls,
    populateTrackOptions
  }
  