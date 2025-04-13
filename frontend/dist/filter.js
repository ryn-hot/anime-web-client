(() => {
  // frontend/js/bottleneck.js
  var AniListAPI = class {
    constructor() {
      this.rateLimitRemaining = 30;
      this.lastRequestTime = 0;
      this.cooldownMs = 300;
      this.retryQueue = [];
      this.isProcessingQueue = false;
      this.maxRetries = 3;
    }
    async makeRequest(options, retryCount = 0) {
      var _a, _b;
      const now = Date.now();
      const timeToWait = Math.max(0, this.lastRequestTime + this.cooldownMs - now);
      if (timeToWait > 0) {
        await new Promise((resolve) => setTimeout(resolve, timeToWait));
      }
      if (this.rateLimitRemaining <= 0) {
        return new Promise((resolve, reject) => {
          this.retryQueue.push({ options, resolve, reject });
          this.processQueue();
        });
      }
      try {
        const response = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          mode: "cors",
          // Add this line
          credentials: "omit",
          // Add this line
          body: JSON.stringify({
            query: options.query,
            variables: options.variables || {}
          })
        });
        if (!response.ok) {
          throw new Error("HTTP error! status: ".concat(response.status));
        }
        this.rateLimitRemaining = parseInt((_a = response.headers.get("X-RateLimit-Remaining")) != null ? _a : "30");
        this.lastRequestTime = Date.now();
        if (response.status === 429) {
          const retryAfter = parseInt((_b = response.headers.get("Retry-After")) != null ? _b : "60");
          console.log("Rate limited. Attempt ".concat(retryCount + 1, " of ").concat(this.maxRetries, ". Waiting ").concat(retryAfter, " seconds."));
          if (retryCount < this.maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, retryAfter * 1e3 + 100));
            return this.makeRequest(options, retryCount + 1);
          } else {
            throw new Error("Failed after ".concat(this.maxRetries, " retry attempts due to rate limiting"));
          }
        }
        const data = await response.json();
        if (data.errors) {
          const error = new Error(data.errors[0].message);
          error.response = response;
          error.errors = data.errors;
          throw error;
        }
        return data;
      } catch (error) {
        if (!error.response && retryCount < this.maxRetries) {
          console.log("Network error. Attempt ".concat(retryCount + 1, " of ").concat(this.maxRetries, ". Retrying in 5 seconds."));
          await new Promise((resolve) => setTimeout(resolve, 5e3));
          return this.makeRequest(options, retryCount + 1);
        }
        throw error;
      }
    }
    async processQueue() {
      if (this.isProcessingQueue || this.retryQueue.length === 0) return;
      this.isProcessingQueue = true;
      while (this.retryQueue.length > 0) {
        const { options, resolve, reject } = this.retryQueue[0];
        try {
          const result = await this.makeRequest(options);
          resolve(result);
          this.retryQueue.shift();
        } catch (error) {
          reject(error);
          this.retryQueue.shift();
        }
        if (this.rateLimitRemaining <= 0) break;
      }
      this.isProcessingQueue = false;
    }
  };

  // frontend/js/filter.js
  var anilistAPI = new AniListAPI();
  document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM Content Loaded Event Fired!");
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get("search");
    const seasonParam = urlParams.get("season");
    const seasonYearParam = urlParams.get("seasonYear");
    const sortParam = urlParams.get("sort");
    const menuButton = document.querySelector(".menu-button");
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.querySelector(".overlay");
    menuButton.addEventListener("click", () => {
      toggleSidebar();
    });
    overlay.addEventListener("click", closeSidebar);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeSidebar();
      }
    });
    window.addEventListener("scroll", handleInfiniteScroll);
    fetchGenres();
    populateYearSelect();
    const searchInput = document.querySelector('.search-input[name="keyword"]');
    const genreSelect = document.querySelector('.icon-input[name="genre"]');
    const seasonSelect = document.querySelector('.icon-input[name="season"]');
    const yearSelect = document.querySelector('.icon-input[name="year"]');
    const formatSelect = document.querySelector('.icon-input[name="format"]');
    const statusSelect = document.querySelector('.icon-input[name="status"]');
    const sortSelect = document.querySelector('.icon-input[name="sort"]');
    if (seasonParam && seasonSelect) {
      seasonSelect.value = capitalizeFirstLetter(seasonParam.toLowerCase());
    }
    if (seasonYearParam && yearSelect) {
      yearSelect.value = seasonYearParam;
    }
    if (sortParam && sortSelect) {
      setSortByParam(sortSelect, sortParam);
    }
    if (searchParam && searchInput) {
      searchInput.value = searchParam;
    }
    const filterElements = [genreSelect, seasonSelect, yearSelect, formatSelect, statusSelect, sortSelect].filter((el) => el !== null);
    filterElements.forEach((el) => {
      el.addEventListener("change", () => updateAnimeList());
      el.addEventListener("input", () => updateAnimeList());
    });
    updateAnimeList();
    let lastSearchValue = searchInput ? searchInput.value.trim() : "";
    setInterval(() => {
      if (!searchInput) return;
      const currentValue = searchInput.value.trim();
      if (currentValue !== lastSearchValue) {
        lastSearchValue = currentValue;
        updateAnimeList();
      }
    }, 2e3);
    function toggleSidebar() {
      if (sidebar.classList.contains("expanded")) {
        sidebar.classList.remove("expanded");
        overlay.classList.remove("active");
      } else {
        sidebar.classList.add("expanded");
        overlay.classList.add("active");
      }
    }
    function closeSidebar() {
      sidebar.classList.remove("expanded");
      overlay.classList.remove("active");
    }
  });
  function handleInfiniteScroll() {
    const scrollTop = window.scrollY;
    const windowHeight = window.innerHeight;
    const docHeight = document.documentElement.offsetHeight;
    const scrolledRatio = (scrollTop + windowHeight) / docHeight;
    if (scrolledRatio > 0.9 && !isFetching) {
      isFetching = true;
      updateAnimeList(true);
    }
  }
  var currentPage = 1;
  var lastFilters = {};
  var isFetching = false;
  function capitalizeFirstLetter(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  function setSortByParam(select, sortVal) {
    switch (sortVal) {
      case "TRENDING_DESC":
        select.value = "Trending";
        break;
      case "POPULARITY_DESC":
        select.value = "Popularity";
        break;
      case "SCORE_DESC":
        select.value = "Score";
        break;
      // Add other mappings as needed
      default:
        break;
    }
  }
  function fetchGenres() {
    const query = "\n        query {\n            GenreCollection\n        }\n    ";
    anilistAPI.makeRequest({ query }).then((data) => {
      const genres = data.data.GenreCollection;
      populateGenreSelect(genres);
      const genreParam = new URLSearchParams(window.location.search).get("genre");
      if (genreParam) {
        const genreSelect = document.querySelector('.icon-input[name="genre"]');
        if (genreSelect) {
          genreSelect.value = genreParam;
          updateAnimeList();
        }
      }
    }).catch((error) => {
      console.error("Error fetching genres:", error);
    });
  }
  function populateGenreSelect(genres) {
    const genreSelect = document.querySelector('.icon-input[name="genre"]');
    genreSelect.innerHTML = "";
    const anyOption = document.createElement("option");
    anyOption.value = "";
    anyOption.textContent = "Any";
    genreSelect.appendChild(anyOption);
    genres.forEach((genre) => {
      const option = document.createElement("option");
      option.value = genre;
      option.textContent = genre;
      genreSelect.appendChild(option);
    });
  }
  function populateYearSelect() {
    const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
    const startYear = 1950;
    const yearSelect = document.querySelector('.icon-input[name="year"]');
    yearSelect.innerHTML = "";
    const anyOption = document.createElement("option");
    anyOption.value = "";
    anyOption.textContent = "Any";
    yearSelect.appendChild(anyOption);
    for (let year = currentYear + 1; year >= startYear; year--) {
      const option = document.createElement("option");
      option.value = year;
      option.textContent = year;
      yearSelect.appendChild(option);
    }
  }
  function updateAnimeList(append = false) {
    console.log("append: ", append);
    const searchInput = document.querySelector('.search-input[name="keyword"]');
    const genreSelect = document.querySelector('select[name="genre"]');
    const seasonSelect = document.querySelector('select[name="season"]');
    const yearSelect = document.querySelector('select[name="year"]');
    const formatSelect = document.querySelector('select[name="format"]');
    const statusSelect = document.querySelector('select[name="status"]');
    const sortSelect = document.querySelector('select[name="sort"]');
    const title = searchInput ? searchInput.value.trim() : "";
    const genre = genreSelect ? genreSelect.value : "";
    const seasonVal = seasonSelect && seasonSelect.value !== "Any" ? seasonSelect.value.toUpperCase() : null;
    const year = yearSelect && yearSelect.value ? parseInt(yearSelect.value) : null;
    let mappedFormat = void 0;
    if (formatSelect) {
      switch (formatSelect.value) {
        case "Any":
          mappedFormat = void 0;
          break;
        case "TV Show":
          mappedFormat = "TV";
          break;
        case "Movie":
          mappedFormat = "MOVIE";
          break;
        case "TV Short":
          mappedFormat = "TV_SHORT";
          break;
        case "Special":
          mappedFormat = "SPECIAL";
          break;
        case "OVA":
          mappedFormat = "OVA";
          break;
        case "ONA":
          mappedFormat = "ONA";
          break;
        default:
          mappedFormat = null;
      }
    }
    const statusMap = {
      "Any": null,
      "Airing": "RELEASING",
      "Finished": "FINISHED",
      "Not Yet Aired": "NOT_YET_RELEASED",
      "Cancelled": "CANCELLED"
    };
    const status = statusSelect && statusSelect.value in statusMap ? statusMap[statusSelect.value] : null;
    let sortVal = ["POPULARITY_DESC"];
    if (sortSelect) {
      switch (sortSelect.value) {
        case "Score":
          sortVal = ["SCORE_DESC"];
          break;
        case "Popularity":
          sortVal = ["POPULARITY_DESC"];
          break;
        case "Trending":
          sortVal = ["TRENDING_DESC"];
          break;
        case "Release Date":
          sortVal = ["START_DATE_DESC"];
          break;
        case "Updated Date":
          sortVal = ["UPDATED_AT_DESC"];
          break;
        case "Name":
        default:
          sortVal = ["POPULARITY_DESC"];
      }
    }
    const currentFilters = {
      title,
      genre,
      seasonVal,
      year,
      mappedFormat,
      status,
      sortVal: sortVal.toString()
      // Convert array to string for comparison
    };
    const filtersChanged = JSON.stringify(currentFilters) !== JSON.stringify(lastFilters);
    if (filtersChanged) {
      console.log("filters changed");
      currentPage = 1;
      lastFilters = currentFilters;
    }
    if (!append) {
      showPlaceholders();
    }
    const query = "\n    query($page:Int,$perPage:Int,$search:String,$genre:[String],$season:MediaSeason,$seasonYear:Int,$format:MediaFormat,$status:MediaStatus,$sort:[MediaSort]) {\n        Page(page:$page, perPage:$perPage) {\n            media(search:$search, genre_in:$genre, season:$season, seasonYear:$seasonYear, format:$format, status:$status, sort:$sort, type:ANIME) {\n                id\n                idMal\n                episodes\n                status\n                title {\n                    english\n                    romaji\n                }\n                coverImage {\n                    medium\n                    extraLarge\n                }\n                format\n                season\n                seasonYear\n                description(asHtml: false)\n                bannerImage\n                duration\n                nextAiringEpisode {\n                    airingAt\n                    timeUntilAiring\n                    episode\n                }\n                 trailer {\n                    site\n                }\n            }\n        }\n    }";
    const variables = {
      page: currentPage,
      perPage: 32,
      search: title || void 0,
      genre: genre || void 0,
      season: seasonVal || void 0,
      seasonYear: year || void 0,
      format: mappedFormat || void 0,
      status: status || void 0,
      sort: sortVal
    };
    Object.keys(variables).forEach((key) => {
      if (variables[key] === void 0) delete variables[key];
    });
    anilistAPI.makeRequest({ query, variables }).then((data) => {
      const animeList = data.data.Page.media;
      if (animeList.length > 0) {
        currentPage++;
      }
      displayAnime(animeList, append);
      isFetching = false;
    }).catch((error) => {
      console.error("Error fetching anime:", error);
      if (!append) displayAnime([]);
      isFetching = false;
    });
  }
  function showPlaceholders() {
    const grid = document.getElementById("anime-grid");
    grid.innerHTML = "";
    for (let i = 0; i < 32; i++) {
      const placeholder = document.createElement("div");
      placeholder.classList.add("placeholder-card");
      grid.appendChild(placeholder);
    }
  }
  function displayAnime(animeList, append = false) {
    const grid = document.getElementById("anime-grid");
    if (!append) {
      console.log("clearing grid in display anime");
      grid.innerHTML = "";
    }
    if (animeList.length === 0 && !append) {
      const msg = document.createElement("p");
      msg.style.color = "white";
      msg.textContent = "No results found.";
      grid.appendChild(msg);
      return;
    }
    if (animeList.length === 0 && append) {
      window.removeEventListener("scroll", handleInfiniteScroll);
    }
    animeList.forEach((anime) => {
      var _a, _b;
      const animeItem = document.createElement("div");
      animeItem.classList.add("anime-item");
      animeItem.dataset.id = anime.id;
      animeItem.dataset.idMal = anime.idMal;
      animeItem.dataset.title = anime.title.english || anime.title.romanji;
      animeItem.dataset.description = anime.description;
      animeItem.dataset.idtrailer = ((_a = anime.trailer) == null ? void 0 : _a.id) || "";
      animeItem.dataset.site = ((_b = anime.trailer) == null ? void 0 : _b.site) || "";
      if (!animeItem.dataset.id || !animeItem.dataset.site || animeItem.dataset.site != "youtube") {
        animeItem.dataset.bannerImage = anime.bannerImage || "";
      }
      animeItem.dataset.status = anime.status;
      animeItem.dataset.format = anime.format;
      animeItem.dataset.episodes = anime.episodes;
      animeItem.dataset.duration = anime.duration;
      animeItem.dataset.genres = anime.genres;
      const imageWrapper = document.createElement("div");
      imageWrapper.classList.add("image-wrapper");
      const img = document.createElement("img");
      img.src = anime.coverImage.extraLarge || anime.coverImage.medium;
      img.alt = anime.title.romaji;
      imageWrapper.appendChild(img);
      animeItem.appendChild(imageWrapper);
      const title = document.createElement("h3");
      title.textContent = anime.title.english || anime.title.romaji;
      animeItem.appendChild(title);
      grid.appendChild(animeItem);
    });
    addAnimeItemClickHandlers();
  }
  function addAnimeItemClickHandlers() {
    document.querySelectorAll(".anime-item").forEach((item) => {
      item.addEventListener("click", function(e) {
        e.preventDefault();
        const initialData = {
          id: this.dataset.id,
          title: this.dataset.title || "",
          status: this.dataset.status || "",
          format: this.dataset.format || "",
          isLoading: true
          // Flag to indicate data is still loading
        };
        sessionStorage.setItem("currentAnimeData", JSON.stringify(initialData));
        window.location.href = "watch.html?id=".concat(initialData.id);
      });
    });
  }
})();
//# sourceMappingURL=filter.js.map
