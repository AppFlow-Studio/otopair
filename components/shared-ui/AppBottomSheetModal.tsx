/**
 * AppBottomSheetModal
 *
 * PURPOSE: Shared bottom sheet modal with Otopair styling, handle, and close (X) control.
 *
 * USED IN: Settings screens and other flows needing a consistent bottom sheet.
 *
 * PROPS:
 *   - title (string): Header title for the sheet
 *   - children (ReactNode): Content rendered inside the sheet
 *   - snapPoints (array): Optional snap points for the sheet height
 *   - initialIndex (number): Optional initial snap index (default: 0)
 *   - onClose (() => void): Optional close handler
 *   - footer (ReactNode): Optional sticky footer content
 *   - contentContainerStyle (style): Optional content container override
 *
 * EXAMPLE:
 *   <AppBottomSheetModal
 *     ref={sheetRef}
 *     title="Referral FAQ"
 *     snapPoints={['50%', '90%']}
 *     initialIndex={0}
 *     onClose={() => console.log('Sheet closed')}
 *     footer={<Button label="Done" />}
 *     contentContainerStyle={{ paddingBottom: 40 }}
 *   >
 *     <Text>Content goes here</Text>
 *   </AppBottomSheetModal>
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { X } from 'lucide-react-native';

import { Spacing } from '@/constants/theme';
import { BlurBackdrop } from './BlurBackdrop';
import { Text } from './Text';

export interface AppBottomSheetModalProps {
  title: string;
  children: React.ReactNode;
  snapPoints?: Array<string | number>;
  initialIndex?: number;
  onClose?: () => void;
  footer?: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** When false, the content list is fixed (no scroll/bounce). Use for
   *  short pickers whose content already fits the sheet. */
  scrollEnabled?: boolean;
  /** Extra gap (px) between the sheet's bottom and the screen bottom —
   *  raises the whole detached sheet higher without changing its height. */
  extraBottomGap?: number;
  /** Disables the rubber-band overshoot when the user drags past the
   *  top snap point. With a single snap point + this set to false, the
   *  sheet refuses any upward gesture — pan-down-to-close still works. */
  enableOverDrag?: boolean;
  /** When false, both the handle and content panning gestures are
   *  disabled — the sheet becomes a static popover dismissed only by
   *  the X close button and backdrop tap. Useful for fixed-height
   *  detail sheets that shouldn't be resizable. */
  enablePanning?: boolean;
}

export const AppBottomSheetModal = forwardRef<BottomSheetModal, AppBottomSheetModalProps>(
  ({ title, children, snapPoints, initialIndex = 0, onClose, footer, contentContainerStyle, scrollEnabled = true, extraBottomGap = 0, enableOverDrag, enablePanning = true }, ref) => {
    const insets = useSafeAreaInsets();
    const internalRef = useRef<BottomSheetModal>(null);
    const { width } = Dimensions.get('window');
    // The footer floats over the bottom of the scroll content, so the
    // content needs bottom padding equal to the footer's height or its
    // last rows sit hidden underneath it. Measure it rather than guess.
    const [footerHeight, setFooterHeight] = useState(0);

    useImperativeHandle(ref, () => internalRef.current as BottomSheetModal);

    const resolvedSnapPoints = useMemo(() => snapPoints ?? ['85%'], [snapPoints]);
    
    const modalContainerStyle = useMemo(() => ({
      marginHorizontal: width * 0.025, // 2.5% on each side for 95% width
    }), [width]);

    const handleClose = useCallback(() => {
      internalRef.current?.dismiss();
    }, []);

    const renderBackdrop = useCallback(
      (props: any) => <BlurBackdrop {...props} />,
      []
    );

    const bottomGap = insets.bottom + Spacing.lg + extraBottomGap;

    return (
      <BottomSheetModal
        ref={internalRef}
        index={initialIndex}
        snapPoints={resolvedSnapPoints}
        enablePanDownToClose={enablePanning}
        enableContentPanningGesture={enablePanning}
        enableHandlePanningGesture={enablePanning}
        enableOverDrag={enableOverDrag}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.handleIndicator}
        backgroundStyle={styles.sheet}
        onDismiss={onClose}
        detached={true}
        style={modalContainerStyle}
        bottomInset={bottomGap}
      >
        <BottomSheetScrollView
          scrollEnabled={scrollEnabled}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: footer ? footerHeight + Spacing.md : insets.bottom + Spacing['2xl'] },
            contentContainerStyle,
          ]}
        >
          <View style={styles.header}>
            <Pressable onPress={handleClose} style={styles.closeButton} hitSlop={10}>
              <X size={20} color="#111827" />
            </Pressable>
            <Text weight="bold" size="lg" color="#111827" style={styles.headerTitle}>
              {title}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {children}
        </BottomSheetScrollView>
        {footer && (
          <View
            style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}
            onLayout={(e) => setFooterHeight(Math.round(e.nativeEvent.layout.height))}
          >
            {footer}
          </View>
        )}
      </BottomSheetModal>
    );
  }
);

AppBottomSheetModal.displayName = 'AppBottomSheetModal';

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#E8ECF0',
    borderRadius: 50,
    overflow: 'hidden',
  },
  handleIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#6B7280',
    borderRadius: 2,
  },
  scrollContent: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.md,
    backgroundColor: '#E8ECF0',
    // Match the sheet's rounded bottom — the footer is the bottom-most
    // opaque layer, so without this it squares off the sheet's corners.
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
  },
});
