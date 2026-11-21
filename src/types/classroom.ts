export interface Student {
  id: string;
  name: string;
  seatNo?: string;
  active: boolean;
}

export interface DrawHistoryItem {
  id: string;
  studentId: string;
  name: string;
  seatNo?: string;
  drawnAt: number;
  round: number;
}

export interface GroupPalette {
  name: string;
  topBar: string;
  headerBg: string;
  accentText: string;
  hexBar: string;
  hexBg: string;
  hexText: string;
}

export interface GroupResult {
  id: string;
  index: number;
  title: string;
  palette: GroupPalette;
  members: Student[];
}

export type RemainderStrategy = 'distribute' | 'new_group';
export type ActiveFeature = 'picker' | 'grouping';
