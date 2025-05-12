const SUPA_URL = 'https://kctklrigzowizlxlblat.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdGtscmlnem93aXpseGxibGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkxMDAxODgsImV4cCI6MjA1NDY3NjE4OH0.SiqrHjSbZsEEcqtkjnNPCgR839HJIeO_uqhYk7E83Hk';
const supabase = supabase.createClient(SUPA_URL, SUPA_KEY);

function genRoomCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

document.getElementById('create-room').addEventListener('click', async () => {
  const name = document.getElementById('creator-name').value.trim();
  if (!name) return alert('Please enter your name');

  const code = genRoomCode();
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .insert({ room_code: code })
    .single();
  if (roomError) return alert(roomError.message);

  await supabase.from('room_users').insert({ room_id: room.id, user_name: name });

  document.getElementById('new-room-code').textContent = `Room Code: ${code}`;
  openRoom(code);
});

document.getElementById('join-room').addEventListener('click', async () => {
  const name = document.getElementById('join-name').value.trim();
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  if (!name || !code) return alert('Please enter both name and room code');

  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('room_code', code)
    .single();
  if (error || !room) return alert('Room not found');

  await supabase.from('room_users').insert({ room_id: room.id, user_name: name });
  openRoom(code);
});

async function openRoom(code) {
  const { data: room } = await supabase.from('rooms').select('id').eq('room_code', code).single();
  const { data: users } = await supabase
    .from('room_users')
    .select('user_name')
    .eq('room_id', room.id);

  document.getElementById('current-code').textContent = code;
  document.getElementById('create-form').classList.add('hidden');
  document.getElementById('join-form').classList.add('hidden');
  document.getElementById('room-view').classList.remove('hidden');

  const list = document.getElementById('users-list');
  list.innerHTML = '';
  users.forEach(u => {
    const li = document.createElement('li');
    li.textContent = u.user_name;
    list.appendChild(li);
  });

  supabase
    .from(`room_users:room_id=eq.${room.id}`)
    .on('INSERT', payload => {
      const li = document.createElement('li');
      li.textContent = payload.new.user_name;
      list.appendChild(li);
    })
    .subscribe();
}
