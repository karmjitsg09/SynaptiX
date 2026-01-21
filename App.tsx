
import React, { useEffect, useRef, useState } from 'react';
import GestureCanvas from './components/GestureCanvas';

const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  useEffect(() => {
    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: 'user'
          },
          audio: false
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setIsCameraReady(true);
            console.log("Camera initialized");
            console.log("Camera started");
          };
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
      }
    };

    setupCamera();
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Mirrored Background Video */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
        playsInline
        muted
      />
      
      {/* Subtle UI Overlay */}
      <div className="absolute top-8 left-8 z-30 pointer-events-none select-none">
        <h1 className="text-cyan-400 text-4xl font-thin tracking-[0.4em] uppercase opacity-70">
          SYNAPTIX.OS
        </h1>
        <div className="h-0.5 w-48 bg-gradient-to-r from-cyan-500 to-transparent mt-2"></div>
      </div>

      {isCameraReady