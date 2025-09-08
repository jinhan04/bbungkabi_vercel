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
//import PlayerList from "@/components/PlayerList";
import ChatBox from "@/components/ChatBox";
import BagajiOverlay from "@/components/BagajiOverlay";
import SubmittedCard from "@/components/SubmittedCard";
import RoundBanner from "@/components/RoundBanner";
import { useAuth } from "@/context/AuthContext";

export default function GamePage() {
  const searchParams = useSearchParams();
  // const [deck, setDeck] = useState<string[]>([]);
  const [remainingCards, setRemainingCards] = useState(52);
  const router = useRouter();
  const roomCode = searchParams.get("code") || "";
  const nicknameRaw = searchParams.get("nickname") || "";
  const nickname = decodeURIComponent(nicknameRaw);
  // const [playerList, setPlayerList] = useState<string[]>([]);

  const [bagajiText, setBagajiText] = useState("");
  const [showBagaji, setShowBagaji] = useState(false);
  const { emoji: myEmoji } = useAuth();

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawAnimationKey, setDrawAnimationKey] = useState(0);
  const [showBbungEffect, setShowBbungEffect] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const [hand, setHand] = useState<string[]>([]);
  const [round, setRound] = useState<number>(1);

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
    "idle"
  );
  const [jokboAvailable, setJokboAvailable] = useState(false);
  const [recentDrawnCard, setRecentDrawnCard] = useState<string | null>(null);
  const [anyoneDrewThisTurn, setAnyoneDrewThisTurn] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    { nickname: string; message: string }[]
  >([]);

  const [timer, setTimer] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  // combinedPlayers, emojiMap, totalScores, nickname, myEmoji, currentPlayer, timer는 이미 존재
  const playersForStrip: PlayerInfo[] = combinedPlayers.map((p) => ({
    name: p.nickname,
    emoji:
      p.nickname === nickname
        ? myEmoji
        : emojiMap[p.nickname] ?? (p.isBot ? "🤖" : "👤"),
    botLevel: p.isBot ? p.difficulty : undefined,
    score: totalScores?.[p.nickname],
  }));

  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();

    // socket.emit("join-room", { roomCode, nickname, emoji: myEmoji });

    console.log("🙋 내 닉네임:", nickname);

    // socket.removeAllListeners();

    socket.on("update-players", ({ emojis }) => {
      setEmojiMap(emojis || {});
    });

    // ✅ 이모지 단독 업데이트도 반영
    socket.off("update-emojis");
    socket.on("update-emojis", (map: Record<string, string>) => {
      setEmojiMap(map || {});
    });

    // ✅ 사람+봇 통합 목록 구독
    socket.off("player-list");
    socket.on("player-list", ({ players }: { players: CombinedPlayer[] }) => {
      setCombinedPlayers(Array.isArray(players) ? players : []);
    });

    // ✅ 누가 들어오고/나가면 목록 새로고침
    socket.off("player-joined");
    socket.on("player-joined", () => {
      socket.emit("request-player-list", { roomCode });
    });
    socket.off("player-left");
    socket.on("player-left", () => {
      socket.emit("request-player-list", { roomCode });
    });

    // ✅ 게임 화면 마운트 시 통합 목록 1회 요청
    socket.emit("request-player-list", { roomCode });

    socket.emit(
      "get-player-emojis",
      { roomCode },
      (map: { [nickname: string]: string }) => {
        setEmojiMap(map);
      }
    );

    socket.on("deck-update", ({ remaining }) => {
      setRemainingCards(remaining);
    });

    socket.on("game-started", ({ round }) => {
      console.log("Game started with round:", round);

      // playSound("game-start.mp3");

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

    socket.on("turn-info", ({ currentPlayer, round }) => {
      console.log("🌀 서버에서 받은 currentPlayer:", currentPlayer);
      console.log("🎯 서버에서 받은 round:", round);
      setCurrentPlayer(currentPlayer);
      if (round !== undefined) setRound(round); // ✅ 라운드 업데이트

      setMustSubmit(false);
      setBbungPhase("idle");
      setCurrentPlayerDrawn(false);
      setAnyoneDrewThisTurn(false);
      setBbungCards([]);

      // ✅ 타이머 초기화 및 시작
      if (currentPlayer === nickname) {
        setTimer(10);
        if (timerRef.current) clearInterval(timerRef.current);

        timerRef.current = setInterval(() => {
          setTimer((prev) => {
            if (prev === null || prev <= 1) {
              clearInterval(timerRef.current!);
              return null;
            }

            const next = prev - 1;

            // ✅ 5초 이하일 때만 사운드 재생
            if (next <= 5) {
              playSound("tick.mp3");
            }

            return next;
          });
        }, 1000);
      } else {
        setTimer(null);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    });

    socket.on("card-submitted", ({ nickname, card }) => {
      setSubmittedCards((prev) => [...prev, { nickname, card }]);
      addLog(`${nickname} 님이 ${card}를 냈습니다`);
    });

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
      setCurrentPlayerDrawn(true);
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

        if (reason === "stop") {
          playSound("stop.wav");
        }
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
    };
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
      addLog(`${bbunger} 님이 뻥을 했습니다`);
    });

    return () => {
      socket.off("bbung-effect");
    };
  }, []);

  useEffect(() => {
    const savedScores = sessionStorage.getItem("totalScores");
    if (savedScores) {
      const scoreMap = JSON.parse(savedScores);
      if (nickname in scoreMap) {
        setMyScore(scoreMap[nickname]);
      }
    }
  }, [nickname]);

  // const [emojiMap, setEmojiMap] = useState<{ [player: string]: string }>({});

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
    playSound("submit-card.mp3");
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
    playSound("submit-card.mp3");
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

  const canDrawCard = () => {
    const result =
      isMyTurn && !mustSubmit && bbungPhase === "idle" && !currentPlayerDrawn;

    console.log("🎯 draw-card 조건 확인", {
      isMyTurn,
      mustSubmit,
      bbungPhase,
      currentPlayerDrawn,
      result,
    });

    return result;
  };

  const addLog = (message: string) => {
    const id = crypto.randomUUID(); // 유니크 ID로 구분
    const newMessage = `${id}::${message}`;

    setLogs((prev) => [...prev, newMessage]);

    setTimeout(() => {
      setLogs((prev) => prev.filter((log) => log !== newMessage));
    }, 1000);
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
        BBUNG!
      </motion.div>
    );
  }
  const [showChat, setShowChat] = useState(true); // 또는 false로 시작해도 됨

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-radial from-green-800 via-green-900 to-black text-white px-2 sm:px-4 pt-24">
      {/* ✅ 티츄비 스타일 상단 바 */}
      <div className="w-full bg-white text-black flex flex-wrap sm:flex-nowrap justify-between items-center px-4 py-2 fixed top-0 left-0 z-50 shadow-md gap-y-2">
        {/* 왼쪽: 라운드, 닉네임, 점수 */}
        <div className="flex flex-wrap sm:flex-nowrap items-center space-x-2 text-xs sm:text-sm md:text-base font-semibold">
          <span className="text-blue-800">라운드: {round} / 5</span>
          <span>{nickname}님</span>
          <span className="text-pink-700">내 점수: {myScore}</span>
          <button
            onClick={() => setShowScoreModal(true)}
            className="px-2 py-1 bg-gray-200 text-gray-800 text-xs sm:text-sm rounded hover:bg-gray-300"
          >
            점수 보기
          </button>
        </div>

        {/* 오른쪽: 채팅, 음소거, 나가기 */}
        <div className="flex items-center space-x-2 text-lg sm:text-xl">
          <button onClick={() => setShowChat((prev) => !prev)}>💬</button>
          <button
            onClick={() => {
              toggleSound();
              setSoundOn(isSoundEnabled());
            }}
          >
            {soundOn ? "🔊" : "🔇"}
          </button>
          <button
            onClick={() => {
              if (confirm("게임을 나가시겠습니까?")) router.push("/");
            }}
          >
            ↩️
          </button>
        </div>
      </div>

      {timer !== null && (
        <div className="absolute top-[100px] left-4 text-white text-2xl sm:text-3xl font-bold z-50">
          {timer}
        </div>
      )}

      <div className="absolute top-[60px] right-4 z-50 flex flex-col items-end gap-1 pointer-events-none">
        <AnimatePresence>
          {logs.map((log) => {
            const [id, msg] = log.split("::");
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-black/70 text-white text-xs sm:text-sm px-3 py-1 rounded shadow"
              >
                {msg}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* 상단 바 끝난 직후 */}
      <PlayerStrip
        players={playersForStrip}
        currentPlayer={currentPlayer}
        me={nickname}
        timer={timer}
        // 상단바 높이가 약 56~64px이므로 sticky offset 맞춤
        className="sticky top-[56px] z-40 bg-transparent"
      />

      <RoundBanner show={showRoundBanner} round={round} maxRound={5} />

      {/* 제출된 카드 및 덱 */}
      <div className="mb-6 w-full max-w-2xl">
        <div className="flex justify-center items-center gap-4 sm:gap-8">
          <AnimatePresence mode="wait">
            {submittedCards.length > 0 ? (
              <motion.div
                key={
                  submittedCards.at(-1)!.card + submittedCards.at(-1)!.nickname
                }
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <SubmittedCard
                  card={submittedCards.at(-1)!.card}
                  nickname={submittedCards.at(-1)!.nickname}
                  className="w-16 h-24 sm:w-20 sm:h-28 lg:w-24 lg:h-32"
                />
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-gray-400 text-sm"
              >
                제출된 카드 없음
              </motion.div>
            )}
          </AnimatePresence>

          <motion.img
            src="/cards/back.png"
            alt="덱"
            className={`w-16 h-24 sm:w-20 sm:h-28 lg:w-24 lg:h-32 rounded shadow-lg cursor-pointer ${
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
        <div className="text-center text-xs sm:text-sm text-yellow-300 mt-1">
          남은 카드: {remainingCards}
        </div>
      </div>

      {showScoreModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white text-black p-6 rounded-lg shadow-lg w-72 sm:w-80">
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-center">
              현재 점수
            </h2>
            <ul className="space-y-1 text-xs sm:text-sm">
              {Object.entries(totalScores)
                .sort(([, a], [, b]) => b - a)
                .map(([player, score]) => (
                  <li key={player} className="flex justify-between">
                    <span>{player}</span>
                    <span className="font-semibold">{score}점</span>
                  </li>
                ))}
            </ul>
            <button
              onClick={() => setShowScoreModal(false)}
              className="mt-4 w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 손패 및 버튼 */}
      <div className="bg-white text-black p-4 rounded shadow-md w-full max-w-xl">
        <div className="flex flex-wrap justify-center gap-2 mt-2 px-2">
          {hand.map((card) => (
            <Card
              key={card}
              card={card}
              selected={bbungCards.includes(card)}
              isRecent={card === recentDrawnCard}
              isNew={newCards.includes(card)}
              onClick={() => toggleBbungCard(card)}
              className="w-16 h-24 sm:w-20 sm:h-28 lg:w-24 lg:h-32"
            />
          ))}
        </div>

        <div className="mt-6 flex flex-col items-center gap-2 w-full max-w-sm mx-auto">
          {canShowBbungButton() && (
            <button
              onClick={handleInitialBbung}
              className="w-full px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-sm"
            >
              뻥! (같은 카드 2장 제출)
            </button>
          )}
          {isMyTurn && !mustSubmit && bbungPhase === "idle" && (
            <button
              onClick={handleStop}
              className="w-full px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded text-sm"
            >
              스탑!
            </button>
          )}
          {bbungPhase === "selectingExtra" && (
            <button
              onClick={handleExtraBbung}
              className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm"
            >
              추가 카드 1장 제출
            </button>
          )}
          {isMyTurn && mustSubmit && bbungPhase === "idle" && (
            <button
              onClick={handleSubmitCard}
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
            >
              카드 제출
            </button>
          )}
          {isMyTurn && canDrawCard() && (
            <button
              onClick={() => getSocket().emit("draw-card", { roomCode })}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
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
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm"
            >
              족보 완성!
            </button>
          )}
        </div>

        {isDrawing && <DrawAnimationCard keyVal={drawAnimationKey} />}
        {showBbungEffect && <BbungTextEffect />}

        {showChat && (
          <ChatBox
            chatMessages={chatMessages}
            chatInput={chatInput}
            setChatInput={setChatInput}
            canSend={canSend}
            sendChat={sendChat}
            className="w-full mt-4"
          />
        )}
      </div>

      <BagajiOverlay show={showBagaji} text={bagajiText} />
    </div>
  );
}
