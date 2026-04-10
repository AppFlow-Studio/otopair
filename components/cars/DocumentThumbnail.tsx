import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/shared-ui';
import { scale, moderateScale } from '@/utils/responsive';
import type { PickedDocument } from './ServiceHistory';

const TILE_SIZE = scale(72);

interface DocumentThumbnailProps {
  document: PickedDocument;
  onRemove: () => void;
  onPress: () => void;
}

function getFileIcon(mimeType: string): keyof typeof Ionicons.glyphMap {
  if (mimeType === 'application/pdf') return 'document-text-outline';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document-outline';
  return 'document-attach-outline';
}

function getFileExtension(name: string): string {
  const ext = name.split('.').pop()?.toUpperCase();
  return ext && ext.length <= 5 ? ext : 'FILE';
}

export default function DocumentThumbnail({ document, onRemove, onPress }: DocumentThumbnailProps) {
  const isImage = document.mimeType.startsWith('image/');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
    >
      {isImage ? (
        <Image source={{ uri: document.uri }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.fileTile}>
          <Ionicons name={getFileIcon(document.mimeType)} size={24} color="#5299FE" />
          <Text
            weight="medium"
            size="xs"
            color="#5299FE"
            numberOfLines={1}
            style={styles.extLabel}
          >
            {getFileExtension(document.name)}
          </Text>
        </View>
      )}

      {/* Remove button */}
      <Pressable onPress={onRemove} hitSlop={8} style={styles.removeBtn}>
        <View style={styles.removeBtnInner}>
          <Ionicons name="close" size={10} color="#FFFFFF" />
        </View>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: moderateScale(12),
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  tilePressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fileTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(4),
  },
  extLabel: {
    maxWidth: TILE_SIZE - scale(12),
    textAlign: 'center',
  },
  removeBtn: {
    position: 'absolute',
    top: scale(4),
    right: scale(4),
  },
  removeBtnInner: {
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
