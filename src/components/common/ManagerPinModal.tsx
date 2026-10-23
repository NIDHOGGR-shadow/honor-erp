/**
 * Honor — Manager PIN Elevation Modal
 * Required when sales attendants exceed discount caps (5% or ₦5,000)
 * or when inventory staff submit stock adjustments.
 */

import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { ShieldCheck, X, AlertCircle } from "lucide-react";

interface ManagerPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (managerName: string, managerId: string) => void;
  title: string;
  reason: string;
}

export const ManagerPinModal: React.FC<ManagerPinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title,
  reason,
}) => {
  const { verifyManagerPin } = useApp();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleDigitClick = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError("");
      if (nextPin.length === 4) {
        verify(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError("");
  };

  const verify = (pinToTest: string) => {
    const approver = verifyManagerPin(pinToTest);
    if (approver) {
      onSuccess(approver.name, approver.id);
      setPin("");
      setError("");
      onClose();
    } else {
      setError("Invalid Manager PIN. Please try again.");
      setPin("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 4) {
      verify(pin);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200/80 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/70">
          <div className="flex items-center gap-2 text-zinc-900">
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900">{title}</h3>
              <p className="text-xs text-zinc-500">
                Manager Elevation Required
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 text-center space-y-4">
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-left">
            <div className="text-[11px] font-semibold text-amber-900 uppercase tracking-wider">
              Reason for Approval
            </div>
            <div className="text-xs text-amber-800 mt-0.5">{reason}</div>
            <div className="text-[10px] text-amber-600 mt-1">
              Hint: Store Manager PIN is <strong>1234</strong> (Chioma Adeyemi)
              or Owner <strong>9988</strong>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-2">
              Enter 4-Digit Manager PIN
            </label>
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-11 h-12 rounded-xl border-2 flex items-center justify-center text-lg font-bold transition-all ${
                    pin.length > idx
                      ? "border-emerald-700 bg-emerald-50 text-emerald-900"
                      : "border-zinc-200 bg-zinc-50 text-zinc-400"
                  }`}
                >
                  {pin.length > idx ? "●" : ""}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-rose-600">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto pt-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigitClick(digit)}
                className="h-11 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-base font-semibold text-zinc-800 active:scale-95 transition-all"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPin("")}
              className="h-11 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-semibold text-zinc-600 active:scale-95 transition-all"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleDigitClick("0")}
              className="h-11 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-base font-semibold text-zinc-800 active:scale-95 transition-all"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="h-11 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-semibold text-zinc-600 active:scale-95 transition-all"
            >
              ⌫
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
