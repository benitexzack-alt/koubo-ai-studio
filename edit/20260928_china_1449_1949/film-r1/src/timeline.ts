import rawTimeline from '../data/timeline.json';

export type BeatLevel = 'accent' | 'phrase' | 'sustain';

export type HistoryScene = {
  id: string;
  startFrame: number;
  durationFrames: number;
  year: string;
  title: string;
  caption: string;
  artKey: string;
  chapter: number;
  transition: string;
  beatIntent: string;
  beatLevel: BeatLevel;
  sourceIds: string[];
};

export type HistoryTimeline = {
  meta: {
    title: string;
    fps: number;
    width: number;
    height: number;
    durationInFrames: number;
    audioSource: string;
    visualDeclaration: string;
  };
  scenes: HistoryScene[];
};

export const timeline = rawTimeline as HistoryTimeline;

export const chapterTitles = [
  '危机与坚守',
  '王朝与海路',
  '近代的冲击',
  '共和与新思潮',
  '山河的抗争',
  '走向新中国',
] as const;

export const chapterPalette = [
  {dark: '#111610', mid: '#59614b', light: '#ead2a1', accent: '#c89a5a', water: '#739ba0'},
  {dark: '#122022', mid: '#456264', light: '#e7d6b6', accent: '#c6a477', water: '#75adb6'},
  {dark: '#101c28', mid: '#334c5c', light: '#e5d9c4', accent: '#ba8d69', water: '#79a4ae'},
  {dark: '#161b25', mid: '#5f5a59', light: '#ede0c6', accent: '#c7a16a', water: '#7eacb1'},
  {dark: '#101a22', mid: '#535a63', light: '#e6ddcb', accent: '#b98563', water: '#7fadb5'},
  {dark: '#1f1718', mid: '#65494a', light: '#f2dfb5', accent: '#c88360', water: '#a4aba4'},
] as const;
