"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onScan: (barcode: string) => void;
  onClose: () => void;
};

export default function BarcodeScanner({ onScan, onClose }: Props) {
  const scannerRef = useRef<any>(null);
  const [manualInput, setManualInput] = useState("");
  const [error, setError] = useState("");
  const [useManual, setUseManual] = useState(false);
  const elementId = "barcode-scanner-element";

  useEffect(() => {
    if (useManual) return;

    let scanner: any = null;

    const startScanner = async () => {
      try {
        const { Html5QrcodeScanner } = await import("html5-qrcode");
        scanner = new Html5QrcodeScanner(
          elementId,
          { fps: 10, qrbox: { width: 250, height: 150 } },
          false
        );
        scannerRef.current = scanner;
        scanner.render(
          (decodedText: string) => {
            scanner.clear();
            onScan(decodedText);
          },
          () => {}
        );
      } catch {
        setError("カメラを起動できませんでした。手入力をお使いください。");
        setUseManual(true);
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, [useManual, onScan]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      onScan(manualInput.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex flex-col">
      <div className="bg-white px-4 py-3 flex items-center justify-between">
        <h2 className="font-bold text-gray-800">バーコードスキャン</h2>
        <button onClick={onClose} className="text-gray-500 text-2xl leading-none">×</button>
      </div>

      {!useManual ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-black">
          <div id={elementId} className="w-full max-w-sm" />
          {error && <p className="text-red-400 text-sm mt-2 px-4 text-center">{error}</p>}
          <button
            onClick={() => setUseManual(true)}
            className="mt-4 text-white text-sm underline"
          >
            手入力に切り替える
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-white px-6">
          <p className="text-gray-600 mb-4 text-sm">整理番号を手入力してください</p>
          <form onSubmit={handleManualSubmit} className="w-full max-w-sm space-y-3">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="例: 2024-03-00549"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium"
            >
              確認
            </button>
          </form>
          <button
            onClick={() => setUseManual(false)}
            className="mt-4 text-blue-500 text-sm underline"
          >
            カメラスキャンに戻る
          </button>
        </div>
      )}
    </div>
  );
}
