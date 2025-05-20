// game/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { playSound } from "@/lib/sound";

export default function GamePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomCode = searchParams.get("code") || "";
  const nicknameRaw = searchParams.get("nickname") || "";
  const nickname = decodeURIComponent(nicknameRaw);
  const [playerList, setPlayerList] = useState<string[]>([]);

  const [bagajiText, setBagajiText] = useState("");
  const [showBagaji, setShowBagaji] = useState(false);

  const [hand, setHand] = useState<string[]>([]);
  const [round, setRound] = useState<number>(1);
  const [currentPlayer, setCurrentPlayer] = useState("");
  const [currentPlayerDrawn, setCurrentPlayerDrawn] = useState(false);
  const [submittedCards, setSubmittedCards] = useState<
    { nickname: string; card: string }[]
  >([]);
  const [mustSubmit, setMustSubmit] = useState(false);
  const [bbungCards, setBbungCards] = useState<string[]>([]);
  const [bbungPhase, setBbungPhase] = useState<"idle" | "selectingExtra">(
    "idle"
  );
  const [jokboAvailable, setJokboAvailable] = useState(false);
  const [recentDrawnCard, setRecentDrawnCard] = useState<string | null>(null);
  const [anyoneDrewThisTurn, setAnyoneDrewThisTurn] = useState(false);
  const [messages] = useState<{ id: number; nickname: string; text: string }[]>(
    []
  );

  const [chatMessages, setChatMessages] = useState<
    { nickname: string; message: string }[]
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [canSend, setCanSend] = useState(true);

  const checkAndEmitBagaji = (
    cards: string[],
    context: "draw" | "afterSubmit"
  ) => {
    if (cards.length < 2) return;

    const numberMap: Record<string, number> = {};
    for (const c of cards) {
      const num = c.replace(/[^0-9JQKA]/g, "");
      numberMap[num] = (numberMap[num] || 0) + 1;
    }

    const counts = Object.values(numberMap).sort((a, b) => b - a);

    if (context === "draw" && cards.length === 2) {
      const isBagaji = counts[0] === 2;
      getSocket().emit("declare-bagaji", { roomCode, isBagaji });
    }

    if (context === "afterSubmit") {
      if (cards.length === 2) {
        const isBagaji = counts[0] === 2;
        getSocket().emit("declare-bagaji", { roomCode, isBagaji });
      } else if (cards.length === 5 && counts[0] === 3 && counts[1] === 2) {
        getSocket().emit("declare-bagaji", { roomCode, isBagaji: true });
      }
    }
  };

  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();

    socket.emit("join-room", { roomCode, nickname });

    socket.removeAllListeners();

    socket.on("update-players", (players: string[]) => {
      setPlayerList(players);
    });

    socket.emit("get-player-list", { roomCode }, (players: string[]) => {
      console.log("[DEBUG] get-player-list fallback 수신:", players);
      setPlayerList(players);
    });

    socket.on("game-started", ({ roomCode, round }) => {
      console.log("[DEBUG] game-started 수신 | round = ${round}");
      if (round) setRound(round);
    });

    socket.on("deal-cards", ({ hand }) => {
      setHand(sortHandByValue(hand));
    });

    socket.on("turn-info", ({ currentPlayer }) => {
      setCurrentPlayer(currentPlayer);
      setMustSubmit(false);
      setBbungPhase("idle");
      setCurrentPlayerDrawn(false);
      setAnyoneDrewThisTurn(false);
    });

    socket.on("card-submitted", ({ nickname: submitterNickname, card }) => {
      setSubmittedCards((prev) => [
        ...prev,
        { nickname: submitterNickname, card },
      ]);
    });

    socket.on("drawn-card", ({ card }) => {
      playSound("draw.mp3");
      setHand((prev) => {
        const newHand = sortHandByValue([...prev, card]);
        if (newHand.length === 2) {
          checkAndEmitBagaji(newHand, "draw");
        }
        return newHand;
      });
      setMustSubmit(true);
      setRecentDrawnCard(card);
      setTimeout(() => setRecentDrawnCard(null), 1500);
    });

    socket.on("player-drawn", ({ nickname: drawnNickname }) => {
      if (drawnNickname === currentPlayer) {
        setCurrentPlayerDrawn(true);
      }
      setAnyoneDrewThisTurn(true); // <- 이건 조건문 바깥에 있어야 함
    });

    socket.on(
      "round-ended",
      ({ reason, stopper, allPlayerHands, round, triggerer }) => {
        const myHand = allPlayerHands?.[nickname] || hand;

        if (reason === "족보 완성") {
          playSound("jokbo_complete.mp3");
        }

        sessionStorage.setItem("myHand", JSON.stringify(myHand));
        sessionStorage.setItem(
          "allPlayerHands",
          JSON.stringify(allPlayerHands)
        );
        sessionStorage.setItem("round", String(round)); // ✅ 여기서 저장

        if (triggerer) {
          sessionStorage.setItem("bbungTriggerer", triggerer); // ✅ 유도자 저장
        }

        let url = `/roundresult?code=${roomCode}&nickname=${encodeURIComponent(
          nickname
        )}&reason=${reason}`;
        if (stopper) url += `&stopper=${encodeURIComponent(stopper)}`;
        router.push(url);
      }
    );

    socket.on("bagaji-declared", ({ nickname, isBagaji }) => {
      const message = isBagaji ? "🚨 바가지! 🚨" : "❌ 노 바가지 ❌";

      // 중앙 표시
      setBagajiText(message);
      setShowBagaji(true);

      // 💬 채팅창에 출력되도록 추가
      if (nickname && message) {
        setChatMessages((prev) => [...prev, { nickname, message }]);
      }

      // 중앙 메시지 제거
      setTimeout(() => {
        setShowBagaji(false);
        setBagajiText("");
      }, 1000);
    });

    socket.emit("ready", { roomCode, nickname });
    socket.emit("request-hand", { roomCode });
  }, [roomCode, nickname, router]);

  useEffect(() => {
    const socket = getSocket();
    socket.on("chat-message", ({ nickname, message }) => {
      setChatMessages((prev) => [...prev, { nickname, message }]);
    });
  }, []);

  useEffect(() => {
    sessionStorage.setItem("myHand", JSON.stringify(hand));

    const values = hand.map(cardToValue);

    if (hand.length === 6) {
      if (
        isStraight(values) ||
        isPairPairPair(values) ||
        isTripleTriple(values) ||
        sum(values) <= 14 ||
        sum(values) >= 65
      ) {
        setJokboAvailable(true);
      } else {
        setJokboAvailable(false);
      }
    } else if (
      hand.length === 3 &&
      values.every((v) => v === values[0]) // 3장 같은 숫자
    ) {
      getSocket().emit("round-ended", {
        roomCode,
        reason: "three-of-a-kind",
      });
    } else {
      setJokboAvailable(false);
    }
  }, [hand]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("join-room", { roomCode, nickname });

    socket.on("next-round", ({ round }) => {
      console.log("[DEBUG] next-round 수신 | round =", round);
      setRound(round);
    });

    return () => {
      socket.off("next-round");
    };
  }, []);

  const isMyTurn = currentPlayer === nickname;

  const toggleBbungCard = (card: string) => {
    setBbungCards((prev) => {
      if (bbungPhase === "selectingExtra") {
        return [card];
      } else {
        return prev.includes(card)
          ? prev.filter((c) => c !== card)
          : [...prev, card];
      }
    });
  };

  const handleInitialBbung = () => {
    playSound("bbung.mp3");
    if (bbungCards.length !== 2) {
      alert("같은 숫자의 카드 2장을 선택해야 뻥이 가능합니다.");
      return;
    }

    const numbers = bbungCards.map((c) => c.replace(/[^0-9JQKA]/g, ""));
    if (numbers[0] !== numbers[1]) {
      alert("선택한 두 카드는 숫자가 같아야 합니다.");
      return;
    }

    const latestCard =
      submittedCards.length > 0
        ? submittedCards[submittedCards.length - 1].card
        : null;
    if (!latestCard) {
      alert("제출된 카드가 없습니다.");
      return;
    }
    const latestNumber = latestCard.replace(/[^0-9JQKA]/g, "");
    if (numbers[0] !== latestNumber) {
      alert("직전에 제출된 카드와 숫자가 일치해야 뻥이 가능합니다.");
      return;
    }

    const socket = getSocket();
    socket.emit("submit-bbung", { roomCode, cards: bbungCards });

    setHand((prev) => {
      const newHand = sortHandByValue(
        prev.filter((c) => !bbungCards.includes(c))
      );
      if (newHand.length === 2) {
        checkAndEmitBagaji(newHand, "afterSubmit");
      }
      return newHand;
    });

    setBbungCards([]);
    if (hand.length - 2 === 0) {
      // socket.emit("hand-empty", { roomCode });
      setBbungPhase("idle");
    } else {
      setBbungPhase("selectingExtra");
    }
  };

  const handleExtraBbung = () => {
    if (bbungCards.length !== 1) {
      alert("추가로 낼 카드 1장을 선택하세요.");
      return;
    }

    const socket = getSocket();
    socket.emit("submit-bbung-extra", { roomCode, card: bbungCards[0] });

    setHand((prev) => {
      const newHand = sortHandByValue(prev.filter((c) => c !== bbungCards[0]));
      checkAndEmitBagaji(newHand, "afterSubmit");
      return newHand;
    });

    setBbungCards([]);
    setMustSubmit(false);
    setBbungPhase("idle"); // ✅ 이 줄 추가!
  };

  const handleSubmitCard = () => {
    if (bbungCards.length !== 1) {
      alert("제출할 카드 1장을 선택하세요.");
      return;
    }
    const socket = getSocket();
    socket.emit("submit-card", { roomCode, card: bbungCards[0] });
    setHand((prev) => {
      const newHand = sortHandByValue(prev.filter((c) => c !== bbungCards[0]));
      checkAndEmitBagaji(newHand, "afterSubmit");

      return newHand;
    });
    setBbungCards([]);
    setMustSubmit(false);
  };

  const handleStop = () => {
    // ✅ 손패 먼저 저장
    sessionStorage.setItem("myHand", JSON.stringify(hand));

    const socket = getSocket();
    socket.emit("stop", { roomCode, stopper: nickname, hand });

    // ✅ 현재 위치에서 round-ended를 기다릴 필요 없음
  };

  const sendChat = () => {
    if (!canSend || chatInput.trim() === "") return;
    const socket = getSocket();
    playSound("chat.mp3");
    socket.emit("chat-message", { roomCode, nickname, message: chatInput });
    setChatInput("");
    setCanSend(false);
    setTimeout(() => setCanSend(true), 60000); // 1분 쿨타임
  };

  const getCardColor = (card: string) =>
    card.includes("♥") || card.includes("♦") ? "text-red-500" : "text-black";

  const canShowBbungButton = () => {
    if (bbungPhase !== "idle") return false;
    if (currentPlayerDrawn) return false;
    if (bbungCards.length !== 2) return false;

    const latest = submittedCards.at(-1);
    if (!latest) return false;

    if (anyoneDrewThisTurn) return false;

    const latestNumber = latest.card.replace(/[^0-9JQKA]/g, "");
    const selectedNumbers = bbungCards.map((c) => c.replace(/[^0-9JQKA]/g, ""));

    // ✅ 자기 카드에 뻥 금지
    if (latest.nickname === nickname && selectedNumbers[0] === latestNumber) {
      return false;
    }

    return (
      selectedNumbers[0] === selectedNumbers[1] &&
      selectedNumbers[0] === latestNumber
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-green-900 text-white p-4 relative">
      {/* ✅ 이걸 별도로 아래에 배치 */}
      <div className="absolute top-24 left-4 text-left bg-black bg-opacity-40 p-2 rounded">
        <h2 className="text-sm font-semibold">플레이어 목록</h2>
        <ul className="text-sm space-y-1">
          {playerList.map((name) => (
            <li
              key={name}
              className={`${
                name === currentPlayer
                  ? "text-yellow-300 font-bold bg-white bg-opacity-10 rounded px-2 py-1"
                  : "text-white"
              }`}
            >
              {name === currentPlayer ? "🎯 " : ""}
              {name}
            </li>
          ))}
        </ul>
      </div>

      <div className="absolute top-4 left-4 text-left">
        <div className="text-lg font-bold">
          방 코드: <span className="font-mono">{roomCode}</span>
        </div>
        <div className="text-md">닉네임: {nickname}</div>
      </div>

      <div className="mt-4 w-full max-w-xl">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className="text-sm bg-black bg-opacity-30 text-white p-2 my-1 rounded shadow"
          >
            <span className="font-bold">{msg.nickname}:</span> {msg.text}
          </div>
        ))}
      </div>

      <div className="absolute top-4 right-4 text-right">
        <div className="text-lg font-bold">현재 턴: {currentPlayer}</div>
        <div className="text-md mt-1">라운드: {round} / 5</div>
        {currentPlayerDrawn && (
          <div className="text-sm text-yellow-400">(카드 드로우 완료)</div>
        )}
      </div>

      <h1 className="text-3xl mb-4">🃏 뻥카비 게임</h1>

      <div className="mb-6">
        <h2 className="text-xl mb-2">제출된 카드</h2>
        {submittedCards.length > 0 ? (
          <div className="flex justify-center">
            <div
              className={`w-16 h-24 border-2 border-white rounded-lg flex items-center justify-center text-xl font-bold shadow ${getCardColor(
                submittedCards[submittedCards.length - 1].card
              )} bg-white text-black`}
            >
              {submittedCards[submittedCards.length - 1].card}
            </div>
          </div>
        ) : (
          <div className="text-gray-400">제출된 카드 없음</div>
        )}
      </div>

      <div className="bg-white text-black p-4 rounded shadow-md w-full max-w-xl">
        <h2 className="text-xl font-bold mb-4">내 손패</h2>
        <div className="flex flex-wrap justify-center gap-2">
          {hand.map((card, index) => (
            <button
              key={index}
              className={`w-16 h-24 border-2 border-black rounded-lg flex items-center justify-center text-xl font-bold shadow ${getCardColor(
                card
              )} ${bbungCards.includes(card) ? "bg-yellow-200" : "bg-white"} ${
                card === recentDrawnCard
                  ? "ring-4 ring-green-400 scale-105 transition duration-200"
                  : ""
              }`}
              onClick={() => toggleBbungCard(card)}
            >
              {card}
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-col items-center">
          {canShowBbungButton() && (
            <button
              onClick={handleInitialBbung}
              className="mb-2 px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded"
            >
              뻥! (같은 카드 2장 제출)
            </button>
          )}

          {isMyTurn && !mustSubmit && bbungPhase === "idle" && (
            <button
              onClick={handleStop}
              className="mt-2 px-6 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded"
            >
              스탑!
            </button>
          )}

          {bbungPhase === "selectingExtra" && (
            <button
              onClick={handleExtraBbung}
              className="mb-2 px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded"
            >
              추가 카드 1장 제출
            </button>
          )}

          {isMyTurn && mustSubmit && bbungPhase === "idle" && (
            <button
              onClick={handleSubmitCard}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
            >
              카드 제출
            </button>
          )}

          {isMyTurn && !mustSubmit && bbungPhase === "idle" && (
            <button
              onClick={() => getSocket().emit("draw-card", { roomCode })}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
            >
              카드 뽑기
            </button>
          )}

          {isMyTurn && hand.length === 6 && jokboAvailable && (
            <button
              onClick={() =>
                getSocket().emit("round-ended", {
                  roomCode,
                  reason: "족보 완성",
                })
              }
              className="mt-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded"
            >
              족보 완성!
            </button>
          )}
        </div>
        {/* 💬 채팅 UI */}
        <div className="mt-8 w-full max-w-xl">
          <div className="bg-white text-black p-4 rounded shadow-md">
            <h2 className="text-lg font-bold mb-2">채팅</h2>
            <div className="h-40 overflow-y-auto mb-2 bg-gray-100 p-2 rounded text-sm">
              {chatMessages.map((msg, i) => (
                <div key={i}>
                  <strong>{msg.nickname}:</strong> {msg.message}
                </div>
              ))}
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                className="flex-grow px-2 py-1 border rounded"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
                placeholder={
                  canSend ? "메시지를 입력하세요" : "1분 후 다시 입력 가능"
                }
                disabled={!canSend}
              />
              <button
                onClick={sendChat}
                disabled={!canSend}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1 rounded disabled:bg-gray-400"
              >
                전송
              </button>
            </div>
          </div>
        </div>
      </div>
      {showBagaji && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="text-3xl font-bold text-white bg-black bg-opacity-70 px-6 py-3 rounded-lg shadow-lg">
            {bagajiText}
          </div>
        </div>
      )}
    </div>
  );
}

function cardToValue(card: string): number {
  const rank = card.replace(/[^0-9JQKA]/g, "");
  if (rank === "A") return 1;
  if (rank === "J") return 11;
  if (rank === "Q") return 12;
  if (rank === "K") return 13;
  return parseInt(rank, 10);
}

function sortHandByValue(cards: string[]): string[] {
  return [...cards].sort((a, b) => cardToValue(a) - cardToValue(b));
}

function sum(arr: number[]): number {
  return arr.reduce((acc, val) => acc + val, 0);
}

function isStraight(values: number[]): boolean {
  const sorted = [...values].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (
      (sorted[i] - sorted[i - 1] + 13) % 13 !== 1 &&
      sorted[i] - sorted[i - 1] !== 1
    ) {
      return false;
    }
  }
  return true;
}

function isPairPairPair(values: number[]): boolean {
  const counts: Record<number, number> = {};
  values.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
  return Object.values(counts).filter((c) => c === 2).length === 3;
}

function isTripleTriple(values: number[]): boolean {
  const counts: Record<number, number> = {};
  values.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
  return Object.values(counts).filter((c) => c === 3).length === 2;
}
