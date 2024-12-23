CREATE TABLE IF NOT EXISTS anime (
    anilist_id    INTEGER PRIMARY KEY,
    mal_id        INTEGER,
    anidb_id      INTEGER,
    english_title TEXT,
    romanji_title TEXT,
    episode_number INTEGER,
    format        TEXT
    -- any other fields, e.g. year, average_rating, etc.

    -- Optional indexes on these fields if you often look up by them:
    -- CREATE INDEX idx_anime_mal_id ON anime(mal_id);
    -- CREATE INDEX idx_anime_anidb_id ON anime(anidb_id);
);


CREATE TABLE IF NOT EXISTS episodes (
    anilist_id    INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    episode_title  TEXT,
    -- Possibly store "season_number" here if relevant

    PRIMARY KEY (anilist_id, episode_number),
    FOREIGN KEY (anilist_id) REFERENCES anime(anilist_id)
);


CREATE TABLE IF NOT EXISTS sources (
    source_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    anilist_id      INTEGER NOT NULL,
    episode_number  INTEGER NOT NULL,

    -- sub, dub, or both
    audio_type      TEXT NOT NULL,  
      -- e.g. "sub", "dub", "dual"

    -- category: "torrent", "http", or "nzb"
    category        TEXT NOT NULL,

    -- For torrent category
    magnet_link     TEXT,  -- if category = 'torrent'
    info_hash       TEXT,  -- optional
    file_index      INTEGER,  -- optional
    file_name       TEXT,  -- optional

    -- For http/hosted category
    video_url       TEXT,  -- if category = 'http'

    -- For nzb
    nzb_data        TEXT,  -- if category = 'nzb', might store path to .nzb or the actual data (base64)

    FOREIGN KEY (anilist_id, episode_number) REFERENCES episodes(anilist_id, episode_number)
);
