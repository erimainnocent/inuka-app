/**
 * progress.tsx – Admin Course Progress Dashboard
 *
 * MVP thresholds (practical, adjustable at top of file):
 *   STARTED_MINUTES  = watchedMinutes >= 2 minutes   → student has meaningfully engaged
 *   COMPLETED_PCT    = progress >= 90%                → course considered complete
 *   INACTIVE_DAYS    = no lastActiveAt for >= 7 days  → or never started after 3+ days enrolled
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Pressable,
  Image,
  RefreshControl,
} from 'react-native';
import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../../src/config/firebase';
import { Colors } from '../../../src/theme/colors';
import { Spacing, Typography } from '../../../src/theme';
import {
  BarChart2,
  Users,
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  X,
  BookOpen,
  TrendingUp,
  Calendar,
} from 'lucide-react-native';
import { useAuth, isAdminRole } from '../../../src/context/AuthContext';

// ─── Thresholds ───────────────────────────────────────────────────────────────
const STARTED_MINUTES = 2;    // watchedMinutes to count as "started"
const COMPLETED_PCT   = 90;   // progress % to count as "completed"
const INACTIVE_DAYS   = 7;    // days without lastActiveAt → inactive

// ─── Types ────────────────────────────────────────────────────────────────────
interface StudentRow {
  uid: string;
  fullName: string;
  email: string;
  avatarUrl: string;
  watchedMinutes: number;
  progress: number;
  enrolledAt: any;
  lastActiveAt: any;
  status: 'completed' | 'started' | 'inactive' | 'not_started';
}

interface CourseSummary {
  courseId: string;
  title: string;
  category: string;
  coverImageUrl: string;
  enrolled: number;
  started: number;
  completed: number;
  inactive: number;
  notStarted: number;
  totalWatchedMinutes: number;
  avgProgress: number;
  students: StudentRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatMinutes(mins: number): string {
  if (!mins || mins < 1) return '< 1m';
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(ts: any): string {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

function daysAgo(ts: any): number | null {
  if (!ts) return null;
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return Math.floor((Date.now() - d.getTime()) / 86_400_000);
  } catch {
    return null;
  }
}

function classifyStudent(e: any): StudentRow['status'] {
  const watched = e.watchedMinutes || 0;
  const progress = e.progress || 0;

  if (progress >= COMPLETED_PCT) return 'completed';
  if (watched >= STARTED_MINUTES) {
    // Check if inactive: started but hasn't been active recently
    const days = daysAgo(e.lastActiveAt);
    if (days !== null && days >= INACTIVE_DAYS) return 'inactive';
    return 'started';
  }
  // Never meaningfully watched — check how long they've been enrolled
  const enrollDays = daysAgo(e.enrolledAt);
  if (enrollDays !== null && enrollDays >= 3) return 'inactive'; // enrolled 3+ days, zero watch
  return 'not_started';
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const STATUS_META = {
  completed:   { label: 'Completed',   color: Colors.success, bg: '#d1fae5', Icon: CheckCircle2 },
  started:     { label: 'In Progress', color: Colors.primary, bg: Colors.primaryLight, Icon: PlayCircle },
  inactive:    { label: 'Inactive',    color: Colors.warning, bg: '#fef3c7', Icon: AlertCircle },
  not_started: { label: 'Not Started', color: Colors.textMuted, bg: Colors.surfaceLight, Icon: Clock },
} as const;

function StatusBadge({ status }: { status: StudentRow['status'] }) {
  const m = STATUS_META[status];
  return (
    <View style={[sb.badge, { backgroundColor: m.bg }]}>
      <m.Icon size={10} color={m.color} />
      <Text style={[sb.label, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}
const sb = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  label: { fontSize: 10, fontWeight: '700' },
});

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <View style={mb.track}>
      <View style={[mb.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  );
}
const mb = StyleSheet.create({
  track: { height: 5, borderRadius: 3, backgroundColor: Colors.surfaceLight, overflow: 'hidden', flex: 1 },
  fill: { height: 5, borderRadius: 3 },
});

// ─── Course Stat Ring (enrollment funnel) ────────────────────────────────────
function CourseFunnel({ course }: { course: CourseSummary }) {
  const total = course.enrolled || 1;
  const stats = [
    { label: 'Started',    value: course.started,    color: Colors.primary,  pct: Math.round((course.started / total) * 100) },
    { label: 'Completed',  value: course.completed,  color: Colors.success,  pct: Math.round((course.completed / total) * 100) },
    { label: 'Inactive',   value: course.inactive,   color: Colors.warning,  pct: Math.round((course.inactive / total) * 100) },
    { label: 'Not Started',value: course.notStarted, color: Colors.textMuted,pct: Math.round((course.notStarted / total) * 100) },
  ];
  return (
    <View style={cf.container}>
      {stats.map((s) => (
        <View key={s.label} style={cf.row}>
          <Text style={[cf.label, { color: s.color }]}>{s.label}</Text>
          <MiniBar value={s.value} max={total} color={s.color} />
          <Text style={[cf.value, { color: s.color }]}>{s.value}</Text>
          <Text style={cf.pct}>({s.pct}%)</Text>
        </View>
      ))}
    </View>
  );
}
const cf = StyleSheet.create({
  container: { marginTop: Spacing.sm, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 11, fontWeight: '700', width: 76 },
  value: { fontSize: 11, fontWeight: '800', width: 20, textAlign: 'right' },
  pct: { fontSize: 10, color: Colors.textMuted, width: 38 },
});

// ─── Course Detail Modal ───────────────────────────────────────────────────────
function CourseDetailModal({
  course,
  onClose,
}: {
  course: CourseSummary | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<StudentRow['status'] | 'all'>('all');
  if (!course) return null;

  const tabs: Array<{ key: StudentRow['status'] | 'all'; label: string; count: number; color: string }> = [
    { key: 'all',         label: 'All',       count: course.enrolled,   color: Colors.text },
    { key: 'started',     label: 'Active',    count: course.started,    color: Colors.primary },
    { key: 'completed',   label: 'Done',      count: course.completed,  color: Colors.success },
    { key: 'inactive',    label: 'Idle',      count: course.inactive,   color: Colors.warning },
    { key: 'not_started', label: 'New',       count: course.notStarted, color: Colors.textMuted },
  ];

  const filtered = tab === 'all'
    ? course.students
    : course.students.filter((s) => s.status === tab);

  return (
    <Modal animationType="slide" transparent visible={!!course} onRequestClose={onClose}>
      <Pressable style={dm.overlay} onPress={onClose}>
        <Pressable style={dm.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={dm.handle} />

          {/* Header */}
          <View style={dm.header}>
            {course.coverImageUrl ? (
              <Image source={{ uri: course.coverImageUrl }} style={dm.cover} />
            ) : (
              <View style={[dm.cover, dm.coverPlaceholder]}>
                <BookOpen size={16} color={Colors.primary} />
              </View>
            )}
            <View style={dm.headerInfo}>
              <Text style={dm.courseTitle} numberOfLines={2}>{course.title}</Text>
              <Text style={dm.courseCategory}>{course.category}</Text>
              <Text style={dm.courseMeta}>
                {course.enrolled} enrolled · avg {course.avgProgress}% · {formatMinutes(course.totalWatchedMinutes)} total
              </Text>
            </View>
            <TouchableOpacity style={dm.closeBtn} onPress={onClose}>
              <X size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Funnel */}
          <CourseFunnel course={course} />

          {/* Filter tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={dm.tabScroll}
            contentContainerStyle={dm.tabRow}
          >
            {tabs.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[dm.tab, tab === t.key && { borderBottomColor: t.color, borderBottomWidth: 2 }]}
                onPress={() => setTab(t.key)}
              >
                <Text style={[dm.tabText, tab === t.key ? { color: t.color, fontWeight: '700' } : {}]}>
                  {t.label} ({t.count})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Student rows */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={dm.studentList}>
            {filtered.length === 0 ? (
              <View style={dm.empty}>
                <Users size={28} color={Colors.textMuted} />
                <Text style={dm.emptyText}>No students in this category</Text>
              </View>
            ) : (
              filtered.map((s) => (
                <View key={s.uid} style={dm.studentRow}>
                  {s.avatarUrl ? (
                    <Image source={{ uri: s.avatarUrl }} style={dm.avatar} />
                  ) : (
                    <View style={dm.avatarPlaceholder}>
                      <Text style={dm.avatarInitial}>
                        {(s.fullName || s.email || 'U')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={dm.studentInfo}>
                    <Text style={dm.studentName} numberOfLines={1}>{s.fullName || s.email}</Text>
                    <View style={dm.studentMeta}>
                      <Clock size={9} color={Colors.textMuted} />
                      <Text style={dm.metaText}>{formatMinutes(s.watchedMinutes)}</Text>
                      <Text style={dm.metaDivider}>·</Text>
                      <TrendingUp size={9} color={Colors.textMuted} />
                      <Text style={dm.metaText}>{s.progress}%</Text>
                      {s.lastActiveAt && (
                        <>
                          <Text style={dm.metaDivider}>·</Text>
                          <Calendar size={9} color={Colors.textMuted} />
                          <Text style={dm.metaText}>
                            {daysAgo(s.lastActiveAt) === 0
                              ? 'Today'
                              : `${daysAgo(s.lastActiveAt)}d ago`}
                          </Text>
                        </>
                      )}
                    </View>
                    {/* Progress bar */}
                    <View style={dm.progressRow}>
                      <MiniBar
                        value={s.progress}
                        max={100}
                        color={STATUS_META[s.status].color}
                      />
                      <Text style={[dm.progressPct, { color: STATUS_META[s.status].color }]}>
                        {s.progress}%
                      </Text>
                    </View>
                  </View>
                  <StatusBadge status={s.status} />
                </View>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const dm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
    maxHeight: '92%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.glassBorder, alignSelf: 'center', marginBottom: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.sm },
  cover: { width: 60, height: 60, borderRadius: 12 },
  coverPlaceholder: { backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1 },
  courseTitle: { ...Typography.bodySmall, fontWeight: '700', color: Colors.text, lineHeight: 18 },
  courseCategory: { fontSize: 10, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  courseMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
  closeBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  tabScroll: { marginTop: Spacing.md, marginBottom: Spacing.sm },
  tabRow: { gap: 4, paddingBottom: 2 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 12, color: Colors.textSecondary },
  studentList: { paddingBottom: 20, gap: 8 },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    gap: Spacing.sm,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.primaryLight },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  studentInfo: { flex: 1 },
  studentName: { ...Typography.bodySmall, fontWeight: '600', color: Colors.text },
  studentMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { fontSize: 10, color: Colors.textSecondary },
  metaDivider: { fontSize: 10, color: Colors.textMuted },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  progressPct: { fontSize: 10, fontWeight: '800', minWidth: 28, textAlign: 'right' },
  empty: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyText: { ...Typography.bodySmall, color: Colors.textMuted },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProgressDashboard() {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<CourseSummary | null>(null);
  const { role, loading: authLoading } = useAuth();
  const isAdmin = isAdminRole(role);

  // Global summary stats
  const totalEnrolled  = courses.reduce((a, c) => a + c.enrolled, 0);
  const totalStarted   = courses.reduce((a, c) => a + c.started, 0);
  const totalCompleted = courses.reduce((a, c) => a + c.completed, 0);
  const totalInactive  = courses.reduce((a, c) => a + c.inactive, 0);

  useEffect(() => {
    if (isAdmin && !authLoading) {
      load();
    }
  }, [isAdmin, authLoading, load]);

  const load = useCallback(async () => {
    try {
      // Fetch everything in parallel
      const [coursesSnap, enrollmentsSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, 'courses')),
        getDocs(collection(db, 'enrollments')),
        getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
      ]);

      // Build lookups
      const courseMap: Record<string, any> = {};
      coursesSnap.forEach((d) => {
        const data = d.data();
        courseMap[d.id] = data;
        if (data.id) courseMap[data.id] = data;
      });

      const userMap: Record<string, any> = {};
      usersSnap.forEach((d) => {
        const data = d.data();
        userMap[data.uid || d.id] = data;
      });

      // Group enrollments by courseId
      const byCoursе: Record<string, any[]> = {};
      enrollmentsSnap.forEach((d) => {
        const data = d.data();
        const cid = data.courseId;
        if (!byCoursе[cid]) byCoursе[cid] = [];
        byCoursе[cid].push(data);
      });

      // Build summary per course
      const summaries: CourseSummary[] = Object.entries(byCoursе).map(([cid, enrollments]) => {
        const course = courseMap[cid] || {};
        let st = 0, cp = 0, ia = 0, ns = 0, totalMin = 0, progSum = 0;

        const students: StudentRow[] = enrollments.map((e) => {
          const user = userMap[e.userId] || {};
          const status = classifyStudent(e);
          if (status === 'started')     st++;
          if (status === 'completed')   cp++;
          if (status === 'inactive')    ia++;
          if (status === 'not_started') ns++;
          totalMin += e.watchedMinutes || 0;
          progSum  += e.progress || 0;
          return {
            uid:           e.userId,
            fullName:      user.fullName || '',
            email:         user.email || e.userId,
            avatarUrl:     user.avatarUrl || '',
            watchedMinutes: e.watchedMinutes || 0,
            progress:      e.progress || 0,
            enrolledAt:    e.enrolledAt,
            lastActiveAt:  e.lastActiveAt || null,
            status,
          };
        });

        // Sort: completed → started → inactive → not_started
        const ORDER = { completed: 0, started: 1, inactive: 2, not_started: 3 };
        students.sort((a, b) => ORDER[a.status] - ORDER[b.status]);

        return {
          courseId: cid,
          title: course.title || cid,
          category: course.category || 'Uncategorized',
          coverImageUrl: course.coverImageUrl || '',
          enrolled: enrollments.length,
          started: st,
          completed: cp,
          inactive: ia,
          notStarted: ns,
          totalWatchedMinutes: totalMin,
          avgProgress: enrollments.length > 0 ? Math.round(progSum / enrollments.length) : 0,
          students,
        };
      });

      // Sort courses by most enrolled
      summaries.sort((a, b) => b.enrolled - a.enrolled);
      setCourses(summaries);
    } catch (err) {
      console.error('Progress load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Progress Tracking</Text>
          <Text style={styles.subtitle}>{courses.length} course{courses.length !== 1 ? 's' : ''} with enrollments</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <RefreshCw size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={courses}
        keyExtractor={(item) => item.courseId}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Global summary pills */}
            <View style={styles.summaryRow}>
              {[
                { label: 'Enrolled',  value: totalEnrolled,  color: Colors.primary,  bg: Colors.primaryLight,  Icon: Users },
                { label: 'Started',   value: totalStarted,   color: Colors.primary,  bg: Colors.primaryLight,  Icon: PlayCircle },
                { label: 'Completed', value: totalCompleted, color: Colors.success,  bg: '#d1fae5',            Icon: CheckCircle2 },
                { label: 'Inactive',  value: totalInactive,  color: Colors.warning,  bg: '#fef3c7',            Icon: AlertCircle },
              ].map((s) => (
                <View key={s.label} style={[styles.summaryPill, { backgroundColor: s.bg }]}>
                  <s.Icon size={14} color={s.color} />
                  <Text style={[styles.summaryValue, { color: s.color }]}>{s.value}</Text>
                  <Text style={[styles.summaryLabel, { color: s.color }]}>{s.label}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.sectionLabel}>BY COURSE</Text>
          </>
        }
        renderItem={({ item: course }) => (
          <TouchableOpacity
            style={styles.courseCard}
            onPress={() => setSelected(course)}
            activeOpacity={0.78}
          >
            {/* Cover + title */}
            <View style={styles.cardTop}>
              {course.coverImageUrl ? (
                <Image source={{ uri: course.coverImageUrl }} style={styles.cardCover} />
              ) : (
                <View style={[styles.cardCover, styles.cardCoverPlaceholder]}>
                  <BookOpen size={18} color={Colors.primary} />
                </View>
              )}
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle} numberOfLines={1}>{course.title}</Text>
                <Text style={styles.cardCategory}>{course.category}</Text>
                <Text style={styles.cardMeta}>
                  {course.enrolled} enrolled · avg {course.avgProgress}% · {formatMinutes(course.totalWatchedMinutes)}
                </Text>
              </View>
              <BarChart2 size={16} color={Colors.textMuted} />
            </View>

            {/* Status chips */}
            <View style={styles.chipRow}>
              {([
                { label: `${course.started} started`,    color: Colors.primary,  bg: Colors.primaryLight },
                { label: `${course.completed} done`,     color: Colors.success,  bg: '#d1fae5' },
                { label: `${course.inactive} idle`,      color: Colors.warning,  bg: '#fef3c7' },
                { label: `${course.notStarted} new`,     color: Colors.textMuted,bg: Colors.surfaceLight },
              ] as const).map((c) => (
                <View key={c.label} style={[styles.chip, { backgroundColor: c.bg }]}>
                  <Text style={[styles.chipText, { color: c.color }]}>{c.label}</Text>
                </View>
              ))}
            </View>

            {/* Started bar */}
            <View style={styles.barRow}>
              <Text style={styles.barLabel}>Engagement</Text>
              <MiniBar
                value={course.started + course.completed}
                max={course.enrolled}
                color={Colors.primary}
              />
              <Text style={styles.barPct}>
                {course.enrolled > 0
                  ? `${Math.round(((course.started + course.completed) / course.enrolled) * 100)}%`
                  : '0%'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <BarChart2 size={44} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Enrollment Data</Text>
            <Text style={styles.emptySubtitle}>
              Student enrollments will appear here once they join courses.
            </Text>
          </View>
        }
      />

      <CourseDetailModal course={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
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
  refreshBtn: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  list: { padding: Spacing.lg, paddingBottom: 100 },
  // Summary pills
  summaryRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  summaryPill: {
    flex: 1, alignItems: 'center', padding: Spacing.sm,
    borderRadius: 14, gap: 3,
  },
  summaryValue: { fontSize: 18, fontWeight: '800' },
  summaryLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  sectionLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  // Course card
  courseCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  cardCover: { width: 56, height: 56, borderRadius: 12 },
  cardCoverPlaceholder: { backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1 },
  cardTitle: { ...Typography.bodySmall, fontWeight: '700', color: Colors.text },
  cardCategory: { fontSize: 10, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  cardMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 3 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: Spacing.sm },
  chip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  chipText: { fontSize: 10, fontWeight: '700' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barLabel: { fontSize: 10, color: Colors.textSecondary, width: 72 },
  barPct: { fontSize: 10, fontWeight: '800', color: Colors.primary, width: 32, textAlign: 'right' },
  // Empty
  empty: { alignItems: 'center', paddingTop: 60, gap: Spacing.sm },
  emptyTitle: { ...Typography.h3, color: Colors.text, marginTop: Spacing.md },
  emptySubtitle: { ...Typography.bodySmall, color: Colors.textSecondary, textAlign: 'center' },
});
