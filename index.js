const express = require("express");
const app = express();
const http = require("http").Server(app);
const PORT = process.env.PORT || 7000;

const io = require("socket.io")(http);

const axios = require("axios").default;
const log4js = require("log4js");
const {Reversi, encodeBoard, massToPos} = require("./reversi");
const logger = log4js.getLogger();
logger.level = 'debug';

const roomServerHostName = "http://localhost:7001";

const roomMap = new Map();
roomMap.set("testRoom", {
  players: {},
  status: "waitingPlayer",
  battleId: 0
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

        const resultCount = room.gameObj.countUp();
        let winner;
        if(resultCount.black < resultCount.white){
          winner = room.players.white.playerId;
        }else if(resultCount.black > resultCount.white){
          winner = room.players.black.playerId;
        }else{
          winner = "draw";
        }

        //サーバに結果送信
        // Promise.all()
        const resultUrl = roomServerHostName + "/result/" + objToQueryStr({
          battle_id: room.battleId,
          black_player: room.players.black.playerId,
          white_player: room.players.white.playerId,
          winner: winner
        });

        axios.post(resultUrl)
          .then(() => {
            const promises = room.gameObj.history.map(turnData => {

              const url = roomServerHostName + "/result-datail/" + objToQueryStr({
                battle_id: room.battleId,
                turn: turnData.turnIndex,
                turn_player: turnData.turn,
                put_mass: turnData.putMass,
                black_count: turnData.count.black,
                white_count: turnData.count.white,
                board: turnData.board
              });

              return axios.post(url);
            });

            return Promise.all(promises)
          });


        setTimeout(() => {
          roomMap.delete(roomId);
        }, 1000*30);
      }
    })

    client.once("disconnect", () => {
      client.leave(roomId);
    });


  });

});


const objToQueryStr = (obj) => {
  return '?' + Object.entries(obj).map((e) => `${e[0]}=${e[1]}`).join('=');
}

http.listen(PORT, () => {
  console.log('server listening. Port:' + PORT);
});

//クライアントページ
app.get('/gameroom/:roomId' , (req, res) => {
  res.sendFile(__dirname+'/testClient.html');
});

//部屋作成
app.get('/create-room' , (req, res) => {
  const roomId = req.query.room_id;
  const battleId = req.query.battle_id;
  if(roomMap.has(roomId)){
    res.status(400).send("room already exists");
  }else{
    logger.info(`make room ${roomId}`);
    roomMap.set(roomId, {
      players: {},
      status: "waitingPlayer",
      battleId: battleId
    })
    res.status(200).send("accept");
  }
});






