"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { getSocket } from "@/lib/socket";
import { playSound } from "@/lib/sound";
import { isSoundEnabled, toggleSound } from "@/lib/sound";

import {
  cardToValue,
  isStraight,
  isPairPairPair,
  isTripleTriple,
  sortHandByValue,
  sum,
} from "@/lib/gameUtils";

import Card from "@/components/Card";
import PlayerList from "@/components/PlayerList";
import ChatBox from "@/components/ChatBox";
import BagajiOverlay from "@/components/BagajiOverlay";
import SubmittedCard from "@/components/SubmittedCard";
import RoundBanner from "@/components/RoundBanner";

export default function GamePage() {
  const searchParams = useSearchParams();
  // const [deck, setDeck] = useState<string[]>([]);
  const [remainingCards, setRemainingCards] = useState(52);
  const router = useRouter();
  const roomCode = searchParams.get("code") || "";
  const nicknameRaw = searchParams.get("nickname") || "";
  const nickname = decodeURIComponent(nicknameRaw);
  const [playerList, setPlayerList] = useState<string[]>([]);

  const [bagajiText, setBagajiText] = useState("");
  const [showBagaji, setShowBagaji] = useState(false);

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawAnimationKey, setDrawAnimationKey] = useState(0);
  const [showBbungEffect, setShowBbungEffect] = useState(false);

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
  const [chatMessages, setChatMessages] = useState<
    { nickname: string; message: string }[]
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [canSend, setCanSend] = useState(true);
  const [showRoundBanner, setShowRoundBanner] = useState(false);
  const [newCards, setNewCards] = useState<string[]>([]);
  const [soundOn, setSoundOn] = useState(true);

  const isMyTurn = currentPlayer === nickname;

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
      } else if (
        cards.length === 5 &&
        counts.length >= 2 &&
        counts[0] === 3 &&
        counts[1] === 2
      ) {
        getSocket().emit("declare-bagaji", { roomCode, isBagaji: true });
      }
    }
  };

  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();

    socket.emit("join-room", { roomCode, nickname });
    socket.removeAllListeners();

    socket.on("update-players", (players: string[]) => setPlayerList(players));
    socket.emit("get-player-list", { roomCode }, (players: string[]) =>
      setPlayerList(players)
    );

    socket.on("deck-update", ({ remaining }) => {
      setRemainingCards(remaining);
    });

    socket.on("game-started", ({ round }) => {
      console.log("Game started with round:", round);
      if (round) {
        setRound(round);
        setShowRoundBanner(true);

        const roundSound =
          round === 5 ? "final-round.wav" : `round-${round}.wav`;
        playSound(roundSound);

        setTimeout(() => setShowRoundBanner(false), 2000);
      }
    });
    socket.on("deal-cards", ({ hand }) => setHand(sortHandByValue(hand)));
    socket.on("turn-info", ({ currentPlayer }) => {
      setCurrentPlayer(currentPlayer);
      setMustSubmit(false);
      setBbungPhase("idle");
      setCurrentPlayerDrawn(false);
      setAnyoneDrewThisTurn(false);
    });
    socket.on("card-submitted", ({ nickname, card }) =>
      setSubmittedCards((prev) => [...prev, { nickname, card }])
    );
    socket.on("drawn-card", ({ card }) => {
      playSound("draw.mp3");
      setDrawAnimationKey((prev) => prev + 1);
      setIsDrawing(true);

      setTimeout(() => {
        setIsDrawing(false);
      }, 600);

      setNewCards((prev) => [...prev, card]);
      setHand((prev) => {
        const newHand = sortHandByValue([...prev, card]);
        if (newHand.length === 2) checkAndEmitBagaji(newHand, "draw");
        return newHand;
      });
      setMustSubmit(true);
      setRecentDrawnCard(card);
      setTimeout(() => {
        setRecentDrawnCard(null);
        setNewCards((prev) => prev.filter((c) => c !== card));
      }, 1500);
    });

    socket.on("player-drawn", ({ nickname }) => {
      if (nickname === currentPlayer) setCurrentPlayerDrawn(true);
      setAnyoneDrewThisTurn(true);
    });
    socket.on("bagaji-declared", ({ nickname, isBagaji }) => {
      const message = isBagaji ? "🚨 바가지! 🚨" : "❌ 노 바가지 ❌";
      setBagajiText(message);
      setShowBagaji(true);
      setChatMessages((prev) => [...prev, { nickname, message }]);

      // ✅ 사운드 추가
      playSound(isBagaji ? "bagaji.wav" : "no-bagaji.wav");

      setTimeout(() => {
        setShowBagaji(false);
        setBagajiText("");
      }, 1000);
    });

    socket.on(
      "round-ended",
      ({ reason, stopper, allPlayerHands, round, triggerer }) => {
        setRound(round);
        const myHand = allPlayerHands?.[nickname] || hand;
        if (reason === "족보 완성") playSound("jokbo_complete.mp3");

        sessionStorage.setItem("myHand", JSON.stringify(myHand));
        sessionStorage.setItem(
          "allPlayerHands",
          JSON.stringify(allPlayerHands)
        );
        sessionStorage.setItem("round", String(round));
        if (triggerer) sessionStorage.setItem("bbungTriggerer", triggerer);

        let url = `/roundresult?code=${roomCode}&nickname=${encodeURIComponent(
          nickname
        )}&reason=${reason}`;
        if (stopper) url += `&stopper=${encodeURIComponent(stopper)}`;
        router.push(url);
      }
    );

    socket.emit("ready", { roomCode, nickname });
    socket.emit("request-hand", { roomCode });
  }, [roomCode, nickname, router]);

  useEffect(() => {
    getSocket().on("chat-message", ({ nickname, message }) =>
      setChatMessages((prev) => [...prev, { nickname, message }])
    );
  }, []);

  useEffect(() => {
    sessionStorage.setItem("myHand", JSON.stringify(hand));
    const values = hand.map(cardToValue);

    if (hand.length === 6) {
      setJokboAvailable(
        isStraight(values) ||
          isPairPairPair(values) ||
          isTripleTriple(values) ||
          sum(values) <= 14 ||
          sum(values) >= 65
      );
    } else if (hand.length === 3 && values.every((v) => v === values[0])) {
      getSocket().emit("round-ended", { roomCode, reason: "three-of-a-kind" });
    } else {
      setJokboAvailable(false);
    }
  }, [hand]);

  useEffect(() => {
    const socket = getSocket();
    socket.on("next-round", ({ round }) => {
      setRound(round);
      setShowRoundBanner(true);

      const roundSound = round === 5 ? "final-round.wav" : `round-${round}.wav`;
      playSound(roundSound);

      setTimeout(() => setShowRoundBanner(false), 2000);
    });
    return () => {
      socket.off("next-round");
    };
  }, [roomCode, nickname]);

  useEffect(() => {
    const socket = getSocket();

    socket.on("bbung-effect", ({ nickname: bbunger }) => {
      console.log(`${bbunger} used BBUNG!`);

      //playSound("bbung.mp3");
      playSound("bbung.wav");
      setShowBbungEffect(true);
      setTimeout(() => setShowBbungEffect(false), 800);
    });

    return () => {
      socket.off("bbung-effect");
    };
  }, []);

  const toggleBbungCard = (card: string) => {
    setBbungCards((prev) =>
      bbungPhase === "selectingExtra"
        ? [card]
        : prev.includes(card)
        ? prev.filter((c) => c !== card)
        : [...prev, card]
    );
  };

  const handleInitialBbung = () => {
    if (bbungCards.length !== 2)
      return alert("같은 숫자의 카드 2장을 선택해야 뻥이 가능합니다.");

    const [n1, n2] = bbungCards.map((c) => c.replace(/[^0-9JQKA]/g, ""));
    if (n1 !== n2) return alert("선택한 두 카드는 숫자가 같아야 합니다.");

    const latest = submittedCards.at(-1)?.card;
    if (!latest) return alert("제출된 카드가 없습니다.");

    const latestNumber = latest.replace(/[^0-9JQKA]/g, "");
    if (n1 !== latestNumber)
      return alert("직전 카드와 숫자가 같아야 뻥이 가능합니다.");

    getSocket().emit("submit-bbung", { roomCode, cards: bbungCards });
    setHand((prev) =>
      sortHandByValue(prev.filter((c) => !bbungCards.includes(c)))
    );
    setBbungCards([]);
    setBbungPhase(hand.length - 2 === 0 ? "idle" : "selectingExtra");
  };

  const handleExtraBbung = () => {
    if (bbungCards.length !== 1) return alert("추가 카드 1장을 선택하세요.");

    const newHand = hand.filter((c) => c !== bbungCards[0]);
    setHand(sortHandByValue(newHand));
    getSocket().emit("submit-bbung-extra", { roomCode, card: bbungCards[0] });
    playSound("submit-card.wav");
    setBbungCards([]);
    setMustSubmit(false);
    setBbungPhase("idle");

    // 👇 바가지 체크
    if (newHand.length === 2 || newHand.length === 5) {
      checkAndEmitBagaji(newHand, "afterSubmit");
    }
  };

  const handleSubmitCard = () => {
    if (bbungCards.length !== 1) return alert("제출할 카드 1장을 선택하세요.");

    const newHand = hand.filter((c) => c !== bbungCards[0]);
    setHand(sortHandByValue(newHand));
    playSound("submit-card.wav");
    getSocket().emit("submit-card", { roomCode, card: bbungCards[0] });
    setBbungCards([]);
    setMustSubmit(false);

    // 👇 바가지 체크
    if (newHand.length === 2 || newHand.length === 5) {
      checkAndEmitBagaji(newHand, "afterSubmit");
    }
  };

  const handleStop = () => {
    sessionStorage.setItem("myHand", JSON.stringify(hand));
    getSocket().emit("stop", { roomCode, stopper: nickname, hand });
  };

  const sendChat = () => {
    if (!canSend || chatInput.trim() === "") return;
    playSound("chat.mp3");
    getSocket().emit("chat-message", {
      roomCode,
      nickname,
      message: chatInput,
    });
    setChatInput("");
    setCanSend(false);
    setTimeout(() => setCanSend(true), 60000);
  };

  const canShowBbungButton = () => {
    if (
      bbungPhase !== "idle" ||
      currentPlayerDrawn ||
      bbungCards.length !== 2 ||
      anyoneDrewThisTurn
    )
      return false;
    const latest = submittedCards.at(-1);
    if (!latest) return false;
    const latestNumber = latest.card.replace(/[^0-9JQKA]/g, "");
    const selectedNumbers = bbungCards.map((c) => c.replace(/[^0-9JQKA]/g, ""));
    if (latest.nickname === nickname && selectedNumbers[0] === latestNumber)
      return false;
    return (
      selectedNumbers[0] === selectedNumbers[1] &&
      selectedNumbers[0] === latestNumber
    );
  };

  function DrawAnimationCard({ keyVal }: { keyVal: number }) {
    return (
      <motion.div
        key={keyVal}
        initial={{ x: 0, y: 0, scale: 0.8, opacity: 0 }}
        animate={{ x: 200, y: 300, scale: 1, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="absolute top-1/2 left-1/2 w-[60px] h-[90px] bg-cardBack bg-cover rounded shadow-lg z-50"
      />
    );
  }

  function BbungTextEffect() {
    return (
      <motion.div
        initial={{ scale: 2, opacity: 1 }}
        animate={{ scale: 1, opacity: 0 }}
        transition={{ duration: 0.8 }}
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-6xl font-extrabold text-red-600 z-50"
      >
        뻥!
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-green-900 text-white p-4 relative">
      {/* ✅ 좌상단: 방 코드 + 닉네임 */}
      <div className="fixed top-2 left-2 z-50 text-sm sm:text-base">
        <div className="font-bold">
          방 코드: <span className="font-mono">{roomCode}</span>
        </div>
        <div>닉네임: {nickname}</div>
      </div>

      {/* ✅ 우상단: 사운드 버튼 + 라운드 정보 */}
      <div className="fixed top-2 right-2 z-50 flex flex-col items-end gap-1 text-sm text-right">
        <button
          onClick={() => {
            toggleSound();
            setSoundOn(isSoundEnabled());
          }}
          className="px-3 py-1 bg-gray-800 text-white rounded text-sm hover:bg-gray-700"
        >
          {soundOn ? "🔊 사운드 켜짐" : "🔇 사운드 꺼짐"}
        </button>
        <div>
          라운드: {round} / 5
          {currentPlayerDrawn && (
            <div className="text-yellow-400">(카드 드로우 완료)</div>
          )}
        </div>
      </div>

      {/* 👥 플레이어 목록 */}
      <PlayerList players={playerList} currentPlayer={currentPlayer} />

      <RoundBanner show={showRoundBanner} round={round} maxRound={5} />

      <h1 className="text-3xl mt-4 mb-6">🃏 뻥카비 게임</h1>

      {/* 이하 생략 (제출된 카드, 손패, 버튼, 채팅 등은 그대로 유지) */}

      {/* 제출된 카드 및 덱 */}
      <div className="mb-6 w-full max-w-2xl">
        <h2 className="text-xl mb-2 text-center">제출된 카드 및 드로우 덱</h2>
        <div className="flex justify-center items-center gap-8">
          <AnimatePresence mode="wait">
            {submittedCards.length > 0 ? (
              <SubmittedCard card={submittedCards.at(-1)!.card} />
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-gray-400"
              >
                제출된 카드 없음
              </motion.div>
            )}
          </AnimatePresence>

          <motion.img
            src="/cards/back.png"
            alt="덱"
            className={`w-20 h-28 rounded shadow-lg cursor-pointer
            ${
              !isMyTurn || mustSubmit || bbungPhase !== "idle"
                ? "opacity-50 cursor-not-allowed"
                : "hover:scale-105 transition-transform"
            }`}
            onClick={() => {
              if (isMyTurn && !mustSubmit && bbungPhase === "idle") {
                getSocket().emit("draw-card", { roomCode });
              }
            }}
            whileHover={
              isMyTurn && !mustSubmit && bbungPhase === "idle"
                ? { scale: 1.1, rotate: 5 }
                : {}
            }
            whileTap={
              isMyTurn && !mustSubmit && bbungPhase === "idle"
                ? { scale: 0.95 }
                : {}
            }
          />
        </div>
        <div className="text-center text-sm text-yellow-300 mt-1">
          남은 카드: {remainingCards}
        </div>
      </div>

      {/* 손패 및 버튼 */}
      <div className="bg-white text-black p-4 rounded shadow-md w-full max-w-xl">
        <h2 className="text-xl font-bold mb-4 text-center sm:text-left">
          내 손패
        </h2>
        <div className="flex flex-wrap justify-center gap-2 mt-2 px-2">
          {hand.map((card) => (
            <Card
              key={card}
              card={card}
              selected={bbungCards.includes(card)}
              isRecent={card === recentDrawnCard}
              isNew={newCards.includes(card)}
              onClick={() => toggleBbungCard(card)}
            />
          ))}
        </div>

        <div className="mt-6 flex flex-col items-center gap-2 w-full max-w-sm mx-auto">
          {canShowBbungButton() && (
            <button
              onClick={handleInitialBbung}
              className="w-full px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded"
            >
              뻥! (같은 카드 2장 제출)
            </button>
          )}
          {isMyTurn && !mustSubmit && bbungPhase === "idle" && (
            <button
              onClick={handleStop}
              className="w-full px-6 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded"
            >
              스탑!
            </button>
          )}
          {bbungPhase === "selectingExtra" && (
            <button
              onClick={handleExtraBbung}
              className="w-full px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded"
            >
              추가 카드 1장 제출
            </button>
          )}
          {isMyTurn && mustSubmit && bbungPhase === "idle" && (
            <button
              onClick={handleSubmitCard}
              className="w-full px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
            >
              카드 제출
            </button>
          )}
          {isMyTurn && !mustSubmit && bbungPhase === "idle" && (
            <button
              onClick={() => getSocket().emit("draw-card", { roomCode })}
              className="w-full px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
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
              className="w-full px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded"
            >
              족보 완성!
            </button>
          )}
        </div>

        {isDrawing && <DrawAnimationCard keyVal={drawAnimationKey} />}
        {showBbungEffect && <BbungTextEffect />}

        {/* 📨 채팅창 */}
        <ChatBox
          chatMessages={chatMessages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          canSend={canSend}
          sendChat={sendChat}
          className="w-full mt-4"
        />
      </div>

      <BagajiOverlay show={showBagaji} text={bagajiText} />
    </div>
  );
}
