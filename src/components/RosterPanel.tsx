import React, { useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { Student } from '../types/classroom';

interface RosterPanelProps {
  students: Student[];
  onOpenImport: (mode: 'paste' | 'csv') => void;
  onLoadSample: () => void;
  onAddStudent: (name: string) => void;
  onToggleActive: (id: string) => void;
  onToggleAllActive: (active: boolean) => void;
  onRemoveStudent: (id: string) => void;
  onClearAll: () => void;
}

export const RosterPanel: React.FC<RosterPanelProps> = ({
  students,
  onOpenImport,
  onLoadSample,
  onAddStudent,
  onToggleActive,
  onToggleAllActive,
  onRemoveStudent,
  onClearAll,
}) => {
  const [newName, setNewName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const activeCount = useMemo(
    () => students.filter((s) => s.active).length,
    [students]
  );

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.seatNo && s.seatNo.toLowerCase().includes(q))
    );
  }, [students, searchQuery]);

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onAddStudent(trimmed);
    setNewName('');
  };

  return (
    <aside className="bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden lg:h-[calc(100vh-112px)] lg:sticky lg:top-20">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900">班級名單</h2>
          <div className="text-xs text-slate-500 tabular-nums">
            <span>共 {students.length} 位</span>
            {students.length > 0 && (
              <>
                <span className="mx-1.5" aria-hidden="true">
                  ·
                </span>
                <span className="text-slate-700 font-medium">
                  出席 {activeCount} 位
                </span>
              </>
            )}
          </div>
        </div>

        {/* Import / Sample Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onOpenImport('csv')}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
            上傳 CSV
          </button>
          <button
            type="button"
            onClick={() => onOpenImport('paste')}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-blue-600" />
            貼上名單
          </button>
        </div>

        {/* Quick Add Single Student */}
        <form onSubmit={handleQuickAdd} className="flex items-center gap-1.5">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="輸入單筆學生姓名..."
            aria-label="快速新增學生姓名"
            className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            新增
          </button>
        </form>

        {/* Search & Utility Bar */}
        {students.length > 0 && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜尋座號或姓名"
                aria-label="搜尋名單"
                className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onToggleAllActive(activeCount < students.length)}
                title={activeCount < students.length ? '全部設為出席' : '全部設為缺席'}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                aria-label={activeCount < students.length ? '全部設為出席' : '全部設為缺席'}
              >
                {activeCount < students.length ? (
                  <UserCheck className="w-3.5 h-3.5" />
                ) : (
                  <UserX className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={onClearAll}
                title="清空名單"
                className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                aria-label="清空名單"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Student List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {students.length === 0 ? (
          <div className="p-6 text-center space-y-3">
            <p className="text-sm font-medium text-slate-700">尚未建立班級名單</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              請點擊上方「上傳 CSV」或「貼上名單」，也可以先載入範例名單體驗抽籤與分組功能。
            </p>
            <button
              type="button"
              onClick={onLoadSample}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              載入 24 人範例名單
            </button>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            找不到符合「{searchQuery}」的學生
          </div>
        ) : (
          filteredStudents.map((student, idx) => (
            <div
              key={student.id}
              className={`group flex items-center justify-between gap-2 px-4 py-2 text-sm transition-colors hover:bg-slate-50 ${
                student.active ? 'text-slate-900' : 'text-slate-400 bg-slate-50/50'
              }`}
            >
              <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={student.active}
                  onChange={() => onToggleActive(student.id)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 shrink-0"
                />
                <span className="font-mono text-xs text-slate-400 tabular-nums w-6 shrink-0">
                  {student.seatNo || String(idx + 1).padStart(2, '0')}
                </span>
                <span
                  className={`truncate font-medium ${
                    student.active ? 'text-slate-800' : 'line-through text-slate-400'
                  }`}
                >
                  {student.name}
                </span>
              </label>

              <div className="flex items-center gap-1 shrink-0">
                {!student.active && (
                  <span className="text-[11px] text-slate-400 mr-1">缺席</span>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveStudent(student.id)}
                  className="p-1 rounded text-slate-400 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-600 hover:bg-red-50 transition-all"
                  aria-label={`移除 ${student.name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Quick Sample Trigger when populated */}
      {students.length > 0 && (
        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500">
          <span>勾選代表參與抽籤與分組</span>
          <button
            type="button"
            onClick={onLoadSample}
            className="text-blue-600 hover:text-blue-700 font-medium hover:underline whitespace-nowrap shrink-0"
          >
            重載範例名單
          </button>
        </div>
      )}
    </aside>
  );
};
