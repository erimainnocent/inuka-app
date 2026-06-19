import React from 'react';
import { Tabs } from 'expo-router';
import { LayoutDashboard, BookPlus, Users, ShieldAlert, BarChart2 } from 'lucide-react-native';
import { Colors } from '../../../src/theme/colors';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/context/AuthContext';

export default function AdminTabsLayout() {
  const { role } = useAuth();
  const isSuperAdmin = role === 'super_admin';
  const insets = useSafeAreaInsets();
  const androidBottomPad = Platform.OS === 'android' ? insets.bottom : 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.glassBorder,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          height: Platform.OS === 'ios' ? 80 : 60 + androidBottomPad,
          paddingBottom: Platform.OS === 'ios' ? 20 : androidBottomPad,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="manage"
        options={{
          tabBarLabel: 'Courses',
          tabBarIcon: ({ color, size }) => <BookPlus color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="students"
        options={{
          tabBarLabel: 'Students',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />
      {/* Progress tab: visible to all admin roles */}
      <Tabs.Screen
        name="progress"
        options={{
          tabBarLabel: 'Progress',
          tabBarIcon: ({ color, size }) => <BarChart2 color={color} size={size} />,
        }}
      />
      {/* Users tab: only visible to super_admin */}
      <Tabs.Screen
        name="users"
        options={{
          tabBarLabel: 'Users',
          tabBarIcon: ({ color, size }) => <ShieldAlert color={color} size={size} />,
          href: isSuperAdmin ? undefined : null,
        }}
      />
    </Tabs>
  );
}
