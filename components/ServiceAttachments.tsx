import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import { ContentDocumentsList } from "./ContentDocumentsList";
import {
  ContentAttachment,
  getAttachmentPublicUrl,
  listContentAttachments,
} from "@/lib/api/admin/contentAttachments";
import { serviceStyles as s } from "./ServiceContent";
export function ServiceAttachments({ serviceId }: { serviceId: string }) {
  const [media, setMedia] = useState<ContentAttachment[]>([]);
  const [ratio, setRatio] = useState(0.7);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    listContentAttachments("service", serviceId).then((result) => {
      if (alive) {
        setMedia(result.attachments);
        setError(result.error || "");
      }
    });
    return () => {
      alive = false;
    };
  }, [serviceId]);
  const cover = media.find((m) => m.kind === "image");
  return (
    <>
      {!!error && <Text style={s.muted}>Attachments could not be loaded.</Text>}
      {cover && (
        <View style={s.card}>
          <Text style={s.heading}>Mosque’s poster</Text>
          <Image
            accessibilityLabel="Original service poster; course details are provided in text above"
            source={{ uri: getAttachmentPublicUrl(cover.storage_path) }}
            contentFit="contain"
            style={{ width: "100%", aspectRatio: ratio }}
            onLoad={(e) => {
              if (e.source.width && e.source.height)
                setRatio(e.source.width / e.source.height);
            }}
          />
        </View>
      )}
      <ContentDocumentsList
        documents={media.filter((m) => m.kind === "document")}
      />
    </>
  );
}
