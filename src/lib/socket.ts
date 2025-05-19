import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    socket = io("http://52.78.228.135:4000", {
      //socket = io("http://localhost:4000", {
      autoConnect: false, // 수동 연결
      transports: ["websocket"],
    });
  }
  return socket;
};
