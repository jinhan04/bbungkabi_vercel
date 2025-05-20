// src/components/BagajiOverlay.tsx

type BagajiOverlayProps = {
  show: boolean;
  text: string;
};

export default function BagajiOverlay({ show, text }: BagajiOverlayProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="text-3xl font-bold text-white bg-black bg-opacity-70 px-6 py-3 rounded-lg shadow-lg">
        {text}
      </div>
    </div>
  );
}
