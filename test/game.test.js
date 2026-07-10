// test/game.test.js - Simple assertion testing framework for core logic
import { getTileCoordinates } from '../board.js';
import { GameEngine } from '../game.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Failed: ${message}`);
    process.exit(1);
  } else {
    console.log(`   ✅ Passed: ${message}`);
  }
}

console.log('--- STARTING LOGIC TESTS ---');

// Test serpentine coordinate translation
console.log('\n[1] Testing board serpentine coordinates...');
const tile1 = getTileCoordinates(1);
assert(tile1.x === 0 && tile1.y === 9, 'Tile 1 should be at (0, 9)');

const tile10 = getTileCoordinates(10);
assert(tile10.x === 9 && tile10.y === 9, 'Tile 10 should be at (9, 9)');

const tile11 = getTileCoordinates(11);
assert(tile11.x === 9 && tile11.y === 8, 'Tile 11 should be at (9, 8)');

const tile20 = getTileCoordinates(20);
assert(tile20.x === 0 && tile20.y === 8, 'Tile 20 should be at (0, 8)');

const tile100 = getTileCoordinates(100);
assert(tile100.x === 0 && tile100.y === 0, 'Tile 100 should be at (0, 0)');


// Test Game Engine Logic
console.log('\n[2] Testing game engine initialization...');
const game = new GameEngine();
game.setupGame([
  { name: 'Alice', color: 'blue', isBot: false },
  { name: 'Bob', color: 'pink', isBot: true }
]);

assert(game.players.length === 2, 'Should setup exactly 2 players');
assert(game.players[0].name === 'Alice', 'Player 1 name should be Alice');
assert(game.players[1].isBot === true, 'Player 2 should be configured as a bot');
assert(game.getCurrentPlayer().name === 'Alice', 'Alice should start the game');


// Test movement path calculations
console.log('\n[3] Testing movement paths (walks, ladders, snakes)...');

// Alice at 1, rolls 3 -> lands on 4 -> climbs to 14
const pathLadder = game.calculateMovementPath({ position: 1 }, 3);
assert(pathLadder.length === 4, 'Path should contain 3 walk steps + 1 ladder step');
assert(pathLadder[2].to === 4 && pathLadder[2].type === 'walk', 'Third step walks to tile 4');
assert(pathLadder[3].from === 4 && pathLadder[3].to === 14 && pathLadder[3].type === 'ladder', 'Fourth step climbs ladder to 14');

// Bob at 98, rolls 4 -> stays put (no steps)
const pathBounce = game.calculateMovementPath({ position: 98 }, 4);
assert(pathBounce.length === 0, 'Path should be empty when rolling too high');


// Test turn progression rules
console.log('\n[4] Testing turn progression and rules...');
const initialPlayer = game.getCurrentPlayer(); // Alice
const turnResult = game.processTurn(3); // Alice rolls 3 -> moves 1 to 4 -> climbs 4 to 14 -> Bob's turn
assert(initialPlayer.position === 14, 'Alice position should update to 14 (climbed ladder)');
assert(game.getCurrentPlayer().name === 'Bob', 'Turn should advance to Bob');
assert(turnResult.extraTurn === false, 'Roll of 3 should NOT award an extra turn');


// Test roll of 6 rules (extra turn & three 6s penalty)
console.log('\n[5] Testing roll of 6 behavior...');
game.activePlayerIndex = 0; // force turn back to Alice
game.consecutiveSixes = 0;

const rollSixResult = game.processTurn(6); // Alice rolls 6
assert(game.getCurrentPlayer().name === 'Alice', 'Alice should retain turn after rolling a 6');
assert(rollSixResult.extraTurn === true, 'Roll of 6 should award an extra turn');
assert(game.consecutiveSixes === 1, 'Consecutive sixes counter should increment to 1');

const rollSecondSix = game.processTurn(6); // Alice rolls a second 6
assert(game.getCurrentPlayer().name === 'Alice', 'Alice should still retain turn after second 6');
assert(game.consecutiveSixes === 2, 'Consecutive sixes counter should increment to 2');

const rollThirdSix = game.processTurn(6); // Alice rolls a third 6
assert(rollThirdSix.consecutiveSixesBlocked === true, 'Third consecutive 6 should activate penalty');
assert(game.consecutiveSixes === 0, 'Consecutive sixes counter should reset to 0');
assert(game.getCurrentPlayer().name === 'Bob', 'Alice\'s turn is forfeited; turn advances to Bob');

console.log('\n--- ALL UNIT TESTS COMPLETED SUCCESSFULLY 🎉 ---');
