import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Constants
const SUPABASE_URL = 'https://kctklrigzowizlxlblat.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdGtscmlnem93aXpseGxibGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkxMDAxODgsImV4cCI6MjA1NDY3NjE4OH0.SiqrHjSbZsEEcqtkjnNPCgR839HJIeO_uqhYk7E83Hk';
const MUSIC_URL = 'https://kctklrigzowizlxlblat.supabase.co/storage/v1/object/public/Test//sweet.mp3';

// Supabase client
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
const endBtn = document.getElementById('end-btn');
const playBtn = document.getElementById('play-btn');
const leaveBtn = document.getElementById('leave-btn');

// Audio element
const audioEl = document.getElementById('room-audio');
audioEl.src = MUSIC_URL;

// State
let currentRoomId = null;
let currentUserName = null;
let currentOwnerName = null;
let currentRoomCode = null;
let pollInterval = null;

// Utility: Generate code
function generateCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Session storage
function saveSession() {
  localStorage.setItem('roomId', currentRoomId);
  localStorage.setItem('userName', currentUserName);
  localStorage.setItem('ownerName', currentOwnerName);
  localStorage.setItem('roomCode', currentRoomCode);
}
function clearSession() {
  localStorage.clear();
}

// Enter room viewunction enterRoom(code, userName) {
  entryView.classList.add('hidden');
  roomView.classList.remove('hidden');
  roomCodeSpan.textContent = code;
  hostNameSpan.textContent = currentOwnerName;
  displayNameSpan.textContent = userName;
  // Show Play for host
  playBtn.classList.toggle('hidden', userName !== currentOwnerName);
  endBtn.classList.toggle('hidden', userName !== currentOwnerName);
  saveSession();
  // Start polling
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(loadParticipants, 10000);
  // Subscribe to events
  subscribeToParticipants();
  subscribeToRoomEvents();
}

// Reset to entry viewunction resetToEntry() {
  if (pollInterval) clearInterval(pollInterval);
  clearSession();
  roomView.classList.add('hidden');
  entryView.classList.remove('hidden');
  participantList.innerHTML = '';
  userNameInput.value = '';
  joinCodeInput.value = '';
}

// Load participantssync function loadParticipants() {
  const { data, error } = await supabase.from('participants').select('user_name').eq('room_id', currentRoomId);
  if (error) return console.error(error);
  participantList.innerHTML = data.map(p => {
    const isHost = p.user_name === currentOwnerName;
    return `<li class="${isHost ? 'text-accent font-semibold' : ''}">${p.user_name}</li>`;
  }).join('');
}

// Real-time subscriptions
function subscribeToParticipants() {
  supabase.from(`participants:room_id=eq.${currentRoomId}`)
    .on('INSERT', () => loadParticipants())
    .subscribe();
}
function subscribeToRoomEvents() {
  supabase.from(`room_events:room_id=eq.${currentRoomId}`)
    .on('INSERT', payload => {
      const evt = payload.new;
      if (evt.event_type === 'play_music') {
        audioEl.currentTime = 0;
        audioEl.play().catch(e => console.error(e));
      }
    })
    .subscribe();
}

// Add participantsync function addParticipant() {
  const { error } = await supabase.from('participants')
    .insert([{ room_id: currentRoomId, user_name: currentUserName }]);
  if (error) console.error(error);
}

// Create room
createBtn.addEventListener('click', async () => {
  const name = userNameInput.value.trim();
  if (!name) return alert('Enter name');
  currentUserName = name;
  currentOwnerName = name;
  const code = generateCode();
  const { data, error } = await supabase.from('rooms')
    .insert([{ code, owner_name: name }])
    .select('id, code')
    .single();
  if (error) return alert(error.message);
  currentRoomId = data.id;
  currentRoomCode = data.code;
  enterRoom(data.code, name);
  await addParticipant();
  await loadParticipants();
});

// Join room
joinBtn.addEventListener('click', async () => {
  const name = userNameInput.value.trim();
  const code = joinCodeInput.value.trim().toUpperCase();
  if (!name || !code) return alert('Enter both');
  currentUserName = name;
  const { data, error } = await supabase.from('rooms')
    .select('id, code, owner_name')
    .eq('code', code)
    .single();
  if (error) return alert('Room not found');
  currentRoomId = data.id;
  currentOwnerName = data.owner_name;
  currentRoomCode = data.code;
  enterRoom(data.code, name);
  await addParticipant();
  await loadParticipants();
});

// Play music (host)
playBtn.addEventListener('click', async () => {
  const { error } = await supabase.from('room_events')
    .insert([{ room_id: currentRoomId, event_type: 'play_music', payload: { url: MUSIC_URL } }]);
  if (error) console.error(error);
  audioEl.currentTime = 0;
  audioEl.play().catch(e => console.error(e));
});

// End & leave
endBtn.addEventListener('click', async () => {
  if (confirm('End room?')) {
    await supabase.from('rooms').delete().eq('id', currentRoomId);
    resetToEntry();
  }
});
leaveBtn.addEventListener('click', async () => {
  await supabase.from('participants').delete().eq('room_id', currentRoomId).eq('user_name', currentUserName);
  resetToEntry();
});

// Restore session
window.addEventListener('load', async () => {
  const stored = localStorage.getItem('roomId');
  if (!stored) return;
  currentRoomId = stored;
  currentUserName = localStorage.getItem('userName');
  currentOwnerName = localStorage.getItem('ownerName');
  currentRoomCode = localStorage.getItem('roomCode');
  enterRoom(currentRoomCode, currentUserName);
  await loadParticipants();
});
