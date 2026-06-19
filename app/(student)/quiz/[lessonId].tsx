import { useLocalSearchParams, useRouter } from "expo-router";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    where,
} from "firebase/firestore";
import {
    Award,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    RotateCcw,
    XCircle,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
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
import { markLessonComplete, updateCourseProgress, queueOfflineAction } from "../../../src/services/progressService";
import { Spacing, Typography } from "../../../src/theme";
import { Colors } from "../../../src/theme/colors";

const { width: screenWidth } = Dimensions.get("window");

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export default function QuizScreen() {
  const { lessonId, courseId } = useLocalSearchParams();
  const { user, profile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [quizId, setQuizId] = useState("");
  const [passMark, setPassMark] = useState(60);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [courseTitle, setCourseTitle] = useState("");

  useEffect(() => {
    loadQuiz();
  }, [lessonId]);

  const loadQuiz = async () => {
    try {
      const quizSnap = await getDocs(
        query(collection(db, "quizzes"), where("lessonId", "==", lessonId)),
      );
      if (quizSnap.empty) {
        router.back();
        return;
      }

      const quizDoc = quizSnap.docs[0];
      const data = quizDoc.data();
      setQuizId(quizDoc.id);
      setPassMark(data.passMark || 60);

      const qs: QuizQuestion[] = (data.questions || []).map((q: any) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      }));
      setQuestions(qs);
      setAnswers(new Array(qs.length).fill(null));

      // Fetch course title for certificate
      if (courseId) {
        const courseDoc = await getDoc(doc(db, "courses", courseId as string));
        if (courseDoc.exists()) {
          setCourseTitle(courseDoc.data().title || "");
        }
      }
    } catch (error) {
      console.error("Error loading quiz:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectOption = (optionIndex: number) => {
    if (submitted) return;
    const newAnswers = [...answers];
    newAnswers[currentIndex] = optionIndex;
    setAnswers(newAnswers);
  };

  const goNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    // Check all questions answered
    const unanswered = answers.findIndex((a) => a === null);
    if (unanswered !== -1) {
      setCurrentIndex(unanswered);
      return;
    }

    setSubmitting(true);
    try {
      // Calculate score
      let correct = 0;
      questions.forEach((q, i) => {
        if (answers[i] === q.correctIndex) correct++;
      });
      const pct = Math.round((correct / questions.length) * 100);
      setScore(pct);

      const passed = pct >= passMark;

      // Save quiz result
      const resultId = `${user.uid}_${lessonId}`;
      try {
        await setDoc(doc(db, "quizResults", resultId), {
          userId: user.uid,
          lessonId,
          courseId: courseId || "",
          quizId,
          score: pct,
          passed,
          answers: answers as number[],
          completedAt: serverTimestamp(),
          attempts: 1,
        });

        // If quiz passed, mark the lesson as complete so completedLessons count
        // is accurate before the course-complete check below.
        if (passed && courseId) {
          await markLessonComplete(
            user.uid,
            lessonId as string,
            courseId as string,
          );
        }

        // Recalculate overall course progress (also auto-generates certificate
        // via progressService when courseComplete is true)
        if (courseId) {
          await updateCourseProgress(user.uid, courseId as string);
        }
      } catch (dbError) {
        console.warn("Offline/Error submitting quiz results, queuing action:", dbError);
        await queueOfflineAction({
          type: "quiz_submission",
          userId: user.uid,
          lessonId: lessonId as string,
          courseId: (courseId as string) || "",
          quizId: quizId || "",
          score: pct,
          passed,
          answers: answers as number[],
          timestamp: Date.now(),
        });
      }

      setSubmitted(true);
      setCurrentIndex(0); // Go back to first question for review
    } catch (error) {
      console.error("Error submitting quiz:", error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const currentQ = questions[currentIndex];
  const passed = score >= passMark;

  // ─── Results View ──────────────────────────────────────────────────────
  if (submitted) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBackBtn}
            onPress={() => router.back()}
          >
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Quiz Results</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.resultsScroll}>
          {/* Score Card */}
          <View
            style={[
              styles.scoreCard,
              passed ? styles.scoreCardPass : styles.scoreCardFail,
            ]}
          >
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreNumber}>{score}%</Text>
            </View>
            <View
              style={[
                styles.passBadge,
                passed ? styles.passBadgePass : styles.passBadgeFail,
              ]}
            >
              {passed ? (
                <Award size={18} color={Colors.white} />
              ) : (
                <XCircle size={18} color={Colors.white} />
              )}
              <Text style={styles.passBadgeText}>
                {passed ? "Passed!" : "Not Passed"}
              </Text>
            </View>
            <Text style={styles.scoreSubtext}>
              {passed
                ? "Congratulations! You demonstrated solid understanding."
                : `You need ${passMark}% to pass. Review the material and try again.`}
            </Text>
          </View>

          {/* Question Review */}
          <Text style={styles.reviewHeading}>Question Review</Text>
          {questions.map((q, i) => {
            const userAnswer = answers[i];
            const isCorrect = userAnswer === q.correctIndex;
            return (
              <View key={q.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewQNum}>Q{i + 1}</Text>
                  {isCorrect ? (
                    <CheckCircle size={20} color={Colors.success} />
                  ) : (
                    <XCircle size={20} color={Colors.error} />
                  )}
                </View>
                <Text style={styles.reviewQuestion}>{q.question}</Text>

                {q.options.map((opt, oi) => {
                  let optStyles: any[] = [styles.reviewOption];
                  let textStyles: any[] = [styles.reviewOptionText];

                  if (oi === q.correctIndex) {
                    optStyles.push(styles.reviewCorrect);
                    textStyles.push(styles.reviewCorrectText);
                  } else if (oi === userAnswer && !isCorrect) {
                    optStyles.push(styles.reviewWrong);
                    textStyles.push(styles.reviewWrongText);
                  }
                  return (
                    <View key={oi} style={optStyles}>
                      <Text style={textStyles}>{opt}</Text>
                      {oi === q.correctIndex && (
                        <CheckCircle size={16} color={Colors.success} />
                      )}
                    </View>
                  );
                })}

                <View style={styles.explanationBox}>
                  <Text style={styles.explanationLabel}>Explanation</Text>
                  <Text style={styles.explanationText}>{q.explanation}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Footer */}
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, Spacing.md) },
          ]}
        >
          {!passed ? (
            <TouchableOpacity
              style={styles.retakeButton}
              onPress={() => {
                setSubmitted(false);
                setAnswers(new Array(questions.length).fill(null));
                setCurrentIndex(0);
                setScore(0);
              }}
            >
              <RotateCcw size={20} color={Colors.white} />
              <Text style={styles.retakeButtonText}>Retake Quiz</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => router.back()}
            >
              <Text style={styles.doneButtonText}>Back to Lesson</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ─── Quiz Taking View ─────────────────────────────────────────────────
  const allAnswered = answers.every((a) => a !== null);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackBtn}
          onPress={() => router.back()}
        >
          <ChevronLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quiz</Text>
        <Text style={styles.headerCounter}>
          {currentIndex + 1}/{questions.length}
        </Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarBg}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${((currentIndex + 1) / questions.length) * 100}%` },
          ]}
        />
      </View>

      {/* Question */}
      <ScrollView contentContainerStyle={styles.questionScroll}>
        <Text style={styles.questionNumber}>Question {currentIndex + 1}</Text>
        <Text style={styles.questionText}>{currentQ.question}</Text>

        {currentQ.options.map((opt, i) => {
          const selected = answers[currentIndex] === i;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.optionCard, selected && styles.optionSelected]}
              onPress={() => selectOption(i)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.optionRadio,
                  selected && styles.optionRadioSelected,
                ]}
              >
                {selected && <View style={styles.optionRadioInner} />}
              </View>
              <Text
                style={[
                  styles.optionText,
                  selected && styles.optionTextSelected,
                ]}
              >
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Navigation */}
      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, Spacing.md) },
        ]}
      >
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[
              styles.navButton,
              currentIndex === 0 && styles.navButtonDisabled,
            ]}
            onPress={goPrev}
            disabled={currentIndex === 0}
          >
            <ChevronLeft
              size={20}
              color={currentIndex === 0 ? Colors.textMuted : Colors.primary}
            />
            <Text
              style={[
                styles.navButtonText,
                currentIndex === 0 && styles.navButtonTextDisabled,
              ]}
            >
              Previous
            </Text>
          </TouchableOpacity>

          {currentIndex < questions.length - 1 ? (
            <TouchableOpacity style={styles.navButtonNext} onPress={goNext}>
              <Text style={styles.navButtonNextText}>Next</Text>
              <ChevronRight size={20} color={Colors.white} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.submitButton,
                !allAnswered && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!allAnswered || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.submitButtonText}>Submit Quiz</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
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
  // ─── Header ──────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === "ios" ? 60 : 48,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  headerCounter: {
    ...Typography.bodySmall,
    color: Colors.primary,
    fontWeight: "700",
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
  },
  // ─── Progress Bar ──────────────────
  progressBarBg: {
    height: 4,
    backgroundColor: Colors.surfaceLight,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  // ─── Question ──────────────────
  questionScroll: { padding: Spacing.lg, paddingBottom: 160 },
  questionNumber: {
    ...Typography.label,
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  questionText: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.xl,
    lineHeight: 32,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 2,
    borderColor: Colors.glassBorder,
    gap: 14,
  },
  optionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  optionRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.textMuted,
    justifyContent: "center",
    alignItems: "center",
  },
  optionRadioSelected: { borderColor: Colors.primary },
  optionRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  optionText: {
    ...Typography.body,
    color: Colors.text,
    flex: 1,
  },
  optionTextSelected: {
    color: Colors.primary,
    fontWeight: "600",
  },
  // ─── Footer / Nav ──────────────────
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    paddingTop: Spacing.lg,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.glassBorder,
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.surfaceLight,
    gap: 6,
  },
  navButtonDisabled: { opacity: 0.4 },
  navButtonText: {
    ...Typography.bodySmall,
    color: Colors.primary,
    fontWeight: "600",
  },
  navButtonTextDisabled: { color: Colors.textMuted },
  navButtonNext: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    gap: 6,
  },
  navButtonNextText: {
    ...Typography.bodySmall,
    color: Colors.white,
    fontWeight: "700",
  },
  submitButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    backgroundColor: Colors.success,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: "700",
  },
  // ─── Results ──────────────────
  resultsScroll: { padding: Spacing.lg, paddingBottom: 120 },
  scoreCard: {
    alignItems: "center",
    borderRadius: 24,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  scoreCardPass: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  scoreCardFail: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  scoreNumber: {
    fontSize: 36,
    fontWeight: "800",
    color: Colors.text,
  },
  passBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginBottom: Spacing.sm,
  },
  passBadgePass: { backgroundColor: Colors.success },
  passBadgeFail: { backgroundColor: Colors.error },
  passBadgeText: {
    ...Typography.bodySmall,
    color: Colors.white,
    fontWeight: "700",
  },
  scoreSubtext: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: Spacing.xs,
  },
  reviewHeading: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  reviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  reviewQNum: {
    ...Typography.label,
    color: Colors.primary,
  },
  reviewQuestion: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: "600",
    marginBottom: Spacing.md,
    lineHeight: 22,
  },
  reviewOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: "transparent",
  },
  reviewOptionText: {
    ...Typography.bodySmall,
    color: Colors.text,
    flex: 1,
  },
  reviewCorrect: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  reviewCorrectText: {
    color: "#065F46",
    fontWeight: "600",
  },
  reviewWrong: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  reviewWrongText: {
    color: "#991B1B",
    fontWeight: "600",
  },
  explanationBox: {
    backgroundColor: Colors.primaryLight,
    padding: Spacing.md,
    borderRadius: 12,
    marginTop: Spacing.sm,
  },
  explanationLabel: {
    ...Typography.label,
    color: Colors.primary,
    marginBottom: 4,
  },
  explanationText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  // ─── Buttons ──────────────────
  retakeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
  },
  retakeButtonText: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: "700",
  },
  doneButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.success,
    paddingVertical: 16,
    borderRadius: 16,
  },
  doneButtonText: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: "700",
  },
});
