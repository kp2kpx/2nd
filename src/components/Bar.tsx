import { useMemo } from 'react'
import { useSpring, animated } from '@react-spring/three'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { StablecoinData } from '../types'

const BAR_WIDTH = 1.2
const BAR_DEPTH = 1.2
const MAX_HEIGHT = 12

interface BarProps {
  coin: StablecoinData
  frameIndex: number
  positionX: number
  positionZ: number
  maxSupply: number
}

function supplyAtFrame(coin: StablecoinData, frameIndex: number): number {
  if (coin.series.length === 0) return 0
  const idx = Math.min(frameIndex, coin.series.length - 1)
  return coin.series[idx]?.supply ?? 0
}

export default function Bar({ coin, frameIndex, positionX, positionZ, maxSupply }: BarProps) {
  const supply = supplyAtFrame(coin, frameIndex)
  const targetHeight = maxSupply > 0
    ? Math.max((supply / maxSupply) * MAX_HEIGHT, 0.04)
    : 0.04

  const { scaleY } = useSpring({
    scaleY: targetHeight,
    config: { tension: 90, friction: 18 },
  })

  const color = useMemo(() => new THREE.Color(coin.color), [coin.color])
  const emissive = useMemo(() => new THREE.Color(coin.color), [coin.color])

  return (
    <group position={[positionX, 0, positionZ]}>
      {/* Bar: unit cube scaled on Y, lifted so base sits on y=0 */}
      <animated.mesh
        position-y={scaleY.to((s) => s / 2)}
        scale-y={scaleY}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[BAR_WIDTH, 1, BAR_DEPTH]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={0.4}
          roughness={0.2}
          metalness={0.55}
        />
      </animated.mesh>

      {/* Symbol label floating above bar */}
      <animated.group position-y={scaleY.to((s) => s + 0.6)}>
        <Text
          fontSize={0.38}
          color={coin.color}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.025}
          outlineColor="#000000"
          renderOrder={10}
          depthOffset={-1}
        >
          {coin.symbol}
        </Text>
      </animated.group>

      {/* Supply in millions/billions above bar */}
      <animated.group position-y={scaleY.to((s) => s + 0.15)}>
        <Text
          fontSize={0.22}
          color="#bbbbbb"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.015}
          outlineColor="#000000"
          renderOrder={10}
          depthOffset={-1}
        >
          {supply >= 1e9
            ? `$${(supply / 1e9).toFixed(2)}B`
            : `$${(supply / 1e6).toFixed(0)}M`}
        </Text>
      </animated.group>
    </group>
  )
}

export { supplyAtFrame }
