const log4js = require("log4js");
const logger = log4js.getLogger("reversi");

const WHITE = 1;
const BLACK = 2;
const BLANK = 0;


class Reversi{
  constructor(){
    this.turn = BLACK;

    this.board = [
      [0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0],
      [0,0,0,1,2,0,0,0],
      [0,0,0,2,1,0,0,0],
      [0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0]
    ];

    this.history = [];
  }



  _reversePiece(bw){
    if(bw === WHITE) return BLACK;
    if(bw === BLACK) return WHITE;
    return 0;
  }

  _isInBoard(x, y, dx = 0, dy = 0){
    if(x + dx < 0 || 7 < x + dx) return false;
    if(y + dy < 0 || 7 < y + dy) return false;
    return true;
  }


  copyBoard(board = this.board){
    const result = (new Array(8)).fill(0).map(column => (new Array(8)).fill(0));
    for(let i = 0; i < 8; i++){
      for(let j = 0; j < 8; j++){
        result[i][j] = board[i][j];
      }
    }
    return result;
  }


  /**
   * 次のターン白か黒かをチェックする ゲームセットなら0
   * @param turn 置いた方
   * @param board
   */
  checkNextTurn(turn, board){
    logger.debug(`checkNextTurn ${turn}`)
    const tempNextTurn = this._reversePiece(turn);

    //パスする
    if(this._checkPass(tempNextTurn, board)){
      //両方パス=ゲームセット
      if(this._checkPass(turn, board)){
        return 0;
      }
      return turn;
    }else{
      return tempNextTurn;
    }
  }

  _checkPass(piece, board){
    const canPutPosList = [];

    //パスチェック
    for(let x = 0; x < 8; x++){
      for(let y = 0; y < 8; y++){
        if(board[x][y] !== BLANK) continue;

        const triedBoard = this.tryPutPiece(x, y, piece, board);
        if(triedBoard !== board){//なんかしら置けた
          canPutPosList.push([x, y]);
        }
      }
    }
    logger.info(`check pass ${piece} -> canPutPosList:`);
    logger.info(canPutPosList);
    return canPutPosList.length === 0;
  }

  /**
   * 実際にコマを置く
   * @param x
   * @param y
   * @returns {{placed: boolean, turn: number, board: number[][]}}
   */
  putPiece(x, y){
    const nextBoard = this.tryPutPiece(x, y, this.turn, this.board);

    const placed = this.board === nextBoard;

    this.board = nextBoard;
    this.turn = this.checkNextTurn(this.turn, this.board);

    this.history.push({
      count: this.countUp(),
      board: this.board,
      turn: this.turn,
      turnIndex: this.history.length,
      putMass: posToMass(x, y),
    })

    return {
      placed: placed,
      board: this.board,
      turn: this.turn
    }
  }

  tryPutPiece(x, y, turn, board){

    const samePiece = turn;

    if(board[x][y] !== BLANK) return board;

    //自分のコマとしてひっくり返すコマのリスト 置くコマも含む
    let reverseArray = [[x, y]];

    for(let dx = -1; dx <= 1; dx++){
      for(let dy = -1; dy <= 1; dy++){
        if(dx === 0 && dy === 0) continue;
        if(!this._isInBoard(x, y, dx, dy)) continue;

        const items = this._tryReverseDir(x, y, dx, dy, samePiece, board);
        // logger.debug(items);
        if(items.length){
          reverseArray = reverseArray.concat(items);
        }

      }
    }

    // logger.debug(reverseArray);
    //ひっくり返せない
    if(reverseArray.length <= 1){
      return board;
    }



    //コピー
    const nextBoard = this.copyBoard(board);
    logger.debug("nextBoard" + visualizationBoard(nextBoard));

    reverseArray.forEach(pos => {
      nextBoard[pos[0]][pos[1]] = samePiece;
    })

    return nextBoard;
  }

  _tryReverseDir(x, y, dx, dy, piece, board){
    const difPiece = this._reversePiece(piece);

    let sx = x + dx;
    let sy = y + dy;

    if(!this._isInBoard(sx, sy)) return [];
    if(board[sx][sy] !== difPiece) return [];

    const result = [[sx, sy]];

    while(true){
      sx += dx;
      sy += dy;

      //範囲外
      if(!this._isInBoard(sx, sy, 0, 0)) return [];
      //空白
      if(board[sx][sy] === BLANK) return [];

      //敵コマ
      if(board[sx][sy] === difPiece){
        result.push([sx, sy]);
      }

      //挟めた
      if(board[sx][sy] === piece){
        return result;
      }
    }
  }

  /**
   * 実際にそこにコマをおけるか
   * @param x
   * @param y
   * @param turn
   * @returns {boolean}
   */
  canPut(x, y, turn = this.turn){
    const compBoard = this.tryPutPiece(x, y, turn, this.board);

    logger.debug("before" + visualizationBoard(this.board));
    logger.debug("after" + visualizationBoard(compBoard));

    return this.board !== compBoard;
  }

  /**
   * それぞれのコマの数をカウントする
   * @param board
   * @returns {{blank: number, white: number, black: number}}
   */
  countUp(board = this.board){
    let blackCount = 0;
    let whiteCount = 0;
    let blankCount = 0;

    for(let x = 0; x < 8; x++){
      for(let y = 0; y < 8; y++){
        if(board[x][y] === BLACK) blackCount++;
        if(board[x][y] === WHITE) whiteCount++;
        if(board[x][y] === BLANK) blankCount++;
      }
    }

    return {
      black: blackCount,
      white: whiteCount,
      blank: blankCount
    }
  }

  printCurrentBoard(){
    let turnMsg;
    if(this.turn === WHITE){
      turnMsg = "white";
    }else if(this.turn === BLACK){
      turnMsg = "black";
    }else{
      turnMsg = `finish - ${this.countUp()}`;
    }

    logger.info(`turn: ${this.turn} (${turnMsg})`);

    logger.info(visualizationBoard(this.board));
  }

}

const massToPos = (mass) => {
  return {
    x: Math.floor(mass / 8),
    y: mass % 8,
  }
}

const posToMass = (x, y) => {
  return x*8 + y;
}

const visualizationBoard = (board, eol = "\n") => {
  const boardMsg =
    encodeBoard(board)
      .replace(/.{8}/g, eol + "$&")
      .replace(/0/g, "x")
      .replace(/1/g, "◯")
      .replace(/2/g, "●");

  return boardMsg;
}

const decodeBoard = (str) => {
  if(str.length !== 64){

  }

  const board = (new Array(8)).fill(0).map(column => (new Array(8)).fill(0));
  for(let x = 0; x < 8; x++){
    for(let y = 0; y < 8; y++){
      const mass = posToMass(x, y);
      board[x][y] = parseInt(str.charAt(mass));
    }
  }
  return board;
}

const encodeBoard = (board) => {
  let str = "";

  //配列順とは逆
  for(let y = 0; y < 8; y++){
    for(let x = 0; x < 8; x++){
      str += board[x][y].toString();
    }
  }
  return str;
}

module.exports = {
  Reversi,
  massToPos,
  posToMass,
  decodeBoard,
  encodeBoard
}

