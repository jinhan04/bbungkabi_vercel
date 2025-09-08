export type RoomCode = string;
export type Nickname = string;
export type Difficulty = "easy" | "normal" | "hard";

export class Store {
  rooms: Record<RoomCode, Nickname[]> = {};
  decks: Record<RoomCode, string[]> = {};
  playerHands: Record<RoomCode, Record<Nickname, string[]>> = {};
  socketIdToNickname: Record<string, Nickname> = {};
  turnIndex: Record<RoomCode, number> = {};
  readyPlayers: Record<RoomCode, Set<Nickname>> = {};
  drawFlag: Record<RoomCode, Set<Nickname>> = {};
  roundCount: Record<RoomCode, number> = {};
  doubleFinalRoundMap: Record<RoomCode, boolean> = {};
  scores: Record<RoomCode, Record<Nickname, number[]>> = {};
  readyForNextRound: Record<RoomCode, Set<Nickname>> = {};
  bbungEndTriggeredBy: Record<RoomCode, Nickname | null> = {};
  emojiMap: Record<RoomCode, Record<Nickname, string>> = {};
  lastBbungHappened: Record<RoomCode, boolean> = {};
  uhbbungEnabledMap: Record<RoomCode, boolean> = {};
  uhbbungTempScores: Record<RoomCode, Record<Nickname, number>> = {};
  uhbbungLastTickAt: Record<RoomCode, Record<Nickname, number>> = {};
  submittedHistory: Record<RoomCode, { nickname: Nickname; card: string }[]> =
    {};
  roundInProgress: Record<RoomCode, boolean> = {};
  roundResults: Record<
    RoomCode,
    {
      scores: Record<Nickname, number>;
      hands: Record<Nickname, string[]>;
      reason: string;
      stopper?: Nickname;
      triggerer?: Nickname;
    }
  > = {};

  // 봇
  roomBots: Record<RoomCode, { nickname: Nickname; difficulty: Difficulty }[]> =
    {};
  getBots(room: RoomCode) {
    return this.roomBots[room] || [];
  }
  addBot(room: RoomCode, bot: { nickname: Nickname; difficulty: Difficulty }) {
    if (!this.roomBots[room]) this.roomBots[room] = [];
    this.roomBots[room].push(bot);
  }
  removeBot(room: RoomCode, nickname: Nickname) {
    this.roomBots[room] = (this.roomBots[room] || []).filter(
      (b) => b.nickname !== nickname
    );
  }
}

export const store = new Store();
