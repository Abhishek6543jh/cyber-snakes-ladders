// server.js - Real-time Socket.io and Express Server
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Serve static assets
app.use(express.static(path.join(__dirname, './')));

// In-memory Room State
// rooms[roomCode] = { code, status: 'setup'|'playing', players: [], hostId }
const rooms = {};

// Helper: Generate a unique room code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms[code]);
  return code;
}

// Fixed color order for players joining online
const COLOR_ORDER = ['blue', 'pink', 'green', 'yellow'];

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // 1. Create Room
  socket.on('create-room', ({ playerName }) => {
    const code = generateRoomCode();
    const player = {
      id: 1,
      socketId: socket.id,
      name: playerName || 'Host',
      color: COLOR_ORDER[0],
      position: 1,
      isBot: false,
      isHost: true
    };

    rooms[code] = {
      code: code,
      status: 'setup',
      players: [player],
      hostId: socket.id
    };

    socket.join(code);
    socket.emit('room-created', { code, player });
    io.to(code).emit('room-updated', rooms[code]);
    console.log(`Room created: ${code} by ${playerName} (${socket.id})`);
  });

  // 2. Join Room
  socket.on('join-room', ({ code, playerName }) => {
    const cleanCode = code.toUpperCase().trim();
    const room = rooms[cleanCode];

    if (!room) {
      socket.emit('error-msg', { message: 'Room not found. Check the code!' });
      return;
    }

    if (room.status === 'playing') {
      socket.emit('error-msg', { message: 'Game already in progress!' });
      return;
    }

    if (room.players.length >= 4) {
      socket.emit('error-msg', { message: 'Room is full (max 4 players)!' });
      return;
    }

    // Assign color based on position in lobby
    const playerColor = COLOR_ORDER[room.players.length];
    const player = {
      id: room.players.length + 1,
      socketId: socket.id,
      name: playerName || `Player ${room.players.length + 1}`,
      color: playerColor,
      position: 1,
      isBot: false,
      isHost: false
    };

    room.players.push(player);
    socket.join(cleanCode);
    
    socket.emit('room-joined', { code: cleanCode, player });
    io.to(cleanCode).emit('room-updated', room);
    console.log(`User ${playerName} (${socket.id}) joined room ${cleanCode}`);
  });

  // 3. Add AI Bot (Only host can add bots)
  socket.on('add-bot', ({ code, botName }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    if (room.players.length >= 4) return;

    const playerColor = COLOR_ORDER[room.players.length];
    const bot = {
      id: room.players.length + 1,
      socketId: `bot-${Date.now()}-${Math.random()}`,
      name: botName || `CyberBot-${room.players.length}`,
      color: playerColor,
      position: 1,
      isBot: true,
      isHost: false
    };

    room.players.push(bot);
    io.to(code).emit('room-updated', room);
  });

  // 4. Remove AI Bot or Player (Only host can kick)
  socket.on('kick-player', ({ code, playerId }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    
    const targetIdx = room.players.findIndex(p => p.id === playerId);
    if (targetIdx !== -1) {
      const removedPlayer = room.players.splice(targetIdx, 1)[0];
      
      // If it was a human socket, tell them they were kicked
      if (!removedPlayer.isBot) {
        io.to(removedPlayer.socketId).emit('kicked');
      }

      // Re-assign colors and IDs to maintain order
      room.players.forEach((p, idx) => {
        p.id = idx + 1;
        p.color = COLOR_ORDER[idx];
      });

      io.to(code).emit('room-updated', room);
    }
  });

  // 5. Start Game
  socket.on('start-game', ({ code }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;

    room.status = 'playing';
    io.to(code).emit('game-started', { players: room.players });
    console.log(`Game started in room ${code}`);
  });

  // 6. Roll Dice Sync
  socket.on('roll-dice', ({ code }) => {
    const room = rooms[code];
    if (!room || room.status !== 'playing') return;

    const rollValue = Math.floor(Math.random() * 6) + 1;
    // Broadcast the rolled value so everyone executes animations in sync
    io.to(code).emit('dice-rolled', { rollValue });
  });

  // 7. Update Positions (Called after animations finish on host, or from client)
  socket.on('update-positions', ({ code, players }) => {
    const room = rooms[code];
    if (!room) return;
    
    // Sync current positions
    room.players.forEach(p => {
      const matched = players.find(pNew => pNew.id === p.id);
      if (matched) p.position = matched.position;
    });

    io.to(code).emit('positions-synced', { players: room.players });
  });

  // 8. Log Event Sync
  socket.on('sync-log', ({ code, message, type }) => {
    io.to(code).emit('log-synced', { message, type, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) });
  });

  // 8.5. Quick-Chat Emoji Sync
  socket.on('send-emoji', ({ code, emoji, playerId }) => {
    io.to(code).emit('emoji-received', { emoji, playerId });
  });

  // 9. Reset Game
  socket.on('reset-game', ({ code }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;

    room.status = 'setup';
    room.players.forEach(p => {
      p.position = 1;
    });

    io.to(code).emit('game-reset');
  });

  // 10. Handle Disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Clean up rooms this user was in
    Object.keys(rooms).forEach((code) => {
      const room = rooms[code];
      const playerIdx = room.players.findIndex(p => p.socketId === socket.id);
      
      if (playerIdx !== -1) {
        const leavingPlayer = room.players[playerIdx];
        room.players.splice(playerIdx, 1);
        console.log(`Player ${leavingPlayer.name} left room ${code}`);

        if (room.players.length === 0) {
          // If room is empty, delete it
          delete rooms[code];
          console.log(`Deleted empty room ${code}`);
        } else {
          // Re-assign colors and IDs to remaining players
          room.players.forEach((p, idx) => {
            p.id = idx + 1;
            p.color = COLOR_ORDER[idx];
          });

          // If the host left, assign new host
          if (room.hostId === socket.id) {
            // Find first human player in lobby
            const nextHuman = room.players.find(p => !p.isBot);
            if (nextHuman) {
              room.hostId = nextHuman.socketId;
              nextHuman.isHost = true;
              io.to(nextHuman.socketId).emit('host-promoted');
              io.to(code).emit('sync-log', {
                message: `Host disconnected. ${nextHuman.name} is now the host!`,
                type: 'warn',
                time: new Date().toLocaleTimeString()
              });
            } else {
              // Only bots left, close room
              delete rooms[code];
              console.log(`Deleted bot-only room ${code}`);
              return;
            }
          }

          io.to(code).emit('room-updated', room);
          io.to(code).emit('sync-log', {
            message: `${leavingPlayer.name} disconnected from the lobby.`,
            type: 'warn',
            time: new Date().toLocaleTimeString()
          });
        }
      }
    });
  });
});

httpServer.listen(PORT, () => {
  console.log(`Cyber server running at http://localhost:${PORT}`);
});
