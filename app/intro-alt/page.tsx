'use client';

import { useRouter } from 'next/navigation';
import { ModernDeck } from '@/components/ModernDeck';

export default function IntroAltPage() {
  const router = useRouter();

  const handleSelection = (id: 'hot-cue' | 'amplify') => {
    console.log('Modern DJ Deck Selected:', id);

    // Map deck choices to updated flows
    switch (id) {
      case 'hot-cue':
        router.push('/vibe?mode=sensors');
        break;
      case 'amplify':
        router.push('/vibe?mode=url');
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
