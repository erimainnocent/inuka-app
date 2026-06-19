import { useRouter } from 'expo-router';
import { sendEmailVerification } from 'firebase/auth';
import { Mail, RefreshCw, Send, LogOut, CheckCircle } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth } from '../../src/config/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { Spacing, Typography } from '../../src/theme';
import { Colors } from '../../src/theme/colors';

export default function VerifyScreen() {
  const router = useRouter();
  const { user, refreshUser, signOut } = useAuth();
  
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Tick down the 60-second resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleCheckVerification = async () => {
    setError(null);
    setSuccess(null);
    setChecking(true);
    try {
      await refreshUser();
      if (auth.currentUser?.emailVerified) {
        setSuccess('Email verified successfully! Welcome to INUKA.');
        // The layout guard in app/_layout.tsx will automatically pick this up and route them
      } else {
        setError('Your email is not verified yet. Please click the link in your inbox.');
      }
    } catch (err: any) {
      console.error('Check verification error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const handleResendEmail = async () => {
    if (cooldown > 0 || !auth.currentUser) return;
    setError(null);
    setSuccess(null);
    setResending(true);
    try {
      await sendEmailVerification(auth.currentUser);
      setSuccess('Verification email resent! Please check your spam folder if you do not see it.');
      setCooldown(60);
    } catch (err: any) {
      console.error('Resend verification email error:', err);
      if (err.code === 'auth/too-many-requests') {
        setError('Too many requests. Please wait a moment and try again.');
      } else {
        setError('Failed to resend email. Please try again.');
      }
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = async () => {
    setError(null);
    setSuccess(null);
    try {
      await signOut();
      router.replace('/login');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Decorative Mail Icon Card */}
        <View style={styles.iconContainer}>
          <View style={styles.iconBackground}>
            <Mail size={48} color={Colors.primary} />
          </View>
        </View>

        {/* Text Header */}
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>
          We've sent a verification link to your Gmail account:
        </Text>

        {/* User's Email Badge */}
        <View style={styles.emailBadge}>
          <Text style={styles.emailText}>{user?.email || 'your email'}</Text>
        </View>

        <Text style={styles.description}>
          Please check your inbox (and spam folder) and click the link to activate your account. Once done, tap below.
        </Text>

        {/* Success / Error Messages */}
        {success && (
          <View style={[styles.messageBanner, styles.successBanner]}>
            <CheckCircle size={16} color="#059669" />
            <Text style={styles.successMessage}>{success}</Text>
          </View>
        )}

        {error && (
          <View style={[styles.messageBanner, styles.errorBanner]}>
            <Text style={styles.errorMessage}>{error}</Text>
          </View>
        )}

        {/* Core Actions Container */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryButton, checking && { opacity: 0.8 }]}
            onPress={handleCheckVerification}
            disabled={checking}
            activeOpacity={0.8}
          >
            {checking ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <>
                <RefreshCw size={18} color={Colors.white} style={styles.buttonIcon} />
                <Text style={styles.primaryButtonText}>I've Verified My Email</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryButton,
              (cooldown > 0 || resending) && styles.disabledButton,
            ]}
            onPress={handleResendEmail}
            disabled={cooldown > 0 || resending}
            activeOpacity={0.8}
          >
            {resending ? (
              <ActivityIndicator color={Colors.primary} size="small" />
            ) : (
              <>
                <Send size={16} color={cooldown > 0 ? Colors.textMuted : Colors.primary} style={styles.buttonIcon} />
                <Text
                  style={[
                    styles.secondaryButtonText,
                    cooldown > 0 && { color: Colors.textMuted },
                  ]}
                >
                  {cooldown > 0 ? `Resend Email (${cooldown}s)` : 'Resend Verification Email'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Back to Login Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut} activeOpacity={0.8}>
          <LogOut size={16} color={Colors.textSecondary} style={styles.buttonIcon} />
          <Text style={styles.logoutButtonText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  iconContainer: {
    marginBottom: Spacing.xl,
  },
  iconBackground: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  title: {
    ...Typography.h1,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
    lineHeight: 22,
  },
  emailBadge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    marginBottom: Spacing.lg,
  },
  emailText: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.primary,
  },
  description: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.sm,
  },
  messageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: Spacing.md,
    width: '100%',
    marginBottom: Spacing.lg,
  },
  successBanner: {
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.2)',
  },
  successMessage: {
    ...Typography.bodySmall,
    color: '#059669',
    fontWeight: '600',
    flex: 1,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  errorMessage: {
    ...Typography.bodySmall,
    color: Colors.error,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  actions: {
    width: '100%',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  primaryButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    color: Colors.white,
    ...Typography.h3,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: Colors.glassBorder,
  },
  secondaryButtonText: {
    color: Colors.primary,
    ...Typography.h3,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.7,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  buttonIcon: {
    marginRight: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
  },
  logoutButtonText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
