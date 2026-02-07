/**
 * AIAttachmentPanel
 *
 * PURPOSE: Discord-style attachment picker panel with smooth animations
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx (above input box)
 *
 * FEATURES:
 *   - Slides up when triggered, pushing input box up
 *   - Shows user's actual photos from device gallery
 *   - Camera option for taking new photos
 *   - Expandable to full gallery view
 *   - Multiple image selection support
 *   - Smooth entrance/exit animations
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  FlatList,
  Dimensions,
  Alert,
  Modal,
} from 'react-native';

// 2. Expo & Third-party
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { Camera, Check } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// 4. Constants
import { BrandColors, Spacing, FontFamily } from '@/constants/theme';

// ============================================================================
// TYPES
// ============================================================================

interface AIAttachmentPanelProps {
  visible: boolean;
  onClose: () => void;
  onSelectImages?: (uris: string[]) => void;
  selectedImages: string[];
  onToggleImage: (uri: string) => void;
}

interface PhotoItem {
  id: string;
  type: 'camera' | 'photo';
  uri?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const PANEL_HEIGHT = 180;
const IMAGE_SIZE = (SCREEN_WIDTH - Spacing.md * 2 - Spacing.sm * 2) / 3;
const GRID_IMAGE_SIZE = (SCREEN_WIDTH - Spacing.md * 2 - Spacing.xs * 2) / 3;
const SPRING_CONFIG = { damping: 18, stiffness: 180, mass: 0.8 };

// ============================================================================
// PHOTO GRID ITEM (Compact)
// ============================================================================

interface PhotoGridItemProps {
  item: PhotoItem;
  onPress: (item: PhotoItem) => void;
  isSelected?: boolean;
}

function PhotoGridItem({ item, onPress, isSelected }: PhotoGridItemProps) {
  if (item.type === 'camera') {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.cameraButton,
          pressed && styles.photoPressed,
        ]}
        onPress={() => onPress(item)}
      >
        <Camera size={20} color="#6B7280" strokeWidth={1.5} />
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.photoItem,
        pressed && styles.photoPressed,
        isSelected && styles.photoItemSelected,
      ]}
      onPress={() => onPress(item)}
    >
      <Image 
        source={{ uri: item.uri }} 
        style={styles.photoImage}
        contentFit="cover"
        transition={150}
      />
      {isSelected && (
        <View style={styles.checkBadge}>
          <Check size={12} color="#FFF" strokeWidth={3} />
        </View>
      )}
    </Pressable>
  );
}

// ============================================================================
// FULL GALLERY MODAL
// ============================================================================

interface FullGalleryProps {
  visible: boolean;
  onClose: () => void;
  photos: PhotoItem[];
  selectedImages: string[];
  onToggleImage: (uri: string) => void;
  onOpenAlbums: () => void;
  onTakePhoto: () => void;
}

function FullGallery({ 
  visible, 
  onClose, 
  photos, 
  selectedImages, 
  onToggleImage,
  onOpenAlbums,
  onTakePhoto,
}: FullGalleryProps) {
  const renderGridItem = useCallback(({ item }: { item: PhotoItem }) => {
    if (item.type === 'camera') {
      return (
        <Pressable
          style={({ pressed }) => [
            styles.gridCameraButton,
            pressed && styles.photoPressed,
          ]}
          onPress={onTakePhoto}
        >
          <Camera size={32} color="#6B7280" strokeWidth={1.5} />
        </Pressable>
      );
    }

    const isSelected = item.uri ? selectedImages.includes(item.uri) : false;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.gridPhotoItem,
          pressed && styles.photoPressed,
        ]}
        onPress={() => item.uri && onToggleImage(item.uri)}
      >
        <Image 
          source={{ uri: item.uri }} 
          style={styles.gridPhotoImage}
          contentFit="cover"
          transition={150}
        />
        {isSelected && (
          <View style={styles.gridCheckBadge}>
            <Check size={16} color="#FFF" strokeWidth={3} />
          </View>
        )}
      </Pressable>
    );
  }, [selectedImages, onToggleImage, onTakePhoto]);

  // Use photos directly (camera + actual photos)
  const gridPhotos = photos;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} style={styles.modalHeaderButton}>
            <Text style={styles.modalHeaderButtonText}>Back</Text>
          </Pressable>
          
          <View style={styles.modalHeaderCenter}>
            <Text style={styles.modalTitle}>Recents</Text>
            <Text style={styles.modalSubtitle}>Select up to 10</Text>
          </View>
          
          <Pressable onPress={onOpenAlbums} style={styles.modalHeaderButton}>
            <Text style={styles.modalHeaderButtonText}>All Albums</Text>
          </Pressable>
        </View>

        {/* Photo Grid */}
        <FlatList
          data={gridPhotos}
          renderItem={renderGridItem}
          keyExtractor={(item) => item.id}
          numColumns={3}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
        />
      </View>
    </Modal>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AIAttachmentPanel({
  visible,
  onClose,
  selectedImages,
  onToggleImage,
}: AIAttachmentPanelProps) {
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = 60;
  const bottomPadding = insets.bottom + TAB_BAR_HEIGHT;
  
  const [photos, setPhotos] = useState<PhotoItem[]>([
    { id: 'camera', type: 'camera' },
  ]);
  const [showFullGallery, setShowFullGallery] = useState(false);
  
  const panelHeight = useSharedValue(0);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  // Threshold for opening full gallery (drag up this many pixels)
  const EXPAND_THRESHOLD = -50;

  // Request permission and load photos when panel becomes visible
  useEffect(() => {
    if (visible) {
      loadPhotos();
      panelHeight.value = withSpring(PANEL_HEIGHT + bottomPadding, SPRING_CONFIG);
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      panelHeight.value = withSpring(0, SPRING_CONFIG);
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [visible, bottomPadding]);

  const loadPhotos = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to select images.',
          [{ text: 'OK' }]
        );
        return;
      }

      const { assets } = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        first: 50,
      });

      const photoItems: PhotoItem[] = [
        { id: 'camera', type: 'camera' },
        ...assets.map((asset) => ({
          id: asset.id,
          type: 'photo' as const,
          uri: asset.uri,
        })),
      ];

      setPhotos(photoItems);
    } catch (error) {
      console.error('Error loading photos:', error);
    }
  };

  const panelAnimatedStyle = useAnimatedStyle(() => ({
    height: panelHeight.value,
    opacity: opacity.value,
  }));

  const handleTakePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status === 'granted') {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        onToggleImage(result.assets[0].uri);
      }
    } else {
      Alert.alert(
        'Camera Permission Required',
        'Please allow camera access to take photos.',
        [{ text: 'OK' }]
      );
    }
  }, [onToggleImage]);

  const handleOpenAlbums = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10,
    });
    
    if (!result.canceled && result.assets) {
      result.assets.forEach(asset => {
        if (!selectedImages.includes(asset.uri)) {
          onToggleImage(asset.uri);
        }
      });
      setShowFullGallery(false);
    }
  }, [selectedImages, onToggleImage]);

  const handleItemPress = useCallback((item: PhotoItem) => {
    if (item.type === 'camera') {
      handleTakePhoto();
    } else if (item.uri) {
      onToggleImage(item.uri);
    }
  }, [handleTakePhoto, onToggleImage]);

  const renderPhoto = useCallback(({ item }: { item: PhotoItem }) => {
    const isSelected = item.uri ? selectedImages.includes(item.uri) : false;
    return (
      <PhotoGridItem 
        item={item} 
        onPress={handleItemPress} 
        isSelected={isSelected}
      />
    );
  }, [handleItemPress, selectedImages]);

  // Open full gallery when triggered
  const openFullGallery = useCallback(() => {
    setShowFullGallery(true);
  }, []);

  // Pan gesture to expand panel to full gallery
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      // Only track upward movement
      if (event.translationY < 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      // If dragged up past threshold, open full gallery
      if (event.translationY < EXPAND_THRESHOLD) {
        runOnJS(openFullGallery)();
      }
      // Reset translation
      translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
    });

  const handleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(translateY.value, -30) }],
  }));

  return (
    <>
      <Animated.View style={[styles.container, panelAnimatedStyle]}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.panel, { paddingBottom: bottomPadding }, handleAnimatedStyle]}>
            {/* Handle indicator - drag up to expand */}
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            {/* Photos grid */}
            <FlatList
              data={photos}
              renderItem={renderPhoto}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photosContent}
              style={styles.photosList}
            />
          </Animated.View>
        </GestureDetector>
      </Animated.View>

      {/* Full Gallery Modal */}
      <FullGallery
        visible={showFullGallery}
        onClose={() => setShowFullGallery(false)}
        photos={photos}
        selectedImages={selectedImages}
        onToggleImage={onToggleImage}
        onOpenAlbums={handleOpenAlbums}
        onTakePhoto={handleTakePhoto}
      />
    </>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    overflow: 'visible',
    zIndex: 100,
  },
  panel: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: Spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
  },
  photosList: {
    flex: 1,
  },
  photosContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  cameraButton: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
  },
  photoItem: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
  },
  photoItemSelected: {
    borderWidth: 2,
    borderColor: BrandColors.secondary,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  checkBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: BrandColors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Full Gallery Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalHeaderButton: {
    minWidth: 80,
  },
  modalHeaderButtonText: {
    fontSize: 16,
    fontFamily: FontFamily.medium,
    color: BrandColors.secondary,
  },
  modalHeaderCenter: {
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: FontFamily.semiBold,
    color: BrandColors.primary,
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    color: '#6B7280',
    marginTop: 2,
  },
  gridContent: {
    padding: Spacing.md,
  },
  gridRow: {
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  gridCameraButton: {
    width: GRID_IMAGE_SIZE,
    height: GRID_IMAGE_SIZE,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
  },
  gridPhotoItem: {
    width: GRID_IMAGE_SIZE,
    height: GRID_IMAGE_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
  },
  gridPhotoImage: {
    width: '100%',
    height: '100%',
  },
  gridCheckBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BrandColors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
});
