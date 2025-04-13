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

  // frontend/js/script.js
  var anilistAPI = new AniListAPI();
  function getCurrentSeason() {
    const month = (/* @__PURE__ */ new Date()).getMonth() + 1;
    if (month > 3 && month <= 6) return "SPRING";
    if (month >= 7 && month <= 9) return "SUMMER";
    if (month >= 10 && month <= 12) return "FALL";
    return "WINTER";
  }
  function fetchAndDisplayAnime(variables, containerId) {
    const query = "\n    query ($page: Int, $perPage: Int, $sort: [MediaSort], $season: MediaSeason, $seasonYear: Int, $genre: [String]) {\n        Page(page: $page, perPage: $perPage) {\n            media(sort: $sort, genre_in: $genre, season: $season, seasonYear: $seasonYear, type: ANIME) {\n                id\n                idMal\n                title {\n                    romaji\n                    english\n                    native\n                }\n                coverImage {\n                    large\n                    extraLarge\n                }\n                description(asHtml: false)\n                bannerImage\n                format,\n                status,\n                episodes,\n                duration,\n                genres,\n                nextAiringEpisode {\n                    airingAt\n                    timeUntilAiring\n                    episode\n                }\n                trailer {\n                    site\n                }\n            }\n        }\n    }";
    if (variables.genre) {
      variables.genre = [variables.genre];
    }
    anilistAPI.makeRequest({ query, variables }).then((data) => displayAnime(data, containerId)).catch((error) => console.error("Error fetching data:", error));
  }
  function displayAnime(data, containerId) {
    console.log("Display Anime Called");
    const animeList = data.data.Page.media;
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    animeList.forEach((anime) => {
      var _a, _b, _c, _d;
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
      animeItem.dataset.nextAiringEpisode = ((_c = anime.nextAiringEpisode) == null ? void 0 : _c.episode) || 0;
      animeItem.dataset.nextAiringEpisodeTimeUntil = ((_d = anime.nextAiringEpisode) == null ? void 0 : _d.timeUntilAiring) || 0;
      const imageWrapper = document.createElement("div");
      imageWrapper.classList.add("image-wrapper");
      const img = document.createElement("img");
      img.src = anime.coverImage.extraLarge || anime.coverImage.large;
      img.alt = anime.title.english || anime.title.romaji;
      imageWrapper.appendChild(img);
      animeItem.appendChild(imageWrapper);
      const animeTitle = document.createElement("h3");
      animeTitle.textContent = anime.title.english || anime.title.romaji;
      animeItem.appendChild(animeTitle);
      container.appendChild(animeItem);
    });
    addAnimeItemClickHandlers();
  }
  var genres = [];
  var genreData = {};
  var genreIndex = 0;
  var isAppendingGenres = false;
  var isGenreDataReady = false;
  var genresPerBatch = 4;
  function fetchGenres() {
    const query = "\n        query {\n            GenreCollection\n        }\n    ";
    return anilistAPI.makeRequest({ query }).then((data) => {
      const genres2 = data.data.GenreCollection;
      return genres2;
    }).catch((error) => {
      console.error("Error fetching genres:", error);
    });
  }
  function prefetchAllGenres() {
    console.log("prefetchAllGenres Called");
    return fetchGenres().then((g) => {
      genres = g;
      return fetchGenreAnimeData(genres);
    }).then((map) => {
      genreData = map;
      isGenreDataReady = true;
      console.log("All genre data prefetched!");
    });
  }
  async function fetchGenreAnimeData(genreList) {
    const start = performance.now();
    const query = "\n    query {\n        ".concat(genreList.map((genre, index) => "\n        g".concat(index, ': Page(page: 1, perPage: 20) {\n            media(genre_in: "').concat(genre, '", sort: POPULARITY_DESC, type: ANIME) {\n                id\n                title {\n                    romaji\n                    english\n                    native\n                }\n                coverImage {\n                    extraLarge\n                    large\n                }\n                description(asHtml: false)\n                bannerImage\n                format,\n                status,\n                episodes,\n                duration,\n                genres,\n                trailer {\n                    site\n                }\n            }\n        }')).join("\n"), "\n    }");
    console.log("fetchGenreAnimeData Called");
    try {
      const data = await anilistAPI.makeRequest({ query });
      const end = performance.now();
      console.log("api response time taken: ".concat(end - start));
      const map = {};
      genreList.forEach((genre, index) => {
        map[genre] = data.data["g".concat(index)].media;
      });
      return map;
    } catch (error) {
      console.error("Error fetching genre data:", error);
      return {};
    }
  }
  function showGenrePlaceholders(batchSize) {
    const mainContent = document.getElementById("main-content");
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < batchSize; i++) {
      const section = document.createElement("section");
      const titlePlaceholder = document.createElement("h2");
      titlePlaceholder.classList.add("section-title", "placeholder-title");
      const titleBar = document.createElement("div");
      titleBar.classList.add("placeholder-card");
      titleBar.style.width = "150px";
      titleBar.style.height = "30px";
      titlePlaceholder.appendChild(titleBar);
      section.appendChild(titlePlaceholder);
      const scrollContainer = document.createElement("div");
      scrollContainer.classList.add("scroll-container");
      const animeListDiv = document.createElement("div");
      animeListDiv.classList.add("anime-list");
      animeListDiv.style.display = "flex";
      animeListDiv.style.gap = "20px";
      for (let j = 0; j < 20; j++) {
        const placeholderCard = document.createElement("div");
        placeholderCard.classList.add("placeholder-card");
        placeholderCard.style.width = "150px";
        placeholderCard.style.height = "200px";
        placeholderCard.style.flexShrink = "0";
        animeListDiv.appendChild(placeholderCard);
      }
      scrollContainer.appendChild(animeListDiv);
      section.appendChild(scrollContainer);
      fragment.appendChild(section);
      section.style.marginBottom = "20px";
    }
    mainContent.appendChild(fragment);
  }
  function displayAnimeListFromMemory(animeList, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
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
      img.src = anime.coverImage.large;
      img.alt = anime.title.english || anime.title.romaji;
      imageWrapper.appendChild(img);
      animeItem.appendChild(imageWrapper);
      const animeTitle = document.createElement("h3");
      animeTitle.textContent = anime.title.english || anime.title.romaji;
      animeItem.appendChild(animeTitle);
      container.appendChild(animeItem);
    });
    addAnimeItemClickHandlers();
  }
  function appendGenreContainersFromMemory() {
    if (!isGenreDataReady) {
      console.log("Showing placeholders while waiting for genre data");
      showGenrePlaceholders(genresPerBatch);
      const checkInterval = setInterval(() => {
        if (isGenreDataReady) {
          clearInterval(checkInterval);
          const mainContent = document.getElementById("main-content");
          const existingPlaceholders = mainContent.querySelectorAll(".placeholder-card");
          existingPlaceholders.forEach((placeholder) => {
            placeholder.closest("section").remove();
          });
          appendRealGenreContainers();
        }
      }, 100);
      isAppendingGenres = false;
      return;
    }
    appendRealGenreContainers();
  }
  function appendRealGenreContainers() {
    const mainContent = document.getElementById("main-content");
    const end = Math.min(genreIndex + genresPerBatch, genres.length);
    const batch = genres.slice(genreIndex, end);
    const fragment = document.createDocumentFragment();
    const containersToPopulate = [];
    batch.forEach((genre, localIndex) => {
      const section = document.createElement("section");
      const h2 = document.createElement("h2");
      h2.classList.add("section-title");
      const a = document.createElement("a");
      a.href = "search.html?genre=".concat(encodeURIComponent(genre), "&sort=POPULARITY_DESC");
      a.textContent = genre;
      const i = document.createElement("i");
      i.classList.add("fas", "fa-chevron-right");
      a.appendChild(i);
      h2.appendChild(a);
      section.appendChild(h2);
      const scrollContainer = document.createElement("div");
      scrollContainer.classList.add("scroll-container");
      const leftButton = document.createElement("button");
      leftButton.classList.add("scroll-button", "left");
      const leftIcon = document.createElement("i");
      leftIcon.classList.add("fas", "fa-chevron-left");
      leftButton.appendChild(leftIcon);
      const rightButton = document.createElement("button");
      rightButton.classList.add("scroll-button", "right");
      const rightIcon = document.createElement("i");
      rightIcon.classList.add("fas", "fa-chevron-right");
      rightButton.appendChild(rightIcon);
      const containerId = "genre-".concat(genreIndex + localIndex, "-").concat(genre.replace(/\s+/g, "-"));
      const animeListDiv = document.createElement("div");
      animeListDiv.id = containerId;
      animeListDiv.classList.add("anime-list");
      leftButton.setAttribute("data-container", containerId);
      rightButton.setAttribute("data-container", containerId);
      scrollContainer.appendChild(leftButton);
      scrollContainer.appendChild(animeListDiv);
      scrollContainer.appendChild(rightButton);
      section.appendChild(scrollContainer);
      fragment.appendChild(section);
      containersToPopulate.push({
        genre,
        containerId,
        animeList: genreData[genre] || []
      });
    });
    mainContent.appendChild(fragment);
    containersToPopulate.forEach(({ containerId, animeList }) => {
      displayAnimeListFromMemory(animeList, containerId);
    });
    initializeScrollButtons();
    genreIndex = end;
    isAppendingGenres = false;
  }
  document.querySelectorAll(".scroll-button").forEach((button) => {
    const containerId = button.getAttribute("data-container");
    const container = document.getElementById(containerId);
    const direction = button.classList.contains("left") ? "left" : "right";
    button.addEventListener("mouseover", () => {
      const speed = direction === "left" ? -20 : 20;
      startAutoScroll(container, speed);
    });
    button.addEventListener("mouseout", () => {
      stopAutoScroll();
    });
    button.addEventListener("click", () => {
      stopAutoScroll();
      const scrollAmount = direction === "left" ? -container.offsetWidth : container.offsetWidth;
      container.scrollBy({
        left: scrollAmount,
        behavior: "smooth"
      });
    });
  });
  var autoScrollInterval;
  function startAutoScroll(container, speed) {
    stopAutoScroll();
    autoScrollInterval = setInterval(() => {
      container.scrollBy({
        left: speed,
        behavior: "auto"
      });
    }, 10);
  }
  function stopAutoScroll() {
    clearInterval(autoScrollInterval);
  }
  document.querySelectorAll(".anime-list").forEach((container) => {
    container.addEventListener("wheel", (event) => {
      event.preventDefault();
      let delta = event.deltaY;
      if (event.deltaMode === 1) {
        delta *= 16;
      } else if (event.deltaMode === 2) {
        delta *= container.clientHeight;
      }
      const scrollAmount = delta * 1;
      container.scrollLeft += scrollAmount;
    });
  });
  function fetchTopAnimeBanner() {
    const query = "\n    query ($page: Int, $perPage: Int, $sort: [MediaSort], $season: MediaSeason, $seasonYear: Int) {\n        Page(page: $page, perPage: $perPage) {\n            media(sort: $sort, type: ANIME, season: $season, seasonYear: $seasonYear) {\n                id\n                idMal\n                title {\n                    romaji\n                    english\n                }\n                description\n                bannerImage\n                genres\n                format\n                episodes\n                season\n                seasonYear\n                status,\n                duration,\n                nextAiringEpisode {\n                    airingAt\n                    timeUntilAiring\n                    episode\n                }\n            }\n        }\n    }";
    const variables = {
      page: 1,
      perPage: 4,
      // Fetch only the top anime
      sort: ["POPULARITY_DESC"],
      season: getCurrentSeason(),
      seasonYear: (/* @__PURE__ */ new Date()).getFullYear()
    };
    anilistAPI.makeRequest({ query, variables }).then((data) => {
      createBannerCarousel(data.data.Page.media);
    }).catch((error) => console.error("Error fetching banner data:", error));
  }
  function createBannerCarousel(animeList) {
    const bannerContainer = document.getElementById("banner");
    bannerContainer.innerHTML = "";
    const bannerWrapper = document.createElement("div");
    bannerWrapper.classList.add("banner-wrapper");
    bannerContainer.appendChild(bannerWrapper);
    const progressContainer = document.createElement("div");
    progressContainer.classList.add("progress-container");
    animeList.forEach((anime, index) => {
      const bannerSlide = document.createElement("div");
      bannerSlide.classList.add("banner-slide");
      bannerSlide.dataset.title = anime.title.english || anime.title.romaji;
      bannerSlide.dataset.id = anime.id;
      bannerSlide.dataset.idMal = anime.idMal;
      bannerSlide.dataset.episodes = anime.episodes;
      bannerSlide.dataset.status = anime.status;
      bannerSlide.dataset.format = anime.format;
      bannerSlide.dataset.duration = anime.duration;
      if (anime.nextAiringEpisode) {
        bannerSlide.dataset.nextAiringEpisode = anime.nextAiringEpisode.episode;
      }
      bannerSlide.style.backgroundImage = "linear-gradient(to right, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0) 80%), url(".concat(anime.bannerImage, ")");
      bannerSlide.style.backgroundSize = "cover";
      bannerSlide.style.backgroundPosition = "center";
      const bannerContent = document.createElement("div");
      bannerContent.classList.add("banner-content");
      const title = document.createElement("h1");
      title.classList.add("banner-title");
      title.textContent = anime.title.english || anime.title.romaji;
      bannerContent.appendChild(title);
      const info = document.createElement("p");
      info.classList.add("banner-info");
      const animeInfo = [];
      if (anime.format) animeInfo.push(anime.format);
      if (anime.episodes) animeInfo.push("".concat(anime.episodes, " Episodes"));
      if (anime.season && anime.seasonYear) animeInfo.push("".concat(anime.season, " ").concat(anime.seasonYear));
      info.textContent = animeInfo.join(" \xB7 ");
      bannerContent.appendChild(info);
      const description = document.createElement("p");
      description.classList.add("banner-description");
      description.textContent = anime.description ? anime.description.replace(/<[^>]*>?/gm, "").slice(0, 200) + "..." : "No description available.";
      bannerContent.appendChild(description);
      const genresInfo = document.createElement("p");
      genresInfo.classList.add("banner-genres");
      genresInfo.textContent = anime.genres.join(" \xB7 ");
      bannerContent.appendChild(genresInfo);
      const watchNowButton = document.createElement("button");
      watchNowButton.classList.add("banner-button");
      watchNowButton.textContent = "Watch Now";
      bannerContent.appendChild(watchNowButton);
      watchNowButton.addEventListener("click", async function() {
        const bannerSlide2 = this.closest(".banner-slide");
        if (!bannerSlide2) return;
        const animeId = bannerSlide2.dataset.id;
        const initialData = {
          id: bannerSlide2.dataset.id,
          title: bannerSlide2.dataset.title || "",
          status: bannerSlide2.dataset.status || "",
          format: bannerSlide2.dataset.format || "",
          isLoading: true
          // Flag to indicate data is still loading
        };
        sessionStorage.setItem("currentAnimeData", JSON.stringify(initialData));
        window.location.href = "watch.html?id=".concat(initialData.id);
      });
      bannerSlide.appendChild(bannerContent);
      bannerWrapper.appendChild(bannerSlide);
      const progressBar = document.createElement("div");
      progressBar.classList.add("progress-bar");
      if (index === 0) progressBar.classList.add("active");
      progressContainer.appendChild(progressBar);
      progressBar.addEventListener("click", () => {
        goToSlide(index);
      });
    });
    bannerContainer.appendChild(progressContainer);
    initAutoScrolling(bannerWrapper);
  }
  function initAutoScrolling(wrapper) {
    const slides = wrapper.querySelectorAll(".banner-slide");
    const progressBars = document.querySelectorAll(".progress-bar");
    let currentIndex = 0;
    const intervalTime = 1e4;
    let interval;
    function startProgressBar(index) {
      const activeBar = progressBars[index];
      const progressFill = document.createElement("div");
      progressFill.classList.add("progress-fill");
      activeBar.appendChild(progressFill);
      setTimeout(() => {
        progressFill.style.width = "100%";
        progressFill.style.transition = "width ".concat(intervalTime, "ms linear");
      }, 50);
    }
    function resetProgressBar(index) {
      const activeBar = progressBars[index];
      const progressFill = activeBar.querySelector(".progress-fill");
      if (progressFill) {
        progressFill.remove();
      }
    }
    function showSlide(index) {
      resetProgressBar(currentIndex);
      slides[currentIndex].classList.remove("active");
      progressBars[currentIndex].classList.remove("active");
      currentIndex = index;
      slides[currentIndex].classList.add("active");
      progressBars[currentIndex].classList.add("active");
      startProgressBar(currentIndex);
    }
    function showNextSlide() {
      let nextIndex = (currentIndex + 1) % slides.length;
      showSlide(nextIndex);
    }
    function resetInterval() {
      clearInterval(interval);
      interval = setInterval(showNextSlide, intervalTime);
    }
    progressBars.forEach((bar, index) => {
      bar.addEventListener("click", () => {
        showSlide(index);
        resetInterval();
      });
    });
    slides[currentIndex].classList.add("active");
    progressBars[currentIndex].classList.add("active");
    startProgressBar(currentIndex);
    interval = setInterval(showNextSlide, intervalTime);
  }
  async function fetchAllCategories() {
    try {
      await fetchAndDisplayAnime({
        page: 1,
        perPage: 20,
        sort: ["POPULARITY_DESC"],
        season: getCurrentSeason(),
        seasonYear: (/* @__PURE__ */ new Date()).getFullYear()
      }, "popular-this-season");
      await fetchAndDisplayAnime({
        page: 1,
        perPage: 20,
        sort: ["TRENDING_DESC"]
      }, "trending-now");
      await fetchAndDisplayAnime({
        page: 1,
        perPage: 20,
        sort: ["POPULARITY_DESC"]
      }, "popular-all-time");
      await fetchAndDisplayAnime({
        page: 1,
        perPage: 20,
        sort: ["SCORE_DESC"]
      }, "top-rated");
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  }
  console.log("Script started - before all functions");
  document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM Content Loaded Event Fired!");
    const menuButton = document.querySelector(".menu-button");
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.querySelector(".overlay");
    initializeScrollButtons();
    fetchTopAnimeBanner();
    fetchAllCategories();
    window.addEventListener("scroll", () => {
      highlightActiveLink();
      const scrollTop = window.scrollY;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.offsetHeight;
      const scrolledRatio = (scrollTop + windowHeight) / docHeight;
      if (scrolledRatio > 0.9 && !isAppendingGenres) {
        if (genreIndex < genres.length) {
          isAppendingGenres = true;
          appendGenreContainersFromMemory();
        }
      }
    });
    prefetchAllGenres();
    const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
    const currentSeason = getCurrentSeason();
    const popularThisSeasonLink = document.getElementById("popular-this-season-link");
    if (popularThisSeasonLink) {
      popularThisSeasonLink.href = "search.html?season=".concat(currentSeason, "&seasonYear=").concat(currentYear, "&sort=POPULARITY_DESC");
    }
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
    menuButton.addEventListener("click", () => {
      toggleSidebar();
    });
    overlay.addEventListener("click", closeSidebar);
    const searchButton = document.getElementById("search-button");
    if (searchButton) {
      searchButton.addEventListener("click", () => {
        const searchSelect = document.querySelector('.search-input[name="keyword"]');
        const searchValue = searchSelect ? searchSelect.value.trim() : "";
        window.location.href = "search.html".concat(searchValue ? "?search=".concat(encodeURIComponent(searchValue)) : "");
      });
    }
    const searchForm = document.querySelector(".search-content form");
    if (searchForm) {
      searchForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const searchSelect = document.querySelector('.search-input[name="keyword"]');
        const searchValue = searchSelect ? searchSelect.value.trim() : "";
        window.location.href = "search.html".concat(searchValue ? "?search=".concat(encodeURIComponent(searchValue)) : "");
      });
    }
    const filterButton = document.getElementById("filter-button");
    if (filterButton) {
      filterButton.addEventListener("click", () => {
        const searchSelect = document.querySelector('.search-input[name="keyword"]');
        const searchValue = searchSelect ? searchSelect.value.trim() : "";
        window.location.href = "search.html".concat(searchValue ? "?search=".concat(encodeURIComponent(searchValue)) : "");
      });
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeSidebar();
      }
    });
  });
  function highlightActiveLink() {
    const sections = document.querySelectorAll("main section");
    const sidebarLinks = document.querySelectorAll(".sidebar-menu li a");
    let index = sections.length;
    while (--index && window.scrollY + 50 < sections[index].offsetTop) {
    }
    sidebarLinks.forEach((link) => link.classList.remove("active"));
    if (sidebarLinks[index]) {
      sidebarLinks[index].classList.add("active");
    }
  }
  function initializeScrollButtons() {
    document.querySelectorAll(".scroll-button").forEach((button) => {
      const containerId = button.getAttribute("data-container");
      const container = document.getElementById(containerId);
      const direction = button.classList.contains("left") ? "left" : "right";
      button.removeEventListener("mouseover", handleMouseOverScroll);
      button.removeEventListener("mouseout", handleMouseOutScroll);
      button.removeEventListener("click", handleClickScroll);
      function handleMouseOverScroll() {
        const speed = direction === "left" ? -20 : 20;
        startAutoScroll(container, speed);
      }
      function handleMouseOutScroll() {
        stopAutoScroll();
      }
      function handleClickScroll() {
        stopAutoScroll();
        const scrollAmount = direction === "left" ? -container.offsetWidth : container.offsetWidth;
        container.scrollBy({
          left: scrollAmount,
          behavior: "smooth"
        });
      }
      button.addEventListener("mouseover", handleMouseOverScroll);
      button.addEventListener("mouseout", handleMouseOutScroll);
      button.addEventListener("click", handleClickScroll);
    });
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
  highlightActiveLink();
})();
//# sourceMappingURL=script.js.map
