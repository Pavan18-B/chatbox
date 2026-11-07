const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MASTER_PRIVATE_CODE = '2103';
const roomPasswords = {};
const roomHistory = {};

function sanitizeName(name) {
  const nextName = String(name || 'Guest').trim();
  return nextName || 'Guest';
}

function sanitizeRoom(roomName) {
  const value = String(roomName || 'General').trim().replace(/\s+/g, ' ');
  return value || 'General';
}

function getRoomMessages(room) {
  if (!roomHistory[room]) {
    roomHistory[room] = [];
  }
  return roomHistory[room];
}

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  socket.data.name = 'Guest';
  socket.data.room = 'General';

  socket.on('join', ({ name, room, roomPassword }) => {
    const safeName = sanitizeName(name);
    const safeRoom = sanitizeRoom(room);
    const safeRoomPassword = String(roomPassword || '').trim();

    if (!(safeRoom in roomPasswords)) {
      roomPasswords[safeRoom] = safeRoomPassword || 'room123';
    }

    if (roomPasswords[safeRoom] !== safeRoomPassword) {
      socket.emit('access-denied');
      return;
    }

    socket.data.name = safeName;
    socket.data.room = safeRoom;
    socket.join(safeRoom);

    socket.emit('access-approved', { name: safeName, room: safeRoom });
    socket.emit('chat-history', getRoomMessages(safeRoom).slice(-50));
    socket.to(safeRoom).emit('system-message', `${safeName} joined ${safeRoom}.`);
  });

  socket.on('chat-message', (messageText) => {
    if (!socket.data.name || !socket.data.room) {
      return;
    }

    const text = String(messageText || '').trim();
    if (!text) {
      return;
    }

    const message = {
      sender: socket.data.name,
      text,
      time: new Date().toISOString(),
    };

    const roomMessages = getRoomMessages(socket.data.room);
    roomMessages.push(message);
    if (roomMessages.length > 80) {
      roomMessages.shift();
    }

    io.to(socket.data.room).emit('chat-message', message);
  });

  socket.on('name-change', (name) => {
    if (!socket.data.name) {
      return;
    }

    const safeName = sanitizeName(name);
    socket.data.name = safeName;
    socket.emit('access-approved', { name: safeName, room: socket.data.room });
  });

  socket.on('change-room-password', ({ privateCode, roomPassword }) => {
    if (!socket.data.room) {
      return;
    }

    const adminCode = String(privateCode || '').trim();
    const nextValue = String(roomPassword || '').trim();

    if (adminCode !== MASTER_PRIVATE_CODE) {
      socket.emit('passcode-change-failed', 'Private code is incorrect.');
      return;
    }

    if (!nextValue || nextValue.length < 4) {
      socket.emit('passcode-change-failed', 'New room password must be at least 4 characters.');
      return;
    }

    roomPasswords[socket.data.room] = nextValue;
    socket.emit('passcode-changed', { success: true, room: socket.data.room, password: nextValue });
    io.to(socket.data.room).emit('system-message', `Room password updated by admin.`);
    console.log(`Room ${socket.data.room} password changed using master code ${MASTER_PRIVATE_CODE}`);
  });

  socket.on('clear-chat', () => {
    if (!socket.data.room) {
      return;
    }

    roomHistory[socket.data.room] = [];
    io.to(socket.data.room).emit('chat-cleared');
    io.to(socket.data.room).emit('system-message', `${socket.data.name} cleared the chat.`);
  });

  socket.on('disconnect', () => {
    if (socket.data.room && socket.data.name) {
      socket.to(socket.data.room).emit('system-message', `${socket.data.name} left ${socket.data.room}.`);
    }
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', masterPrivateCode: MASTER_PRIVATE_CODE, rooms: Object.keys(roomPasswords) });
});

server.listen(PORT, () => {
  console.log(`Chat app running on http://localhost:${PORT}`);
  console.log(`Master private code is set in the app.`);
});
