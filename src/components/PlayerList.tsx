// src/components/PlayerList.tsx

type PlayerListProps = {
  players: string[];
  currentPlayer: string;
};

export default function PlayerList({
  players,
  currentPlayer,
}: PlayerListProps) {
  return (
    <div className="absolute top-24 left-4 text-left bg-black bg-opacity-40 p-2 rounded">
      <h2 className="text-sm font-semibold">플레이어 목록</h2>
      <ul className="text-sm space-y-1">
        {players.map((name) => (
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
  );
}
