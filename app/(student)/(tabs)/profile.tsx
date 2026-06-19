import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { useAuth } from '../../../src/context/AuthContext';
import { Colors } from '../../../src/theme/colors';
import { Spacing, Typography } from '../../../src/theme';
import {
  Settings,
  LogOut,
  ChevronRight,
  GraduationCap,
  Clock,
  Award,
  User,
  Camera,
  Download,
  BookOpen,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  BarChart2,
  Trophy,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  doc,
  onSnapshot,
  updateDoc,
  getDocs,
  collection,
  query,
  where,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../src/config/firebase';
import { useFocusEffect, useRouter } from 'expo-router';

interface EnrolledCourse {
  id: string;
  courseId: string;
  courseTitle: string;
  coverUrl?: string;
  progress: number;
  completedAt?: any;
  completedLessonsCount?: number;
  totalLessonsCount?: number;
}

interface Certificate {
  id: string;
  courseId: string;
  courseTitle: string;
  studentName: string;
  certificateId: string;
  pdfUrl: string;
  issuedAt?: any;
}

export default function ProfileScreen() {
  const { signOut, user } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [enrollments, setEnrollments] = useState<EnrolledCourse[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [expandedSection, setExpandedSection] = useState<'learning' | 'certificates' | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) setUserData(snap.data());
      },
      (error) => {
        console.error('User profile snapshot error:', error);
      }
    );
    return () => unsubscribe();
  }, [user]);

  const loadUserData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      // Load certificates
      const certsSnap = await getDocs(
        query(collection(db, 'certificates'), where('userId', '==', user.uid)),
      );
      setCertificates(certsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Certificate)));

      // Load enrollments with course titles
      const enrollSnap = await getDocs(
        query(collection(db, 'enrollments'), where('userId', '==', user.uid)),
      );

      const enrollList: EnrolledCourse[] = [];
      for (const enrollDoc of enrollSnap.docs) {
        const data = enrollDoc.data();
        let courseTitle = data.courseId;
        let coverUrl = '';
        try {
          const courseSnap = await getDocs(
            query(collection(db, 'courses'), where('__name__', '==', data.courseId)),
          );
          if (!courseSnap.empty) {
            const cd = courseSnap.docs[0].data();
            courseTitle = cd.title || data.courseId;
            coverUrl = cd.coverImageUrl || '';
          }
        } catch (_) {}
        enrollList.push({
          id: enrollDoc.id,
          courseId: data.courseId,
          courseTitle,
          coverUrl,
          progress: data.progress || 0,
          completedAt: data.completedAt,
          completedLessonsCount: data.completedLessonsCount,
          totalLessonsCount: data.totalLessonsCount,
        });
      }
      setEnrollments(enrollList);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { loadUserData(); }, [loadUserData]));

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera roll permissions to upload an avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      uploadAvatar(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri: string) => {
    if (!user) return;
    setUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `avatars/${user.uid}`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'users', user.uid), { avatarUrl: downloadURL });
      Alert.alert('Success', 'Profile picture updated!');
    } catch {
      Alert.alert('Error', 'Failed to upload image.');
    } finally {
      setUploading(false);
    }
  };

  const toggleSection = (section: 'learning' | 'certificates') => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  const completedCount = enrollments.filter((e) => e.progress >= 100).length;
  const inProgressCount = enrollments.filter((e) => e.progress > 0 && e.progress < 100).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity style={styles.settingsBtn}>
          <Settings size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          {userData?.avatarUrl ? (
            <Image source={{ uri: userData.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <User size={40} color={Colors.white} />
            </View>
          )}
          <TouchableOpacity
            style={styles.cameraButton}
            onPress={handlePickImage}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Camera size={14} color={Colors.white} />
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.name}>{userData?.fullName || user?.displayName || 'Student'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <GraduationCap size={12} color={Colors.primary} />
          <Text style={styles.roleText}>Student</Text>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{enrollments.length}</Text>
          <Text style={styles.statLabel}>Enrolled</Text>
        </View>
        <View style={[styles.statBox, styles.statBoxMiddle]}>
          <Text style={styles.statValue}>{completedCount}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{certificates.length}</Text>
          <Text style={styles.statLabel}>Certificates</Text>
        </View>
      </View>

      {/* Menu / Expandable Sections */}
      <View style={styles.menuContainer}>
        {/* My Learning */}
        <TouchableOpacity
          style={[styles.menuItem, expandedSection === 'learning' && styles.menuItemActive]}
          onPress={() => toggleSection('learning')}
          activeOpacity={0.7}
        >
          <View style={styles.menuItemLeft}>
            <View style={[styles.iconContainer, { backgroundColor: `${Colors.primary}18` }]}>
              <BookOpen size={20} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.menuLabel}>My Learning</Text>
              <Text style={styles.menuSub}>
                {enrollments.length} course{enrollments.length !== 1 ? 's' : ''} · {inProgressCount} in progress
              </Text>
            </View>
          </View>
          {expandedSection === 'learning' ? (
            <ChevronUp size={18} color={Colors.primary} />
          ) : (
            <ChevronRight size={18} color={Colors.textMuted} />
          )}
        </TouchableOpacity>

        {expandedSection === 'learning' && (
          <View style={styles.expandedContent}>
            {loadingData ? (
              <ActivityIndicator color={Colors.primary} style={{ paddingVertical: 20 }} />
            ) : enrollments.length === 0 ? (
              <View style={styles.emptyExpanded}>
                <BookOpen size={32} color={Colors.textMuted} />
                <Text style={styles.emptyExpandedText}>No courses enrolled yet</Text>
              </View>
            ) : (
              enrollments.map((enroll) => (
                <View key={enroll.id} style={styles.courseProgressCard}>
                  <View style={styles.courseProgressLeft}>
                    <View style={styles.courseProgressIcon}>
                      {enroll.progress >= 100 ? (
                        <CheckCircle size={18} color={Colors.success} />
                      ) : (
                        <BarChart2 size={18} color={Colors.primary} />
                      )}
                    </View>
                    <View style={styles.courseProgressInfo}>
                      <Text style={styles.courseProgressTitle} numberOfLines={1}>
                        {enroll.courseTitle}
                      </Text>
                      <View style={styles.progressBarRow}>
                        <View style={styles.progressBarBg}>
                          <View
                            style={[
                              styles.progressBarFill,
                              { width: `${enroll.progress}%` as any },
                              enroll.progress >= 100 && styles.progressBarComplete,
                            ]}
                          />
                        </View>
                        <Text style={styles.progressPct}>{enroll.progress}%</Text>
                      </View>
                      {enroll.completedAt && (
                        <Text style={styles.completedAtText}>
                          Completed {enroll.completedAt?.toDate?.()?.toLocaleDateString() ?? 'Recently'}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        <View style={styles.divider} />

        {/* Certificates */}
        <TouchableOpacity
          style={[styles.menuItem, expandedSection === 'certificates' && styles.menuItemActive]}
          onPress={() => toggleSection('certificates')}
          activeOpacity={0.7}
        >
          <View style={styles.menuItemLeft}>
            <View style={[styles.iconContainer, { backgroundColor: '#f59e0b18' }]}>
              <Award size={20} color="#f59e0b" />
            </View>
            <View>
              <Text style={styles.menuLabel}>Certificates</Text>
              <Text style={styles.menuSub}>
                {certificates.length} earned certificate{certificates.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
          {expandedSection === 'certificates' ? (
            <ChevronUp size={18} color={Colors.primary} />
          ) : (
            <ChevronRight size={18} color={Colors.textMuted} />
          )}
        </TouchableOpacity>

        {expandedSection === 'certificates' && (
          <View style={styles.expandedContent}>
            {certificates.length === 0 ? (
              <View style={styles.emptyExpanded}>
                <Trophy size={32} color={Colors.textMuted} />
                <Text style={styles.emptyExpandedText}>Complete a course to earn your first certificate!</Text>
              </View>
            ) : (
              certificates.map((cert) => {
                const issuedDate = cert.issuedAt?.toDate
                  ? cert.issuedAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                  : 'Recently';
                return (
                <TouchableOpacity
                  key={cert.id}
                  style={styles.certCard}
                  activeOpacity={0.7}
                  onPress={() => router.push({
                    pathname: '/(student)/certificate/[id]',
                    params: {
                      id: cert.id,
                      studentName: cert.studentName,
                      courseTitle: cert.courseTitle,
                      completionDate: issuedDate,
                      certId: cert.certificateId,
                      pdfUrl: cert.pdfUrl || '',
                    },
                  })}
                >
                  <View style={styles.certGradientBand} />
                  <View style={styles.certBody}>
                    <View style={styles.certIconBg}>
                      <Award size={22} color="#f59e0b" />
                    </View>
                    <View style={styles.certInfo}>
                      <Text style={styles.certTitle} numberOfLines={2}>{cert.courseTitle}</Text>
                      <Text style={styles.certDate}>Issued {issuedDate}</Text>
                      <Text style={styles.certId}>ID: {cert.certificateId}</Text>
                    </View>
                    <ChevronRight size={18} color={Colors.textMuted} />
                  </View>
                </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

        <View style={styles.divider} />

        {/* History */}
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.iconContainer, { backgroundColor: `${Colors.success}18` }]}>
              <Clock size={20} color={Colors.success} />
            </View>
            <View>
              <Text style={styles.menuLabel}>History</Text>
              <Text style={styles.menuSub}>
                {userData?.totalLearningMinutes >= 60
                  ? `${Math.floor(userData.totalLearningMinutes / 60)}h ${Math.floor(userData.totalLearningMinutes % 60)}m`
                  : `${Math.floor(userData?.totalLearningMinutes || 0)}m`}{' '}
                total learning time
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color={Colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Logout */}
        <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={signOut}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
              <LogOut size={20} color={Colors.error} />
            </View>
            <Text style={[styles.menuLabel, { color: Colors.error }]}>Sign Out</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 120 },

  headerBar: {
    paddingTop: 60,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { ...Typography.h1, color: Colors.text },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },

  profileCard: {
    alignItems: 'center',
    margin: Spacing.lg,
    padding: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  avatarContainer: { position: 'relative', marginBottom: Spacing.md },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: { ...Typography.h2, color: Colors.text },
  email: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2, marginBottom: Spacing.sm },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
    marginTop: Spacing.xs,
  },
  roleText: { ...Typography.caption, color: Colors.primary, fontWeight: '700' },

  statsRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md },
  statBoxMiddle: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.glassBorder },
  statValue: { ...Typography.h2, color: Colors.text },
  statLabel: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },

  menuContainer: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  menuItemActive: { backgroundColor: Colors.primaryLight + '50' },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: { ...Typography.body, color: Colors.text, fontWeight: '600' },
  menuSub: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.glassBorder, marginHorizontal: Spacing.md },

  // ─── Expanded Sections ──────────────────
  expandedContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background + '80',
  },
  emptyExpanded: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: 10,
  },
  emptyExpandedText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
  },

  // ─── Course Progress Cards ──────────────────
  courseProgressCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  courseProgressLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  courseProgressIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  courseProgressInfo: { flex: 1 },
  courseProgressTitle: { ...Typography.bodySmall, color: Colors.text, fontWeight: '600', marginBottom: 6 },
  progressBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.surfaceLight,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.primary },
  progressBarComplete: { backgroundColor: Colors.success },
  progressPct: { ...Typography.caption, color: Colors.textMuted, minWidth: 30, textAlign: 'right' },
  completedAtText: { ...Typography.caption, color: Colors.success, marginTop: 4 },

  // ─── Certificate Cards ──────────────────
  certCard: {
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: '#f59e0b30',
    backgroundColor: Colors.surface,
    flexDirection: 'row',
  },
  certGradientBand: {
    width: 6,
    backgroundColor: '#f59e0b',
  },
  certBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: 12,
  },
  certIconBg: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  certInfo: { flex: 1 },
  certTitle: { ...Typography.bodySmall, color: Colors.text, fontWeight: '700', lineHeight: 18 },
  certDate: { ...Typography.caption, color: Colors.textMuted, marginTop: 3 },
  certId: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
    marginTop: 2,
  },
  certDownload: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
