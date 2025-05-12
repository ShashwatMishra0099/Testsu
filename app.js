import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Supabase init
const SUPABASE_URL = 'https://kctklrigzowizlxlblat.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdGtscmlnem93aXpseGxibGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkxMDAxODgsImV4cCI6MjA1NDY3NjE4OH0.SiqrHjSbZsEEcqtkjnNPCgR839HJIeO_uqhYk7E83Hk';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM
const entryView = document.getElementById('entry-view');
const roomView = document.getElementById('room-view');
const userNameInput = document.getElementById('user-name');
const createBtn = document.getElementById('create-btn');
const joinCodeInput = document.getElementById('join-code');
const joinBtn = document.getElementById('join-btn');
const roomCodeSpan = document.getElementById('room-code');
const displayName = document.getElementById('display-name');
const participantList = document.getElementById('participant-list');
const endBtn = document.getElementById('end-btn');
const leaveBtn = document.getElementById('leave-btn');

let currentRoomId = null;
let currentUserName = null;
let currentOwnerName = null;

// Utility: random code
function generateCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Show room view
function enterRoom(code, name) {
  entryView.classList.add('hidden');
  roomCodeSpan.textContent = code;
  displayName.textContent = name;
  // show End Room only for owner
  endBtn.classList.toggle('hidden', name !== currentOwnerName);
  roomView.classList.remove('hidden');
}

// Load participants
async function loadParticipants() {
  const { data, error } = await supabase
    .from('participants')
    .select('user_name')
    .eq('room_id', currentRoomId);
  if (error) return console.error(error.message);
  participantList.innerHTML = data.map(p => `<li>${p.user_name}</li>`).join('');
}

// Subscribe to realtime inserts
function subscribeToParticipants() {
  supabase
    .channel(`room-${currentRoomId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'participants', filter: `room_id=eq.${currentRoomId}` }, loadParticipants)
    .subscribe();
}

// Add participant
async function addParticipant() {
  const { error } = await supabase
    .from('participants')
    .insert([{ room_id: currentRoomId, user_name: currentUserName }]);
  if (error) console.error(error.message);
}

// Create room
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
  enterRoom(data.code, name);
  await addParticipant();
  await loadParticipants();
  subscribeToParticipants();
});

// Join room
joinBtn.addEventListener('click', async () => {
  const name = userNameInput.value.trim();
  const code = joinCodeInput.value.trim().toUpperCase();
  if (!name || !code) return alert('Enter name and room code.');
  currentUserName = name;
  // get room id and owner
  const { data, error } = await supabase
    .from('rooms')
    .select('id, code, owner_name')
    .eq('code', code)
    .single();
  if (error) return alert('Room not found.');
  currentRoomId = data.id;
  currentOwnerName = data.owner_name;
  enterRoom(data.code, name);
  await addParticipant();
  await loadParticipants();
  subscribeToParticipants();
});

// End room (owner)
endBtn.addEventListener('click', async () => {
  if (confirm('End this room?')) {
    await supabase.from('rooms').delete().eq('id', currentRoomId);
    resetToEntry();
  }
});

// Leave room (participant)
leaveBtn.addEventListener('click', async () => {
  await supabase
    .from('participants')
    .delete()
    .eq('room_id', currentRoomId)
    .eq('user_name', currentUserName);
  resetToEntry();
});

// Reset UI
function resetToEntry() {
  roomView.classList.add('hidden');
  entryView.classList.remove('hidden');
  userNameInput.value = '';
  joinCodeInput.value = '';
  participantList.innerHTML = '';
}
