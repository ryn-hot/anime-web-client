// import React, { useState, useEffect } from 'react';

const AnimeStreamingUI = ({ 
  title = "Code Geass: Lelouch of the Rebellion",
  totalEpisodes = 25,
  currentEpisode = 1,
  seasons = [
    { number: 1, episodes: 25 },
    { number: 2, episodes: 25 }
  ],
  episodeRange = "001-025"
}) => {
  const [activeServer, setActiveServer] = React.useState(1);
  const [subtitleMode, setSubtitleMode] = React.useState(true);
  
  // Generate episode grid based on total episodes
  const generateEpisodeGrid = () => {
    const episodes = [];
    for (let i = 1; i <= totalEpisodes; i++) {
      episodes.push(
        <button 
          key={i} 
          className={`flex items-center justify-center w-12 h-12 rounded ${i === currentEpisode ? 'bg-orange-500 text-white' : 'hover:bg-gray-700'}`}
        >
          {i}
        </button>
      );
    }
    return episodes;
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="p-4 bg-gray-800">
        <div className="flex items-center space-x-2">
          <a href="#" className="flex items-center text-white">
            <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            Home
          </a>
          <span className="text-gray-500">/</span>
          <a href="#" className="text-white">TV</a>
          <span className="text-gray-500">/</span>
          <span className="text-gray-300">{title}</span>
        </div>
      </header>
      
      <div className="flex flex-col md:flex-row flex-1">
        {/* Main content */}
        <div className="flex-1 p-4">
          <div className="relative">
            {/* Video player */}
            <div className="relative aspect-video bg-black rounded-md overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <button className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Controls */}
            <div className="mt-4 flex items-center space-x-4 text-gray-400">
              <button className="flex items-center">
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                </svg>
                Expand
              </button>
              <button className="flex items-center">
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Focus
              </button>
              <button className="flex items-center text-orange-500">
                <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                </svg>
                AutoNext
              </button>
              <button className="flex items-center">
                <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                AutoPlay
              </button>
              <button className="flex items-center">
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
                AutoSkip
              </button>
              <button className="flex items-center">
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Prev
              </button>
              <button className="flex items-center">
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Next
              </button>
              <button className="flex items-center">
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                Bookmark
              </button>
              <button className="flex items-center">
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                W2G
              </button>
              <button className="flex items-center">
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                </svg>
                Report
              </button>
            </div>
            
            {/* Episode info */}
            <div className="mt-6">
              <div className="text-lg mb-2">You are watching Episode {currentEpisode}</div>
              
              <div className="text-sm text-gray-400 mb-4">
                If the current server is not working, please try switching to other servers.
              </div>
              
              <div className="flex space-x-2 mb-6">
                <button 
                  className={`px-4 py-2 rounded ${activeServer === 1 ? 'bg-green-600' : 'bg-gray-700'}`}
                  onClick={() => setActiveServer(1)}
                >
                  Server 1
                </button>
                <button 
                  className={`px-4 py-2 rounded ${activeServer === 2 ? 'bg-green-600' : 'bg-gray-700'}`}
                  onClick={() => setActiveServer(2)}
                >
                  Server 2
                </button>
                
                <div className="flex-1"></div>
                
                <button 
                  className={`px-4 py-2 rounded-l ${subtitleMode ? 'bg-orange-500 text-white' : 'bg-gray-700'}`}
                  onClick={() => setSubtitleMode(true)}
                >
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2h1v3a1 1 0 102 0v-3h1a1 1 0 100-2h-4z" clipRule="evenodd" />
                    </svg>
                    Sub
                  </span>
                </button>
                <button 
                  className={`px-4 py-2 rounded-r ${!subtitleMode ? 'bg-orange-500 text-white' : 'bg-gray-700'}`}
                  onClick={() => setSubtitleMode(false)}
                >
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2h1v3a1 1 0 102 0v-3h1a1 1 0 100-2h-4z" clipRule="evenodd" />
                    </svg>
                    Dub
                  </span>
                </button>
              </div>
            </div>
            
            {/* Seasons (if there are multiple) */}
            {seasons.length > 1 && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Seasons</h2>
                  <div className="flex space-x-2">
                    <button className="p-1 rounded bg-gray-700">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button className="p-1 rounded bg-gray-700">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {seasons.map(season => (
                    <div key={season.number} className="relative bg-gray-800 rounded overflow-hidden">
                      <div className="w-full h-24 bg-gray-700"></div>
                      <div className="p-2">
                        <div className="font-medium">Season {season.number}</div>
                        <div className="text-xs text-orange-500">{season.episodes} Eps</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="w-full md:w-72 p-4 bg-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Episodes</h2>
            <div className="flex space-x-2">
              <button className="p-1 text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              <button className="p-1 text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </button>
              <button className="p-1 text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="mb-4">
            <div className="w-full p-2 bg-gray-700 rounded text-center text-sm">
              {episodeRange}
            </div>
          </div>
          
          <div className="grid grid-cols-6 gap-2">
            {generateEpisodeGrid()}
          </div>
        </div>
      </div>
    </div>
  );
};

// Function to render the component 
function renderAnimeStreamingApp() {
  // Get URL parameters for anime data
  const urlParams = new URLSearchParams(window.location.search);
  const animeTitle = urlParams.get('title') || "Code Geass: Lelouch of the Rebellion";
  const episodeNumber = urlParams.get('episode') ? parseInt(urlParams.get('episode')) : 1;
  const totalEps = urlParams.get('totalEpisodes') ? parseInt(urlParams.get('totalEpisodes')) : 25;
  
  // Parse seasons if available
  let animeSeasons = [];
  try {
    animeSeasons = urlParams.get('seasons') ? JSON.parse(decodeURIComponent(urlParams.get('seasons'))) : [
      { number: 1, episodes: totalEps }
    ];
  } catch (e) {
    console.error("Failed to parse seasons:", e);
    animeSeasons = [{ number: 1, episodes: totalEps }];
  }
  
  // Generate episode range
  const episodeRange = urlParams.get('episodeRange') || 
    `${String(1).padStart(3, '0')}-${String(totalEps).padStart(3, '0')}`;
  
  // Render the component with the props
  const root = ReactDOM.createRoot(document.getElementById('anime-streaming-app'));
  root.render(
    <AnimeStreamingUI 
      title={animeTitle}
      currentEpisode={episodeNumber}
      totalEpisodes={totalEps}
      seasons={animeSeasons}
      episodeRange={episodeRange}
    />
  );
}

window.renderAnimeStreamingUI = function(animeData) {
  // Use provided data or fallback to URL params
  let props = animeData || {};
  
  if (!animeData) {
    // Original URL parameter logic if no data provided
    const urlParams = new URLSearchParams(window.location.search);
    props = {
      title: urlParams.get('title') || "Code Geass: Lelouch of the Rebellion",
      currentEpisode: urlParams.get('episode') ? parseInt(urlParams.get('episode')) : 1,
      totalEpisodes: urlParams.get('totalEpisodes') ? parseInt(urlParams.get('totalEpisodes')) : 25,
      episodeRange: urlParams.get('episodeRange') || "001-025"
    };
    
    // Parse seasons if available
    try {
      props.seasons = urlParams.get('seasons') 
        ? JSON.parse(decodeURIComponent(urlParams.get('seasons'))) 
        : [{ number: 1, episodes: props.totalEpisodes }];
    } catch (e) {
      console.error("Failed to parse seasons:", e);
      props.seasons = [{ number: 1, episodes: props.totalEpisodes }];
    }
  }
  
  // Render the component with the props
  const root = ReactDOM.createRoot(document.getElementById('anime-streaming-app'));
  root.render(<AnimeStreamingUI {...props} />);
};