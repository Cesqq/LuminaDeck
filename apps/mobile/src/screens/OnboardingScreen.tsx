import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Linking,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';

const ONBOARDING_KEY = '@luminadeck/onboarding_complete';
const DOWNLOAD_URL = 'https://luminadeck.app/download';
const TOTAL_STEPS = 3;

interface OnboardingScreenProps {
  onComplete: () => void;
}

interface StepContent {
  title: string;
  body: string;
  icon: string;
}

const STEPS: StepContent[] = [
  {
    title: 'Welcome to LuminaDeck',
    body:
      'Turn your iPhone into a powerful macro deck for your Windows PC. ' +
      'Launch apps, trigger keyboard shortcuts, control media, and more ' +
      '\u2014 all with a single tap.',
    icon: '\uD83C\uDFAE', // game controller emoji
  },
  {
    title: 'Connect Your PC',
    body:
      'Download the free LuminaDeck Companion app on your Windows PC, ' +
      'then scan the QR code it displays \u2014 or enter the IP address manually ' +
      'to pair your devices over Wi-Fi.',
    icon: '\uD83D\uDD17', // link emoji
  },
  {
    title: 'Try It Out',
    body:
      'Your starter page comes pre-loaded with common actions like ' +
      'volume control, play/pause, and mute. Customize every button to fit ' +
      'your workflow \u2014 long-press any button to edit it.',
    icon: '\u2728', // sparkle emoji
  },
];

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { colors } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const pagerRef = useRef<PagerView>(null);

  const markComplete = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {
      // AsyncStorage failure is non-fatal; the user can still proceed
    }
    onComplete();
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    markComplete();
  }, [markComplete]);

  const handleNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS - 1) {
      const next = currentStep + 1;
      pagerRef.current?.setPage(next);
      setCurrentStep(next);
    } else {
      markComplete();
    }
  }, [currentStep, markComplete]);

  const handlePageSelected = useCallback(
    (e: { nativeEvent: { position: number } }) => {
      setCurrentStep(e.nativeEvent.position);
    },
    [],
  );

  const handleDownload = useCallback(() => {
    Linking.openURL(DOWNLOAD_URL);
  }, []);

  const isLastStep = currentStep === TOTAL_STEPS - 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Skip button */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={handleSkip}
          style={styles.skipButton}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text
            style={[styles.skipText, { color: colors.textSecondary }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            Skip
          </Text>
        </TouchableOpacity>
      </View>

      {/* Pager */}
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={handlePageSelected}
      >
        {STEPS.map((step, index) => (
          <View key={index} style={styles.stepContainer}>
            <View style={styles.stepContent}>
              {/* Step icon */}
              <Text
                style={styles.stepIcon}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                {step.icon}
              </Text>

              {/* Title */}
              <Text
                style={[styles.stepTitle, { color: colors.text }]}
                allowFontScaling
                maxFontSizeMultiplier={1.5}
                accessibilityRole="header"
              >
                {step.title}
              </Text>

              {/* Body */}
              <Text
                style={[styles.stepBody, { color: colors.textSecondary }]}
                allowFontScaling
                maxFontSizeMultiplier={1.5}
              >
                {step.body}
              </Text>

              {/* Step 2: Download CTA */}
              {index === 1 && (
                <TouchableOpacity
                  style={[styles.downloadLink, { borderColor: colors.accent }]}
                  onPress={handleDownload}
                  accessibilityRole="link"
                  accessibilityLabel="Download LuminaDeck Companion for Windows"
                >
                  <Text
                    style={[styles.downloadLinkText, { color: colors.accent }]}
                    allowFontScaling
                    maxFontSizeMultiplier={1.5}
                  >
                    Download for Windows
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </PagerView>

      {/* Bottom area: dots + button */}
      <View style={styles.bottomArea}>
        {/* Page indicator dots */}
        <View
          style={styles.dotsContainer}
          accessibilityRole="tablist"
          accessibilityLabel={`Step ${currentStep + 1} of ${TOTAL_STEPS}`}
        >
          {STEPS.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    index === currentStep
                      ? colors.accent
                      : colors.textSecondary + '44',
                },
              ]}
              accessibilityRole="tab"
              accessibilityLabel={`Step ${index + 1} of ${TOTAL_STEPS}`}
              accessibilityState={{ selected: index === currentStep }}
            />
          ))}
        </View>

        {/* Next / Get Started button */}
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: colors.accent }]}
          onPress={handleNext}
          accessibilityRole="button"
          accessibilityLabel={isLastStep ? 'Get Started' : 'Next step'}
        >
          <Text
            style={styles.nextButtonText}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            {isLastStep ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
  },
  pager: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  stepContent: {
    alignItems: 'center',
    maxWidth: Math.min(SCREEN_WIDTH - 64, 400),
  },
  stepIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },
  stepBody: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  downloadLink: {
    marginTop: 24,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  downloadLinkText: {
    fontSize: 15,
    fontWeight: '700',
  },
  bottomArea: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nextButton: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
