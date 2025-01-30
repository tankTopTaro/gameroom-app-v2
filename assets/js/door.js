const app = document.getElementById('app');
const doorMessage = document.getElementById('door-message');
const startGameBtn = document.getElementById('startGameBtn')
const levelButtons = document.querySelectorAll('.level-one, .level-two, .level-three')

const rocket = `<svg  xmlns="http://www.w3.org/2000/svg"  width="100"  height="100"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-rocket"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 13a8 8 0 0 1 7 7a6 6 0 0 0 3 -5a9 9 0 0 0 6 -8a3 3 0 0 0 -3 -3a9 9 0 0 0 -8 6a6 6 0 0 0 -5 3" /><path d="M7 14a6 6 0 0 0 -3 6a6 6 0 0 0 6 -3" /><path d="M15 9m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>`

let selectedLevelBtn = null
let selectedLevelValue = null

let players = []

function startListenningToSocket(){
    let socket = new WebSocket('ws://' + window.location.hostname + ':8082');

    // Listen for the 'open' event to know when the connection is established
    socket.addEventListener('open', event => {
        console.log('WebSocket connection opened.');

        // You can send messages to the WebSocket server using socket.send()
        socket.send('Hello from the browser!');
    });

    socket.addEventListener('message', event => {
        let json
        try {
            json = JSON.parse(event.data)
        } catch (error) {
            console.error('Received a non-json message:', event.data)
        }
        if(json){
            if(json.type === 'scannedRfid'){
                localStorage.setItem('scannedRfid', JSON.stringify(json))
                if(json.players && Array.isArray(json.players) && json.players.length === 6){
                    // Clear previous message
                    doorMessage.innerHTML = ''

                    // Add new message
                    const message = document.createElement('h1')
                    message.classList.add('text-white')
                    message.classList.add('text-center')
                    message.textContent = json.message
                    doorMessage.appendChild(message)

                    // Ensure visibility
                    doorMessage.classList.remove('d-none');
                    doorMessage.classList.add('d-flex');

                    // Clear message after 2 seconds
                    setTimeout(() => {
                        doorMessage.innerHTML = ''
                        doorMessage.classList.remove('d-flex')
                        doorMessage.classList.add('d-none')
                    }, 5000)
                }
                renderDoor(json)
            }
            if(json.type === 'waitingGameRequest'){
                console.log(json)
                // Clear previous message
                doorMessage.innerHTML = ''

                // Add new message
                const message = document.createElement('h1')
                message.classList.add('text-white')
                message.classList.add('text-center')
                message.textContent = json.message
                doorMessage.appendChild(message)

                // Ensure visibility
                doorMessage.classList.remove('d-none');
                doorMessage.classList.add('d-flex');

                // Clear message after 5 seconds
                setTimeout(() => {
                    doorMessage.innerHTML = ''
                    doorMessage.classList.remove('d-flex')
                    doorMessage.classList.add('d-none')
                }, 5000)
            }
            if(json.type === 'gameRequest'){
                // Clear previous message
                doorMessage.innerHTML = ''

                // Add new message
                const message = document.createElement('h1')
                message.classList.add('text-white')
                message.classList.add('text-center')
                message.textContent = json.message
                doorMessage.appendChild(message)

                // Create player list
                const playerList = document.createElement('ul');
                playerList.id = 'room-players';
                playerList.classList.add('list-unstyled', 'text-center', 'mt-3'); // Bootstrap styling

                json.players.forEach((player) => {
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
            
                    // Append player details and score to the player info container
                    playerInfo.appendChild(playerDetails);
            
                    // Append avatar and info to the list item
                    li.appendChild(avatarImg);
                    li.appendChild(playerInfo);
            
                    // Append the list item to the container
                    playerList.appendChild(li);
            
                    playerList.offsetHeight; // Force reflow
                })

                doorMessage.appendChild(playerList)

                // Ensure visibility
                doorMessage.classList.remove('d-none');
                doorMessage.classList.add('d-flex');

                // Clear message after 5 seconds
                setTimeout(() => {
                    doorMessage.innerHTML = ''
                    doorMessage.classList.remove('d-flex')
                    doorMessage.classList.add('d-none')
                }, 5000)
            }
            if(json.type === 'gameEnded'){
                console.log(json.message)
                // Clear previous message
                doorMessage.innerHTML = ''
            }
        }
    });

    // Listen for the 'close' event to know when the connection is closed
    socket.addEventListener('close', event => {
        console.log('WebSocket connection closed.');
    });

    // Listen for the 'error' event to handle any errors that may occur
    socket.addEventListener('error', event => {
        console.error('WebSocket error:', event);

        // TODO : Perform error handling logic here if needed
    });

    window.addEventListener('focus', event => {
        console.log('socket.readyState:',socket.readyState)
    });
}

function renderDoor(data){
    const playerData = data.playerData
    const roomData = data.roomData
 
    // Hide the door message
    doorMessage.innerHTML = ''
    doorMessage.classList.remove('d-flex')
    doorMessage.classList.add('d-none')

    // Show the app
    app.classList.remove('d-none')
    app.classList.add('d-flex')

    // Clear the selections
    selectedLevelBtn = null;
    selectedLevelValue = null;
    startGameBtn.innerHTML = '';
    startGameBtn.classList.add('disabled');

    // Reset all level buttons to their default state
    levelButtons.forEach((button) => {
        button.classList.remove('btn-danger');
        button.classList.add('btn-primary');
    });

    renderPlayerData(playerData)
    renderRoomConfig(roomData)
}

function renderPlayerData(playerData){
    const container = document.getElementById('players')
    container.innerHTML = ''

    playerData.forEach((player) => {
        const li = document.createElement('li')
        li.classList.add('list-item')

        // Create an image element for the avatar
        const avatarImg = document.createElement('img');
        avatarImg.src = player.playerAvatar;
        avatarImg.alt = `${player.playerName || 'Unknown'}'s avatar`;
        avatarImg.classList.add('avatar');

        // Create a span for the player's details
        const playerDetails = document.createElement('span');
        playerDetails.textContent = `${player.playerName || 'Unknown'}`;

        // Append avatar and details to the list item
        li.appendChild(avatarImg);
        li.appendChild(playerDetails);

        // Append the list item to the container
        container.appendChild(li);
    })
}

function renderRoomConfig(roomData){
    const container = document.getElementById('roomConfig')
    const basketballRoom = document.getElementById('basketballRoom')
    const doubleGridRoom = document.getElementById('doubleGridRoom')

    // Slide into view
    container.classList.remove('roomConfigHidden')
    container.classList.add('roomConfigVisible')

    // Hide both rooms initially
    basketballRoom.classList.remove('showConfig')
    doubleGridRoom.classList.remove('showConfig')
    basketballRoom.classList.add('hideConfig')
    doubleGridRoom.classList.add('hideConfig')

    if(roomData === 'doubleGrid'){
        // only show the double grid room
        doubleGridRoom.classList.remove('hideConfig')
        doubleGridRoom.classList.add('showConfig')
    }
    else if(roomData === 'basketball'){
        // only show the basketball room
        basketballRoom.classList.remove('hideConfig')
        basketballRoom.classList.add('showConfig')
    }
}

function handleLevelSelection(event){
    const clickedButton = event.target
    console.log('Selected Level: ', clickedButton.getAttribute('data-level'));

    if(selectedLevelBtn){
        selectedLevelBtn.classList.remove('btn-danger');
        selectedLevelBtn.classList.add('btn-primary');
    }

    if (selectedLevelBtn === clickedButton) {
        selectedLevelBtn.classList.remove('btn-danger');
        selectedLevelBtn.classList.add('btn-primary');
        selectedLevelBtn = null;
        selectedLevelValue = null;
        startGameBtn.classList.add('disabled');
        startGameBtn.innerHTML = '';
        return;
    }

    selectedLevelBtn = clickedButton;
    selectedLevelValue = selectedLevelBtn.getAttribute('data-level');
    selectedLevelBtn.classList.remove('btn-primary');
    selectedLevelBtn.classList.add('btn-danger');
    startGameBtn.classList.remove('disabled');
    startGameBtn.innerHTML = rocket;
}

levelButtons.forEach((button) => {
    button.addEventListener('click', handleLevelSelection);
})

startGameBtn.addEventListener('click', () => {
    let selectedRuleValue = 1;

    if(selectedLevelValue){
        // Submit the selection
        submitRoomConfig(selectedRuleValue, selectedLevelValue)

        // Hide the HUD
        app.classList.remove('d-flex')
        app.classList.add('d-none')

        // Show the door message
        doorMessage.classList.remove('d-none')
        doorMessage.classList.add('d-flex')
    }
})

async function submitRoomConfig(rule, level){
    const queryParams = new URLSearchParams({ rule, level })

    try {
        const response = await fetch(`/game/request?${queryParams.toString()}`)

        if (response.ok) {
            console.log('Room configuration submitted successfully.')
            localStorage.removeItem('scannedRfid')
        } else {
            console.error('Failed to submit room configuration.')
        }
    } catch (error) {
        console.error('Error submitting room configuration:', error)
    }   
}

document.addEventListener('DOMContentLoaded', () => {
    const savedRfid = JSON.parse(localStorage.getItem('scannedRfid'))

    if(savedRfid){
        console.log('Scanned rfid: ', savedRfid)
        renderDoor(savedRfid)
    }
})

startListenningToSocket()