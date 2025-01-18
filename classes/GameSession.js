const Shape = require('./Shape')
const Console = require('console')
const { hsvToRgb, areRectanglesIntersecting } = require('../utils/utils')

const blueGreen1 = hsvToRgb([130,220,255])
const green = hsvToRgb([120, 255, 255])
const black = hsvToRgb([0,0,0])

/**
 * The issue with the game session overlapping was cause by 
 * handling the prepTime inside the prepare() method
 * 
 * I moved the 10-second delay to the start() method
 * and this might have solved that issue
 * 
 * You can only add one waiting game session at a time,
 * It wouldn't make sense if we allow adding multiple waiting game session
 * 
 * So other players will have to wait for the players in front of them
 * to enter the room before they can add another waiting game session
 * 
 */

class GameSession{
    constructor(rule, level, room, roomType) {
        this.room = room
        this.roomType = roomType
        this.prepTimer = undefined
        this.score = 0
        this.isGreenButtonPressed = false
        this.blinkInterval = undefined
        this.isGreen = true
        this.receivedMessage = undefined

        this.status = undefined
        this.rule = Number(rule)
        this.level = Number(level)
        this.gameStartedAt = undefined
        this.animationMetronome = undefined
        this.shapes = []
        this.lastLevelCreatedAt = Date.now()
        this.lastLevelStartedAt
        this.createdAt = Date.now()
        this.levelsStartedWhileSessionIsWaiting = 0
    }

    async init(){
        let result

        await this.prepareAndGreet()
            .then(() => {
                this.room.isFree = false
                this.start()
                result = true
            })
            .catch((e) => {
                console.log('CATCH: prepareAndGreet() failed')
                console.log(e)
                this.currentGameSession = undefined
                console.log('Game session cancelled.')
                console.log('Room remains free.')
                result = e
                // TODO: reportErrorToCentral(e);
            });
        return result
    }

    reset(){
        if(this.blinkInterval){
            clearInterval(this.blinkInterval);
            this.blinkInterval = undefined
        }
        this.score = this.room.players.playing[0].score
        this.status = undefined
        this.shapes = []
        this.lastLevelCreatedAt = Date.now()
        this.room.isFree = true
        this.room.lights.forEach(light => {
            light.color = black
            light.onClick = 'ignore'
        })
        this.room.sendLightsInstructionsIfIdle()
    }

    prepareAndGreet(){
        let prepared = this.prepare()
        let greeted = this.greet()
        return Promise.all([prepared, greeted])
            .then((results) => {
                console.log('Both promises are resolved!');
                console.log('Result of prepare() :', results[0]);
                console.log('Result of greet() :', results[1]);
            })
    }

    greet(){  // greet() will say hi to the player and will happen while prepare() prepares the game
        return new Promise((resolve) => {
            console.log('Greeting sound starts...');
            setTimeout(() => {
                console.log('Greeting sound ends...');
                resolve(true);
            }, 2000);
        });
    }

    async prepare(){  // prepares anything that is better to prepare and wait for the players input on a certain button (or a countdown to end)
        return new Promise((resolve,reject) => {
            console.log('preparation starts...');
            this.scoreMultiplier = 1
            this.baseScore = 10
            this.timeForLevel = 60
            this.prepTime = 10
            this.prepCountdown = this.prepTime
            this.countdown = this.timeForLevel
            this.lifes = 5
            let message = {
                'type':'newLevelStarts',
                'rule':this.rule,
                'level':this.level,
                'countdown':this.countdown,
                'lifes':this.lifes,
                'roomType': this.roomType,
                'players':this.room.players.playing
            }
            this.room.socketForRoom.broadcastMessage(JSON.stringify(message))
            this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))
            
            setTimeout(async () => {
                try{
                    await this.prepareShapes()
                    clearInterval(this.prepTimer)
                    console.log('preparation ends...');
                    this.status = 'prepared'
                    resolve(true);
                }
                catch(e){ //need to catch and reject explicitely because the we are in a SetTimeout
                    Console.log('CATCH: prepareShapes() failed')
                    reject(e);
                }

            }, 1000);
        });
    }

    prepareShapes(){    // handle the animations for the lights
        if(this.roomType === 'doubleGrid'){
            if(this.rule === 1){
                if(this.level === 1){
                    let pathDots = [
                        { x: 25, y: 0 },
                        { x: 100, y: -180 },
                        { x: 200, y: -340 },
                        { x: 300, y: -420 },
                        { x: 400, y: -474 },
                        { x: 500, y: -500 },
                        { x: 595, y: -474 },
                        { x: 690, y: -420 },
                        { x: 785, y: -340 },
                        { x: 880, y: -180 },
                        { x: 955, y: 0 },
                        { x: 880, y: -180 },
                        { x: 785, y: -340 },
                        { x: 690, y: -420 },
                        { x: 595, y: -474 },
                        { x: 500, y: -500 },
                        { x: 400, y: -474 },
                        { x: 300, y: -420 },
                        { x: 200, y: -340 },
                        { x: 100, y: -180 },
                        { x: 25, y: 0 }
                    ];
                    //pathDots = pathDots.reverse().concat(pathDots)
                    this.shapes.push(new Shape(100,100, 'rectangle',35,3000, [255,0,0], 'report',  pathDots, 0.01, 'mainFloor'))
                }
                else if(this.level === 2){
                    let pathDotsAlongVertical = [
                        { x: 0, y: 25 },
                        { x: -50, y: 100 },
                        { x: -150, y: 250 },
                        { x: -300, y: 400 },
                        { x: -450, y: 450 },
                        { x: -500, y: 450 },
                        { x: -450, y: 400 },
                        { x: -300, y: 250 },
                        { x: -150, y: 100 },
                        { x: -50, y: 50 },
                        { x: 0, y: 25 }
                    ];

                    let pathDotsAlongHorizontal = [
                        { x: 25, y: 0 },
                        { x: 100, y: -180 },
                        { x: 200, y: -340 },
                        { x: 300, y: -420 },
                        { x: 400, y: -474 },
                        { x: 500, y: -500 },
                        { x: 595, y: -474 },
                        { x: 690, y: -420 },
                        { x: 785, y: -340 },
                        { x: 880, y: -180 },
                        { x: 955, y: 0 },
                        { x: 880, y: -180 },
                        { x: 785, y: -340 },
                        { x: 690, y: -420 },
                        { x: 595, y: -474 },
                        { x: 500, y: -500 },
                        { x: 400, y: -474 },
                        { x: 300, y: -420 },
                        { x: 200, y: -340 },
                        { x: 100, y: -180 },
                        { x: 25, y: 0 }
                    ]
                    //pathDots = pathDots.reverse().concat(pathDots)
                    this.shapes.push(new Shape(100,100, 'rectangle',35,3000, [255,0,0], 'report',  pathDotsAlongHorizontal, 0.01, 'mainFloor'))
                    this.shapes.push(new Shape(100,100, 'rectangle',3000,35, [255,0,0], 'report',  pathDotsAlongVertical, 0.01, 'mainFloor'))
                }
                else if(this.level === 3){
                    let pathDots = [
                        { x: 0, y: 0 },
                        { x: 25, y: 0 },
                        { x: 100, y: 0 },
                        { x: 200, y: 0 },
                        { x: 300, y: 0 },
                        { x: 400, y: 0 },
                        { x: 500, y: 0 },
                        { x: 595, y: 0 },
                        { x: 690, y: 0 },
                        { x: 785, y: 0 },
                        { x: 785, y: 100 },
                        { x: 785, y: 250 },
                        { x: 785, y: 300 },
                        { x: 690, y: 300 },
                        { x: 595, y: 300 },
                        { x: 500, y: 300 },
                        { x: 400, y: 300 },
                        { x: 300, y: 300 },
                        { x: 200, y: 300 }, 
                        { x: 100, y: 300 },
                        { x: 25, y: 300 },
                        { x: 0, y: 300 },
                        { x: 0, y: 250 },
                        { x: 0, y: 100 },
                        { x: 0, y: 25 },
                        { x: 0, y: 0 },
                    ];

                    let safeDots = [
                        { x: 0, y: 0 }
                    ]

                    // Danger Zone
                    this.shapes.push(new Shape(150,150, 'rectangle',150,150, [255,0,0], 'report',  pathDots, 0.01, 'mainFloor'))
                    
                    // Safe Zone
                    this.shapes.push(new Shape(320,320, 'rectangle',560,90, [0,255,0], 'report',  safeDots, 0, 'mainFloor'))
                }
            }
            else{
                throw new Error('level doesnt match')
            }
        }
    }

    start(){
        this.prepTimer = setInterval(() => {
            this.updatePrepTime()
        }, 1000)

        setTimeout(() => {
            if (this.status === 'running') {
                console.warn('Game is already running. Ignoring start call.');
                return; // Prevent multiple starts
            }

            console.log('Starting the Game...');
            this.lastLevelStartedAt = Date.now()

            if(this.roomType === 'doubleGrid'){          
                if(this.rule === 1){                
                    if(this.level === 1){                                  
                        function getRandomInt(min, max) {
                            return Math.floor(Math.random() * (max - min + 1)) + min;
                        }
                        function shuffleArray(array) {
                            for (let i = array.length - 1; i > 0; i--) {
                                const j = getRandomInt(0, i);
                                [array[i], array[j]] = [array[j], array[i]];
                            }
                        }
                        
                        // Generates an array of numbers, shuffles it, and returns the shuffled sequence.
                        function makeNumberSequence(size){
                            const numbersSequence = [];
                            for (let i = 1; i <= size; i++) {
                                numbersSequence.push(i);
                            }
                            shuffleArray(numbersSequence);
                            return numbersSequence
                        }
    
                        const numbersSequence = makeNumberSequence(12)
                        console.log('TEST: numbersSequence: ',numbersSequence)
    
                        this.ligthIdsSequence = []
    
                        this.room.lightGroups.wallScreens.forEach((light, i) => {
                            light.color = [0,0,numbersSequence[i]]
                        })
    
                        this.room.lightGroups.wallButtons.forEach((light, i) => {
                            light.color = blueGreen1
                            light.onClick = 'report'
                            this.ligthIdsSequence[numbersSequence[i]] = light.id
                        })
    
                        this.ligthIdsSequence.splice(0, 1)
    
                    }
                    else if(this.level === 2){
                        // TODO: refactor this as it duplicates the code from level 1
                        function getRandomInt(min, max) {
                            return Math.floor(Math.random() * (max - min + 1)) + min;
                        }
                        function shuffleArray(array) {
                            for (let i = array.length - 1; i > 0; i--) {
                                const j = getRandomInt(0, i);
                                [array[i], array[j]] = [array[j], array[i]];
                            }
                        }
                        function makeNumberSequence(size){
                            const numbersSequence = [];
                            for (let i = 1; i <= size; i++) {
                                numbersSequence.push(i);
                            }
                            shuffleArray(numbersSequence);
                            return numbersSequence
                        }
    
                        const numbersSequence = makeNumberSequence(12)
                        console.log('TEST: numbersSequence: ',numbersSequence)
    
                        this.ligthIdsSequence = []
    
                        this.room.lightGroups.wallScreens.forEach((light, i) => {
                            light.color = [0,0,numbersSequence[i]]
                        })
                        this.room.lightGroups.wallButtons.forEach((light, i) => {
                            light.color = blueGreen1
                            light.onClick = 'report'
                            this.ligthIdsSequence[numbersSequence[i]] = light.id
                        })
                        this.ligthIdsSequence.splice(0, 1)
    
                    }
                    else if(this.level === 3){
                        // TODO: refactor this as it duplicates the code from level 1
                        function getRandomInt(min, max) {
                            return Math.floor(Math.random() * (max - min + 1)) + min;
                        }
                        function shuffleArray(array) {
                            for (let i = array.length - 1; i > 0; i--) {
                                const j = getRandomInt(0, i);
                                [array[i], array[j]] = [array[j], array[i]];
                            }
                        }
                        function makeNumberSequence(size){
                            const numbersSequence = [];
                            for (let i = 1; i <= size; i++) {
                                numbersSequence.push(i);
                            }
                            shuffleArray(numbersSequence);
                            return numbersSequence
                        }
    
                        const numbersSequence = makeNumberSequence(12)
                        console.log('TEST: numbersSequence: ',numbersSequence)
    
                        this.ligthIdsSequence = []
    
                        this.room.lightGroups.wallScreens.forEach((light, i) => {
                            light.color = [0,0,numbersSequence[i]]
                        })
                        this.room.lightGroups.wallButtons.forEach((light, i) => {
                            light.color = blueGreen1
                            light.onClick = 'report'
                            this.ligthIdsSequence[numbersSequence[i]] = light.id
                        })
                        this.ligthIdsSequence.splice(0, 1)
                    }
                }
            } 
            else if(this.roomType === 'basketball'){
                if(this.rule === 1){
                    if(this.level === 1){
                        const colors = [
                            [255,0,0],    // red
                            [0,255,0],    // green
                            [0,0,255],    // blue
                            [255,255,0],  // yellow
                            [255,0,255]   // purple
                        ];
    
                        function getColorName(rgb) {
                            const colorNames = {
                                '255,0,0': 'red',
                                '0,255,0': 'green',
                                '0,0,255': 'blue',
                                '255,255,0': 'yellow',
                                '255,0,255': 'purple'
                            }
    
                            return colorNames[rgb.join(',')]
                        }
                        
                        // Generate a random color sequence
                        function makeColorSequence(size) {
                            return Array.from({ length: size }, () => Math.floor(Math.random() * colors.length));
                        }
                        
                        // Shuffle an array
                        function shuffleArray(array) {
                            for (let i = array.length - 1; i > 0; i--) {
                                const j = Math.floor(Math.random() * (i + 1));
                                [array[i], array[j]] = [array[j], array[i]];
                            }
                            return array;
                        }
                        
                        const colorsSequence = makeColorSequence(3).map(i => colors[i]);
    
                        console.log('Color sequence:', colorsSequence);
    
                        // Play sounds according to what is in the sequence
                        
                        this.lightColorSequence = new Array(colorsSequence.length).fill(null);
    
                        let currentColorIndex = 0;
    
                        const showColorSequence = setInterval(() => {
                            const currentColor = colorsSequence[currentColorIndex]
                            console.log(currentColor)
    
                            const colorName = getColorName(currentColor)
    
                            console.log('Showing color: ', colorName)
    
                            let message = {
                                'type': 'colorNames',
                                'name': colorName
                            }
    
                            this.room.socketForRoom.broadcastMessage(JSON.stringify(message))
                            this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))
    
                            this.room.lightGroups.wallButtons.forEach((light) => {
                                light.color = colorsSequence[currentColorIndex];
                            });
                            
                            currentColorIndex++;
    
                            if (currentColorIndex >= colorsSequence.length) {
                                setTimeout(() => {
                                    clearInterval(showColorSequence);
                                    
                                    // TODO: Add another interval to change the shuffled colors after 3 seconds
                                    const shuffledColors = shuffleArray([...colors]);
                                    this.room.lightGroups.wallButtons.forEach((light, i) => {
                                        light.color = shuffledColors[i]
                                    })
                                    let message = {
                                        'type': 'colorNamesEnd',
                                    }
                                    this.room.socketForRoom.broadcastMessage(JSON.stringify(message))
                                    this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))
                                }, 1000)
                            }
                        }, 1000)
    
                        this.room.lightGroups.wallButtons.forEach((light, i) => {
                            light.onClick = 'report';
                            this.lightColorSequence[i] = colorsSequence[i % colorsSequence.length];
                        }); 
    
                        this.lightColorSequence.length = colorsSequence.length;
                    }
                }
            }

            if (this.animationMetronome) {
                clearInterval(this.animationMetronome);
            }    
            
            if (this.roomType === 'doubleGrid'){
                console.log('Double Grid')
                this.animationMetronome = setInterval(() =>{
                    this.updateCountdown()
                    this.updateShapes()
                    this.applyShapesOnLights()
                    this.room.sendLightsInstructionsIfIdle()
                } , 1000/25)
            } else if (this.roomType === 'basketball'){
                console.log('Basketball Hoops')
                this.animationMetronome = setInterval(() =>{
                    this.updateShapes()
                    this.applyShapesOnLights()
                    this.room.sendLightsInstructionsIfIdle()
                } , 1000/25)

                const receivedMessage = this.room.socketForRoom.waitForMessage();
    
                receivedMessage.then((message) => {
                    if (message.type === 'colorNamesEnd') {
                        this.animationMetronome = setInterval(() =>{
                            this.updateCountdown()
                        } , 1000/25)
                    }
                })
            }

            this.gameStartedAt = Date.now()
            this.status = 'running'
            console.log('GameSession Started.');
        }, this.prepTime * 1000)
    }

    startGreenButton(){
        if(this.isWaitingForGreenButton){
            if(this.blinkInterval){
                clearInterval(this.blinkInterval);
            }
    
            this.blinkInterval = setInterval(() => {
                //this.room.lightGroups.wallButtons[0].color = green
                this.isGreen = !this.isGreen
                this.room.lightGroups.wallButtons[0].color = this.isGreen ? black : green
                this.room.sendLightsInstructionsIfIdle()
                //console.log('TEST: isGreen: '+ this.isGreen)
            }, 500)
    
            this.room.lightGroups.wallButtons.forEach((light, i) => {
                if(i === 0){
                    light.onClick = 'report'
                }
                else {
                    light.color = black
                    light.onClick = 'ignore'
                }
            })
        }
    }

    handleLightClickAction(lightId, whileColorWas){
        // We should assume that if the click event was reported, it means that the click was made during a period where that click actually meant something
        // That implies that we should always set the onClick as ignore is all the other cases (mostly black tiles)
        // That being said, we still want to know the whileColorWas because light could go from red (lava) to blue (catchable item) and both mean something, but very different
        let clickedLight = this.GetLightById(lightId)
        console.log('TEST: clickedLight '+lightId+' whileColorWas: '+ whileColorWas)

        if(this.isWaitingForGreenButton){
            console.log('TEST: waiting for green button')
            this.isGreenButtonPressed = true

            let message = {
                'type': 'greenButtonPressed',
            }
    
            this.room.socketForRoom.broadcastMessage(JSON.stringify(message))
            this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))

            let simulatedMessage = {'type': 'continue'}

            if(this.blinkInterval){
                clearInterval(this.blinkInterval);
            }

            this.room.socketForRoom.simulateMessage(simulatedMessage);
            return
        }

        if(this.roomType === 'doubleGrid'){ 
            this.handleDoubleGridAction(clickedLight, whileColorWas)
        }
        else if(this.roomType === 'basketball'){
            this.handleBasketballAction(clickedLight, whileColorWas)
        }

    }

    handleDoubleGridAction(clickedLight, whileColorWas){
        if(this.rule === 1){
            if(this.level === 1){
                // Here we expect :
                // - walking on red => lose a life
                // - pushing the correct next button => turn it off and play success-sound
                // - pushing the wrong button => playing fail-sound
                if(this.room.lightGroups['mainFloor'].find(obj => obj === clickedLight)){
                    if(whileColorWas === '255,0,0'){
                        this.scoreMultiplier = 1
                        
                        this.removeLife()

                        this.shapes.push(new Shape(clickedLight.posX+clickedLight.width/2, clickedLight.posY+clickedLight.height/2,
                            'rectangle', clickedLight.width/2, clickedLight.height/2, [255,100,0],
                            'ignore', [{ x: 0, y: 0 }], 0, 'mainFloor', 2000 ))

                        let message = {
                            'type': 'playerFailed',
                            'audio': 'playerFailed',
                            'scoreMultiplier': this.scoreMultiplier,
                            'playerScore': this.score
                        }
                        this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))
                        this.room.socketForRoom.broadcastMessage(JSON.stringify(message))
                    }
                }
                else if(this.room.lightGroups['wallButtons'].find(obj => obj === clickedLight)){
                    
                    if(clickedLight.id === this.ligthIdsSequence[0]){
                        clickedLight.color = black
                        clickedLight.onClick = 'ignore'

                        this.correctButton()

                        //TODO : room.playSound('success1')
                        let message = {
                            'type': 'playerScored',
                            'audio': 'playerScored',
                            'players': this.room.players.playing,
                            'scoreMultiplier': this.scoreMultiplier,
                            'playerScore': this.score
                        }

                        this.room.socketForRoom.broadcastMessage(JSON.stringify(message))
                        this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))

                        // Remove the completed light ID from the sequence
                        this.ligthIdsSequence.splice(0, 1);

                        // Check if the sequence is complete after processing the current button
                        if (this.ligthIdsSequence.length === 0) {
                            setTimeout(() => this.levelCompleted(), 50)
                        }
                    } else {
                        this.scoreMultiplier = 1 
                        this.removeLife()   

                        let message = {
                            'type': 'playerFailed',
                            'audio': 'playerFailed',
                            'scoreMultiplier': this.scoreMultiplier,
                            'playerScore': this.score
                        }
                        this.room.socketForRoom.broadcastMessage(JSON.stringify(message))
                        this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))
                    }
                }
            }
            else if(this.level === 2){
                if(this.room.lightGroups['mainFloor'].find(obj => obj === clickedLight)){
                    if(whileColorWas === '255,0,0'){
                        this.scoreMultiplier = 1
                        
                        this.removeLife()

                        this.shapes.push(new Shape(clickedLight.posX+clickedLight.width/2, clickedLight.posY+clickedLight.height/2,
                            'rectangle', clickedLight.width/2, clickedLight.height/2, [255,100,0],
                            'ignore', [{ x: 0, y: 0 }], 0, 'mainFloor', 2000 ))

                        let message = {
                            'type': 'playerFailed',
                            'audio': 'playerFailed',
                            'scoreMultiplier': this.scoreMultiplier,
                            'playerScore': this.score
                        }
                        this.room.socketForRoom.broadcastMessage(JSON.stringify(message))
                        this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))
                    }
                }
                else if(this.room.lightGroups['wallButtons'].find(obj => obj === clickedLight)){
                    if(clickedLight.id === this.ligthIdsSequence[0]){
                        clickedLight.color = black
                        clickedLight.onClick = 'ignore'

                        this.correctButton()

                        //TODO : room.playSound('success1')
                        let message = {
                            'type': 'playerScored',
                            'audio': 'playerScored',
                            'players': this.room.players.playing,
                            'scoreMultiplier': this.scoreMultiplier,
                            'playerScore': this.score
                        }

                        this.room.socketForRoom.broadcastMessage(JSON.stringify(message))
                        this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))

                        // Remove the completed light ID from the sequence
                        this.ligthIdsSequence.splice(0, 1);

                        // Check if the sequence is complete after processing the current button
                        if (this.ligthIdsSequence.length === 0) {
                            setTimeout(() => this.levelCompleted(), 50)
                        }
                    } else {
                        this.scoreMultiplier = 1   
                        this.removeLife()   

                        let message = {
                            'type': 'playerFailed',
                            'audio': 'playerFailed',
                            'scoreMultiplier': this.scoreMultiplier,
                            'playerScore': this.score
                        }
                        this.room.socketForRoom.broadcastMessage(JSON.stringify(message))
                        this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))
                    }
                }
            }
            else if(this.level === 3) {
                if(this.room.lightGroups['mainFloor'].find(obj => obj === clickedLight)){
                    if(whileColorWas === '255,0,0'){
                        this.scoreMultiplier = 1

                        this.removeLife()

                        this.shapes.push(new Shape(clickedLight.posX+clickedLight.width/2, clickedLight.posY+clickedLight.height/2,
                            'rectangle', clickedLight.width/2, clickedLight.height/2, [255,100,0],
                            'ignore', [{ x: 0, y: 0 }], 0, 'mainFloor', 2000 ))

                        let message = {
                            'type': 'playerFailed',
                            'audio': 'playerFailed',
                            'scoreMultiplier': this.scoreMultiplier,
                            'playerScore': this.score
                        }
                        this.room.socketForRoom.broadcastMessage(JSON.stringify(message))
                        this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))
                    }
                }
                else if(this.room.lightGroups['wallButtons'].find(obj => obj === clickedLight)){
                    if(clickedLight.id === this.ligthIdsSequence[0]){
                        clickedLight.color = black
                        clickedLight.onClick = 'ignore'

                        this.correctButton()

                        //TODO : room.playSound('success1')
                        let message = {
                            'type': 'playerScored',
                            'audio': 'playerScored',
                            'players': this.room.players.playing,
                            'scoreMultiplier': this.scoreMultiplier,
                            'playerScore': this.score
                        }

                        this.room.socketForRoom.broadcastMessage(JSON.stringify(message))
                        this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))
                        
                        this.ligthIdsSequence.splice(0, 1)
                        if(this.ligthIdsSequence.length === 0){
                            // this.levelCompleted()
                            let message = {
                                'type': 'levelCompleted',
                                'audio': 'levelCompleted',
                                'message': 'Player Wins'
                            }

                            this.room.socketForRoom.broadcastMessage(JSON.stringify(message))
                            this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))
                            setTimeout(() => this.endAndExit(), 50)   // End the game if its the last level
                        }
                    } else {
                        this.scoreMultiplier = 1    
                        this.removeLife()   

                        let message = {
                            'type': 'playerFailed',
                            'audio': 'playerFailed',
                            'scoreMultiplier': this.scoreMultiplier,
                            'playerScore': this.score
                        }
                        this.room.socketForRoom.broadcastMessage(JSON.stringify(message))
                        this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))
                    }
                }
            }
        }
    }

    handleBasketballAction(clickedLight, whileColorWas){
        if(this.rule === 1) {
            if(this.level === 1) {
                if(this.room.lightGroups['wallButtons'].find(obj => obj === clickedLight)){
                    // console.log('CLicked:', this.lightColorSequence[0] === clickedLight.color)
                    if(clickedLight.color === this.lightColorSequence[0]){
                        // clickedLight.color = black
                        // clickedLight.onClick = 'ignore'

                        this.correctButton()

                        //TODO : room.playSound('success1')
                        let message = {
                            'type': 'playerScored',
                            'audio': 'playerScored',
                            'players': this.room.players.playing,
                            'color': clickedLight.color,
                            'scoreMultiplier': this.scoreMultiplier,
                            'playerScore': this.score
                        } 
    
                        this.room.socketForRoom.broadcastMessage(JSON.stringify(message))
                        this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))
    
                        this.lightColorSequence.splice(0, 1)
                        if(this.lightColorSequence.length === 0){
                            //setTimeout(() => this.levelCompleted(), 50)
                            let message = {
                                'type': 'levelCompleted',
                                'audio': 'levelCompleted',
                                'message': 'Player Wins'
                            }

                            this.room.socketForRoom.broadcastMessage(JSON.stringify(message))
                            this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))
                            setTimeout(() => this.endAndExit(), 50)  // End the game if its the last level
                        }
                    } else {
                        this.scoreMultiplier = 1    
                        this.removeLife()   

                        let message = {
                            'type': 'playerFailed',
                            'audio': 'playerFailed',
                            'color': clickedLight.color,
                            'scoreMultiplier': this.scoreMultiplier,
                            'playerScore': this.score
                        }
                        this.room.socketForRoom.broadcastMessage(JSON.stringify(message))
                        this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))
                    }
                }
            }
        }
    }

    levelCompleted(){
        clearInterval(this.animationMetronome)    
        let message = { 
            'type': 'levelCompleted',
            'message': 'Player Wins',
            'audio': 'levelCompleted'
        }      

        if(this.room.waitingGameSession === undefined){  
            this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))
            this.room.socketForRoom.broadcastMessage(JSON.stringify(message))

            if(this.roomType === 'basketball'){
                this.offerSameLevel()
            } else {
                this.offerNextLevel()
            }
            
        }
        else if(this.levelsStartedWhileSessionIsWaiting < 3){
            this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))
            this.room.socketForRoom.broadcastMessage(JSON.stringify(message))

            this.offerNextLevel()
        }
        else{
            this.endAndExit()
        }
    }

    levelFailed(){
        clearInterval(this.animationMetronome)
        // TODO: room.playSound('level-failed')

        let message = { 
            'type': 'levelFailed',
            'message': 'Player Loose',
            'audio': 'levelFailed'
        }

        this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))
        this.room.socketForRoom.broadcastMessage(JSON.stringify(message))
        
        if(this.room.waitingGameSession === undefined){         
            this.offerSameLevel()
        }
        else{
            this.endAndExit()
        }

    }

    offerSameLevel(){
        this.isWaitingForGreenButton = true
        this.startGreenButton()
        // TODO : propose same level with countdown and push a button to accept
        let message = {
            'type': 'offerSameLevel',
            'message': 'Game Over! press the Green Button to play again or exit',
            'countdown': this.prepTime 
        }
        this.room.socketForRoom.broadcastMessage(JSON.stringify(message))
        this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))
        this.startSameLevel()
    }

    offerNextLevel(){
        this.isWaitingForGreenButton = true
        this.startGreenButton()
        console.log('offerNextLevel', this.isWaitingForGreenButton)
        // TODO : propose next level with countdown and push a button to accept
        let message = {
            'type': 'offerNextLevel',
            'message': 'Game Over! press the Green Button to play again or exit',
            'countdown': this.prepTime 
        }
        this.room.socketForRoom.broadcastMessage(JSON.stringify(message))
        this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))
        this.startNextLevel()
    }

   /*  async startNextLevelWhenGreenButtonPressed(){
        clearInterval(this.animationMetronome)
        this.isWaitingForGreenButton = false

        

        if(this.room.waitingGameSession !== undefined){
            this.levelsStartedWhileSessionIsWaiting ++
        }
        this.level ++
        this.reset()
        this.isGreenButtonPressed = false
        await this.prepare()
        this.start()
    }

    async startSameLevelWhenGreenButtonPressed(){
        clearInterval(this.animationMetronome)
        this.isWaitingForGreenButton = false

        let message = {
            'type': 'greenButtonPressed',
        }

        this.room.socketForRoom.broadcastMessage(JSON.stringify(message))
        this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))

        if(this.room.waitingGameSession !== undefined){
            this.levelsStartedWhileSessionIsWaiting ++
        }
        this.reset()
        this.isWaitingForGreenButton = false
        this.isGreenButtonPressed = false
        await this.prepare()
        this.start()
    } */

    async startSameLevel(){
        this.receivedMessage = await this.room.socketForRoom.waitForMessage();
        console.log('Received:', this.receivedMessage)
        
        if(this.room.waitingGameSession !== undefined){
            this.levelsStartedWhileSessionIsWaiting ++
        }

        if(this.receivedMessage.type === 'continue'){
            this.reset()
            this.isWaitingForGreenButton = false
            this.isGreenButtonPressed = false
            await this.prepare()
            this.start()
        }
        else if(this.receivedMessage.type === 'exit'){
            this.endAndExit()
        }
    }

    async startNextLevel(){
        this.receivedMessage = await this.room.socketForRoom.waitForMessage();
        console.log('Received:', this.receivedMessage)

        if(this.room.waitingGameSession !== undefined){
            this.levelsStartedWhileSessionIsWaiting ++
        }
        if(this.receivedMessage.type === 'continue'){
            this.level ++
            this.reset()
            this.isWaitingForGreenButton = false
            this.isGreenButtonPressed = false
            await this.prepare()
            this.start()
        }
        else if(this.receivedMessage.type === 'exit'){
            this.endAndExit()
        }
        
    }

    async endAndExit(){
        // TODO : await playing sound to say Byebye
        let messageForRoom = {
            'type': 'gameEnded',
            'message': 'Please leave the room',
            // 'audio': 'ByeBye'
        }
        this.room.socketForRoom.broadcastMessage(JSON.stringify(messageForRoom))
        this.room.socketForMonitor.broadcastMessage(JSON.stringify(messageForRoom))
        
        this.reset()
        if(this.room.waitingGameSession !== undefined){
            //this.currentGameSession = { ...this.room.waitingGameSession }
            this.room.currentGameSession = this.room.waitingGameSession
            this.room.waitingGameSession = undefined

            let messageForDoor = {
                'type': 'gameEnded',
                'message': 'Please enter the room',
                // 'audio': 'PleaseEnter'
            }
            this.room.socketForDoor.broadcastMessage(JSON.stringify(messageForDoor))

            // Notify the door to display "Please come in"
            let message = {
                'type': 'gameRequest',
                'message': 'Please come in',
                'players': this.room.players
            };
            this.room.socketForDoor.broadcastMessage(JSON.stringify(message));
            // TODO display "Please come in" on the door screen
            await this.room.currentGameSession.init()
        }
    }

    GetLightById(lightId){
        let res
        this.room.lights.some((light) => {
            if(light.id === lightId){
                res = light
                return true
            }
        })
        return res
    }

    updatePrepTime(){
        if (this.prepCountdown > 0){
            this.prepCountdown--
        }

        let message = {
            'type':'updatePrepTime',
            'prepTime':this.prepCountdown,
            'audio':'321go'
        }

        this.room.socketForRoom.broadcastMessage(JSON.stringify(message))
        this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))

        if(this.prepCountdown === 0){
            clearInterval(this.prepTimer)
        }
    }

    updateCountdown(){
        if (this.status === undefined) {
            return;
        }

        let timeLeft = Math.round((this.lastLevelStartedAt + (this.timeForLevel * 1000) - Date.now()) / 1000)
        
        if( timeLeft !== this.countdown ){
            if(timeLeft >= 0){
                this.countdown = timeLeft
                let message = {
                    'type':'updateCountdown',
                    'countdown':this.countdown}
                this.room.socketForRoom.broadcastMessage(JSON.stringify(message))
                this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))
            }
            else{
                let message = {'type':'timeIsUp'}
                this.room.socketForRoom.broadcastMessage(JSON.stringify(message))
                this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))
                this.levelFailed()
            }

        }
    }

    removeLife(){
        if(this.lastLifeLostAt < (Date.now() - 2000)){
            this.lastLifeLostAt = Date.now()

            if(this.lifes > 0) {
                this.lifes--
                this.updateLifes()
            }
        }
        else{
            this.lastLifeLostAt = Date.now()
            this.lifes--
            this.updateLifes()
        }
    }

    updateLifes(){
        let message = {
            'type':'updateLifes',
            'lifes':this.lifes,
            'audio': 'playerLoseLife',
        };

        if (this.lifes === 0) {
            let gameOverMessage = {
                'type': 'noMoreLifes',
            }
            this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))
            this.room.socketForRoom.broadcastMessage(JSON.stringify(gameOverMessage))
            this.levelFailed()
        }

        this.room.socketForRoom.broadcastMessage(JSON.stringify(message))
        this.room.socketForMonitor.broadcastMessage(JSON.stringify(message))
    }

    correctButton(){
        this.score += this.baseScore * this.scoreMultiplier
        this.scoreMultiplier++
        this.room.players.playing.forEach((player) => {
            player.score = this.score
        })
    }

    updateShapes(){

        let now = Date.now()

        this.shapes.forEach((shape) => {
            if(shape.active){
                if(shape.activeUntil !== undefined && shape.activeUntil < now){
                    shape.active = false
                }
                else{
                    shape.update()
                }
            }
        })

    }

    applyShapesOnLights(){
        // scanning the shapes array reversly to focus on the last layer
        this.room.lights.forEach((light) => {
            if(!light.isAffectedByAnimation){return false}
            let lightHasColor = false

            for (let i = this.shapes.length - 1; i >= 0; i--) {
                const shape = this.shapes[i];
                if(!shape.active){continue}
                if(!(this.room.lightGroups[shape.affectsLightGroup].includes(light))){continue}
                // does that shape cross into that light ?
                let areIntersecting = false
                if(shape.shape === 'rectangle' && light.shape === 'rectangle'){
                    areIntersecting = areRectanglesIntersecting(shape, light)
                }else{
                    throw new Error('intersection not computable for these shapes (TODO).')
                }
                if(areIntersecting){
                    light.color = shape.color
                    light.onClick = shape.onClick
                    lightHasColor = true
                    break;
                }
            }

            if(lightHasColor === false && light.isAffectedByAnimation === true){
                light.color = [0,0,0]
                light.onClick = 'ignore'
            }
        })
    }
}

module.exports = GameSession