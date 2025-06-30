const express = require('express');
const WebSocket = require('ws');
const Chess = require('chess.js').Chess;
const app = express();
const port = 3000;

// Serve static files from the 'public' folder
app.use(express.static('public'));

// Create HTTP server
const server = app.listen(port, () => {
  console.log(`Server running at http://10.10.10.100:${port}`);
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store active games: { gameId: { chess: Chess instance, players: [ws1, ws2] } }
const games = {};

wss.on('connection', (ws) => {
  console.log('New client connected');

  // Handle incoming messages
  ws.on('message', (message) => {
    const data = JSON.parse(message);

    if (data.type === 'create') {
      // Create a new game
      const gameId = Math.random().toString(36).substring(7);
      games[gameId] = {
        chess: new Chess(),
        players: [ws],
      };
      ws.send(JSON.stringify({ type: 'gameCreated', gameId }));
    } else if (data.type === 'join') {
      // Join an existing game
      const game = games[data.gameId];
      if (game && game.players.length === 1) {
        game.players.push(ws);
        // Assign colors
        game.players[0].send(JSON.stringify({ type: 'start', color: 'white', fen: game.chess.fen() }));
        ws.send(JSON.stringify({ type: 'start', color: 'black', fen: game.chess.fen() }));
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Game not found or full' }));
      }
    } else if (data.type === 'move') {
      // Process a move
      const game = games[data.gameId];
      console.log(`-----------------------------> Received move:`, data);
      
      if (game) {
        const chess = game.chess;
        const move = chess.move(data.move);
        if (move) {
          // Valid move, broadcast to both players
          game.players.forEach((player) => {
            player.send(JSON.stringify({ type: 'move', fen: chess.fen(), move: data.move }));
          });
          // Check for game over
          if (chess.game_over()) {
            const result = chess.in_checkmate() ? `${chess.turn() === 'w' ? 'Black' : 'White'} wins!` : 'Draw!';
            game.players.forEach((player) => {
              player.send(JSON.stringify({ type: 'gameOver', result }));
            });
          }
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid move' }));
        }
      }
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    // Remove player from game
    for (const gameId in games) {
      const game = games[gameId];
      game.players = game.players.filter((player) => player !== ws);
      if (game.players.length === 0) {
        delete games[gameId];
      } else {
        game.players.forEach((player) => {
          player.send(JSON.stringify({ type: 'opponentDisconnected' }));
        });
      }
    }
  });
});