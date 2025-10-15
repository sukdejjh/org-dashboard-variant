// lib/sample.ts
export type Corp = 'VJ' | 'JJ' | 'QD';

export type Metric = 'ToBeTargetTO' | 'AsIsTO' | 'AsIsPO';

export type FlatRow = {
  corp: Corp;
  Department: string;
  Team?: string;    // Upper
  Process?: string; // VSM
  Plant?: string;
  Line?: number;
  JobTitle?: string;
  ToBeTargetTO?: number;
  AsIsTO?: number;
  AsIsPO?: number;
};

/** 기존 SAMPLE 그대로 두고, 아래 SAMPLE2 추가 */
export const SAMPLE2: FlatRow[] = [
  {
    corp: 'VJ',
    Department: '생산',
    Team: 'Upper1',
    Process: 'VSM1',
    Plant: 'Plant A',
    Line: 1,
    JobTitle: 'TM/Staff',
    ToBeTargetTO: 10,
    AsIsTO: 8,
    AsIsPO: 6,
  },
  {
    corp: 'VJ',
    Department: '생산',
    Team: 'Upper1',
    Process: 'VSM1',
    Plant: 'Plant A',
    Line: 1,
    JobTitle: 'TL',
    ToBeTargetTO: 4,
    AsIsTO: 3,
    AsIsPO: 2,
  },
  {
    corp: 'VJ',
    Department: '생산',
    Team: 'Upper1',
    Process: 'VSM1',
    Plant: 'Plant A',
    Line: 2,
    JobTitle: 'GL',
    ToBeTargetTO: 2,
    AsIsTO: 2,
    AsIsPO: 1,
  },
  {
    corp: 'VJ',
    Department: '생산',
    Team: 'Upper2',
    Process: 'VSM2',
    Plant: 'Plant B',
    Line: 1,
    JobTitle: 'MGL',
    ToBeTargetTO: 3,
    AsIsTO: 2,
    AsIsPO: 2,
  },
  {
    corp: 'VJ',
    Department: '생산',
    Team: 'Upper2',
    Process: 'VSM2',
    Plant: 'Plant B',
    Line: 2,
    JobTitle: 'VSM',
    ToBeTargetTO: 5,
    AsIsTO: 4,
    AsIsPO: 3,
  },
  {
    corp: 'JJ',
    Department: '생산',
    Team: 'Upper1',
    Process: 'VSM1',
    Plant: 'Plant C',
    Line: 1,
    JobTitle: 'TM/Staff',
    ToBeTargetTO: 6,
    AsIsTO: 5,
    AsIsPO: 4,
  },
  {
    corp: 'QD',
    Department: '품질',
    Team: 'UpperQ',
    Process: 'VSM-Q',
    Plant: 'Plant D',
    Line: 1,
    JobTitle: 'TL',
    ToBeTargetTO: 7,
    AsIsTO: 6,
    AsIsPO: 5,
  },
];
