// Initialize Supabase
const supabaseUrl = 'https://kctklrigzowizlxlblat.supabase.co'; // Replace with your Supabase URL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdGtscmlnem93aXpseGxibGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkxMDAxODgsImV4cCI6MjA1NDY3NjE4OH0.SiqrHjSbZsEEcqtkjnNPCgR839HJIeO_uqhYk7E83Hk'; // Replace with your Supabase anon key
const supabase = Supabase.createClient(supabaseUrl, supabaseKey);

let roomCode;
let channel;
let offset = 0;

// Synchronize client clock with server
async function synchronizeClock() {
    const T1 = Date.now();
    const { data, error } = await supabase.rpc('get_current_time');
    if (error) {
        console.error('Error syncing clock:', error);
        return;
    }
    const T_server = new Date(data).getTime();
    const T2 = Date.now();
    const rtt = T2 - T1;
    offset = T_server - T2 + rtt / 2; // Calculate clock offset
}

// Run sync every 10 seconds and on load
setInterval(synchronizeClock, 10000);
synchronizeClock();

// Generate a random 6-character code
function generateCode(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
}

// Create a new room
async function createRoom() {
    let code;
    let attempts = 0;
    do {
        code = generateCode(6);
        const { data, error } = await supabase.from('rooms').insert([{
            code,
            music_url: 'https://kctklrigzowizlxlblat.supabase.co/storage/v1/object/public/Test//sweet.mp3' // Replace with your music file URL
        }]).select();
        if (!error) {
            localStorage.setItem(`isHost_${code}`, 'true');
            return code;
        }
        if (error.code !== '23505') throw error; // Not a duplicate code error
        attempts++;
        if (attempts > 5) throw new Error('Failed to create room after 5 attempts');
    } while (true);
}

// Join an existing room
async function joinRoom(code) {
    const { data, error } = await supabase.from('rooms').select('*').eq('code', code).single();
    if (error) {
        alert('Invalid room code');
        throw error;
    }
    const room = data;
    const audio = document.getElementById('audio');
    audio.src = room.music_url;
    if (room.is_playing && room.playback_start_time) {
        const T_now = new Date(await supabase.rpc('get_current_time').then(res => res.data)).getTime();
        const elapsed = (T_now - new Date(room.playback_start_time).getTime()) / 1000;
        audio.currentTime = elapsed > 0 ? elapsed : 0;
        audio.play();
    }
    return room;
}

// Start playback (host only)
async function startPlayback() {
    const T_now = new Date(await supabase.rpc('get_current_time').then(res => res.data));
    const T_start = new Date(T_now.getTime() + 5000); // Start in 5 seconds
    await supabase.from('rooms').update({
        is_playing: true,
        playback_start_time: T_start
    }).eq('code', roomCode);
    channel.send({
        type: 'broadcast',
        event: 'start_playback',
        T_start: T_start.toISOString()
    });
    schedulePlayback(T_start);
}

// Schedule playback on all devices
function schedulePlayback(T_start) {
    const audio = document.getElementById('audio');
    const localStartTime = new Date(T_start).getTime() - offset;
    const delay = localStartTime - Date.now();
    if (delay > 0) {
        setTimeout(() => audio.play(), delay);
    } else {
        audio.play();
    }
}

// Set up real-time channel
function setupChannel(code) {
    channel = supabase.channel(`room:${code}`);
    channel.on('broadcast', { event: 'start_playback' }, (payload) => {
        const T_start = new Date(payload.T_start);
        schedulePlayback(T_start);
    });
    channel.subscribe();
}

// UI Functions
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

function showCreateRoom() {
    showPage('create-room');
}

function showJoinRoom() {
    showPage('join-room');
}

async function handleCreateRoom() {
    try {
        roomCode = await createRoom();
        document.getElementById('room-code').textContent = `Room Code: ${roomCode}`;
        document.getElementById('go-to-room').disabled = false;
    } catch (error) {
        alert('Error creating room: ' + error.message);
    }
}

function goToRoom() {
    setupChannel(roomCode);
    showRoomPage(roomCode, true);
}

async function handleJoinRoom() {
    const code = document.getElementById('join-code').value.trim();
    if (!code) {
        alert('Please enter a room code');
        return;
    }
    try {
        await joinRoom(code);
        roomCode = code;
        setupChannel(code);
        showRoomPage(code, false);
    } catch (error) {
        console.error('Error joining room:', error);
    }
}

function showRoomPage(code, isHost) {
    showPage('room');
    document.getElementById('room-name').textContent = code;
    if (isHost || localStorage.getItem(`isHost_${code}`) === 'true') {
        document.getElementById('host-controls').style.display = 'block';
    }
}
