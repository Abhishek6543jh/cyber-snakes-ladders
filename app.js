// app.js - Main game controller and UI orchestrator (Holo-Table & Live Networking)
import { audio } from './audio.js';
import { confetti } from './confetti.js';
import { GameEngine, PLAYER_COLORS } from './game.js';
import { getTileCoordinates, getBoardCoordinates, renderBoardSVGs } from './board.js';

class AppController {
  constructor() {
    this.game = new GameEngine();
    this.boardPaths = {}; // snake ID to pathD mappings
    this.isDiceRolling = false;
    this.isTokenMoving = false;
    
    // Confetti timer
    this.confettiInterval = null;

    // Networking State
    this.socket = null;
    this.isOnlineMode = false;
    this.roomCode = null;
    this.myPlayerId = null; // 1, 2, 3, or 4
    this.isHost = false;

    // Turn Countdown Timer State
    this.secondsLeft = 15;
    this.timerInterval = null;

    // Cache DOM Elements
    this.audioToggle = document.getElementById('audio-toggle');
    this.audioIconOn = document.getElementById('audio-icon-on');
    this.audioIconOff = document.getElementById('audio-icon-off');
    this.audioStatusText = document.getElementById('audio-status-text');

    this.musicToggle = document.getElementById('music-toggle');
    this.musicStatusText = document.getElementById('music-status-text');

    this.setupScreen = document.getElementById('setup-screen');
    this.playScreen = document.getElementById('play-screen');
    this.winnerScreen = document.getElementById('winner-screen');
    
    // Tabs & Lobby Panels
    this.tabsHeader = document.getElementById('setup-tabs-header');
    this.tabBtnLocal = document.getElementById('tab-btn-local');
    this.tabBtnOnline = document.getElementById('tab-btn-online');
    this.tabContentLocal = document.getElementById('tab-content-local');
    this.tabContentOnline = document.getElementById('tab-content-online');
    this.lobbyPanel = document.getElementById('lobby-panel');

    // Setup Local
    this.setupForm = document.getElementById('setup-form');
    this.setupPlayersContainer = document.getElementById('setup-players-container');
    
    // Setup Online
    this.onlineNicknameInput = document.getElementById('online-nickname');
    this.btnCreateLobby = document.getElementById('btn-create-lobby');
    this.btnJoinLobby = document.getElementById('btn-join-lobby');
    this.joinRoomCodeInput = document.getElementById('join-room-code');

    // Lobby Waiting Area
    this.lobbyCodeVal = document.getElementById('lobby-code-val');
    this.lobbyCountVal = document.getElementById('lobby-count-val');
    this.lobbyPlayersContainer = document.getElementById('lobby-players-container');
    this.lobbyHostControls = document.getElementById('lobby-host-controls');
    this.lobbyAddBotBtn = document.getElementById('lobby-add-bot-btn');
    this.lobbyStartBtn = document.getElementById('lobby-start-btn');
    this.lobbyGuestMsg = document.getElementById('lobby-guest-msg');
    this.lobbyLeaveBtn = document.getElementById('lobby-leave-btn');

    // Board & Play Screen
    this.boardGrid = document.getElementById('board-grid');
    this.boardSvg = document.getElementById('board-svg');
    this.tokensLayer = document.getElementById('tokens-layer');
    this.scoreboardList = document.getElementById('scoreboard-list');
    this.activePlayerName = document.getElementById('active-player-name');
    this.timerBarFill = document.getElementById('timer-bar-fill');
    this.dice3d = document.getElementById('dice-3d');
    this.diceTrigger = document.getElementById('dice-trigger');
    this.logsContent = document.getElementById('logs-content');
    this.playRoomCodeTag = document.getElementById('play-room-code-tag');
    
    // Winner
    this.winnerName = document.getElementById('winner-name');
    this.restartGameBtn = document.getElementById('restart-game-btn');

    this.playerCount = 3;
  }

  init() {
    // Setup audio controls
    this.audioToggle.addEventListener('click', () => this.toggleAudio());
    this.musicToggle.addEventListener('click', () => this.toggleMusic());
    
    // Setup local player count selector
    const countBtns = document.querySelectorAll('.btn-count');
    countBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        countBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.playerCount = parseInt(e.target.dataset.count);
        this.renderSetupPlayers();
        audio.playClick();
      });
    });

    // Local / Online Tabs switching
    this.tabBtnLocal.addEventListener('click', () => this.switchTab('local'));
    this.tabBtnOnline.addEventListener('click', () => this.switchTab('online'));

    // Lobby Creation & Joining
    this.btnCreateLobby.addEventListener('click', () => this.createOnlineLobby());
    this.btnJoinLobby.addEventListener('click', () => this.joinOnlineLobby());
    this.lobbyAddBotBtn.addEventListener('click', () => this.addBotToLobby());
    this.lobbyStartBtn.addEventListener('click', () => this.startOnlineGame());
    this.lobbyLeaveBtn.addEventListener('click', () => this.leaveLobby());

    // Quick-Chat Reaction Emojis
    const emojiBtns = document.querySelectorAll('.btn-emoji-chat');
    emojiBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.sendEmojiReaction(e.target.dataset.emoji);
      });
    });

    // Initial render for local players setup form
    this.renderSetupPlayers();

    // Setup form submit (Local Game Start)
    this.setupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.startLocalGame();
    });

    // Dice click roll
    this.diceTrigger.addEventListener('click', () => {
      this.handleUserRoll();
    });

    // Restart game
    this.restartGameBtn.addEventListener('click', () => this.handleRestart());

    // Initialize confetti
    const canvas = document.getElementById('confetti-canvas');
    confetti.init(canvas);
  }

  toggleAudio() {
    audio.init();
    audio.enabled = !audio.enabled;
    if (audio.enabled) {
      this.audioIconOn.classList.remove('hidden');
      this.audioIconOff.classList.add('hidden');
      this.audioStatusText.textContent = "SFX On";
      audio.playClick();
    } else {
      this.audioIconOn.classList.add('hidden');
      this.audioIconOff.classList.remove('hidden');
      this.audioStatusText.textContent = "SFX Off";
    }
  }

  toggleMusic() {
    audio.init();
    const isPlaying = audio.toggleMusic();
    if (isPlaying) {
      this.musicStatusText.textContent = "Music On";
      this.musicToggle.style.color = 'var(--neon-blue)';
      this.musicToggle.style.borderColor = 'var(--neon-blue)';
      this.musicToggle.style.boxShadow = '0 0 10px var(--glow-blue)';
    } else {
      this.musicStatusText.textContent = "Music Off";
      this.musicToggle.style.color = '';
      this.musicToggle.style.borderColor = '';
      this.musicToggle.style.boxShadow = '';
    }
  }

  switchTab(tab) {
    audio.init();
    audio.playClick();

    if (tab === 'local') {
      this.isOnlineMode = false;
      this.tabBtnLocal.classList.add('active');
      this.tabBtnOnline.classList.remove('active');
      this.tabContentLocal.classList.remove('hidden');
      this.tabContentOnline.classList.add('hidden');
    } else {
      this.isOnlineMode = true;
      this.tabBtnLocal.classList.remove('active');
      this.tabBtnOnline.classList.add('active');
      this.tabContentLocal.classList.add('hidden');
      this.tabContentOnline.classList.remove('hidden');
    }
  }

  renderSetupPlayers() {
    this.setupPlayersContainer.innerHTML = '';
    const colors = ['blue', 'pink', 'green', 'yellow'];
    
    const botAdjectives = ['Mega', 'Ultra', 'Nano', 'Cyber', 'Delta', 'Beta', 'Hyper'];
    const botNouns = ['Core', 'Grid', 'Blade', 'Pixel', 'Pulse', 'Byte', 'Glitch'];

    for (let i = 0; i < this.playerCount; i++) {
      const color = colors[i];
      const isBot = i > 0; // default player 1 is human, others are bots

      const card = document.createElement('div');
      card.className = 'setup-card';
      card.dataset.color = color;

      const defaultName = isBot 
        ? `${botAdjectives[Math.floor(Math.random() * botAdjectives.length)]}${botNouns[Math.floor(Math.random() * botNouns.length)]}`
        : `Player ${i + 1}`;

      card.innerHTML = `
        <div class="player-label">
          <div class="color-dot" style="color: ${PLAYER_COLORS[color].hex}"></div>
          <span>${PLAYER_COLORS[color].name}</span>
        </div>
        <input type="text" class="setup-input" placeholder="Enter name" value="${defaultName}" required>
        <select class="setup-select">
          <option value="human" ${!isBot ? 'selected' : ''}>Human Player</option>
          <option value="bot" ${isBot ? 'selected' : ''}>AI Bot</option>
        </select>
      `;

      this.setupPlayersContainer.appendChild(card);
    }
  }

  // --- ONLINE SOCKET CONNECTIONS ---
  connectSocket() {
    if (this.socket) return;
    
    this.socket = io({ transports: ['websocket'] });

    this.socket.on('room-created', ({ code, player }) => {
      this.roomCode = code;
      this.myPlayerId = player.id;
      this.isHost = true;
      this.showLobbyPanel(true);
    });

    this.socket.on('room-joined', ({ code, player }) => {
      this.roomCode = code;
      this.myPlayerId = player.id;
      this.isHost = false;
      this.showLobbyPanel(false);
    });

    this.socket.on('room-updated', (room) => {
      this.renderLobbyPlayers(room);
    });

    this.socket.on('game-started', ({ players }) => {
      this.launchOnlineGame(players);
    });

    this.socket.on('dice-rolled', ({ rollValue }) => {
      this.executeOnlineRoll(rollValue);
    });

    this.socket.on('positions-synced', ({ players }) => {
      this.game.players.forEach(p => {
        const synced = players.find(sp => sp.id === p.id);
        if (synced) p.position = synced.position;
      });
      this.updateTokensLayer();
      this.updateScoreboard();
    });

    this.socket.on('log-synced', (log) => {
      this.game.logs.unshift(log);
      this.updateLogs();
    });

    this.socket.on('emoji-received', ({ emoji, playerId }) => {
      this.showFloatingEmoji(emoji, playerId);
    });

    this.socket.on('game-reset', () => {
      this.resetOnlineGame();
    });

    this.socket.on('kicked', () => {
      alert("You have been removed from the room by the host.");
      this.leaveLobby();
    });

    this.socket.on('host-promoted', () => {
      this.isHost = true;
      this.lobbyHostControls.classList.remove('hidden');
      this.lobbyGuestMsg.classList.add('hidden');
      alert("Host disconnected. You have been promoted to room host! 👑");
    });

    this.socket.on('error-msg', ({ message }) => {
      alert(message);
    });
  }

  createOnlineLobby() {
    audio.init();
    audio.playClick();
    this.connectSocket();
    
    const nickname = this.onlineNicknameInput.value.trim() || 'Host';
    this.socket.emit('create-room', { playerName: nickname });
  }

  joinOnlineLobby() {
    audio.init();
    audio.playClick();
    
    const code = this.joinRoomCodeInput.value.trim().toUpperCase();
    const nickname = this.onlineNicknameInput.value.trim() || 'Guest';

    if (!code || code.length !== 4) {
      alert("Please enter a valid 4-character Room Code.");
      return;
    }

    this.connectSocket();
    this.socket.emit('join-room', { code, playerName: nickname });
  }

  showLobbyPanel(isHost) {
    this.tabsHeader.classList.add('hidden');
    this.tabContentLocal.classList.add('hidden');
    this.tabContentOnline.classList.add('hidden');
    this.lobbyPanel.classList.remove('hidden');

    this.lobbyCodeVal.textContent = this.roomCode;

    if (isHost) {
      this.lobbyHostControls.classList.remove('hidden');
      this.lobbyGuestMsg.classList.add('hidden');
    } else {
      this.lobbyHostControls.classList.add('hidden');
      this.lobbyGuestMsg.classList.remove('hidden');
    }
  }

  renderLobbyPlayers(room) {
    this.lobbyPlayersContainer.innerHTML = '';
    this.lobbyCountVal.textContent = room.players.length;

    room.players.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'setup-card';
      card.dataset.color = p.color;

      let suffix = '';
      if (p.isHost) suffix += ' (Host 👑)';
      if (p.isBot) suffix += ' (AI)';
      if (p.socketId === this.socket.id) suffix += ' (You)';

      card.innerHTML = `
        <div class="player-label">
          <div class="color-dot" style="color: ${PLAYER_COLORS[p.color].hex}"></div>
          <span style="font-weight: bold;">${p.name}${suffix}</span>
        </div>
        <div></div>
      `;

      if (this.isHost && !p.isHost) {
        const kickBtn = document.createElement('button');
        kickBtn.className = 'kick-btn';
        kickBtn.textContent = 'Kick';
        kickBtn.addEventListener('click', () => {
          this.socket.emit('kick-player', { code: this.roomCode, playerId: p.id });
        });
        card.appendChild(kickBtn);
      } else {
        card.appendChild(document.createElement('div'));
      }

      this.lobbyPlayersContainer.appendChild(card);
    });
  }

  addBotToLobby() {
    audio.playClick();
    
    const botAdjectives = ['Cyber', 'Robo', 'Byte', 'Neon', 'Aero', 'Quantum'];
    const botNouns = ['Core', 'Rogue', 'Titan', 'Bot', 'Mech', 'Agent'];
    const botName = `${botAdjectives[Math.floor(Math.random() * botAdjectives.length)]}${botNouns[Math.floor(Math.random() * botNouns.length)]}`;

    this.socket.emit('add-bot', { code: this.roomCode, botName });
  }

  startOnlineGame() {
    audio.playClick();
    this.socket.emit('start-game', { code: this.roomCode });
  }

  leaveLobby() {
    if (audio.enabled) audio.playClick();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.roomCode = null;
    this.myPlayerId = null;
    this.isHost = false;

    // Reset setup panels view
    this.lobbyPanel.classList.add('hidden');
    this.tabsHeader.classList.remove('hidden');
    
    if (this.isOnlineMode) {
      this.tabContentOnline.classList.remove('hidden');
    } else {
      this.tabContentLocal.classList.remove('hidden');
    }
  }

  launchOnlineGame(players) {
    this.game.setupOnlineGame(players);
    
    // Draw board & SVGs
    this.buildBoardGrid();
    this.boardPaths = renderBoardSVGs(this.boardSvg);

    // Initial position
    this.updateTokensLayer();

    // Show room code tag in play view
    this.playRoomCodeTag.textContent = `ROOM: ${this.roomCode}`;
    this.playRoomCodeTag.classList.remove('hidden');

    this.updateScoreboard();
    this.updateLogs();
    this.updateTurnIndicator();

    this.setupScreen.classList.add('hidden');
    this.playScreen.classList.remove('hidden');

    // Start Timer
    this.resetTurnTimer();

    this.checkAndTriggerBot();
  }

  // --- LOCAL GAME ORCHESTRATION ---
  getSetupPlayersData() {
    const cards = this.setupPlayersContainer.querySelectorAll('.setup-card');
    const playersData = [];

    cards.forEach((card, idx) => {
      const color = card.dataset.color;
      const nameInput = card.querySelector('.setup-input');
      const selectType = card.querySelector('.setup-select');

      playersData.push({
        name: nameInput.value.trim() || `Player ${idx + 1}`,
        color: color,
        isBot: selectType.value === 'bot',
        botDifficulty: 'medium'
      });
    });

    return playersData;
  }

  startLocalGame() {
    const configs = this.getSetupPlayersData();
    this.game.setupGame(configs);

    // Render Grid
    this.buildBoardGrid();
    this.boardPaths = renderBoardSVGs(this.boardSvg);

    this.updateTokensLayer();
    
    this.playRoomCodeTag.classList.add('hidden');

    this.updateScoreboard();
    this.updateLogs();
    this.updateTurnIndicator();

    this.setupScreen.classList.add('hidden');
    this.playScreen.classList.remove('hidden');

    // Start Timer
    this.resetTurnTimer();

    this.checkAndTriggerBot();
  }

  buildBoardGrid() {
    this.boardGrid.innerHTML = '';
    for (let r = 9; r >= 0; r--) {
      for (let c = 0; c < 10; c++) {
        const tileNum = (r % 2 === 0) ? (r * 10 + c + 1) : (r * 10 + (9 - c) + 1);

        const tile = document.createElement('div');
        tile.className = `board-tile ${tileNum % 2 === 0 ? 'tile-even' : 'tile-odd'}`;
        tile.dataset.tile = tileNum;
        tile.innerHTML = `<span class="tile-number">${tileNum}</span>`;

        this.boardGrid.appendChild(tile);
      }
    }
  }

  updateTokensLayer() {
    this.tokensLayer.innerHTML = '';
    const posGroups = {};
    
    this.game.players.forEach(p => {
      if (!posGroups[p.position]) posGroups[p.position] = [];
      posGroups[p.position].push(p);
    });

    Object.entries(posGroups).forEach(([pos, players]) => {
      const tileNum = parseInt(pos);
      const center = getBoardCoordinates(tileNum);
      const count = players.length;

      players.forEach((player, idx) => {
        let offsetX = 0;
        let offsetY = 0;

        if (count === 2) {
          offsetX = idx === 0 ? -18 : 18;
        } else if (count === 3) {
          if (idx === 0) offsetY = -16;
          else if (idx === 1) { offsetX = -18; offsetY = 16; }
          else { offsetX = 18; offsetY = 16; }
        } else if (count === 4) {
          offsetX = (idx === 0 || idx === 2) ? -18 : 18;
          offsetY = (idx === 0 || idx === 1) ? -18 : 18;
        }

        const token = document.createElement('div');
        token.className = `player-token`;
        token.id = `token-p${player.id}`;
        token.dataset.color = player.color;
        token.style.left = `${(center.x + offsetX) / 10}%`;
        token.style.top = `${(center.y + offsetY) / 10}%`;
        token.style.backgroundColor = PLAYER_COLORS[player.color].hex;
        token.style.color = PLAYER_COLORS[player.color].hex;

        this.tokensLayer.appendChild(token);
      });
    });
  }

  setTokenPos(playerId, x, y) {
    const token = document.getElementById(`token-p${playerId}`);
    if (token) {
      token.style.left = `${x / 10}%`;
      token.style.top = `${y / 10}%`;
    }
  }

  updateScoreboard() {
    this.scoreboardList.innerHTML = '';
    this.game.players.forEach((p, idx) => {
      const isActive = idx === this.game.activePlayerIndex;
      const row = document.createElement('div');
      row.className = `player-row ${isActive ? 'active' : ''}`;
      row.dataset.color = p.color;
      row.id = `player-row-p${p.id}`; // for emoji spawns targeting

      let suffix = '';
      if (this.isOnlineMode) {
        if (p.socketId === this.socket.id) suffix += ' (You)';
        else if (p.isBot) suffix += ' (AI)';
      }

      row.innerHTML = `
        <div class="player-info">
          <div class="avatar-badge" style="color: ${PLAYER_COLORS[p.color].hex}">${p.name[0].toUpperCase()}</div>
          <div class="player-name">
            <span>${p.name}${suffix}</span>
            <span class="player-type">${p.isBot ? 'AI Bot' : 'Player'}</span>
          </div>
        </div>
        <div class="player-pos-badge">Tile ${p.position}</div>
      `;
      this.scoreboardList.appendChild(row);
    });
  }

  updateLogs() {
    this.logsContent.innerHTML = '';
    this.game.logs.forEach(log => {
      const entry = document.createElement('div');
      entry.className = `log-entry log-${log.type}`;
      entry.innerHTML = `
        <span class="log-message">${log.message}</span>
        <span class="log-time">${log.time}</span>
      `;
      this.logsContent.appendChild(entry);
    });
  }

  updateTurnIndicator() {
    const activePlayer = this.game.getCurrentPlayer();
    this.activePlayerName.textContent = activePlayer.name;
    this.activePlayerName.style.color = PLAYER_COLORS[activePlayer.color].hex;
    
    this.diceTrigger.dataset.activeColor = activePlayer.color;

    document.querySelectorAll('.board-tile').forEach(tile => {
      tile.style.boxShadow = '';
    });
    
    const activeTile = document.querySelector(`.board-tile[data-tile="${activePlayer.position}"]`);
    if (activeTile) {
      activeTile.style.boxShadow = `inset 0 0 12px ${PLAYER_COLORS[activePlayer.color].glow}`;
    }

    if (this.isOnlineMode) {
      const isMyTurn = activePlayer.socketId === this.socket.id;
      if (isMyTurn && !activePlayer.isBot) {
        this.diceTrigger.classList.remove('disabled');
      } else {
        this.diceTrigger.classList.add('disabled');
      }
    } else {
      if (!activePlayer.isBot) {
        this.diceTrigger.classList.remove('disabled');
      } else {
        this.diceTrigger.classList.add('disabled');
      }
    }
  }

  // --- TURN COUNTDOWN TIMER LOGIC ---
  resetTurnTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    
    this.secondsLeft = 15;
    this.updateTimerBar();

    const activePlayer = this.game.getCurrentPlayer();
    // Do not tick local timer for bots (bots have preset action delays)
    if (activePlayer.isBot) {
      this.timerBarFill.style.width = '100%';
      this.timerBarFill.style.backgroundColor = 'var(--text-muted)';
      return;
    }

    this.timerInterval = setInterval(() => {
      this.secondsLeft -= 0.1;
      
      if (this.secondsLeft <= 0) {
        clearInterval(this.timerInterval);
        this.handleAutoRollTimeout();
      } else {
        this.updateTimerBar();
      }
    }, 100);
  }

  updateTimerBar() {
    const pct = (this.secondsLeft / 15) * 100;
    this.timerBarFill.style.width = `${pct}%`;

    // Visual alerting: changes green -> cyan -> flashing pink
    if (this.secondsLeft > 8) {
      this.timerBarFill.style.backgroundColor = 'var(--neon-blue)';
    } else if (this.secondsLeft > 4) {
      this.timerBarFill.style.backgroundColor = 'var(--neon-yellow)';
    } else {
      this.timerBarFill.style.backgroundColor = 'var(--neon-pink)';
    }
  }

  handleAutoRollTimeout() {
    const activePlayer = this.game.getCurrentPlayer();

    if (this.isOnlineMode) {
      // In online mode, only make the roll call if it belongs to this client socket
      if (activePlayer.socketId === this.socket.id) {
        this.socket.emit('roll-dice', { code: this.roomCode });
      }
    } else {
      this.rollDice();
    }
  }

  // --- QUICK-CHAT REACTIONS PANEL ---
  sendEmojiReaction(emoji) {
    const activePlayer = this.game.players.find(p => p.socketId === (this.socket ? this.socket.id : 'local-p1') || p.id === 1);
    const senderId = activePlayer ? activePlayer.id : 1;

    if (this.isOnlineMode) {
      this.socket.emit('send-emoji', { code: this.roomCode, emoji, playerId: senderId });
    } else {
      this.showFloatingEmoji(emoji, senderId);
    }
  }

  showFloatingEmoji(emoji, playerId) {
    const container = document.getElementById('player-row-p' + playerId) || this.playScreen;
    const rect = container.getBoundingClientRect();

    const spawnX = rect.left + rect.width / 2;
    const spawnY = rect.top + rect.height / 2;

    const div = document.createElement('div');
    div.className = 'floating-emoji';
    div.textContent = emoji;
    div.style.left = `${spawnX}px`;
    div.style.top = `${spawnY}px`;

    // Stagger drift and spin properties
    const driftX = (Math.random() - 0.5) * 80;
    const spinZ = (Math.random() - 0.5) * 90;
    div.style.setProperty('--drift-x', `${driftX}px`);
    div.style.setProperty('--spin-z', `${spinZ}deg`);

    document.getElementById('emoji-overlay-layer').appendChild(div);

    setTimeout(() => {
      div.remove();
    }, 1800);
  }

  // --- DICE ROLL TRIGGERS ---
  handleUserRoll() {
    if (this.isDiceRolling || this.isTokenMoving || this.game.status !== 'playing') return;
    
    const activePlayer = this.game.getCurrentPlayer();

    if (this.isOnlineMode) {
      if (activePlayer.socketId !== this.socket.id || activePlayer.isBot) return;
      this.socket.emit('roll-dice', { code: this.roomCode });
    } else {
      if (activePlayer.isBot) return;
      this.rollDice();
    }
  }

  rollDice(syncValue = null) {
    // Clear timer when roll starts
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    this.isDiceRolling = true;
    this.diceTrigger.classList.add('disabled');

    // 1. Calculate dynamic, responsive physics throwing targets
    const boardWrapper = this.playScreen.querySelector('#board-wrapper');
    const boardRect = boardWrapper.getBoundingClientRect();
    const diceRect = this.diceTrigger.getBoundingClientRect();

    const boardCenterX = boardRect.left + boardRect.width / 2;
    const boardCenterY = boardRect.top + boardRect.height / 2;

    const diceCenterX = diceRect.left + diceRect.width / 2;
    const diceCenterY = diceRect.top + diceRect.height / 2;

    const targetX = boardCenterX - diceCenterX;
    const targetY = boardCenterY - diceCenterY;

    this.diceTrigger.style.setProperty('--target-x', `${targetX}px`);
    this.diceTrigger.style.setProperty('--target-y', `${targetY}px`);

    this.diceTrigger.classList.add('throwing');

    audio.playDiceRoll();

    const rotations = {
      1: { x: 0, y: 0 },
      6: { x: 0, y: 180 },
      3: { x: 0, y: -90 },
      4: { x: 0, y: 90 },
      2: { x: -90, y: 0 },
      5: { x: 90, y: 0 }
    };

    const targetValue = syncValue !== null ? syncValue : (Math.floor(Math.random() * 6) + 1);
    const rot = rotations[targetValue];

    const spins = 3 * 360;
    const spinX = rot.x + spins + (Math.random() > 0.5 ? 360 : -360);
    const spinY = rot.y + spins + (Math.random() > 0.5 ? 360 : -360);
    const spinZ = 720 + (Math.random() - 0.5) * 35;

    this.dice3d.style.transform = `rotateX(${spinX}deg) rotateY(${spinY}deg) rotateZ(${spinZ}deg)`;

    // 3. Settle and display result, then return
    setTimeout(() => {
      setTimeout(() => {
        this.diceTrigger.classList.remove('throwing');
        this.dice3d.style.transform = `rotateX(${rot.x}deg) rotateY(${rot.y}deg) rotateZ(0deg)`;

        setTimeout(() => {
          this.isDiceRolling = false;
          this.executeMove(targetValue);
        }, 300);

      }, 400);

    }, 700);
  }

  executeOnlineRoll(rollValue) {
    this.rollDice(rollValue);
  }

  executeMove(rollValue) {
    const activePlayer = this.game.getCurrentPlayer();
    const result = this.game.processTurn(rollValue);

    if (this.isOnlineMode && this.isHost) {
      this.game.logs.slice(0, result.steps.length > 0 ? 2 : 1).forEach(log => {
        this.socket.emit('sync-log', {
          code: this.roomCode,
          message: log.message,
          type: log.type
        });
      });
    } else if (!this.isOnlineMode) {
      this.updateLogs();
    }

    if (result.steps.length === 0) {
      setTimeout(() => {
        this.finalizeTurn(result);
      }, 800);
      return;
    }

    this.isTokenMoving = true;
    this.animateSteps(activePlayer.id, result.steps, 0, () => {
      this.isTokenMoving = false;
      this.finalizeTurn(result);
    });
  }

  animateSteps(playerId, steps, index, callback) {
    if (index >= steps.length) {
      callback();
      return;
    }

    const step = steps[index];
    const token = document.getElementById(`token-p${playerId}`);

    // Trigger visual shockwave on landing
    const triggerShockwave = (tileNum) => {
      const tileEl = document.querySelector(`.board-tile[data-tile="${tileNum}"]`);
      if (tileEl) {
        const ring = document.createElement('div');
        ring.className = 'landing-shockwave';
        tileEl.appendChild(ring);
        setTimeout(() => ring.remove(), 800);
      }
    };

    if (step.type === 'walk') {
      if (token) {
        token.classList.add('hopping');
        audio.playMoveHop();
      }

      const dest = getBoardCoordinates(step.to);
      const otherPlayersCount = this.game.players.filter(p => p.id !== playerId && p.position === step.to).length;
      let offsetX = 0;
      let offsetY = 0;
      
      if (otherPlayersCount > 0) {
        offsetX = otherPlayersCount % 2 === 0 ? 18 : -18;
        offsetY = otherPlayersCount >= 2 ? 18 : -18;
      }

      this.setTokenPos(playerId, dest.x + offsetX, dest.y + offsetY);

      setTimeout(() => {
        if (token) token.classList.remove('hopping');
        triggerShockwave(step.to); // trigger contact wave
        this.animateSteps(playerId, steps, index + 1, callback);
      }, 180);

    } else if (step.type === 'ladder') {
      audio.playLadderClimb();
      const dest = getBoardCoordinates(step.to);
      
      let start = getBoardCoordinates(step.from);
      let duration = 400;
      let startTime = performance.now();

      const climb = (now) => {
        let elapsed = now - startTime;
        let progress = Math.min(elapsed / duration, 1);
        let ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

        let curX = start.x + (dest.x - start.x) * ease;
        let curY = start.y + (dest.y - start.y) * ease;

        this.setTokenPos(playerId, curX, curY);

        if (progress < 1) {
          requestAnimationFrame(climb);
        } else {
          this.updateTokensLayer();
          triggerShockwave(step.to); // contact ripple
          setTimeout(() => {
            this.animateSteps(playerId, steps, index + 1, callback);
          }, 200);
        }
      };

      requestAnimationFrame(climb);

    } else if (step.type === 'snake') {
      audio.playSnakeSlide();
      const pathD = this.boardPaths[step.from];
      
      if (!pathD) {
        this.animateStraightSlide(playerId, step.from, step.to, () => {
          triggerShockwave(step.to);
          this.animateSteps(playerId, steps, index + 1, callback);
        });
        return;
      }

      const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      tempPath.setAttribute('d', pathD);
      const pathLength = tempPath.getTotalLength();
      
      let duration = 500;
      let startTime = performance.now();

      const slide = (now) => {
        let elapsed = now - startTime;
        let progress = Math.min(elapsed / duration, 1);

        const point = tempPath.getPointAtLength(progress * pathLength);
        this.setTokenPos(playerId, point.x, point.y);

        if (progress < 1) {
          requestAnimationFrame(slide);
        } else {
          this.updateTokensLayer();
          triggerShockwave(step.to); // contact ripple
          setTimeout(() => {
            this.animateSteps(playerId, steps, index + 1, callback);
          }, 200);
        }
      };

      requestAnimationFrame(slide);
    }
  }

  animateStraightSlide(playerId, from, to, callback) {
    const start = getBoardCoordinates(from);
    const dest = getBoardCoordinates(to);
    let duration = 450;
    let startTime = performance.now();

    const frame = (now) => {
      let elapsed = now - startTime;
      let progress = Math.min(elapsed / duration, 1);
      
      let curX = start.x + (dest.x - start.x) * progress;
      let curY = start.y + (dest.y - start.y) * progress;

      this.setTokenPos(playerId, curX, curY);

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        this.updateTokensLayer();
        callback();
      }
    };
    requestAnimationFrame(frame);
  }

  finalizeTurn(result) {
    this.updateScoreboard();
    this.updateTokensLayer();

    if (this.game.status === 'finished') {
      this.endGame();
      return;
    }

    this.updateTurnIndicator();

    if (this.isOnlineMode && this.isHost) {
      this.socket.emit('update-positions', {
        code: this.roomCode,
        players: this.game.players
      });
    }

    // Reset and start turn timer countdown
    this.resetTurnTimer();

    this.checkAndTriggerBot();
  }

  checkAndTriggerBot() {
    if (this.game.status !== 'playing') return;

    const nextPlayer = this.game.getCurrentPlayer();
    if (nextPlayer.isBot) {
      this.diceTrigger.classList.add('disabled');
      
      if (this.isOnlineMode) {
        if (this.isHost) {
          setTimeout(() => {
            if (this.game.getCurrentPlayer().id === nextPlayer.id) {
              this.socket.emit('roll-dice', { code: this.roomCode });
            }
          }, 600);
        }
      } else {
        setTimeout(() => {
          if (this.game.getCurrentPlayer().id === nextPlayer.id) {
            this.rollDice();
          }
        }, 500);
      }
    }
  }

  endGame() {
    // Clear timer
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.playScreen.classList.add('hidden');
    this.winnerScreen.classList.remove('hidden');

    const winner = this.game.winner;
    this.winnerName.textContent = `${winner.name} Wins!`;
    this.winnerName.style.color = PLAYER_COLORS[winner.color].hex;

    audio.playWinFanfare();
    confetti.burst(150);

    this.confettiInterval = setInterval(() => {
      confetti.burst(80);
    }, 2000);

    if (this.isOnlineMode && !this.isHost) {
      this.restartGameBtn.classList.add('hidden');
    } else {
      this.restartGameBtn.classList.remove('hidden');
    }
  }

  handleRestart() {
    if (this.isOnlineMode) {
      if (this.isHost) {
        this.socket.emit('reset-game', { code: this.roomCode });
      }
    } else {
      this.resetToSetup();
    }
  }

  resetOnlineGame() {
    if (this.confettiInterval) {
      clearInterval(this.confettiInterval);
      this.confettiInterval = null;
    }
    confetti.stop();

    this.winnerScreen.classList.add('hidden');
    this.playScreen.classList.add('hidden');
    this.setupScreen.classList.remove('hidden');

    this.game.players.forEach(p => {
      p.position = 1;
    });

    this.game.status = 'playing';
    this.isDiceRolling = false;
    this.isTokenMoving = false;

    this.lobbyPanel.classList.remove('hidden');
    this.tabsHeader.classList.add('hidden');

    this.resetTurnTimer();
  }

  resetToSetup() {
    // Clear Timer
    if (this.timerInterval) clearInterval(this.timerInterval);

    if (this.confettiInterval) {
      clearInterval(this.confettiInterval);
      this.confettiInterval = null;
    }
    confetti.stop();

    if (audio.enabled) audio.playClick();

    this.winnerScreen.classList.add('hidden');
    this.playScreen.classList.add('hidden');
    
    if (this.isOnlineMode) {
      this.leaveLobby();
    } else {
      this.setupScreen.classList.remove('hidden');
    }

    this.game = new GameEngine();
    this.isDiceRolling = false;
    this.isTokenMoving = false;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new AppController();
  app.init();
});
