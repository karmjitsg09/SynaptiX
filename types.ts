
export interface Point {
  x: number;
  y: number;
}

export interface Line {
  id: string;
  points: Point[];
  color: string;
  timestamp: number;
}

export interface HandData {
  label: 'Left' | 'Right';
  landmarks: any[];
  indexTip: Point;
  thumbTip: Point;
  middleTip: Point;
  isPinching: boolean;
  isMiddlePinching: boolean;
  wrist: Point;
}
