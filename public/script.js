// Spotify Configuration
const SPOTIFY_CLIENT_ID = 'YOUR_SPOTIFY_CLIENT_ID';
const SPOTIFY_REDIRECT_URI = encodeURIComponent('http://localhost:3000/callback');
const SPOTIFY_SCOPES = [
  'user-read-private',
  'user-read-email',
  'streaming',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-library-read',
  'playlist-read-private'
].join(' ');

// Twitter Proxy Endpoint (Netlify Function)
const TWITTER_PROXY_URL = '/.netlify/functions/twitter-proxy';

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const mainApp = document.getElementById('main-app');
const spotifyLoginBtn = document.getElementById('spotify-login-btn');
const hashtagInput = document.getElementById('hashtag-input');
const searchBtn = document.getElementById('search-btn');
const tweetFeed = document.getElementById('tweet-feed');
const playlistsContainer = document.getElementById('playlists');
const miniPlayer = document.querySelector('.mini-player');
const fullPlayer = document.querySelector('.full-player');
const expandBtn = document.getElementById('expand-player');
const collapseBtn = document.getElementById('collapse-player');
const lyricsBtn = document.getElementById('lyrics-btn');
const lyricsPanel = document.querySelector('.lyrics-panel');
const lyricsText = document.getElementById('lyrics-text');
const progressBar = document.getElementById('progress-bar');
const currentTimeDisplay = document.getElementById('current-time');
const durationDisplay = document.getElementById('duration');

// Player State
let spotifyPlayer;
let currentTrack = null;
let isPlaying = false;
let progressInterval;
let deviceId;

// Initialize App
function init() {
  checkAuthState();
  setupEventListeners();
  loadSpotifySDK();
}

// Check if user is authenticated
function checkAuthState() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token') || localStorage.getItem('spotify_access_token');

  if (accessToken) {
    localStorage.setItem('spotify_access_token', accessToken);
    window.location.hash = '';
    loginScreen.classList.add('hidden');
    mainApp.classList.remove('hidden');
    initializePlayer(accessToken);
    fetchPlaylists(accessToken);
  }
}

// Load Spotify Web Playback SDK
function loadSpotifySDK() {
  const script = document.createElement('script');
  script.src = 'https://sdk.scdn.co/spotify-player.js';
  script.async = true;
  document.body.appendChild(script);
}

// Initialize Spotify Player
function initializePlayer(token) {
  window.onSpotifyWebPlaybackSDKReady = () => {
    spotifyPlayer = new Spotify.Player({
      name: 'Tweetify Player',
      getOAuthToken: cb => { cb(token); },
      volume: 0.5
    });

    // Connect to player
    spotifyPlayer.connect().then(success => {
      if (success) {
        console.log('Connected to Spotify player');
      }
    });

    // Player state updates
    spotifyPlayer.addListener('ready', ({ device_id }) => {
      console.log('Ready with Device ID', device_id);
      deviceId = device_id;
      transferPlayback(device_id, token);
    });

    spotifyPlayer.addListener('player_state_changed', state => {
      updatePlayerState(state);
    });

    spotifyPlayer.addListener('initialization_error', ({ message }) => {
      console.error('Initialization Error:', message);
    });

    spotifyPlayer.addListener('authentication_error', ({ message }) => {
      console.error('Auth Error:', message);
      localStorage.removeItem('spotify_access_token');
      window.location.reload();
    });

    spotifyPlayer.addListener('account_error', ({ message }) => {
      console.error('Account Error:', message);
    });
  };
}

// Transfer playback to our app
function transferPlayback(deviceId, token) {
  fetch('https://api.spotify.com/v1/me/player', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      device_ids: [deviceId],
      play: false
    })
  }).catch(error => console.error('Transfer error:', error));
}

// Update player UI based on state
function updatePlayerState(state) {
  if (!state) return;

  const { current_track, position, duration, paused } = state.track_window;
  
  // Update track info
  currentTrack = {
    name: current_track.name,
    artist: current_track.artists[0].name,
    albumArt: current_track.album.images[0].url,
    id: current_track.id
  };

  updateTrackInfo(currentTrack);
  isPlaying = !paused;

  // Update progress bar
  updateProgress(position, duration);

  // Update play/pause buttons
  document.getElementById('play-pause-btn').textContent = isPlaying ? '⏸' : '▶️';
  document.getElementById('play-pause-mini').textContent = isPlaying ? '⏸' : '▶️';

  // Start progress timer if playing
  if (isPlaying) {
    startProgressTimer(position, duration);
  } else {
    clearProgressTimer();
  }
}

// Update track information displays
function updateTrackInfo(track) {
  // Mini player
  document.getElementById('mini-track-name').textContent = track.name;
  document.getElementById('mini-artist-name').textContent = track.artist;
  document.getElementById('mini-album-art').src = track.albumArt;

  // Full player
  document.getElementById('track-name').textContent = track.name;
  document.getElementById('artist-name').textContent = track.artist;
  document.getElementById('album-art').src = track.albumArt;
}

// Update progress bar and time displays
function updateProgress(position, duration) {
  const progressPercent = (position / duration) * 100;
  progressBar.value = progressPercent;
  
  currentTimeDisplay.textContent = formatTime(position);
  durationDisplay.textContent = formatTime(duration);
}

// Format milliseconds to MM:SS
function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

// Start progress update timer
function startProgressTimer(position, duration) {
  clearProgressTimer();
  let currentPosition = position;
  
  progressInterval = setInterval(() => {
    currentPosition += 1000;
    if (currentPosition >= duration) {
      clearProgressTimer();
      return;
    }
    updateProgress(currentPosition, duration);
  }, 1000);
}

// Clear progress timer
function clearProgressTimer() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
}

// Fetch user's playlists
async function fetchPlaylists(token) {
  try {
    const response = await fetch('https://api.spotify.com/v1/me/playlists', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) throw new Error('Failed to fetch playlists');
    
    const data = await response.json();
    renderPlaylists(data.items);
  } catch (error) {
    console.error('Playlist fetch error:', error);
  }
}

// Render playlists
function renderPlaylists(playlists) {
  playlistsContainer.innerHTML = playlists.map(playlist => `
    <div class="playlist" data-id="${playlist.id}">
      <h3>${playlist.name}</h3>
      <div class="tracks">
        ${playlist.tracks.items.slice(0, 5).map(item => `
          <div class="track" 
               data-uri="${item.track.uri}"
               data-name="${item.track.name}"
               data-artist="${item.track.artists[0].name}"
               data-art="${item.track.album.images[0].url}"
               data-id="${item.track.id}">
            <img src="${item.track.album.images[0].url}" width="40">
            <span>${item.track.name} - ${item.track.artists[0].name}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// Fetch tweets by hashtag
async function fetchTweets(hashtag) {
  try {
    const response = await fetch(`${TWITTER_PROXY_URL}?query=%23${hashtag}`);
    
    if (!response.ok) throw new Error('Failed to fetch tweets');
    
    const data = await response.json();
    renderTweets(data.data || []);
  } catch (error) {
    console.error('Twitter fetch error:', error);
    tweetFeed.innerHTML = `<p class="error">Failed to load tweets. Try again later.</p>`;
  }
}

// Render tweets
function renderTweets(tweets) {
  tweetFeed.innerHTML = tweets.length > 0 
    ? tweets.map(tweet => `
        <div class="tweet">
          <p>${tweet.text}</p>
          ${extractHashtags(tweet.text)}
        </div>
      `).join('')
    : `<p>No tweets found. Try another search.</p>`;
}

// Extract hashtags from tweet text
function extractHashtags(text) {
  const hashtags = text.match(/#\w+/g) || [];
  return hashtags.map(tag => `
    <button class="hashtag" data-tag="${tag.slice(1)}">${tag}</button>
  `).join('');
}

// Fetch lyrics for current track
async function fetchLyrics(trackId, trackName, artistName) {
  try {
    lyricsText.textContent = "Loading lyrics...";
    
    // In a real app, you'd call a lyrics API here
    // This is a mock implementation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    lyricsText.textContent = `
${trackName} - ${artistName}

[Verse 1]
Mock lyrics line 1
Mock lyrics line 2

[Chorus]
Mock chorus line 1
Mock chorus line 2

[Verse 2]
Mock lyrics line 3
Mock lyrics line 4
`;
  } catch (error) {
    console.error('Lyrics fetch error:', error);
    lyricsText.textContent = "Couldn't load lyrics for this track.";
  }
}

// Setup event listeners
function setupEventListeners() {
  // Spotify login
  spotifyLoginBtn.addEventListener('click', () => {
    window.location.href = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=token&redirect_uri=${SPOTIFY_REDIRECT_URI}&scope=${SPOTIFY_SCOPES}`;
  });

  // Twitter search
  searchBtn.addEventListener('click', () => {
    const hashtag = hashtagInput.value.trim().replace('#', '');
    if (hashtag) fetchTweets(hashtag);
  });

  hashtagInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchBtn.click();
  });

  // Player controls
  document.getElementById('play-pause-btn').addEventListener('click', togglePlay);
  document.getElementById('play-pause-mini').addEventListener('click', togglePlay);
  document.getElementById('prev-btn').addEventListener('click', () => spotifyPlayer.previousTrack());
  document.getElementById('next-btn').addEventListener('click', () => spotifyPlayer.nextTrack());
  
  // Player expand/collapse
  expandBtn.addEventListener('click', () => {
    fullPlayer.classList.remove('collapsed');
  });

  collapseBtn.addEventListener('click', () => {
    fullPlayer.classList.add('collapsed');
  });

  // Lyrics toggle
  lyricsBtn.addEventListener('click', () => {
    lyricsPanel.classList.toggle('hidden');
    if (!lyricsPanel.classList.contains('hidden')) {
      fetchLyrics(currentTrack.id, currentTrack.name, currentTrack.artist);
    }
  });

  // Progress bar seeking
  progressBar.addEventListener('input', (e) => {
    const seekPosition = (e.target.value / 100) * parseInt(durationDisplay.textContent.replace(':', '')) * 1000;
    spotifyPlayer.seek(seekPosition);
  });

  // Play track when clicked
  document.addEventListener('click', (e) => {
    if (e.target.closest('.track')) {
      const trackElement = e.target.closest('.track');
      const trackUri = trackElement.dataset.uri;
      const accessToken = localStorage.getItem('spotify_access_token');
      
      fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uris: [trackUri]
        })
      }).catch(error => console.error('Play error:', error));
    }
    
    if (e.target.classList.contains('hashtag')) {
      const hashtag = e.target.dataset.tag;
      hashtagInput.value = `#${hashtag}`;
      fetchTweets(hashtag);
    }
  });
}

// Toggle play/pause
function togglePlay() {
  spotifyPlayer.togglePlay();
}

// Initialize the app
init();