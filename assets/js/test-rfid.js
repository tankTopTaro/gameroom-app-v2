const inputElement = document.getElementById('numberOfPlayers')
const warningMessage = document.getElementById('warningMessage')
const addPlayer = document.getElementById('addPlayer')

inputElement.addEventListener('input', () => {
    const max = parseInt(inputElement.max, 10)
    const currentValue = parseInt(inputElement.value, 10)

    if(currentValue > max) {
        warningMessage.style.display = 'block'
    }
    else {
        warningMessage.style.display = 'none'
    }
})

function createPlayer() {
    // Create random ID number
    const rfid = Math.floor(100000 +Math.random() * 900000)

    // Pick a random name
    const names = [
        "Alex", "Jordan", "Taylor", "Morgan", "Casey", 
        "Riley", "Charlie", "Quinn", "Dakota", "Skyler",
        "Jamie", "Emerson", "Avery", "Parker", "Hayden"
    ];
    const playerName = names[Math.floor(Math.random() * names.length)];

    // Pick random avatar
    const avatars = ['avatars/cool.png', 'avatars/shiba-inu.png', 'avatars/chick.png', 'avatars/fashion.png', 'avatars/frog.png', 'avatars/laugh.png'];
    const playerAvatar = avatars[Math.floor(Math.random() * avatars.length)];

    return { rfid, playerName, playerAvatar }
}

async function scanPlayers(rfid, playerName, playerAvatar) {
    try {
        const response = await fetch(`/door/scannedRfid/${rfid}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                playerName: playerName,
                playerAvatar: playerAvatar
            })
        })

        if (!response.ok) {
            throw new Error(`Failed to scan player. Status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Player scanned successfully:', result);
    } catch (error) {
        console.error('Error scanning player:', error);
    }
}

addPlayer.addEventListener('click', async () => {
    const numberOfPlayers = parseInt(inputElement.value, 10);
    const max = parseInt(inputElement.max, 10)

    if(isNaN(numberOfPlayers) || numberOfPlayers < 1 || numberOfPlayers > max) {
        warningMessage.style.display = 'block'
        return
    }

    warningMessage.style.display = 'none'

    for (let i = 0; i < numberOfPlayers; i++) {
        const player = createPlayer();
        console.log('Adding player ${i + 1}: ', player);
        await scanPlayers(player.rfid, player.playerName, player.playerAvatar);
    }
})