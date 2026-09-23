import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/app-text';
import { tokens } from '@/theme/tokens';
import {
  type ContentAttachment,
  type ContentAttachmentType,
  deleteContentAttachment,
  getAttachmentPublicUrl,
  listContentAttachments,
  uploadContentAttachment,
} from '@/lib/api/admin/contentAttachments';

const UPLOAD_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), ms);
    }),
  ]);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ContentAttachmentsEditor({
  mosqueId,
  contentType,
  contentId,
}: {
  mosqueId: string;
  contentType: ContentAttachmentType;
  contentId: string;
}) {
  const [attachments, setAttachments] = useState<ContentAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageBusy, setImageBusy] = useState(false);
  const [docBusy, setDocBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { attachments: rows, error: loadError } = await listContentAttachments(contentType, contentId);
    setAttachments(rows);
    setError(loadError);
    setLoading(false);
  }, [contentType, contentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const coverImage = attachments.find((item) => item.kind === 'image') ?? null;
  const documents = attachments.filter((item) => item.kind === 'document');

  const pickImage = useCallback(async () => {
    if (imageBusy) return;
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is needed to choose a cover image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: contentType !== 'service',
      aspect: [16, 9],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setImageBusy(true);
    try {
      const previous = coverImage;
      const { attachment, error: uploadError } = await withTimeout(
        uploadContentAttachment({
          mosqueId,
          contentType,
          contentId,
          kind: 'image',
          uri: asset.uri,
          fileName: asset.fileName || 'cover.jpg',
          mimeType: asset.mimeType,
        }),
        UPLOAD_TIMEOUT_MS,
        'The image took too long to upload. Please try again.'
      );
      if (uploadError) {
        setError(uploadError);
        return;
      }
      if (attachment) {
        setAttachments((current) => [...current.filter((item) => item.kind !== 'image'), attachment]);
      }
      if (previous) {
        await deleteContentAttachment(previous.id, previous.storage_path);
      }
    } catch (err: any) {
      setError(err?.message ?? 'The image took too long to upload. Please try again.');
    } finally {
      setImageBusy(false);
    }
  }, [contentId, contentType, coverImage, imageBusy, mosqueId]);

  const removeImage = useCallback(() => {
    if (!coverImage || imageBusy) return;
    Alert.alert('Remove cover image?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setImageBusy(true);
          try {
            const { error: deleteError } = await withTimeout(
              Promise.resolve(deleteContentAttachment(coverImage.id, coverImage.storage_path)),
              UPLOAD_TIMEOUT_MS,
              'Removing the image took too long. Please try again.'
            );
            if (deleteError) {
              setError(deleteError);
              return;
            }
            setAttachments((current) => current.filter((item) => item.id !== coverImage.id));
          } catch (err: any) {
            setError(err?.message ?? 'Removing the image took too long. Please try again.');
          } finally {
            setImageBusy(false);
          }
        },
      },
    ]);
  }, [coverImage, imageBusy]);

  const pickDocument = useCallback(async () => {
    if (docBusy) return;
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setDocBusy(true);
    try {
      const { attachment, error: uploadError } = await withTimeout(
        uploadContentAttachment({
          mosqueId,
          contentType,
          contentId,
          kind: 'document',
          uri: asset.uri,
          fileName: asset.name,
          mimeType: asset.mimeType,
        }),
        UPLOAD_TIMEOUT_MS,
        'The document took too long to upload. Please try again.'
      );
      if (uploadError) {
        setError(uploadError);
        return;
      }
      if (attachment) setAttachments((current) => [...current, attachment]);
    } catch (err: any) {
      setError(err?.message ?? 'The document took too long to upload. Please try again.');
    } finally {
      setDocBusy(false);
    }
  }, [contentId, contentType, docBusy, mosqueId]);

  const removeDocument = useCallback((doc: ContentAttachment) => {
    Alert.alert('Remove attachment?', doc.file_name ?? undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error: deleteError } = await deleteContentAttachment(doc.id, doc.storage_path);
          if (deleteError) {
            setError(deleteError);
            return;
          }
          setAttachments((current) => current.filter((item) => item.id !== doc.id));
        },
      },
    ]);
  }, []);

  return (
    <>
      <View style={styles.section}>
        <AppText variant="caption" style={styles.sectionLabel}>COVER IMAGE</AppText>
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={16} color={tokens.color.status.danger} />
            <AppText variant="caption" color={tokens.color.status.danger} style={{ flex: 1 }}>{error}</AppText>
          </View>
        ) : null}
        {loading ? (
          <View style={styles.imageEmpty}>
            <ActivityIndicator color={tokens.color.status.info} />
          </View>
        ) : coverImage ? (
          <View style={styles.imagePreviewWrap}>
            <Image
              source={{ uri: getAttachmentPublicUrl(coverImage.storage_path) }}
              style={styles.imagePreview}
              contentFit="cover"
            />
            {imageBusy ? (
              <View style={styles.imageOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
              <View style={styles.imageActions}>
                <Pressable onPress={pickImage} style={({ pressed }) => [styles.imageActionBtn, pressed && styles.pressed]}>
                  <AppText style={styles.imageActionText}>Replace</AppText>
                </Pressable>
                <Pressable
                  onPress={removeImage}
                  style={({ pressed }) => [styles.imageActionBtn, styles.imageActionDanger, pressed && styles.pressed]}
                >
                  <AppText style={styles.imageActionText}>Remove</AppText>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <Pressable
            onPress={pickImage}
            disabled={imageBusy}
            style={({ pressed }) => [styles.imageEmpty, pressed && styles.pressed, imageBusy && styles.disabled]}
          >
            {imageBusy ? (
              <ActivityIndicator color={tokens.color.status.info} />
            ) : (
              <>
                <Ionicons name="image-outline" size={22} color={tokens.color.text.muted} />
                <AppText variant="body" color={tokens.color.text.muted}>Add cover image</AppText>
              </>
            )}
          </Pressable>
        )}
      </View>

      <View style={styles.section}>
        <AppText variant="caption" style={styles.sectionLabel}>ATTACHMENTS</AppText>
        <View style={styles.fieldCard}>
          {documents.map((doc, index) => (
            <View key={doc.id}>
              {index > 0 ? <View style={styles.rowDivider} /> : null}
              <View style={styles.row}>
                <Ionicons name="document-text-outline" size={18} color={tokens.color.text.secondary} />
                <View style={{ flex: 1 }}>
                  <AppText variant="body" numberOfLines={1} style={styles.rowLabel}>
                    {doc.file_name ?? 'Document'}
                  </AppText>
                  {doc.size_bytes ? (
                    <AppText variant="caption" color={tokens.color.text.muted}>{formatBytes(doc.size_bytes)}</AppText>
                  ) : null}
                </View>
                <Pressable onPress={() => removeDocument(doc)} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={tokens.color.text.muted} />
                </Pressable>
              </View>
            </View>
          ))}
          {documents.length > 0 ? <View style={styles.rowDivider} /> : null}
          <Pressable
            onPress={pickDocument}
            disabled={docBusy}
            style={({ pressed }) => [styles.row, pressed && styles.pressed, docBusy && styles.disabled]}
          >
            {docBusy ? (
              <ActivityIndicator color={tokens.color.status.info} />
            ) : (
              <Ionicons name="add-circle-outline" size={18} color={tokens.color.status.info} />
            )}
            <AppText variant="body" color={tokens.color.status.info} style={styles.rowLabel}>Add document</AppText>
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: 6 },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.text.muted,
    paddingLeft: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: tokens.radius.lg,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 6,
  },
  imageEmpty: {
    height: 140,
    borderRadius: tokens.radius.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.color.border.muted,
    backgroundColor: tokens.color.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imagePreviewWrap: {
    borderRadius: tokens.radius.xl,
    overflow: 'hidden',
    aspectRatio: 16 / 9,
    backgroundColor: tokens.color.bg.surface,
  },
  imagePreview: { width: '100%', height: '100%' },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageActions: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
  },
  imageActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: tokens.radius.pill,
    backgroundColor: 'rgba(15,23,42,0.72)',
  },
  imageActionDanger: { backgroundColor: 'rgba(220,38,38,0.85)' },
  imageActionText: { color: '#fff', fontSize: 12, fontWeight: tokens.typography.weight.bold },
  fieldCard: {
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.bg.surface,
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: tokens.typography.weight.medium, color: tokens.color.text.primary },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: tokens.color.border.subtle, marginLeft: 16 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.55 },
});
