/**
 * dev/icon-compare.tsx — TEMPORARY.
 *
 * Renders every candidate glyph for the Cars and Oto tabs at the real tab-bar
 * size (24) and colour (#181919), so a choice can be made against the iOS bar
 * by looking rather than guessing. Delete once the icons are picked.
 *
 * Reach it with:
 *   adb shell am start -a android.intent.action.VIEW -d "otopair://dev/icon-compare"
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

const SIZE = 24;
const TINT = '#181919';

type Row = { set: string; name: string; Comp: any; solid?: boolean };

const CARS: Row[] = [
  { set: 'ion', name: 'car-outline', Comp: Ionicons },
  { set: 'ion', name: 'car', Comp: Ionicons },
  { set: 'ion', name: 'car-sport-outline', Comp: Ionicons },
  { set: 'ion', name: 'car-sport', Comp: Ionicons },
  { set: 'mci', name: 'car-outline', Comp: MaterialCommunityIcons },
  { set: 'mci', name: 'car', Comp: MaterialCommunityIcons },
  { set: 'mci', name: 'car-side', Comp: MaterialCommunityIcons },
  { set: 'mci', name: 'car-hatchback', Comp: MaterialCommunityIcons },
  { set: 'mci', name: 'car-estate', Comp: MaterialCommunityIcons },
  { set: 'md', name: 'directions-car', Comp: MaterialIcons },
  { set: 'fa6', name: 'car', Comp: FontAwesome6, solid: true },
  { set: 'fa6', name: 'car-side', Comp: FontAwesome6, solid: true },
];

const CHAT: Row[] = [
  { set: 'ion', name: 'chatbubbles', Comp: Ionicons },
  { set: 'ion', name: 'chatbubbles-outline', Comp: Ionicons },
  { set: 'ion', name: 'chatbox', Comp: Ionicons },
  { set: 'mci', name: 'forum', Comp: MaterialCommunityIcons },
  { set: 'mci', name: 'forum-outline', Comp: MaterialCommunityIcons },
  { set: 'mci', name: 'chat', Comp: MaterialCommunityIcons },
  { set: 'md', name: 'forum', Comp: MaterialIcons },
  { set: 'md', name: 'chat', Comp: MaterialIcons },
  { set: 'fa6', name: 'comments', Comp: FontAwesome6, solid: true },
];

function Cell({ row }: { row: Row }) {
  const { Comp, name, set, solid } = row;
  return (
    <View style={styles.cell}>
      <View style={styles.glyph}>
        <Comp name={name as never} size={SIZE} color={TINT} {...(solid ? { solid: true } : {})} />
      </View>
      <Text style={styles.set}>{set}</Text>
      <Text style={styles.name} numberOfLines={2}>{name}</Text>
    </View>
  );
}

export default function IconCompare() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.h}>CARS — target: SF `car`</Text>
      <View style={styles.grid}>{CARS.map((r) => <Cell key={r.set + r.name} row={r} />)}</View>
      <Text style={styles.h}>OTO — target: SF `bubble.left.and.bubble.right.fill`</Text>
      <View style={styles.grid}>{CHAT.map((r) => <Cell key={r.set + r.name} row={r} />)}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16, paddingTop: 56, gap: 10 },
  h: { fontSize: 13, fontWeight: '700', color: '#181919', marginTop: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    width: 104,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
  },
  glyph: { height: 30, justifyContent: 'center' },
  set: { fontSize: 9, color: '#9CA3AF', fontWeight: '700' },
  name: { fontSize: 9, color: '#4B5563', textAlign: 'center' },
});
