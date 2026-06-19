import React, { useEffect, useState } from 'react';
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
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Switch,
  Clipboard,
} from 'react-native';
import { Colors } from '../../../src/theme/colors';
import { Spacing, Typography } from '../../../src/theme';
import {
  collection,
  query,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  where,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../src/config/firebase';
import { firebaseConfig } from '../../../src/config/firebase';
import {
  getAuth,
  initializeAuth,
  inMemoryPersistence,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { initializeApp, deleteApp, getApps } from 'firebase/app';
import {
  RefreshCw,
  Trash2,
  Ban,
  CheckCircle,
  ShieldCheck,
  GraduationCap,
  Plus,
  X,
  Edit2,
  Copy,
  Mail,
  Lock,
} from 'lucide-react-native';
import { useAuth } from '../../../src/context/AuthContext';
import type { Role } from '../../../src/context/AuthContext';

interface UserDoc {
  id: string;
  uid: string;
  fullName: string;
  email: string;
  role: Role;
  isDisabled: boolean;
  avatarUrl: string;
  enrolledCourseCount: number;
  totalLearningMinutes: number;
}

const ROLE_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; Icon: any }
> = {
  teacher_admin: {
    label: 'Teacher Admin',
    color: '#059669',
    bg: '#d1fae5',
    Icon: ShieldCheck,
  },
  student: {
    label: 'Student',
    color: Colors.primary,
    bg: Colors.primaryLight,
    Icon: GraduationCap,
  },
};

export default function UserManagementScreen() {
  const { role: myRole } = useAuth();
  const isSuperAdmin = myRole === 'super_admin';

  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'teacher_admin' | 'student'>('teacher_admin');

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'create' | 'edit'>('create');
  const [selectedUser, setSelectedUser] = useState<UserDoc | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formInviteMode, setFormInviteMode] = useState(true); // true = send email invite
  const [formRole, setFormRole] = useState<Role>('student');
  const [formDisabled, setFormDisabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Credential summary after creation
  const [credsModal, setCredsModal] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string; role: string; inviteSent: boolean } | null>(null);

  const openCreateModal = () => {
    setFormName(''); setFormEmail(''); setFormPassword('');
    setFormInviteMode(true); setFormRole(activeTab); setFormDisabled(false);
    setModalType('create'); setSelectedUser(null); setModalVisible(true);
  };

  const openEditModal = (user: UserDoc) => {
    setFormName(user.fullName || ''); setFormEmail(user.email || '');
    setFormPassword('');
    setFormRole(user.role); setFormDisabled(user.isDisabled || false);
    setModalType('edit'); setSelectedUser(user); setModalVisible(true);
  };

  const handleSaveUser = async () => {
    const email = formEmail.toLowerCase().trim();
    if (!email) return Alert.alert('Error', 'Email is required');
    if (modalType === 'create' && !formInviteMode && formPassword.length < 6) {
      return Alert.alert('Weak Password', 'Password must be at least 6 characters');
    }
    setSubmitting(true);
    try {
      if (modalType === 'create') {
        // ── Use a secondary Firebase app so admin stays signed in ──
        const secondaryAppName = `admin-create-${Date.now()}`;
        const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
        // Use in-memory persistence so admin session is never affected
        const secondaryAuth = initializeAuth(secondaryApp, { persistence: inMemoryPersistence });

        // Generate a temp password if invite mode (user will reset via email)
        const tempPassword = formInviteMode
          ? `Inuka@${Math.random().toString(36).slice(2, 10)}!`
          : formPassword;

        let newUid = '';
        try {
          const cred = await createUserWithEmailAndPassword(secondaryAuth, email, tempPassword);
          newUid = cred.user.uid;

          // If invite mode, send password reset email immediately so user sets their own
          if (formInviteMode) {
            await sendPasswordResetEmail(secondaryAuth, email);
          }
        } finally {
          // Always clean up the secondary app
          await deleteApp(secondaryApp);
        }

        // Write Firestore doc with the real Auth UID
        await setDoc(doc(db, 'users', newUid), {
          uid: newUid,
          email,
          fullName: formName,
          role: formRole,
          isDisabled: false,
          enrolledCourseCount: 0,
          totalLearningMinutes: 0,
          onboardingComplete: formRole !== 'student', // admins skip onboarding
          createdAt: serverTimestamp(),
          createdByAdmin: true,
        });

        // Show credential summary
        setCreatedCreds({
          email,
          password: formInviteMode ? '(sent via email — user sets own)' : formPassword,
          role: formRole === 'teacher_admin' ? 'Teacher Admin' : 'Student',
          inviteSent: formInviteMode,
        });
        setModalVisible(false);
        setCredsModal(true);
        fetchUsers();

      } else if (selectedUser) {
        // Edit mode — just update Firestore fields
        await updateDoc(doc(db, 'users', selectedUser.id), {
          fullName: formName,
          email,
          role: formRole,
          isDisabled: formDisabled,
        });
        Alert.alert('Success', 'User updated.');
        setModalVisible(false);
        fetchUsers();
      }
    } catch (e: any) {
      console.error(e);
      if (e.code === 'auth/email-already-in-use') {
        Alert.alert('Already Registered', 'An account with this email already exists. They can log in directly.');
      } else {
        Alert.alert('Error', e.message || 'Failed to save user');
      }
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchUsers();
    }
  }, [isSuperAdmin]);

  const fetchUsers = async () => {
    try {
      // Fetch teacher_admins and students (not super_admins — protected)
      const snapshot = await getDocs(
        query(
          collection(db, 'users'),
          where('role', 'in', ['teacher_admin', 'student'])
        )
      );
      const fetched: UserDoc[] = [];
      snapshot.forEach((d) => fetched.push({ id: d.id, ...(d.data() as any) }));
      setUsers(fetched);
    } catch (error) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  // ── Toggle Disable ────────────────────────────────────────────────────────
  const handleToggleDisable = (user: UserDoc) => {
    const newDisabled = !user.isDisabled;
    const action = newDisabled ? 'Disable' : 'Enable';
    Alert.alert(
      `${action} User`,
      `${action} ${user.fullName || user.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action,
          style: newDisabled ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'users', user.id), { isDisabled: newDisabled });
              setUsers((prev) =>
                prev.map((u) => (u.id === user.id ? { ...u, isDisabled: newDisabled } : u))
              );
            } catch (err) {
              console.error(err);
              Alert.alert('Error', `Failed to ${action.toLowerCase()} user`);
            }
          },
        },
      ]
    );
  };

  // ── Delete User ───────────────────────────────────────────────────────────
  const handleDelete = (user: UserDoc) => {
    Alert.alert(
      'Delete User',
      `Permanently delete ${user.fullName || user.email}?\n\nThis removes their Firestore profile. Firebase Auth record requires Admin SDK to fully remove.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'users', user.id));
              setUsers((prev) => prev.filter((u) => u.id !== user.id));
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'Failed to delete user');
            }
          },
        },
      ]
    );
  };

  // ── Change Role ───────────────────────────────────────────────────────────
  const handleChangeRole = (user: UserDoc) => {
    const newRole: Role = user.role === 'teacher_admin' ? 'student' : 'teacher_admin';
    const label = newRole === 'teacher_admin' ? 'Teacher Admin' : 'Student';
    Alert.alert(
      'Change Role',
      `Promote/demote ${user.fullName || user.email} to "${label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'users', user.id), { role: newRole });
              setUsers((prev) =>
                prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))
              );
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'Failed to change role');
            }
          },
        },
      ]
    );
  };

  const filteredUsers = users.filter((u) => u.role === activeTab);
  const cfg = ROLE_CONFIG[activeTab];

  if (!isSuperAdmin) {
    return (
      <View style={styles.forbidden}>
        <Text style={styles.forbiddenText}>🔒 Super Admin access only</Text>
      </View>
    );
  }

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
          <Text style={styles.title}>User Management</Text>
          <Text style={styles.subtitle}>Super Admin · Full access</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <RefreshCw size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['teacher_admin', 'student'] as const).map((tab) => {
          const tabCfg = ROLE_CONFIG[tab];
          const count = users.filter((u) => u.role === tab).length;
          const active = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                active && { backgroundColor: tabCfg.bg, borderColor: tabCfg.color },
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <tabCfg.Icon size={14} color={active ? tabCfg.color : Colors.textMuted} />
              <Text
                style={[
                  styles.tabLabel,
                  { color: active ? tabCfg.color : Colors.textMuted },
                ]}
              >
                {tabCfg.label}
              </Text>
              <View style={[styles.tabCount, { backgroundColor: active ? tabCfg.color : Colors.glassBorder }]}>
                <Text style={[styles.tabCountText, { color: active ? Colors.white : Colors.textMuted }]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.userCard, item.isDisabled && styles.disabledCard]}>
            {/* Avatar */}
            {item.avatarUrl ? (
              <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  { backgroundColor: item.isDisabled ? Colors.textMuted : cfg.color },
                ]}
              >
                <Text style={styles.avatarInitial}>
                  {(item.fullName || item.email || 'U')[0].toUpperCase()}
                </Text>
              </View>
            )}

            {/* Info */}
            <View style={styles.info}>
              <Text style={[styles.name, item.isDisabled && { color: Colors.textMuted }]}>
                {item.fullName || 'Unknown'}
              </Text>
              <Text style={styles.email} numberOfLines={1}>
                {item.email}
              </Text>
              <View style={styles.metaRow}>
                <View style={[styles.rolePill, { backgroundColor: cfg.bg }]}>
                  <cfg.Icon size={10} color={cfg.color} />
                  <Text style={[styles.rolePillText, { color: cfg.color }]}>
                    {cfg.label}
                  </Text>
                </View>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              {/* Edit */}
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#e0e7ff', marginBottom: 4 }]}
                onPress={() => openEditModal(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Edit2 size={14} color="#4f46e5" />
              </TouchableOpacity>

              {/* Role toggle (teacher_admin ↔ student) */}
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: cfg.bg }]}
                onPress={() => handleChangeRole(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <cfg.Icon size={14} color={cfg.color} />
              </TouchableOpacity>

              {/* Disable/Enable */}
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { backgroundColor: item.isDisabled ? '#d1fae5' : '#fee2e2', marginTop: 4 },
                ]}
                onPress={() => handleToggleDisable(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {item.isDisabled ? (
                  <CheckCircle size={14} color={Colors.success} />
                ) : (
                  <Ban size={14} color={Colors.error} />
                )}
              </TouchableOpacity>

              {/* Delete */}
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#fee2e2', marginTop: 4 }]}
                onPress={() => handleDelete(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Trash2 size={14} color={Colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <cfg.Icon size={48} color={Colors.surfaceBorder} />
            <Text style={styles.emptyTitle}>
              No {cfg.label}s Found
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'teacher_admin'
                ? 'Teacher admins will appear here once they register.'
                : 'Students will appear here once they register.'}
            </Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
        <Plus size={24} color={Colors.white} />
      </TouchableOpacity>

      {/* User Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalType === 'create' ? 'Create User' : 'Edit User'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. John Doe"
                  placeholderTextColor={Colors.textMuted}
                  value={formName}
                  onChangeText={setFormName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Email Address *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. john@example.com"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={formEmail}
                  onChangeText={setFormEmail}
                />
              </View>

              {/* ── Invite / Password toggle (create mode only) ── */}
              {modalType === 'create' && (
                <>
                  <View style={styles.toggleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>
                        {formInviteMode ? '📧 Send Email Invite' : '🔑 Set Password Now'}
                      </Text>
                      <Text style={styles.toggleHint}>
                        {formInviteMode
                          ? 'Firebase sends a "Set your password" email to the user'
                          : 'You provide credentials — share them with the user'}
                      </Text>
                    </View>
                    <Switch
                      value={formInviteMode}
                      onValueChange={setFormInviteMode}
                      trackColor={{ false: Colors.primary, true: '#10b981' }}
                      thumbColor={Colors.white}
                    />
                  </View>

                  {!formInviteMode && (
                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Password *</Text>
                      <View style={styles.passwordRow}>
                        <Lock size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
                        <TextInput
                          style={[styles.input, { flex: 1, borderWidth: 0, height: 'auto' as any, paddingHorizontal: 0 }]}
                          placeholder="Min. 6 characters"
                          placeholderTextColor={Colors.textMuted}
                          secureTextEntry
                          value={formPassword}
                          onChangeText={setFormPassword}
                        />
                      </View>
                      <Text style={styles.toggleHint}>Remember to share these credentials securely with the user.</Text>
                    </View>
                  )}
                </>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.label}>Role</Text>
                <View style={styles.rolePicker}>
                  {(['student', 'teacher_admin'] as Role[]).map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.roleOption, formRole === r && styles.roleOptionActive]}
                      onPress={() => setFormRole(r)}
                    >
                      <Text style={[styles.roleOptionText, formRole === r && styles.roleOptionTextActive]}>
                        {r === 'student' ? 'Student' : 'Teacher Admin'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveUser}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {modalType === 'create'
                      ? (formInviteMode ? 'Create & Send Invite' : 'Create & Set Password')
                      : 'Save Changes'
                    }
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Credential Summary Modal ── */}
      <Modal visible={credsModal} transparent animationType="fade" onRequestClose={() => setCredsModal(false)}>
        <View style={styles.credsOverlay}>
          <View style={styles.credsCard}>
            <View style={styles.credsIconRow}>
              {createdCreds?.inviteSent
                ? <Mail size={28} color="#10b981" />
                : <Lock size={28} color={Colors.primary} />}
            </View>
            <Text style={styles.credsTitle}>
              {createdCreds?.inviteSent ? 'Invite Sent!' : 'Account Created!'}
            </Text>
            <Text style={styles.credsSub}>
              {createdCreds?.inviteSent
                ? `An email was sent to ${createdCreds?.email} with a link to set their password.`
                : 'Share these credentials securely with the new user.'}
            </Text>

            <View style={styles.credsBox}>
              <View style={styles.credsRow}>
                <Text style={styles.credsRowLabel}>Role</Text>
                <Text style={styles.credsRowValue}>{createdCreds?.role}</Text>
              </View>
              <View style={styles.credsDivider} />
              <View style={styles.credsRow}>
                <Text style={styles.credsRowLabel}>Email</Text>
                <Text style={styles.credsRowValue} numberOfLines={1}>{createdCreds?.email}</Text>
              </View>
              {!createdCreds?.inviteSent && (
                <>
                  <View style={styles.credsDivider} />
                  <View style={styles.credsRow}>
                    <Text style={styles.credsRowLabel}>Password</Text>
                    <Text style={styles.credsRowValue}>{createdCreds?.password}</Text>
                  </View>
                </>
              )}
            </View>

            {!createdCreds?.inviteSent && (
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={() => {
                  Clipboard.setString(
                    `Email: ${createdCreds?.email}\nPassword: ${createdCreds?.password}\nRole: ${createdCreds?.role}`
                  );
                  Alert.alert('Copied', 'Credentials copied to clipboard');
                }}
              >
                <Copy size={16} color={Colors.white} />
                <Text style={styles.copyBtnText}>Copy Credentials</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.credsDoneBtn} onPress={() => setCredsModal(false)}>
              <Text style={styles.credsDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  forbidden: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  forbiddenText: {
    ...Typography.h3,
    color: Colors.textSecondary,
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
  // Tabs
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.glassBorder,
    gap: 5,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabCountText: {
    fontSize: 10,
    fontWeight: '700',
  },
  // List
  listContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 16,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  disabledCard: {
    opacity: 0.6,
    borderColor: Colors.error + '40',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: Spacing.md,
  },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarInitial: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  info: { flex: 1 },
  name: { ...Typography.body, fontWeight: '600', color: Colors.text },
  email: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
  metaRow: { flexDirection: 'row', marginTop: 4 },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 3,
  },
  rolePillText: { fontSize: 10, fontWeight: '700' },
  actions: {
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyTitle: { ...Typography.h3, color: Colors.text },
  emptySubtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  modalTitle: { ...Typography.h3, color: Colors.text },
  closeBtn: { padding: 4 },
  formGroup: { marginBottom: Spacing.lg },
  label: { ...Typography.bodySmall, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    height: 48,
    color: Colors.text,
    ...Typography.body,
  },
  rolePicker: { flexDirection: 'row', gap: 10 },
  roleOption: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 12,
    alignItems: 'center',
  },
  roleOptionActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  roleOptionText: { ...Typography.bodySmall, color: Colors.textSecondary, fontWeight: '600' },
  roleOptionTextActive: { color: Colors.primary },
  saveBtn: {
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: 40,
  },
  saveBtnText: { ...Typography.body, color: Colors.white, fontWeight: '700' },
  // Toggle row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    gap: 12,
  },
  toggleHint: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  // Credential summary card
  credsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  credsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  credsIconRow: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  credsTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: 6,
  },
  credsSub: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  credsBox: {
    width: '100%',
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  credsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  credsRowLabel: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  credsRowValue: {
    ...Typography.bodySmall,
    color: Colors.text,
    fontWeight: '700',
    flexShrink: 1,
    marginLeft: Spacing.sm,
    textAlign: 'right',
  },
  credsDivider: {
    height: 1,
    backgroundColor: Colors.glassBorder,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
    marginBottom: Spacing.sm,
    width: '100%',
    justifyContent: 'center',
  },
  copyBtnText: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: '700',
  },
  credsDoneBtn: {
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  credsDoneBtnText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
