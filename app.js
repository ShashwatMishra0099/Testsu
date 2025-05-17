import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Initialize Supabase
const SUPABASE_URL = 'https://kctklrigzowizlxlblat.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdGtscmlnem93aXpseGxibGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkxMDAxODgsImV4cCI6MjA1NDY3NjE4OH0.SiqrHjSbZsEEcqtkjnNPCgR839HJIeO_uqhYk7E83Hk';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM elements
const entryView = document.getElementById('entry-view');
const roomView = document.getElementById('room-view');
const userNameInput = document.getElementById('user-name');
const createBtn = document.getElementById('create-btn');
const joinCodeInput = document.getElementById('join-code');
const joinBtn = document.getElementById('join-btn');
const roomCodeSpan = document.getElementById('room-code');
const hostNameSpan = document.getElementById('host-name');
const displayNameSpan = document.getElementById('display-name');
const participantList = document.getElementById('participant-list');
const playMusicBtn = document.getElementById('play-music-btn');
const stopMusicBtn = document.getElementById('stop-music-btn');
const audioElem = document.getElementById('room-audio');
const endBtn = document.getElementById('end-btn');
const leaveBtn = document.getElementById('leave-btn');

// State
let currentRoomId = null;
let currentUserName = null;
let currentOwnerName = null;
let currentRoomCode = null;
let pollInterval = null;
let participantSubscription = null;
let musicChannel = null;

// Utility functions
function generateCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function saveSession() {
  localStorage.setItem('roomId', currentRoomId);
  localStorage.setItem('userName', currentUserName);
  localStorage.setItem('ownerName', currentOwnerName);
  localStorage.setItem('roomCode', currentRoomCode);
}

function clearSession() {
  localStorage.removeItem('roomId');
  localStorage.removeItem('userName');
  localStorage.removeItem('ownerName');
  localStorage.removeItem('roomCode');
}

// Show the room view and start polling + music sync
function enterRoom(code, userName) {
  entryView.classList.add('hidden');
  roomCodeSpan.textContent = code;
  hostNameSpan.textContent = currentOwnerName;
  displayNameSpan.textContent = userName;
  endBtn.classList.toggle('hidden', userName !== currentOwnerName);
  roomView.classList.remove('hidden');
  saveSession();

  // Start polling participants every 10 seconds
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(loadParticipants, 10000);

  // Set up real-time music sync and controls
  setupMusicSync();
}

// Reset UI back to entry view
function resetToEntry() {
  // Unsubscribe from real-time channels
  if (participantSubscription) {
    supabase.removeChannel(participantSubscription);
    participantSubscription = null;
  }
  if (musicChannel) {
    supabase.removeChannel(musicChannel);
    musicChannel = null;
  }
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }

  clearSession();
  roomView.classList.add('hidden');
  entryView.classList.remove('hidden');
  participantList.innerHTML = '';
  userNameInput.value = '';
  joinCodeInput.value = '';
}

// Fetch participants and update list
async function loadParticipants() {
  const { data, error } = await supabase
    .from('participants')
    .select('user_name')
    .eq('room_id', currentRoomId);
  if (error) {
    console.error(error.message);
    return;
  }
  participantList.innerHTML = data
    .map(p => {
      const isHost = p.user_name === currentOwnerName;
      return `<li class="${isHost ? 'text-accent font-semibold' : ''}">${p.user_name}</li>`;
    })
    .join('');
}

// Set up polling + fallback real-time subscription
function subscribeToParticipants() {
  if (participantSubscription) {
    supabase.removeChannel(participantSubscription);
  }
  participantSubscription = supabase
    .from(`participants:room_id=eq.${currentRoomId}`)
    .on('INSERT', payload => loadParticipants())
    .subscribe();
}

// Add current user to participants table
async function addParticipant() {
  const { error } = await supabase
    .from('participants')
    .insert([{ room_id: currentRoomId, user_name: currentUserName }]);
  if (error) console.error(error.message);
}

// Create a new room (owner + participant)
createBtn.addEventListener('click', async () => {
  const name = userNameInput.value.trim();
  if (!name) return alert('Enter your name.');
  currentUserName = name;
  currentOwnerName = name;
  const code = generateCode();
  const { data, error } = await supabase
    .from('rooms')
    .insert([{ code, owner_name: name }])
    .select('id, code')
    .single();
  if (error) return alert(error.message);
  currentRoomId = data.id;
  currentRoomCode = data.code;
  enterRoom(data.code, name);
  await addParticipant();
  await loadParticipants();
  subscribeToParticipants();
});

// Join an existing room
joinBtn.addEventListener('click', async () => {
  const name = userNameInput.value.trim();
  const code = joinCodeInput.value.trim().toUpperCase();
  if (!name || !code) return alert('Enter both name and room code.');
  currentUserName = name;
  const { data, error } = await supabase
    .from('rooms')
    .select('id, code, owner_name')
    .eq('code', code)
    .single();
  if (error) return alert('Room not found.');
  currentRoomId = data.id;
  currentOwnerName = data.owner_name;
  currentRoomCode = data.code;
  enterRoom(data.code, name);
  await addParticipant();
  await loadParticipants();
  subscribeToParticipants();
});

// End the room (owner only)
endBtn.addEventListener('click', async () => {
  if (confirm('End this room?')) {
    await supabase.from('rooms').delete().eq('id', currentRoomId);
    resetToEntry();
  }
});

// Leave the room (participant only)
leaveBtn.addEventListener('click', async () => {
  await supabase
    .from('participants')
    .delete()
    .eq('room_id', currentRoomId)
    .eq('user_name', currentUserName);
  resetToEntry();
});

// Music synchronization and controls
function setupMusicSync() {
  // Subscribe to a broadcast channel for music events
  musicChannel = supabase
    .channel(`music-${currentRoomId}`)
    .on('broadcast', { event: 'playMusic' }, () => {
      audioElem.currentTime = 0;
      audioElem.play();
    })
    .on('broadcast', { event: 'stopMusic' }, () => {
      audioElem.pause();
      audioElem.currentTime = 0;
    })
    .subscribe();

  // Host controls
  if (currentUserName === currentOwnerName) {
    playMusicBtn.classList.remove('hidden');
    stopMusicBtn.classList.remove('hidden');
    playMusicBtn.addEventListener('click', () => {
      audioElem.currentTime = 0;
      audioElem.play();
      musicChannel.broadcast({ event: 'playMusic', payload: {} });
    });
    stopMusicBtn.addEventListener('click', () => {
      audioElem.pause();
      audioElem.currentTime = 0;
      musicChannel.broadcast({ event: 'stopMusic', payload: {} });
    });
  } else {
    playMusicBtn.classList.add('hidden');
    stopMusicBtn.classList.add('hidden');
  }
}

// Restore session on page load
document.addEventListener('DOMContentLoaded', async () => {
  const storedRoomId = localStorage.getItem('roomId');
  const storedName = localStorage.getItem('userName');
  const storedOwner = localStorage.getItem('ownerName');
  const storedCode = localStorage.getItem('roomCode');
  if (storedRoomId && storedName && storedOwner && storedCode) {
    currentRoomId = storedRoomId;
    currentUserName = storedName;
    currentOwnerName = storedOwner;
    currentRoomCode = storedCode;
    enterRoom(storedCode, storedName);
    await loadParticipants();
    subscribeToParticipants();
  }
});
