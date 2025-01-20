const lifesElement = document.getElementById('lifes')
const statusElement = document.getElementById('status')
const countdownElement = document.getElementById('countdown')
const roomElement = document.getElementById('roomInfo')
const container = document.getElementById('players')
const canvas = document.getElementById('canvas1')
const ctx = canvas.getContext('2d')

let room = undefined
let lights = undefined
let scale = undefined
let socket = undefined
let monitoringIsOn = true
let lightsAreDrawn = false
let bufferedLightUpdates = []
let yellowDots = []
let audioQueue = []

// Give the canvas good size to avoid the default size of 300px which then streches and pixellizes

/**
 * I disabled the audio in the monitor since it overlaps 
 * with the audio of the room when it plays
 * 
 * 
 */


function handleCanvasClick(event) {
    // Get the mouse coordinates relative to the canvas
    const x = (event.clientX - canvas.getBoundingClientRect().left) * (canvas.width / canvas.offsetWidth);
    const y = (event.clientY - canvas.getBoundingClientRect().top) * (canvas.height / canvas.offsetHeight);
    const xScaled = x / scale
    const yScaled = y / scale

    // draw a circle to witness the click
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 255, 0, 0.6)';
    ctx.fill();
    ctx.closePath();
    ctx.restore();

    yellowDots.push({ x, y, radius: 12 });

    // Find out who is clicked
    // scanning reversely because the last lights drawn are z-up
    let clickedLight = false
    for (let i = lights.length - 1; i >= 0; i--) {
        const light = lights[i]
        if(light.shape === 'rectangle'
            && xScaled >= light.posX && xScaled <= light.posX + light.width
            && yScaled >= light.posY && yScaled <= light.posY + light.height
        ){
            clickedLight = light
            if(clickedLight.onClick === 'ignore'){
                console.log('click ignored')
                console.log(light.color)
            }
            else{
                console.log('click sent (whileColorWas: '+clickedLight.color+' whileOnClickWas: '+clickedLight.onClick+')')
                ReportLightClickAction(clickedLight)
            }
            break;
        }
    }
    //console.log('clicked x:'+x+' y:'+y+' | xScaled:'+xScaled+' yScaled:'+yScaled)
}

canvas.addEventListener('click', handleCanvasClick);

function handleCanvasResize() {
    // Update the canvas size to match the new window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drawRoom()
}

window.addEventListener('resize', handleCanvasResize);

async function downloadRoom(){
    const response = await fetch('/get/roomData')
    const json = await response.json();
    room = json.room
    lights = json.lights
}

function ReportLightClickAction(light){
    fetch('/game/lightClickAction?lightId='+light.id+'&whileColorWas='+light.color)
}

async function drawRoom(){
    console.log('Drawing room...')

    canvas.width = window.innerWidth
    scale = canvas.width / room.width
    //console.log('scale: '+scale)
    canvas.height = room.height * scale

    ctx.fillStyle = 'rgb(43, 51, 55)' // dark gray
    ctx.fillRect(0,0,canvas.width,canvas.height)

    lights.forEach((light) => {
        if(light.color === undefined){
            light.color = [0,0,0]
            light.onClick = 'ignore'
        }
        drawLight(light) //
    })
}

function drawLight(light){
    //console.log('Coloring light: ',light,' to color: ' , light.color)
    if(light.type === 'ledSwitch'){
        ctx.fillStyle = 'rgb('+light.color[0]+', '+light.color[1]+', '+light.color[2]+')'
        ctx.fillRect(
            light.posX * scale,
            light.posY * scale,
            light.width * scale,
            light.height * scale
        )
    }else if(light.type === 'screen'){
        ctx.fillStyle = 'rgb(0, 0, 0)'
        ctx.fillRect(
            light.posX * scale,
            light.posY * scale,
            light.width * scale,
            light.height * scale
        )
        ctx.font = '22px Arial'; // Font size and type
        ctx.fillStyle = 'white'; // Text color
        ctx.textAlign = 'center'; // Horizontal alignment
        ctx.textBaseline = 'middle'; // Vertical alignment
        const text = ''+(light.color[0] === 0 ? '' : (light.color[0]+',') ) + (light.color[1] === 0 ? '' : (light.color[1]+',') ) + (light.color[2] === 0 ? '' : light.color[2] )
        ctx.fillText(text, light.posX * scale + (light.width * scale /2) -1, light.posY * scale + (light.height * scale /2) +2 )
    }

}

async function PrepareRoom(){
    await downloadRoom()
    await drawRoom()
    lightsAreDrawn = true
    applyBufferedLightUpdates()
}

function applyBufferedLightUpdates(){
    //console.log('applying '+bufferedLightUpdates.length+' buffered updates')
    bufferedLightUpdates.forEach((light) => {
        lights[light.lightId].color = light.color
        drawLight(lights[light.lightId])
        }
    )
    bufferedLightUpdates = []
}

function startListenningToSocket(){
    // Create a new WebSocket connection
    socket = new WebSocket('ws://' + window.location.hostname + ':8080');

    // Listen for the 'open' event to know when the connection is established
    socket.addEventListener('open', event => {
        console.log('WebSocket connection opened.');

        // You can send messages to the WebSocket server using socket.send()
        socket.send('Hello from the browser!');
    });

    // Listen for incoming messages from the WebSocket server
    socket.addEventListener('message', event => {
        let json
        try {
            json = JSON.parse(event.data)
        } catch (error) {
            console.log('Received a non-json message:', event.data)
        }
        if(json){
            if(json.type === 'gameRequest'){
                console.log(json)
            }
            if(json.type === 'newLevelStarts'){
                let newGame = json
                console.log('newLevelStarts: ', newGame)
                lifesElement.textContent = newGame.lifes
                statusElement.textContent = ''
                roomElement.textContent = 'Room: ' + newGame.roomType + ' Rule: ' + newGame.rule + ' Level: ' + newGame.level

                renderPlayerData(newGame.players)
            }
            if(json.type === 'updateCountdown'){
                let countdown = json.countdown
                let minutes = Math.floor(countdown / 60)
                let seconds = countdown % 60

                minutes = minutes < 10 ? '0' + minutes : minutes
                seconds = seconds < 10 ? '0' + seconds : seconds

                if(countdown < 61){
                    countdownElement.textContent = `${minutes}:${seconds}`
                }
            }
            if(json.type === 'updatePrepTime'){
                let countdown = json.prepTime
                let minutes = Math.floor(countdown / 60)
                let seconds = countdown % 60

                minutes = minutes < 10 ? '0' + minutes : minutes
                seconds = seconds < 10 ? '0' + seconds : seconds

                if(countdown < 61){
                    countdownElement.textContent = `${minutes}:${seconds}`
                }
                if(json.prepTime === 3){
                    //fetchAudio(json.audio)
                }
            }
            if(json.type === 'updateLight'){
                let light = json
                if(lightsAreDrawn){
                    lights[light.lightId].color = light.color
                    lights[light.lightId].onClick = light.onClick
                    drawLight(lights[light.lightId])
                }
                else{
                    bufferedLightUpdates.push(light)
                }

            }
            if(json.type === 'colorNames'){
                let color = json
                
                if (color) {
                    //audioQueue.push(fetchAudio(color.name));
                }
            }
            if(json.type === 'colorNamesEnd'){
                Promise.all(audioQueue)
                    .then(() => {
                        let message = {
                            'type': 'colorNamesEnd'
                        }
                        socket.send(JSON.stringify(message))
                    })
                    .catch(error => {
                        console.error('Error playing audio:', error);
                    })
            }
            if(json.type === 'playerScored'){
                let success = json
                console.log('playerScored', success)
                renderPlayerData(json.players)
                if (success) {
                    //fetchAudio(success.audio)
                }
            }
            if(json.type === 'levelCompleted'){
                let win = json

                if(statusElement){
                    statusElement.textContent = win.message
                    //fetchAudio(win.audio)
                }
            }
            if(json.type === 'levelFailed'){
                let lose = json

                console.log('levelFailed')
                if(statusElement){
                    statusElement.textContent = lose.message
                    
                    //fetchAudio(lose.audio)
                }
            }
            if(json.type === 'gameEnded'){
                resetMonitor()
                PrepareRoom()
            }
            if(json.type === 'updateLifes'){
                let lifes = json.lifes
                let audio = json.audio
                
                console.log('updateLifes', lifes)
                if (lifesElement) {
                    lifesElement.textContent = lifes.toString();
                    //fetchAudio(audio)
                }
                
                if(lifes === 0){
                    resetMonitor()
                }
            }
            if(json.type === 'offerSameLevel'){}
            if(json.type === 'offerNextLevel'){}
            if(json.type === 'timeIsUp'){}
            if(json.type === 'noMoreLifes'){}
            if(json.type === 'scannedRfid'){}
            if(json.type === 'gameRequest'){}
            if(json.type === 'playerFailed'){}
        }

    });

    // Listen for the 'close' event to know when the connection is closed
    socket.addEventListener('close', event => {
        console.log('WebSocket connection closed.');
        if(monitoringIsOn){
            console.log('Redrawing the room after WebSocket connection closed.');
            PrepareRoom() // Restart socket upon closed unintentionnally
        }

    });

    // Listen for the 'error' event to handle any errors that may occur
    socket.addEventListener('error', event => {
        console.error('WebSocket error:', event);

        // TODO : Perform error handling logic here if needed
    });

    window.addEventListener('focus', event => {
        console.log('socket.readyState:',socket.readyState)
        if(monitoringIsOn && socket.readyState === 3){
            console.log('Redrawing the room after upon window focus event and socket closed')
            PrepareRoom()
        }
    });
}

async function fetchAudio(soundName) {
    try{
        const response = await fetch(`/game/audio`)
        const data = await response.json()
        
        return new Promise((resolve, reject) => {
            const audio = new Audio(data[soundName])
            audio.muted = true;
            audio.play()
                .then(() => {
                    audio.muted = false;
                })
                .catch(err => {
                    console.error('Autoplay failed:', err)
                    reject(err);
                });
            
                audio.onended = () => {
                    resolve();
                };
        })

    }catch(error){
        console.error('Failed to load audio:', error)
    }
}

function resetMonitor() {
    lifesElement.textContent = '5'
    countdownElement.textContent = '00:00'
    statusElement.textContent = ''
    roomElement.textContent = ''
    players.innerHTML = ''
}

function clearDots(x, y, radius) {
    // Save the current drawing state
    ctx.save();

    // Create a clipping path in the shape of the circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);

    ctx.globalCompositeOperation = 'destination-out';
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over'; 
    
    /* ctx.clip(); 
    // Clear the area inside the clipping path
    ctx.clearRect(x - radius, y - radius, radius * 2, radius * 2); */

    // Restore the original drawing state
    ctx.restore();
}

function renderPlayerData(playerData){
    container.innerHTML = ''

    playerData.forEach((player) => {
        const li = document.createElement('li')
        li.classList.add('list-item')

        // Create an image element for the avatar
        const avatarImg = document.createElement('img');
        avatarImg.src = player.playerAvatar;
        avatarImg.alt = `${player.playerName || 'Unknown'}'s avatar`;
        avatarImg.classList.add('avatar');

        // Create a container for players info
        const playerInfo = document.createElement('div');
        playerInfo.classList.add('d-flex');
        playerInfo.classList.add('flex-column');
        playerInfo.classList.add('align-items-start');

        // Create a span for the player's details
        const playerDetails = document.createElement('span');
        playerDetails.textContent = `${player.playerName || 'Unknown'}`;

        // Create a span for the player's score
        const playerScore = document.createElement('span');
        playerScore.textContent = `Score: ${player.score}`;

        // Append player details and score to the player info container
        playerInfo.appendChild(playerDetails);
        playerInfo.appendChild(playerScore);

        // Append avatar and info to the list item
        li.appendChild(avatarImg);
        li.appendChild(playerInfo);

        // Append the list item to the container
        container.appendChild(li);

        container.offsetHeight; // Force reflow
    })
}

// Erases yellow dots
setInterval(() => {
    yellowDots.forEach((dot) => {
        clearDots( dot.x, dot.y, dot.radius)
    })
    yellowDots = []
    drawRoom()
}, 4000)

lightsAreDrawn = false
startListenningToSocket()
PrepareRoom()