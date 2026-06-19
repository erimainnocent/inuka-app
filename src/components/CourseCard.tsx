import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing, Typography } from '../theme';
import { Clock, GraduationCap } from 'lucide-react-native';

interface CourseCardProps {
  course: {
    id: string;
    title: string;
    description?: string;
    coverImageUrl?: string;
    imageUrl?: string; // fallback for older docs
    category?: string;
    price?: string;
    duration?: string;
    level?: string;
  };
  onPress: () => void;
  featured?: boolean;
  style?: any;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  onPress,
  featured = false,
  style,
}) => {
  return (
    <TouchableOpacity
      style={[styles.container, featured ? styles.featured : styles.normal, style]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Course image */}
      {(course.coverImageUrl || course.imageUrl) ? (
        <Image
          source={{ uri: course.coverImageUrl || course.imageUrl }}
          style={[styles.image, featured ? styles.featureImage : styles.normalImage]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.imagePlaceholder, featured ? styles.featureImage : styles.normalImage]}>
          <GraduationCap size={28} color={featured ? Colors.text : Colors.primary} />
        </View>
      )}

      <View style={styles.body}>
        <Text
          style={[styles.title, featured ? styles.titleFeatured : styles.titleNormal]}
          numberOfLines={2}
        >
          {course.title}
        </Text>

        <View style={styles.footer}>
          <View style={styles.info}>
            <GraduationCap size={14} color={featured ? Colors.text : Colors.primary} />
            <Text style={[styles.infoText, featured && styles.infoTextFeatured]}>Certificate</Text>
          </View>
          {course.duration && (
            <View style={styles.info}>
              <Clock size={14} color={featured ? Colors.text : Colors.textSecondary} />
              <Text style={[styles.infoText, featured && styles.infoTextFeatured]}>
                {course.duration}
              </Text>
            </View>
          )}
          {course.price && (
            <Text style={[styles.price, featured && styles.priceFeatured]}>{course.price}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: Spacing.md,
  },
  featured: {
    backgroundColor: Colors.accent,
    width: 260,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  normal: {
    backgroundColor: Colors.surface,
    width: 210,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  image: {
    width: '100%',
  },
  featureImage: {
    height: 130,
  },
  normalImage: {
    height: 110,
  },
  imagePlaceholder: {
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    padding: Spacing.md,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: Spacing.xs,
  },
  badgeFeatured: {
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  badgeNormal: {
    backgroundColor: Colors.primaryLight,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeTextFeatured: {
    color: Colors.text,
  },
  badgeTextNormal: {
    color: Colors.primary,
  },
  title: {
    ...Typography.h3,
    marginBottom: Spacing.sm,
    lineHeight: 22,
  },
  titleFeatured: {
    color: Colors.text,
  },
  titleNormal: {
    color: Colors.text,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  infoText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  infoTextFeatured: {
    color: Colors.text,
  },
  price: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.primary,
  },
  priceFeatured: {
    color: Colors.text,
  },
});
