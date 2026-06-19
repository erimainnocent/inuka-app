import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { Colors } from '../../../src/theme/colors';
import { Spacing, Typography } from '../../../src/theme';
import {
  collection,
  query,
  getDocs,
  where,
  doc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../../../src/config/firebase';
import {
  RefreshCw,
  User,
  Trash2,
  Ban,
  CheckCircle,
  BookOpen,
  Clock,
  TrendingUp,
  X,
  ChevronRight,
} from 'lucide-react-native';
import { useAuth } from '../../../src/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Enrollment {
  id: string;
  courseId: string;
  courseTitle: string;
  courseCover: string;
  courseCategory: string;
  watchedMinutes: number;
  progress: number;
  enrolledAt: any;
}

interface StudentDetail {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string;
  isDisabled: boolean;
  enrolledCourseCount: number;
  totalLearningMinutes: number;
  enrollments: Enrollment[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatMinutes(mins: number): string {
  if (!mins || mins < 1) return '< 1 min';
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(Math.max(value || 0, 0), 100);
  const color = pct >= 80 ? Colors.success : pct >= 40 ? Colors.warning : Colors.primary;
  return (
    <View style={pb.track}>
      <View style={[pb.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  );
}
const pb = StyleSheet.create({
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.surfaceLight,
    overflow: 'hidden',
    marginTop: 4,
  },
  fill: { height: 5, borderRadius: 3 },
});

// ─── Student Detail Modal ─────────────────────────────────────────────────────
function StudentDetailModal({
  student,
  onClose,
}: {
  student: StudentDetail | null;
  onClose: () => void;
}) {
  if (!student) return null;

  const totalWatched = student.enrollments.reduce(
    (acc, e) => acc + (e.watchedMinutes || 0),
    0
  );
  const activeCourses = student.enrollments.filter(
    (e) => (e.watchedMinutes || 0) > 0
  ).length;

  return (
    <Modal
      animationType="slide"
      transparent
      visible={!!student}
      onRequestClose={onClose}
    >
      <Pressable style={modal.overlay} onPress={onClose}>
        <Pressable style={modal.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Handle */}
          <View style={modal.handle} />

          {/* Header */}
          <View style={modal.header}>
            {student.avatarUrl ? (
              <Image source={{ uri: student.avatarUrl }} style={modal.avatar} />
            ) : (
              <View style={modal.avatarPlaceholder}>
                <Text style={modal.avatarInitial}>
                  {(student.fullName || student.email || 'U')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View style={modal.headerInfo}>
              <Text style={modal.studentName} numberOfLines={1}>
                {student.fullName || 'Unknown Student'}
              </Text>
              <Text style={modal.studentEmail} numberOfLines={1}>
                {student.email}
              </Text>
              <View
                style={[
                  modal.statusBadge,
                  { backgroundColor: student.isDisabled ? '#fee2e2' : '#d1fae5' },
                ]}
              >
                <View
                  style={[
                    modal.statusDot,
                    { backgroundColor: student.isDisabled ? Colors.error : Colors.success },
                  ]}
                />
                <Text
                  style={[
                    modal.statusText,
                    { color: student.isDisabled ? Colors.error : Colors.success },
                  ]}
                >
                  {student.isDisabled ? 'Disabled' : 'Active'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={modal.closeBtn} onPress={onClose}>
              <X size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Stats Row */}
          <View style={modal.statsRow}>
            {[
              {
                icon: BookOpen,
                color: Colors.primary,
                bg: Colors.primaryLight,
                value: student.enrollments.length.toString(),
                label: 'Enrolled',
              },
              {
                icon: TrendingUp,
                color: '#059669',
                bg: '#d1fae5',
                value: activeCourses.toString(),
                label: 'Active',
              },
              {
                icon: Clock,
                color: '#d97706',
                bg: '#fef3c7',
                value: formatMinutes(totalWatched),
                label: 'Watched',
              },
            ].map((s, i) => (
              <View key={i} style={modal.statCard}>
                <View style={[modal.statIcon, { backgroundColor: s.bg }]}>
                  <s.icon size={14} color={s.color} />
                </View>
                <Text style={[modal.statValue, { color: s.color }]}>{s.value}</Text>
                <Text style={modal.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Course List */}
          <Text style={modal.sectionTitle}>Enrolled Courses</Text>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={modal.courseList}
          >
            {student.enrollments.length === 0 ? (
              <View style={modal.emptyEnrollment}>
                <BookOpen size={32} color={Colors.textMuted} />
                <Text style={modal.emptyText}>No courses enrolled yet</Text>
              </View>
            ) : (
              student.enrollments.map((enrollment) => {
                const pct = enrollment.progress || 0;
                const progressColor =
                  pct >= 80
                    ? Colors.success
                    : pct >= 40
                    ? Colors.warning
                    : Colors.primary;
                return (
                  <View key={enrollment.id} style={modal.courseCard}>
                    {enrollment.courseCover ? (
                      <Image
                        source={{ uri: enrollment.courseCover }}
                        style={modal.courseCover}
                      />
                    ) : (
                      <View style={[modal.courseCover, modal.courseCoverPlaceholder]}>
                        <BookOpen size={18} color={Colors.primary} />
                      </View>
                    )}
                    <View style={modal.courseInfo}>
                      <Text style={modal.courseTitle} numberOfLines={2}>
                        {enrollment.courseTitle}
                      </Text>
                      <Text style={modal.courseCategory}>
                        {enrollment.courseCategory || 'Uncategorized'}
                      </Text>

                      {/* Progress bar */}
                      <View style={modal.progressRow}>
                        <ProgressBar value={pct} />
                        <View style={modal.progressMeta}>
                          <Text style={[modal.progressPct, { color: progressColor }]}>
                            {pct}%
                          </Text>
                          <View style={modal.watchedBadge}>
                            <Clock size={9} color={Colors.textSecondary} />
                            <Text style={modal.watchedText}>
                              {formatMinutes(enrollment.watchedMinutes)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AdminStudentsScreen() {
  const { role } = useAuth();
  const isSuperAdmin = role === 'super_admin';

  const [students, setStudents] = useState<any[]>([]);
  const [courseMap, setCourseMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      // Fetch students + courses in parallel
      const [studentsSnap, coursesSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
        getDocs(collection(db, 'courses')),
      ]);

      // Build course lookup map
      const cMap: Record<string, any> = {};
      coursesSnap.forEach((d) => {
        const data = d.data();
        cMap[d.id] = data;
        // Also index by the 'id' field inside document (some use custom id field)
        if (data.id) cMap[data.id] = data;
      });
      setCourseMap(cMap);

      const fetched: any[] = [];
      studentsSnap.forEach((d) => fetched.push({ id: d.id, ...d.data() }));
      setStudents(fetched);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load students');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  // Open student detail → fetch their enrollments
  const openStudentDetail = useCallback(
    async (student: any) => {
      setDetailLoading(true);
      try {
        const enrollSnap = await getDocs(
          query(collection(db, 'enrollments'), where('userId', '==', student.uid || student.id))
        );

        const enrollments: Enrollment[] = [];
        enrollSnap.forEach((d) => {
          const data = d.data();
          const course = courseMap[data.courseId] || {};
          enrollments.push({
            id: d.id,
            courseId: data.courseId,
            courseTitle: course.title || data.courseId,
            courseCover: course.coverImageUrl || '',
            courseCategory: course.category || '',
            watchedMinutes: data.watchedMinutes || 0,
            progress: data.progress || 0,
            enrolledAt: data.enrolledAt,
          });
        });

        // Sort: most watched first
        enrollments.sort((a, b) => b.watchedMinutes - a.watchedMinutes);

        setSelectedStudent({
          id: student.id,
          fullName: student.fullName,
          email: student.email,
          avatarUrl: student.avatarUrl,
          isDisabled: student.isDisabled,
          enrolledCourseCount: student.enrolledCourseCount,
          totalLearningMinutes: student.totalLearningMinutes,
          enrollments,
        });
      } catch (err) {
        console.error('Error loading enrollments:', err);
        Alert.alert('Error', 'Failed to load student details');
      } finally {
        setDetailLoading(false);
      }
    },
    [courseMap]
  );

  // ── Super Admin actions ────────────────────────────────────────────────────
  const handleToggleDisable = async (student: any) => {
    const newDisabled = !student.isDisabled;
    const actionLabel = newDisabled ? 'Disable' : 'Enable';
    Alert.alert(
      `${actionLabel} Student`,
      `Are you sure you want to ${actionLabel.toLowerCase()} ${student.fullName || student.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionLabel,
          style: newDisabled ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'users', student.id), { isDisabled: newDisabled });
              setStudents((prev) =>
                prev.map((s) =>
                  s.id === student.id ? { ...s, isDisabled: newDisabled } : s
                )
              );
            } catch (err) {
              console.error(err);
              Alert.alert('Error', `Failed to ${actionLabel.toLowerCase()} student`);
            }
          },
        },
      ]
    );
  };

  const handleDelete = async (student: any) => {
    Alert.alert(
      'Delete Student',
      `Permanently delete ${student.fullName || student.email}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'users', student.id));
              setStudents((prev) => prev.filter((s) => s.id !== student.id));
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'Failed to delete student');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Students</Text>
          <Text style={styles.subtitle}>
            {students.length} registered student{students.length !== 1 ? 's' : ''} · Tap to view progress
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          {detailLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <RefreshCw size={18} color={Colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={students}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View>
            <TouchableOpacity
              style={[styles.studentCard, item.isDisabled && styles.disabledCard]}
              onPress={() => openStudentDetail(item)}
              activeOpacity={0.75}
            >
              {item.avatarUrl ? (
                <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
              ) : (
                <View
                  style={[
                    styles.avatarPlaceholder,
                    item.isDisabled && { backgroundColor: Colors.textMuted },
                  ]}
                >
                  <Text style={styles.avatarInitial}>
                    {(item.fullName || item.email || 'U')[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.info}>
                <Text style={[styles.name, item.isDisabled && { color: Colors.textMuted }]}>
                  {item.fullName || 'Unknown Student'}
                </Text>
                <Text style={styles.email}>{item.email}</Text>
                <View style={styles.quickStats}>
                  <View style={styles.quickStat}>
                    <BookOpen size={10} color={Colors.primary} />
                    <Text style={styles.quickStatText}>
                      {item.enrolledCourseCount || 0} course{item.enrolledCourseCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={styles.quickStatDivider} />
                  <View style={styles.quickStat}>
                    <Clock size={10} color={Colors.warning} />
                    <Text style={styles.quickStatText}>
                      {formatMinutes(item.totalLearningMinutes || 0)}
                    </Text>
                  </View>
                </View>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: item.isDisabled ? '#fee2e2' : '#d1fae5' },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: item.isDisabled ? Colors.error : Colors.success },
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    { color: item.isDisabled ? Colors.error : Colors.success },
                  ]}
                >
                  {item.isDisabled ? 'Off' : 'On'}
                </Text>
              </View>
              <ChevronRight size={16} color={Colors.textMuted} style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            {/* Super Admin row of action buttons under the card */}
            {isSuperAdmin && (
              <View style={styles.adminActions}>
                <TouchableOpacity
                  style={[
                    styles.adminActionBtn,
                    { backgroundColor: item.isDisabled ? '#d1fae5' : '#fee2e2' },
                  ]}
                  onPress={() => handleToggleDisable(item)}
                >
                  {item.isDisabled ? (
                    <CheckCircle size={13} color={Colors.success} />
                  ) : (
                    <Ban size={13} color={Colors.error} />
                  )}
                  <Text
                    style={[
                      styles.adminActionText,
                      { color: item.isDisabled ? Colors.success : Colors.error },
                    ]}
                  >
                    {item.isDisabled ? 'Enable' : 'Disable'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.adminActionBtn, { backgroundColor: '#fee2e2' }]}
                  onPress={() => handleDelete(item)}
                >
                  <Trash2 size={13} color={Colors.error} />
                  <Text style={[styles.adminActionText, { color: Colors.error }]}>
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBg}>
              <User size={40} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No Students Yet</Text>
            <Text style={styles.emptySubtitle}>
              Students will appear here once they register.
            </Text>
          </View>
        }
      />

      {/* Student Detail Modal */}
      <StudentDetailModal
        student={selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  title: { ...Typography.h1, color: Colors.text },
  subtitle: { ...Typography.caption, color: Colors.textSecondary, marginTop: 4 },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: { padding: Spacing.lg, paddingBottom: 100 },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  disabledCard: { opacity: 0.65, borderColor: Colors.error + '40' },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.primaryLight,
  },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarInitial: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  info: { flex: 1 },
  name: { ...Typography.body, fontWeight: '600', color: Colors.text },
  email: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
  quickStats: { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 6 },
  quickStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  quickStatText: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600' },
  quickStatDivider: {
    width: 1,
    height: 10,
    backgroundColor: Colors.glassBorder,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 20,
    marginLeft: 6,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3, marginRight: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  // Super Admin action row
  adminActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: Spacing.sm,
  },
  adminActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  adminActionText: { fontSize: 11, fontWeight: '700' },
  // Empty
  emptyState: { alignItems: 'center', paddingTop: Spacing.xxl },
  emptyIconBg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: { ...Typography.h2, color: Colors.text },
  emptySubtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});

// ─── Modal Styles ─────────────────────────────────────────────────────────────
const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
    maxHeight: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.glassBorder,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.primaryLight,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarInitial: { color: Colors.white, fontSize: 20, fontWeight: '700' },
  headerInfo: { flex: 1 },
  studentName: { ...Typography.h3, color: Colors.text },
  studentEmail: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 4,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3, marginRight: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  statLabel: { fontSize: 10, color: Colors.textSecondary, marginTop: 1 },
  // Course list
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  courseList: { paddingBottom: 20 },
  courseCard: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  courseCover: {
    width: 72,
    height: 72,
  },
  courseCoverPlaceholder: {
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  courseInfo: {
    flex: 1,
    padding: Spacing.sm,
    paddingLeft: Spacing.md,
    justifyContent: 'center',
  },
  courseTitle: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 16,
  },
  courseCategory: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressRow: { marginTop: 6 },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 3,
  },
  progressPct: { fontSize: 11, fontWeight: '800' },
  watchedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  watchedText: { fontSize: 10, color: Colors.textSecondary },
  emptyEnrollment: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyText: { ...Typography.bodySmall, color: Colors.textMuted },
});
