import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Colors } from '../../../src/theme/colors';
import { Spacing, Typography } from '../../../src/theme';
import { Search, Bell, BookOpen, ArrowRight, Play } from 'lucide-react-native'; // Fixed import and changed icons
import { CourseCard } from '../../../src/components/CourseCard';
import { collection, query, limit, getDocs, orderBy, where } from 'firebase/firestore';
import { db } from '../../../src/config/firebase';
import { useAuth } from '../../../src/context/AuthContext';
import { useRouter } from 'expo-router';

export default function Dashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    fetchCourses();
  }, [activeCategory]);

  const fetchCourses = async () => {
    try {
      let q;
      if (activeCategory === 'All') {
        q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'), limit(15));
      } else {
        q = query(
          collection(db, 'courses'), 
          where('category', '==', activeCategory),
          orderBy('createdAt', 'desc'), 
          limit(15)
        );
      }
      
      const querySnapshot = await getDocs(q);
      const fetchedCourses: any[] = [];
      querySnapshot.forEach((doc) => {
        fetchedCourses.push({ id: doc.id, ...doc.data() });
      });
      setCourses(fetchedCourses);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCourses();
  };

  const firstName = profile?.fullName?.split(' ')[0] || 'Student';
  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const featuredCourse = courses.length > 0 ? courses[0] : null;

  if (loading && !refreshing) {
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
        <View style={styles.profileRow}>
          <TouchableOpacity onPress={() => router.push('/(student)/(tabs)/profile')}>
            <Image
              source={{
                uri: profile?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.fullName || 'Student')}&background=1a73e8&color=fff&size=150`,
              }}
              style={styles.avatar}
            />
          </TouchableOpacity>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconButton}>
              <Search color={Colors.textSecondary} size={20} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <Bell color={Colors.textSecondary} size={20} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.greetingRow}>
          <Text style={styles.greetingText}>{greeting()},</Text>
          <Text style={styles.welcomeTitle}>{firstName}! 👋</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Featured Course Banner */}
        {featuredCourse && activeCategory === 'All' && (
          <TouchableOpacity
            style={styles.featuredCard}
            onPress={() => router.push(`/(student)/course/${featuredCourse.id}`)}
            activeOpacity={0.9}
          >
            <Image
              source={{
                uri: featuredCourse.coverImageUrl || featuredCourse.imageUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600',
              }}
              style={styles.featuredImage}
              resizeMode="cover"
            />
            <View style={styles.featuredOverlay} />
            <View style={styles.featuredContent}>
              <View style={styles.featuredBadge}>
                <BookOpen size={12} color={Colors.white} />
                <Text style={styles.featuredBadgeText}>MASTERCLASS</Text>
              </View>
              <Text style={styles.featuredTitle} numberOfLines={2}>
                {featuredCourse.title}
              </Text>
              <View style={styles.featuredFooter}>
                <Text style={styles.featuredCategory}>{featuredCourse.category || 'Featured'}</Text>
                <TouchableOpacity
                  style={styles.learnMoreButton}
                  onPress={() => router.push(`/(student)/course/${featuredCourse.id}`)}
                >
                   <Text style={styles.learnMoreText}>Start Learning</Text>
                   <ArrowRight size={14} color={Colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Course List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {activeCategory === 'All' ? 'Recently Added' : `${activeCategory} Courses`}
          </Text>
          <TouchableOpacity onPress={() => router.push('/(student)/(tabs)/courses')}>
            <Text style={styles.seeMore}>View All</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.coursesScroll}
          contentContainerStyle={{ paddingLeft: Spacing.lg, paddingRight: Spacing.lg }}
        >
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onPress={() => router.push(`/(student)/course/${course.id}`)}
            />
          ))}
          {courses.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No courses found in this category.</Text>
            </View>
          )}
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 110,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  headerIcons: {
    flexDirection: 'row',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  greetingRow: {
    marginBottom: Spacing.sm,
  },
  greetingText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontSize: 14,
  },
  welcomeTitle: {
    ...Typography.h2,
    color: Colors.text,
    fontSize: 24,
  },
  featuredCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderRadius: 28,
    overflow: 'hidden',
    height: 220,
    position: 'relative',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  featuredOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 15, 30, 0.45)',
  },
  featuredContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: Spacing.sm,
  },
  featuredBadgeText: {
    color: Colors.text,
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 4,
    letterSpacing: 1,
  },
  featuredTitle: {
    ...Typography.h3,
    color: Colors.white,
    fontSize: 22,
    marginBottom: Spacing.md,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: {width: -1, height: 1},
    textShadowRadius: 10
  },
  featuredFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featuredCategory: {
    ...Typography.bodySmall,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  learnMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 6,
  },
  learnMoreText: {
    ...Typography.caption,
    fontWeight: '800',
    color: Colors.text,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    fontSize: 18,
  },
  seeMore: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '700',
  },
  coursesScroll: {
    marginBottom: Spacing.md,
  },
  emptyContainer: {
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    color: Colors.textSecondary,
    ...Typography.bodySmall,
    fontStyle: 'italic',
  },
});
