import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeftRight,
  Download,
  FileText,
  Image as ImageIcon,
  Minus,
  Plus,
  Printer,
  Shuffle,
  Users,
} from 'lucide-react';
import { GROUP_PALETTES } from '../data/sampleStudents';
import { GroupResult, RemainderStrategy, Student } from '../types/classroom';
import { exportGroupsToPdf, exportGroupsToPng } from '../utils/exportGroups';
import { soundEngine } from '../utils/sound';

interface AutoGroupingStageProps {
  students: Student[];
  onOpenImport: () => void;
}

function fisherYatesShuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function computeGroupDistribution(
  total: number,
  groupSize: number,
  strategy: RemainderStrategy
): number[] {
  if (total <= 0) return [];
  if (total <= groupSize) return [total];

  const baseCount = Math.floor(total / groupSize);
  const remainder = total % groupSize;

  if (remainder === 0) {
    return Array.from({ length: baseCount }, () => groupSize);
  }

  if (strategy === 'new_group') {
    return [...Array.from({ length: baseCount }, () => groupSize), remainder];
  }

  // Distribute remainder evenly across existing groups
  const sizes = Array.from({ length: baseCount }, () => groupSize);
  for (let i = 0; i < remainder; i++) {
    sizes[i % baseCount] += 1;
  }
  return sizes;
}

export const AutoGroupingStage: React.FC<AutoGroupingStageProps> = ({
  students,
  onOpenImport,
}) => {
  const [groupSize, setGroupSize] = useState<number>(4);
  const [remainderStrategy, setRemainderStrategy] =
    useState<RemainderStrategy>('distribute');
  const [activityTitle, setActivityTitle] = useState<string>('課堂活動分組名單');
  const [groups, setGroups] = useState<GroupResult[]>([]);
  const [swapSelection, setSwapSelection] = useState<{
    groupId: string;
    studentId: string;
    studentName: string;
  } | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<'png' | 'pdf' | null>(null);
  const [exportError, setExportError] = useState<string>('');
  const [shuffleKey, setShuffleKey] = useState<number>(0);

  const activeStudents = useMemo(
    () => students.filter((s) => s.active),
    [students]
  );

  const plannedSizes = useMemo(
    () =>
      computeGroupDistribution(
        activeStudents.length,
        groupSize,
        remainderStrategy
      ),
    [activeStudents.length, groupSize, remainderStrategy]
  );

  const planSummaryText = useMemo(() => {
    if (activeStudents.length === 0) return '尚無出席學生';
    if (plannedSizes.length === 0) return '';
    const countsBySize = new Map<number, number>();
    plannedSizes.forEach((sz) => {
      countsBySize.set(sz, (countsBySize.get(sz) ?? 0) + 1);
    });
    const breakdown = Array.from(countsBySize.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([sz, count]) => `${count} 組 ${sz} 人`)
      .join('、');
    return `共 ${activeStudents.length} 位出席學生 · 分為 ${plannedSizes.length} 組（${breakdown}）`;
  }, [activeStudents.length, plannedSizes]);

  const handleGenerateGroups = () => {
    if (activeStudents.length === 0) return;

    soundEngine.unlock();
    soundEngine.playGroupShuffle();

    const shuffled = fisherYatesShuffle(activeStudents);
    const sizes = computeGroupDistribution(
      shuffled.length,
      groupSize,
      remainderStrategy
    );

    const newGroups: GroupResult[] = [];
    let cursor = 0;

    sizes.forEach((sz, idx) => {
      const members = shuffled.slice(cursor, cursor + sz);
      cursor += sz;
      newGroups.push({
        id: `group-${idx + 1}-${Date.now()}`,
        index: idx + 1,
        title: `第 ${idx + 1} 組`,
        palette: GROUP_PALETTES[idx % GROUP_PALETTES.length],
        members,
      });
    });

    setGroups(newGroups);
    setSwapSelection(null);
    setEditingGroupId(null);
    setExportError('');
    setShuffleKey((k) => k + 1);
  };

  const handleStudentClick = (groupId: string, student: Student) => {
    if (!swapSelection) {
      setSwapSelection({
        groupId,
        studentId: student.id,
        studentName: student.name,
      });
      return;
    }

    if (swapSelection.studentId === student.id) {
      setSwapSelection(null);
      return;
    }

    // Swap students between groups (or within same group)
    setGroups((prev) => {
      const sourceGroup = prev.find((g) => g.id === swapSelection.groupId);
      const targetGroup = prev.find((g) => g.id === groupId);
      if (!sourceGroup || !targetGroup) return prev;

      const sourceMember = sourceGroup.members.find(
        (m) => m.id === swapSelection.studentId
      );
      const targetMember = targetGroup.members.find((m) => m.id === student.id);
      if (!sourceMember || !targetMember) return prev;

      return prev.map((g) => {
        if (g.id === sourceGroup.id && g.id === targetGroup.id) {
          return {
            ...g,
            members: g.members.map((m) => {
              if (m.id === sourceMember.id) return targetMember;
              if (m.id === targetMember.id) return sourceMember;
              return m;
            }),
          };
        }
        if (g.id === sourceGroup.id) {
          return {
            ...g,
            members: g.members.map((m) =>
              m.id === sourceMember.id ? targetMember : m
            ),
          };
        }
        if (g.id === targetGroup.id) {
          return {
            ...g,
            members: g.members.map((m) =>
              m.id === targetMember.id ? sourceMember : m
            ),
          };
        }
        return g;
      });
    });

    setSwapSelection(null);
  };

  const handleUpdateGroupTitle = (groupId: string, newTitle: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, title: newTitle } : g))
    );
  };

  const handleExportPng = async () => {
    if (groups.length === 0 || isExporting) return;
    setIsExporting('png');
    setExportError('');
    try {
      const total = groups.reduce((sum, g) => sum + g.members.length, 0);
      await exportGroupsToPng({
        title: activityTitle,
        groups,
        totalStudents: total,
        groupSizeSetting: groupSize,
      });
    } catch {
      setExportError('圖片匯出失敗，請稍後再試。');
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportPdf = async () => {
    if (groups.length === 0 || isExporting) return;
    setIsExporting('pdf');
    setExportError('');
    try {
      const total = groups.reduce((sum, g) => sum + g.members.length, 0);
      await exportGroupsToPdf({
        title: activityTitle,
        groups,
        totalStudents: total,
        groupSizeSetting: groupSize,
      });
    } catch {
      setExportError('PDF 匯出失敗，請稍後再試。');
    } finally {
      setIsExporting(null);
    }
  };

  const handleBrowserPrint = () => {
    window.print();
  };

  const totalGroupedStudents = useMemo(
    () => groups.reduce((sum, g) => sum + g.members.length, 0),
    [groups]
  );

  return (
    <div className="space-y-6">
      {/* Configuration & Export Toolbar (hidden on browser print) */}
      <div className="no-print bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          {/* Title Input */}
          <div className="lg:col-span-4">
            <label
              htmlFor="group-activity-title"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              分組標題（將顯示於匯出圖片與 PDF）
            </label>
            <input
              id="group-activity-title"
              type="text"
              value={activityTitle}
              onChange={(e) => setActivityTitle(e.target.value)}
              placeholder="例如：自然科學實驗分組"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          {/* Group Size Stepper + Presets */}
          <div className="lg:col-span-4">
            <span className="block text-xs font-semibold text-slate-700 mb-1.5">
              設定每組人數
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center border border-slate-300 rounded-xl bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setGroupSize((s) => Math.max(2, s - 1))}
                  disabled={groupSize <= 2}
                  aria-label="減少每組人數"
                  className="p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-35 transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-3 text-sm font-bold text-slate-900 tabular-nums min-w-[3.2rem] text-center">
                  {groupSize} 人
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setGroupSize((s) =>
                      Math.min(Math.max(12, activeStudents.length), s + 1)
                    )
                  }
                  aria-label="增加每組人數"
                  className="p-2 text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="inline-flex items-center gap-1">
                {[2, 3, 4, 5, 6].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setGroupSize(preset)}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors tabular-nums whitespace-nowrap shrink-0 ${
                      groupSize === preset
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {preset}人
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Remainder Strategy */}
          <div className="lg:col-span-4">
            <span className="block text-xs font-semibold text-slate-700 mb-1.5">
              餘數人數分配方式
            </span>
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setRemainderStrategy('distribute')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                  remainderStrategy === 'distribute'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                平均併入各組
              </button>
              <button
                type="button"
                onClick={() => setRemainderStrategy('new_group')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                  remainderStrategy === 'new_group'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                餘數獨立成組
              </button>
            </div>
          </div>
        </div>

        {/* Action Row */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-slate-600 tabular-nums">{planSummaryText}</div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleGenerateGroups}
              disabled={activeStudents.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-xs transition-colors whitespace-nowrap shrink-0"
            >
              <Shuffle className="w-4 h-4" />
              {groups.length > 0 ? '重新隨機分組' : '開始自動分組'}
            </button>

            {groups.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleExportPng}
                  disabled={isExporting !== null}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  <ImageIcon className="w-4 h-4 text-blue-600" />
                  {isExporting === 'png' ? '產生圖片中...' : '匯出圖片 (PNG)'}
                </button>

                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={isExporting !== null}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  <FileText className="w-4 h-4 text-rose-600" />
                  {isExporting === 'pdf' ? '產生 PDF 中...' : '匯出 PDF'}
                </button>

                <button
                  type="button"
                  onClick={handleBrowserPrint}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors whitespace-nowrap shrink-0"
                  title="直接使用瀏覽器列印"
                >
                  <Printer className="w-4 h-4" />
                  列印
                </button>
              </>
            )}
          </div>
        </div>

        {exportError && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            {exportError}
          </div>
        )}
      </div>

      {/* Empty / Ready State or Visual Group Grid */}
      {activeStudents.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-4">
          <h3 className="text-xl font-bold text-slate-900">尚未有出席學生可分組</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            請先在左側上傳 CSV 或貼上學生姓名，再設定每組人數進行自動分組。
          </p>
          <button
            type="button"
            onClick={onOpenImport}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            匯入學生名單
          </button>
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 sm:p-14 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">
            準備為 {activeStudents.length} 位學生進行隨機分組
          </h3>
          <p className="text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
            依照目前設定，系統將隨機分為{' '}
            <strong className="text-slate-800">{plannedSizes.length}</strong>{' '}
            個小組。產生結果後可手動點擊學生對調組別，並支援一鍵匯出為高畫質圖片或列印用 PDF 檔案。
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleGenerateGroups}
              className="inline-flex items-center gap-2 px-6 py-3 text-base font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              <Shuffle className="w-4 h-4" />
              立即開始隨機分組
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Interactive Swap Hint Bar (no-print) */}
          <div className="no-print flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {swapSelection ? (
                <span className="text-blue-700 font-semibold">
                  已選取「{swapSelection.studentName}」，請再點擊任一位學生進行組別對調（或點擊本人取消）
                </span>
              ) : (
                <span>
                  提示：點擊任兩位學生可手動對調組別；點擊組別標題可自訂小組名稱
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleExportPng}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              快速下載圖片
            </button>
          </div>

          {/* Print Header (visible during browser print) */}
          <div className="hidden print:block pb-4 border-b border-slate-300 mb-6">
            <h1 className="text-2xl font-bold text-slate-900">
              {activityTitle || '課堂活動分組名單'}
            </h1>
            <p className="text-sm text-slate-600 mt-1 tabular-nums">
              共 {totalGroupedStudents} 位學生 · 分為 {groups.length} 組（設定每組 {groupSize} 人）
            </p>
          </div>

          {/* Visual Group Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {groups.map((group, idx) => (
              <motion.article
                key={`${group.id}-${shuffleKey}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: Math.min(idx * 0.035, 0.28) }}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col break-inside-avoid"
              >
                {/* Top Color Accent Bar */}
                <div className={`h-1.5 w-full ${group.palette.topBar}`} />

                {/* Card Header */}
                <div
                  className={`px-4 py-3 border-b border-slate-200/80 flex items-center justify-between gap-2 ${group.palette.headerBg}`}
                >
                  {editingGroupId === group.id ? (
                    <input
                      type="text"
                      autoFocus
                      value={group.title}
                      onChange={(e) => handleUpdateGroupTitle(group.id, e.target.value)}
                      onBlur={() => setEditingGroupId(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') {
                          setEditingGroupId(null);
                        }
                      }}
                      className="text-base font-bold text-slate-900 bg-white border border-blue-500 rounded-md px-2 py-0.5 w-full focus:outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingGroupId(group.id)}
                      title="點擊編輯組別名稱"
                      className="text-left text-base font-bold text-slate-900 hover:text-blue-700 transition-colors truncate"
                    >
                      {group.title}
                    </button>
                  )}

                  <span
                    className={`text-xs font-semibold tabular-nums whitespace-nowrap shrink-0 ${group.palette.accentText}`}
                  >
                    {group.members.length} 位成員
                  </span>
                </div>

                {/* Member List */}
                <ul className="divide-y divide-slate-100 p-1.5 flex-1">
                  {group.members.map((member, mIdx) => {
                    const isSelectedForSwap = swapSelection?.studentId === member.id;
                    return (
                      <li key={member.id}>
                        <button
                          type="button"
                          onClick={() => handleStudentClick(group.id, member)}
                          className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                            isSelectedForSwap
                              ? 'bg-blue-600 text-white'
                              : swapSelection
                                ? 'hover:bg-blue-50 text-slate-800'
                                : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`font-mono text-xs tabular-nums w-6 shrink-0 ${
                                isSelectedForSwap ? 'text-blue-100' : 'text-slate-400'
                              }`}
                            >
                              {member.seatNo || String(mIdx + 1).padStart(2, '0')}
                            </span>
                            <span className="text-sm font-medium truncate">
                              {member.name}
                            </span>
                          </div>
                          {isSelectedForSwap && (
                            <span className="text-[11px] font-semibold text-blue-100 whitespace-nowrap shrink-0">
                              待對調
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </motion.article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
