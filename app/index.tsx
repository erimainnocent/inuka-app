import React from 'react';
import { View, Text, StyleSheet, ImageBackground, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../src/theme/colors';
import { Spacing, Typography } from '../src/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';

export default function OnboardingScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{
          uri: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=2070',
        }}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(15,15,30,0.2)', 'rgba(15,15,30,0.55)', 'rgba(15,15,30,0.93)']}
          style={styles.gradient}
        >
          {/* Top logo */}
          <View style={styles.topBar}>
            <Image
              source={require('../assets/inuka-logo-removebg.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          {/* Bottom content */}
          <View style={styles.content}>
            <View style={styles.pagination}>
              <View style={[styles.dot, styles.activeDot]} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>

            <Text style={styles.title}>
              Welcome To{'\n'}
              <Text style={styles.highlight}>Inuka Skills</Text>
              {'\n'}Learning App
            </Text>

            <Text style={styles.subtitle}>
              Access courses, track progress, and grow your skills — all in one place.
            </Text>

            {/* CTA button */}
            <TouchableOpacity
              style={styles.button}
              onPress={() => router.push('/register')}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>Get Started</Text>
              <View style={styles.arrowBg}>
                <ArrowRight size={18} color={Colors.text} />
              </View>
            </TouchableOpacity>

            {/* Existing user link */}
            <TouchableOpacity
              style={styles.signInLink}
              onPress={() => router.push('/login')}
              activeOpacity={0.7}
            >
              <Text style={styles.signInText}>
                Already have an account? <Text style={styles.signInBold}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  gradient: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: 48,
  },
  topBar: {
    alignSelf: 'flex-start',
  },
  logoImage: {
    width: 130,
    height: 52,
    borderRadius: 10,
    overflow: 'hidden',
  },
  content: {
    paddingBottom: Spacing.lg,
  },
  pagination: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },
  dot: {
    width: 20,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginRight: Spacing.xs,
  },
  activeDot: {
    backgroundColor: Colors.accent,
    width: 36,
  },
  title: {
    fontSize: 42,
    lineHeight: 54,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: Spacing.md,
  },
  highlight: {
    color: Colors.accent,
  },
  subtitle: {
    ...Typography.body,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: Spacing.xl,
    lineHeight: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    alignSelf: 'flex-start',
    paddingVertical: 14,
    paddingLeft: 28,
    paddingRight: 10,
    borderRadius: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginRight: Spacing.md,
  },
  arrowBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInLink: {
    marginTop: Spacing.lg,
    alignSelf: 'flex-start',
  },
  signInText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
  },
  signInBold: {
    color: Colors.white,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
