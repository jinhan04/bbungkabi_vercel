import { Server, Socket } from "socket.io";
import { registerLobbyHandlers } from "./lobbyHandlers";
import { registerGameHandlers } from "./gameHandlers";
import { registerMiscHandlers } from "./miscHandlers";

export function registerHandlers(io: Server, socket: Socket) {
  registerLobbyHandlers(io, socket);
  registerGameHandlers(io, socket);
  registerMiscHandlers(io, socket);

  socket.on("disconnect", () => {
    console.log("클라이언트 연결 해제:", socket.id);
  });
}
