import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { Colors } from '../../src/theme/colors';
import { Spacing, Typography } from '../../src/theme';
import {
  User,
  Calendar,
  BookOpen,
  Clock,
  ChevronRight,
  CheckCircle,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Learning preferences config ─────────────────────────────────────────────
const SUBJECT_OPTIONS = [
  'Networking', 'Cybersecurity', 'Programming', 'Databases',
  'Cloud Computing', 'Web Development', 'Data Science', 'DevOps',
];

const SESSION_OPTIONS = [
  { label: '15 min', value: '15min', desc: 'Quick daily sessions' },
  { label: '30 min', value: '30min', desc: 'Focused learning' },
  { label: '60 min', value: '60min', desc: 'Deep dive sessions' },
  { label: '90+ min', value: '90min', desc: 'Intensive study' },
];

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepDot({ active, done }: { active: boolean; done: boolean }) {
  return (
    <View style={[
      s.dot,
      active && s.dotActive,
      done && s.dotDone,
    ]}>
      {done && <CheckCircle size={10} color="#fff" />}
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [step, setStep] = useState(0); // 0 = name/dob, 1 = preferences
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [sessionLength, setSessionLength] = useState('30min');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [dobError, setDobError] = useState('');

  const toggleSubject = (subject: string) => {
    setSelectedSubjects(prev =>
      prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
    );
  };

  const validateStep0 = (): boolean => {
    let valid = true;
    if (!fullName.trim()) {
      setNameError('Full name is required for your certificate');
      valid = false;
    } else {
      setNameError('');
    }
    // Basic date validation: YYYY-MM-DD or DD/MM/YYYY
    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) && !/^\d{2}\/\d{2}\/\d{4}$/.test(dateOfBirth)) {
      setDobError('Use format YYYY-MM-DD (e.g. 1999-04-15)');
      valid = false;
    } else {
      setDobError('');
    }
    return valid;
  };

  const handleNext = () => {
    if (step === 0 && !validateStep0()) return;
    setStep(1);
  };

  const handleFinish = async () => {
    if (!user) return;
    if (selectedSubjects.length === 0) {
      Alert.alert('Select Interests', 'Please pick at least one subject to personalise your learning feed.');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        fullName: fullName.trim(),
        dateOfBirth: dateOfBirth.trim() || null,
        learningPreferences: {
          subjects: selectedSubjects,
          sessionLength,
        },
        onboardingComplete: true,
        updatedAt: serverTimestamp(),
      });
      // AuthContext onSnapshot will update profile — _layout.tsx will then route to tabs
      router.replace('/(student)/(tabs)');
    } catch (err) {
      console.error('Onboarding save error:', err);
      Alert.alert('Error', 'Failed to save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header gradient */}
      <LinearGradient
        colors={['#1a1a2e', '#1a73e8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.headerGradient}
      >
        <Text style={s.headerLogo}>Inuka</Text>
        <Text style={s.headerTitle}>
          {step === 0 ? 'Tell us about yourself' : 'Personalise your learning'}
        </Text>
        <Text style={s.headerSub}>
          {step === 0
            ? 'This info will appear on your certificates'
            : "We'll curate courses just for you"}
        </Text>

        {/* Step indicator */}
        <View style={s.stepRow}>
          <StepDot active={step === 0} done={step > 0} />
          <View style={s.stepLine} />
          <StepDot active={step === 1} done={false} />
        </View>
      </LinearGradient>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 0 ? (
          /* ── Step 0: Name & DOB ──────────────────────────────── */
          <View style={s.formCard}>
            <View style={s.fieldGroup}>
              <View style={s.fieldHeader}>
                <View style={s.iconBg}>
                  <User size={18} color={Colors.primary} />
                </View>
                <View>
                  <Text style={s.fieldLabel}>Full Name *</Text>
                  <Text style={s.fieldHint}>Exactly as it should appear on certificates</Text>
                </View>
              </View>
              <TextInput
                style={[s.input, nameError ? s.inputError : null]}
                placeholder="e.g. Jane Wanjiku Kamau"
                value={fullName}
                onChangeText={v => { setFullName(v); setNameError(''); }}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
              />
              {nameError ? <Text style={s.errorText}>{nameError}</Text> : null}
            </View>

            <View style={s.fieldGroup}>
              <View style={s.fieldHeader}>
                <View style={[s.iconBg, { backgroundColor: '#fef3c7' }]}>
                  <Calendar size={18} color="#f59e0b" />
                </View>
                <View>
                  <Text style={s.fieldLabel}>Date of Birth</Text>
                  <Text style={s.fieldHint}>Optional · YYYY-MM-DD format</Text>
                </View>
              </View>
              <TextInput
                style={[s.input, dobError ? s.inputError : null]}
                placeholder="e.g. 1999-04-15"
                value={dateOfBirth}
                onChangeText={v => { setDateOfBirth(v); setDobError(''); }}
                keyboardType="numbers-and-punctuation"
                returnKeyType="done"
              />
              {dobError ? <Text style={s.errorText}>{dobError}</Text> : null}
            </View>

            <TouchableOpacity
              style={s.nextBtn}
              onPress={handleNext}
              activeOpacity={0.85}
            >
              <Text style={s.nextBtnText}>Next</Text>
              <ChevronRight size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Step 1: Learning Preferences ───────────────────── */
          <View style={s.formCard}>
            <View style={s.fieldGroup}>
              <View style={s.fieldHeader}>
                <View style={[s.iconBg, { backgroundColor: '#d1fae5' }]}>
                  <BookOpen size={18} color="#059669" />
                </View>
                <View>
                  <Text style={s.fieldLabel}>Subject Interests</Text>
                  <Text style={s.fieldHint}>Select all that apply</Text>
                </View>
              </View>
              <View style={s.chipGrid}>
                {SUBJECT_OPTIONS.map(subject => {
                  const sel = selectedSubjects.includes(subject);
                  return (
                    <TouchableOpacity
                      key={subject}
                      style={[s.chip, sel && s.chipActive]}
                      onPress={() => toggleSubject(subject)}
                      activeOpacity={0.7}
                    >
                      {sel && <CheckCircle size={12} color="#fff" />}
                      <Text style={[s.chipText, sel && s.chipTextActive]}>
                        {subject}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={s.fieldGroup}>
              <View style={s.fieldHeader}>
                <View style={[s.iconBg, { backgroundColor: '#ede9fe' }]}>
                  <Clock size={18} color="#7c3aed" />
                </View>
                <View>
                  <Text style={s.fieldLabel}>Preferred Session Length</Text>
                  <Text style={s.fieldHint}>How long do you like to study at a time?</Text>
                </View>
              </View>
              <View style={s.sessionGrid}>
                {SESSION_OPTIONS.map(opt => {
                  const sel = sessionLength === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[s.sessionCard, sel && s.sessionCardActive]}
                      onPress={() => setSessionLength(opt.value)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.sessionLabel, sel && s.sessionLabelActive]}>
                        {opt.label}
                      </Text>
                      <Text style={[s.sessionDesc, sel && { color: '#fff' }]}>
                        {opt.desc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={s.btnRow}>
              <TouchableOpacity style={s.backBtn} onPress={() => setStep(0)} activeOpacity={0.7}>
                <Text style={s.backBtnText}>← Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.finishBtn, saving && { opacity: 0.7 }]}
                onPress={handleFinish}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Text style={s.finishBtnText}>Let's Go!</Text>
                    <CheckCircle size={18} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // ── Header ──
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 64 : 52,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 36,
  },
  headerLogo: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 36,
    marginBottom: 8,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  dotDone: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginHorizontal: 8,
    maxWidth: 60,
  },

  // ── Scroll ──
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingTop: 24 },

  // ── Card ──
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },

  // ── Fields ──
  fieldGroup: { marginBottom: Spacing.xl },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  iconBg: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldLabel: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.text,
  },
  fieldHint: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 1,
  },
  input: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1.5,
    borderColor: Colors.glassBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: 6,
    paddingLeft: 4,
  },

  // ── Chips ──
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.surfaceLight,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: '#fff',
  },

  // ── Session cards ──
  sessionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sessionCard: {
    width: '47%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.surfaceLight,
  },
  sessionCardActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sessionLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  sessionLabelActive: { color: '#fff' },
  sessionDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 15,
  },

  // ── Buttons ──
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 15,
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Spacing.sm,
  },
  backBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.glassBorder,
  },
  backBtnText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  finishBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 16,
    paddingVertical: 15,
    gap: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  finishBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
