"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { getSocket } from "@/lib/socket";
import { playSound } from "@/lib/sound";
import { isSoundEnabled, toggleSound } from "@/lib/sound";
import PlayerStrip, { PlayerInfo } from "@/components/PlayerStrip";

import {
  cardToValue,
  isStraight,
  isPairPairPair,
  isTripleTriple,
  sortHandByValue,
  sum,
} from "@/lib/gameUtils";

type CombinedPlayer = {
  nickname: string;
  isBot?: boolean;
  difficulty?: "easy" | "normal" | "hard";
};

import Card from "@/components/Card";
import ChatBox from "@/components/ChatBox";
import BagajiOverlay from "@/components/BagajiOverlay";
import SubmittedCard from "@/components/SubmittedCard";
import RoundBanner from "@/components/RoundBanner";
import { useAuth } from "@/context/AuthContext";

export default function GamePage() {
  const searchParams = useSearchParams();
  const [remainingCards, setRemainingCards] = useState(52);
  const router = useRouter();
  const roomCode = searchParams.get("code") || "";
  const nicknameRaw = searchParams.get("nickname") || "";
  const nickname = decodeURIComponent(nicknameRaw);

  const [bagajiText, setBagajiText] = useState("");
  const [showBagaji, setShowBagaji] = useState(false);
  const { emoji: myEmoji } = useAuth();

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawAnimationKey, setDrawAnimationKey] = useState(0);
  const [showBbungEffect, setShowBbungEffect] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const [hand, setHand] = useState<string[]>([]);
  const [round, setRound] = useState<number>(1);
  const [maxRounds, setMaxRounds] = useState(5);

  const [showScoreModal, setShowScoreModal] = useState(false);
  const [totalScores, setTotalScores] = useState<{
    [nickname: string]: number;
  }>({});

  const [currentPlayer, setCurrentPlayer] = useState("");
  const [currentPlayerDrawn, setCurrentPlayerDrawn] = useState(false);
  const [submittedCards, setSubmittedCards] = useState<
    { nickname: string; card: string }[]
  >([]);
  const [mustSubmit, setMustSubmit] = useState(false);
  const [bbungCards, setBbungCards] = useState<string[]>([]);
  const [myScore, setMyScore] = useState(0);
  const [bbungPhase, setBbungPhase] = useState<"idle" | "selectingExtra">(
    "idle",
  );
  const [jokboAvailable, setJokboAvailable] = useState(false);
  const [recentDrawnCard, setRecentDrawnCard] = useState<string | null>(null);
  const [anyoneDrewThisTurn, setAnyoneDrewThisTurn] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    { nickname: string; message: string }[]
  >([]);

  const [timer, setTimer] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [turnTimeState, setTurnTimeState] = useState<number>(10);
  const [timerKey, setTimerKey] = useState(0);

  const [chatInput, setChatInput] = useState("");
  const [canSend, setCanSend] = useState(true);
  const [showRoundBanner, setShowRoundBanner] = useState(false);
  const [newCards, setNewCards] = useState<string[]>([]);
  const [soundOn, setSoundOn] = useState(true);

  const [combinedPlayers, setCombinedPlayers] = useState<CombinedPlayer[]>([]);
  const [emojiMap, setEmojiMap] = useState<Record<string, string>>({});

  const isMyTurn = currentPlayer === nickname;

  const checkAndEmitBagaji = (
    cards: string[],
    context: "draw" | "afterSubmit",
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

  const playersForStrip: PlayerInfo[] = combinedPlayers.map((p) => ({
    name: p.nickname,
    emoji:
      p.nickname === nickname
        ? myEmoji
        : (emojiMap[p.nickname] ?? (p.isBot ? "🤖" : "👤")),
    botLevel: p.isBot ? p.difficulty : undefined,
    score: totalScores?.[p.nickname],
  }));

  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();

    socket.on("update-players", ({ emojis }) => {
      setEmojiMap(emojis || {});
    });

    socket.off("update-emojis");
    socket.on("update-emojis", (map: Record<string, string>) => {
      setEmojiMap(map || {});
    });

    socket.off("player-list");
    socket.on("player-list", ({ players }: { players: CombinedPlayer[] }) => {
      setCombinedPlayers(Array.isArray(players) ? players : []);
    });

    socket.off("player-joined");
    socket.on("player-joined", () => {
      socket.emit("request-player-list", { roomCode });
    });
    socket.off("player-left");
    socket.on("player-left", () => {
      socket.emit("request-player-list", { roomCode });
    });

    socket.emit("request-player-list", { roomCode });

    socket.emit(
      "get-player-emojis",
      { roomCode },
      (map: { [nickname: string]: string }) => {
        setEmojiMap(map);
      },
    );

    socket.on("deck-update", ({ remaining }) => {
      setRemainingCards(remaining);
    });

    socket.on("game-started", ({ round, maxRounds }) => {
      if (maxRounds) setMaxRounds(maxRounds);
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

    socket.on("turn-info", ({ currentPlayer, round, turnTime, maxRounds }) => {
      setCurrentPlayer(currentPlayer);
      if (round !== undefined) setRound(round);
      if (maxRounds !== undefined) setMaxRounds(maxRounds);

      setMustSubmit(false);
      setBbungPhase("idle");
      setCurrentPlayerDrawn(false);
      setAnyoneDrewThisTurn(false);
      setBbungCards([]);

      setTurnTimeState(turnTime || 10);
      setTimerKey((prev) => prev + 1);
    });

    socket.on("card-submitted", ({ nickname: submitterName, card }) => {
      playSound("submit-card.mp3");
      setSubmittedCards((prev) => [...prev, { nickname: submitterName, card }]);
      addLog(`${submitterName} 님이 ${card}를 냈습니다`);
    });

    socket.on("drawn-card", ({ card }) => {
      playSound("draw.mp3");
      setDrawAnimationKey((prev) => prev + 1);
      setIsDrawing(true);
      setTimeout(() => setIsDrawing(false), 600);

      setNewCards((prev) => [...prev, card]);
      setHand((prev) => {
        const newHand = sortHandByValue([...prev, card]);
        if (newHand.length === 2) checkAndEmitBagaji(newHand, "draw");
        return newHand;
      });
      setMustSubmit(true);
      setCurrentPlayerDrawn(true);
      setRecentDrawnCard(card);
      setTimeout(() => {
        setRecentDrawnCard(null);
        setNewCards((prev) => prev.filter((c) => c !== card));
      }, 1500);
    });

    // 💡 버그 수정: 다른 사람이 뽑았을 때도 소리가 나도록 추가
    socket.on("player-drawn", ({ nickname: drawerName }) => {
      playSound("draw.mp3");
      if (drawerName === currentPlayer) setCurrentPlayerDrawn(true);
      setAnyoneDrewThisTurn(true);
    });

    socket.on("bagaji-declared", ({ nickname: bagajiNick, isBagaji }) => {
      const message = isBagaji ? "🚨 바가지! 🚨" : "❌ 노 바가지 ❌";
      setBagajiText(message);
      setShowBagaji(true);
      setChatMessages((prev) => [...prev, { nickname: bagajiNick, message }]);

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

        if (reason === "stop") playSound("stop.wav");
        const myHand = allPlayerHands?.[nickname] || hand;
        if (reason === "족보 완성") playSound("jokbo_complete.mp3");

        sessionStorage.setItem("myHand", JSON.stringify(myHand));
        sessionStorage.setItem(
          "allPlayerHands",
          JSON.stringify(allPlayerHands),
        );
        sessionStorage.setItem("round", String(round));
        if (triggerer) sessionStorage.setItem("bbungTriggerer", triggerer);

        let url = `/roundresult?code=${roomCode}&nickname=${encodeURIComponent(
          nickname,
        )}&reason=${reason}`;
        if (stopper) url += `&stopper=${encodeURIComponent(stopper)}`;
        router.push(url);
      },
    );

    // 💡 버그 수정: 채팅 및 어벙 메시지가 중복 등록되지 않도록 메인 useEffect 안에 병합
    socket.on("chat-message", ({ nickname: chatNick, message }) => {
      setChatMessages((prev) => [...prev, { nickname: chatNick, message }]);
    });

    socket.on("uhbbung-alert", ({ nickname: penaltyUser, penalty }) => {
      if (penalty) {
        addLog(`⏰ ${penaltyUser} 시간초과! (어벙 +10점)`);
      } else {
        addLog(`⏰ ${penaltyUser} 시간초과! (빨리 진행해 주세요)`);
      }
      setTimerKey((prev) => prev + 1);
    });

    socket.emit("ready", { roomCode, nickname });
    socket.emit("request-hand", { roomCode });

    return () => {
      socket.off("game-starting");
      socket.off("game-started");
      socket.off("update-players");
      socket.off("update-emojis");
      socket.off("player-list");
      socket.off("player-joined");
      socket.off("player-left");
      socket.off("deck-update");
      socket.off("deal-cards");
      socket.off("turn-info");
      socket.off("card-submitted");
      socket.off("drawn-card");
      socket.off("player-drawn");
      socket.off("bagaji-declared");
      socket.off("round-ended");
      socket.off("chat-message"); // 정리 필수
      socket.off("uhbbung-alert"); // 정리 필수
    };
  }, [roomCode, nickname, router]);

  useEffect(() => {
    if (!currentPlayer) return;

    const isMyTurnNow = currentPlayer === nickname;
    setTimer(turnTimeState);

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!);
          if (isMyTurnNow) {
            getSocket().emit("time-out", { roomCode });
          }
          return null;
        }
        const next = prev - 1;
        if (next <= 5 && isMyTurnNow) {
          playSound("tick.mp3");
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentPlayer, timerKey, nickname, roomCode, turnTimeState]);

  useEffect(() => {
    sessionStorage.setItem("myHand", JSON.stringify(hand));
    const values = hand.map(cardToValue);

    if (hand.length === 6) {
      setJokboAvailable(
        isStraight(values) ||
          isPairPairPair(values) ||
          isTripleTriple(values) ||
          sum(values) <= 14 ||
          sum(values) >= 65,
      );
    } else if (hand.length === 3 && values.every((v) => v === values[0])) {
      getSocket().emit("round-ended", { roomCode, reason: "three-of-a-kind" });
    } else {
      setJokboAvailable(false);
    }
  }, [hand]);

  useEffect(() => {
    const scores = sessionStorage.getItem("totalScores");
    if (scores) {
      const parsed = JSON.parse(scores);
      setTotalScores(parsed);
      if (parsed[nickname] !== undefined) {
        setMyScore(parsed[nickname]);
      }
    }
  }, [nickname]);

  useEffect(() => {
    const socket = getSocket();
    socket.on("next-round", ({ round, maxRounds }) => {
      if (maxRounds) setMaxRounds(maxRounds);
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
      playSound("bbung.wav");
      setShowBbungEffect(true);
      setTimeout(() => setShowBbungEffect(false), 800);
      addLog(`${bbunger} 님이 뻥을 했습니다`);
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
          : [...prev, card],
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
      sortHandByValue(prev.filter((c) => !bbungCards.includes(c))),
    );
    setBbungCards([]);
    setBbungPhase(hand.length - 2 === 0 ? "idle" : "selectingExtra");
  };

  const handleExtraBbung = () => {
    if (bbungCards.length !== 1) return alert("추가 카드 1장을 선택하세요.");

    const newHand = hand.filter((c) => c !== bbungCards[0]);
    setHand(sortHandByValue(newHand));
    getSocket().emit("submit-bbung-extra", { roomCode, card: bbungCards[0] });

    // 💡 여기서 로컬 효과음 제거함 (이제 서버에서 온 신호로 공통 출력됨)
    setBbungCards([]);
    setMustSubmit(false);
    setBbungPhase("idle");

    if (newHand.length === 2 || newHand.length === 5) {
      checkAndEmitBagaji(newHand, "afterSubmit");
    }
  };

  const handleSubmitCard = () => {
    if (bbungCards.length !== 1) return alert("제출할 카드 1장을 선택하세요.");

    const newHand = hand.filter((c) => c !== bbungCards[0]);
    setHand(sortHandByValue(newHand));

    // 💡 여기서 로컬 효과음 제거함
    getSocket().emit("submit-card", { roomCode, card: bbungCards[0] });
    setBbungCards([]);
    setMustSubmit(false);

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

  const canDrawCard = () => {
    return (
      isMyTurn && !mustSubmit && bbungPhase === "idle" && !currentPlayerDrawn
    );
  };

  const addLog = (message: string) => {
    const id = crypto.randomUUID();
    const newMessage = `${id}::${message}`;
    setLogs((prev) => [...prev, newMessage]);
    setTimeout(() => {
      setLogs((prev) => prev.filter((log) => log !== newMessage));
    }, 1500);
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
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-7xl font-black text-red-500 drop-shadow-xl z-50"
      >
        BBUNG!
      </motion.div>
    );
  }

  const [showChat, setShowChat] = useState(true);

  return (
    <div className="min-h-screen flex flex-col items-center bg-orange-50 text-gray-800 px-2 sm:px-4 pt-24 pb-10">
      <div className="w-full bg-white text-gray-800 flex flex-wrap sm:flex-nowrap justify-between items-center px-4 py-3 fixed top-0 left-0 z-50 shadow-sm border-b-[3px] border-orange-100 gap-y-2">
        <div className="flex flex-wrap sm:flex-nowrap items-center space-x-3 text-xs sm:text-sm md:text-base font-bold">
          <span className="bg-orange-100 text-orange-600 px-3 py-1.5 rounded-full shadow-sm border border-orange-200">
            🚩 라운드: {round} / {maxRounds}
          </span>
          <span className="text-gray-600 flex items-center gap-1">
            <span className="text-lg">{myEmoji}</span> {nickname}님
          </span>
          <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-full shadow-sm border border-green-200">
            🪙 내 점수: {myScore}
          </span>
          <button
            onClick={() => setShowScoreModal(true)}
            className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors shadow-sm"
          >
            🏆 점수 보기
          </button>
        </div>

        <div className="flex items-center space-x-3 text-lg sm:text-xl">
          <button
            onClick={() => setShowChat((prev) => !prev)}
            className="hover:scale-110 transition-transform bg-gray-100 p-2 rounded-full"
          >
            💬
          </button>
          <button
            onClick={() => {
              toggleSound();
              setSoundOn(isSoundEnabled());
            }}
            className="hover:scale-110 transition-transform bg-gray-100 p-2 rounded-full"
          >
            {soundOn ? "🔊" : "🔇"}
          </button>
          <button
            onClick={() => {
              if (confirm("게임을 나가시겠습니까?")) router.push("/");
            }}
            className="hover:scale-110 transition-transform bg-red-50 p-2 rounded-full text-red-500"
          >
            ↪️
          </button>
        </div>
      </div>

      <div className="absolute top-[70px] right-4 z-50 flex flex-col items-end gap-1 pointer-events-none">
        <AnimatePresence>
          {logs.map((log) => {
            const [id, msg] = log.split("::");
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white/90 text-gray-800 text-xs sm:text-sm px-4 py-2 rounded-xl shadow-md border border-orange-100 font-bold"
              >
                {msg}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <PlayerStrip
        players={playersForStrip}
        currentPlayer={currentPlayer}
        me={nickname}
        timer={timer}
        className="sticky top-[64px] z-40 bg-transparent w-full max-w-4xl mb-4"
      />

      <RoundBanner show={showRoundBanner} round={round} maxRound={maxRounds} />

      <div className="mb-6 w-full max-w-3xl bg-orange-100/50 border-4 border-dashed border-orange-200 rounded-[3rem] py-10 flex flex-col items-center relative shadow-inner">
        <div className="flex justify-center items-center gap-6 sm:gap-12">
          <div className="relative">
            <AnimatePresence mode="wait">
              {submittedCards.length > 0 ? (
                <motion.div
                  key={
                    submittedCards.at(-1)!.card +
                    submittedCards.at(-1)!.nickname
                  }
                  initial={{ y: -30, opacity: 0, rotate: -5 }}
                  animate={{ y: 0, opacity: 1, rotate: Math.random() * 10 - 5 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <SubmittedCard
                    card={submittedCards.at(-1)!.card}
                    nickname={submittedCards.at(-1)!.nickname}
                    className="w-20 h-28 sm:w-24 sm:h-36 lg:w-28 lg:h-40 shadow-xl"
                  />
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-20 h-28 sm:w-24 sm:h-36 lg:w-28 lg:h-40 border-4 border-dashed border-orange-300/50 rounded-xl flex items-center justify-center text-orange-400 font-bold text-center text-sm p-2"
                >
                  제출된
                  <br />
                  카드 없음
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative">
            <motion.img
              src="/cards/back.png"
              alt="덱"
              className={`w-20 h-28 sm:w-24 sm:h-36 lg:w-28 lg:h-40 rounded-xl shadow-lg cursor-pointer border-2 border-white ${
                !isMyTurn || mustSubmit || bbungPhase !== "idle"
                  ? "opacity-50 cursor-not-allowed grayscale-[50%]"
                  : "hover:scale-105 transition-transform"
              }`}
              onClick={() => {
                if (isMyTurn && !mustSubmit && bbungPhase === "idle") {
                  getSocket().emit("draw-card", { roomCode });
                }
              }}
              whileHover={
                isMyTurn && !mustSubmit && bbungPhase === "idle"
                  ? { scale: 1.05, y: -5 }
                  : {}
              }
              whileTap={
                isMyTurn && !mustSubmit && bbungPhase === "idle"
                  ? { scale: 0.95 }
                  : {}
              }
            />
            <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-white px-3 py-1 rounded-full shadow-md border border-orange-200 text-xs sm:text-sm font-black text-orange-500 whitespace-nowrap">
              남은 카드 {remainingCards}장
            </div>
          </div>
        </div>
      </div>

      {showScoreModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white text-gray-800 p-8 rounded-[2rem] shadow-2xl w-full max-w-sm border-4 border-orange-100">
            <h2 className="text-xl sm:text-2xl font-black mb-6 text-center text-orange-500 flex items-center justify-center gap-2">
              🏆 현재 점수판
            </h2>
            <ul className="space-y-3 text-sm sm:text-base mb-6">
              {Object.entries(totalScores)
                .sort(([, a], [, b]) => b - a)
                .map(([player, score], index) => (
                  <li
                    key={player}
                    className={`flex justify-between items-center p-3 rounded-xl ${player === nickname ? "bg-orange-50 border border-orange-200" : "bg-gray-50"}`}
                  >
                    <span className="font-bold flex items-center gap-2">
                      <span className="text-gray-400 text-xs">
                        {index + 1}위
                      </span>
                      {player}{" "}
                      {player === nickname && (
                        <span className="text-orange-500 text-xs">(나)</span>
                      )}
                    </span>
                    <span
                      className={`font-black ${score > 0 ? "text-green-500" : score < 0 ? "text-red-500" : "text-gray-500"}`}
                    >
                      {score}점
                    </span>
                  </li>
                ))}
            </ul>
            <button
              onClick={() => setShowScoreModal(false)}
              className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      <div className="bg-white p-4 sm:p-6 rounded-[2rem] shadow-lg border-[3px] border-orange-100 w-full max-w-3xl relative">
        <h3 className="absolute -top-4 left-6 bg-orange-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-md">
          나의 카드
        </h3>

        <div className="grid grid-cols-6 gap-2 mt-2 sm:flex sm:flex-wrap sm:justify-center px-1">
          {hand.map((card) => (
            <Card
              key={card}
              card={card}
              selected={bbungCards.includes(card)}
              isRecent={card === recentDrawnCard}
              isNew={newCards.includes(card)}
              onClick={() => toggleBbungCard(card)}
              className="w-full aspect-[2/3] text-xs sm:text-base sm:w-20 sm:h-28 lg:w-24 lg:h-32 shadow-sm rounded-lg border border-gray-200"
            />
          ))}
        </div>

        <div className="mt-8 flex flex-col sm:flex-row flex-wrap justify-center gap-3 w-full max-w-2xl mx-auto">
          {canShowBbungButton() && (
            <button
              onClick={handleInitialBbung}
              className="flex-1 min-w-[140px] px-4 py-4 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-black shadow-md hover:scale-105 transition-all"
            >
              🔥 뻥! (2장 제출)
            </button>
          )}
          {isMyTurn && !mustSubmit && bbungPhase === "idle" && (
            <button
              onClick={handleStop}
              className="flex-1 min-w-[140px] px-4 py-4 bg-purple-500 hover:bg-purple-600 text-white rounded-xl text-sm font-black shadow-md hover:scale-105 transition-all"
            >
              ✋ 스탑!
            </button>
          )}
          {bbungPhase === "selectingExtra" && (
            <button
              onClick={handleExtraBbung}
              className="flex-1 min-w-[140px] px-4 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-black shadow-md hover:scale-105 transition-all"
            >
              ➕ 추가 카드 제출
            </button>
          )}
          {isMyTurn && mustSubmit && bbungPhase === "idle" && (
            <button
              onClick={handleSubmitCard}
              className="flex-1 min-w-[140px] px-4 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-black shadow-md hover:scale-105 transition-all"
            >
              📤 카드 내기
            </button>
          )}
          {isMyTurn && canDrawCard() && (
            <button
              onClick={() => getSocket().emit("draw-card", { roomCode })}
              className="flex-1 min-w-[140px] px-4 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-black shadow-md hover:scale-105 transition-all"
            >
              🃏 카드 뽑기
            </button>
          )}
          {isMyTurn && hand.length === 6 && jokboAvailable && (
            <motion.button
              onClick={() =>
                getSocket().emit("round-ended", {
                  roomCode,
                  reason: "족보 완성",
                })
              }
              className="flex-1 min-w-[140px] relative px-4 py-4 text-white rounded-xl text-sm font-black bg-gradient-to-r from-pink-500 to-rose-500 shadow-lg overflow-hidden"
              animate={{
                scale: [1, 1.05, 1],
                boxShadow: [
                  "0 0 0 rgba(0,0,0,0)",
                  "0 0 15px rgba(244,63,94,0.6)",
                  "0 0 0 rgba(0,0,0,0)",
                ],
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="relative z-10">✨ 족보 완성!</span>
            </motion.button>
          )}
        </div>

        {isDrawing && <DrawAnimationCard keyVal={drawAnimationKey} />}
        {showBbungEffect && <BbungTextEffect />}

        {showChat && (
          <div className="mt-6 border-t-2 border-gray-100 pt-4">
            <ChatBox
              chatMessages={chatMessages}
              chatInput={chatInput}
              setChatInput={setChatInput}
              canSend={canSend}
              sendChat={sendChat}
              className="w-full"
            />
          </div>
        )}
      </div>

      <BagajiOverlay show={showBagaji} text={bagajiText} />
    </div>
  );
}
