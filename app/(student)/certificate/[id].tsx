import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView,
  Dimensions, useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../../src/theme/colors';
import { Spacing, Typography } from '../../../src/theme';
import { ChevronLeft, Download, Share2 } from 'lucide-react-native';
import { buildCertificateHtml } from '../../../src/services/certificateService';
import { WebView } from 'react-native-webview';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert } from 'react-native';

export default function CertificateViewer() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    studentName: string;
    courseTitle: string;
    completionDate: string;
    certId: string;
    pdfUrl: string;
  }>();

  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const html = useMemo(
    () =>
      buildCertificateHtml(
        params.studentName || 'Student',
        params.courseTitle || 'Course',
        params.completionDate || new Date().toLocaleDateString(),
        params.certId || 'N/A',
      ),
    [params],
  );

  // Wrap HTML in a responsive viewport for mobile rendering
  const viewerHtml = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=3">
<style>
html,body{margin:0;padding:0;background:#1a1a2e;display:flex;align-items:center;justify-content:center;min-height:100vh;overflow:auto;}
.wrapper{transform-origin:top center;padding:20px;}
</style>
</head><body>
<div class="wrapper">
${html.replace('<!DOCTYPE html>', '').replace('<html>', '').replace('</html>', '').replace('<head>', '').replace('</head>', '').replace('<body>', '').replace('</body>', '')}
</div>
</body></html>`;

  const handleDownload = async () => {
    try {
      const { uri } = await Print.printToFileAsync({ html });
      const fileName = `Certificate_${params.courseTitle.replace(/\s+/g, '_')}.pdf`;

      if (Platform.OS === 'android') {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
          const savedUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, fileName, 'application/pdf');
          await FileSystem.writeAsStringAsync(savedUri, base64, { encoding: FileSystem.EncodingType.Base64 });
          Alert.alert('Success', 'Certificate saved to your device!');
        } else {
          Alert.alert('Permission needed', 'We need permission to save the file.');
        }
      } else {
        // iOS
        const newUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.copyAsync({ from: uri, to: newUri });
        Alert.alert('Success', 'Certificate saved to Documents!');
        // Optionally share it to make it easily accessible
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(newUri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
        }
      }
    } catch (e) {
      console.error('Download error:', e);
      Alert.alert('Error', 'Failed to download certificate.');
    }
  };

  const handleShare = async () => {
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share Certificate: ${params.courseTitle}`,
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (e) {
      console.error('Share error:', e);
    }
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top || 44 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={Colors.white} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Certificate</Text>
          <Text style={s.headerSub} numberOfLines={1}>{params.courseTitle}</Text>
        </View>
        <View style={s.headerActions}>
          <TouchableOpacity style={s.actionBtn} onPress={handleShare}>
            <Share2 size={18} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={handleDownload}>
            <Download size={18} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Certificate View */}
      {Platform.OS === 'web' ? (
        <ScrollView
          style={s.webScroll}
          contentContainerStyle={s.webScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.webCertFrame}>
            <div
              dangerouslySetInnerHTML={{ __html: html }}
              style={{
                transform: `scale(${Math.min(1, (screenWidth - 40) / 842)})`,
                transformOrigin: 'top center',
              }}
            />
          </View>
        </ScrollView>
      ) : (
        <WebView
          source={{ html: viewerHtml }}
          style={s.webview}
          scalesPageToFit={true}
          scrollEnabled={true}
          bounces={false}
          showsHorizontalScrollIndicator={false}
          originWhitelist={['*']}
        />
      )}

      {/* Bottom Info Bar */}
      <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={s.certIdBox}>
          <Text style={s.certIdLabel}>Certificate ID</Text>
          <Text style={s.certIdValue}>{params.certId}</Text>
        </View>
        <TouchableOpacity style={s.printBtn} onPress={handleShare}>
          <Share2 size={16} color={Colors.white} />
          <Text style={s.printBtnText}>Share PDF</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },

  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flex: 1, marginLeft: 14 },
  headerTitle: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },

  webview: { flex: 1, backgroundColor: '#1a1a2e' },

  webScroll: { flex: 1 },
  webScrollContent: { alignItems: 'center', paddingVertical: 20 },
  webCertFrame: { overflow: 'hidden' },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    backgroundColor: '#1a1a2e',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  certIdBox: {},
  certIdLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 },
  certIdValue: { fontSize: 13, color: Colors.white, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginTop: 2 },
  printBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 14,
  },
  printBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
});
