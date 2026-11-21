import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  Dices,
  History,
  RotateCcw,
  Trash2,
  UserMinus,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { DrawHistoryItem, Student } from '../types/classroom';
import { soundEngine } from '../utils/sound';

interface RandomPickerStageProps {
  students: Student[];
  onMarkAbsent: (studentId: string) => void;
  onOpenImport: () => void;
}

export const RandomPickerStage: React.FC<RandomPickerStageProps> = ({
  students,
  onMarkAbsent,
  onOpenImport,
}) => {
  const [allowRepeat, setAllowRepeat] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [displayStudent, setDisplayStudent] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [drawnIds, setDrawnIds] = useState<string[]>([]);
  const [history, setHistory] = useState<DrawHistoryItem[]>([]);

  const timerRef = useRef<number | null>(null);
  const stageCardRef = useRef<HTMLDivElement>(null);

  const activeStudents = useMemo(
    () => students.filter((s) => s.active),
    [students]
  );

  // Clean up drawnIds if students were removed
  useEffect(() => {
    const validIds = new Set(activeStudents.map((s) => s.id));
    setDrawnIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [activeStudents]);

  const eligibleStudents = useMemo(() => {
    if (allowRepeat) return activeStudents;
    const drawnSet = new Set(drawnIds);
    return activeStudents.filter((s) => !drawnSet.has(s.id));
  }, [activeStudents, allowRepeat, drawnIds]);

  const clearSpinTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearSpinTimer();
  }, [clearSpinTimer]);

  const fireCelebration = useCallback(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    let originX = 0.55;
    let originY = 0.45;
    if (stageCardRef.current) {
      const rect = stageCardRef.current.getBoundingClientRect();
      originX = (rect.left + rect.width / 2) / window.innerWidth;
      originY = (rect.top + rect.height / 2) / window.innerHeight;
    }

    confetti({
      particleCount: 55,
      spread: 68,
      startVelocity: 28,
      ticks: 130,
      origin: { x: originX, y: originY },
      colors: ['#2563EB', '#059669', '#D97706', '#7C3AED', '#0EA5E9'],
      disableForReducedMotion: true,
    });
  }, []);

  const finalizeSelection = useCallback(
    (winner: Student) => {
      setIsSpinning(false);
      setDisplayStudent(winner);
      setSelectedStudent(winner);

      if (!allowRepeat) {
        setDrawnIds((prev) => (prev.includes(winner.id) ? prev : [...prev, winner.id]));
      }

      setHistory((prev) => [
        {
          id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          studentId: winner.id,
          name: winner.name,
          seatNo: winner.seatNo,
          drawnAt: Date.now(),
          round: prev.length + 1,
        },
        ...prev,
      ]);

      if (soundEnabled) {
        soundEngine.playWin();
      }
      fireCelebration();
    },
    [allowRepeat, fireCelebration, soundEnabled]
  );

  const handleDraw = useCallback(() => {
    if (isSpinning || eligibleStudents.length === 0) return;

    soundEngine.unlock();
    clearSpinTimer();

    const winnerIndex = Math.floor(Math.random() * eligibleStudents.length);
    const winner = eligibleStudents[winnerIndex];

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced || activeStudents.length <= 1) {
      finalizeSelection(winner);
      return;
    }

    setIsSpinning(true);
    setSelectedStudent(null);

    const totalSteps = 26;
    let step = 0;
    let lastPreviewId = displayStudent?.id ?? '';

    const runStep = () => {
      step += 1;
      const progress = step / totalSteps;

      if (step >= totalSteps) {
        finalizeSelection(winner);
        return;
      }

      // Pick a preview candidate from active students (avoiding consecutive identical name)
      const pool = activeStudents.length > 1 ? activeStudents : eligibleStudents;
      let candidate = pool[Math.floor(Math.random() * pool.length)];
      if (pool.length > 1 && candidate.id === lastPreviewId) {
        const altIndex = (pool.findIndex((s) => s.id === candidate.id) + 1) % pool.length;
        candidate = pool[altIndex];
      }
      lastPreviewId = candidate.id;
      setDisplayStudent(candidate);

      if (soundEnabled) {
        soundEngine.playTick(progress);
      }

      // Ease-out delay curve: fast spin at start (~42ms), dramatic slowdown at end (~290ms)
      const delay = Math.round(42 + Math.pow(progress, 2.7) * 260);
      timerRef.current = window.setTimeout(runStep, delay);
    };

    runStep();
  }, [
    activeStudents,
    clearSpinTimer,
    displayStudent?.id,
    eligibleStudents,
    finalizeSelection,
    isSpinning,
    soundEnabled,
  ]);

  const handleResetPool = () => {
    clearSpinTimer();
    setIsSpinning(false);
    setDrawnIds([]);
    setSelectedStudent(null);
    setDisplayStudent(null);
  };

  const handleSkipAbsent = () => {
    if (!selectedStudent) return;
    const targetId = selectedStudent.id;
    onMarkAbsent(targetId);
    setSelectedStudent(null);
    setDisplayStudent(null);
    setHistory((prev) => prev.filter((item) => item.studentId !== targetId));
  };

  const poolExhausted = !allowRepeat && activeStudents.length > 0 && eligibleStudents.length === 0;

  return (
    <div className="space-y-6">
      {/* Control Deck */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Repeat vs No-Repeat Segmented Control */}
          <div
            className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/80"
            role="group"
            aria-label="抽取模式設定"
          >
            <button
              type="button"
              disabled={isSpinning}
              onClick={() => setAllowRepeat(false)}
              className={`px-3.5 py-1.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                !allowRepeat
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              不重複抽取
            </button>
            <button
              type="button"
              disabled={isSpinning}
              onClick={() => setAllowRepeat(true)}
              className={`px-3.5 py-1.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                allowRepeat
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              可重複抽取
            </button>
          </div>

          {/* Unboxed Status Metadata */}
          <div className="text-sm text-slate-600 tabular-nums">
            {allowRepeat ? (
              <span>出席名單共 {activeStudents.length} 位</span>
            ) : (
              <span>
                待抽{' '}
                <strong className="text-slate-900 font-semibold">
                  {eligibleStudents.length}
                </strong>{' '}
                / {activeStudents.length} 位
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {!allowRepeat && drawnIds.length > 0 && (
            <button
              type="button"
              disabled={isSpinning}
              onClick={handleResetPool}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
              重置抽籤池
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              setSoundEnabled((prev) => !prev);
            }}
            aria-pressed={soundEnabled}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              soundEnabled
                ? 'bg-blue-50/80 border-blue-200 text-blue-700 hover:bg-blue-100/70'
                : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
            {soundEnabled ? '音效開啟' : '靜音'}
          </button>
        </div>
      </div>

      {/* Main Draw Spotlight Stage */}
      <div
        ref={stageCardRef}
        className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 flex flex-col items-center justify-center text-center min-h-[340px]"
      >
        {activeStudents.length === 0 ? (
          <div className="max-w-md space-y-4">
            <h3 className="text-xl font-bold text-slate-900">目前沒有可抽取的出席學生</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              請在左側匯入或貼上學生名單，或確認學生是否已勾選為出席狀態。
            </p>
            <button
              type="button"
              onClick={onOpenImport}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              匯入學生名單
            </button>
          </div>
        ) : poolExhausted ? (
          <div className="max-w-md space-y-4">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900">
              本輪 {activeStudents.length} 位學生皆已抽完
            </h3>
            <p className="text-sm text-slate-500">
              您可以重置抽籤池進行新一輪不重複抽籤，或切換為「可重複抽取」模式。
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleResetPool}
                className="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
                重置抽籤池，開始新一輪
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-xl space-y-8">
            {/* Stage Status Kicker (Unboxed text) */}
            <div className="text-xs font-semibold tracking-wide text-slate-500">
              {isSpinning
                ? '正在隨機抽取候選名單...'
                : selectedStudent
                  ? '本輪抽出學生'
                  : allowRepeat
                    ? '可重複抽取模式 · 準備就緒'
                    : '不重複抽取模式 · 準備就緒'}
            </div>

            {/* Name Display Slot */}
            <div
              className={`relative rounded-2xl border px-6 py-10 sm:py-12 transition-colors duration-200 ${
                selectedStudent && !isSpinning
                  ? 'border-blue-500 bg-blue-50/40'
                  : isSpinning
                    ? 'border-slate-300 bg-slate-50'
                    : 'border-slate-200 bg-slate-50/60'
              }`}
            >
              <AnimatePresence mode="wait">
                {displayStudent ? (
                  <motion.div
                    key={displayStudent.id + (isSpinning ? '-spin' : '-final')}
                    initial={
                      isSpinning
                        ? { opacity: 0.65, y: 8, scale: 0.98 }
                        : { opacity: 0, scale: 0.9, y: 10 }
                    }
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0.5, y: -8 }}
                    transition={
                      isSpinning
                        ? { duration: 0.06, ease: 'linear' }
                        : { type: 'spring', stiffness: 360, damping: 22 }
                    }
                    className="space-y-2"
                  >
                    {displayStudent.seatNo && (
                      <div
                        className={`font-mono text-sm font-medium tabular-nums ${
                          selectedStudent && !isSpinning ? 'text-blue-700' : 'text-slate-500'
                        }`}
                      >
                        座號 {displayStudent.seatNo}
                      </div>
                    )}
                    <div
                      className={`font-bold tracking-tight text-slate-900 break-words ${
                        displayStudent.name.length > 8
                          ? 'text-3xl sm:text-4xl'
                          : 'text-4xl sm:text-6xl'
                      }`}
                    >
                      {displayStudent.name}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle-prompt"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-2 py-2"
                  >
                    <div className="text-2xl sm:text-3xl font-bold text-slate-400">
                      點擊下方按鈕開始抽籤
                    </div>
                    <div className="text-sm text-slate-400 tabular-nums">
                      目前候選池共有 {eligibleStudents.length} 位學生
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Primary Draw Actions */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleDraw}
                disabled={isSpinning || eligibleStudents.length === 0}
                className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 text-base font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition-all whitespace-nowrap shrink-0"
              >
                <Dices className={`w-5 h-5 ${isSpinning ? 'animate-spin' : ''}`} />
                {isSpinning
                  ? '抽籤進行中...'
                  : selectedStudent
                    ? '抽下一位學生'
                    : '開始隨機抽籤'}
              </button>

              {selectedStudent && !isSpinning && (
                <button
                  type="button"
                  onClick={handleSkipAbsent}
                  className="inline-flex items-center gap-1.5 px-4 py-3.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  <UserMinus className="w-4 h-4 text-slate-500" />
                  標記缺席並略過
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lower Two-Column Details: Candidate Pool & Draw History */}
      {activeStudents.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Candidate Pool Visualization */}
          <section className="xl:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">抽籤候選池狀態</h3>
              <span className="text-xs text-slate-500 tabular-nums">
                {allowRepeat
                  ? `全體 ${activeStudents.length} 位皆可重複抽中`
                  : `剩餘 ${eligibleStudents.length} 位 · 已抽 ${drawnIds.length} 位`}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {activeStudents.map((student) => {
                const isDrawn = !allowRepeat && drawnIds.includes(student.id);
                const isJustPicked = selectedStudent?.id === student.id && !isSpinning;

                return (
                  <div
                    key={student.id}
                    className={`flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg border text-xs transition-colors ${
                      isJustPicked
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold'
                        : isDrawn
                          ? 'border-slate-100 bg-slate-50 text-slate-400'
                          : 'border-slate-200 bg-white text-slate-800 font-medium'
                    }`}
                  >
                    <span className={`truncate ${isDrawn && !isJustPicked ? 'line-through' : ''}`}>
                      {student.name}
                    </span>
                    {isDrawn && (
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-label="已抽中" />
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Draw History */}
          <section className="xl:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-bold text-slate-900">抽籤紀錄</h3>
                <span className="text-xs text-slate-500 tabular-nums">
                  （{history.length} 筆）
                </span>
              </div>

              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => setHistory([])}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600 transition-colors whitespace-nowrap shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  清除紀錄
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                尚無抽籤紀錄，點擊「開始隨機抽籤」後將依序顯示於此。
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
                {history.map((item) => {
                  const time = new Date(item.drawnAt);
                  const timeLabel = `${String(time.getHours()).padStart(2, '0')}:${String(
                    time.getMinutes()
                  ).padStart(2, '0')}:${String(time.getSeconds()).padStart(2, '0')}`;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-xs text-slate-400 tabular-nums w-7 shrink-0">
                          #{String(item.round).padStart(2, '0')}
                        </span>
                        <span className="font-semibold text-slate-800 truncate">
                          {item.name}
                        </span>
                        {item.seatNo && (
                          <span className="text-xs text-slate-400 font-mono tabular-nums shrink-0">
                            ({item.seatNo})
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-xs text-slate-400 tabular-nums shrink-0">
                        {timeLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
