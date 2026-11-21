/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Dices, Upload, Users } from 'lucide-react';
import { AutoGroupingStage } from './components/AutoGroupingStage';
import { RandomPickerStage } from './components/RandomPickerStage';
import { RosterImportModal } from './components/RosterImportModal';
import { RosterPanel } from './components/RosterPanel';
import { createSampleStudents } from './data/sampleStudents';
import { ActiveFeature, Student } from './types/classroom';

const STORAGE_KEY = 'classroom_picker_roster_v1';

function loadInitialRoster(): Student[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return createSampleStudents();
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is Student =>
          typeof item === 'object' &&
          item !== null &&
          typeof item.id === 'string' &&
          typeof item.name === 'string'
      );
    }
  } catch {
    // Ignore corrupted storage
  }
  return createSampleStudents();
}

export default function App() {
  const [students, setStudents] = useState<Student[]>(loadInitialRoster);
  const [activeFeature, setActiveFeature] = useState<ActiveFeature>('picker');
  const [mobileShowRoster, setMobileShowRoster] = useState<boolean>(false);
  const [importModalOpen, setImportModalOpen] = useState<boolean>(false);
  const [importModalMode, setImportModalMode] = useState<'paste' | 'csv'>('paste');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
    } catch {
      // Ignore storage quota errors
    }
  }, [students]);

  const handleOpenImport = (mode: 'paste' | 'csv' = 'paste') => {
    setImportModalMode(mode);
    setImportModalOpen(true);
  };

  const handleImportEntries = (
    entries: Array<{ name: string; seatNo?: string }>,
    strategy: 'replace' | 'append'
  ) => {
    const baseIndex = strategy === 'append' ? students.length : 0;
    const timestamp = Date.now();
    const mapped: Student[] = entries.map((entry, idx) => ({
      id: `stu-${timestamp}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      name: entry.name,
      seatNo: entry.seatNo ?? String(baseIndex + idx + 1).padStart(2, '0'),
      active: true,
    }));

    setStudents((prev) => (strategy === 'append' ? [...prev, ...mapped] : mapped));
  };

  const handleLoadSample = () => {
    setStudents(createSampleStudents());
  };

  const handleAddStudent = (name: string) => {
    setStudents((prev) => [
      ...prev,
      {
        id: `stu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        seatNo: String(prev.length + 1).padStart(2, '0'),
        active: true,
      },
    ]);
  };

  const handleToggleActive = (id: string) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s))
    );
  };

  const handleToggleAllActive = (active: boolean) => {
    setStudents((prev) => prev.map((s) => ({ ...s, active })));
  };

  const handleRemoveStudent = (id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
  };

  const handleClearAll = () => {
    setStudents([]);
  };

  const handleMarkAbsent = (id: string) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, active: false } : s))
    );
  };

  const activeCount = students.filter((s) => s.active).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveFeature('picker');
            }}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            課堂點名與分組助手
          </a>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav
            className="hidden md:flex items-center gap-6"
            aria-label="主要功能導覽"
          >
            <button
              type="button"
              onClick={() => {
                setActiveFeature('picker');
                setMobileShowRoster(false);
              }}
              className={`py-5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                activeFeature === 'picker'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              隨機抽籤
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveFeature('grouping');
                setMobileShowRoster(false);
              }}
              className={`py-5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                activeFeature === 'grouping'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              自動分組
            </button>
            <button
              type="button"
              onClick={() => handleOpenImport('paste')}
              className="py-5 text-sm font-medium border-b-2 border-transparent text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              貼上名單
            </button>
            <button
              type="button"
              onClick={handleLoadSample}
              className="py-5 text-sm font-medium border-b-2 border-transparent text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              載入範例
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => handleOpenImport('csv')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="w-4 h-4" />
              上傳 CSV
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Feature + Roster Switcher */}
      <div className="no-print lg:hidden bg-white border-b border-slate-200 px-4 py-2.5">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setMobileShowRoster(false);
              setActiveFeature('picker');
            }}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              !mobileShowRoster && activeFeature === 'picker'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600'
            }`}
          >
            <Dices className="w-3.5 h-3.5" />
            隨機抽籤
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileShowRoster(false);
              setActiveFeature('grouping');
            }}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              !mobileShowRoster && activeFeature === 'grouping'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            自動分組
          </button>
          <button
            type="button"
            onClick={() => setMobileShowRoster(true)}
            className={`flex-1 inline-flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums ${
              mobileShowRoster
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600'
            }`}
          >
            名單 ({activeCount})
          </button>
        </div>
      </div>

      {/* Main Two-Zone Workspace */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[330px_1fr] xl:grid-cols-[350px_1fr] gap-6 items-start">
          {/* Left Zone: Class Roster Deck */}
          <div
            className={`no-print ${
              mobileShowRoster ? 'block' : 'hidden lg:block'
            }`}
          >
            <RosterPanel
              students={students}
              onOpenImport={handleOpenImport}
              onLoadSample={handleLoadSample}
              onAddStudent={handleAddStudent}
              onToggleActive={handleToggleActive}
              onToggleAllActive={handleToggleAllActive}
              onRemoveStudent={handleRemoveStudent}
              onClearAll={handleClearAll}
            />
          </div>

          {/* Right Zone: Interactive Classroom Stage */}
          <section
            className={`min-w-0 ${
              mobileShowRoster ? 'hidden lg:block' : 'block'
            }`}
          >
            {/* Stage Header */}
            <div className="no-print mb-5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 text-balance">
                {activeFeature === 'picker' ? '課堂隨機抽籤' : '課堂自動分組'}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {activeFeature === 'picker'
                  ? '隨機抽出一位出席學生，支援可重複／不重複模式與動畫音效'
                  : '自訂每組人數一鍵隨機分組，並可匯出為高畫質圖片或 PDF 列印'}
              </p>
            </div>

            {activeFeature === 'picker' ? (
              <RandomPickerStage
                students={students}
                onMarkAbsent={handleMarkAbsent}
                onOpenImport={() => handleOpenImport('paste')}
              />
            ) : (
              <AutoGroupingStage
                students={students}
                onOpenImport={() => handleOpenImport('paste')}
              />
            )}
          </section>
        </div>
      </main>

      {/* Import CSV / Paste Modal */}
      <RosterImportModal
        isOpen={importModalOpen}
        initialMode={importModalMode}
        existingCount={students.length}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImportEntries}
      />
    </div>
  );
}
