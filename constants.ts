
export const COLORS = {
  NEON_CYAN: '#00ffff',
  NEON_CYAN_GLOW: 'rgba(0, 255, 255, 0.8)',
  ERASER_GLOW: 'rgba(255, 50, 50, 0.6)',
  PURGE_COLOR: 'rgba(255, 255, 255, 0.9)',
};

export const GESTURE_CONFIG = {
  PINCH_THRESHOLD: 0.05, 
  FIST_THRESHOLD: 0.08,
  THUMBS_JOIN_THRESHOLD: 0.08, // Threshold for Clear All gesture
  CLEAR_HOLD_TIME: 1500,       // Time in ms to hold thumbs together
  SMOOTHING: 0.25,       
  ERASE_RADIUS: 25,      
};

export const DRAW_CONFIG = {
  LINE_WIDTH: 4,
  GLOW_BLUR: 15,
};
