import AsyncStorage from "@react-native-async-storage/async-storage";
import { ResizeMode, Video } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import {
    ChevronRight,
    Download,
    FileText,
    FolderOpen,
    HardDrive,
    Play,
    Trash2,
    Video as VideoIcon,
    Wifi,
    X,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../../src/theme/colors";

interface OfflineFile {
  id: string;
  name: string;
  uri: string;
  type: "video" | "pdf";
  size: number;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

type FilterType = "all" | "video" | "pdf";

export default function DownloadsScreen() {
  const router = useRouter();
  const [files, setFiles] = useState<OfflineFile[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();

  const loadFiles = async () => {
    setLoading(true);
    try {
      const docDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
      if (!docDir) {
        setLoading(false);
        return;
      }

      const fileList: OfflineFile[] = [];

      // Load course downloads
      const courseDownloadsStr = await AsyncStorage.getItem("course_downloads");
      if (courseDownloadsStr) {
        const courseDownloads = JSON.parse(courseDownloadsStr);
        for (const id in courseDownloads) {
          const course = courseDownloads[id];
          for (const type of course.files) {
            const fileName =
              type === "video"
                ? `course_${id}_video.mp4`
                : `course_${id}_material.pdf`;
            const fileUri = docDir + fileName;
            const info = await FileSystem.getInfoAsync(fileUri);
            if (info.exists) {
              fileList.push({
                id,
                name: `${course.title}`,
                uri: fileUri,
                type: type as "video" | "pdf",
                size: (info as any).size || 0,
              });
            }
          }
        }
      }

      // Load lesson downloads
      const lessonDownloadsStr = await AsyncStorage.getItem("lesson_downloads");
      if (lessonDownloadsStr) {
        const lessonDownloads = JSON.parse(lessonDownloadsStr);
        for (const id in lessonDownloads) {
          const lesson = lessonDownloads[id];
          for (const type of lesson.files) {
            const fileName =
              type === "video"
                ? `lesson_${id}_video.mp4`
                : `lesson_${id}_material.pdf`;
            const fileUri = docDir + fileName;
            const info = await FileSystem.getInfoAsync(fileUri);
            if (info.exists) {
              fileList.push({
                id,
                name: `${lesson.title}`,
                uri: fileUri,
                type: type as "video" | "pdf",
                size: (info as any).size || 0,
              });
            }
          }
        }
      }

      setFiles(fileList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadFiles();
    }, []),
  );

  const filteredFiles = useMemo(() => {
    if (activeFilter === "all") return files;
    return files.filter((f) => f.type === activeFilter);
  }, [files, activeFilter]);

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  const videoSize = files
    .filter((f) => f.type === "video")
    .reduce((acc, f) => acc + f.size, 0);
  const pdfSize = files
    .filter((f) => f.type === "pdf")
    .reduce((acc, f) => acc + f.size, 0);

  const handleOpenFile = async (file: OfflineFile) => {
    if (file.type === "video") {
      setSelectedVideo(file.uri);
    } else {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri);
      } else {
        Alert.alert(
          "Not Available",
          "Sharing is not available on this device.",
        );
      }
    }
  };

  const handleDelete = (file: OfflineFile) => {
    Alert.alert("Remove Download", `Delete "${file.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await FileSystem.deleteAsync(file.uri);

          // Try to delete from course_downloads first
          const courseDownloadsStr =
            await AsyncStorage.getItem("course_downloads");
          if (courseDownloadsStr) {
            const courseDownloads = JSON.parse(courseDownloadsStr);
            if (courseDownloads[file.id]) {
              courseDownloads[file.id].files = courseDownloads[
                file.id
              ].files.filter((f: string) => f !== file.type);
              if (courseDownloads[file.id].files.length === 0)
                delete courseDownloads[file.id];
              await AsyncStorage.setItem(
                "course_downloads",
                JSON.stringify(courseDownloads),
              );
            }
          }

          // Try to delete from lesson_downloads
          const lessonDownloadsStr =
            await AsyncStorage.getItem("lesson_downloads");
          if (lessonDownloadsStr) {
            const lessonDownloads = JSON.parse(lessonDownloadsStr);
            if (lessonDownloads[file.id]) {
              lessonDownloads[file.id].files = lessonDownloads[
                file.id
              ].files.filter((f: string) => f !== file.type);
              if (lessonDownloads[file.id].files.length === 0)
                delete lessonDownloads[file.id];
              await AsyncStorage.setItem(
                "lesson_downloads",
                JSON.stringify(lessonDownloads),
              );
            }
          }

          loadFiles();
        },
      },
    ]);
  };

  return (
    <View style={s.container}>
      {/* Premium Header */}
      <LinearGradient
        colors={[Colors.primary, "#1e40af"]}
        style={[s.header, { paddingTop: insets.top + 10 }]}
      >
        <View style={s.headerTop}>
          <View>
            <Text style={s.headerTitle}>Downloads</Text>
            <Text style={s.headerSub}>Access your learning offline</Text>
          </View>
          <TouchableOpacity onPress={loadFiles} style={s.syncBtn}>
            <Download size={16} color={Colors.white} />
          </TouchableOpacity>
        </View>

        {/* Storage Stats Card */}
        <View style={s.statsCard}>
          <View style={s.statsHeader}>
            <View style={s.statsInfo}>
              <HardDrive size={18} color={Colors.primary} />
              <Text style={s.statsLabel}>Device Storage Used</Text>
            </View>
            <Text style={s.statsValue}>{formatSize(totalSize)}</Text>
          </View>

          <View style={s.storageProgressBg}>
            <View
              style={[
                s.storageProgressFill,
                {
                  width:
                    totalSize > 0
                      ? `${Math.min(100, (totalSize / (500 * 1024 * 1024)) * 100)}%`
                      : "0.5%",
                },
              ]}
            />
          </View>

          <View style={s.statsFooter}>
            <View style={s.legendItem}>
              <View
                style={[s.legendDot, { backgroundColor: Colors.primary }]}
              />
              <Text style={s.legendText}>Videos ({formatSize(videoSize)})</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: "#ef4444" }]} />
              <Text style={s.legendText}>PDFs ({formatSize(pdfSize)})</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Filter Chips */}
      <View style={s.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterScroll}
        >
          <TouchableOpacity
            style={[s.filterChip, activeFilter === "all" && s.filterChipActive]}
            onPress={() => setActiveFilter("all")}
          >
            <Text
              style={[
                s.filterChipText,
                activeFilter === "all" && s.filterChipTextActive,
              ]}
            >
              All Files
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              s.filterChip,
              activeFilter === "video" && s.filterChipActive,
            ]}
            onPress={() => setActiveFilter("video")}
          >
            <VideoIcon
              size={14}
              color={
                activeFilter === "video" ? Colors.white : Colors.textSecondary
              }
            />
            <Text
              style={[
                s.filterChipText,
                activeFilter === "video" && s.filterChipTextActive,
              ]}
            >
              Videos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.filterChip, activeFilter === "pdf" && s.filterChipActive]}
            onPress={() => setActiveFilter("pdf")}
          >
            <FileText
              size={14}
              color={
                activeFilter === "pdf" ? Colors.white : Colors.textSecondary
              }
            />
            <Text
              style={[
                s.filterChipText,
                activeFilter === "pdf" && s.filterChipTextActive,
              ]}
            >
              Documents
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {files.length === 0 ? (
        /* ─── Premium Empty State ─── */
        <View style={s.emptyState}>
          <View style={s.emptyIconCircle}>
            <FolderOpen size={48} color={Colors.primary} />
          </View>
          <Text style={s.emptyTitle}>Offline Library is Empty</Text>
          <Text style={s.emptySub}>
            Download course videos and materials to learn anytime, even without
            an internet connection.
          </Text>
          <TouchableOpacity
            style={s.browseBtn}
            onPress={() => router.push("/(student)/(tabs)")}
          >
            <Text style={s.browseBtnText}>Browse Courses</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredFiles}
          keyExtractor={(item, index) => `${item.uri}-${index}`}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.fileCard}
              activeOpacity={0.8}
              onPress={() => handleOpenFile(item)}
            >
              <View style={s.fileIconFrame}>
                <View
                  style={[
                    s.fileIconBg,
                    item.type === "video" ? s.videoBg : s.pdfBg,
                  ]}
                >
                  {item.type === "video" ? (
                    <Play
                      size={22}
                      color={Colors.primary}
                      fill={Colors.primary}
                    />
                  ) : (
                    <FileText size={22} color="#ef4444" />
                  )}
                </View>
                <View style={s.typeBadge}>
                  <Text style={s.typeBadgeText}>
                    {item.type === "video" ? "MP4" : "PDF"}
                  </Text>
                </View>
              </View>

              <View style={s.fileInfo}>
                <Text style={s.fileName} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={s.fileMeta}>
                  <Text style={s.fileSize}>{formatSize(item.size)}</Text>
                  <View style={s.metaDot} />
                  <Text style={s.fileStatus}>Available Offline</Text>
                </View>
              </View>

              <View style={s.fileActions}>
                <TouchableOpacity
                  style={s.deleteIconButton}
                  onPress={() => handleDelete(item)}
                >
                  <Trash2 size={18} color={Colors.textMuted} />
                </TouchableOpacity>
                <ChevronRight size={20} color={Colors.textMuted} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Offline Video Player Modal */}
      <Modal
        visible={!!selectedVideo}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSelectedVideo(null)}
      >
        <View style={s.playerContainer}>
          <View
            style={[s.modalHeader, { paddingTop: Math.max(insets.top, 20) }]}
          >
            <TouchableOpacity
              style={s.modalCloseBtn}
              onPress={() => setSelectedVideo(null)}
            >
              <X color={Colors.white} size={24} />
            </TouchableOpacity>
            <Text style={s.modalTitle}>Offline Player</Text>
            <View style={{ width: 44 }} />
          </View>

          <View style={s.videoWrapper}>
            {selectedVideo && (
              <Video
                source={{ uri: selectedVideo }}
                style={s.offlineVideo}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
              />
            )}
          </View>

          <View
            style={[
              s.playerFooter,
              { paddingBottom: Math.max(insets.bottom, 40) },
            ]}
          >
            <Wifi size={16} color="rgba(255,255,255,0.4)" />
            <Text style={s.offlineNotice}>Playing from local storage</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 80,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: { fontSize: 28, fontWeight: "800", color: Colors.white },
  headerSub: { fontSize: 14, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  syncBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },

  statsCard: {
    position: "absolute",
    bottom: -50,
    left: 20,
    right: 20,
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statsInfo: { flexDirection: "row", alignItems: "center", gap: 8 },
  statsLabel: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  statsValue: { fontSize: 15, fontWeight: "800", color: Colors.text },
  storageProgressBg: {
    height: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    overflow: "hidden",
  },
  storageProgressFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  statsFooter: { flexDirection: "row", marginTop: 12, gap: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: Colors.textMuted, fontWeight: "500" },

  filterRow: { marginTop: 65, marginBottom: 10 },
  filterScroll: { paddingHorizontal: 20, gap: 10 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  filterChipTextActive: { color: Colors.white },

  listContent: { padding: 20, paddingBottom: 100 },
  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  fileIconFrame: { position: "relative" },
  fileIconBg: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  videoBg: { backgroundColor: Colors.primaryLight },
  pdfBg: { backgroundColor: "#fef2f2" },
  typeBadge: {
    position: "absolute",
    bottom: -5,
    right: -5,
    backgroundColor: Colors.white,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    elevation: 2,
  },
  typeBadgeText: {
    fontSize: 8,
    fontWeight: "900",
    color: Colors.textSecondary,
  },

  fileInfo: { flex: 1, marginLeft: 16 },
  fileName: { fontSize: 15, fontWeight: "700", color: Colors.text },
  fileMeta: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  fileSize: { fontSize: 12, color: Colors.textMuted },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#cbd5e1",
    marginHorizontal: 8,
  },
  fileStatus: { fontSize: 11, fontWeight: "600", color: "#10b981" },

  fileActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  deleteIconButton: { padding: 8 },

  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 12,
  },
  emptySub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 30,
  },
  browseBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 16,
  },
  browseBtnText: { color: Colors.white, fontWeight: "700", fontSize: 15 },

  playerContainer: { flex: 1, backgroundColor: "#000" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  modalCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: { color: Colors.white, fontSize: 16, fontWeight: "700" },
  videoWrapper: { flex: 1, justifyContent: "center" },
  offlineVideo: { width: "100%", height: 280 },
  playerFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 50,
    opacity: 0.5,
  },
  offlineNotice: { color: Colors.white, fontSize: 12 },
});
