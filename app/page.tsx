'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FlickeringGrid } from '@/components/ui/flickering-grid';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to DJ deck intro page
    router.push('/intro-alt');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)' }}>
      {/* Flickering Grid Background */}
      <FlickeringGrid
        className="absolute inset-0 z-0"
        squareSize={4}
        gridGap={6}
        color="#6B7280"
        maxOpacity={0.5}
        flickerChance={0.1}
      />
      
      <div className="text-center relative z-10">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white border-opacity-30 mx-auto mb-4"></div>
        <p className="text-white text-opacity-90">Loading MusicBuddy...</p>
      </div>
    </div>
  );
}
