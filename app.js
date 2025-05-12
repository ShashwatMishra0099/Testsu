import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Initialize Supabase client
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
const displayName = document.getElementById('display-name');
const participantList = document.getElementById('participant-list');

let currentRoomId = null;
let currentUserName = null;

// Generate 6-char alphanumeric code
function generateCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Show the room view
function enterRoom(code, name) {
  entryView.classList.add('hidden');
  roomCodeSpan.textContent = code;
  displayName.textContent = name;
  roomView.classList.remove('hidden');
}

// Load existing participants
async function loadParticipants() {
  const { data, error } = await supabase
    .from('participants')
    .select('user_name')
    .eq('room_id', currentRoomId);
  if (error) return console.error(error.message);
  participantList.innerHTML = data.map(p => `<li>${p.user_name}</li>`).join('');
}

// Subscribe to new participants in real time
function subscribeToParticipants() {
  supabase
    .channel(`room-${currentRoomId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'participants', filter: `room_id=eq.${currentRoomId}`
    }, () => loadParticipants())
    .subscribe();
}

// Add current user as a participant
async function addParticipant() {
  const { error } = await supabase
    .from('participants')
    .insert([{ room_id: currentRoomId, user_name: currentUserName }]);
  if (error) console.error(error.message);
}

// Handle Create Room click
ecreateBtn.addEventListener('click', async () => {
  const name = userNameInput.value.trim();
  if (!name) return alert('Please enter your name.');
  currentUserName = name;
  const code = generateCode();
  const { data, error } = await supabase
    .from('rooms')
    .insert([{ code, owner_name: name }])
    .select('id, code')
    .single();
  if (error) return alert(error.message);
  currentRoomId = data.id;
  enterRoom(data.code, name);
  await addParticipant();
  await loadParticipants();
  subscribeToParticipants();
});

// Handle Join Room click
joinBtn.addEventListener('click', async () => {
  const name = userNameInput.value.trim();
  const code = joinCodeInput.value.trim().toUpperCase();
  if (!name || !code) return alert('Enter both name and room code.');
  currentUserName = name;
  const { data, error } = await supabase
    .from('rooms')
    .select('id, code')
    .eq('code', code)
    .single();
  if (error) return alert('Room not found.');
  currentRoomId = data.id;
  enterRoom(data.code, name);
  await addParticipant();
  await loadParticipants();
  subscribeToParticipants();
});
