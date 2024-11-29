// Variables globales

let username = ""; // Nombre del jugador
const gridCells = []; // Celdas del tablero
let playerPosition = -1; // Posición del jugador
let playerColor = ""; // Color del jugador
let socket; // WebSocket
let canMove = false; // Permitir movimientos solo después del conteo
let players = {}; // Objeto para rastrear jugadores
const obstacles = []; // Array de obstáculos
const readyPlayers = new Set(); // Jugadores listos
let ballPosition = 5; // Posición inicial de la pelota
let isBallOnBoard = true; // Estado de la pelota
let isBallMoving = false; // Indica si la pelota ya está en movimiento

function createGrid() {
    const gridContainer = document.getElementById("grid");

    for (let i = 0; i < 110; i++) { // 11 columnas x 10 filas = 110 celdas
        const cell = document.createElement("div");
        cell.classList.add("cell");

        // Si es la columna 6 (índice 5), agregar como obstáculo
        if (i % 11 === 5) {
            cell.classList.add("obstacle");
            obstacles.push(i);
        }

        gridCells.push(cell);
        gridContainer.appendChild(cell);
    }
}

function addPlayerToGrid() {
    const assignedPosition = Math.floor(Math.random() * gridCells.length);
    playerPosition = assignedPosition;
    playerColor = getRandomColor();

    players[username] = { position: playerPosition, color: playerColor };

    updateGrid();
}



// Función para asignar el nombre de usuario
function setUsername() {
    const nameInput = document.getElementById("username");
    username = nameInput.value.trim();

    // Validar si el nombre de usuario es válido
    if (!username) {
        alert("Por favor, ingresa un nombre de usuario válido.");
        return;
    }

    playerColor = getRandomColor();
    document.getElementById("usernameContainer").style.display = "none";
    document.getElementById("playerName").textContent = `Jugador: ${username}`;

    // Notificar al servidor el nuevo jugador
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: "newPlayer",
            username: username,
            position: playerPosition,
            color: playerColor,
        }));

        /*console.log("Jugador registrado en el servidor:", {
            username,
            position: playerPosition,
            color: playerColor,
        *///});
    } else {
        console.error("WebSocket no está abierto. No se pudo registrar al jugador.");
    }
}


// Función para mover al jugador
function movePlayer(direction) {
    if (!canMove) return;

    let newPosition = playerPosition;

    switch (direction) {
        case 'ArrowUp':
            if (playerPosition >= 11) newPosition -= 11;
            break;
        case 'ArrowDown':
            if (playerPosition < 99) newPosition += 11;
            break;
        case 'ArrowLeft':
            if (playerPosition % 11 !== 0) newPosition -= 1;
            break;
        case 'ArrowRight':
            if (playerPosition % 11 !== 10) newPosition += 1;
            break;
        default:
            return;
    }

    if (!isObstacle(newPosition) && !isPositionOccupied(newPosition)) {
        playerPosition = newPosition;

        // Enviar la nueva posición al servidor
        socket.send(JSON.stringify({
            type: 'move',
            username: username,
            position: playerPosition,
        }));

       //console.log(`Jugador ${username} movido a posición ${playerPosition}`);
        updateGrid(); // Actualizar la cuadrícula local
        if (!isBallMoving) {
            checkCollision(); // Verifica si el jugador colisiona con la pelota
        }
    }
}

// Ajusta `updateGrid` para manejar colisiones:
function updateGrid() {
    gridCells.forEach((cell) => {
        cell.innerHTML = ""; // Limpia la celda
    });

    // Dibuja jugadores
    Object.keys(players).forEach((playerUsername) => {
        const { position, color } = players[playerUsername];
        if (position >= 0 && position < gridCells.length) {
            const cell = gridCells[position];
            const playerDiv = document.createElement("div");
            playerDiv.className = "player";
            playerDiv.style.backgroundColor = color;
            cell.appendChild(playerDiv);
        }
    });

    // Dibuja la pelota
    if (isBallOnBoard && ballPosition >= 0 && ballPosition < gridCells.length) {
        const ballCell = gridCells[ballPosition];
        const ballDiv = document.createElement("div");
        ballDiv.className = "ball";
        ballDiv.style.backgroundImage = "url('./images/favicon.png')";
        ballDiv.style.backgroundSize = "cover";
        ballDiv.style.backgroundPosition = "center";
        ballCell.appendChild(ballDiv);
    }
}




// Función para generar un color aleatorio
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function isPositionOccupied(position) {
    const occupied = Object.values(players).some(player => player.position === position);
    //console.log(`Posición ${position} ocupada: ${occupied}`);
    return occupied;
}

function isObstacle(position) {
    const obstacle = obstacles.includes(position);
    //console.log(`Posición ${position} es obstáculo: ${obstacle}`);
    return obstacle;
}

function handleServerMessage(event) {
    
    try {
        const data = JSON.parse(event.data); // Analiza los datos JSON recibidos
        //console.log("Estado recibido del servidor:", data);
        
        switch (data.type) {
            case 'move':
                // Actualiza solo la posición del jugador que se movió
                if (data.username && players[data.username]) {
                    players[data.username].position = data.position;
            
                    //console.log(`Jugador ${data.username} movido a posición ${data.position}`);
                    updateGrid(); // Redibuja la cuadrícula
                } else {
                    console.warn("Movimiento recibido para un jugador desconocido o inválido:", data);
                }
                break;
            
            case 'updateGameState':
                // Actualiza el estado completo de jugadores (si es necesario)
                if (data.players) {
                    players = Object.fromEntries(
                        Object.entries(data.players).filter(([key, value]) => key && value && key.trim())
                    );
                    if (data.ballPosition !== undefined) {
                        ballPosition = data.ballPosition; // Actualiza la posición de la pelota
                    }
                    console.log("Pelota inicial en la posición:", ballPosition);
                    //console.log("Jugadores actualizados desde el servidor:", players);
                    updateGrid(); // Redibuja la cuadrícula
                }
                break;

            case "updatePlayers":
                players[data.username] = data.playerData;
                updateGrid();
                break;
                    
            case "ballUpdate":
                ballPosition = data.position;
                isBallOnBoard = data.isBallOnBoard;
                updateGrid();
                break;

            case "chat":
                const chat = document.getElementById("chat");
                chat.value += `${data.username}: ${data.text}\n`;
                chat.scrollTop = chat.scrollHeight; // Desplazamiento automático
                break;

            default:
                console.warn("Tipo de mensaje desconocido:", data.type);
        }
    } catch (error) {
        console.error("Error procesando mensaje del servidor:", error);
    }
}


function initializeWebSocket() {
    socket = new WebSocket('ws://localhost:8080');// Cambia localhost si el servidor está en otro lugar

    socket.onopen = () => {
        console.log('WebSocket conectado.');
        username = localStorage.getItem('username');
        if (!username) {
            console.error("El nombre de usuario no está definido.");
            return;
        }
        // Enviar datos del jugador al conectarse
        socket.send(
            JSON.stringify({
                type: 'newPlayer',
                username,
                position: playerPosition,
                color: playerColor,
            })
        );
        //placeBall();
    };

    socket.onmessage =  socket.onmessage = handleServerMessage; 

    socket.onclose = (event) => {
        console.log(`WebSocket cerrado. Código: ${event.code}, Razón: ${event.reason}`);
    };
}

function placeBall() {
    let validPositionFound = false;

    while (!validPositionFound) {
        const randomPosition = Math.floor(Math.random() * gridCells.length);

        if (!obstacles.includes(randomPosition) && !isPositionOccupied(randomPosition)) {
            ballPosition = randomPosition;
            validPositionFound = true;

            // Notificar al servidor sobre la nueva posición de la pelota
            socket.send(JSON.stringify({
                type: 'ballUpdate',
                position: ballPosition,
                isBallOnBoard: true,
            }));
        }
    }

    console.log(`Pelota colocada en la posición: ${ballPosition}`);
    updateGrid();
}

function launchBall() {
    if (isBallMoving) return; // No iniciar si la pelota ya está en movimiento
    isBallMoving = true;

    console.log("Lanzamiento de pelota iniciado...");
    let ballDirection;

    // Determinar la dirección según la posición de la pelota
    const ballColumn = ballPosition % 11; // Columna actual de la pelota (0-10)
    if (ballColumn > 5) {
        ballDirection = -1; // Hacia la izquierda
    } else {
        ballDirection = 1; // Hacia la derecha
    }

    const interval = setInterval(() => {
        const nextPosition = ballPosition + ballDirection;

        // Comprobar si la pelota choca con el borde u obstáculo
        const isAtLeftEdge = ballDirection === -1 && nextPosition % 11 === 0;
        const isAtRightEdge = ballDirection === 1 && nextPosition % 11 === 10;
        const isOutOfBounds = nextPosition < 0 || nextPosition >= gridCells.length;
        const isBlocked = isObstacle(nextPosition);

        if (isAtLeftEdge || isAtRightEdge || isOutOfBounds) {
            console.log("Pelota detenida por borde u obstáculo.");
            ballPosition = getNewBallPosition(ballDirection === -1 ? 'left' : 'right'); // Cambiar al otro extremo
            console.log(`Pelota reaparece en la posición: ${ballPosition}`);
            
            // Notificar al servidor la nueva posición de la pelota
            socket.send(JSON.stringify({
                type: 'updateBall',
                position: ballPosition,
            }));

            updateGrid(); // Redibujar la cuadrícula para actualizar la posición de la pelota
            isBallMoving = false; // Permitir nuevo lanzamiento
            clearInterval(interval);
            return;
        }

        // Detectar si la pelota golpea a un jugador
        const hitPlayer = Object.keys(players).find(player =>
            {
                console.log(`Verificando jugador ${player} en posición ${players[player].position}`);
                return players[player].position === nextPosition;
            } );
        if (hitPlayer) {
            console.log(`¡La pelota golpeó al jugador ${hitPlayer}!`);
            socket.send(JSON.stringify({
                type: 'playerEliminated',
                username: hitPlayer,
            }));

            // Detener la pelota y eliminar al jugador del cliente
            delete players[hitPlayer];
            updateGrid();
            clearInterval(interval);
            isBallMoving = false;
            return;
        }

        // Actualizar la posición de la pelota
        ballPosition = nextPosition;

        // Notificar al servidor la nueva posición de la pelota
        socket.send(JSON.stringify({
            type: 'updateBall',
            position: ballPosition,
        }));

        // Redibujar la cuadrícula
        updateGrid();
    }, 300); // Velocidad del movimiento (200 ms)
}


function getNewBallPosition(side) {
    // Obtener todas las posiciones del extremo especificado (columna 0 o columna 10)
    const columnIndexes = [];
    for (let i = 0; i < gridCells.length; i++) {
        if (side === 'left' && i % 11 === 0) columnIndexes.push(i); // Columna izquierda
        if (side === 'right' && i % 11 === 10) columnIndexes.push(i); // Columna derecha
    }

    // Filtrar las posiciones que no estén ocupadas
    const validPositions = columnIndexes.filter(pos => {
        const isBlocked = obstacles.includes(pos);
        const isOccupied = Object.values(players).some(player => player.position === pos);
        return !isBlocked && !isOccupied;
    });

    // Seleccionar una posición aleatoria válida
    const randomIndex = Math.floor(Math.random() * validPositions.length);
    return validPositions[randomIndex];
}


function startCountdown() {
    let countdownValue = 1; // Valor inicial de la cuenta regresiva
    const countdownDisplay = document.getElementById("countdown");

    // Mostrar el contador
    countdownDisplay.style.display = "block";
    countdownDisplay.textContent = `¡Comienza en: ${countdownValue}s!`;

    const countdownInterval = setInterval(() => {
        countdownValue--;
        countdownDisplay.textContent = `¡Comienza en: ${countdownValue}s!`;

        if (countdownValue <= 0) {
            clearInterval(countdownInterval);
            countdownDisplay.style.display = "none"; // Oculta el contador
            canMove = true; // Permitir el movimiento
            //console.log("¡Los jugadores pueden moverse!");
        }
    }, 1000); // Actualizar cada segundo
}


function toggleReady() {
    const readyButton = document.getElementById("readyButton");

    if (readyButton.textContent === "Listo") {
        readyButton.textContent = "No Listo";
        readyButton.style.backgroundColor = "red";
        //console.log("Jugador marcado como no listo");
    } else {
        readyButton.textContent = "Listo";
        readyButton.style.backgroundColor = "green";
        //console.log("Jugador marcado como listo");

        // Iniciar la cuenta regresiva
        //console.log("Iniciando cuenta regresiva...");
        startCountdown();
    }
}

function checkCollision() {
    if (isBallMoving) {
        console.log("La pelota ya está en movimiento, no se evaluará colisión.");
        return; // Evitar colisión si la pelota ya está en movimiento
    }
    if (playerPosition === ballPosition) {
        console.log(`¡Colisión detectada entre ${username} y la pelota!`);
        launchBall(); // Inicia el lanzamiento de la pelota
    }
}



window.toggleReady = toggleReady;



// Inicializar el juego
document.addEventListener('DOMContentLoaded', () => {
    const username = localStorage.getItem("username");
    if (!username) {
        alert("No se ha ingresado un nombre de usuario. Redirigiendo a la página de inicio.");
        window.location.href = "./login.html";
        return;
    }
    console.log(`Nombre de usuario: ${username}`);
    initializeWebSocket(); // Inicializar WebSocket
    createGrid(); // Crear la cuadrícula
    addPlayerToGrid(); // Agregar el jugador al tablero
    //placeBall(); // Colocar la pelota en una posición aleatoria válida

    


    // Agregar evento para capturar las teclas
    document.addEventListener('keydown', (event) => {
        movePlayer(event.key);
    });
});
