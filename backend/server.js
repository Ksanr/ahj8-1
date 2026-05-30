const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let users = [];      // { id, name, ws }
let messages = [];   // { type, message, user, timestamp }

function getUserByWs(ws) {
  return users.find(u => u.ws === ws);
}

function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

function broadcastUsers() {
  const userList = users.map(u => ({ id: u.id, name: u.name }));
  broadcast({ type: 'users', users: userList });
}

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw);
      console.log('Message received:', data);
    } catch (err) {
      console.error('Invalid JSON', err);
      return;
    }

    if (data.type === 'join') {
      const { name } = data;
      if (users.some(u => u.name === name)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Никнейм уже занят' }));
        return;
      }
      const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
      const newUser = { id, name, ws };
      users.push(newUser);

      ws.send(JSON.stringify({
        type: 'join_success',
        user: { id, name },
        messages: messages.slice(-50)
      }));

      broadcast({ type: 'user_joined', user: { id, name } });
      broadcastUsers();
    }
    else if (data.type === 'send') {
      const user = getUserByWs(ws);
      if (!user) return;
      const messageData = {
        type: 'message',
        message: data.message,
        user: { id: user.id, name: user.name },
        timestamp: new Date().toISOString()
      };
      messages.push(messageData);
      if (messages.length > 100) messages.shift();
      broadcast(messageData);
    }
  });

  ws.on('close', () => {
    const user = getUserByWs(ws);
    if (user) {
      users = users.filter(u => u.id !== user.id);
      broadcast({ type: 'user_left', user: { id: user.id, name: user.name } });
      broadcastUsers();
    }
    console.log('Client disconnected');
  });
});

// ИСПРАВЛЕНИЕ ЗДЕСЬ: слушаем '0.0.0.0' и порт из окружения
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));