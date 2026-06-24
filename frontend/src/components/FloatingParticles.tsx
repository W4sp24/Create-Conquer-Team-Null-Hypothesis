import { useEffect, useRef } from 'react'
import Spark from './Spark'

interface Particle {
  id: number
  x: number
  y: number
  size: number
  duration: number
  delay: number
}

export default function FloatingParticles() {
  const containerRef = useRef<HTMLDivElement>(null)
  const particlesRef = useRef<Particle[]>([])

  useEffect(() => {
    // Generate random particles
    const particles: Particle[] = []
    for (let i = 0; i < 15; i++) {
      particles.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 8 + 6,
        duration: Math.random() * 10 + 15,
        delay: Math.random() * 5,
      })
    }
    particlesRef.current = particles
  }, [])

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      {particlesRef.current.map((particle) => (
        <div
          key={particle.id}
          className="absolute animate-float opacity-20"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            animationDuration: `${particle.duration}s`,
            animationDelay: `${particle.delay}s`,
          }}
        >
          <Spark size={particle.size} className="text-leaf" />
        </div>
      ))}
      
      {/* Animated gradient orbs */}
      <div
        className="absolute -left-20 top-1/4 h-64 w-64 rounded-full bg-leaf/5 blur-3xl animate-float"
        style={{ animationDuration: '20s' }}
      />
      <div
        className="absolute -right-20 bottom-1/4 h-80 w-80 rounded-full bg-forest/5 blur-3xl animate-float"
        style={{ animationDuration: '25s', animationDelay: '5s' }}
      />
      <div
        className="absolute left-1/3 top-1/2 h-72 w-72 rounded-full bg-leaf/3 blur-3xl animate-float"
        style={{ animationDuration: '30s', animationDelay: '10s' }}
      />
    </div>
  )
}

// Made with Bob
