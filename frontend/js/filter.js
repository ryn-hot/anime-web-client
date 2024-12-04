document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded Event Fired!"); 
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

    // Populate format, status, and sort selects


});


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

// Listen to scroll events
window.addEventListener('scroll', highlightActiveLink);

// Initial highlight
highlightActiveLink();