'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Award } from 'lucide-react';

const ConfettiPiece = ({ id, style }: { id: number, style: React.CSSProperties }) => (
  <div style={style} className="absolute w-2 h-4" />
);

export const RewardCelebration = ({ onCelebrationEnd }: { onCelebrationEnd: () => void }) => {
  const [pieces, setPieces] = useState<any[]>([]);

  const createConfetti = useCallback(() => {
    const newPieces = Array.from({ length: 150 }).map((_, index) => {
      const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];
      return {
        id: index,
        style: {
          left: `${Math.random() * 100}%`,
          backgroundColor: colors[Math.floor(Math.random() * colors.length)],
          animation: `fall ${3 + Math.random() * 3}s linear ${Math.random() * 2}s forwards`,
          transform: `rotate(${Math.random() * 360}deg)`,
          opacity: 1,
        },
      };
    });
    setPieces(newPieces);
  }, []);

  useEffect(() => {
    createConfetti();
    const timer = setTimeout(onCelebrationEnd, 7000); // End celebration after 7 seconds
    return () => clearTimeout(timer);
  }, [onCelebrationEnd, createConfetti]);

  return (
    <>
      <style>{`
        @keyframes fall {
          to {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        @keyframes pop-in {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="overflow-hidden absolute inset-0">
          {pieces.map(p => <ConfettiPiece key={p.id} id={p.id} style={p.style} />)}
        </div>
        <div
          className="relative text-center p-8 bg-background rounded-xl shadow-2xl"
          style={{ animation: 'pop-in 0.5s ease-out forwards' }}
        >
          <Award className="h-24 w-24 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-4xl font-bold text-primary mb-2">Congratulations!</h2>
          <p className="text-lg text-muted-foreground">You&apos;ve received a new reward for your hard work!</p>
        </div>
      </div>
    </>
  );
};
