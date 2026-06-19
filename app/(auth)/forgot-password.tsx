import { useRouter } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { auth } from '../../src/config/firebase';
import { Spacing, Typography } from '../../src/theme';
import { Colors } from '../../src/theme/colors';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      let msg = 'Failed to send reset email';
      if (err.code === 'auth/user-not-found') {
        msg = 'No user found with this email address';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Invalid email address';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image
            source={require('../../assets/inuka-logo-removebg.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter your email and we'll send you a link to reset your password
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email Address"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {error && <Text style={styles.errorText}>{error}</Text>}
          {success && (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>
                Password reset email sent! Please check your inbox.
              </Text>
            </View>
          )}

          <Button
            title={success ? "Resend Link" : "Send Reset Link"}
            onPress={handleResetPassword}
            loading={loading}
            style={styles.resetButton}
          />

          <TouchableOpacity 
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
  },
  header: {
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  logoMarkText: {
    color: Colors.white,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 1,
  },
  logoImage: {
    width: 180,
    height: 180,
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h1,
    color: Colors.text,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  form: {
    marginTop: Spacing.md,
  },
  resetButton: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  errorText: {
    color: Colors.error,
    ...Typography.bodySmall,
    textAlign: 'center',
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 12,
  },
  successContainer: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderRadius: 12,
  },
  successText: {
    color: '#15803d',
    ...Typography.bodySmall,
    textAlign: 'center',
    fontWeight: '600',
  },
  backButton: {
    marginTop: Spacing.xl,
    alignItems: 'center',
  },
  backButtonText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
