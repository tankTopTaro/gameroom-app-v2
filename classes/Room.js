const Light = require('./Light');
const Socket = require('./Socket');
const GameSession = require('./GameSession');

const express = require('express');
const path = require('path');
require('dotenv').config();

/**
 * added GameManager
 * 
 */

class Room{
    constructor(roomType) {
        //this.gameManager = new GameManager(this, roomType)
        this.type = roomType
        this.players = []
        this.isFree = true;
        this.server = undefined
        this.currentGameSession = undefined
        // this.waitingGameSession = undefined // the one waiting at the door
        this.waitingGameSession = []
        this.width
        this.height // understand this a 2d room plan
        this.created_at = Date.now()
        this.lights = []
        this.sendLightsInstructionsIsBusy = false
        this.sendLightsInstructionsRequestIsPending = false
        this.lightCounter = 0
        this.lightGroups = {}
        this.init()
    }

    async init(){
        await this.prepareLights()
        await this.mesure()
        this.startServer()
        this.socketForMonitor = new Socket('monitor', 8080)
        this.socketForRoom = new Socket('room', 8081)
        this.socketForDoor = new Socket('door', 8082)
    }

    prepareLights(){

        if(this.type === 'doubleGrid'){

            this.addMatrix(130,130,'rectangle','ledSwitch',960,480,25,25,5,5,'mainFloor', true)

            this.addMatrix(255,70,'rectangle','ledSwitch',960,100,15,15,200,40, 'wallButtons',false)
            this.addMatrix(255,640,'rectangle','ledSwitch',960,100,15,15,200,40,'wallButtons',false)
            this.addMatrix(70,240,'rectangle','ledSwitch',100,500,15,15,40,200,'wallButtons',false)
            this.addMatrix(1120,240,'rectangle','ledSwitch',100,500,15,15,40,200,'wallButtons',false)

            this.addMatrix(250,30,'rectangle','screen',960,100,25,25,190,40, 'wallScreens',false)
            this.addMatrix(250,670,'rectangle','screen',960,100,25,25,190,40,'wallScreens',false)
            this.addMatrix(30,235,'rectangle','screen',100,500,25,25,40,190,'wallScreens',false)
            this.addMatrix(1150,235,'rectangle','screen',100,500,25,25,40,190,'wallScreens',false)

        }
        else if(this.type === 'basketball'){
            this.addMatrix(130, 130, 'rectangle', 'ledSwitch', 960, 100, 80, 80, 90, 5, 'wallButtons', false)
        }


    }

    addMatrix(matrixPosX,matrixPosY,elementsShape,elementsType,matrixWidth,matrixHeight,tileWidth,tileHeight,marginX,marginY,lightGroup,isAffectedByAnimation){
        let numberOfTilesX = Math.floor(matrixWidth / (tileWidth+marginX))
        let numberOfTilesY = Math.floor(matrixHeight / (tileHeight+marginY))
        for (let i = 0; i < numberOfTilesX; i++) {
            for (let j = 0; j < numberOfTilesY; j++) {

                let light = new Light(this.lightCounter,matrixPosX+(i*(tileWidth+marginX)),matrixPosY+(j*(tileHeight+marginY)), elementsShape, elementsType, tileWidth, tileHeight,isAffectedByAnimation)
                if (!(lightGroup in this.lightGroups)){
                    this.lightGroups[lightGroup] = []
                }
                this.lightGroups[lightGroup].push(light)
                this.lights.push(light)
                this.lightCounter++

            }
        }
    }

    mesure(){
        let minX,maxX,minY,maxY = undefined
        this.lights.forEach((light) => {
            if(minX === undefined || light.posX < minX){minX = light.posX}
            if(maxX === undefined || (light.posX+light.width) > maxX){maxX = (light.posX+light.width)}
            if(minY === undefined || light.posY < minY){minY = light.posY}
            if(maxY === undefined || (light.posY+light.height) > maxY){maxY = (light.posY+light.height)}
        })
        this.padding = {'left':minX,'top':minY}
        this.width = maxX + minX
        this.height = maxY + minY
    }

    startServer(){
        // Prepare server
        this.server = express();
        const serverPort = process.env.GAME_ROOM_SERVER_PORT || 3001;
        const serverHostname = process.env.GAME_ROOM_SERVER_HOST || 'localhost';
        // Middleware to set no-cache headers for all routes
        this.server.use((req, res, next) => {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Surrogate-Control', 'no-store');
            next();
        });
        this.server.use(express.json());
        this.server.use(express.static(path.join(__dirname, '../assets')));
        this.server.get('/', (req, res) => {
            res.send('<html><body><h1>Hello</h1></body></html>');
        });
        this.server.get('/door', (req, res) => {
            const filePath = path.join(__dirname, '../assets/door.html');
            res.sendFile(filePath);
        });

        this.server.post('/door/scannedRfid/:id', (req, res) => {
            const { id } = req.params;
            const { playerName, playerAvatar } = req.body;

            const playerData = { id, playerName, playerAvatar, score: 0 };

            if(this.players.length < 6){
                this.players.push(playerData)
            } else {
                let message = {
                    'type': 'scannedRfid',
                    'message': 'Room is full',
                    'players': this.players
                }

                this.socketForDoor.broadcastMessage(JSON.stringify(message))
                this.socketForMonitor.broadcastMessage(JSON.stringify(message))
            }
            let message = {
                'type': 'scannedRfid',
                'playerData': this.players,
                'roomData': this.type
            }
            this.socketForDoor.broadcastMessage(JSON.stringify(message))
            this.socketForMonitor.broadcastMessage(JSON.stringify(message))

            res.json({
                message: 'Player scanned successfully',
                data: playerData
            })
        });

        this.server.get('/room', (req, res) => {
            const filePath = path.join(__dirname, '../assets/room.html');
            res.sendFile(filePath);
        });
        this.server.get('/game/request', async (req, res) => {
            console.log('/game/request', req.query);
            if(this.players.length === 0){                
                let message = {
                    'type': 'gameRequest',
                    'message': 'Please enter the room',
                    'players': this.players
                }
                this.socketForMonitor.broadcastMessage(JSON.stringify(message))
                this.socketForDoor.broadcastMessage(JSON.stringify(message))
            } 

            if(this.isFree){
                this.currentGameSession = new GameSession(req.query.rule, req.query.level, this, this.type)
                this.currentGameSession.players = [...this.players]   // this should lock the players to this session
                this.players = []
                let gameSessionInitialized = await this.currentGameSession.init()
                if(gameSessionInitialized === true){
                    console.log('Playing:', this.players.playing)
                    res.send('<html><body><h1>Please enter the room</h1></body></html>');    
                }
                else{
                    res.send('<html><body><h1>'+gameSessionInitialized+'</h1></body></html>');
                }
            }
            else {
                // waitingGameSession will use FIFO
                const newWaitingGameSession = new GameSession(req.query.rule, req.query.level, this, this.type)
                newWaitingGameSession.players = [...this.players]
                this.waitingGameSession.push(newWaitingGameSession)

                let message = {
                    'type': 'gameRequest',
                    'message': 'Please wait',
                    'players': this.players
                }

                this.socketForDoor.broadcastMessage(JSON.stringify(message))
                // console.log('Waiting:', this.players.waiting)
                // this.waitingGameSession = new GameSession(req.query.rule, req.query.level, this, this.type)
                // this.players.playing.push(...this.players.waiting)
                this.players = []
                res.send('<html><body><h1>Please wait</h1></body></html>');
            }
        });
        this.server.get('/game/lightClickAction', (req, res) => {
            //console.log(req.query)
            this.currentGameSession.handleLightClickAction(parseInt(req.query.lightId, 10), req.query.whileColorWas)
            res.send('ok');
        });
        this.server.get('/game/audio', (req, res) => {
            const sounds = {
                'levelFailed': 'sounds/703542__yoshicakes77__dead.ogg',
                'levelCompleted': 'sounds/703543__yoshicakes77__win.ogg',
                'playerScored': 'sounds/703541__yoshicakes77__coin.ogg',
                'playerLoseLife': 'sounds/253174__suntemple__retro-you-lose-sfx.wav',
                'gameOver': 'sounds/76376__deleted_user_877451__game_over.wav',
                '321go': 'sounds/474474__bnewton103__robotic-countdown.wav',

                // Colors
                'red': 'sounds/196551__margo_heston__red-f.wav',
                'green': 'sounds/196520__margo_heston__green-f.wav',
                'blue': 'sounds/196535__margo_heston__blue-f.wav',
                'yellow': 'sounds/196531__margo_heston__yellow-f.wav',
                'purple': 'sounds/196547__margo_heston__purple-f.wav'
            }

            res.json(sounds)
        })
        this.server.get('/monitor', (req, res) => {
            const filePath = path.join(__dirname, '../assets/monitor.html');
            res.sendFile(filePath);
        });
        this.server.get('/get/roomData', (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.json({'room':{'width':this.width,'height':this.height},'lights':this.lights})
        });
        this.server.get('/test-rfid', (req, res) => {
            const filePath = path.join(__dirname, '../assets/test-rfid.html');
            res.sendFile(filePath);
        });
// Start server
        this.server.listen(serverPort, serverHostname, () => {
            console.log(`Server running at http://${serverHostname}:${serverPort}/`);
            console.log(`Monitor the room in 2D : http://${serverHostname}:${serverPort}/monitor`);
            console.log(`Start a game : http://${serverHostname}:${serverPort}/game/request?rule=1&level=1`);
            console.log(`Start a game : http://${serverHostname}:${serverPort}/game/request?rule=1&level=2`);
            console.log(`Start a game : http://${serverHostname}:${serverPort}/game/request?rule=1&level=3`);
            console.log(`Start a game with error : http://${serverHostname}:${serverPort}/game/request`);
            console.log(`See the door screen : http://${serverHostname}:${serverPort}/door`);
            console.log(`See the room screen : http://${serverHostname}:${serverPort}/room`);
            console.log(`Simulate an RFID scan: http://${serverHostname}:${serverPort}/test-rfid`);
        });
    }




    sendLightsInstructionsIfIdle(){

        if(this.sendLightsInstructionsIsBusy){
            if(this.sendLightsInstructionsRequestIsPending){
                console.log('WARNING : Animation frame LOST ! (received sendLightsInstructionsIfIdle while sendLightsInstructionsRequestIsPending Already)')
                return false
            }
            this.sendLightsInstructionsRequestIsPending = true
            console.log('WARNING : Animation frame delayed (received sendLightsInstructionsIfIdle while sendLightsInstructionsIsBusy)')
            return false
        }
        this.sendLightsInstructionsIsBusy = true

        this.sendLightsInstructions()

        this.sendLightsInstructionsIsBusy = false
        if(this.sendLightsInstructionsRequestIsPending){
            this.sendLightsInstructionsRequestIsPending = false
            this.sendLightsInstructionsIfIdle()
            console.log('WARNING : doing another sendLightsInstructionsIfIdle in a row')
            return true
        }
        return true
    }

    sendLightsInstructions(){
        this.lights.forEach((light) => {
            light.newInstructionString = JSON.stringify(light.color)
            if(light.lastHardwareInstructionString !== light.newInstructionString){
                this.sendHardwareInstruction(light)
            }
            if(light.lastSocketInstructionString !== light.newInstructionString){
                this.sendSocketInstructionForMonitor(light)
            }

        })
    }

    async sendHardwareInstruction(light){
        let newInstructionString = light.newInstructionString
        let response = await this.sendToHardware(light.hardwareAddress,light.color)
        if(response === true){
            light.lastHardwareInstructionString = newInstructionString
        }else{
            console.log('WARNING : sendToHardware FAILS ! for following light:')
            console.log(light)
        }
    }

    async sendSocketInstructionForMonitor(light){

        let newInstructionString = light.newInstructionString
        //Console.log('TEST Changing light id:',light.id,' to: ', newInstructionString)
        let response = await this.sendToSocketForMonitor(light)
        if(response === true){
            light.lastSocketInstructionString = newInstructionString
        }else{
            console.log('WARNING : sendToSocketForMonitor FAILS ! for following light:')
            console.log(light)
        }
    }

    async sendToHardware(){
        // TODO
        return true
    }

    async sendToSocketForMonitor(light){
        let message = {'type':'updateLight','lightId':light.id,'color':light.color,'onClick':light.onClick}
        this.socketForMonitor.broadcastMessage(JSON.stringify(message))
        return true
    }
}

module.exports = Room