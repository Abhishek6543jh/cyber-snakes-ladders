// game.js - Game state engine and rules coordinator
import { LADDERS, SNAKES } from './board.js';

export const BOT_NAMES = ['AeroBot', 'CyberBot', 'NeonBot', 'QuantumBot'];

export const PLAYER_COLORS = {
  blue: { hex: '#00d2ff', name: 'Neon Blue', glow: 'rgba(0, 210, 255, 0.6)' },
  pink: { hex: '#ff007f', name: 'Neon Pink', glow: 'rgba(255, 0, 127, 0.6)' },
  green: { hex: '#39ff14', name: 'Neon Green', glow: 'rgba(57, 255, 20, 0.6)' },
  yellow: { hex: '#fffb00', name: 'Neon Yellow', glow: 'rgba(255, 251, 0, 0.6)' }
};

export class GameEngine {
  constructor() {
    this.players = [];
    this.activePlayerIndex = 0;
    this.status = 'setup'; // 'setup', 'playing', 'finished'
    this.winner = null;
    this.consecutiveSixes = 0;
    this.logs = [];
    this.lastRollValue = 1;
  }

  setupGame(playerConfigs) {
    // playerConfigs: Array of { name, color, isBot, botDifficulty }
    this.players = playerConfigs.map((cfg, idx) => ({
      id: idx + 1,
      name: cfg.name || (cfg.isBot ? BOT_NAMES[idx] : `Player ${idx + 1}`),
      color: cfg.color, // 'blue', 'pink', 'green', 'yellow'
      position: 1,
      isBot: !!cfg.isBot,
      botDifficulty: cfg.botDifficulty || 'medium'
    }));

    this.activePlayerIndex = 0;
    this.status = 'playing';
    this.winner = null;
    this.consecutiveSixes = 0;
    this.logs = [];
    this.addLog("Game started! Roll the dice to begin.");
    
    return this.players;
  }

  setupOnlineGame(syncedPlayers) {
    this.players = syncedPlayers.map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      position: p.position || 1,
      isBot: !!p.isBot,
      socketId: p.socketId
    }));

    this.activePlayerIndex = 0;
    this.status = 'playing';
    this.winner = null;
    this.consecutiveSixes = 0;
    this.logs = [];
    this.addLog("Online multiplayer game started!");
    
    return this.players;
  }

  getCurrentPlayer() {
    return this.players[this.activePlayerIndex];
  }

  addLog(message, type = 'info') {
    this.logs.unshift({
      id: Date.now() + Math.random().toString(),
      message,
      type,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });
  }

  // Returns array of steps for movement animation: e.g., [{ from: 1, to: 2 }, { from: 2, to: 3 }]
  calculateMovementPath(player, rollValue) {
    const steps = [];
    let currentPos = player.position;
    const targetPos = currentPos + rollValue;

    if (targetPos > 100) {
      // Do not move rule: stay at current position
      return [];
    }

    // Standard forward walk
    for (let i = 1; i <= rollValue; i++) {
      steps.push({ from: currentPos, to: currentPos + 1, type: 'walk' });
      currentPos++;
    }

    // Check for Ladder or Snake landing at the end of walk
    if (LADDERS[currentPos]) {
      const finalPos = LADDERS[currentPos];
      steps.push({ from: currentPos, to: finalPos, type: 'ladder' });
    } else if (SNAKES[currentPos]) {
      const finalPos = SNAKES[currentPos];
      steps.push({ from: currentPos, to: finalPos, type: 'snake' });
    }

    return steps;
  }

  // Performs game rules and state updates after roll.
  // Returns { rollValue, steps, extraTurn, consecutiveSixesBlocked }
  processTurn(rollValue) {
    if (this.status !== 'playing') return null;
    
    this.lastRollValue = rollValue;
    const player = this.getCurrentPlayer();
    let extraTurn = false;
    let consecutiveSixesBlocked = false;

    this.addLog(`${player.name} rolled a ${rollValue}!`, 'roll');

    if (rollValue === 6) {
      this.consecutiveSixes++;
      if (this.consecutiveSixes === 3) {
        consecutiveSixesBlocked = true;
        this.addLog(`Oh no! Three 6s in a row. ${player.name}'s turn is forfeited!`, 'warn');
        this.consecutiveSixes = 0;
        this.nextPlayer();
        return { rollValue, steps: [], extraTurn: false, consecutiveSixesBlocked };
      } else {
        extraTurn = true;
        this.addLog(`${player.name} rolled a 6 and earns an extra roll!`, 'special');
      }
    } else {
      this.consecutiveSixes = 0;
    }

    const steps = this.calculateMovementPath(player, rollValue);
    
    // Apply final position update
    if (steps.length > 0) {
      const lastStep = steps[steps.length - 1];
      player.position = lastStep.to;
      
      // Log event details
      const ladderStep = steps.find(s => s.type === 'ladder');
      const snakeStep = steps.find(s => s.type === 'snake');

      if (ladderStep) {
        this.addLog(`Jackpot! ${player.name} climbed a ladder from ${ladderStep.from} to ${ladderStep.to}! 🚀`, 'ladder');
      } else if (snakeStep) {
        this.addLog(`Ouch! ${player.name} was bitten by a snake and fell from ${snakeStep.from} to ${snakeStep.to}! 🐍`, 'snake');
      }
    } else {
      // Stay put rule: player rolled too high. Turn passes, extra turn is forfeited.
      this.consecutiveSixes = 0;
      extraTurn = false;
      this.addLog(`${player.name} rolled a ${rollValue} but needs exactly ${100 - player.position} to finish! Turn passes.`, 'warn');
    }

    // Win condition check
    if (player.position === 100) {
      this.status = 'finished';
      this.winner = player;
      this.addLog(`🎉 Champion! ${player.name} reached square 100 and won the game!`, 'win');
      return { rollValue, steps, extraTurn: false, winner: player };
    }

    if (!extraTurn) {
      this.nextPlayer();
    }

    return { rollValue, steps, extraTurn, winner: null };
  }

  nextPlayer() {
    this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
  }
}
