require('dotenv').config();
const Room = require('./classes/Room')

//const roomType = process.env.GAME_ROOM_DOUBLEGRID || 'doubleGrid'
const roomType = process.env.GAME_ROOM_BASKETBALL || 'basketball'
new Room(roomType)
