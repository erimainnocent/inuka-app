import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Colors } from '../../../src/theme/colors';
import { Spacing, Typography } from '../../../src/theme';
import {
  Users,
  BookOpen,
  TrendingUp,
  Plus,
  ChevronRight,
  ShieldAlert,
  Crown,
  ShieldCheck,
  Clock,
  BarChart2,
  Database,
  Sparkles,
} from 'lucide-react-native';
import { collection, getCountFromServer, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../src/config/firebase';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';
import { Alert } from 'react-native';

// ─── Types ─────────────────────────────────────────────────────────────────
interface CourseEngagement {
  courseId: string;
  title: string;
  category: string;
  coverImageUrl: string;
  enrollmentCount: number;
  totalWatchedMinutes: number;
  avgProgress: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatMinutes(mins: number): string {
  if (!mins || mins < 1) return '< 1m';
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Engagement Bar ────────────────────────────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <View style={bar.track}>
      <View style={[bar.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  );
}
const bar = StyleSheet.create({
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.surfaceLight,
    overflow: 'hidden',
    flex: 1,
  },
  fill: { height: 5, borderRadius: 3 },
});

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const { user, role, signOut } = useAuth();
  const isSuperAdmin = role === 'super_admin';

  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    activeCourses: 0,
  });
  const [courseEngagement, setCourseEngagement] = useState<CourseEngagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [engagementLoading, setEngagementLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchCourseEngagement();
  }, []);

  const fetchStats = async () => {
    try {
      const [studentsSnap, teachersSnap, coursesSnap] = await Promise.all([
        getCountFromServer(query(collection(db, 'users'), where('role', '==', 'student'))),
        getCountFromServer(query(collection(db, 'users'), where('role', '==', 'teacher_admin'))),
        getCountFromServer(query(collection(db, 'courses'))),
      ]);
      setStats({
        totalStudents: studentsSnap.data().count,
        totalTeachers: teachersSnap.data().count,
        activeCourses: coursesSnap.data().count,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourseEngagement = async () => {
    try {
      // Fetch courses and enrollments in parallel
      const [coursesSnap, enrollmentsSnap] = await Promise.all([
        getDocs(collection(db, 'courses')),
        getDocs(collection(db, 'enrollments')),
      ]);

      // Build course map
      const courseMap: Record<string, any> = {};
      coursesSnap.forEach((d) => {
        const data = d.data();
        courseMap[d.id] = data;
        if (data.id) courseMap[data.id] = data; // support 'id' field
      });

      // Aggregate enrollment stats per course
      const aggregated: Record<
        string,
        { enrollmentCount: number; totalWatchedMinutes: number; progressSum: number }
      > = {};

      enrollmentsSnap.forEach((d) => {
        const data = d.data();
        const cid = data.courseId;
        if (!aggregated[cid]) {
          aggregated[cid] = { enrollmentCount: 0, totalWatchedMinutes: 0, progressSum: 0 };
        }
        aggregated[cid].enrollmentCount += 1;
        aggregated[cid].totalWatchedMinutes += data.watchedMinutes || 0;
        aggregated[cid].progressSum += data.progress || 0;
      });

      // Build final list
      const result: CourseEngagement[] = Object.entries(aggregated).map(([cid, agg]) => {
        const course = courseMap[cid] || {};
        return {
          courseId: cid,
          title: course.title || cid,
          category: course.category || 'Uncategorized',
          coverImageUrl: course.coverImageUrl || '',
          enrollmentCount: agg.enrollmentCount,
          totalWatchedMinutes: agg.totalWatchedMinutes,
          avgProgress:
            agg.enrollmentCount > 0
              ? Math.round(agg.progressSum / agg.enrollmentCount)
              : 0,
        };
      });

      // Sort by most enrollments first
      result.sort((a, b) => b.enrollmentCount - a.enrollmentCount);
      setCourseEngagement(result);
    } catch (error) {
      console.error('Error fetching engagement:', error);
    } finally {
      setEngagementLoading(false);
    }
  };


  const STATS_DATA = [
    {
      label: 'Students',
      value: stats.totalStudents.toString(),
      icon: Users,
      color: Colors.primary,
      bg: Colors.primaryLight,
    },
    {
      label: 'Courses',
      value: stats.activeCourses.toString(),
      icon: BookOpen,
      color: Colors.success,
      bg: '#d1fae5',
    },
    ...(isSuperAdmin
      ? [
          {
            label: 'Teachers',
            value: stats.totalTeachers.toString(),
            icon: ShieldCheck,
            color: '#d97706',
            bg: '#fef3c7',
          },
        ]
      : [
          {
            label: 'Engaged',
            value: courseEngagement.filter((c) => c.totalWatchedMinutes > 0).length.toString(),
            icon: TrendingUp,
            color: '#f59e0b',
            bg: '#fef3c7',
          },
        ]),
  ];

  const roleBadge = isSuperAdmin
    ? { label: 'Super Admin', color: '#d97706', bg: '#fef3c7', Icon: Crown }
    : { label: 'Teacher Admin', color: '#059669', bg: '#d1fae5', Icon: ShieldCheck };

  const maxEnrollments = Math.max(...courseEngagement.map((c) => c.enrollmentCount), 1);
  const maxMinutes = Math.max(...courseEngagement.map((c) => c.totalWatchedMinutes), 1);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.roleBadge, { backgroundColor: roleBadge.bg }]}>
            <roleBadge.Icon size={12} color={roleBadge.color} />
            <Text style={[styles.roleBadgeText, { color: roleBadge.color }]}>
              {roleBadge.label}
            </Text>
          </View>
          <Text style={styles.title}>
            Welcome, {user?.displayName?.split(' ')[0] || 'Admin'} 👋
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* ── Stats Grid ── */}
      <View style={styles.statsGrid}>
        {STATS_DATA.map((stat, index) => (
          <View
            key={index}
            style={[styles.statCard, { borderTopColor: stat.color, borderTopWidth: 3 }]}
          >
            <View style={[styles.iconContainer, { backgroundColor: stat.bg }]}>
              <stat.icon size={22} color={stat.color} />
            </View>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Quick Actions ── */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        <TouchableOpacity
          style={[styles.actionCard, styles.actionPrimary]}
          onPress={() => router.push('/(admin)/(tabs)/manage')}
          activeOpacity={0.85}
        >
          <View style={styles.actionIconBg}>
            <Plus size={24} color={Colors.white} />
          </View>
          <Text style={styles.actionText}>Manage Courses</Text>
          <ChevronRight size={16} color={Colors.white} style={{ opacity: 0.7 }} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, styles.actionSecondary]}
          onPress={() => router.push('/(admin)/(tabs)/students')}
          activeOpacity={0.85}
        >
          <View style={[styles.actionIconBg, { backgroundColor: Colors.success + '20' }]}>
            <Users size={24} color={Colors.success} />
          </View>
          <Text style={[styles.actionText, { color: Colors.text }]}>Students & Progress</Text>
          <ChevronRight size={16} color={Colors.textSecondary} />
        </TouchableOpacity>

        {isSuperAdmin && (
          <TouchableOpacity
            style={[styles.actionCard, styles.actionGold]}
            onPress={() => router.push('/(admin)/(tabs)/users')}
            activeOpacity={0.85}
          >
            <View style={[styles.actionIconBg, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
              <ShieldAlert size={24} color={Colors.white} />
            </View>
            <Text style={styles.actionText}>User Management</Text>
            <ChevronRight size={16} color={Colors.white} style={{ opacity: 0.7 }} />
          </TouchableOpacity>
        )}

      </View>

      {/* ── Course Engagement Analytics ── */}
      <View style={styles.engagementHeader}>
        <View style={styles.engagementTitleRow}>
          <BarChart2 size={18} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Course Engagement</Text>
        </View>
        <Text style={styles.engagementSubtitle}>
          Enrollment & watch-time per course
        </Text>
      </View>

      {engagementLoading ? (
        <View style={styles.engagementLoading}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : courseEngagement.length === 0 ? (
        <View style={styles.engagementEmpty}>
          <BarChart2 size={36} color={Colors.textMuted} />
          <Text style={styles.engagementEmptyText}>No enrollment data yet</Text>
        </View>
      ) : (
        <View style={styles.engagementList}>
          {courseEngagement.map((course, index) => (
            <View key={course.courseId} style={styles.engagementCard}>
              {/* Rank + Cover */}
              <View style={styles.engRankBadge}>
                <Text style={styles.engRankText}>#{index + 1}</Text>
              </View>

              {course.coverImageUrl ? (
                <Image source={{ uri: course.coverImageUrl }} style={styles.engCover} />
              ) : (
                <View style={[styles.engCover, styles.engCoverPlaceholder]}>
                  <BookOpen size={16} color={Colors.primary} />
                </View>
              )}

              {/* Details */}
              <View style={styles.engDetails}>
                <Text style={styles.engTitle} numberOfLines={1}>
                  {course.title}
                </Text>
                <Text style={styles.engCategory}>{course.category}</Text>

                {/* Enrollment bar */}
                <View style={styles.engMetricRow}>
                  <Users size={11} color={Colors.primary} />
                  <Text style={styles.engMetricLabel}>
                    {course.enrollmentCount} enrolled
                  </Text>
                  <MiniBar value={course.enrollmentCount} max={maxEnrollments} color={Colors.primary} />
                </View>

                {/* Watch-time bar */}
                <View style={styles.engMetricRow}>
                  <Clock size={11} color='#d97706' />
                  <Text style={[styles.engMetricLabel, { color: '#d97706' }]}>
                    {formatMinutes(course.totalWatchedMinutes)}
                  </Text>
                  <MiniBar value={course.totalWatchedMinutes} max={maxMinutes} color='#d97706' />
                </View>

                {/* Avg progress */}
                <View style={styles.engMetricRow}>
                  <TrendingUp size={11} color={Colors.success} />
                  <Text style={[styles.engMetricLabel, { color: Colors.success }]}>
                    {course.avgProgress}% avg
                  </Text>
                  <MiniBar value={course.avgProgress} max={100} color={Colors.success} />
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

    </ScrollView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 100 },
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerLeft: { flex: 1 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 6,
    gap: 4,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  title: { ...Typography.h2, color: Colors.text },
  logoutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 12,
  },
  logoutText: { ...Typography.bodySmall, color: Colors.error, fontWeight: '600' },
  // Stats
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statValue: { ...Typography.h2, color: Colors.text },
  statLabel: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  // Section title
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  // Actions
  actionsGrid: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  actionPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  actionSecondary: { backgroundColor: Colors.surface, borderColor: Colors.glassBorder },
  actionGold: { backgroundColor: '#d97706', borderColor: '#d97706' },
  actionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  actionText: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: '600',
    flex: 1,
  },
  // Engagement section header
  engagementHeader: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  engagementTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  engagementSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  engagementLoading: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  engagementEmpty: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  engagementEmptyText: { ...Typography.bodySmall, color: Colors.textMuted },
  engagementList: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  engagementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: Spacing.sm,
  },
  engRankBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  engRankText: { fontSize: 11, fontWeight: '800', color: Colors.primary },
  engCover: { width: 56, height: 56, borderRadius: 12 },
  engCoverPlaceholder: {
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  engDetails: { flex: 1 },
  engTitle: { ...Typography.bodySmall, fontWeight: '700', color: Colors.text },
  engCategory: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  engMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  engMetricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    minWidth: 62,
  },
});
