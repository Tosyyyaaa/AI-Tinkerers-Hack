
'use client';

import { useState, useEffect, useRef } from 'react';
import { DUMMY_WRAPPED_SUMMARY } from '@/lib/dummyData';

// Enhanced card component with animations
const WrappedCard = ({ title, children, className = '', gradient = 'from-purple-900 to-blue-900', index = 0 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 200);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <div 
      ref={cardRef}
      className={`
        relative overflow-hidden rounded-3xl shadow-2xl text-center p-8 min-h-[500px]
        bg-gradient-to-br ${gradient}
        transform transition-all duration-1000 ease-out
        ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}
        ${className}
      `}
    >
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1)_0%,transparent_70%)]" />
        <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full -translate-x-16 -translate-y-16 animate-pulse" />
        <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/5 rounded-full translate-x-12 translate-y-12 animate-pulse delay-1000" />
      </div>
      
      <div className="relative z-10">
        <h2 className="text-3xl font-bold text-white mb-6 tracking-tight">{title}</h2>
        {children}
      </div>
    </div>
  );
};

// Animated counter component
const AnimatedNumber = ({ value, suffix = '', duration = 2000 }) => {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (!hasStarted) {
      setHasStarted(true);
      let startTime = null;
      const animate = (currentTime) => {
        if (startTime === null) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        setCount(Math.floor(easeOutCubic * value));
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    }
  }, [value, duration, hasStarted]);

  return <span>{count.toLocaleString()}{suffix}</span>;
};

// Vibe distribution chart component
const VibeChart = ({ distribution }) => {
  const [animated, setAnimated] = useState(false);
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  
  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const vibeColors = {
    party: 'from-pink-500 to-purple-600',
    chill: 'from-blue-400 to-blue-600',
    focused: 'from-green-400 to-green-600',
    bored: 'from-gray-400 to-gray-600'
  };

  return (
    <div className="space-y-4">
      {Object.entries(distribution).map(([vibe, count], index) => {
        const percentage = (count / total) * 100;
        return (
          <div key={vibe} className="space-y-2">
            <div className="flex justify-between items-center text-white">
              <span className="capitalize font-semibold text-lg">{vibe}</span>
              <span className="text-white/90">{count}%</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div 
                className={`h-full bg-gradient-to-r ${vibeColors[vibe]} transition-all duration-1000 ease-out`}
                style={{ 
                  width: animated ? `${percentage}%` : '0%',
                  transitionDelay: `${index * 200}ms`
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Track component with enhanced styling
const TrackItem = ({ track, index, showRank = true }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 300);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <div className={`
      flex items-center p-4 rounded-2xl backdrop-blur-sm bg-white/10 border border-white/20
      transform transition-all duration-700 ease-out hover:scale-105 hover:bg-white/20
      ${isVisible ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}
    `}>
      {showRank && (
        <div className="text-3xl font-bold text-white/70 mr-4 min-w-[40px]">
          #{index + 1}
        </div>
      )}
      
      <div className="relative">
        <img 
          src={track.imageUrl} 
          alt={track.name} 
          className="w-16 h-16 rounded-xl shadow-lg"
          onError={(e) => {
            e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="%23333"/><text x="50%" y="50%" font-family="Arial" font-size="12" fill="white" text-anchor="middle" dy=".3em">🎵</text></svg>';
          }}
        />
        <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/50 to-transparent" />
      </div>
      
      <div className="ml-4 flex-1 min-w-0">
        <p className="font-bold text-white truncate text-lg">{track.name}</p>
        <p className="text-white/80 truncate">{track.artist}</p>
        <p className="text-white/60 text-sm truncate">{track.album}</p>
      </div>
      
      <div className="text-right">
        <div className="text-white font-bold text-xl">
          <AnimatedNumber value={track.playCount} duration={1000} />
        </div>
        <div className="text-white/70 text-sm">plays</div>
      </div>
    </div>
  );
};

export default function WrappedPage() {
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const cards = [
    // Hero Card
    <WrappedCard key="intro" title="Your DJBuddy Wrapped 2025" gradient="from-purple-900 via-blue-900 to-indigo-900" index={0}>
      <div className="space-y-8">
        <div className="text-6xl animate-bounce">🎧</div>
        <p className="text-xl text-white/90 font-light leading-relaxed">
          A look back at your incredible journey as a <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">Vibe Master</span>!
        </p>
        <div className="grid grid-cols-2 gap-6 mt-8">
          <div className="text-center p-4 bg-white/10 rounded-2xl backdrop-blur-sm">
            <div className="text-3xl font-bold text-white">
              <AnimatedNumber value={DUMMY_WRAPPED_SUMMARY.totalSessions} />
            </div>
            <div className="text-white/70">Sessions</div>
          </div>
          <div className="text-center p-4 bg-white/10 rounded-2xl backdrop-blur-sm">
            <div className="text-3xl font-bold text-white">
              <AnimatedNumber value={Math.floor(DUMMY_WRAPPED_SUMMARY.totalDurationMinutes / 60)} />
            </div>
            <div className="text-white/70">Hours</div>
          </div>
        </div>
      </div>
    </WrappedCard>,

    // Statistics Card
    <WrappedCard key="stats" title="Your Year in Numbers" gradient="from-emerald-900 via-teal-900 to-cyan-900" index={1}>
      <div className="space-y-6">
        <div className="text-5xl">📊</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-white/10 rounded-xl backdrop-blur-sm">
            <div className="text-2xl font-bold text-white">
              <AnimatedNumber value={DUMMY_WRAPPED_SUMMARY.totalTracks} />
            </div>
            <div className="text-white/70 text-sm">Tracks Played</div>
          </div>
          <div className="text-center p-4 bg-white/10 rounded-xl backdrop-blur-sm">
            <div className="text-2xl font-bold text-white">
              <AnimatedNumber value={DUMMY_WRAPPED_SUMMARY.uniqueArtists} />
            </div>
            <div className="text-white/70 text-sm">Unique Artists</div>
          </div>
          <div className="text-center p-4 bg-white/10 rounded-xl backdrop-blur-sm">
            <div className="text-2xl font-bold text-white">
              <AnimatedNumber value={DUMMY_WRAPPED_SUMMARY.totalVibeChecks} />
            </div>
            <div className="text-white/70 text-sm">Vibe Checks</div>
          </div>
          <div className="text-center p-4 bg-white/10 rounded-xl backdrop-blur-sm">
            <div className="text-2xl font-bold text-white">
              <AnimatedNumber value={DUMMY_WRAPPED_SUMMARY.longestSession} />m
            </div>
            <div className="text-white/70 text-sm">Longest Session</div>
          </div>
        </div>
        <div className="text-center p-4 bg-white/10 rounded-xl backdrop-blur-sm">
          <div className="text-lg text-white/90">Most Active Hour: <span className="font-bold">{DUMMY_WRAPPED_SUMMARY.mostActiveHour}</span></div>
        </div>
      </div>
    </WrappedCard>,

    // Vibe Distribution Card
    <WrappedCard key="vibe" title="Your Vibe Journey" gradient="from-pink-900 via-purple-900 to-violet-900" index={2}>
      <div className="space-y-6">
        <div className="text-5xl">🎭</div>
        <div className="text-center mb-6">
          <p className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 uppercase tracking-wider">
            {DUMMY_WRAPPED_SUMMARY.mostCommonVibe}
          </p>
          <p className="text-xl text-white/90 mt-2">
            Your dominant vibe throughout the year
          </p>
        </div>
        <VibeChart distribution={DUMMY_WRAPPED_SUMMARY.vibeDistribution} />
      </div>
    </WrappedCard>,

    // Top Tracks Card
    <WrappedCard key="tracks" title="Your Top Anthems" gradient="from-orange-900 via-red-900 to-pink-900" index={3}>
      <div className="space-y-6">
        <div className="text-5xl">🎵</div>
        <div className="space-y-4 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
          {DUMMY_WRAPPED_SUMMARY.topTracks.slice(0, 5).map((track, index) => (
            <TrackItem key={track.id} track={track} index={index} />
          ))}
        </div>
      </div>
    </WrappedCard>,

    // DJ Persona Card
    <WrappedCard key="persona" title="Your DJ Identity" gradient="from-blue-900 via-indigo-900 to-purple-900" index={4}>
      <div className="space-y-8">
        <div className="text-6xl">🎪</div>
        <div className="relative">
          <div className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 tracking-tight">
            {DUMMY_WRAPPED_SUMMARY.djPersona}
          </div>
          <div className="absolute -inset-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg blur opacity-20 -z-10" />
        </div>
        <p className="text-xl text-white/90 leading-relaxed">
          You're the master of reading the room and <span className="font-semibold text-blue-300">adapting to any crowd</span>.
          Your superpower? Creating the perfect atmosphere for every moment.
        </p>
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="text-center p-4 bg-white/10 rounded-xl">
            <div className="text-2xl font-bold text-white">
              <AnimatedNumber value={Math.round(DUMMY_WRAPPED_SUMMARY.danceabilityScore * 100)} suffix="%" />
            </div>
            <div className="text-white/70 text-sm">Danceability Score</div>
          </div>
          <div className="text-center p-4 bg-white/10 rounded-xl">
            <div className="text-2xl font-bold text-white">
              <AnimatedNumber value={DUMMY_WRAPPED_SUMMARY.averageBPM} />
            </div>
            <div className="text-white/70 text-sm">Average BPM</div>
          </div>
        </div>
      </div>
    </WrappedCard>,

    // AI Insights Card
    <WrappedCard key="tips" title="AI Coach Wisdom" gradient="from-teal-900 via-green-900 to-emerald-900" index={5}>
      <div className="space-y-8">
        <div className="text-6xl">🤖</div>
        <div className="relative">
          <div className="text-3xl italic text-white font-light leading-relaxed">
            "{DUMMY_WRAPPED_SUMMARY.mostCommonTip}"
          </div>
          <div className="absolute -top-4 -left-4 text-6xl text-white/20">"</div>
          <div className="absolute -bottom-4 -right-4 text-6xl text-white/20">"</div>
        </div>
        <p className="text-lg text-white/80">
          Your AI coach gave you <span className="font-bold text-green-300">personalized guidance</span> throughout the year
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-white/10 rounded-xl">
            <div className="text-2xl font-bold text-white">
              <AnimatedNumber value={DUMMY_WRAPPED_SUMMARY.totalKeeps} />
            </div>
            <div className="text-white/70 text-sm">Tracks Kept</div>
          </div>
          <div className="text-center p-4 bg-white/10 rounded-xl">
            <div className="text-2xl font-bold text-white">
              <AnimatedNumber value={DUMMY_WRAPPED_SUMMARY.totalSkips} />
            </div>
            <div className="text-white/70 text-sm">Tracks Skipped</div>
          </div>
        </div>
      </div>
    </WrappedCard>,

    // Final Stats Overview Card
    <WrappedCard key="overview" title="Your Complete Journey" gradient="from-slate-900 via-purple-900 to-rose-900" index={6}>
      <div className="space-y-6">
        <div className="text-5xl">🎊</div>
        <div className="text-lg text-white/90 mb-6">
          Here's everything that made your year incredible
        </div>
        
        {/* Main stats grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl backdrop-blur-sm border border-white/10 hover:scale-105 transition-transform duration-300">
            <div className="text-3xl font-bold text-white">
              <AnimatedNumber value={DUMMY_WRAPPED_SUMMARY.totalSessions} />
            </div>
            <div className="text-white/70 text-sm">Sessions</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-green-500/20 to-teal-500/20 rounded-2xl backdrop-blur-sm border border-white/10 hover:scale-105 transition-transform duration-300">
            <div className="text-3xl font-bold text-white">
              <AnimatedNumber value={Math.floor(DUMMY_WRAPPED_SUMMARY.totalDurationMinutes / 60)} />
            </div>
            <div className="text-white/70 text-sm">Hours</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-2xl backdrop-blur-sm border border-white/10 hover:scale-105 transition-transform duration-300">
            <div className="text-3xl font-bold text-white">
              <AnimatedNumber value={DUMMY_WRAPPED_SUMMARY.totalTracks} />
            </div>
            <div className="text-white/70 text-sm">Tracks</div>
          </div>
        </div>

        {/* Secondary stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-white/5 rounded-xl backdrop-blur-sm border border-white/10">
            <div className="text-2xl font-bold text-white">
              <AnimatedNumber value={DUMMY_WRAPPED_SUMMARY.uniqueArtists} />
            </div>
            <div className="text-white/70 text-sm">Artists Discovered</div>
          </div>
          <div className="text-center p-4 bg-white/5 rounded-xl backdrop-blur-sm border border-white/10">
            <div className="text-2xl font-bold text-white">
              <AnimatedNumber value={DUMMY_WRAPPED_SUMMARY.totalVibeChecks} />
            </div>
            <div className="text-white/70 text-sm">Vibe Checks</div>
          </div>
        </div>

        {/* Performance metrics */}
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-center mb-4">
            <div className="text-white font-semibold">Your DJ Performance</div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-green-400">
                <AnimatedNumber value={Math.round(DUMMY_WRAPPED_SUMMARY.danceabilityScore * 100)} suffix="%" />
              </div>
              <div className="text-white/70 text-xs">Danceability</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-blue-400">
                <AnimatedNumber value={DUMMY_WRAPPED_SUMMARY.averageBPM} />
              </div>
              <div className="text-white/70 text-xs">Avg BPM</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-purple-400">
                <AnimatedNumber value={Math.round(DUMMY_WRAPPED_SUMMARY.averageVolume * 100)} suffix="%" />
              </div>
              <div className="text-white/70 text-xs">Avg Volume</div>
            </div>
          </div>
        </div>

        {/* Achievement badges */}
        <div className="space-y-3">
          <div className="text-center text-white/90 font-semibold">Achievements Unlocked</div>
          <div className="flex justify-center space-x-2">
            <div className="flex items-center space-x-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 px-3 py-2 rounded-full border border-yellow-500/30">
              <span className="text-lg">🏆</span>
              <span className="text-white text-sm font-medium">Vibe Master</span>
            </div>
            <div className="flex items-center space-x-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-3 py-2 rounded-full border border-purple-500/30">
              <span className="text-lg">🎵</span>
              <span className="text-white text-sm font-medium">Track Explorer</span>
            </div>
          </div>
          <div className="flex justify-center space-x-2">
            <div className="flex items-center space-x-2 bg-gradient-to-r from-green-500/20 to-teal-500/20 px-3 py-2 rounded-full border border-green-500/30">
              <span className="text-lg">⚡</span>
              <span className="text-white text-sm font-medium">Energy Keeper</span>
            </div>
            <div className="flex items-center space-x-2 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 px-3 py-2 rounded-full border border-blue-500/30">
              <span className="text-lg">🎯</span>
              <span className="text-white text-sm font-medium">Crowd Reader</span>
            </div>
          </div>
        </div>
      </div>
    </WrappedCard>,

    // Share Card
    <WrappedCard key="share" title="Share Your Vibe Journey!" gradient="from-violet-900 via-purple-900 to-fuchsia-900" index={7}>
      <div className="space-y-8">
        <div className="text-6xl animate-pulse">✨</div>
        <p className="text-xl text-white/90 leading-relaxed">
          You've had an <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">incredible year</span> of vibe mastery!
        </p>
        <div className="space-y-4">
          <button className="w-full px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold rounded-full shadow-2xl transition-all duration-300 transform hover:scale-105 text-lg">
            📸 Download Shareable Image
          </button>
          <button className="w-full px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full backdrop-blur-sm border border-white/20 transition-all duration-300">
            🔗 Share on Social
          </button>
        </div>
      </div>
    </WrappedCard>,
  ];

  // Auto-advance cards
  useEffect(() => {
    if (!autoAdvance) return;
    
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentCardIndex((prev) => (prev + 1) % cards.length);
        setIsTransitioning(false);
      }, 300);
    }, 4000); // Auto advance every 4 seconds
    
    return () => clearInterval(interval);
  }, [autoAdvance, cards.length]);

  const handleNextCard = () => {
    setAutoAdvance(false);
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentCardIndex((prevIndex) => (prevIndex + 1) % cards.length);
      setIsTransitioning(false);
    }, 300);
  };

  const handlePrevCard = () => {
    setAutoAdvance(false);
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentCardIndex((prevIndex) => (prevIndex - 1 + cards.length) % cards.length);
      setIsTransitioning(false);
    }, 300);
  };

  const handleCardSelect = (index) => {
    setAutoAdvance(false);
    setCurrentCardIndex(index);
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 via-blue-900/50 to-black" />
        <div className="absolute inset-0">
          {/* Animated particles */}
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white/20 rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>
      </div>
      
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
        {/* Card container */}
        <div className={`
          relative w-full max-w-4xl transition-all duration-500 ease-out
          ${isTransitioning ? 'scale-95 opacity-50' : 'scale-100 opacity-100'}
        `}>
          {cards[currentCardIndex]}
        </div>

        {/* Enhanced navigation */}
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 flex items-center space-x-6 bg-black/50 backdrop-blur-lg rounded-full px-6 py-4 border border-white/20">
          <button
            onClick={handlePrevCard}
            className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all duration-300 hover:scale-110 backdrop-blur-sm border border-white/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div className="flex items-center space-x-2">
            {cards.map((_, index) => (
              <button
                key={index}
                onClick={() => handleCardSelect(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentCardIndex 
                    ? 'bg-white scale-125' 
                    : 'bg-white/40 hover:bg-white/60 hover:scale-110'
                }`}
              />
            ))}
          </div>
          
          <button
            onClick={handleNextCard}
            className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all duration-300 hover:scale-110 backdrop-blur-sm border border-white/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          
          <button
            onClick={() => setAutoAdvance(!autoAdvance)}
            className={`p-2 rounded-full transition-all duration-300 text-xs font-medium ${
              autoAdvance 
                ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                : 'bg-white/10 text-white/70 border border-white/20'
            }`}
          >
            {autoAdvance ? '⏸️' : '▶️'}
          </button>
        </div>
        
        {/* Progress indicator */}
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 text-white/60 text-sm">
          <span>{currentCardIndex + 1} / {cards.length}</span>
          <div className="w-32 h-1 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-pink-500 to-purple-600 transition-all duration-300"
              style={{ width: `${((currentCardIndex + 1) / cards.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
