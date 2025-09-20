'use client';

import { useRouter } from 'next/navigation';
import { ModernDeck } from '@/components/ModernDeck';

export default function IntroAltPage() {
  const router = useRouter();

  const handleSelection = (id: "hot-cue" | "amplify") => {
    console.log('Modern DJ Deck Selected:', id);
    
    // Map deck choices to app functionality
    switch (id) {
      case 'hot-cue':
        // Hot Cue = Manual control (like "I want to control the vibes")
        router.push('/vibe?mode=control');
        break;
      case 'amplify':
        // Amplify = Auto mode (like "Investigate the vibes for me")
        router.push('/vibe?mode=investigate');
        break;
      default:
        router.push('/vibe');
    }
  };

  return (
    <ModernDeck
      onSelect={handleSelection}
      useSpotify={false}
    />
  );
}
