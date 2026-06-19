import AsyncStorage from "@react-native-async-storage/async-storage";
import { AVPlaybackStatus, ResizeMode, Video } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    increment,
    query,
    updateDoc,
    where,
} from "firebase/firestore";
import {
    Award,
    BookOpen,
    CheckCircle,
    ChevronLeft,
    ClipboardList,
    Download,
    FileText,
    MoreVertical,
    Play,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Linking,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { db } from "../../../src/config/firebase";
import { useAuth } from "../../../src/context/AuthContext";
import {
    isLessonCompleted,
    markLessonComplete,
    queueOfflineAction,
    saveLessonProgress,
} from "../../../src/services/progressService";
import { Spacing, Typography } from "../../../src/theme";
import { Colors } from "../../../src/theme/colors";

const { width } = Dimensions.get("window");

export default function LessonDetail() {
  const { id, courseId: paramCourseId } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();

  const [lesson, setLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [hasQuiz, setHasQuiz] = useState(false);
  const [quizPassed, setQuizPassed] = useState(false);
  const [activeTab, setActiveTab] = useState<"notes" | "quiz">("notes");
  const [autoCompleting, setAutoCompleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadSize, setDownloadSize] = useState(0);

  const insets = useSafeAreaInsets();

  const videoRef = useRef<Video>(null);
  const lastTickRef = useRef<number>(Date.now());
  const lastLearningUpdateRef = useRef<number>(Date.now());
  const watchedSecondsRef = useRef<number>(0);
  const videoDurationRef = useRef<number>(0);
  const lastSavedPctRef = useRef<number>(0);
  const lastSavedTimeRef = useRef<number>(Date.now());

  const [videoProgress, setVideoProgress] = useState(0);

  useEffect(() => {
    if (!id) return;
    loadLesson();
  }, [id]);

  const loadLesson = async () => {
    try {
      const docRef = doc(db, "lessons", id as string);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const lessonData = { id: docSnap.id, ...docSnap.data() };
        setLesson(lessonData);

        // Check if quiz exists for this lesson
        const quizSnap = await getDocs(
          query(collection(db, "quizzes"), where("lessonId", "==", id)),
        );
        setHasQuiz(!quizSnap.empty);

        // Check if quiz already passed
        if (user && !quizSnap.empty) {
          const resultId = `${user.uid}_${id}`;
          const resultRef = doc(db, "quizResults", resultId);
          const resultSnap = await getDoc(resultRef);
          if (resultSnap.exists() && resultSnap.data()?.passed) {
            setQuizPassed(true);
          }
        }

        // Check completion status
        if (user) {
          const done = await isLessonCompleted(user.uid, id as string);
          setCompleted(done);
        }
      } else {
        Alert.alert("Error", "Lesson not found");
        router.back();
      }
    } catch (error) {
      console.error("Error fetching lesson:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoComplete = async () => {
    if (!user || !lesson || completed || autoCompleting) return;
    setAutoCompleting(true);
    const courseId = (paramCourseId as string) || lesson.courseId;
    try {
      await markLessonComplete(user.uid, lesson.id, courseId);
      setCompleted(true);
    } catch (error) {
      console.warn("Offline/Error marking lesson complete, queuing action:", error);
      await queueOfflineAction({
        type: "lesson_completion",
        userId: user.uid,
        lessonId: lesson.id,
        courseId,
        timestamp: Date.now(),
      });
      setCompleted(true);
    } finally {
      setAutoCompleting(false);
    }
  };

  const saveDownloadMetadata = async (type: "video" | "pdf") => {
    try {
      const downloadsStr = await AsyncStorage.getItem("lesson_downloads");
      const downloads = downloadsStr ? JSON.parse(downloadsStr) : {};

      const lessonId = lesson?.id || (id as string);
      const courseId = lesson?.courseId || (paramCourseId as string);

      if (!downloads[lessonId]) {
        downloads[lessonId] = {
          id: lessonId,
          title: lesson?.title || "Unknown Lesson",
          courseId: courseId,
          timestamp: Date.now(),
          files: [],
        };
      }

      if (!downloads[lessonId].files.includes(type)) {
        downloads[lessonId].files.push(type);
      }

      await AsyncStorage.setItem("lesson_downloads", JSON.stringify(downloads));
      return true;
    } catch (e) {
      console.error("Error saving metadata:", e);
      return false;
    }
  };

  const handleDownload = async () => {
    if (!lesson) return;

    const pdfUri = lesson.pdfUrl || lesson.materialUrl;
    if (!pdfUri || !pdfUri.startsWith("http")) {
      Alert.alert("Invalid URL", "No valid PDF URL found for this lesson.");
      return;
    }

    if (Platform.OS === "web") {
      window.open(pdfUri, "_blank");
      return;
    }

    const docDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
    if (!docDir) {
      Alert.alert(
        "Storage Error",
        "Local file access is completely blocked on this device.",
      );
      return;
    }

    setIsDownloading(true);
    setShowDownloadMenu(false);

    try {
      const fileUri = docDir + `lesson_${id}_material.pdf`;
      console.log("Starting PDF download from:", pdfUri);

      const result = await FileSystem.downloadAsync(encodeURI(pdfUri), fileUri);

      if (result && (result.status === 200 || result.status === 206)) {
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (fileInfo.exists && fileInfo.size > 0) {
          await saveDownloadMetadata("pdf");
          Alert.alert(
            "✅ Material Saved",
            "The PDF has been saved for offline reading.",
          );
        } else {
          throw new Error(
            "PDF download finished but file is empty or missing.",
          );
        }
      } else {
        throw new Error(`Download failed with status ${result?.status}`);
      }
    } catch (e: any) {
      console.error("PDF Download Error:", e);
      Alert.alert("Download Failed", e.message || "Failed to download PDF.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadVideo = async () => {
    if (!lesson) return;

    const videoUri = lesson.videoUrl;
    if (!videoUri || !videoUri.startsWith("http")) {
      Alert.alert("Invalid URL", "No valid video URL found for this lesson.");
      return;
    }

    if (Platform.OS === "web") {
      window.open(videoUri, "_blank");
      return;
    }

    let docDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;

    if (!docDir && Platform.OS === "ios") {
      console.log(
        "⚠️ FileSystem constants missing. Attempting iOS hard-coded fallback.",
      );
      docDir = "file:///var/mobile/Containers/Data/Application/Documents/";
    }

    if (!docDir) {
      console.log("CRITICAL ERROR: FileSystem constants:", {
        docDir: FileSystem.documentDirectory,
        cacheDir: FileSystem.cacheDirectory,
      });

      console.log("Attempting Browser-style download fallback on Native...");
      Linking.openURL(videoUri);
      return;
    }

    setIsDownloading(true);
    setShowDownloadMenu(false);

    try {
      const fileUri = docDir + `lesson_${id}_video.mp4`;
      console.log("Starting Video download from:", videoUri);

      const existingFile = await FileSystem.getInfoAsync(fileUri);
      if (existingFile.exists) {
        Alert.alert(
          "Already Downloaded",
          "This video is already saved offline. Download again?",
          [
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => setIsDownloading(false),
            },
            {
              text: "Re-download",
              onPress: () => performVideoDownload(videoUri, fileUri),
            },
          ],
        );
        return;
      }

      await performVideoDownload(videoUri, fileUri);
    } catch (e: any) {
      console.error("Video Download Error:", e);
      Alert.alert(
        "Download Failed",
        e.message ||
          "Could not save video offline. Please check your connection.",
      );
      setIsDownloading(false);
    }
  };

  const performVideoDownload = async (videoUri: string, fileUri: string) => {
    try {
      console.log("--- VIDEO DOWNLOAD START ---");
      console.log("URL:", videoUri);
      console.log("Dest:", fileUri);

      setDownloadProgress(0);

      const result = await FileSystem.downloadAsync(videoUri, fileUri, {
        progressCallback: (progress) => {
          const newProgress =
            progress.totalBytesWritten / progress.totalBytesExpectedToWrite ||
            0;
          setDownloadProgress(Math.min(newProgress, 0.99));
          setDownloadSize(progress.totalBytesExpectedToWrite);
        },
      });

      if (result && (result.status === 200 || result.status === 206)) {
        console.log("Download request successful, status:", result.status);
        setDownloadProgress(1);

        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (fileInfo.exists && fileInfo.size > 0) {
          console.log("File verified on disk. Size:", fileInfo.size);
          const metaSaved = await saveDownloadMetadata("video");
          if (metaSaved) {
            setTimeout(() => {
              Alert.alert(
                "✅ Download Complete",
                "The video has been saved for offline viewing. You can find it in the Downloads tab.",
              );
            }, 500);
          } else {
            throw new Error(
              "Could not save download record, but file is on disk.",
            );
          }
        } else {
          throw new Error(
            "Download finished but file not found on disk or empty.",
          );
        }
      } else {
        throw new Error(
          `Download failed with status ${result?.status || "unknown"}`,
        );
      }
    } catch (e: any) {
      console.error("CRITICAL DOWNLOAD ERROR:", e);
      Alert.alert(
        "Download Error",
        e.message ||
          "Could not download video. Please check your storage and connection.",
      );
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
      setDownloadSize(0);
    }
  };

  const onPlaybackStatusUpdate = async (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

    if (status.durationMillis) {
      videoDurationRef.current = status.durationMillis / 1000;
    }

    if (status.isPlaying) {
      const now = Date.now();

      // 1-second tick: accumulate watched time + update progress bar
      if (now - lastTickRef.current >= 1000) {
        lastTickRef.current = now;
        watchedSecondsRef.current += 1;

        if (videoDurationRef.current > 0) {
          const pct = watchedSecondsRef.current / videoDurationRef.current;
          setVideoProgress(Math.min(pct, 1));

          // Auto-complete at 80% watch threshold
          if (!completed && pct >= 0.8) {
            handleAutoComplete();
          } else if (!completed && user && lesson) {
            // Save progress if changed by at least 5% or 5 seconds have passed (with at least 1% change)
            const pctDiff = Math.abs(pct - lastSavedPctRef.current);
            const timeDiff = now - lastSavedTimeRef.current;
            if (pctDiff >= 0.05 || (timeDiff >= 5000 && pctDiff >= 0.01)) {
              lastSavedPctRef.current = pct;
              lastSavedTimeRef.current = now;
              saveLessonProgress(
                user.uid,
                lesson.id,
                (paramCourseId as string) || lesson.courseId,
                Math.round(pct * 100),
                false
              );
            }
          }
        }
      }

      // 30-second tick: update user learning time
      if (now - lastLearningUpdateRef.current >= 30000 && user) {
        lastLearningUpdateRef.current = now;
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          totalLearningMinutes: increment(1),
        });
      }
    } else if (status.positionMillis && videoDurationRef.current > 0 && user && lesson && !completed) {
      // Save progress on pause or seek if changed by at least 2%
      const pct = (status.positionMillis / 1000) / videoDurationRef.current;
      const pctDiff = Math.abs(pct - lastSavedPctRef.current);
      if (pctDiff >= 0.02) {
        lastSavedPctRef.current = pct;
        lastSavedTimeRef.current = Date.now();
        saveLessonProgress(
          user.uid,
          lesson.id,
          (paramCourseId as string) || lesson.courseId,
          Math.round(pct * 100),
          false
        );
      }
    }
  };

  // Download Progress Modal
  const downloadProgressPercent = Math.round(downloadProgress * 100);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!lesson) return null;

  return (
    <>
      {/* Download Progress Modal */}
      <Modal
        visible={isDownloading && downloadProgress > 0}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.downloadOverlay}>
          <View style={styles.downloadBox}>
            <Text style={styles.downloadTitle}>Downloading Video</Text>
            <View style={styles.downloadProgressBarBg}>
              <View
                style={[
                  styles.downloadProgressBarFill,
                  { width: `${downloadProgressPercent}%` },
                ]}
              />
            </View>
            <Text style={styles.downloadPercent}>
              {downloadProgressPercent}%
            </Text>
            {downloadSize > 0 && (
              <Text style={styles.downloadSize}>
                {(
                  ((downloadProgressPercent / 100) * downloadSize) /
                  1024 /
                  1024
                ).toFixed(1)}{" "}
                MB / {(downloadSize / 1024 / 1024).toFixed(1)} MB
              </Text>
            )}
          </View>
        </View>
      </Modal>

      <View style={styles.container}>
        {/* Video Header */}
        <View style={styles.videoHeader}>
          {playing ? (
            <View style={styles.videoContainer}>
              <Video
                ref={videoRef}
                source={{ uri: lesson.videoUrl }}
                style={styles.video}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                progressUpdateIntervalMillis={500}
                onPlaybackStatusUpdate={(status) => {
                  if (status.isLoaded) {
                    setIsVideoLoading(status.isBuffering);
                  }
                  onPlaybackStatusUpdate(status);
                }}
                onLoadStart={() => setIsVideoLoading(true)}
                onLoad={() => setIsVideoLoading(false)}
                onError={() => {
                  setIsVideoLoading(false);
                  Alert.alert("Error", "Could not play video.");
                }}
              />
              {isVideoLoading && (
                <View style={styles.videoLoadingOverlay}>
                  <ActivityIndicator size="large" color={Colors.white} />
                  <Text style={styles.loadingText}>Loading Video...</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              <View style={styles.placeholderInner}>
                <BookOpen size={48} color={Colors.primary} />
                <Text style={styles.placeholderTitle} numberOfLines={2}>
                  {lesson.title}
                </Text>
              </View>
              {lesson.videoUrl && (
                <TouchableOpacity
                  style={styles.playButton}
                  onPress={() => {
                    setPlaying(true);
                    setIsVideoLoading(true);
                  }}
                >
                  <View style={styles.playIconBg}>
                    <Play color={Colors.white} size={32} fill={Colors.white} />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ChevronLeft color={Colors.white} size={28} />
          </TouchableOpacity>

          {/* Download Menu Button */}
          {lesson?.videoUrl && (
            <View style={styles.downloadMenuContainer}>
              <TouchableOpacity
                style={styles.downloadMenuButton}
                onPress={() => setShowDownloadMenu(!showDownloadMenu)}
                activeOpacity={0.7}
              >
                <MoreVertical color={Colors.white} size={24} />
              </TouchableOpacity>

              {showDownloadMenu && (
                <View style={styles.downloadMenu}>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={handleDownloadVideo}
                    disabled={isDownloading}
                  >
                    <Download size={18} color={Colors.primary} />
                    <Text style={styles.menuItemText}>
                      {isDownloading ? "Downloading..." : "Download Video"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Completion badge overlay */}
          {completed && (
            <View style={styles.completedBadge}>
              <CheckCircle size={16} color={Colors.white} />
              <Text style={styles.completedBadgeText}>Completed</Text>
            </View>
          )}
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "notes" && styles.activeTab]}
            onPress={() => setActiveTab("notes")}
          >
            <FileText
              size={16}
              color={activeTab === "notes" ? Colors.primary : Colors.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "notes" && styles.activeTabText,
              ]}
            >
              Notes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "quiz" && styles.activeTab]}
            onPress={() => setActiveTab("quiz")}
          >
            <ClipboardList
              size={16}
              color={activeTab === "quiz" ? Colors.primary : Colors.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "quiz" && styles.activeTabText,
              ]}
            >
              Quiz
            </Text>
            {hasQuiz && (
              <View
                style={[
                  styles.quizDot,
                  quizPassed && { backgroundColor: Colors.success },
                ]}
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === "notes" ? (
            <View style={styles.notesContent}>
              <Text style={styles.lessonTitle}>{lesson.title}</Text>
              <Text style={styles.lessonDescription}>{lesson.description}</Text>

              {/* PDF Material */}
              {lesson.pdfUrl && (
                <TouchableOpacity
                  style={styles.materialCard}
                  onPress={handleDownload}
                  disabled={isDownloading}
                >
                  <View style={styles.materialIconBg}>
                    <FileText size={22} color={Colors.primary} />
                  </View>
                  <View style={styles.materialInfo}>
                    <Text style={styles.materialName}>Course Material</Text>
                    <Text style={styles.materialType}>PDF Document</Text>
                  </View>
                  <Download
                    size={20}
                    color={isDownloading ? Colors.textMuted : Colors.primary}
                  />
                </TouchableOpacity>
              )}

              {/* YouTube Link */}
              {lesson.youtubeUrl && (
                <TouchableOpacity
                  style={styles.materialCard}
                  onPress={() => Linking.openURL(lesson.youtubeUrl)}
                >
                  <View
                    style={[
                      styles.materialIconBg,
                      { backgroundColor: "#FEE2E2" },
                    ]}
                  >
                    <Play size={22} color="#EF4444" />
                  </View>
                  <View style={styles.materialInfo}>
                    <Text style={styles.materialName}>Additional Video</Text>
                    <Text style={styles.materialType}>YouTube Link</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.quizContent}>
              {hasQuiz ? (
                <View style={styles.quizCard}>
                  <View style={styles.quizIconBg}>
                    <ClipboardList size={32} color={Colors.primary} />
                  </View>
                  <Text style={styles.quizTitle}>Lesson Assessment</Text>
                  <Text style={styles.quizSubtitle}>
                    Test your understanding of this lesson with a short quiz.
                  </Text>

                  {quizPassed ? (
                    <View style={styles.passedCard}>
                      <Award size={24} color={Colors.success} />
                      <Text style={styles.passedText}>
                        You've passed this quiz!
                      </Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={[
                      styles.quizButton,
                      quizPassed && styles.quizButtonRetake,
                    ]}
                    onPress={() =>
                      router.push({
                        pathname: "/(student)/quiz/[lessonId]",
                        params: {
                          lessonId: lesson.id,
                          courseId: lesson.courseId,
                        },
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.quizButtonText,
                        quizPassed && styles.quizButtonRetakeText,
                      ]}
                    >
                      {quizPassed ? "Retake Quiz" : "Take Quiz"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.noQuizCard}>
                  <ClipboardList size={40} color={Colors.textMuted} />
                  <Text style={styles.noQuizText}>
                    No quiz available for this lesson yet.
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Footer — video progress + auto-complete status */}
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          {lesson.videoUrl && !completed && videoProgress > 0 && (
            <View style={styles.progressBarRow}>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.round(videoProgress * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressPct}>
                {Math.round(videoProgress * 100)}%
              </Text>
            </View>
          )}
          {completed ? (
            <View style={styles.completedFooter}>
              <CheckCircle size={22} color={Colors.success} />
              <Text style={styles.completedFooterText}>Lesson Completed</Text>
            </View>
          ) : (
            <View style={styles.watchingFooter}>
              {lesson.videoUrl ? (
                <>
                  <View style={styles.watchingDot} />
                  <Text style={styles.watchingText}>
                    {autoCompleting
                      ? "Saving progress..."
                      : "Watch the video to complete this lesson"}
                  </Text>
                </>
              ) : (
                <Text style={styles.watchingText}>
                  No video — quiz completion awards progress
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  // ─── Video Header ──────────────────
  videoHeader: {
    height: 260,
    backgroundColor: "#0f0f1e",
    position: "relative",
  },
  videoContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
    justifyContent: "center",
  },
  video: { width: "100%", height: "100%" },
  headerGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 25,
  },
  videoLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  loadingText: {
    color: Colors.white,
    marginTop: 10,
    ...Typography.bodySmall,
    fontWeight: "600",
  },
  placeholderContainer: {
    width: "100%",
    height: "100%",
    position: "relative",
    backgroundColor: "#0f0f1e",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderInner: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  placeholderTitle: {
    ...Typography.h3,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginTop: Spacing.md,
  },
  playButton: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    zIndex: 10,
  },
  playIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 30,
  },
  downloadMenuContainer: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 35,
  },
  downloadMenuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  downloadMenu: {
    position: "absolute",
    top: 50,
    right: 0,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    minWidth: 180,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  menuItemText: {
    ...Typography.bodySmall,
    color: Colors.text,
    fontWeight: "600",
  },
  completedBadge: {
    position: "absolute",
    top: 52,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    zIndex: 30,
  },
  completedBadgeText: {
    ...Typography.caption,
    color: Colors.white,
    fontWeight: "700",
  },
  // ─── Tab Bar ──────────────────
  tabBar: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
    paddingHorizontal: Spacing.lg,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    marginRight: Spacing.xl,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    gap: 8,
  },
  activeTab: { borderBottomColor: Colors.primary },
  tabText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  activeTabText: { color: Colors.primary },
  quizDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.warning,
    marginLeft: 4,
  },
  // ─── Content ──────────────────
  scrollContent: { paddingBottom: 160 },
  notesContent: { padding: Spacing.lg },
  lessonTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  lessonDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  materialCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 16,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    gap: 14,
  },
  materialIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  materialInfo: { flex: 1 },
  materialName: {
    ...Typography.bodySmall,
    color: Colors.text,
    fontWeight: "600",
  },
  materialType: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  // ─── Quiz Tab ──────────────────
  quizContent: { padding: Spacing.lg },
  quizCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  quizIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  quizTitle: {
    ...Typography.h3,
    color: Colors.text,
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  quizSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  passedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 10,
    marginBottom: Spacing.md,
    width: "100%",
  },
  passedText: {
    ...Typography.bodySmall,
    color: Colors.success,
    fontWeight: "600",
  },
  quizButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 14,
    width: "100%",
    alignItems: "center",
  },
  quizButtonRetake: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  quizButtonText: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: "700",
  },
  quizButtonRetakeText: { color: Colors.primary },
  noQuizCard: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  noQuizText: {
    ...Typography.body,
    color: Colors.textMuted,
    textAlign: "center",
  },
  // ─── Footer ──────────────────
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.glassBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  progressBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  progressPct: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: "700",
    minWidth: 32,
    textAlign: "right",
  },
  watchingFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 10,
  },
  watchingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    opacity: 0.7,
  },
  watchingText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  completedFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: "#ECFDF5",
    gap: 10,
  },
  completedFooterText: {
    ...Typography.body,
    color: Colors.success,
    fontWeight: "700",
  },
  // ─── Download Modal ──────────────────
  downloadOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  downloadBox: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.lg,
    minWidth: 280,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  downloadTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  downloadProgressBarBg: {
    width: "100%",
    height: 12,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  downloadProgressBarFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 6,
  },
  downloadPercent: {
    ...Typography.h2,
    color: Colors.primary,
    fontWeight: "800",
    marginBottom: Spacing.sm,
  },
  downloadSize: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
});
