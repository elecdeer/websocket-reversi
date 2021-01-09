const express = require("express");
const app = express();
const http = require("http").Server(app);
const PORT = process.env.PORT || 7000;

const io = require("socket.io")(http);

const log4js = require("log4js");
const {Reversi, encodeBoard, massToPos} = require("./reversi");
const logger = log4js.getLogger();
logger.level = 'debug';


const roomMap = new Map();
roomMap.set("testRoom", {
  players: {},
  status: "waitingPlayer"
});

const roomEx = {
  players: {
    black: {
      playerId: "",
      socketId: "",
    },
    white: {
      playerId: "",
      socketId: "",
    }
  },
  gameObj: new Reversi(),
  status: "waitingPlayer"//playing, end
}

//socket
io.on("connection", (client) => {
  logger.info(`connect client ${client.id}`);
  // client.on("message", msg => {
  //   logger.info(msg);
  //   // console.log(msg);
  // })

  //部屋に参加
  client.once("join-room", (roomId, playerId) => {

    //部屋がない
    if(!roomMap.has(roomId)){
      client.emit("join-room-res", "notfound");
    }

    const roomLogger = log4js.getLogger(`room-${roomId}`);

    const room = roomMap.get(roomId);

    client.join(roomId);
    if(!room.players.black){
      client.emit("join-room-res", "black");

      room.players.black = {
        playerId: playerId,
        socketId: client.id,
      }

      roomLogger.info(`join ${playerId} as black`);
    }else if(!room.players.white){
      client.emit("join-room-res", "white");

      room.players.white = {
        playerId: playerId,
        socketId: client.id,
      }

      roomLogger.info(`join ${playerId} as white`);
    }else{
      client.emit("join-room-res", "spectator");

      roomLogger.info(`join ${playerId} as spectator`);
    }

    //揃ったので開始
    if(room.status === "waitingPlayer" && !!room.players.white && !!room.players.black){
      io.in(roomId).emit("start-game", room.players.white.playerId, room.players.black.playerId);
      roomLogger.info(`start-game`);

      room.status = "playing";
      const game = new Reversi();
      room.gameObj = game;
      //タイムアウトいるかも？
      io.in(roomId).emit("update-board", encodeBoard(game.board), game.turn);
      game.printCurrentBoard();

    }


    client.on("put-piece", (x, y) => {
      roomLogger.info(`put-piece from ${client.id} ${x}, ${y}`);

      if(room.status !== "playing"){
        roomLogger.info(`put-piece -> not playing`);
        client.emit("put-piece-res", "illegal");
        return;
      }

      const game = room.gameObj;

      //今このプレイヤーのターンかどうか
      const turnPoint = game.turn === 1 ? "white" : (game.turn === 2 ? "black" : null);
      const currentTurnSocketId = room.players[turnPoint].socketId;
      if(client.id !== currentTurnSocketId){
        roomLogger.info(`put-piece -> not your turn`);
        // roomLogger.info(`turnPlayer: `)
        client.emit("put-piece-res", "illegal");
        return;
      }

      //そこに置けない
      if(!game.canPut(x, y)){
        roomLogger.info(`put-piece -> can't put piece`);

        // roomLogger.debug(`${}`)

        client.emit("put-piece-res", "illegal");
        return;
      }else{
        roomLogger.info(`put-piece ${x}, ${y}`);

        client.emit("put-piece-res", "ok");
      }

      game.putPiece(x, y);
      game.printCurrentBoard();

      io.in(roomId).emit("update-board", encodeBoard(game.board), game.turn);

      //ゲームセット
      if(game.turn === 0){
        room.status = "end";

        //サーバに結果送信
      }
    })

    client.once("disconnect", () => {
      client.leave(roomId);
    });


  });

});




http.listen(PORT, () => {
  console.log('server listening. Port:' + PORT);
});

app.get('/' , (req, res) => {
  res.sendFile(__dirname+'/testClient.html');
});




