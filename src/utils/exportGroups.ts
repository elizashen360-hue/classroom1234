import { jsPDF } from 'jspdf';
import { GroupResult } from '../types/classroom';

interface ExportOptions {
  title: string;
  groups: GroupResult[];
  totalStudents: number;
  groupSizeSetting: number;
}

const FONT_STACK =
  '"Plus Jakarta Sans", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "Heiti TC", sans-serif';

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function formatDateLabel(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

function measureCardHeight(memberCount: number): number {
  const headerH = 52;
  const paddingY = 14;
  const rowH = 34;
  return headerH + paddingY * 2 + Math.max(1, memberCount) * rowH;
}

function drawGroupCard(
  ctx: CanvasRenderingContext2D,
  group: GroupResult,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const radius = 12;

  // Card background
  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#E2E8F0';
  ctx.stroke();

  // Clip inside card for top color accent and header
  ctx.clip();

  // Header tint
  ctx.fillStyle = group.palette.hexBg;
  ctx.fillRect(x, y, w, 52);

  // Top 4px color bar
  ctx.fillStyle = group.palette.hexBar;
  ctx.fillRect(x, y, w, 5);

  // Header divider
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(x, y + 51, w, 1);

  // Group title
  ctx.fillStyle = '#0F172A';
  ctx.font = `700 18px ${FONT_STACK}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(group.title, x + 18, y + 29, w - 90);

  // Member count label (unboxed clean text)
  ctx.fillStyle = group.palette.hexText;
  ctx.font = `600 13px ${FONT_STACK}`;
  ctx.textAlign = 'right';
  ctx.fillText(`${group.members.length} 位成員`, x + w - 18, y + 29);

  // Member rows
  const startY = y + 52 + 14;
  const rowH = 34;
  group.members.forEach((member, idx) => {
    const rowCenterY = startY + idx * rowH + rowH / 2;

    if (idx > 0) {
      ctx.fillStyle = '#F1F5F9';
      ctx.fillRect(x + 16, startY + idx * rowH, w - 32, 1);
    }

    // Index / seat number
    ctx.fillStyle = '#64748B';
    ctx.font = `500 13px "IBM Plex Mono", ${FONT_STACK}`;
    ctx.textAlign = 'left';
    const seatLabel = member.seatNo
      ? member.seatNo
      : String(idx + 1).padStart(2, '0');
    ctx.fillText(seatLabel, x + 18, rowCenterY);

    // Student name
    ctx.fillStyle = '#0F172A';
    ctx.font = `500 16px ${FONT_STACK}`;
    ctx.fillText(member.name, x + 54, rowCenterY, w - 72);
  });

  ctx.restore();
}

function drawPageHeader(
  ctx: CanvasRenderingContext2D,
  width: number,
  paddingX: number,
  title: string,
  subtitle: string,
  pageInfo?: string
): number {
  const topY = 48;

  ctx.fillStyle = '#0F172A';
  ctx.font = `700 28px ${FONT_STACK}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(title || '課堂自動分組名單', paddingX, topY, width - paddingX * 2 - 140);

  ctx.fillStyle = '#475569';
  ctx.font = `500 14px ${FONT_STACK}`;
  ctx.fillText(subtitle, paddingX, topY + 38);

  if (pageInfo) {
    ctx.fillStyle = '#64748B';
    ctx.font = `500 13px ${FONT_STACK}`;
    ctx.textAlign = 'right';
    ctx.fillText(pageInfo, width - paddingX, topY + 8);
  }

  const lineY = topY + 68;
  ctx.fillStyle = '#CBD5E1';
  ctx.fillRect(paddingX, lineY, width - paddingX * 2, 1.5);

  return lineY + 26;
}

/**
 * Render all groups onto a single high-resolution PNG poster and trigger download.
 */
export async function exportGroupsToPng({
  title,
  groups,
  totalStudents,
  groupSizeSetting,
}: ExportOptions): Promise<void> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const cols = groups.length <= 2 ? groups.length : 3;
  const canvasWidth = cols === 1 ? 720 : cols === 2 ? 1040 : 1360;
  const paddingX = 56;
  const gap = 24;
  const cardWidth = (canvasWidth - paddingX * 2 - gap * (cols - 1)) / cols;

  // Group into visual rows
  const rows: GroupResult[][] = [];
  for (let i = 0; i < groups.length; i += cols) {
    rows.push(groups.slice(i, i + cols));
  }

  const rowHeights = rows.map((row) =>
    Math.max(...row.map((g) => measureCardHeight(g.members.length)))
  );

  const headerHeight = 142;
  const footerHeight = 48;
  const contentHeight =
    rowHeights.reduce((sum, h) => sum + h, 0) + Math.max(0, rows.length - 1) * gap;
  const canvasHeight = headerHeight + contentHeight + footerHeight;

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth * scale;
  canvas.height = canvasHeight * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('無法建立畫布進行圖片匯出');
  ctx.scale(scale, scale);

  // Canvas background
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const subtitle = `${formatDateLabel()}  ·  共 ${totalStudents} 位學生  ·  分為 ${groups.length} 組（設定每組 ${groupSizeSetting} 人）`;
  let cursorY = drawPageHeader(ctx, canvasWidth, paddingX, title, subtitle);

  rows.forEach((row, rIdx) => {
    const rowH = rowHeights[rIdx];
    row.forEach((group, cIdx) => {
      const cardX = paddingX + cIdx * (cardWidth + gap);
      drawGroupCard(ctx, group, cardX, cursorY, cardWidth, rowH);
    });
    cursorY += rowH + gap;
  });

  // Subtle footer
  ctx.fillStyle = '#94A3B8';
  ctx.font = `400 12px ${FONT_STACK}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('課堂點名與分組助手', canvasWidth - paddingX, canvasHeight - 18);

  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  const safeTitle = (title || '分組名單').replace(/[\\/:*?"<>|]/g, '_');
  link.download = `${safeTitle}_${formatDateLabel().replace(/\//g, '-')}.png`;
  link.href = dataUrl;
  link.click();
}

/**
 * Render groups onto paginated A4-proportioned high-DPI canvases and save as a printable PDF.
 */
export async function exportGroupsToPdf({
  title,
  groups,
  totalStudents,
  groupSizeSetting,
}: ExportOptions): Promise<void> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }

  // A4 Portrait logical pixel grid (1240 x 1754 at ~150dpi, scaled 2x)
  const pageW = 1240;
  const pageH = 1754;
  const paddingX = 64;
  const bottomMargin = 68;
  const gap = 24;
  const cols = groups.length <= 2 ? groups.length : 3;
  const cardWidth = (pageW - paddingX * 2 - gap * (cols - 1)) / cols;

  // Build rows
  const allRows: Array<{ groups: GroupResult[]; height: number }> = [];
  for (let i = 0; i < groups.length; i += cols) {
    const slice = groups.slice(i, i + cols);
    const height = Math.max(...slice.map((g) => measureCardHeight(g.members.length)));
    allRows.push({ groups: slice, height });
  }

  // Paginate rows cleanly
  const headerBottomY = 142;
  const maxContentBottom = pageH - bottomMargin;
  const pages: Array<typeof allRows> = [];
  let currentPage: typeof allRows = [];
  let currentY = headerBottomY;

  for (const row of allRows) {
    const needed = (currentPage.length > 0 ? gap : 0) + row.height;
    if (currentPage.length > 0 && currentY + needed > maxContentBottom) {
      pages.push(currentPage);
      currentPage = [row];
      currentY = headerBottomY + row.height;
    } else {
      currentPage.push(row);
      currentY += needed;
    }
  }
  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const subtitle = `${formatDateLabel()}  ·  共 ${totalStudents} 位學生  ·  分為 ${groups.length} 組（設定每組 ${groupSizeSetting} 人）`;
  const scale = 2;

  pages.forEach((pageRows, pageIdx) => {
    if (pageIdx > 0) {
      pdf.addPage('a4', 'portrait');
    }

    const canvas = document.createElement('canvas');
    canvas.width = pageW * scale;
    canvas.height = pageH * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, pageW, pageH);

    const pageInfo =
      pages.length > 1 ? `第 ${pageIdx + 1} / ${pages.length} 頁` : undefined;

    let cursorY = drawPageHeader(ctx, pageW, paddingX, title, subtitle, pageInfo);

    pageRows.forEach((row) => {
      row.groups.forEach((group, cIdx) => {
        const cardX = paddingX + cIdx * (cardWidth + gap);
        drawGroupCard(ctx, group, cardX, cursorY, cardWidth, row.height);
      });
      cursorY += row.height + gap;
    });

    ctx.fillStyle = '#94A3B8';
    ctx.font = `400 12px ${FONT_STACK}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('課堂點名與分組助手 · 列印專用版面', pageW - paddingX, pageH - 28);

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
  });

  const safeTitle = (title || '分組名單').replace(/[\\/:*?"<>|]/g, '_');
  pdf.save(`${safeTitle}_${formatDateLabel().replace(/\//g, '-')}.pdf`);
}
