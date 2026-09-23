import { supabase } from '../../supabase';

export type ContentAttachmentKind = 'image' | 'document';
export type ContentAttachmentType = 'event' | 'campaign' | 'announcement' | 'service';

export type ContentAttachment = {
  id: string;
  mosque_id: string;
  content_type: ContentAttachmentType;
  content_id: string;
  kind: ContentAttachmentKind;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  sort_order: number;
  created_at: string;
};

const BUCKET = 'content-media';
const ATTACHMENT_COLUMNS =
  'id, mosque_id, content_type, content_id, kind, storage_path, file_name, mime_type, size_bytes, sort_order, created_at';

function sanitizeFileName(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned.slice(-120) || 'file';
}

export async function listContentAttachments(
  contentType: ContentAttachmentType,
  contentId: string
): Promise<{ attachments: ContentAttachment[]; error: string | null }> {
  const { data, error } = await supabase
    .from('content_attachments')
    .select(ATTACHMENT_COLUMNS)
    .eq('content_type', contentType)
    .eq('content_id', contentId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return { attachments: [], error: error.message };
  return { attachments: (data ?? []) as unknown as ContentAttachment[], error: null };
}

export async function uploadContentAttachment(input: {
  mosqueId: string;
  contentType: ContentAttachmentType;
  contentId: string;
  kind: ContentAttachmentKind;
  uri: string;
  fileName: string;
  mimeType?: string | null;
}): Promise<{ attachment: ContentAttachment | null; error: string | null }> {
  try {
    const safeName = sanitizeFileName(input.fileName || (input.kind === 'image' ? 'image.jpg' : 'document'));
    const path = `${input.mosqueId}/${input.contentType}/${input.contentId}/${Date.now()}-${safeName}`;
    const contentType = input.mimeType || (input.kind === 'image' ? 'image/jpeg' : 'application/octet-stream');

    const response = await fetch(input.uri);
    const arrayBuffer = await response.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, { contentType, upsert: false });
    if (uploadError) return { attachment: null, error: uploadError.message };

    const { data, error: insertError } = await supabase
      .from('content_attachments')
      .insert({
        mosque_id: input.mosqueId,
        content_type: input.contentType,
        content_id: input.contentId,
        kind: input.kind,
        storage_path: path,
        file_name: input.fileName,
        mime_type: contentType,
        size_bytes: arrayBuffer.byteLength,
      })
      .select(ATTACHMENT_COLUMNS)
      .single();

    if (insertError) {
      await supabase.storage.from(BUCKET).remove([path]);
      return { attachment: null, error: insertError.message };
    }

    return { attachment: data as unknown as ContentAttachment, error: null };
  } catch (err: any) {
    return { attachment: null, error: err?.message ?? 'Upload failed.' };
  }
}

export async function deleteContentAttachment(
  id: string,
  storagePath: string
): Promise<{ error: string | null }> {
  const { error: dbError } = await supabase.from('content_attachments').delete().eq('id', id);
  if (dbError) return { error: dbError.message };
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (storageError) return { error: storageError.message };
  return { error: null };
}

export function getAttachmentPublicUrl(storagePath: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Bulk cover-image lookup for list rows (mosque page events/campaigns/notices)
 * so each list doesn't need one query per item. Returns a map keyed by
 * `${contentType}:${contentId}` -> public image URL.
 */
export async function listCoverImageUrls(
  items: { contentType: ContentAttachmentType; contentId: string }[]
): Promise<Record<string, string>> {
  if (!items.length) return {};
  const byType = items.reduce<Record<ContentAttachmentType, string[]>>((acc, item) => {
    (acc[item.contentType] ??= []).push(item.contentId);
    return acc;
  }, {} as Record<ContentAttachmentType, string[]>);

  const results = await Promise.all(
    (Object.entries(byType) as [ContentAttachmentType, string[]][]).map(([contentType, ids]) =>
      supabase
        .from('content_attachments')
        .select('content_type, content_id, storage_path')
        .eq('content_type', contentType)
        .eq('kind', 'image')
        .in('content_id', ids)
    )
  );

  const map: Record<string, string> = {};
  for (const result of results) {
    for (const row of result.data ?? []) {
      const key = `${row.content_type}:${row.content_id}`;
      if (!map[key]) map[key] = getAttachmentPublicUrl(row.storage_path);
    }
  }
  return map;
}
