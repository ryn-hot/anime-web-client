document.addEventListener('DOMContentLoaded', () => {


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


})