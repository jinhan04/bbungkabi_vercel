export default function DevEasterEggPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#4B5320] bg-cover text-white p-6 text-center">
      <div className="bg-black bg-opacity-70 rounded-xl p-6 max-w-xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-4 animate-pulse">
          🪖 이스터에그를 찾은 당신께
        </h1>
        <p className="mb-4 text-lg leading-relaxed">
          이 게임을 만든 임진한은
          <br />
          지금쯤 어디선가 총을 들고 뛰고 있을 겁니다.
        </p>
        <p className="mb-4 text-base italic text-gray-300">
          전 이 뻥카비를 세상에 남기고 군대로 떠났습니다.
          <br />
          하지만… 이 페이지를 발견한 당신은 특별합니다.
        </p>
        <p className="mb-4 font-semibold text-yellow-300">
          언제 어디서든 뻥카비를 퍼뜨려 주세요.
          <br />저 대신… 자유를 즐겨 주세요.
        </p>
        <p className="text-sm text-gray-400 mt-6">- 훈련병 임진한 씀</p>
      </div>
    </div>
  );
}
