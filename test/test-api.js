const API_URL = 'https://graphql.anilist.co';

export async function fetchAniListData(query, variables) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const data = await response.json();
  if (response.ok) {
    return data.data;
  } else {
    throw new Error(data.errors[0].message);
  }
}

export async function getTrendingNow(page = 1, perPage = 16) {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(sort: TRENDING_DESC, type: ANIME) {
          id
          episodes
          title {
            romaji
            english
            native
          }
          nextAiringEpisode {
            airingAt
            timeUntilAiring
            episode
          }
          coverImage {
            large
          }
        }
      }
    }
  `;
  const variables = { page, perPage };
  return fetchAniListData(query, variables);
}

export async function getPopularThisSeason(page = 1, perPage = 16) {
  const currentDate = new Date();
  const month = currentDate.getMonth() + 1;
  let season;

  if (month >= 12 || month <= 2) {
    season = 'WINTER';
  } else if (month >= 3 && month <= 5) {
    season = 'SPRING';
  } else if (month >= 6 && month <= 8) {
    season = 'SUMMER';
  } else {
    season = 'FALL';
  }

  const seasonYear = currentDate.getFullYear();

  const query = `
    query ($page: Int, $perPage: Int, $season: MediaSeason, $seasonYear: Int) {
      Page(page: $page, perPage: $perPage) {
        media(season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC, type: ANIME) {
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
    }
  `;
  const variables = { page, perPage, season, seasonYear };
  return fetchAniListData(query, variables);
}

export async function getPopularAllTime(page = 1, perPage = 16) {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(sort: POPULARITY_DESC, type: ANIME) {
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
    }
  `;
  const variables = { page, perPage };
  return fetchAniListData(query, variables);
}

export async function getTopRated(page = 1, perPage = 16) {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(sort: SCORE_DESC, type: ANIME) {
          id
          episodes
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
    }
  `;
  const variables = { page, perPage };
  return fetchAniListData(query, variables);
}

async function alIdFetch(alID = 17) {
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
      nextAiringEpisode {
          airingAt
          timeUntilAiring
          episode
        }
    }
  }
  `

  const response = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      variables: { id: alID }
    })
  });
  const data = await response.json();
  console.log(data.data.Media);
  return data;

}

async function test_anidb() {
  const mappingsResponse = await fetch('https://api.ani.zip/mappings?anilist_id=' + 1);
  const json = await mappingsResponse.json();
  const ep = json?.episodeCount || -1;
  const anidbId = json?.mappings?.anidb_id || -1;
  // console.log(json);
  console.log(anidbId);

}

async function subTest() {
  const response = await fetch(`https://animeschedule.net/api/v3/anime/jujutsu-kaisen`);
  const json = await response.json();
  console.log(json);
}

function formatString(str) {
  return str
    .toLowerCase()
    // Replace special character and any following space with just a hyphen
    .replace(/[^a-z0-9\s]\s*/g, '-')
    // Replace remaining spaces with hyphens
    .replace(/\s+/g, '-')
    // Clean up multiple hyphens
    .replace(/-+/g, '-')
    // Remove any trailing/leading hyphens
    .replace(/^-+|-+$/g, '');
}



async function main() {
  // Test cases
  await test_anidb()
}



main();
