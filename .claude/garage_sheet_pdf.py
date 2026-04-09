"""Generate PDF summary of My Garage Bottom Sheet redesign."""

from fpdf import FPDF
import os

class PDF(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(150, 150, 150)
            self.cell(0, 10, "OtoPair - My Garage Bottom Sheet Redesign", align="R")
            self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    def section_title(self, title):
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(20, 28, 36)
        self.cell(0, 10, title, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(82, 153, 254)
        self.set_line_width(0.8)
        self.line(self.l_margin, self.get_y(), self.l_margin + 40, self.get_y())
        self.ln(4)

    def sub_title(self, title):
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(40, 40, 40)
        self.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def body_text(self, text):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(60, 60, 60)
        self.multi_cell(0, 5.5, text)
        self.ln(2)

    def bullet(self, text):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(60, 60, 60)
        self.cell(6, 5.5, "-")
        self.multi_cell(0, 5.5, text)
        self.ln(1)

    def code_text(self, text):
        self.set_font("Courier", "", 9)
        self.set_text_color(80, 80, 80)
        self.set_fill_color(245, 245, 245)
        self.multi_cell(0, 5, text, fill=True)
        self.ln(2)


pdf = PDF()
pdf.alias_nb_pages()
pdf.set_auto_page_break(auto=True, margin=20)

# ── COVER PAGE ──
pdf.add_page()
pdf.ln(40)
pdf.set_font("Helvetica", "", 11)
pdf.set_text_color(82, 153, 254)
pdf.cell(0, 8, "O  T  O  P  A  I  R", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.ln(5)
pdf.set_font("Helvetica", "B", 26)
pdf.set_text_color(20, 28, 36)
pdf.cell(0, 12, "My Garage Bottom Sheet", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.ln(3)
pdf.set_font("Helvetica", "", 13)
pdf.set_text_color(100, 100, 100)
pdf.cell(0, 8, "Complete Redesign Change Log", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.ln(2)
pdf.set_font("Helvetica", "", 11)
pdf.set_text_color(82, 153, 254)
pdf.cell(0, 8, "Floating modal  |  Carousel cards  |  Premium polish", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.ln(15)

pdf.set_font("Helvetica", "", 10)
pdf.set_text_color(80, 80, 80)
pdf.multi_cell(0, 6, (
    "This document records all design and code changes made to the My Garage vehicle selector "
    "bottom sheet on the OtoPair Rewards/Membership page. The redesign transforms a basic "
    "edge-to-edge drawer into a premium floating modal with a horizontal card carousel, "
    "refined typography hierarchy, tactile press animations, and spacing aligned to the "
    "Preferred Status modal."
), align="C")

pdf.ln(15)
pdf.set_draw_color(200, 200, 200)
pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
pdf.ln(5)
pdf.set_font("Helvetica", "", 9)
pdf.set_text_color(150, 150, 150)
pdf.cell(0, 6, "Date: March 2026", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.cell(0, 6, "Branch: waleedcodespace", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.cell(0, 6, "Files modified: 2 components + 1 page", align="C", new_x="LMARGIN", new_y="NEXT")

# ── PAGE 2: FILES MODIFIED ──
pdf.add_page()
pdf.section_title("1. Files Modified")

pdf.sub_title("Components")
pdf.bullet("components/rewards/GarageCarouselCard.tsx - NEW FILE. Horizontal carousel card with 3-zone design.")
pdf.bullet("components/rewards/GarageCarSelectionSheet.tsx - Complete rewrite from edge-to-edge sheet to floating modal.")

pdf.sub_title("Pages")
pdf.bullet("app/membership.tsx - Updated sheet props (removed onAllVehiclesPress, wired onCarSelected and onStatusBadgePress).")

pdf.ln(4)
pdf.section_title("2. Summary of All Changes")

pdf.body_text(
    "The My Garage bottom sheet was redesigned from a basic edge-to-edge drawer "
    "into a premium floating modal. Below is a comprehensive list of every change "
    "made across multiple iterative rounds."
)

# ── PAGE 3: CARD DESIGN ──
pdf.add_page()
pdf.section_title("3. GarageCarouselCard.tsx (New File)")

pdf.sub_title("3.1 Three-Zone Card Structure")
pdf.body_text(
    "Each vehicle card uses a 3-zone design optimized for fast scanning in a horizontal carousel:"
)
pdf.bullet("Zone 1 - Vehicle Photo: Edge-to-edge image with resizeMode='cover', subtle gradient overlay at bottom (transparent to rgba(0,0,0,0.18)) for text readability.")
pdf.bullet("Zone 2 - Vehicle Identity: Bold vehicle name (primary anchor) + mileage/tier line (supporting detail). Clear typography hierarchy.")
pdf.bullet("Zone 3 - Clean End: No additional UI. Card ends after the identity section.")

pdf.sub_title("3.2 Card Sizing & Carousel Peek")
pdf.body_text("Cards are dynamically sized so the next card peeks ~17% from the right edge:")
pdf.code_text(
    "const CARD_WIDTH = Math.round(\n"
    "  (SCREEN_WIDTH - CARD_HORIZONTAL_PADDING - CARD_GAP) / 1.17\n"
    ");\n"
    "const CARD_IMAGE_HEIGHT = 150;\n"
    "const CARD_BORDER_RADIUS = 16;\n"
    "const CARD_GAP = Spacing.md; // 12px"
)

pdf.sub_title("3.3 Shadow + Overflow Clip Pattern")
pdf.body_text(
    "React Native's overflow:'hidden' (needed to clip photo corners) also clips shadows on Android. "
    "Solved with a two-layer wrapper pattern:"
)
pdf.bullet("Outer layer (Animated.View): Carries the shadow, no overflow clip. borderRadius matches card.")
pdf.bullet("Inner layer (View): overflow:'hidden' clips the photo to rounded corners.")
pdf.code_text(
    "// Shadow values (subtle depth, felt more than seen)\n"
    "shadowColor: '#000'\n"
    "shadowOffset: { width: 0, height: 2 }\n"
    "shadowOpacity: 0.06\n"
    "shadowRadius: 8\n"
    "elevation: 3"
)

pdf.sub_title("3.4 Typography Hierarchy")
pdf.body_text("Clear visual weight differentiation between primary and supporting text:")
pdf.bullet("Vehicle name: bold, 16px (size='md'), color #111827 (near-black). Primary visual anchor.")
pdf.bullet("Mileage: regular weight, 12px (size='xs'), color #6B7280 (medium gray). Supporting detail.")
pdf.bullet("Dot separator: same #6B7280 gray as mileage.")
pdf.bullet("Tier badge: medium weight, 12px (size='xs'), BrandColors.secondary (#5299FE) blue. Tappable with ChevronRight affordance.")

pdf.sub_title("3.5 Tier Colors")
pdf.code_text(
    "const TIER_COLORS = {\n"
    "  driver: BrandColors.secondary,   // #5299FE (blue)\n"
    "  preferred: BrandColors.secondary, // #5299FE (blue)\n"
    "  elite: '#EA580C',                 // orange\n"
    "};"
)

pdf.sub_title("3.6 Pressed/Active Scale Animation")
pdf.body_text(
    "Cards have a tactile press animation using Animated API with native driver:"
)
pdf.code_text(
    "// onPressIn: scale to 0.97 over 120ms\n"
    "Animated.timing(scaleAnim, {\n"
    "  toValue: 0.97, duration: 120,\n"
    "  useNativeDriver: true,\n"
    "}).start();\n\n"
    "// onPressOut: scale back to 1.0 over 120ms\n"
    "Animated.timing(scaleAnim, {\n"
    "  toValue: 1, duration: 120,\n"
    "  useNativeDriver: true,\n"
    "}).start();"
)

pdf.sub_title("3.7 Nested Tap Targets")
pdf.body_text(
    "The tier badge (e.g. 'Preferred >') is a Pressable nested inside the card Pressable. "
    "Uses e.stopPropagation() to prevent the card's onPress from firing when tapping the badge. "
    "Generous hitSlop (8px top/bottom, 4px left, 8px right) ensures comfortable tap target."
)

# ── PAGE 4: SHEET DESIGN ──
pdf.add_page()
pdf.section_title("4. GarageCarSelectionSheet.tsx")

pdf.sub_title("4.1 Floating Modal (Matching Preferred Status Modal)")
pdf.body_text(
    "The sheet was converted from an edge-to-edge bottom drawer to a floating modal card, "
    "matching the visual style of the Preferred Status modal:"
)
pdf.code_text(
    "// Floating modal positioning\n"
    "position: 'absolute'\n"
    "bottom: SCREEN_HEIGHT * 0.015   // gap from bottom\n"
    "left: SCREEN_WIDTH * 0.025      // 2.5% margin\n"
    "right: SCREEN_WIDTH * 0.025\n"
    "width: SCREEN_WIDTH * 0.95      // 95% of screen\n"
    "borderRadius: 40                // all corners rounded\n\n"
    "// Floating shadow\n"
    "shadowOffset: { width: 0, height: 4 }\n"
    "shadowOpacity: 0.2\n"
    "shadowRadius: 16\n"
    "elevation: 10"
)

pdf.sub_title("4.2 Spacing Rhythm (Matched to Preferred Status Modal)")
pdf.bullet("Drag handle: paddingTop 12px, paddingBottom 8px (was 8/2).")
pdf.bullet("Content padding: 24px horizontal (was 16px), matching Preferred modal.")
pdf.bullet("Header to cards: 16px gap via carouselContent paddingTop.")
pdf.bullet("Cards to add link: 6px gap (carouselContent paddingBottom for shadow rendering).")
pdf.bullet("Bottom padding: 20px (was 12px).")

pdf.sub_title("4.3 Header")
pdf.body_text(
    "Clean left-aligned header with 'My Garage' at 2xl (24px) bold weight. "
    "Matches the font size of 'Preferred Status' in the tier modal. "
    "X close button on the right in a circular gray (#F3F4F6) container."
)

pdf.sub_title("4.4 Carousel Layout")
pdf.body_text(
    "Horizontal ScrollView with negative margins (-24px) to extend cards to the modal edges. "
    "carouselContent re-adds 16px horizontal padding so the first card is inset. "
    "decelerationRate='fast' for snappy scroll stopping."
)

pdf.sub_title("4.5 Add Vehicle Link")
pdf.bullet("Text: '+ Add a vehicle' in BrandColors.secondary (#5299FE).")
pdf.bullet("Font: size='md' (16px), weight='medium'.")
pdf.bullet("Centered below cards, 44px minimum tap target height.")
pdf.bullet("Pressed state: opacity 0.6.")
pdf.bullet("Action: dismiss() then router.replace('/(main-tabs)/cars').")

pdf.sub_title("4.6 Sheet Animation")
pdf.body_text("Present: Animated.spring (tension 40, friction 12) + backdrop fade (400ms).")
pdf.body_text("Dismiss: Animated.timing (300ms, bezier easing) + backdrop fade (300ms).")

# ── PAGE 5: SHEET BEHAVIOR ──
pdf.add_page()
pdf.section_title("5. Interaction Behavior")

pdf.sub_title("5.1 Vehicle Selection")
pdf.bullet("User taps a card -> selectVehicle(vin) via Zustand store.")
pdf.bullet("updateOwnershipPrimary mutation fires to Convex backend (sets is_primary: true).")
pdf.bullet("onCarSelected callback fires (parent switches to individual stats view).")
pdf.bullet("Sheet dismisses automatically after selection.")

pdf.sub_title("5.2 Tier Badge Tap")
pdf.bullet("Tapping 'Preferred >' on a card calls onStatusBadgePress(tier).")
pdf.bullet("Parent (membership.tsx) dismisses the garage sheet, then after 300ms opens the tier status modal.")
pdf.bullet("e.stopPropagation() prevents the card's vehicle selection from triggering.")

pdf.sub_title("5.3 Add Vehicle")
pdf.bullet("Tapping '+ Add a vehicle' dismisses the sheet and navigates to the Cars tab.")
pdf.bullet("Uses router.replace('/(main-tabs)/cars') - same behavior as the 'Add Car' button on the rewards page.")

pdf.sub_title("5.4 Dismiss")
pdf.bullet("Tapping the backdrop dismisses the sheet.")
pdf.bullet("Tapping the X button dismisses the sheet.")
pdf.bullet("Android back button triggers onRequestClose -> dismiss.")

# ── PAGE 6: ITERATION HISTORY ──
pdf.add_page()
pdf.section_title("6. Iteration History")

pdf.body_text(
    "The redesign went through multiple rounds of feedback and refinement. "
    "Below is the chronological sequence of changes:"
)

pdf.sub_title("Round 1: Initial Redesign")
pdf.bullet("Rewrote GarageCarouselCard.tsx with 3-zone card design (photo, identity, clean end).")
pdf.bullet("Rewrote GarageCarSelectionSheet.tsx with cleaned header, 'All Vehicles' row, horizontal carousel.")
pdf.bullet("Added onAllVehiclesPress handler in membership.tsx.")

pdf.sub_title("Round 2: Remove All Vehicles + Fix Tier Colors")
pdf.bullet("Removed 'All Vehicles' row, handler, styles, and unused imports.")
pdf.bullet("Changed driver tier color from gray (#6B7280) to BrandColors.secondary (blue).")

pdf.sub_title("Round 3: Fix Add Vehicle Navigation")
pdf.bullet("Changed from router.push('/add-vehicle') to router.replace('/(main-tabs)/cars') to match existing behavior.")

pdf.sub_title("Round 4: Card Containment (Shadow Fix)")
pdf.bullet("Split card into outer (shadow) + inner (overflow:hidden clip) wrapper to fix Android shadow clipping.")
pdf.bullet("Increased text padding to 14px horizontal, 10/12px vertical.")

pdf.sub_title("Round 5: Replace Button with Text Link")
pdf.bullet("Replaced full-width blue 'Add a vehicle' button with compact '+ Add a vehicle' text link.")
pdf.bullet("Removed Plus icon import.")

pdf.sub_title("Round 6: Tighten Spacing")
pdf.bullet("Reduced carousel paddingBottom, addLink margins, sheet paddingBottom through multiple micro-adjustments.")

pdf.sub_title("Round 7: Visual Polish (Shadow + Background + Gap)")
pdf.bullet("Stronger card shadow: offset 0/4, opacity 11%, radius 12, elevation 6.")
pdf.bullet("Fixed photo background mismatch: #F3F4F6 -> #FFFFFF.")
pdf.bullet("Tightened header-to-cards gap.")

pdf.sub_title("Round 8: Reduce Shadow + Header-Cards Spacing")
pdf.bullet("Dialed shadow back to offset 0/2, opacity 6%, radius 8, elevation 3.")
pdf.bullet("Added 12px clear space between header and cards.")

pdf.sub_title("Round 9: Typography Hierarchy + Add Link Sizing")
pdf.bullet("Mileage/dot: dropped to xs (12px), color kept at #9CA3AF initially.")
pdf.bullet("Tier badge: dropped to xs, weight medium.")
pdf.bullet("Vehicle name: bold md (16px), near-black #111827.")
pdf.bullet("Add link: bumped from sm (14px) to md (16px).")

pdf.sub_title("Round 10: Premium Modal Upgrade")
pdf.bullet("Fixed mileage color: #9CA3AF (too faded) -> #6B7280 (readable secondary gray).")
pdf.bullet("Matched spacing to Preferred Status modal (drag handle 12/8, content padding 24px, bottom 20px).")
pdf.bullet("Upgraded header title from xl (20px) to 2xl (24px) bold.")
pdf.bullet("Added BadgeCheck icon to header (later removed per user preference).")
pdf.bullet("Added pressed scale animation on cards (0.97 scale, 120ms).")
pdf.bullet("Add link color changed to BrandColors.secondary for exact consistency.")

pdf.sub_title("Round 11: Floating Modal")
pdf.bullet("Converted from edge-to-edge bottom sheet to floating modal.")
pdf.bullet("Added horizontal margins (2.5% each side), bottom gap (1.5% from bottom).")
pdf.bullet("Rounded all four corners (borderRadius: 40).")
pdf.bullet("Updated shadow to downward (offset 0/4, opacity 20%, radius 16).")
pdf.bullet("Content padding bumped to 24px, carousel margin updated to -24px.")

# ── PAGE 7: FINAL STATE ──
pdf.add_page()
pdf.section_title("7. Final Component State")

pdf.sub_title("GarageCarouselCard.tsx Exports")
pdf.bullet("GarageCarouselCard (memoized component)")
pdf.bullet("GarageCarouselCardVehicle (interface)")
pdf.bullet("GarageCarouselCardProps (interface)")
pdf.bullet("VehicleTier type ('driver' | 'preferred' | 'elite')")
pdf.bullet("CARD_WIDTH, CARD_GAP, CARD_HORIZONTAL_PADDING (constants)")

pdf.sub_title("GarageCarSelectionSheet.tsx Exports")
pdf.bullet("GarageCarSelectionSheet (component)")
pdf.bullet("GarageCarSelectionSheetProps (interface)")
pdf.bullet("GarageCarSheetRef (interface: { present, dismiss })")

pdf.sub_title("Dependencies")
pdf.bullet("react-native: Animated, Dimensions, Image, Pressable, Modal, ScrollView, View")
pdf.bullet("expo-linear-gradient: LinearGradient")
pdf.bullet("lucide-react-native: ChevronRight, X")
pdf.bullet("expo-router: useRouter")
pdf.bullet("convex/react: useQuery, useMutation")
pdf.bullet("@/components/shared-ui: BrandColors, Text")
pdf.bullet("@/constants/theme: BorderRadius, Spacing")
pdf.bullet("@/stores/useVehicleStore: selectVehicle")
pdf.bullet("@/hooks/useUserFromConvex, useVehicleOwnershipFromConvex")

# Save
output_path = os.path.expanduser("~/Downloads/OtoPair_MyGarage_BottomSheet_Redesign.pdf")
pdf.output(output_path)
print(f"PDF saved to: {output_path}")
