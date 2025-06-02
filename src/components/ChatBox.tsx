// src/components/ChatBox.tsx

type ChatBoxProps = {
  chatMessages: { nickname: string; message: string }[];
  chatInput: string;
  setChatInput: React.Dispatch<React.SetStateAction<string>>;
  canSend: boolean;
  sendChat: () => void;
  className?: string; // ✅ 추가
};

export default function ChatBox({
  chatMessages,
  chatInput,
  setChatInput,
  canSend,
  sendChat,
  className, // ✅ props로 받고
}: ChatBoxProps) {
  return (
    <div className={`mt-8 w-full max-w-xl ${className ?? ""}`}>
      {" "}
      {/* ✅ 여기에 적용 */}
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
  );
}
