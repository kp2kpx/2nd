import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, SoftShadows } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { StablecoinData } from '../types'
import Bar from './Bar'

const BAR_SPACING = 4.0

interface SceneProps {
  coins: StablecoinData[]
  frame: number
  playing: boolean
}

function CameraOrbit({ playing, coinCount }: { playing: boolean; coinCount: number }) {
  const totalWidth = (coinCount - 1) * BAR_SPACING
  const centerX = totalWidth / 2

  useFrame((state) => {
    if (!playing) return
    const t = state.clock.elapsedTime * 0.15
    const radius = totalWidth * 0.7 + 16
    state.camera.position.x = centerX + Math.sin(t) * radius
    state.camera.position.z = Math.cos(t) * radius * 0.65 + 4
    state.camera.position.y = 9 + Math.sin(t * 0.4) * 2
    state.camera.lookAt(centerX, 5, 0)
  })

  return null
}

function Ground() {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.01} receiveShadow>
      <planeGeometry args={[120, 80]} />
      <meshStandardMaterial color="#080818" roughness={0.9} metalness={0.05} />
    </mesh>
  )
}

function GridLines({ coinCount }: { coinCount: number }) {
  const totalWidth = (coinCount - 1) * BAR_SPACING
  return (
    <gridHelper
      args={[totalWidth + 12, 12, '#151530', '#0e0e24']}
      position={[totalWidth / 2, 0.001, 0]}
    />
  )
}

export default function Scene({ coins, frame, playing }: SceneProps) {
  const totalWidth = (coins.length - 1) * BAR_SPACING
  const centerX = totalWidth / 2

  const maxSupply = Math.max(...coins.flatMap((c) => c.series.map((p) => p.supply)))

  return (
    <Canvas
      shadows
      camera={{
        position: [centerX, 12, totalWidth + 18],
        fov: 48,
        near: 0.1,
        far: 500,
      }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      style={{ background: '#050510' }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.3} color="#7788cc" />
      <directionalLight
        position={[centerX + 6, 22, 10]}
        intensity={1.8}
        color="#ffffff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={24}
        shadow-camera-bottom={-8}
      />
      <directionalLight position={[centerX - 8, 8, -12]} intensity={0.45} color="#4455ff" />

      <SoftShadows size={14} samples={20} />

      <CameraOrbit playing={playing} coinCount={coins.length} />
      <OrbitControls
        enabled={!playing}
        target={[centerX, 5, 0]}
        enableDamping
        dampingFactor={0.06}
        minPolarAngle={Math.PI * 0.08}
        maxPolarAngle={Math.PI * 0.52}
      />

      <Ground />
      <GridLines coinCount={coins.length} />

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

      <EffectComposer>
        <Bloom
          intensity={0.7}
          luminanceThreshold={0.5}
          luminanceSmoothing={0.7}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  )
}
