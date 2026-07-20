import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withRepeat, 
  withDelay,
  Easing,
  interpolate,
  withSequence,
  withSpring
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Line } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

export type SystemState = 'dormant' | 'active' | 'mutating';
export type EvolutionLevel = 0 | 1 | 2 | 3; // 0: Quiet Node, 1: Turning Point, 2: Split Vector, 3+: Emergent

interface GeneratorProps {
  state: SystemState;
  level: EvolutionLevel;
  mutationFactor: number;
  seed: number;
}

const PALETTES = [
  { primary: '#00ffff', secondary: '#ff00ff', emergent: '#00ff00' },
  { primary: '#ff4400', secondary: '#ffcc00', emergent: '#ffffff' },
  { primary: '#7700ff', secondary: '#00ff77', emergent: '#ff0044' },
  { primary: '#ffffff', secondary: '#444444', emergent: '#888888' },
];

export function Generator({ state, level, mutationFactor, seed }: GeneratorProps) {
  const pulseValue = useSharedValue(0);
  const rotationValue = useSharedValue(0);
  const levelValue = useSharedValue(level);
  const mutationValue = useSharedValue(mutationFactor);

  const colors = useMemo(() => PALETTES[seed % PALETTES.length], [seed]);

  useEffect(() => {
    pulseValue.value = withRepeat(
      withTiming(1, { duration: 2000 / (level + 1), easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    
    rotationValue.value = withRepeat(
      withTiming(360, { duration: 10000 / (level + 1), easing: Easing.linear }),
      -1,
      false
    );
  }, [level]);

  useEffect(() => {
    levelValue.value = withSpring(level);
  }, [level]);

  useEffect(() => {
    mutationValue.value = withTiming(mutationFactor, { duration: 500 });
  }, [mutationFactor]);

  const containerStyle = useAnimatedStyle(() => {
    return {
      opacity: state === 'dormant' ? withTiming(0.3) : withTiming(1),
      transform: [
        { scale: state === 'dormant' ? withTiming(0.8) : withTiming(1) },
      ],
    };
  });

  const centerNodeStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulseValue.value, [0, 1], [1, 1.2 + (level * 0.1)]);
    return {
      transform: [{ scale }],
    };
  });

  const ringStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotationValue.value}deg` }],
    };
  });

  // Autonomous evolution visuals
  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <G x={width / 2} y={height / 2}>
          {/* Background aura */}
          <AnimatedCircle
            r={100 + (level * 20)}
            fill="none"
            stroke="rgba(0, 255, 255, 0.1)"
            strokeWidth={2}
            style={useAnimatedStyle(() => ({
              opacity: pulseValue.value * 0.5,
              transform: [{ scale: 1 + pulseValue.value * 0.5 }],
            }))}
          />

          {/* Core Node */}
          <AnimatedCircle
            r={30 + (level * 5)}
            fill={state === 'dormant' ? '#444' : '#00ffff'}
            style={centerNodeStyle}
          />

          {/* Evolution Layers */}
          {level >= 1 && (
            <AnimatedG style={ringStyle}>
              {[0, 120, 240].map((angle, i) => (
                <Line
                  key={i}
                  x1={0}
                  y1={0}
                  x2={Math.cos((angle * Math.PI) / 180) * 80}
                  y2={Math.sin((angle * Math.PI) / 180) * 80}
                  stroke="#00ffff"
                  strokeWidth={2}
                  opacity={0.6}
                />
              ))}
            </AnimatedG>
          )}

          {level >= 2 && (
            <AnimatedG style={useAnimatedStyle(() => ({
              transform: [{ rotate: `-${rotationValue.value * 1.5}deg` }],
            }))}>
              {[60, 180, 300].map((angle, i) => (
                <Circle
                  key={i}
                  cx={Math.cos((angle * Math.PI) / 180) * 120}
                  cy={Math.sin((angle * Math.PI) / 180) * 120}
                  r={10}
                  fill="#ff00ff"
                  opacity={0.8}
                />
              ))}
            </AnimatedG>
          )}

          {/* Emergent State (Level 3+) */}
          {level >= 3 && (
            <AnimatedG>
              {[...Array(24)].map((_, i) => {
                const angle = (i * 15 * Math.PI) / 180;
                const distance = 160 + (i % 3) * 20;
                return (
                  <AnimatedCircle
                    key={i}
                    cx={Math.cos(angle) * (distance + mutationFactor * 50)}
                    cy={Math.sin(angle) * (distance + mutationFactor * 50)}
                    r={2 + (i % 4)}
                    fill={i % 2 === 0 ? "#00ff00" : "#ff00ff"}
                    style={useAnimatedStyle(() => ({
                      opacity: interpolate(pulseValue.value, [0, 0.5, 1], [0.2, 0.8, 0.2]),
                      transform: [
                        { scale: 1 + pulseValue.value * 0.5 },
                        { translateX: Math.sin(pulseValue.value * Math.PI + i) * 10 },
                        { translateY: Math.cos(pulseValue.value * Math.PI + i) * 10 },
                      ],
                    }))}
                  />
                );
              })}
              
              {/* Emerging connection paths */}
              <AnimatedPath
                d={`M 0 0 Q ${Math.cos(rotationValue.value * Math.PI / 180) * 100} ${Math.sin(rotationValue.value * Math.PI / 180) * 100} ${Math.cos(rotationValue.value * 2 * Math.PI / 180) * 200} ${Math.sin(rotationValue.value * 2 * Math.PI / 180) * 200}`}
                stroke="#00ffff"
                strokeWidth={1}
                fill="none"
                opacity={0.3}
              />
            </AnimatedG>
          )}
        </G>
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});
