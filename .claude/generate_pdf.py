"""Generate PDF summary of Revenue & Rewards Model v2.0 update."""

from fpdf import FPDF
import os

class PDF(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(150, 150, 150)
            self.cell(0, 10, "OtoPair - Revenue & Rewards Model v2.0 Update", align="R")
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
        x = self.get_x()
        self.cell(6, 5.5, "-")
        self.multi_cell(0, 5.5, text)
        self.ln(1)

    def code_text(self, text):
        self.set_font("Courier", "", 9)
        self.set_text_color(80, 80, 80)
        self.set_fill_color(245, 245, 245)
        self.multi_cell(0, 5, text, fill=True)
        self.ln(2)

    def table_header(self, cols, widths):
        self.set_font("Helvetica", "B", 9)
        self.set_fill_color(20, 28, 36)
        self.set_text_color(255, 255, 255)
        for i, col in enumerate(cols):
            self.cell(widths[i], 7, col, border=1, fill=True, align="C")
        self.ln()

    def table_row(self, cols, widths, highlight=False):
        self.set_font("Helvetica", "", 9)
        if highlight:
            self.set_fill_color(232, 245, 233)
            self.set_text_color(30, 30, 30)
        else:
            self.set_fill_color(255, 255, 255)
            self.set_text_color(60, 60, 60)
        for i, col in enumerate(cols):
            self.cell(widths[i], 6.5, col, border=1, fill=True, align="C")
        self.ln()


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
pdf.cell(0, 12, "Revenue & Rewards Model v2.0", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.ln(3)
pdf.set_font("Helvetica", "", 13)
pdf.set_text_color(100, 100, 100)
pdf.cell(0, 8, "Implementation Change Log", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.ln(2)
pdf.set_font("Helvetica", "", 11)
pdf.set_text_color(82, 153, 254)
pdf.cell(0, 8, "7% consumer service fee  |  Stripe-adjusted  |  Repriced credits", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.ln(15)

pdf.set_font("Helvetica", "", 10)
pdf.set_text_color(80, 80, 80)
pdf.multi_cell(0, 6, (
    "This document records all code and documentation changes made to the OtoPair codebase "
    "to implement the Revenue & Rewards Model v2.0. The update replaces the old shop commission model "
    "(10-15%) with a 7% consumer service fee, reprices all earn rates and contribution credits against "
    "real Stripe processing costs, and updates every UI surface and documentation file."
), align="C")

pdf.ln(15)
pdf.set_draw_color(200, 200, 200)
pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
pdf.ln(5)
pdf.set_font("Helvetica", "", 9)
pdf.set_text_color(150, 150, 150)
pdf.cell(0, 6, "Classification: Internal / Confidential", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.cell(0, 6, "Date: March 2026", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.cell(0, 6, "Branch: waleedcodespace", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.cell(0, 6, "15 files modified across backend, frontend, and documentation", align="C", new_x="LMARGIN", new_y="NEXT")

# ── PAGE 2: SUMMARY OF ALL CHANGES ──
pdf.add_page()
pdf.section_title("1. Summary of All Changes")

pdf.body_text("Every value that changed from the previous Rewards Program Framework v2 and Fee Model v1:")

widths = [55, 55, 55]
pdf.table_header(["Item", "Old Value", "New Value"], widths)
changes = [
    ("Revenue source", "Shop commission (10-15%)", "Consumer fee (7%)"),
    ("Consumer pays", "Nothing", "7% service fee"),
    ("Fee minimum", "$2.99 (proposed)", "$4.99"),
    ("Fee cap", "$14.99 (proposed)", "No cap"),
    ("Fee label", "Platform Fee", "Otopair Service Fee - 7%"),
    ("Fee waiver", "Proposed for tiers", "Preferred + Elite subs"),
    ("Driver earn rate", "1.5%", "1%"),
    ("Preferred earn rate", "3%", "1.5%"),
    ("Elite earn rate", "5%", "2%"),
    ("Review credit", "$5", "$3"),
    ("Records upload credit", "$10", "$5"),
    ("Referral credit", "$25 each", "$15 each"),
    ("Driver target/yr", "$50-$75", "$20-$40"),
    ("Preferred target/yr", "$150-$250", "$40-$75"),
    ("Elite target/yr", "$250-$300", "$60-$100"),
    ("Referral UI", "250 points", "$15 credit"),
    ("Elite credit expiry", "6 months", "Non-expiring"),
]
for row in changes:
    highlight = row[1] != row[2]
    pdf.table_row(list(row), widths, highlight=True)

pdf.ln(4)
pdf.sub_title("Unchanged")
pdf.bullet("Tier thresholds: $750 (Preferred), $1,500 (Elite)")
pdf.bullet("Subscription pricing: $9.99/mo (Preferred), $24.99/mo (Elite)")
pdf.bullet("Credit expiry for Driver/Preferred: 6 months")
pdf.bullet("Referral cap: 5 referrals per user")
pdf.bullet("Per-vehicle tier tracking")
pdf.bullet("Two-lane architecture (Relationship + Contribution)")

# ── PAGE 3: FILES MODIFIED ──
pdf.add_page()
pdf.section_title("2. Files Modified (15 total)")

pdf.sub_title("Backend (1 file)")
pdf.bullet("convex/rewards.ts - Earn rates, contribution credits, Elite non-expiring logic")

pdf.sub_title("Fee Calculation (4 files)")
pdf.bullet("hooks/useCreateBookingConvex.ts - Central 7% fee computation for booking creation")
pdf.bullet("components/booking/sheets/ReviewPayContent.tsx - Review & Pay bottom sheet")
pdf.bullet("app/(main-tabs)/home/mechanic/[id]/payment.tsx - Full-screen payment screen")
pdf.bullet("components/booking/FullScreenBookingView.tsx - Booking footer total")

pdf.sub_title("UI Screens (5 files)")
pdf.bullet("app/membership.tsx - Earn rates, credit amounts, credit targets in tier modals")
pdf.bullet("app/(main-tabs)/settings/refer-a-friend.tsx - '250 points' to '$15 credit'")
pdf.bullet("components/shared-ui/ReferralUtils.ts - Share message utility")
pdf.bullet("app/(main-tabs)/settings/about.tsx - Showcase receipt, rewards card, referral text")
pdf.bullet("app/(main-tabs)/settings/pricing-transparency.tsx - Fee description")

pdf.sub_title("AI & Documentation (5 files)")
pdf.bullet("services/ai/scenarios.ts - 7 AI chat scenario strings")
pdf.bullet("docs/REWARDS.md - Full rewrite with v2.0 model")
pdf.bullet("docs/BOOKING_INTEGRATION.md - Earn rate & fee references")
pdf.bullet("docs/CHECKLIST.md - Credit amounts & earn rates")
pdf.bullet("docs/REFERENCE.md - All reward value references")

# ── PAGE 4: DETAILED CHANGES - BACKEND ──
pdf.add_page()
pdf.section_title("3. Detailed Changes")

pdf.sub_title("3.1 convex/rewards.ts - Backend Core")

pdf.body_text("Earn rates (addCreditForCompletedBooking):")
pdf.code_text(
    "// OLD\n"
    "const earnRates = { driver: 0.015, preferred: 0.03, elite: 0.05 };\n"
    "const rate = earnRates[tier] ?? 0.015;\n\n"
    "// NEW\n"
    "const earnRates = { driver: 0.01, preferred: 0.015, elite: 0.02 };\n"
    "const rate = earnRates[tier] ?? 0.01;"
)

pdf.body_text("Contribution credits (claimContributionReward):")
pdf.code_text(
    "// OLD\n"
    "const amounts = { review: 5, upload: 10, referral: 25 };\n\n"
    "// NEW\n"
    "const amounts = { review: 3, upload: 5, referral: 15 };"
)

pdf.body_text("Elite non-expiring credits:")
pdf.code_text(
    "// OLD\n"
    "expires_at: now + 180 * 24 * 60 * 60 * 1000, // 6 months (all tiers)\n\n"
    "// NEW\n"
    "// Elite credits never expire; Driver/Preferred expire in 6 months\n"
    "...(tier === 'elite' ? {} : { expires_at: now + 180 * 24 * 60 * 60 * 1000 }),"
)

# ── FEE CALCULATION ──
pdf.sub_title("3.2 Fee Calculation (4 files)")

pdf.body_text(
    "The old flat $4.79 'Platform Fee' was replaced with a dynamic 7% consumer service fee "
    "($4.99 minimum, no cap) across all fee calculation points."
)

pdf.body_text("hooks/useCreateBookingConvex.ts:")
pdf.code_text(
    "// OLD\n"
    "const PLATFORM_FEE = 4.79;\n\n"
    "// NEW\n"
    "const SERVICE_FEE_RATE = 0.07;\n"
    "const SERVICE_FEE_MINIMUM = 4.99;\n"
    "const servicesSubtotal = services.reduce(\n"
    "  (sum, s) => sum + s.labor_cost + s.parts_cost, 0\n"
    ");\n"
    "const PLATFORM_FEE = servicesSubtotal > 0\n"
    "  ? Math.max(servicesSubtotal * SERVICE_FEE_RATE, SERVICE_FEE_MINIMUM)\n"
    "  : 0;"
)

pdf.body_text("Same pattern applied to ReviewPayContent.tsx, payment.tsx, and FullScreenBookingView.tsx.")
pdf.body_text("Fee label updated from 'Platform Fee' to 'Otopair Service Fee - 7%' in all UI surfaces.")
pdf.body_text("TODO comments added at every fee calculation for future subscriber fee waiver.")

# ── UI SCREENS ──
pdf.add_page()
pdf.sub_title("3.3 app/membership.tsx - Membership UI")

widths2 = [65, 50, 50]
pdf.table_header(["Element", "Old", "New"], widths2)
pdf.table_row(["Review credit display", "+$5 Credit", "+$3 Credit"], widths2, True)
pdf.table_row(["Upload credit display", "+$10 Credit", "+$5 Credit"], widths2, True)
pdf.table_row(["Referral credit display", "+$25 Credit", "+$15 Credit"], widths2, True)
pdf.table_row(["Preferred earn rate", "~3% earn rate", "~1.5% earn rate"], widths2, True)
pdf.table_row(["Driver earn rate", "~1.5% earn rate", "~1% earn rate"], widths2, True)
pdf.table_row(["Driver credit target", "$50-$75/year", "$20-$40/year"], widths2, True)

pdf.ln(4)
pdf.sub_title("3.4 Referral Screen & Utilities")

pdf.body_text("app/(main-tabs)/settings/refer-a-friend.tsx:")
widths3 = [65, 50, 50]
pdf.table_header(["Element", "Old", "New"], widths3)
pdf.table_row(["Hero title", "Give 250, get 250", "Give $15, get $15"], widths3, True)
pdf.table_row(["Hero description", "250 points for...", "$15 credit for..."], widths3, True)
pdf.table_row(["Total credit earned", "750", "$45"], widths3, True)
pdf.table_row(["Activity entry", "Earned 250 credit", "Earned $15 credit"], widths3, True)

pdf.ln(4)
pdf.body_text("components/shared-ui/ReferralUtils.ts:")
pdf.code_text(
    "// OLD: 'get 250 points for your first booking!'\n"
    "// NEW: 'get $15 credit for your first booking!'"
)

pdf.sub_title("3.5 About Page Showcase")
pdf.body_text("app/(main-tabs)/settings/about.tsx:")
widths4 = [65, 50, 50]
pdf.table_header(["Element", "Old", "New"], widths4)
pdf.table_row(["Fee label", "Platform Fee", "Otopair Service Fee - 7%"], widths4, True)
pdf.table_row(["Fee amount", "$4.79", "$4.99"], widths4, True)
pdf.table_row(["Receipt total", "$69.79", "$74.99"], widths4, True)
pdf.table_row(["Rewards title", "Points that unlock...", "Credits that unlock..."], widths4, True)
pdf.table_row(["Rewards card", "GOLD TIER / 840 pts", "OWNERSHIP CREDIT / $12.40"], widths4, True)
pdf.table_row(["Referral text", "earn 250 points", "earn $15 credit"], widths4, True)

pdf.ln(4)
pdf.sub_title("3.6 Pricing Transparency")
pdf.body_text("Updated fee title from 'Platform Fee' to 'Otopair Service Fee' and description from "
              "'small, flat service fee' to '7% service fee (minimum $4.99), waived for subscribers.'")

# ── AI & DOCS ──
pdf.add_page()
pdf.sub_title("3.7 AI Scenarios")
pdf.body_text("services/ai/scenarios.ts - 7 occurrences of '$4.99 platform fee' replaced with '7% service fee'. "
              "One occurrence of 'Platform fee: $4.99' replaced with 'Service fee: 7% (min $4.99)'.")

pdf.sub_title("3.8 Documentation Updates")
pdf.body_text("docs/REWARDS.md - Complete rewrite. Added sections for Consumer Service Fee (7% model), "
              "credit targets by tier, Elite non-expiring credits, and V1+ items including subscriber fee waiver.")

pdf.body_text("docs/BOOKING_INTEGRATION.md - Updated earn rates from 1.5%/3%/5% to 1%/1.5%/2%. "
              "Updated fee description from flat $4.79 to 7% dynamic calculation.")

pdf.body_text("docs/CHECKLIST.md - Updated 4 references to contribution credit amounts and earn rates.")

pdf.body_text("docs/REFERENCE.md - Updated 6 references across schema tables, reward system description, "
              "API documentation, and summary sections.")

# ── VERIFICATION ──
pdf.section_title("4. Verification Results")

pdf.body_text("After all changes, the following grep searches confirmed no stale values remain:")
pdf.bullet("Grep for '4.79' - Only match: SVG asset file (not code)")
pdf.bullet("Grep for '250 points' or '250.*point' - Zero matches")
pdf.bullet("Grep for 'review $5', 'upload $10', 'referral $25' - Zero matches")
pdf.bullet("Grep for '1.5% / 3% / 5%' - Zero matches")
pdf.bullet("Grep for 'Platform Fee' (as UI label) - Zero matches")

# ── NOTES ──
pdf.section_title("5. Implementation Notes")

pdf.sub_title("Subscriber Fee Waiver (TODO)")
pdf.body_text("Every fee calculation location includes a TODO comment: 'When subscriptions are wired, "
              "waive service fee for Preferred/Elite subscribers.' Subscription tier logic is not yet "
              "implemented, so the waiver will be added when that feature ships.")

pdf.sub_title("Schema Compatibility")
pdf.body_text("The 'platform_fee' field in the bookings table accepts v.optional(v.float64()), "
              "so passing a dynamic value instead of a flat constant is fully compatible. "
              "No Convex schema changes were needed.")

pdf.sub_title("Historical Data")
pdf.body_text("Existing bookings in the database retain their original $4.79 platform fee in total_cost. "
              "These are historical records and are not affected by the update.")

pdf.sub_title("Edge Case: Zero Services")
pdf.body_text("If servicesSubtotal is 0, the fee formula returns 0 (guarded with servicesSubtotal > 0 check). "
              "This should never occur in practice since bookings require at least one service.")

# Save
output_path = os.path.expanduser("~/Downloads/OtoPair_Revenue_Rewards_v2_Changes.pdf")
pdf.output(output_path)
print(f"PDF saved to: {output_path}")
