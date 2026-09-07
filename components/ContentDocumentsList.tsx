import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getAttachmentPublicUrl, type ContentAttachment } from '@/lib/api/admin/contentAttachments';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ContentDocumentsList({ documents }: { documents: ContentAttachment[] }) {
  if (!documents.length) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Documents</Text>
      {documents.map((doc) => (
        <Pressable
          key={doc.id}
          onPress={() => void WebBrowser.openBrowserAsync(getAttachmentPublicUrl(doc.storage_path))}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.iconWrap}>
            <Ionicons name="document-text-outline" size={18} color="#1E7BF6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fileName} numberOfLines={1}>{doc.file_name ?? 'Document'}</Text>
            {doc.size_bytes ? <Text style={styles.fileSize}>{formatBytes(doc.size_bytes)}</Text> : null}
          </View>
          <Ionicons name="open-outline" size={18} color="#94A3B8" />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    marginTop: 12,
    gap: 4,
  },
  title: { fontSize: 14, fontWeight: '800', color: '#111111', marginBottom: 4, paddingHorizontal: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  pressed: { opacity: 0.7 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileName: { fontSize: 14, fontWeight: '700', color: '#111111' },
  fileSize: { fontSize: 12, color: '#94A3B8', marginTop: 1 },
});
