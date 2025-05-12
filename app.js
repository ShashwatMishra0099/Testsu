// Initialize Supabase client
const SUPABASE_URL = 'https://kctklrigzowizlxlblat.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdGtscmlnem93aXpseGxibGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkxMDAxODgsImV4cCI6MjA1NDY3NjE4OH0.SiqrHjSbZsEEcqtkjnNPCgR839HJIeO_uqhYk7E83Hk';
const supabase = supabase_createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// UI elements
const entryDiv = document.getElementById('entry');
const roomDiv = document.getElementById('room');
const usernameInput = document.getElementById('username');
const createBtn = document.getElementById('create-room');
const joinBtn = document.getElementById('join-room');
const roomCodeInput = document.getElementById('room-code');
const currentCode = document.getElementById('current-code');
const currentUser = document.getElementById('current-user');
const participantsList = document.getElementById('participants');

let roomId = null;
let userName = '';

// Generate random room code
function generateCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

// Create room
createBtn.addEventListener('click', async () => {
  userName = usernameInput.value.trim();
  if (!userName) return alert('Enter name');

  const code = generateCode();
  const { data, error } = await supabase
    .from('rooms')
    .insert({ code, name: userName })
    .select('id, code');

  if (error) return console.error(error.message);
  roomId = data[0].id;
  showRoom(code);
  await addParticipant(roomId, userName);
});

// Join room
joinBtn.addEventListener('click', async () => {
  userName = usernameInput.value.trim();
  const code = roomCodeInput.value.trim().toUpperCase();
  if (!userName || !code) return alert('Enter name and room code');

  // lookup room
  const { data, error } = await supabase
    .from('rooms')
    .select('id')
    .eq('code', code)
    .single();
  if (error) return alert('Room not found');
  roomId = data.id;
  showRoom(code);
  await addParticipant(roomId, userName);
});

// Add participant
async function addParticipant(room_id, name) {
  const { error } = await supabase
    .from('participants')
    .insert({ room_id, name });
  if (error) return console.error(error.message);
  fetchParticipants();
  subscribeParticipants();
}

// Fetch current participants
async function fetchParticipants() {
  const { data, error } = await supabase
    .from('participants')
    .select('name')
    .eq('room_id', roomId);
  if (error) return console.error(error.message);

  participantsList.innerHTML = '';
  data.forEach(p => {
    const li = document.createElement('li');
    li.textContent = p.name;
    participantsList.appendChild(li);
  });
}

// Real-time updates
function subscribeParticipants() {
  supabase
    .from(`participants:room_id=eq.${roomId}`)
    .on('INSERT', payload => fetchParticipants())
    .subscribe();
}

// UI update
function showRoom(code) {
  entryDiv.style.display = 'none';
  roomDiv.style.display = 'block';
  currentCode.textContent = code;
  currentUser.textContent = userName;
}
