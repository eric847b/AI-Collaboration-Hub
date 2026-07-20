import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Generator, SystemState, EvolutionLevel } from '@/components/Generator';
import { Container, Button, SizableText, H1, XStack, YStack, Theme } from '@blinkdotnew/mobile-ui';

const { width, height } = Dimensions.get('window');

const STATE_NAMES = {
  0: 'Quiet Node',
  1: 'Turning Point',
  2: 'Split Vector',
  3: 'Emergent Flux',
};

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [systemState, setSystemState] = useState<SystemState>('active');
  const [level, setLevel] = useState<EvolutionLevel>(0);
  const [mutationFactor, setMutationFactor] = useState(0);
  const [seed, setSeed] = useState(0);
  const [lastBlinkTime, setLastBlinkTime] = useState(0);
  const [blinkCount, setBlinkCount] = useState(0);
  const [isLongBlinking, setIsLongBlinking] = useState(false);
  const [feedback, setFeedback] = useState('');

  const blinkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longBlinkTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  const triggerBlink = useCallback(() => {
    const now = Date.now();
    
    // Clear existing short blink timer
    if (blinkTimerRef.current) {
      clearTimeout(blinkTimerRef.current);
    }

    setBlinkCount(prev => prev + 1);

    // Set a timer to process the blink count after a short delay
    blinkTimerRef.current = setTimeout(() => {
      processBlinks(blinkCount + 1);
      setBlinkCount(0);
    }, 400); // Window for double blink
  }, [blinkCount]);

  const processBlinks = (count: number) => {
    if (count === 1) {
      setSystemState('dormant');
      setFeedback('System Dormant');
    } else if (count >= 2) {
      setSystemState('active');
      setLevel(prev => (prev < 3 ? (prev + 1) as EvolutionLevel : 3));
      setFeedback('Generating Next State...');
    }
  };

  const startLongBlink = () => {
    setIsLongBlinking(true);
    longBlinkTimerRef.current = setTimeout(() => {
      setMutationFactor(prev => prev + 0.1);
      setSeed(prev => prev + 1);
      setSystemState('mutating');
      setFeedback('Mutating Generator...');
      setTimeout(() => setSystemState('active'), 1000);
    }, 1000);
  };

  const endLongBlink = () => {
    setIsLongBlinking(false);
    if (longBlinkTimerRef.current) {
      clearTimeout(longBlinkTimerRef.current);
    }
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <Container style={styles.container} alignItems="center" justifyContent="center">
        <H1 textAlign="center">Camera Access Required</H1>
        <SizableText textAlign="center" marginVertical="$4">
          The Third Door experience requires your camera to detect blink patterns.
        </SizableText>
        <Button onPress={requestPermission}>Enable Camera</Button>
      </Container>
    );
  }

  return (
    <Theme name="dark">
      <View style={styles.container}>
        {/* Background Camera Feed (Low Opacity) */}
        <CameraView style={StyleSheet.absoluteFill} facing="front" />
        
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.8)' }]} />

        {/* The Generator Visuals */}
        <Generator state={systemState} level={level} mutationFactor={mutationFactor} seed={seed} />

        {/* Overlay UI */}
        <SafeAreaContent 
          systemState={systemState} 
          level={level} 
          feedback={feedback} 
          triggerBlink={triggerBlink}
          startLongBlink={startLongBlink}
          endLongBlink={endLongBlink}
        />
      </View>
    </Theme>
  );
}

function SafeAreaContent({ 
  systemState, 
  level, 
  feedback, 
  triggerBlink,
  startLongBlink,
  endLongBlink
}: any) {
  return (
    <View style={styles.overlay}>
      <YStack padding="$6" alignItems="center">
        <SizableText color="$color9" size="$2" letterSpacing={2} textTransform="uppercase">
          State {level}: {STATE_NAMES[level as keyof typeof STATE_NAMES]}
        </SizableText>
        <H1 color="white" marginVertical="$2" textAlign="center">
          The Third Door
        </H1>
        {feedback ? (
          <Animated.View entering={FadeIn} exiting={FadeOut} key={feedback}>
            <SizableText color="#00ffff" size="$4" fontWeight="600">
              {feedback}
            </SizableText>
          </Animated.View>
        ) : null}
      </YStack>

      <View style={{ flex: 1 }} />

      <YStack padding="$6" gap="$4">
        <BlurView intensity={20} style={styles.controlsBlur}>
          <YStack padding="$4" gap="$2">
            <XStack justifyContent="space-between" alignItems="center">
              <SizableText color="$color9">System Status</SizableText>
              <View style={[styles.statusDot, { backgroundColor: systemState === 'dormant' ? '#ff4444' : '#00ff00' }]} />
            </XStack>
            <SizableText color="white" size="$5" fontWeight="700">
              {systemState.toUpperCase()}
            </SizableText>
          </YStack>
        </BlurView>

        <YStack gap="$2" alignItems="center">
          <SizableText color="$color8" size="$2" textAlign="center">
            TAP TO BLINK • DOUBLE TAP TO EVOLVE • LONG PRESS TO MUTATE
          </SizableText>
          
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={triggerBlink}
            onLongPress={startLongBlink}
            onPressOut={endLongBlink}
            style={styles.blinkButton}
          >
            <View style={styles.blinkButtonInner}>
              <Ionicons name="eye-outline" size={32} color="white" />
            </View>
          </TouchableOpacity>
        </YStack>
      </YStack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  controlsBlur: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  blinkButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#00ffff',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  blinkButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#00ffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
