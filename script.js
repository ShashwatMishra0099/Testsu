const supabase = supabase.createClient('https://kctklrigzowizlxlblat.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdGtscmlnem93aXpseGxibGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkxMDAxODgsImV4cCI6MjA1NDY3NjE4OH0.SiqrHjSbZsEEcqtkjnNPCgR839HJIeO_uqhYk7E83Hk');

// Show create room form
document.getElementById('create-room-btn').addEventListener('click', () => {
  document.getElementById('main-menu').style.display = 'none';
  document.getElementById('create-room-form').style.display = 'block';
});

// Show join room form
document.getElementById('join-room-btn').addEventListener('click', () => {
  document.getElementById('main-menu').style.display = 'none';
  document.getElementById('join-room-form').style.display = 'block';
});

// Handle room creation
document.getElementById('create-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('create-name').value;
  if (!name) {
    alert('Please enter your name');
    return;
  }

  let roomCode;
  let success = false;
  while (!success) {
    roomCode = generateRoomCode();
    const { data, error } = await supabase
      .from('rooms')
      .insert([{ room_code: roomCode }])
      .select();
    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        continue;
      } else {
        alert('Error creating room: ' + error.message);
        return;
      }
    } else {
      success = true;
      const roomId = data[0].id;
      const { error: participantError } = await supabase
        .from('participants')
        .insert([{ room_id: roomId, user_name: name }]);
      if (participantError) {
        alert('Error adding participant: ' + participantError.message);
        return;
      }
      document.getElementById('create-room-form').style.display = 'none';
      document.getElementById('room-page').style.display = 'block';
      document.getElementById('room-code').textContent = roomCode;
      loadParticipants(roomId);
      supabase
        .from(`participants:room_id=eq.${roomId}`)
        .on('INSERT', payload => {
          const newParticipant = payload.new;
          const li = document.createElement('li');
          li.textContent = newParticipant.user_name;
          document.getElementById('participants-list').appendChild(li);
        })
        .subscribe();
    }
  }
});

// Handle joining a room
document.getElementById('join-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = document.getElementById('join-code').value;
  const name = document.getElementById('join-name').value;
  if (!code || !name) {
    alert('Please enter room code and your name');
    return;
  }

  const { data: rooms, error: roomError } = await supabase
    .from('rooms')
    .select('id')
    .eq('room_code', code);
  if (roomError) {
    alert('Error fetching room: ' + roomError.message);
    return;
  }
  if (rooms.length === 0) {
    alert('Room not found');
    return;
  }

  const roomId = rooms[0].id;
  const { error: participantError } = await supabase
    .from('participants')
    .insert([{ room_id: roomId, user_name: name }]);
  if (participantError) {
    alert('Error joining room: ' + participantError.message);
    return;
  }

  document.getElementById('join-room-form').style.display = 'none';
  document.getElementById('room-page').style.display = 'block';
  document.getElementById('room-code').textContent = code;
  loadParticipants(roomId);
  supabase
    .from(`participants:room_id=eq.${roomId}`)
    .on('INSERT', payload => {
      const newParticipant = payload.new;
      const li = document.createElement('li');
      li.textContent = newParticipant.user_name;
      document.getElementById('participants-list').appendChild(li);
    })
    .subscribe();
});

// Generate a random 6-character room code
function generateRoomCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

// Load and display participants
async function loadParticipants(roomId) {
  const { data, error } = await supabase
    .from('participants')
    .select('user_name')
    .eq('room_id', roomId);
  if (error) {
    alert('Error loading participants: ' + error.message);
    return;
  }
  const list = document.getElementById('participants-list');
  list.innerHTML = '';
  data.forEach(participant => {
    const li = document.createElement('li');
    li.textContent = participant.user_name;
    list.appendChild(li);
  });
}
