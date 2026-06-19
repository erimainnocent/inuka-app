import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Crown, GraduationCap, ShieldCheck, Eye, EyeOff, Check, X, AlertCircle } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Input } from '../../src/components/Input';
import { auth, db } from '../../src/config/firebase';
import type { Role } from '../../src/context/AuthContext';
import { Spacing, Typography } from '../../src/theme';
import { Colors } from '../../src/theme/colors';

// ─── MVP Admin Codes ──────────────────────────────────────────────────────────
const TEACHER_ADMIN_CODE = 'INUKA-TEACH-2024';
const SUPER_ADMIN_CODE = 'INUKA-SUPER-9999';

// ─── Email domain validation ─────────────────────────────────────────────────
const VALID_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

function detectGmailTypo(email: string): string | null {
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return null;
  const [local, domain] = parts;
  
  const typos = [
    'gamil.com', 'gmal.com', 'gmaill.com', 'gmeil.com', 'gmaul.com', 'gmai.com', 
    'gmil.com', 'gimail.com', 'gamil.co', 'gmal.co', 'gmail.co', 'gmail.con', 
    'gamil.con', 'gmail.coms', 'gmail.cm', 'gml.com', 'gma.com', 'gail.com',
    'gmall.com', 'gmaii.com', 'gmaili.com', 'gmaill.co'
  ];
  
  if (typos.includes(domain)) {
    return `${local}@gmail.com`;
  }
  return null;
}

function validateEmailDomain(email: string): { valid: boolean; error?: string } {
  const trimmed = email.trim().toLowerCase();

  if (!VALID_EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: 'Please enter a valid email address (e.g. you@gmail.com).' };
  }

  const domain = trimmed.split('@')[1];

  if (domain !== 'gmail.com') {
    return { valid: false, error: 'Only Gmail accounts (@gmail.com) are allowed to register.' };
  }

  return { valid: true };
}

// ─── Account Type Config ──────────────────────────────────────────────────────
const ACCOUNT_TYPES: {
  label: string;
  role: Role;
  description: string;
  Icon: any;
  color: string;
  bg: string;
  requiresCode: boolean;
}[] = [
    {
      label: 'Student',
      role: 'student',
      description: 'Access courses and track your learning',
      Icon: GraduationCap,
      color: Colors.primary,
      bg: Colors.primaryLight,
      requiresCode: false,
    },
    {
      label: 'Teacher Admin',
      role: 'teacher_admin',
      description: 'Manage courses and learning materials',
      Icon: ShieldCheck,
      color: '#059669',
      bg: '#d1fae5',
      requiresCode: true,
    },
    {
      label: 'Super Admin',
      role: 'super_admin',
      description: 'Full administrative access and user management',
      Icon: Crown,
      color: '#d97706',
      bg: '#fef3c7',
      requiresCode: true,
    },
  ];

export default function RegisterScreen() {
  const router = useRouter();

  // Shared fields
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>('student');

  // Admin-only fields
  const [fullName, setFullName] = useState('');
  const [adminCode, setAdminCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live validation calculations
  const typoSuggestion = detectGmailTypo(email);

  const pwdRules = {
    length: password.length >= 12,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
  const metCount = Object.values(pwdRules).filter(Boolean).length;
  const isPasswordValid = metCount === 5;

  const selectedType = ACCOUNT_TYPES.find((t) => t.role === selectedRole)!;
  const isAdmin = selectedRole === 'teacher_admin' || selectedRole === 'super_admin';

  const validateAdminCode = (): boolean => {
    if (selectedRole === 'student') return true;
    if (selectedRole === 'teacher_admin' && adminCode !== TEACHER_ADMIN_CODE) {
      setError('Invalid Teacher Admin code. Please contact your Super Admin.');
      return false;
    }
    if (selectedRole === 'super_admin' && adminCode !== SUPER_ADMIN_CODE) {
      setError('Invalid Super Admin code.');
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    setError(null);

    // Validate shared fields
    if (!email || !confirmEmail || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    // Validate email domain
    const emailCheck = validateEmailDomain(email);
    if (!emailCheck.valid) {
      setError(emailCheck.error!);
      return;
    }

    if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      setError('Email addresses do not match');
      return;
    }

    if (!isPasswordValid) {
      setError('Password must be at least 12 characters and include uppercase, lowercase, numbers, and symbols.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Admin extra validation
    if (isAdmin) {
      if (!fullName.trim()) {
        setError('Full name is required');
        return;
      }
      if (!validateAdminCode()) return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      const { user } = userCredential;

      // For admins set display name immediately; students will set it in onboarding
      if (isAdmin && fullName.trim()) {
        await updateProfile(user, { displayName: fullName.trim() });
      }

      // Create Firestore user document
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        fullName: isAdmin ? fullName.trim() : '',
        email: email.trim().toLowerCase(),
        role: selectedRole,
        isDisabled: false,
        avatarUrl: '',
        enrolledCourseCount: 0,
        totalLearningMinutes: 0,
        onboardingComplete: true,
        createdAt: serverTimestamp(),
      });

      // Send verification email
      try {
        await sendEmailVerification(user);
      } catch (verifErr) {
        console.error('Error sending email verification:', verifErr);
      }

    } catch (err: any) {
      console.error('Registration error:', err);
      let msg = 'Failed to create account';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Invalid email address';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password is too weak';
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
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Back button */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back to Login</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>I</Text>
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Join INUKA and start your learning journey today
          </Text>
        </View>

        <View style={styles.form}>
          {/* ── Account Type Selector ── */}
          <Text style={styles.sectionLabel}>Account Type</Text>
          <View style={styles.roleGrid}>
            {ACCOUNT_TYPES.map((type) => {
              const active = selectedRole === type.role;
              return (
                <TouchableOpacity
                  key={type.role}
                  style={[
                    styles.roleCard,
                    active && { borderColor: type.color, backgroundColor: type.bg },
                  ]}
                  onPress={() => {
                    setSelectedRole(type.role);
                    setAdminCode('');
                    setError(null);
                  }}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.roleIconBg,
                      { backgroundColor: active ? type.color : Colors.surfaceLight },
                    ]}
                  >
                    <type.Icon
                      size={18}
                      color={active ? Colors.white : Colors.textMuted}
                    />
                  </View>
                  <Text style={[styles.roleLabel, active && { color: type.color }]}>
                    {type.label}
                  </Text>
                  <Text style={styles.roleDesc} numberOfLines={2}>
                    {type.description}
                  </Text>
                  {active && (
                    <View style={[styles.roleDot, { backgroundColor: type.color }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Admin: Full Name ── */}
          {isAdmin && (
            <>
              <Text style={styles.sectionLabel}>Admin Details</Text>
              <Input
                label="Full Name *"
                placeholder="Your full name"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </>
          )}

          {/* ── Admin Code Field ── */}
          {selectedType.requiresCode && (
            <View style={styles.adminCodeWrapper}>
              <View style={[styles.adminCodeBadge, { backgroundColor: selectedType.bg }]}>
                <selectedType.Icon size={14} color={selectedType.color} />
                <Text style={[styles.adminCodeBadgeText, { color: selectedType.color }]}>
                  {selectedType.label} Code Required
                </Text>
              </View>
              <Input
                label="Admin Access Code"
                placeholder={`Enter your ${selectedType.label} code`}
                value={adminCode}
                onChangeText={(text) => { setAdminCode(text); setError(null); }}
                autoCapitalize="characters"
                secureTextEntry
              />
            </View>
          )}

          {/* ── Account Details ── */}
          <Text style={styles.sectionLabel}>
            {isAdmin ? 'Login Details' : 'Your Details'}
          </Text>

          {selectedRole === 'student' && (
            <View style={styles.onboardingNotice}>
              <GraduationCap size={16} color={Colors.primary} />
              <Text style={styles.onboardingNoticeText}>
                After creating your account you&apos;ll set up your profile and preferences.
              </Text>
            </View>
          )}

          <Input
            label="Email Address"
            placeholder="you@gmail.com"
            value={email}
            onChangeText={(t) => { setEmail(t); setError(null); }}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {typoSuggestion && (
            <TouchableOpacity
              style={styles.suggestionBanner}
              onPress={() => {
                setEmail(typoSuggestion);
                setError(null);
              }}
              activeOpacity={0.8}
            >
              <AlertCircle size={14} color={Colors.primary} style={styles.suggestionIcon} />
              <Text style={styles.suggestionText}>
                Did you mean <Text style={styles.suggestionHighlight}>{typoSuggestion}</Text>? Tap to apply
              </Text>
            </TouchableOpacity>
          )}

          <Input
            label="Confirm Email Address"
            placeholder="Re-enter your you@gmail.com"
            value={confirmEmail}
            onChangeText={(t) => { setConfirmEmail(t); setError(null); }}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Input
            label="Password"
            placeholder="At least 12 characters"
            value={password}
            onChangeText={(t) => { setPassword(t); setError(null); }}
            secureTextEntry={!showPassword}
            rightAccessory={
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                {showPassword ? (
                  <EyeOff size={20} color={Colors.textMuted} />
                ) : (
                  <Eye size={20} color={Colors.textMuted} />
                )}
              </TouchableOpacity>
            }
          />

          {password.length > 0 && (
            <View style={styles.strengthContainer}>
              <View style={styles.strengthHeader}>
                <Text style={styles.strengthLabel}>Password Strength:</Text>
                <Text style={[
                  styles.strengthText,
                  metCount <= 2 && { color: Colors.error },
                  metCount > 2 && metCount < 5 && { color: '#d97706' },
                  metCount === 5 && { color: '#059669' },
                ]}>
                  {metCount <= 2 ? 'Weak' : metCount < 5 ? 'Medium' : 'Very Strong'}
                </Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[
                  styles.progressBarFill,
                  { width: `${(metCount / 5) * 100}%` },
                  metCount <= 2 && { backgroundColor: Colors.error },
                  metCount > 2 && metCount < 5 && { backgroundColor: '#d97706' },
                  metCount === 5 && { backgroundColor: '#059669' },
                ]} />
              </View>

              <View style={styles.checklist}>
                <View style={styles.checkItem}>
                  {pwdRules.length ? (
                    <Check size={12} color="#059669" />
                  ) : (
                    <X size={12} color={Colors.error} />
                  )}
                  <Text style={[styles.checkText, pwdRules.length && styles.checkTextMet]}>
                    At least 12 characters
                  </Text>
                </View>
                <View style={styles.checkItem}>
                  {pwdRules.lowercase ? (
                    <Check size={12} color="#059669" />
                  ) : (
                    <X size={12} color={Colors.error} />
                  )}
                  <Text style={[styles.checkText, pwdRules.lowercase && styles.checkTextMet]}>
                    At least one lowercase letter (a-z)
                  </Text>
                </View>
                <View style={styles.checkItem}>
                  {pwdRules.uppercase ? (
                    <Check size={12} color="#059669" />
                  ) : (
                    <X size={12} color={Colors.error} />
                  )}
                  <Text style={[styles.checkText, pwdRules.uppercase && styles.checkTextMet]}>
                    At least one uppercase letter (A-Z)
                  </Text>
                </View>
                <View style={styles.checkItem}>
                  {pwdRules.number ? (
                    <Check size={12} color="#059669" />
                  ) : (
                    <X size={12} color={Colors.error} />
                  )}
                  <Text style={[styles.checkText, pwdRules.number && styles.checkTextMet]}>
                    At least one number (0-9)
                  </Text>
                </View>
                <View style={styles.checkItem}>
                  {pwdRules.symbol ? (
                    <Check size={12} color="#059669" />
                  ) : (
                    <X size={12} color={Colors.error} />
                  )}
                  <Text style={[styles.checkText, pwdRules.symbol && styles.checkTextMet]}>
                    At least one symbol (special character)
                  </Text>
                </View>
              </View>
            </View>
          )}

          <Input
            label="Confirm Password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChangeText={(t) => { setConfirmPassword(t); setError(null); }}
            secureTextEntry={!showConfirmPassword}
            rightAccessory={
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeButton}>
                {showConfirmPassword ? (
                  <EyeOff size={20} color={Colors.textMuted} />
                ) : (
                  <Eye size={20} color={Colors.textMuted} />
                )}
              </TouchableOpacity>
            }
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[
              styles.registerButton,
              { backgroundColor: selectedType.color },
              loading && { opacity: 0.7 },
            ]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.registerButtonText}>
              {loading ? 'Creating Account…' : `Create ${selectedType.label} Account`}
            </Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/login')}>
              <Text style={styles.linkText}>Sign In</Text>
            </TouchableOpacity>
          </View>
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
    paddingTop: 52,
    paddingBottom: 40,
  },
  backButton: {
    marginBottom: Spacing.lg,
  },
  backText: {
    ...Typography.bodySmall,
    color: Colors.primary,
    fontWeight: '600',
  },
  header: {
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  logoMark: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  logoMarkText: {
    color: Colors.white,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
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
  },
  form: {
    marginTop: Spacing.sm,
  },
  sectionLabel: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: Spacing.md,
  },
  // ── Role Grid ──
  roleGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  roleCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.surface,
    padding: 10,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  roleIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  roleLabel: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  roleDesc: {
    fontSize: 9.5,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 13,
  },
  roleDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // ── Onboarding notice ──
  onboardingNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: Spacing.sm,
  },
  onboardingNoticeText: {
    flex: 1,
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
    lineHeight: 18,
  },
  // ── Admin Code ──
  adminCodeWrapper: {
    marginBottom: Spacing.sm,
  },
  adminCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: Spacing.sm,
    gap: 5,
  },
  adminCodeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // ── Form Fields ──
  registerButton: {
    marginTop: Spacing.lg,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerButtonText: {
    color: Colors.white,
    ...Typography.h3,
  },
  errorText: {
    color: Colors.error,
    ...Typography.bodySmall,
    textAlign: 'center',
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  footerText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  linkText: {
    ...Typography.bodySmall,
    color: Colors.primary,
    fontWeight: '600',
  },
  suggestionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 12,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
    gap: 6,
  },
  suggestionIcon: {
    marginTop: 1,
  },
  suggestionText: {
    ...Typography.bodySmall,
    color: Colors.text,
    fontSize: 12,
    flex: 1,
  },
  suggestionHighlight: {
    fontWeight: '700',
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  eyeButton: {
    padding: Spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  strengthContainer: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs + 2,
  },
  strengthLabel: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  strengthText: {
    ...Typography.bodySmall,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  checklist: {
    gap: Spacing.xs,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  checkTextMet: {
    color: '#059669',
    fontWeight: '600',
  },
});
