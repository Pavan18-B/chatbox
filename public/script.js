const socket = io();

const gate = document.getElementById('gate');
const chatRoom = document.getElementById('chat-room');
const joinForm = document.getElementById('join-form');
const chatForm = document.getElementById('chat-form');
const changeRoomPasswordForm = document.getElementById('change-room-password-form');
const roomTitleEl = document.getElementById('room-title');
const messageInput = document.getElementById('message-input');
const userNameInput = document.getElementById('user-name');
const roomNameInput = document.getElementById('room-name');
const roomPasswordInput = document.getElementById('room-password');
const settingsNameInput = document.getElementById('settings-name');
const privateCodeChangeInput = document.getElementById('private-code-change');
const newRoomPasswordInput = document.getElementById('new-room-password');
const messagesEl = document.getElementById('messages');
const errorMessage = document.getElementById('error-message');
const userTag = document.getElementById('user-tag');
const logoutBtn = document.getElementById('logout-btn');
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');
const clearChatBtn = document.getElementById('clear-chat-btn');

let currentUser = 'A';
let currentRoom = 'General';

function getNameBadge(name) {
  const text = String(name || 'A').trim();
  if (!text) return 'A';
  return text.charAt(0).toUpperCase();
}

function applyTheme() {
  document.body.setAttribute('data-theme', 'whatsapp');
}

function showMessage({ sender, text, time, type = 'message', self = false }) {
  const item = document.createElement('div');
  item.className = `message ${self ? 'self' : ''} ${type === 'system' ? 'system' : ''}`;

  if (type === 'system') {
    item.textContent = text;
    messagesEl.appendChild(item);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return;
  }

  const name = document.createElement('strong');
  name.textContent = sender;

  const body = document.createElement('div');
  body.textContent = text;

  const stamp = document.createElement('small');
  stamp.textContent = new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  item.appendChild(name);
  item.appendChild(body);
  item.appendChild(stamp);
  messagesEl.appendChild(item);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showChatRoom() {
  gate.classList.add('hidden');
  chatRoom.classList.remove('hidden');
  messageInput.focus();
}

function showGate() {
  chatRoom.classList.add('hidden');
  gate.classList.remove('hidden');
  userNameInput.focus();
}

joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = userNameInput.value.trim() || 'Guest';
  const room = roomNameInput.value.trim() || 'General';
  const roomPassword = roomPasswordInput.value.trim();

  errorMessage.classList.add('hidden');
  socket.emit('join', { name, room, roomPassword });
});

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const text = messageInput.value.trim();
  if (!text) {
    return;
  }

  socket.emit('chat-message', text);
  messageInput.value = '';
  messageInput.focus();
});

changeRoomPasswordForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const privateCode = privateCodeChangeInput.value.trim();
  const newRoomPassword = newRoomPasswordInput.value.trim();

  socket.emit('change-room-password', { privateCode, roomPassword: newRoomPassword });
  privateCodeChangeInput.value = '';
  newRoomPasswordInput.value = '';
});

settingsToggle.addEventListener('click', () => {
  settingsPanel.classList.toggle('hidden');
});

clearChatBtn.addEventListener('click', () => {
  socket.emit('clear-chat');
  settingsPanel.classList.add('hidden');
});

settingsNameInput.addEventListener('input', (event) => {
  const nextName = event.target.value.trim() || 'Guest';
  currentUser = nextName;
  userTag.textContent = getNameBadge(nextName);
  socket.emit('name-change', nextName);
});

logoutBtn.addEventListener('click', () => {
  currentUser = 'A';
  userTag.textContent = 'A';
  messagesEl.innerHTML = '';
  socket.disconnect();
  socket.connect();
  showGate();
});

socket.on('access-approved', ({ name, room }) => {
  currentUser = String(name || 'Guest').trim() || 'Guest';
  currentRoom = String(room || 'General').trim() || 'General';
  userTag.textContent = getNameBadge(currentUser);
  roomTitleEl.textContent = currentRoom;
  settingsNameInput.value = currentUser;
  showChatRoom();
});

socket.on('access-denied', () => {
  errorMessage.classList.remove('hidden');
});

socket.on('passcode-change-failed', (message) => {
  showMessage({ sender: 'System', text: message, time: Date.now(), type: 'system' });
});

socket.on('passcode-changed', ({ room }) => {
  showMessage({ sender: 'System', text: `Room password updated for ${room}.`, time: Date.now(), type: 'system' });
});

socket.on('chat-history', (history) => {
  messagesEl.innerHTML = '';
  history.forEach((entry) => {
    showMessage({
      sender: entry.sender,
      text: entry.text,
      time: entry.time,
      self: entry.sender === currentUser,
    });
  });
});

socket.on('chat-message', (message) => {
  const isSelf = message.sender === currentUser;
  showMessage({
    sender: message.sender,
    text: message.text,
    time: message.time,
    self: isSelf,
  });
});

socket.on('chat-cleared', () => {
  messagesEl.innerHTML = '';
  showMessage({ sender: 'System', text: 'The chat was cleared.', time: Date.now(), type: 'system' });
});

socket.on('system-message', (text) => {
  showMessage({ sender: 'System', text, time: Date.now(), type: 'system' });
});

applyTheme();
showGate();
