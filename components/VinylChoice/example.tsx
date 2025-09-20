// Example usage of VinylChoice component

import { VinylChoice } from './VinylChoice';

export default function VinylChoiceExample() {
  const handleSelection = (id: string) => {
    console.log('User selected:', id);
    // Handle the selection logic here
  };

  return (
    <VinylChoice
      options={[
        { id: "create", label: "Create", color: "#F6A57A" },
        { id: "remix", label: "Remix", color: "#6C4EDB" }
      ]}
      onSelect={handleSelection}
    />
  );
}

// Alternative example with custom options
export function CustomVinylChoice() {
  return (
    <VinylChoice
      options={[
        { id: "play", label: "Play Music", color: "#10b981" },
        { id: "discover", label: "Discover", color: "#e11d48" }
      ]}
      onSelect={(id) => {
        switch(id) {
          case 'play':
            console.log('Starting music player...');
            break;
          case 'discover':
            console.log('Opening discovery mode...');
            break;
          default:
            console.log('Unknown selection:', id);
        }
      }}
    />
  );
}
