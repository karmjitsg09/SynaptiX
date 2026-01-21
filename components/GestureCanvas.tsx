
import React, { useEffect, useRef, useState } from 'react';
import { Point, Line, HandData } from '../types';
import { COLORS, GESTURE_CONFIG, DRAW_CONFIG } from '../constants';

interface Props {
  videoElement: HTMLVideoElement;
}

const GestureCanvas: React.FC<Props> = ({ videoElement }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const linesRef = useRef<Line[]>([]);
  const currentLineId = useRef<string | null>(null);
  const [clearProgress, setClearProgress] = useState(0); // 0 to 1
  
  // State for smoothing
  const smoothedPoints = useRef<{ [key: string]: Point }>({});
  const lastLeftWrist = useRef<Point | null>(null);
  
  // Timer for Clear All gesture
  const clearStartTimeRef = useRef<number | null>(null);
  const lastInteractionRef = useRef<number>(Date.now());

  // Mode tracking for logs
  const modesRef = useRef({
    drawing: false,
    moving: false,
    erasing: false,
    clearing: false
  });

  const getDistance = (p1: any, p2: any) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  };

  const processHands = (results: any) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rawHands: HandData[] = [];
    if (results.multiHandLandmarks && results.multiHandedness) {
      results.multiHandLandmarks.forEach((landmarks: any, index: number) => {
        const isRightRaw = results.multiHandedness[index].label === 'Right';
        const label = isRightRaw ? 'Left' : 'Right';
        
        const indexTip = { x: landmarks[8].x, y: landmarks[8].y };
        const thumbTip = { x: landmarks[4].x, y: landmarks[4].y };
        const middleTip = { x: landmarks[12].x, y: landmarks[12].y };
        const wrist = { x: landmarks[0].x, y: landmarks[0].y };
        
        rawHands.push({
          label: label as any,
          landmarks,
          indexTip,
          thumbTip,
          middleTip,
          wrist,
          isPinching: getDistance(indexTip, thumbTip) < GESTURE_CONFIG.PINCH_THRESHOLD,
          isMiddlePinching: getDistance(middleTip, thumbTip) < GESTURE_CONFIG.PINCH_THRESHOLD
        });
      });
    }

    const leftHand = rawHands.find(h => h.label === 'Left');
    const rightHand = rawHands.find(h => h.label === 'Right');

    // 1. Handle CLEAR ALL (Both thumbs together)
    if (leftHand && rightHand) {
      const thumbDist = getDistance(leftHand.thumbTip, rightHand.thumbTip);
      if (thumbDist < GESTURE_CONFIG.THUMBS_JOIN_THRESHOLD) {
        if (!clearStartTimeRef.current) {
          clearStartTimeRef.current = Date.now();
        }
        
        const elapsed = Date.now() - clearStartTimeRef.current;
        const progress = Math.min(elapsed / GESTURE_CONFIG.CLEAR_HOLD_TIME, 1);
        setClearProgress(progress);

        if (progress >= 1) {
          linesRef.current = [];
          clearStartTimeRef.current = null; // Reset after trigger
          setClearProgress(0);
          console.log("System Purge: All lines cleared");
        }
      } else {
        clearStartTimeRef.current = null;
        if (clearProgress > 0) setClearProgress(0);
      }
    } else {
      clearStartTimeRef.current = null;
      if (clearProgress > 0) setClearProgress(0);
    }

    // 2. Handle MOVE MODE (Left Hand Thumb + Index Pinch Only)
    // Disabled if clearing is taking priority or erase is active
    if (leftHand?.isPinching && !leftHand.isMiddlePinching && clearProgress === 0) {
      if (!modesRef.current.moving) {
        console.log("Left pinch move active (H-Inverted)");
        modesRef.current.moving = true;
      }
      if (lastLeftWrist.current) {
        const dx = (leftHand.wrist.x - lastLeftWrist.current.x) * canvas.width;
        const dy = (leftHand.wrist.y - lastLeftWrist.current.y) * canvas.height;
        linesRef.current.forEach(line => {
          line.points.forEach(p => {
            p.x -= dx;
            p.y += dy;
          });
        });
      }
      lastLeftWrist.current = leftHand.wrist;
    } else {
      modesRef.current.moving = false;
      lastLeftWrist.current = null;
    }

    // 3. Handle ERASE MODE
    const isErasing = leftHand?.isMiddlePinching && rightHand && clearProgress === 0;
    if (isErasing) {
      if (!modesRef.current.erasing) {
        modesRef.current.erasing = true;
      }
      const eraseX = (1 - rightHand!.indexTip.x) * canvas.width;
      const eraseY = rightHand!.indexTip.y * canvas.height;
      
      linesRef.current = linesRef.current.filter(line => {
        const originalCount = line.points.length;
        line.points = line.points.filter(p => {
          const dist = Math.hypot(p.x - eraseX, p.y - eraseY);
          return dist > GESTURE_CONFIG.ERASE_RADIUS;
        });
        return line.points.length > 1;
      });
    } else {
      modesRef.current.erasing = false;
    }

    // 4. Handle DRAW MODE
    if (rightHand?.isPinching && !isErasing && clearProgress === 0) {
      if (!modesRef.current.drawing) {
        modesRef.current.drawing = true;
        const newId = Date.now().toString();
        currentLineId.current = newId;
        linesRef.current.push({
          id: newId,
          points: [],
          color: COLORS.NEON_CYAN,
          timestamp: Date.now()
        });
      }

      const rawX = (1 - rightHand.indexTip.x) * canvas.width;
      const rawY = rightHand.indexTip.y * canvas.height;

      const smooth = smoothedPoints.current['right'] || { x: rawX, y: rawY };
      smooth.x += (rawX - smooth.x) * GESTURE_CONFIG.SMOOTHING;
      smooth.y += (rawY - smooth.y) * GESTURE_CONFIG.SMOOTHING;
      smoothedPoints.current['right'] = smooth;

      const currentLine = linesRef.current.find(l => l.id === currentLineId.current);
      if (currentLine) {
        currentLine.points.push({ ...smooth });
      }
    } else {
      modesRef.current.drawing = false;
      currentLineId.current = null;
    }

    render(ctx, canvas, rawHands);
  };

  const render = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, hands: HandData[]) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all lines
    linesRef.current.forEach(line => {
      if (line.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = line.color;
      ctx.lineWidth = DRAW_CONFIG.LINE_WIDTH;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowBlur = DRAW_CONFIG.GLOW_BLUR;
      ctx.shadowColor = COLORS.NEON_CYAN_GLOW;
      ctx.moveTo(line.points[0].x, line.points[0].y);
      for (let i = 1; i < line.points.length; i++) {
        ctx.lineTo(line.points[i].x, line.points[i].y);
      }
      ctx.stroke();
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.4;
      ctx.shadowBlur = 0;
      ctx.stroke();
      ctx.restore();
    });

    // Draw interactive hand feedback
    hands.forEach(hand => {
      const x = (1 - hand.indexTip.x) * canvas.width;
      const y = hand.indexTip.y * canvas.height;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      
      if (hand.label === 'Right') {
        const isDrawing = hand.isPinching && !modesRef.current.erasing && clearProgress === 0;
        const isEraser = modesRef.current.erasing;
        ctx.fillStyle = isDrawing ? COLORS.NEON_CYAN : isEraser ? 'rgba(255, 50, 50, 0.8)' : 'rgba(0, 255, 255, 0.2)';
        ctx.shadowColor = isEraser ? 'red' : COLORS.NEON_CYAN;
      } else {
        const isMoveMode = hand.isPinching && !hand.isMiddlePinching && clearProgress === 0;
        const isEraseActive = hand.isMiddlePinching;
        ctx.fillStyle = isMoveMode ? 'rgba(255, 255, 0, 0.6)' : isEraseActive ? 'rgba(255, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.2)';
        ctx.shadowColor = isMoveMode ? 'yellow' : isEraseActive ? 'red' : 'white';
      }
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.restore();

      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
      let label = '';
      if (hand.label === 'Right') {
        if (modesRef.current.erasing) label = 'ERASER MODE';
        else label = hand.isPinching ? 'DRAWING' : 'PINCH TO DRAW';
      } else {
        if (hand.isMiddlePinching) label = 'ERASE MODE READY';
        else if (hand.isPinching) label = 'H-INVERTED MOVE';
        else label = 'T+I: MOVE | T+M: ERASE';
      }
      ctx.fillText(label, x + 15, y);
    });

    // Draw Clear All Progress Indicator
    if (clearProgress > 0) {
      const leftHand = hands.find(h => h.label === 'Left');
      const rightHand = hands.find(h => h.label === 'Right');
      if (leftHand && rightHand) {
        const lx = (1 - leftHand.thumbTip.x) * canvas.width;
        const ly = leftHand.thumbTip.y * canvas.height;
        const rx = (1 - rightHand.thumbTip.x) * canvas.width;
        const ry = rightHand.thumbTip.y * canvas.height;
        
        const midX = (lx + rx) / 2;
        const midY = (ly + ry) / 2;
        
        ctx.save();
        ctx.translate(midX, midY);
        
        // Outer glow ring
        ctx.beginPath();
        ctx.arc(0, 0, 40, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Progress arc
        ctx.beginPath();
        ctx.arc(0, 0, 40, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * clearProgress));
        ctx.strokeStyle = COLORS.PURGE_COLOR;
        ctx.lineWidth = 4;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#fff';
        ctx.stroke();

        // Label
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText('SYSTEM PURGE', 0, -55);
        const percent = Math.floor(clearProgress * 100);
        ctx.fillText(`${percent}%`, 0, 5);
        
        ctx.restore();
      }
    }
  };

  useEffect(() => {
    const hands = new (window as any).Hands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
    });

    hands.onResults(processHands);

    const camera = new (window as any).Camera(videoElement, {
      onFrame: async () => {
        await hands.send({ image: videoElement });
      },
      width: 1280,
      height: 720
    });
    
    camera.start();

    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      camera.stop();
      hands.close();
    };
  }, [videoElement]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-20 pointer-events-none"
    />
  );
};

export default GestureCanvas;
