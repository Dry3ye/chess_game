let ws = null;
let chess = new Chess(); // Initialize Chess.js
let gameId = null;
let color = null; // 'white' or 'black'

console.log('client.js loaded at', new Date());

// Connect to WebSocket server
function connectWebSocket() {
    console.log('Connecting to WebSocket...');
    // Ensure you have a WebSocket server running at this address
    ws = new WebSocket('ws://10.10.10.100:3000'); // Adjust this if your server is on a different address/port
    ws.onopen = () => {
        setStatus('Connected to server!');
        console.log('WebSocket connection opened.');
    };
    ws.onmessage = handleMessage;
    ws.onclose = () => {
        setStatus('Disconnected from server. Attempting to reconnect...');
        console.log('WebSocket connection closed. Reconnecting...');
        setTimeout(connectWebSocket, 3000); // Attempt to reconnect every 3 seconds
    };
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setStatus('WebSocket connection error. Check server.');
    };
}

// Handle server messages
function handleMessage(event) {
    console.log('Received raw:', 'I am', color, 'got:', event.data);

    console.log('****************************** WHOSE TURN?:', chess.turn());
    
    try {
        const data = JSON.parse(event.data);
        if (data.type === 'gameCreated') {
            gameId = data.gameId;
            setStatus(`Game created! ID: ${gameId}. Share this ID with your opponent. Waiting for opponent...`);
        } else if (data.type === 'start') {
            color = data.color;
            chess.load(data.fen);
            // Added log: After game starts, show initial color and turn
            console.log(`[handleMessage - Start] Client Color: ${color}, Chess.js Turn: ${chess.turn()}`);
            setStatus(`Game started! You are ${color}. It's ${chess.turn() === 'w' ? 'White' : 'Black'}'s turn.`);
            renderBoard();
        } else if (data.type === 'move') {
            chess.load(data.fen);
            // Added log: After move, show updated FEN, color, and turn
            console.log(`[handleMessage - Move] FEN loaded: ${chess.fen()}`);
            console.log(`[handleMessage - Move] Client Color: ${color}, Chess.js Turn: ${chess.turn()}`);
            setStatus(`Move made: ${data.move.from}-${data.move.to}. It's ${chess.turn() === 'w' ? 'White' : 'Black'}'s turn.`);
            renderBoard();
        } else if (data.type === 'error') {
            setStatus(`Error: ${data.message}`);
        } else if (data.type === 'gameOver') {
            setStatus(`Game Over: ${data.result}`);
            // Optionally disable board interaction or show a restart button
        } else if (data.type === 'opponentDisconnected') {
            setStatus('Opponent disconnected. Game ended.');
        }
    } catch (e) {
        console.error('Failed to parse message:', event.data, e);
        setStatus('Error: Could not process server message.');
    }
}

// Create a new game
function createGame() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        setStatus('Connecting to server... please try again.');
        connectWebSocket(); // Try to connect if not already open
        return;
    }
    ws.send(JSON.stringify({ type: 'create' }));
}

// Join an existing game
function joinGame() {
    const input = document.getElementById('gameIdInput');
    if (!input.value) {
        setStatus('Error: Enter a game ID to join.');
        return;
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        setStatus('Connecting to server... please try again.');
        connectWebSocket(); // Try to connect if not already open
        return;
    }
    gameId = input.value;
    ws.send(JSON.stringify({ type: 'join', gameId: input.value }));
}

// Update status message
function setStatus(message) {
    const statusDiv = document.getElementById('status');
    if (statusDiv) {
        statusDiv.textContent = message;
    } else {
        console.error('Status div not found');
    }
}

function showGameId() {
  const gameIdElem = document.getElementById('gameId');
  if (gameIdElem) {
    if (gameId) {
      gameIdElem.textContent = `Game ID: ${gameId}`;
    } else {
      gameIdElem.textContent = 'No game created yet.';
    }
  }
}

// Get board state from FEN (workaround for Chess.js v0.10.2)
// This function is still compatible with newer chess.js versions,
// it parses the FEN string to get the piece placement.
function getBoard() {
    const fen = chess.fen().split(' ')[0]; // Piece placement part of FEN
    const rows = fen.split('/');
    const board = [];
    for (let row of rows) {
        const boardRow = [];
        for (let char of row) {
            if (/\d/.test(char)) { // If it's a number, it represents empty squares
                for (let i = 0; i < parseInt(char); i++) {
                    boardRow.push(null); // Add null for empty squares
                }
            } else { // It's a piece character
                const pieceColor = /[a-z]/.test(char) ? 'b' : 'w';
                const pieceType = char.toLowerCase();
                boardRow.push({ type: pieceType, color: pieceColor });
            }
        }
        board.push(boardRow);
    }
    return board;
}

// Render the chessboard with row/column labels
function renderBoard() {
    console.log('Rendering board for color:', color);
    const boardDiv = document.getElementById('chessboard');
    if (!boardDiv) {
        console.error('Chessboard div not found');
        return;
    }
    boardDiv.innerHTML = ''; // Clear previous board

    const board = getBoard();
    const isWhite = color === 'white';

    const boardContainer = document.createElement('div');
    boardContainer.className = 'flex flex-col items-center'; // Use flexbox for centering labels

    // Top column labels (a-h)
    const topLabelRow = document.createElement('div');
    topLabelRow.className = 'board-row top-label-row';
    topLabelRow.appendChild(document.createElement('div', { class: 'square-label' })); // Empty corner for row label
    for (let col = 0; col < 8; col++) {
        const label = document.createElement('div');
        label.className = 'square-label';
        label.textContent = String.fromCharCode(97 + (isWhite ? col : 7 - col)); // 'a' to 'h'
        topLabelRow.appendChild(label);
    }
    boardContainer.appendChild(topLabelRow);

    // Board rows
    for (let row = 0; row < 8; row++) {
        const displayRow = isWhite ? row : 7 - row; // Reverse rows if black
        const rowDiv = document.createElement('div');
        rowDiv.className = 'board-row';

        // Row label (1-8)
        const rowLabel = document.createElement('div');
        rowLabel.className = 'square-label';
        rowLabel.textContent = 8 - displayRow; // '8' to '1'
        rowDiv.appendChild(rowLabel);

        // Squares
        for (let col = 0; col < 8; col++) {
            const displayCol = isWhite ? col : 7 - col; // Reverse columns if black
            const square = document.createElement('div');
            square.className = `square ${(displayRow + displayCol) % 2 === 0 ? 'light' : 'dark'}`;
            square.style.cursor = 'pointer';
            square.dataset.row = displayRow; // Store original row/col for logic
            square.dataset.col = displayCol;

            const piece = board[displayRow][displayCol];
            if (piece) {
                square.textContent = getPieceSymbol(piece);
            }
            square.onclick = () => {
                console.log('888888888888888888 we are her...', this);
                
                handleSquareClick(displayRow, displayCol);
            }
            rowDiv.appendChild(square);
        }
        boardContainer.appendChild(rowDiv);
    }

    // Bottom column labels (a-h) - same as top for consistency
    const bottomLabelRow = document.createElement('div');
    bottomLabelRow.className = 'board-row bottom-label-row';
    bottomLabelRow.appendChild(document.createElement('div', { class: 'square-label' })); // Empty corner
    for (let col = 0; col < 8; col++) {
        const label = document.createElement('div');
        label.className = 'square-label';
        label.textContent = String.fromCharCode(97 + (isWhite ? col : 7 - col));
        bottomLabelRow.appendChild(label);
    }
    boardContainer.appendChild(bottomLabelRow);

    boardDiv.appendChild(boardContainer);
    console.log('Board rendered');
}

// Get Unicode symbol for chess piece
function getPieceSymbol(piece) {
    // Using standard Unicode chess symbols
    const symbols = {
        'p': '♟', 'n': '♞', 'b': '♝', 'r': '♜', 'q': '♛', 'k': '♚',
        'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕', 'K': '♔'
    };
    // Chess.js uses 'b' for black pieces, 'w' for white pieces.
    // piece.type is lowercase (p, n, b, r, q, k)
    // If the piece is black, its symbol should be lowercase, otherwise uppercase.
    const pieceKey = piece.color === 'b' ? piece.type : piece.type.toUpperCase();
    return symbols[pieceKey] || '';
}

// Handle square clicks for piece movement
let selectedSquare = null; // Stores the algebraic notation of the selected square (e.g., 'e2')

function handleSquareClick(row, col) {
    // Added log: Before turn check, show current client color and chess.js turn
    console.log(`[handleSquareClick] Before check: Client Color: ${color}, Chess.js Turn: ${chess.turn()}`);
showGameId();
    console.log(chess.turn(), color, color[0]);
    
    // Convert clicked row/col to algebraic notation (e.g., 0,0 -> a8; 7,7 -> h1)
    const squareAlgebraic = `${String.fromCharCode(97 + col)}${8 - row}`;

    // Check if it's the player's turn and color is assigned
    if (!color || chess.turn() !== color[0]) {
        setStatus('It is not your turn.');
        showGameId();
        console.log('************************************** 111');
        
        console.log('Not your turn or no color assigned. Current turn check:', { clientColor: color, chessJsTurn: chess.turn() });
        return;
    }

    // Get the piece on the clicked square
    const clickedPiece = chess.get(squareAlgebraic);

    // Highlight valid moves or move piece
    if (selectedSquare) {
        // A piece is already selected, now try to move it to the clicked square
        const move = { from: selectedSquare, to: squareAlgebraic };
        const result = chess.move(move);

        console.log('result:', result);
        
        if (result) {
            // Valid move, send it to the server
            console.log('Valid move made locally:', move, gameId);
            console.log('******************* we get here....');
            
            ws.send(JSON.stringify({ sentBy: color, type: 'move', gameId: gameId, move: move }));
            console.log('************************* we get here....2222');
showGameId();
            renderBoard(); // Re-render board with new position
            selectedSquare = null; // Clear selection
        } else {
            // Invalid move, check if we're selecting a new piece of our color
            if (clickedPiece && clickedPiece.color === color[0]) {
                selectedSquare = squareAlgebraic; // Select new piece
                console.log('Invalid move. New piece selected at:', selectedSquare);
                highlightSelectedSquare(selectedSquare); // Highlight the newly selected square
            } else {
                showGameId();
                setStatus('Invalid move. Select one of your pieces.');
                console.log('Invalid move, clearing selection.');
                selectedSquare = null; // Clear selection
                renderBoard(); // Re-render to clear highlights
            }
        }
    } else {
        // No piece selected, try to select one
        if (clickedPiece && clickedPiece.color === color[0]) {
            // Only allow selecting pieces of the player's color
            selectedSquare = squareAlgebraic;
            console.log('Piece selected at:', selectedSquare);
            highlightSelectedSquare(selectedSquare); // Highlight the selected square
        } else {
            setStatus('Select one of your pieces.');
            console.log('No piece selected or selected opponent\'s piece/empty square.');
        }
    }
}

// Function to highlight the selected square and potential moves
function highlightSelectedSquare(square) {
    // Clear existing highlights first
    document.querySelectorAll('.square.highlighted, .square.possible-move').forEach(s => {
        s.classList.remove('highlighted', 'possible-move');
    });

    if (square) {
        // Add highlight to the selected square
        const selectedEl = document.querySelector(`.square[data-row="${8 - parseInt(square[1])}"][data-col="${square.charCodeAt(0) - 97}"]`);
        if (selectedEl) {
            selectedEl.classList.add('highlighted');
        }

        // Get possible moves for the selected piece
        const moves = chess.moves({ square: square, verbose: true });
        moves.forEach(move => {
            const targetRow = 8 - parseInt(move.to[1]);
            const targetCol = move.to.charCodeAt(0) - 97;
            const targetEl = document.querySelector(`.square[data-row="${targetRow}"][data-col="${targetCol}"]`);
            if (targetEl) {
                targetEl.classList.add('possible-move');
            }
        });
    }
}

// Add some basic styling for highlights
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = `
    .square.highlighted {
        background-color: #ffd700; /* Gold for selected piece */
    }
    .square.possible-move {
        background-color: #8aff8a; /* Light green for possible moves */
        border: 2px solid #00a000; /* Darker green border */
        box-shadow: inset 0 0 5px rgba(0,0,0,0.3);
    }
`;
document.head.appendChild(styleSheet);


// Initialize on DOMContentLoaded to ensure all elements are ready
document.addEventListener('DOMContentLoaded', () => {
    connectWebSocket(); // Establish WebSocket connection
    renderBoard(); // Render initial empty board (or default FEN if not connected yet)

    // Attach event listeners
    document.getElementById('createGameBtn').addEventListener('click', createGame);
    document.getElementById('joinGameBtn').addEventListener('click', joinGame);
});
