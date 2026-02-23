import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

// LOCAL (이 부분의 주석을 해제하여 사용합니다!)
export const getSocket = () => {
  if (!socket) {
    socket = io("http://localhost:4000", {
      autoConnect: false, // 수동 연결
      transports: ["websocket"],
    });
  }
  return socket;
};

// EC2
// export const getSocket = () => {
//   if (!socket) {
//     // socket = io("http://52.78.228.135:4000", {
//     socket = io("http://localhost:4000", {
//       autoConnect: false, // 수동 연결
//       transports: ["websocket"],
//     });
//   }
//   return socket;
// };

// VERCEL (이제 사용하지 않으므로 이 부분을 주석 처리합니다!)
// export const getSocket = () => {
//   if (!socket) {
//     socket = io("https://api.bbungkabe.com", {
//       autoConnect: false,
//       transports: ["websocket"],
//     });
//   }
//   return socket;
// };
