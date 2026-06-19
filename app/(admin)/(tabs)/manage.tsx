import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, Modal, ScrollView, KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { Colors } from '../../../src/theme/colors';
import { Spacing, Typography } from '../../../src/theme';
import {
  collection, getDocs, deleteDoc, doc, orderBy, query, addDoc, where,
  serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, uploadBytesResumable, ref } from 'firebase/storage';
import { db, storage, auth } from '../../../src/config/firebase';
import { Input } from '../../../src/components/Input';
import { Button } from '../../../src/components/Button';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  Plus, Trash2, X, BookOpen, ChevronDown, ChevronRight,
  Layers, FileText, Video, Image as ImageIcon, CheckCircle, ClipboardList, Pencil, Clock,
} from 'lucide-react-native';

interface Course { id: string; title: string; category: string; [k: string]: any; }
interface Module {
  id: string; title: string; description: string; courseId: string; order: number;
  estimatedDuration?: string; introVideoUrl?: string | null; youtubeUrl?: string | null;
}
interface Lesson {
  id: string; title: string; description: string; moduleId: string; courseId: string;
  order: number; videoUrl?: string; pdfUrl?: string; youtubeUrl?: string;
}
interface Quiz {
  id: string; courseId: string; moduleId?: string; lessonId?: string; passMark: number;
  questions: { id: string; question: string; options: string[]; correctIndex: number; explanation: string; }[];
}

type ModalType = 'course' | 'module' | 'lesson' | 'quiz' | null;

export default function ManageCoursesScreen() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  const [modalType, setModalType] = useState<ModalType>(null);
  const [parentId, setParentId] = useState('');
  const [parentCourseId, setParentCourseId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  // Shared form fields
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [formPdfUrl, setFormPdfUrl] = useState('');
  const [formYoutubeUrl, setFormYoutubeUrl] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formPassMark, setFormPassMark] = useState('60');
  const [formQuestions, setFormQuestions] = useState<any[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [selectedPdf, setSelectedPdf] = useState<any>(null);
  const [selectedImage, setSelectedImage] = useState<any>(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [cSnap, mSnap, lSnap, qSnap] = await Promise.all([
        getDocs(query(collection(db, 'courses'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'modules'), orderBy('order', 'asc'))),
        getDocs(query(collection(db, 'lessons'), orderBy('order', 'asc'))),
        getDocs(collection(db, 'quizzes')),
      ]);
      setCourses(cSnap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
      setModules(mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Module)));
      setLessons(lSnap.docs.map(d => ({ id: d.id, ...d.data() } as Lesson)));
      setQuizzes(qSnap.docs.map(d => ({ id: d.id, ...d.data() } as Quiz)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const resetForm = () => {
    setFormTitle(''); setFormDesc('');
    setFormVideoUrl(''); setFormPdfUrl(''); setFormYoutubeUrl(''); setFormDuration('');
    setFormPassMark('60'); setFormQuestions([]);
    setSelectedVideo(null); setSelectedPdf(null); setSelectedImage(null);
    setEditingId(null); setUploadProgress(null); setUploadStatus('');
  };

  const openModal = (type: ModalType, pId = '', pCourseId = '') => {
    resetForm(); setParentId(pId); setParentCourseId(pCourseId); setModalType(type);
  };

  const openEditModal = (type: ModalType, item: any, pId = '', pCourseId = '') => {
    resetForm();
    setEditingId(item.id);
    setParentId(pId);
    setParentCourseId(pCourseId);
    setFormTitle(item.title || '');
    setFormDesc(item.description || '');
    setFormVideoUrl(item.videoUrl || item.introVideoUrl || '');
    setFormPdfUrl(item.pdfUrl || '');
    setFormYoutubeUrl(item.youtubeUrl || '');
    setFormDuration(item.estimatedDuration || '');
    if (type === 'quiz') {
      setFormPassMark(String(item.passMark || 60));
      setFormQuestions(item.questions || []);
    }
    setModalType(type);
  };

  const uploadFile = async (uri: string, path: string, statusText: string): Promise<string> => {
    if (!auth.currentUser) {
      throw new Error('Your session has expired. Please sign out and sign in again.');
    }
    setUploadStatus(statusText);
    setUploadProgress(0);
    const r = await fetch(uri);
    const b = await r.blob();
    const sRef = ref(storage, path);
    return new Promise<string>((resolve, reject) => {
      const task = uploadBytesResumable(sRef, b);
      task.on(
        'state_changed',
        (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        reject,
        async () => {
          try { resolve(await getDownloadURL(task.snapshot.ref)); }
          catch (e) { reject(e); }
        }
      );
    });
  };

  const pickVideo = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true });
    if (!r.canceled) setSelectedVideo(r.assets[0]);
  };
  const pickPdf = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (!r.canceled) setSelectedPdf(r.assets[0]);
  };
  const pickImage = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 9], quality: 0.8 });
    if (!r.canceled) setSelectedImage(r.assets[0]);
  };

  // ─── Save: Course ─────────────────────────────────────────────────────────
  const handleSaveCourse = async () => {
    if (!formTitle || !formDesc) { Alert.alert('Missing Fields', 'Title and Description are required'); return; }
    setSubmitting(true);
    try {
      const ts = Date.now();
      let videoUrl = formVideoUrl || '';
      let pdfUrl = formPdfUrl || '';
      let coverUrl = editingId
        ? (courses.find(c => c.id === editingId)?.coverImageUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600')
        : 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600';
      if (selectedVideo) videoUrl = await uploadFile(selectedVideo.uri, `courses/videos/${ts}_${selectedVideo.name || 'v.mp4'}`, 'Uploading Video');
      if (selectedPdf) pdfUrl = await uploadFile(selectedPdf.uri, `courses/materials/${ts}_${selectedPdf.name || 'm.pdf'}`, 'Uploading PDF');
      if (selectedImage) coverUrl = await uploadFile(selectedImage.uri, `courses/covers/${ts}_cover.jpg`, 'Uploading Cover Image');
      const data: any = {
        title: formTitle, description: formDesc,
        coverImageUrl: coverUrl, hasPdfMaterial: !!(pdfUrl), pdfUrl, updatedAt: serverTimestamp(),
      };
      if (videoUrl) data.videoUrl = videoUrl;
      if (editingId) {
        await updateDoc(doc(db, 'courses', editingId), data);
        Alert.alert('Updated', 'Course updated!');
      } else {
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, 'courses'), data);
        Alert.alert('Success', 'Course created!');
      }
      setModalType(null); resetForm(); fetchAll();
    } catch (e: any) { console.error(e); Alert.alert('Error', e.message || 'Failed to save course'); }
    finally { setSubmitting(false); }
  };

  // ─── Save: Module (no video upload — only optional intro video URL) ───────
  const handleSaveModule = async () => {
    if (!formTitle) { Alert.alert('Missing', 'Enter a module title'); return; }
    setSubmitting(true);
    try {
      const data: any = {
        title: formTitle,
        description: formDesc || null,
        updatedAt: serverTimestamp(),
      };
      if (editingId) {
        await updateDoc(doc(db, 'modules', editingId), data);
        Alert.alert('Updated', 'Module updated!');
      } else {
        const existing = modules.filter(m => m.courseId === parentId);
        await addDoc(collection(db, 'modules'), {
          ...data, courseId: parentId, order: existing.length + 1, createdAt: serverTimestamp(),
        });
        Alert.alert('Success', 'Module added!');
      }
      setModalType(null); resetForm(); fetchAll();
    } catch (e: any) { console.error(e); Alert.alert('Error', e.message || 'Failed to save module'); }
    finally { setSubmitting(false); }
  };

  // ─── Save: Lesson (video + PDF upload lives here) ────────────────────────
  const handleSaveLesson = async () => {
    if (!formTitle) { Alert.alert('Missing', 'Enter a lesson title'); return; }
    setSubmitting(true);
    try {
      const ts = Date.now();
      let videoUrl = formVideoUrl;
      let pdfUrl = formPdfUrl;
      if (selectedVideo) videoUrl = await uploadFile(selectedVideo.uri, `lessons/videos/${ts}_${selectedVideo.name || 'v.mp4'}`, 'Uploading Video');
      if (selectedPdf) pdfUrl = await uploadFile(selectedPdf.uri, `lessons/pdfs/${ts}_${selectedPdf.name || 'm.pdf'}`, 'Uploading PDF');
      const data: any = {
        title: formTitle, description: formDesc,
        videoUrl: videoUrl || null, pdfUrl: pdfUrl || null,
        updatedAt: serverTimestamp(),
      };
      if (editingId) {
        await updateDoc(doc(db, 'lessons', editingId), data);
        Alert.alert('Updated', 'Lesson updated!');
      } else {
        const existing = lessons.filter(l => l.moduleId === parentId);
        await addDoc(collection(db, 'lessons'), {
          ...data, moduleId: parentId, courseId: parentCourseId,
          order: existing.length + 1, createdAt: serverTimestamp(),
        });
        Alert.alert('Success', 'Lesson added!');
      }
      setModalType(null); resetForm(); fetchAll();
    } catch (e: any) { console.error(e); Alert.alert('Error', e.message || 'Failed to save lesson'); }
    finally { setSubmitting(false); }
  };

  // ─── Save: Quiz ───────────────────────────────────────────────────────────
  const handleSaveQuiz = async () => {
    if (formQuestions.length === 0) { Alert.alert('Empty Quiz', 'Add at least one question'); return; }
    setSubmitting(true);
    try {
      const qRef = collection(db, 'quizzes');
      // Quiz is always lesson-scoped
      const existing = await getDocs(query(qRef, where('lessonId', '==', parentId)));
      const quizData: any = {
        courseId: parentCourseId,
        lessonId: parentId,
        passMark: parseInt(formPassMark) || 60,
        questions: formQuestions,
        updatedAt: serverTimestamp(),
      };
      if (!existing.empty) {
        await updateDoc(doc(db, 'quizzes', existing.docs[0].id), quizData);
      } else {
        quizData.createdAt = serverTimestamp();
        await addDoc(qRef, quizData);
      }
      Alert.alert('Saved', 'Quiz saved!');
      setModalType(null); resetForm(); fetchAll();
    } catch (e: any) { console.error(e); Alert.alert('Error', e.message || 'Failed to save quiz'); }
    finally { setSubmitting(false); }
  };

  const addQuestion = () => setFormQuestions([...formQuestions, {
    id: `q${Date.now()}`, question: '', options: ['', '', '', ''], correctIndex: 0, explanation: '',
  }]);

  const updateQuestion = (index: number, key: string, value: any) => {
    const qs = [...formQuestions];
    qs[index] = { ...qs[index], [key]: value };
    setFormQuestions(qs);
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    const qs = [...formQuestions];
    qs[qIdx].options[oIdx] = value;
    setFormQuestions(qs);
  };

  const handleDelete = (colName: string, id: string, label: string) => {
    Alert.alert(`Delete ${label}?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteDoc(doc(db, colName, id)); fetchAll(); } },
    ]);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading && courses.length === 0) {
    return <View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  const renderCourse = ({ item }: { item: Course }) => {
    const open = expandedCourse === item.id;
    const courseMods = modules.filter(m => m.courseId === item.id);

    return (
      <View style={s.courseCard}>
        {/* ── Course row ── */}
        <TouchableOpacity style={s.courseRow} onPress={() => setExpandedCourse(open ? null : item.id)} activeOpacity={0.7}>
          <View style={s.courseIconBg}><BookOpen size={18} color={Colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.courseTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={s.courseSub}>{courseMods.length} module{courseMods.length !== 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity onPress={() => openEditModal('course', item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ marginRight: 8 }}>
            <Pencil size={15} color={Colors.primary} />
          </TouchableOpacity>
          {open ? <ChevronDown size={18} color={Colors.primary} /> : <ChevronRight size={18} color={Colors.textMuted} />}
        </TouchableOpacity>

        {open && (
          <View style={s.expanded}>
            {/* Course-level actions */}
            <View style={s.courseActionRow}>
              <TouchableOpacity style={s.actionChip} onPress={() => openModal('module', item.id)}>
                <Plus size={13} color={Colors.primary} />
                <Text style={s.actionChipText}>Add Module</Text>
              </TouchableOpacity>
            </View>

            {/* Modules */}
            {courseMods.map(mod => {
              const modOpen = expandedModule === mod.id;
              const modLessons = lessons.filter(l => l.moduleId === mod.id);
              return (
                <View key={mod.id} style={s.moduleCard}>
                  {/* ── Module row ── */}
                  <TouchableOpacity style={s.moduleRow} onPress={() => setExpandedModule(modOpen ? null : mod.id)}>
                    <View style={s.moduleIconBg}><Layers size={13} color={Colors.textSecondary} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.moduleTitle}>{mod.title}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                        <Text style={s.moduleSub}>{modLessons.length} lesson{modLessons.length !== 1 ? 's' : ''}</Text>
                        {mod.estimatedDuration ? (
                          <View style={s.durationBadge}>
                            <Clock size={9} color={Colors.textMuted} />
                            <Text style={s.durationText}>{mod.estimatedDuration}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => openEditModal('module', mod, item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ marginRight: 10 }}>
                      <Pencil size={13} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete('modules', mod.id, mod.title)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Trash2 size={14} color={Colors.error} />
                    </TouchableOpacity>
                  </TouchableOpacity>

                  {/* ── Module lessons (expanded) ── */}
                  {modOpen && (
                    <View style={s.lessonList}>
                      <View style={s.modActionRow}>
                        <TouchableOpacity style={s.actionChipSm} onPress={() => openModal('lesson', mod.id, item.id)}>
                          <Plus size={11} color={Colors.primary} />
                          <Text style={s.actionChipSmText}>Add Lesson</Text>
                        </TouchableOpacity>
                      </View>

                      {modLessons.map(les => {
                        const lesQuiz = quizzes.find(q => q.lessonId === les.id);
                        return (
                          <View key={les.id} style={s.lessonRow}>
                            <View style={s.lessonDot} />
                            <View style={{ flex: 1 }}>
                              <Text style={s.lessonTitle} numberOfLines={1}>{les.title}</Text>
                              {lesQuiz && (
                                <View style={s.quizTag}>
                                  <ClipboardList size={9} color="#d97706" />
                                  <Text style={s.quizTagText}>Has Quiz</Text>
                                </View>
                              )}
                            </View>
                            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                              {/* Edit lesson */}
                              <TouchableOpacity onPress={() => openEditModal('lesson', les, mod.id, item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Pencil size={12} color={Colors.primary} />
                              </TouchableOpacity>
                              {/* Add / edit quiz for this lesson */}
                              <TouchableOpacity
                                onPress={() => {
                                  if (lesQuiz) openEditModal('quiz', lesQuiz, les.id, item.id);
                                  else openModal('quiz', les.id, item.id);
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <ClipboardList size={12} color={lesQuiz ? '#d97706' : Colors.textMuted} />
                              </TouchableOpacity>
                              {/* Delete lesson */}
                              <TouchableOpacity onPress={() => handleDelete('lessons', les.id, les.title)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Trash2 size={12} color={Colors.error} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}

                      {modLessons.length === 0 && (
                        <Text style={s.emptyModNote}>No lessons yet — tap "Add Lesson" above</Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            {/* Course edit / delete */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: Spacing.sm }}>
              <TouchableOpacity style={[s.courseActionBtn, { backgroundColor: Colors.primaryLight }]} onPress={() => openEditModal('course', item)}>
                <Pencil size={13} color={Colors.primary} />
                <Text style={[s.courseActionBtnText, { color: Colors.primary }]}>Edit Course</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.courseActionBtn} onPress={() => handleDelete('courses', item.id, item.title)}>
                <Trash2 size={13} color={Colors.error} />
                <Text style={s.courseActionBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  const modalTitle = editingId
    ? { course: 'Edit Course', module: 'Edit Module', lesson: 'Edit Lesson', quiz: 'Edit Quiz' }[modalType!]
    : { course: 'New Course', module: 'New Module', lesson: 'New Lesson', quiz: 'Quiz / Assignment' }[modalType!];

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Manage</Text>
          <Text style={s.headerSub}>{courses.length} course{courses.length !== 1 ? 's' : ''} · {modules.length} modules · {lessons.length} lessons</Text>
        </View>
        <TouchableOpacity style={s.addButton} onPress={() => openModal('course')}>
          <Plus size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={courses}
        keyExtractor={i => i.id}
        renderItem={renderCourse}
        refreshing={loading}
        onRefresh={fetchAll}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.empty}>
            <BookOpen size={48} color={Colors.textMuted} />
            <Text style={s.emptyTitle}>No Courses Yet</Text>
            <Text style={s.emptySub}>Tap + to create your first course</Text>
          </View>
        }
      />

      {/* ─── Unified Modal ─── */}
      <Modal animationType="slide" transparent visible={!!modalType} onRequestClose={() => { setModalType(null); resetForm(); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{modalTitle}</Text>
              <TouchableOpacity onPress={() => { setModalType(null); resetForm(); }}>
                <View style={s.closeBtn}><X size={18} color={Colors.textSecondary} /></View>
              </TouchableOpacity>
            </View>

            <ScrollView style={s.modalForm} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* ── Title (all except quiz) ── */}
              {modalType !== 'quiz' && (
                <Input label="Title *" placeholder="Enter title" value={formTitle} onChangeText={setFormTitle} />
              )}

              {/* ── Description ── */}
              {(modalType === 'course' || modalType === 'module' || modalType === 'lesson') && (
                <Input
                  label="Description"
                  placeholder="Enter description"
                  value={formDesc}
                  onChangeText={setFormDesc}
                  multiline
                  numberOfLines={3}
                  style={{ height: 90, textAlignVertical: 'top', paddingTop: 12 }}
                />
              )}

              {/* ══════════════════════════════════════
                  COURSE: cover image + video + PDF
              ══════════════════════════════════════ */}
              {modalType === 'course' && (
                <View style={s.section}>
                  <Text style={s.sectionLabel}>Media (all optional)</Text>
                  <Input label="Intro Video URL" placeholder="https://... (or upload below)" value={formVideoUrl} onChangeText={setFormVideoUrl} />
                  {[
                    { label: selectedImage ? '✓ Cover Image selected' : 'Upload Cover Image', fn: pickImage, active: !!selectedImage, icon: <ImageIcon size={15} color={selectedImage ? Colors.white : Colors.primary} /> },
                    { label: selectedVideo ? '✓ Video selected' : 'Upload Video File', fn: pickVideo, active: !!selectedVideo, icon: <Video size={15} color={selectedVideo ? Colors.white : Colors.primary} /> },
                    { label: selectedPdf ? '✓ PDF selected' : 'Upload PDF Material', fn: pickPdf, active: !!selectedPdf, icon: <FileText size={15} color={selectedPdf ? Colors.white : Colors.primary} /> },
                  ].map((p, i) => (
                    <TouchableOpacity key={i} style={[s.pickerRow, p.active && s.pickerRowActive]} onPress={p.fn}>
                      {p.icon}
                      <Text style={[s.pickerRowText, p.active && { color: Colors.white }]}>{p.label}</Text>
                      {p.active && <CheckCircle size={14} color={Colors.white} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Module has no extra fields — title + description (above) are sufficient */}

              {/* ══════════════════════════════════════
                  LESSON: video upload + PDF
              ══════════════════════════════════════ */}
              {modalType === 'lesson' && (
                <View style={s.section}>
                  <Text style={s.sectionLabel}>Lesson Content</Text>
                  <Input label="Video URL (optional)" placeholder="https://... (or upload below)" value={formVideoUrl} onChangeText={setFormVideoUrl} />
                  <Input label="PDF URL (optional)" placeholder="https://..." value={formPdfUrl} onChangeText={setFormPdfUrl} />
                  <Text style={s.sectionLabel}>Upload Files</Text>
                  {[
                    { label: selectedVideo ? '✓ Video selected' : 'Upload Video File', fn: pickVideo, active: !!selectedVideo, icon: <Video size={15} color={selectedVideo ? Colors.white : Colors.primary} /> },
                    { label: selectedPdf ? '✓ PDF selected' : 'Upload PDF Material', fn: pickPdf, active: !!selectedPdf, icon: <FileText size={15} color={selectedPdf ? Colors.white : Colors.primary} /> },
                  ].map((p, i) => (
                    <TouchableOpacity key={i} style={[s.pickerRow, p.active && s.pickerRowActive]} onPress={p.fn}>
                      {p.icon}
                      <Text style={[s.pickerRowText, p.active && { color: Colors.white }]}>{p.label}</Text>
                      {p.active && <CheckCircle size={14} color={Colors.white} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* ══════════════════════════════════════
                  QUIZ / ASSIGNMENT
              ══════════════════════════════════════ */}
              {modalType === 'quiz' && (
                <View>
                  <Input label="Pass Mark (%)" keyboardType="numeric" value={formPassMark} onChangeText={setFormPassMark} />
                  <View style={{ marginTop: 20 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <Text style={s.sectionLabel}>Questions ({formQuestions.length})</Text>
                      <TouchableOpacity style={s.addQBtn} onPress={addQuestion}>
                        <Plus size={13} color={Colors.primary} />
                        <Text style={s.addQBtnText}>Add Question</Text>
                      </TouchableOpacity>
                    </View>

                    {formQuestions.map((q, qIdx) => (
                      <View key={q.id} style={s.qCard}>
                        <View style={s.qHeader}>
                          <Text style={s.qIndex}>Question {qIdx + 1}</Text>
                          <TouchableOpacity onPress={() => setFormQuestions(formQuestions.filter((_, i) => i !== qIdx))}>
                            <Trash2 size={15} color={Colors.error} />
                          </TouchableOpacity>
                        </View>
                        <TextInput
                          style={s.qInput}
                          placeholder="Question text"
                          value={q.question}
                          onChangeText={v => updateQuestion(qIdx, 'question', v)}
                          multiline
                          placeholderTextColor={Colors.textMuted}
                        />
                        <Text style={s.optLabel}>Options (tap to mark correct)</Text>
                        {q.options.map((opt: string, oIdx: number) => (
                          <View key={oIdx} style={s.optRow}>
                            <TouchableOpacity
                              style={[s.optRadio, q.correctIndex === oIdx && s.optRadioActive]}
                              onPress={() => updateQuestion(qIdx, 'correctIndex', oIdx)}
                            >
                              {q.correctIndex === oIdx && <View style={s.optRadioInner} />}
                            </TouchableOpacity>
                            <TextInput
                              style={s.optInput}
                              placeholder={`Option ${oIdx + 1}`}
                              value={opt}
                              onChangeText={v => updateOption(qIdx, oIdx, v)}
                              placeholderTextColor={Colors.textMuted}
                            />
                          </View>
                        ))}
                        <TextInput
                          style={[s.qInput, { marginTop: 8, fontSize: 12 }]}
                          placeholder="Explanation (shown after answer)"
                          value={q.explanation}
                          onChangeText={v => updateQuestion(qIdx, 'explanation', v)}
                          placeholderTextColor={Colors.textMuted}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <Button
                title={
                  submitting ? '' :
                  editingId
                    ? { course: 'Update Course', module: 'Update Module', lesson: 'Update Lesson', quiz: 'Update Quiz' }[modalType!] || 'Update'
                    : { course: 'Create Course', module: 'Add Module', lesson: 'Add Lesson', quiz: 'Save Quiz' }[modalType!] || 'Save'
                }
                onPress={() => {
                  if (modalType === 'course') handleSaveCourse();
                  else if (modalType === 'module') handleSaveModule();
                  else if (modalType === 'lesson') handleSaveLesson();
                  else if (modalType === 'quiz') handleSaveQuiz();
                }}
                loading={submitting}
                style={s.submitBtn}
              />

              {submitting && uploadProgress !== null && (
                <View style={s.uploadProgress}>
                  <Text style={s.uploadProgressText}>{uploadStatus}: {uploadProgress}%</Text>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${uploadProgress}%` as any }]} />
                  </View>
                </View>
              )}

              <View style={{ height: 50 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },

  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 48, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    borderBottomWidth: 1, borderBottomColor: Colors.glassBorder,
  },
  headerTitle: { ...Typography.h1, color: Colors.text },
  headerSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 4 },
  addButton: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },

  list: { padding: Spacing.lg, paddingBottom: 100 },

  courseCard: {
    backgroundColor: Colors.surface, borderRadius: 20, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.glassBorder, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  courseRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: 12 },
  courseIconBg: {
    width: 42, height: 42, borderRadius: 13, backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  courseTitle: { ...Typography.body, fontWeight: '700', color: Colors.text },
  courseSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },

  expanded: {
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.glassBorder,
    backgroundColor: Colors.background + '80',
  },
  courseActionRow: { flexDirection: 'row', gap: 8, marginTop: Spacing.sm, marginBottom: Spacing.xs },

  actionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: Colors.primaryLight, borderRadius: 10,
  },
  actionChipText: { ...Typography.caption, color: Colors.primary, fontWeight: '700' },

  moduleCard: {
    backgroundColor: Colors.surface, borderRadius: 14, marginBottom: Spacing.xs,
    borderWidth: 1, borderColor: Colors.glassBorder, overflow: 'hidden',
  },
  moduleRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  moduleIconBg: {
    width: 32, height: 32, borderRadius: 9, backgroundColor: Colors.surfaceLight,
    justifyContent: 'center', alignItems: 'center',
  },
  moduleTitle: { ...Typography.bodySmall, fontWeight: '700', color: Colors.text },
  moduleSub: { ...Typography.caption, color: Colors.textMuted },
  durationBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.surfaceLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  durationText: { fontSize: 9, color: Colors.textMuted, fontWeight: '600' },

  lessonList: { paddingHorizontal: 12, paddingBottom: 10, backgroundColor: Colors.surfaceLight },
  modActionRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 6 },
  actionChipSm: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: 10,
    backgroundColor: Colors.primaryLight, borderRadius: 8,
  },
  actionChipSmText: { fontSize: 11, color: Colors.primary, fontWeight: '700' },

  lessonRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.glassBorder,
  },
  lessonDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.primary, marginLeft: 4 },
  lessonTitle: { ...Typography.bodySmall, color: Colors.text },
  quizTag: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  quizTagText: { fontSize: 9, color: '#d97706', fontWeight: '700' },
  emptyModNote: { ...Typography.caption, color: Colors.textMuted, fontStyle: 'italic', paddingVertical: 10, paddingLeft: 4 },

  courseActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.06)',
  },
  courseActionBtnText: { ...Typography.caption, color: Colors.error, fontWeight: '600' },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { ...Typography.h2, color: Colors.text, marginTop: Spacing.lg },
  emptySub: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: Spacing.sm },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: Spacing.lg, maxHeight: '92%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.glassBorder, alignSelf: 'center', marginBottom: Spacing.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { ...Typography.h2, color: Colors.text },
  closeBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  modalForm: {},

  section: { marginBottom: Spacing.md },
  sectionLabel: { ...Typography.bodySmall, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm, marginTop: Spacing.sm },

  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surfaceLight, padding: 13, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.glassBorder, marginBottom: Spacing.xs,
  },
  pickerRowActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pickerRowText: { ...Typography.bodySmall, fontWeight: '600', color: Colors.text, flex: 1 },

  infoBox: {
    backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0',
    borderRadius: 12, padding: 12, marginTop: Spacing.sm,
  },
  infoBoxText: { fontSize: 12, color: '#166534', lineHeight: 18 },

  submitBtn: {
    marginTop: Spacing.lg, backgroundColor: Colors.primary, height: 54, borderRadius: 16,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5,
  },
  uploadProgress: {
    marginTop: 14, backgroundColor: Colors.surfaceLight, padding: 12,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.glassBorder,
  },
  uploadProgressText: { fontSize: 13, fontWeight: '700', color: Colors.primary, marginBottom: 8 },
  progressTrack: { height: 6, backgroundColor: Colors.glassBorder, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },

  addQBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 7, backgroundColor: Colors.primaryLight, borderRadius: 8 },
  addQBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  qCard: { backgroundColor: Colors.surfaceLight, padding: 14, borderRadius: 16, marginBottom: 14, borderWidth: 1, borderColor: Colors.glassBorder },
  qHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  qIndex: { fontSize: 13, fontWeight: '800', color: Colors.textSecondary },
  qInput: { backgroundColor: Colors.white, padding: 11, borderRadius: 10, borderWidth: 1, borderColor: Colors.glassBorder, color: Colors.text, marginBottom: 10 },
  optLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  optRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.glassBorder, justifyContent: 'center', alignItems: 'center' },
  optRadioActive: { borderColor: Colors.primary },
  optRadioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  optInput: { flex: 1, backgroundColor: Colors.white, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.glassBorder, fontSize: 13, color: Colors.text },
});
