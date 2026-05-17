import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, SoftShadows } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { StablecoinData } from '../types'
import Bar from './Bar'

const BAR_SPACING = 2.4

interface SceneProps {
  coins: StablecoinData[]
  frame: number
  playing: boolean
}

function CameraOrbit({ playing, coinCount }: { playing: boolean; coinCount: number }) {
  const ref = useRef<any>(null)
  const totalWidth = (coinCount - 1) * BAR_SPACING
  const centerX = totalWidth / 2

  useFrame((state, delta) => {
    if (!playing) return
    // Gentle orbit: rotate around the center of the bar row
    const elapsed = state.clock.elapsedTime * 0.18
    const radius = totalWidth * 0.85 + 14
    state.camera.position.x = centerX + Math.sin(elapsed) * radius
    state.camera.position.z = Math.cos(elapsed) * radius * 0.7 + 6
    state.camera.position.y = 8 + Math.sin(elapsed * 0.3) * 2
    state.camera.lookAt(centerX, 4, 0)
  })

  return null
}

function Ground() {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.01} receiveShadow>
      <planeGeometry args={[120, 80]} />
      <meshStandardMaterial color="#0a0a1a" roughness={0.9} metalness={0.1} />
    </mesh>
  )
}

function GridLines({ coinCount }: { coinCount: number }) {
  const totalWidth = (coinCount - 1) * BAR_SPACING
  return (
    <gridHelper
      args={[Math.max(totalWidth + 8, 20), 20, '#1a1a3a', '#111128']}
      position={[totalWidth / 2, 0, 0]}
    />
  )
}

function Bars({ coins, frame }: { coins: StablecoinData[]; frame: number }) {
  const maxSupply = useMemo(
    () => Math.max(...coins.flatMap((c) => c.series.map((p) => p.supply))),
    [coins]
  )

  return (
    <>
      {coins.map((coin, i) => (
        <Bar
          key={coin.id}
          coin={coin}
          frameIndex={frame}
          positionX={i * BAR_SPACING}
          positionZ={0}
          maxSupply={maxSupply}
        />
      ))}
    </>
  )
}

export default function Scene({ coins, frame, playing }: SceneProps) {
  const totalWidth = (coins.length - 1) * BAR_SPACING
  const centerX = totalWidth / 2

  return (
    <Canvas
      shadows
      camera={{
        position: [centerX, 10, totalWidth * 0.9 + 14],
        fov: 52,
        near: 0.1,
        far: 500,
      }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      style={{ background: '#050510' }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.35} color="#8888bb" />
      <directionalLight
        position={[centerX + 8, 20, 8]}
        intensity={1.6}
        color="#ffffff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={20}
        shadow-camera-bottom={-10}
      />
      <directionalLight position={[centerX - 6, 10, -10]} intensity={0.4} color="#4466ff" />
      <pointLight position={[centerX, 16, 4]} intensity={0.5} color="#ffffff" />

      <SoftShadows size={12} samples={16} />

      <CameraOrbit playing={playing} coinCount={coins.length} />
      <OrbitControls
        enabled={!playing}
        target={[centerX, 4, 0]}
        enableDamping
        dampingFactor={0.05}
        minPolarAngle={Math.PI * 0.1}
        maxPolarAngle={Math.PI * 0.55}
      />

      <Ground />
      <GridLines coinCount={coins.length} />
      <Bars coins={coins} frame={frame} />

      <EffectComposer>
        <Bloom
          intensity={0.6}
          luminanceThreshold={0.55}
          luminanceSmoothing={0.6}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  )
}
