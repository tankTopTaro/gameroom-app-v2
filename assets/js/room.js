const app = document.getElementById('app')

const hudContainer = document.getElementById('hud-container')
const roomElement = document.getElementById('room-info')
const lifesContainer = document.getElementById('lifes-container')
const countdownElement = document.getElementById('countdown')
const colorSequence = document.getElementById('color-sequence')
const scoreMultiplier = document.getElementById('score-multiplier')
const playerScore = document.getElementById('player-score')

const roomMessageContainer = document.querySelector('.room-message-container');
const continueBtn = document.getElementById('continue-button')
const noBtn = document.getElementById('no-button')

const playerMessageContainer = document.getElementById('player-message-container')
const playerMessage = document.getElementById('player-message')

const heartSVG = `<svg id="heart" xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-heart">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
                </svg>`

const heartbreakSVG = `<svg id="heart-broken" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-heart-broken">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
                    <path d="M12 6l-2 4l4 3l-2 4v3" />
                    </svg>` 

let monitoringIsOn = true
let audioQueue = []
let isGameOver = false
let currentSpanIndex = 0;

function startListenningToSocket(){

    // Create a new WebSocket connection
    socket = new WebSocket('ws://' + window.location.hostname + ':8081');

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
            if(json.type === 'newLevelStarts'){
                const newLevel = () => {
                    let newGame = json 
                    console.log('newLevelStarts: ', newGame)
                    

                    // Show the container
                    app.classList.remove('d-none')
                    app.classList.add('d-flex')
                    hudContainer.classList.remove('d-none')
                    hudContainer.classList.add('d-flex')
                    playerMessageContainer.classList.remove('d-flex')
                    playerMessageContainer.classList.add('d-none')

                    // reset the score multiplier
                    scoreMultiplier.textContent = 1
                    playerScore.textContent = 0

                    // Reset the color sequence colors
                    resetSpanColors()

                    // Generate hearts
                    lifesContainer.innerHTML = ''
                    for (let i = 0; i < newGame.lifes; i++) {
                        const heart = document.createElement('div');
                        heart.classList.add('heart');
                        heart.innerHTML = heartSVG;  // Insert the SVG directly
                        lifesContainer.appendChild(heart);
                    }

                    // Hide or show color sequence
                    if(newGame.roomType === 'basketball'){
                        colorSequence.classList.remove('invisible')
                        colorSequence.classList.add('visible')
                    } else {
                        colorSequence.classList.remove('visible')
                        colorSequence.classList.add('invisible')
                    }

                    // Display Room info
                    roomElement.textContent = `Rule ${newGame.rule} Level ${newGame.level}`
                    
                }

                if(isGameOver) {
                    setTimeout(newLevel, 3000)
                } else {
                    newLevel()
                }
            }
            if(json.type === 'updatePrepTime'){
                let countdown = json.prepTime
                let minutes = Math.floor(countdown / 60)
                let seconds = countdown % 60

                minutes = minutes < 10 ? '0' + minutes : minutes
                seconds = seconds < 10 ? '0' + seconds : seconds

                if(countdown <= 60){
                    countdownElement.textContent = `${minutes}:${seconds}`
                }

                if(countdown === 3){
                    fetchAudio(json.audio)
                }
            }
            if(json.type === 'updateCountdown'){
                let countdown = json.countdown
                let minutes = Math.floor(countdown / 60)
                let seconds = countdown % 60

                minutes = minutes < 10 ? '0' + minutes : minutes
                seconds = seconds < 10 ? '0' + seconds : seconds

                if(countdown <= 60){
                    countdownElement.textContent = `${minutes}:${seconds}`
                }
            }
            if(json.type === 'updateLifes'){
                let lifes = json.lifes
                fetchAudio(json.audio)
                console.log('Updating lifes to:', lifes)

                const hearts = lifesContainer.querySelectorAll('.heart')

                // Remove extra hearts and replace with heartbreaks
                if (hearts.length > lifes) {
                    for (let i = lifes; i < hearts.length; i++) {
                        const heart = hearts[i];

                        // Create the heartbreak element
                        const heartbreak = document.createElement('div');
                        heartbreak.classList.add('heart-broken');
                        heartbreak.innerHTML = heartbreakSVG;

                        // Add animation to the heart disappearing
                        heart.classList.add('heart-lost');
                        setTimeout(() => {
                            // Replace heart with heartbreak at the same position
                            if (lifesContainer.contains(heart)) {
                                lifesContainer.replaceChild(heartbreak, heart);
                            }
                        }, 500); // Match the animation duration
                    }
                }
            }
            if(json.type === 'noMoreLifes') {
                isGameOver = true
                setTimeout(() => {
                    lifesContainer.innerHTML = ''
                }, 2000)
                
            }
            if(json.type === 'offerSameLevel' || 
                json.type === 'offerNextLevel'){
                console.log(json.message)
                // hide the hud then show the message
                const hud = document.querySelector('.hud');
                
                const roomMessage = document.getElementById('room-message')
                roomMessage.textContent = json.message

                // Hide the HUD
                if (hud) {
                    hud.classList.remove('d-flex')
                    hud.classList.add('d-none')
                }

                if (roomMessageContainer) {
                    roomMessageContainer.classList.remove('d-none');
                    roomMessageContainer.classList.add('d-flex');
                }

                // Automatically exit the game if there is no interaction for 10 seconds
                setTimeout(() => {
                    if(noBtn){
                        noBtn.click()
                    }
                }, 10000)
                
                if (continueBtn) {
                    continueBtn.addEventListener('click', () => {
                        const message = {
                            'type': 'continue'
                        };
            
                        // Send the message via the socket
                        socket.send(JSON.stringify(message));
            
                        // Hide the room message and show the HUD again
                        if (roomMessageContainer) {
                            roomMessageContainer.classList.remove('d-flex');
                            roomMessageContainer.classList.add('d-none');
                        }
            
                        if (hud) {
                            hud.classList.remove('d-none');
                            hud.classList.add('d-flex');
                        }
                    });
                }

                
                if (noBtn) {
                    noBtn.addEventListener('click', () => {
                        const message = {
                            'type': 'exit'
                        };
                        console.log('Exit game')
                        // Send the message via the socket
                        socket.send(JSON.stringify(message));
            
                        // Hide the room message and show the HUD again
                        if (roomMessageContainer) {
                            roomMessageContainer.classList.remove('d-flex');
                            roomMessageContainer.classList.add('d-none');
                        }
            
                        if (hud) {
                            hud.classList.remove('d-none');
                            hud.classList.add('d-flex');
                        }
                    });
                }
            }
            if(json.type === 'gameEnded'){
                isGameOver = true
                // Hide the HUD
                hudContainer.classList.remove('d-flex')
                hudContainer.classList.add('d-none')

                // Show the game ended message
                playerMessageContainer.classList.remove('d-none')
                playerMessageContainer.classList.add('d-flex')
                playerMessage.textContent = json.message

                // Reset the displays
                roomElement.textContent = ''
                lifesContainer.innerHTML = ''
                countdownElement.textContent = '00:00'
                scoreMultiplier.textContent = '1'
                playerScore.textContent = '0'

                // Hide the HUD after 3 seconds
                setTimeout(() => {
                    isGameOver = false
                    playerMessage.textContent = ''
                    playerMessageContainer.classList.remove('d-flex')
                    playerMessageContainer.classList.add('d-none')
                    app.classList.remove('d-flex')
                    app.classList.add('d-none')
                }, 3000)
                resetSpanColors()
            }
            if(json.type === 'colorNames'){
                let color = json
                
                if (color) {
                    audioQueue.push(fetchAudio(color.name));
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
                console.log(json)
                fetchAudio(json.audio)
                setColorToSpan(json.color)
                scoreMultiplier.textContent = json.scoreMultiplier
                playerScore.textContent = json.playerScore
            }
            if(json.type === 'playerFailed'){
                console.log('Color clicked:', json.color)
                scoreMultiplier.textContent = '1'   // reset score multiplier display
                playerScore.textContent = json.playerScore
                setColorToSpan(json.color)
            }
            if(json.type === 'levelFailed'){
                let lose = json
                fetchAudio(lose.audio)
                console.log('levelFailed')
            }
            if(json.type === 'levelCompleted'){
                let win = json
                fetchAudio(win.audio)
            }
            if(json.type === 'greenButtonPressed'){
                roomMessageContainer.classList.remove('d-flex')
                roomMessageContainer.classList.add('d-none')
            }
        }

    });

    // Listen for the 'close' event to know when the connection is closed
    socket.addEventListener('close', event => {
        console.log('WebSocket connection closed.');
        if(monitoringIsOn){
            console.log('Redrawing the room after WebSocket connection closed.');
            //PrepareRoom() // Restart socket upon closed unintentionnally
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
            //PrepareRoom()
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

function setColorToSpan(color) {
    const spans = colorSequence.querySelectorAll('span');

    if(spans.length > 0 && color){
        const allSpansFilled = Array.from(spans).every(span => span.style.backgroundColor);

        // Reset all spans if all are filled
        if (allSpansFilled) {
            resetSpanColors();
        }
        
        const [r, g, b] = color;

        console.log('r', r, 'g', g, 'b', b)

        spans[currentSpanIndex].style.backgroundColor = `rgb(${r}, ${g}, ${b})`;

        currentSpanIndex = (currentSpanIndex + 1) % spans.length;
    }
}

function resetSpanColors() {
    const spans = colorSequence.querySelectorAll('span');
    spans.forEach(span => {
        span.style.backgroundColor = '';  // Clear the background color
    });
    currentSpanIndex = 0; // Reset the index if you want to start from the first span
}

startListenningToSocket()


