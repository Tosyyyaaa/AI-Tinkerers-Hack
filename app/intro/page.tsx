'use client';

import { useRouter } from 'next/navigation';
import { VinylChoice } from '@/components/VinylChoice';

export default function IntroPage() {
  const router = useRouter();

  const handleSelection = (id: string) => {
    console.log('Selected:', id);
    // Navigate to the vibe page for now
    router.push('/vibe');
  };

  return (
    <VinylChoice
      options={[
        { id: 'control', label: 'I want to control the vibes', color: '#FFD700' },
        { id: 'investigate', label: 'Investigate the vibes for me', color: '#FFD700' }
      ]}
      onSelect={handleSelection}
    />
  );
}
