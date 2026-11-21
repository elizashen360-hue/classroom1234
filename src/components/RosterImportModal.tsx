import React, { useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, ClipboardPaste, Upload, X, AlertCircle, Check } from 'lucide-react';
import {
  parseCsvContent,
  ParsedCsvPreview,
  parsePastedNames,
  readTextFileSmart,
} from '../utils/csvParser';

interface RosterImportModalProps {
  isOpen: boolean;
  initialMode?: 'paste' | 'csv';
  existingCount: number;
  onClose: () => void;
  onImport: (
    entries: Array<{ name: string; seatNo?: string }>,
    strategy: 'replace' | 'append'
  ) => void;
}

export const RosterImportModal: React.FC<RosterImportModalProps> = ({
  isOpen,
  initialMode = 'paste',
  existingCount,
  onClose,
  onImport,
}) => {
  const [mode, setMode] = useState<'paste' | 'csv'>(initialMode);
  const [pasteText, setPasteText] = useState('');
  const [deduplicate, setDeduplicate] = useState(true);
  const [strategy, setStrategy] = useState<'replace' | 'append'>(
    existingCount > 0 ? 'replace' : 'replace'
  );

  // CSV state
  const [fileName, setFileName] = useState<string>('');
  const [csvPreview, setCsvPreview] = useState<ParsedCsvPreview | null>(null);
  const [nameCol, setNameCol] = useState<number>(0);
  const [seatCol, setSeatCol] = useState<number | null>(null);
  const [hasHeader, setHasHeader] = useState<boolean>(true);
  const [rawCsvText, setRawCsvText] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg('');
    }
  }, [isOpen, initialMode]);

  const pastedPreview = useMemo(() => {
    return parsePastedNames(pasteText, deduplicate);
  }, [pasteText, deduplicate]);

  const csvExtractedEntries = useMemo(() => {
    if (!csvPreview) return [];
    const sourceRows = hasHeader
      ? csvPreview.hasHeader
        ? csvPreview.rows
        : csvPreview.rows.slice(1)
      : csvPreview.hasHeader
        ? [csvPreview.headers, ...csvPreview.rows]
        : csvPreview.rows;

    const result: Array<{ name: string; seatNo?: string }> = [];
    const seen = new Set<string>();

    for (const row of sourceRows) {
      const name = (row[nameCol] ?? '').trim();
      if (!name) continue;
      if (deduplicate) {
        if (seen.has(name)) continue;
        seen.add(name);
      }
      const seatRaw = seatCol !== null ? (row[seatCol] ?? '').trim() : '';
      result.push({
        name,
        seatNo: seatRaw ? seatRaw : undefined,
      });
    }
    return result;
  }, [csvPreview, nameCol, seatCol, hasHeader, deduplicate]);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    setErrorMsg('');
    try {
      const text = await readTextFileSmart(file);
      const parsed = parseCsvContent(text);
      if (parsed.rows.length === 0 && parsed.headers.length === 0) {
        setErrorMsg('檔案內容為空，請確認檔案格式是否正確。');
        return;
      }
      setFileName(file.name);
      setRawCsvText(text);
      setCsvPreview(parsed);
      setNameCol(parsed.suggestedNameCol);
      setSeatCol(parsed.suggestedSeatCol);
      setHasHeader(parsed.hasHeader);
    } catch {
      setErrorMsg('讀取檔案失敗，請確認檔案為 CSV 或純文字格式。');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const activeEntries = mode === 'paste' ? pastedPreview : csvExtractedEntries;

  const handleConfirm = () => {
    if (activeEntries.length === 0) {
      setErrorMsg('目前沒有可匯入的學生姓名，請先貼上名單或上傳有效檔案。');
      return;
    }
    onImport(activeEntries, strategy);
    setPasteText('');
    setCsvPreview(null);
    setFileName('');
    setRawCsvText('');
    onClose();
  };

  const displayPreviewRows = useMemo(() => {
    if (!csvPreview) return [];
    const rows = hasHeader
      ? csvPreview.hasHeader
        ? csvPreview.rows
        : csvPreview.rows.slice(1)
      : csvPreview.hasHeader
        ? [csvPreview.headers, ...csvPreview.rows]
        : csvPreview.rows;
    return rows.slice(0, 5);
  }, [csvPreview, hasHeader]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="import-modal-title" className="text-lg font-bold text-slate-900">
              匯入班級學生名單
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              支援直接貼上文字名單，或上傳 Excel 匯出的 CSV 檔案（自動支援 UTF-8 與 Big5 編碼）
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600"
            aria-label="關閉匯入視窗"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switch Tabs */}
        <div className="px-6 pt-4 pb-2 border-b border-slate-100 bg-slate-50/60">
          <div className="inline-flex p-1 bg-slate-200/70 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => {
                setMode('paste');
                setErrorMsg('');
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                mode === 'paste'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClipboardPaste className="w-4 h-4" />
              貼上學生姓名
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('csv');
                setErrorMsg('');
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                mode === 'csv'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              上傳 CSV / 文字檔
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {mode === 'paste' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="paste-roster-textarea" className="text-sm font-semibold text-slate-800">
                  學生姓名內容
                </label>
                <span className="text-xs text-slate-500 tabular-nums">
                  已識別 {pastedPreview.length} 位學生
                </span>
              </div>
              <textarea
                id="paste-roster-textarea"
                value={pasteText}
                onChange={(e) => {
                  setPasteText(e.target.value);
                  setErrorMsg('');
                }}
                rows={8}
                placeholder={'請直接從 Excel、Google 試算表或記事本貼上名單。\n支援每行一位姓名，或以逗號、頓號分隔：\n\n陳思妤\n林子軒\n03 張家豪\n李宜蓁、王柏翰'}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 leading-relaxed"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-blue-600 bg-blue-50/70'
                    : 'border-slate-300 hover:border-blue-500 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="mx-auto w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {fileName ? `已載入檔案：${fileName}` : '點擊選擇或拖曳 CSV / TXT 檔案至此'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  支援單欄姓名或含座號的多欄表格（自動辨識 UTF-8 與繁體中文 Big5 編碼）
                </p>
              </div>

              {csvPreview && rawCsvText && (
                <div className="space-y-4 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        學生姓名欄位
                      </label>
                      <select
                        value={nameCol}
                        onChange={(e) => setNameCol(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                      >
                        {csvPreview.headers.map((h, idx) => (
                          <option key={idx} value={idx}>
                            {hasHeader ? h : `第 ${idx + 1} 欄`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        座號／編號欄位（選填）
                      </label>
                      <select
                        value={seatCol === null ? 'none' : String(seatCol)}
                        onChange={(e) =>
                          setSeatCol(e.target.value === 'none' ? null : Number(e.target.value))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                      >
                        <option value="none">不匯入座號（自動編號）</option>
                        {csvPreview.headers.map((h, idx) => (
                          <option key={idx} value={idx}>
                            {hasHeader ? h : `第 ${idx + 1} 欄`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <label className="inline-flex items-center gap-2 py-2 text-sm text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={hasHeader}
                        onChange={(e) => setHasHeader(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                      />
                      第一列為標題列
                    </label>
                  </div>

                  {/* Preview Table */}
                  <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <tr>
                          <th className="px-3 py-2 font-semibold w-24">座號</th>
                          <th className="px-3 py-2 font-semibold">匯入姓名預覽</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {displayPreviewRows.map((row, idx) => (
                          <tr key={idx} className="text-slate-800">
                            <td className="px-3 py-2 font-mono tabular-nums text-slate-500">
                              {seatCol !== null
                                ? row[seatCol] || '—'
                                : String(idx + 1).padStart(2, '0')}
                            </td>
                            <td className="px-3 py-2 font-medium">{row[nameCol] || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {csvExtractedEntries.length > 5 && (
                      <div className="px-3 py-2 text-xs text-slate-500 bg-slate-50/70 border-t border-slate-100 tabular-nums">
                        僅顯示前 5 筆預覽，共將匯入 {csvExtractedEntries.length} 位學生
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Common Options */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-100">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={deduplicate}
                onChange={(e) => setDeduplicate(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              自動過濾重複姓名
            </label>

            {existingCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">匯入方式：</span>
                <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setStrategy('replace')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      strategy === 'replace'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    取代現有名單
                  </button>
                  <button
                    type="button"
                    onClick={() => setStrategy('append')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      strategy === 'append'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    加入現有名單
                  </button>
                </div>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <span className="text-xs text-slate-500 tabular-nums">
            將匯入 <strong className="text-slate-800">{activeEntries.length}</strong> 位學生
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={activeEntries.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
            >
              <Check className="w-4 h-4" />
              確認匯入名單
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
