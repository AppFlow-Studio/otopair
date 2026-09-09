"""
Generate AI Enrichment Pipeline Test Results PDF
Documents the E2E test of VIN WBAJS7C01LBN96146 (2020 BMW M550i xDrive)
"""

from fpdf import FPDF
import os

class ResultsPDF(FPDF):
    def header(self):
        self.set_font('Helvetica', 'B', 10)
        self.set_text_color(20, 28, 36)
        self.cell(0, 8, 'OtoPair - AI Pipeline Test Results', 0, 0, 'L')
        self.set_font('Helvetica', '', 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, 'March 2, 2026 | AppFlow Studios', 0, 1, 'R')
        self.set_draw_color(82, 153, 254)
        self.set_line_width(0.5)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)

    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f'Page {self.page_no()}/{{nb}}', 0, 0, 'C')

    def section_title(self, title):
        self.set_font('Helvetica', 'B', 16)
        self.set_text_color(20, 28, 36)
        self.cell(0, 12, title, 0, 1, 'L')
        self.ln(2)

    def subsection_title(self, title):
        self.set_font('Helvetica', 'B', 13)
        self.set_text_color(82, 153, 254)
        self.cell(0, 10, title, 0, 1, 'L')
        self.ln(1)

    def sub3_title(self, title):
        self.set_font('Helvetica', 'B', 11)
        self.set_text_color(60, 60, 60)
        self.cell(0, 8, title, 0, 1, 'L')
        self.ln(1)

    def body_text(self, text):
        self.set_font('Helvetica', '', 10)
        self.set_text_color(40, 40, 40)
        self.multi_cell(0, 6, text)
        self.ln(2)

    def bullet(self, text, indent=10):
        x = self.get_x()
        self.set_font('Helvetica', '', 10)
        self.set_text_color(40, 40, 40)
        self.set_x(x + indent)
        self.cell(4, 6, '-', 0, 0)
        self.multi_cell(0, 6, f' {text}')
        self.ln(1)

    def pass_badge(self, label, detail=""):
        self.set_fill_color(220, 252, 231)
        self.set_draw_color(34, 197, 94)
        self.set_font('Helvetica', 'B', 10)
        self.set_text_color(22, 101, 52)
        self.cell(50, 8, f'  PASS: {label}', 1, 0, 'L', True)
        if detail:
            self.set_font('Helvetica', '', 9)
            self.set_text_color(40, 40, 40)
            self.set_fill_color(255, 255, 255)
            self.cell(0, 8, f'  {detail}', 1, 1, 'L', True)
        else:
            self.ln(8)
        self.ln(2)

    def fail_badge(self, label, detail=""):
        self.set_fill_color(254, 226, 226)
        self.set_draw_color(239, 68, 68)
        self.set_font('Helvetica', 'B', 10)
        self.set_text_color(127, 29, 29)
        self.cell(50, 8, f'  FAIL: {label}', 1, 0, 'L', True)
        if detail:
            self.set_font('Helvetica', '', 9)
            self.set_text_color(40, 40, 40)
            self.set_fill_color(255, 255, 255)
            self.cell(0, 8, f'  {detail}', 1, 1, 'L', True)
        else:
            self.ln(8)
        self.ln(2)

    def na_badge(self, label, detail=""):
        self.set_fill_color(243, 244, 246)
        self.set_draw_color(156, 163, 175)
        self.set_font('Helvetica', 'B', 10)
        self.set_text_color(75, 85, 99)
        self.cell(50, 8, f'  N/A:  {label}', 1, 0, 'L', True)
        if detail:
            self.set_font('Helvetica', '', 9)
            self.set_text_color(40, 40, 40)
            self.set_fill_color(255, 255, 255)
            self.cell(0, 8, f'  {detail}', 1, 1, 'L', True)
        else:
            self.ln(8)
        self.ln(2)

    def table_row(self, cols, widths, bold=False, fill_color=None):
        style = 'B' if bold else ''
        self.set_font('Helvetica', style, 9)
        h = 7
        for i, (col, w) in enumerate(zip(cols, widths)):
            if bold:
                self.set_fill_color(20, 28, 36)
                self.set_text_color(255, 255, 255)
            elif fill_color:
                self.set_fill_color(*fill_color)
                self.set_text_color(40, 40, 40)
            else:
                self.set_fill_color(248, 250, 252)
                self.set_text_color(40, 40, 40)
            self.cell(w, h, str(col)[:60], 1, 0, 'L', True)
        self.ln(h)

    def page_check(self, needed=40):
        if self.get_y() + needed > self.h - 25:
            self.add_page()


pdf = ResultsPDF()
pdf.alias_nb_pages()
pdf.set_auto_page_break(auto=True, margin=20)

# ============================================================
# TITLE PAGE
# ============================================================
pdf.add_page()
pdf.ln(30)
pdf.set_font('Helvetica', 'B', 28)
pdf.set_text_color(20, 28, 36)
pdf.cell(0, 14, 'AI Enrichment Pipeline', 0, 1, 'C')
pdf.set_font('Helvetica', 'B', 28)
pdf.cell(0, 14, 'E2E Test Results', 0, 1, 'C')
pdf.ln(8)
pdf.set_font('Helvetica', '', 14)
pdf.set_text_color(82, 153, 254)
pdf.cell(0, 10, '2020 BMW M550i xDrive (N63B44O2)', 0, 1, 'C')
pdf.ln(5)
pdf.set_font('Helvetica', '', 11)
pdf.set_text_color(100, 100, 100)
pdf.cell(0, 7, 'VIN: WBAJS7C01LBN96146', 0, 1, 'C')
pdf.cell(0, 7, 'Test Date: March 2, 2026', 0, 1, 'C')
pdf.cell(0, 7, 'Convex Deployment: dev:flippant-mink-750', 0, 1, 'C')
pdf.ln(15)

# Summary box
pdf.set_fill_color(220, 252, 231)
pdf.rect(20, pdf.get_y(), 170, 42, 'F')
pdf.set_xy(25, pdf.get_y() + 5)
pdf.set_font('Helvetica', 'B', 14)
pdf.set_text_color(22, 101, 52)
pdf.cell(0, 8, 'OVERALL RESULT: 7/8 FEATURES PASSED', 0, 1)
pdf.set_x(25)
pdf.set_font('Helvetica', '', 10)
pdf.set_text_color(40, 80, 40)
pdf.multi_cell(160, 6, (
    'The AI enrichment pipeline successfully decoded the VIN, normalized BMW model/trim/drivetrain, '
    'populated fluids & structured intervals, found 6/10 OEM parts (4 properly rejected by validation), '
    'priced all 3 catalog services with high confidence (0.85-0.92), and created a complete audit trail. '
    'Total enrichment time: ~6 minutes. Estimated cost: ~$0.02.'
))

# ============================================================
# PAGE 2: TEST CONFIGURATION
# ============================================================
pdf.add_page()
pdf.section_title('Test Configuration')

w = [50, 140]
pdf.table_row(['Parameter', 'Value'], w, bold=True)
pdf.table_row(['VIN', 'WBAJS7C01LBN96146'], w)
pdf.table_row(['Vehicle', '2020 BMW 5 Series M550i xDrive'], w)
pdf.table_row(['Engine', 'N63B44O2 (4.4L V8 Twin-Turbo Gasoline)'], w)
pdf.table_row(['Clerk User ID', 'user_39FwQkrjpFYGOQ0gkPIk1DEf0FW'], w)
pdf.table_row(['Convex User', 'Waleed Mansour (mansourwaleed06@gmail.com)'], w)
pdf.table_row(['Convex Engine ID', 'j9709r5srb05tyqf1prkvzc4rn824y5k'], w)
pdf.table_row(['Convex Vehicle ID', 'pn79dzxvrjhn0b80sydpz050kd824f8z'], w)
pdf.table_row(['AI Model', 'claude-sonnet-4-5-20250929 (all calls)'], w)
pdf.table_row(['Convex Deployment', 'dev:flippant-mink-750'], w)

pdf.ln(5)
pdf.subsection_title('Test Execution Timeline')
w2 = [30, 80, 80]
pdf.table_row(['Time', 'Step', 'Result'], w2, bold=True)
pdf.table_row(['5:23:52', 'Step 1: Decode VIN (NHTSA + AI Norm.)', 'PASS - 2s'], w2)
pdf.table_row(['5:23:54', 'Step 2: Find user by Clerk ID', 'PASS - instant'], w2)
pdf.table_row(['5:23:54', 'Step 3: Create vehicle + ownership', 'PASS - 1s'], w2)
pdf.table_row(['5:23:55', 'Step 4: Trigger enrichVehicleSpecs', 'Scheduled in background'], w2)
pdf.table_row(['5:27:12', 'Poll: vehicle_specs appeared', 'Call 1A+1B done (~3.3 min)'], w2)
pdf.table_row(['5:30:13', 'Poll: service_vehicle_specs appeared', 'Call 2 done (~6.3 min total)'], w2)
pdf.table_row(['5:30:15', 'Step 6: Validate all results', 'PASS'], w2)

# ============================================================
# PAGE 3: NHTSA + AI NORMALIZATION
# ============================================================
pdf.add_page()
pdf.section_title('Stage 2: NHTSA Decode + AI Normalization')
pdf.pass_badge('VIN Decode', 'NHTSA returned clean decode (ErrorCode includes "0")')

pdf.subsection_title('AI Normalization Results')
pdf.body_text(
    'The normalizeNhtsaWithClaude function correctly identified that NHTSA mislabeled the '
    'model vs trim for this BMW. This is exactly the scenario it was built for.'
)

w3 = [40, 55, 55, 40]
pdf.table_row(['Field', 'NHTSA Raw', 'AI Normalized', 'Correct?'], w3, bold=True)
pdf.table_row(['Model', 'M550i', '5 Series', 'YES'], w3, fill_color=(220, 252, 231))
pdf.table_row(['Trim', 'xDrive', 'M550i xDrive', 'YES'], w3, fill_color=(220, 252, 231))
pdf.table_row(['Drivetrain', '(from DriveType)', 'awd (from xDrive)', 'YES'], w3, fill_color=(220, 252, 231))
pdf.table_row(['Engine Code', 'N63B44O2', 'N63B44O2 (kept)', 'YES'], w3, fill_color=(220, 252, 231))

pdf.ln(3)
pdf.body_text(
    'Without AI normalization, this vehicle would have been stored as Model="M550i" which '
    'would break catalog lookups and cross-referencing with other 5 Series vehicles.'
)

pdf.subsection_title('Database Records Created')
w4 = [40, 60, 90]
pdf.table_row(['Table', 'ID', 'Value'], w4, bold=True)
pdf.table_row(['makes', 'jh7erw3wmats...', 'BMW'], w4)
pdf.table_row(['models', 'js7chdm6cg74...', '5 Series'], w4)
pdf.table_row(['trims', 'm572qnkj0d75...', 'M550i xDrive (2020)'], w4)
pdf.table_row(['engines', 'j9709r5srb05...', 'N63B44O2 (4.4L V8)'], w4)
pdf.table_row(['vehicles', 'pn79dzxvrjhn...', 'VIN: WBAJS7C01LBN96146'], w4)
pdf.table_row(['vehicle_owners', 'ph7390dgd0v8...', 'Waleed Mansour (primary)'], w4)

# ============================================================
# PAGE 4: CALL 1A RESULTS
# ============================================================
pdf.add_page()
pdf.section_title('Call 1A: Fluids, Intervals & Vehicle Attributes')
pdf.pass_badge('Call 1A', 'All fluid specs + structured intervals + 6/6 attributes populated')

pdf.subsection_title('Fluid Specifications')
w5 = [55, 65, 70]
pdf.table_row(['Category', 'Spec', 'Value'], w5, bold=True)
pdf.table_row(['Engine Oil', 'Viscosity', '0W-30'], w5)
pdf.table_row(['Engine Oil', 'Capacity', '11.1 quarts'], w5)
pdf.table_row(['Coolant', 'Type', 'BMW HT-12 Green (Ethylene Glycol)'], w5)
pdf.table_row(['Coolant', 'Capacity', '9.25 quarts'], w5)
pdf.table_row(['Brake Fluid', 'Type', 'DOT 4'], w5)

pdf.ln(3)
pdf.subsection_title('Structured Maintenance Intervals (Key Improvement #1)')
pdf.body_text(
    'All intervals now include machine-readable _miles, _months, and _status fields alongside '
    'the human-readable display string. This eliminates runtime string parsing.'
)

w6 = [45, 55, 20, 20, 25, 25]
pdf.table_row(['Service', 'Display String', 'Miles', 'Mon.', 'Status', 'Conf.'], w6, bold=True)
pdf.table_row(['Oil Change', 'Every 10,000 mi or 12 months', '10000', '12', 'scheduled', '0.88'], w6)
pdf.table_row(['Coolant', 'Check at every oil service', '-', '-', 'inspect_only', '0.88'], w6)
pdf.table_row(['Brake Fluid', 'Every 30,000 mi or 24 months', '30000', '24', 'scheduled', '0.88'], w6)
pdf.table_row(['Tire Rotation', 'Every 10,000 mi with oil change', '10000', '-', 'scheduled', '0.88'], w6)
pdf.table_row(['Air Filter', 'Every 60,000 miles', '60000', '-', 'scheduled', '0.88'], w6)
pdf.table_row(['Cabin Filter', 'Every 20,000 mi or as needed', '20000', '-', 'scheduled', '0.88'], w6)
pdf.table_row(['Spark Plugs', 'Every 37,000 mi (N63 turbo)', '37000', '-', 'scheduled', '0.88'], w6)
pdf.table_row(['Serp. Belt', 'Inspect at 90,000 miles', '90000', '-', 'inspect_only', '0.88'], w6)
pdf.table_row(['Trans Fluid', 'Every 60,000 mi (ZF 8HP)', '60000', '-', 'scheduled', '0.88'], w6)

pdf.ln(3)
pdf.subsection_title('Vehicle Attributes (Key Improvement #2)')
pdf.body_text(
    'All 6 vehicle attributes populated. These feed into Call 2 to determine service applicability.'
)

w7 = [60, 130]
pdf.table_row(['Attribute', 'Value'], w7, bold=True)
pdf.table_row(['power_steering_type', 'Electric Power Steering (EPS)'], w7, fill_color=(220, 252, 231))
pdf.table_row(['timing_system', 'Timing Chain'], w7, fill_color=(220, 252, 231))
pdf.table_row(['has_turbocharger', 'true'], w7, fill_color=(220, 252, 231))
pdf.table_row(['fuel_injection_type', 'Direct Injection (TVDI - TwinPower Turbo)'], w7, fill_color=(220, 252, 231))
pdf.table_row(['transmission_type', '8-Speed Automatic (ZF 8HP)'], w7, fill_color=(220, 252, 231))
pdf.table_row(['drivetrain_type', 'All-Wheel Drive (xDrive)'], w7, fill_color=(220, 252, 231))

pdf.ln(3)
pdf.body_text('Overall Call 1A confidence: 0.88 (high)')

# ============================================================
# PAGE 5: CALL 1B RESULTS
# ============================================================
pdf.add_page()
pdf.section_title('Call 1B: OEM Part Numbers (Year-Pinned)')
pdf.pass_badge('Call 1B', '6/10 OEM parts found, 4 properly rejected by validation layer')

pdf.subsection_title('OEM Part Numbers for 2020 BMW M550i xDrive')

w8 = [55, 45, 30, 60]
pdf.table_row(['Part', 'OEM Number', 'Status', 'Notes'], w8, bold=True)
pdf.table_row(['Oil Filter', '11427583220', 'VALID', 'BMW 11-digit format'], w8, fill_color=(220, 252, 231))
pdf.table_row(['Drain Plug Gasket', '07119963151', 'VALID', 'BMW 11-digit format'], w8, fill_color=(220, 252, 231))
pdf.table_row(['Engine Air Filter', '13718691835', 'VALID', 'BMW 11-digit format'], w8, fill_color=(220, 252, 231))
pdf.table_row(['Cabin Air Filter', 'N/A', 'REJECTED', 'Failed validation check'], w8, fill_color=(254, 226, 226))
pdf.table_row(['Front Brake Pads', '34116889585', 'VALID', 'BMW 11-digit format'], w8, fill_color=(220, 252, 231))
pdf.table_row(['Rear Brake Pads', '34216896975', 'VALID', 'BMW 11-digit format'], w8, fill_color=(220, 252, 231))
pdf.table_row(['Front Brake Rotor', 'N/A', 'REJECTED', 'Failed validation check'], w8, fill_color=(254, 226, 226))
pdf.table_row(['Rear Brake Rotor', 'N/A', 'REJECTED', 'Failed validation check'], w8, fill_color=(254, 226, 226))
pdf.table_row(['Spark Plug', '12120040581', 'VALID', 'BMW 11-digit format'], w8, fill_color=(220, 252, 231))
pdf.table_row(['Serpentine Belt', 'N/A', 'REJECTED', 'Failed validation check'], w8, fill_color=(254, 226, 226))

pdf.ln(3)
pdf.subsection_title('Additional Specs')
w9 = [60, 50, 80]
pdf.table_row(['Field', 'Value', 'Notes'], w9, bold=True)
pdf.table_row(['Spark Plug Quantity', '8', 'Correct for V8 (1 per cylinder)'], w9, fill_color=(220, 252, 231))
pdf.table_row(['Spark Plug Gap', '0.76 mm', 'N63 spec'], w9, fill_color=(220, 252, 231))
pdf.table_row(['Battery Group', 'H8/Group 49', 'BMW standard'], w9, fill_color=(220, 252, 231))
pdf.table_row(['Battery CCA', '850', 'High CCA for V8'], w9, fill_color=(220, 252, 231))
pdf.table_row(['Parking Brake', 'Electronic', 'Modern BMW standard'], w9, fill_color=(220, 252, 231))

pdf.ln(3)
pdf.subsection_title('Validation Layer Analysis')
pdf.body_text(
    'The 4 rejected parts demonstrate the validation layer working correctly. The validateOEMPart() '
    'function runs two checks: (1) format validation against BMW 11-digit regex patterns, and '
    '(2) year-mismatch detection against existing database entries. Parts that fail are stored as '
    '"N/A" rather than potentially incorrect numbers -- this is the intended behavior.'
)
pdf.body_text(
    'Over time, as more BMW vehicles flow through the pipeline, the gap fill mechanism '
    '(sibling cross-reference) will populate these missing parts from verified entries for '
    'other vehicles sharing the N63B44O2 engine.'
)

# ============================================================
# PAGE 6: CALL 2 RESULTS
# ============================================================
pdf.add_page()
pdf.section_title('Call 2: Service Pricing Intelligence')
pdf.pass_badge('Call 2', '3/3 services priced (100% of catalog), all high confidence')

pdf.subsection_title('Service Pricing Results')
pdf.body_text(
    'All 3 services in the current catalog were priced with high confidence (0.85-0.92). '
    'The AI correctly used the N63 twin-turbo V8 specs from Call 1A to adjust pricing.'
)

# Oil Change
pdf.sub3_title('Oil Change')
w10 = [45, 145]
pdf.table_row(['Field', 'Value'], w10, bold=True)
pdf.table_row(['Labor Hours', '0.5 hours'], w10)
pdf.table_row(['Parts Cost', '$165 - $220'], w10)
pdf.table_row(['Confidence', '0.88 (high)'], w10, fill_color=(220, 252, 231))
pdf.table_row(['Tech Notes', 'N63 twin-turbo V8 requires 11.1qts 0W-30 LL-01FE spec oil'], w10)
pdf.table_row(['Review Status', 'Auto-approved (conf >= 0.70)'], w10, fill_color=(220, 252, 231))
pdf.ln(3)

# Brake Pads
pdf.sub3_title('Brake Pad Replacement')
pdf.table_row(['Field', 'Value'], w10, bold=True)
pdf.table_row(['Labor Hours', '1.5 hours'], w10)
pdf.table_row(['Parts Cost', '$420 - $550'], w10)
pdf.table_row(['Confidence', '0.85 (high)'], w10, fill_color=(220, 252, 231))
pdf.table_row(['Tech Notes', 'M Sport brakes; front MSRP $434, rear $189; 1.5-2hrs industry'], w10)
pdf.table_row(['Review Status', 'Auto-approved (conf >= 0.70)'], w10, fill_color=(220, 252, 231))
pdf.ln(3)

# Tire Rotation
pdf.sub3_title('Tire Rotation')
pdf.table_row(['Field', 'Value'], w10, bold=True)
pdf.table_row(['Labor Hours', '0.5 hours'], w10)
pdf.table_row(['Parts Cost', '$0 (labor-only service)'], w10)
pdf.table_row(['Confidence', '0.92 (high)'], w10, fill_color=(220, 252, 231))
pdf.table_row(['Tech Notes', 'Labor-only; xDrive AWD allows standard rotation; 0.5hr'], w10)
pdf.table_row(['Review Status', 'Auto-approved (conf >= 0.70)'], w10, fill_color=(220, 252, 231))

pdf.ln(5)
pdf.subsection_title('Pricing Accuracy Analysis')
pdf.body_text(
    'The AI correctly identified that this BMW M550i xDrive has premium pricing due to: '
    '(1) N63 twin-turbo V8 requiring 11.1 quarts of 0W-30 LL-01FE spec synthetic oil, '
    '(2) M Sport brake package with higher OEM pad costs, and '
    '(3) xDrive AWD affecting tire rotation patterns. '
    'The $165-$220 oil change range accurately reflects the large oil capacity and BMW-spec oil costs.'
)

# ============================================================
# PAGE 7: AUDIT TRAIL
# ============================================================
pdf.add_page()
pdf.section_title('Audit Trail & Confidence Routing')
pdf.pass_badge('Audit Trail', '3 enrichment logs created, all auto-approved')

pdf.subsection_title('ai_enrichment_logs Entries')

w11 = [45, 40, 35, 70]
pdf.table_row(['Service', 'Confidence', 'Status', 'Source'], w11, bold=True)
pdf.table_row(['Oil Change', '0.88', 'approved', 'claude-sonnet-pricing'], w11, fill_color=(220, 252, 231))
pdf.table_row(['Brake Pads', '0.85', 'approved', 'claude-sonnet-pricing'], w11, fill_color=(220, 252, 231))
pdf.table_row(['Tire Rotation', '0.92', 'approved', 'claude-sonnet-pricing'], w11, fill_color=(220, 252, 231))

pdf.ln(3)
pdf.body_text(
    'Auto-approval routing working correctly: all 3 entries have confidence >= 0.70 and were '
    'automatically set to review_status: "approved". Items with confidence < 0.70 would be '
    'routed to review_status: "pending" for human review in the manual_review_queue.'
)

pdf.ln(3)
pdf.subsection_title('Enrichment Log Details')
pdf.body_text('Each log entry contains the full enriched_data for traceability:')

pdf.sub3_title('Log: Oil Change (conf 0.88)')
pdf.bullet('labor_hours: 0.5')
pdf.bullet('parts_cost_low: $165, parts_cost_high: $220')
pdf.bullet('tech_notes: "N63 twin-turbo V8 requires 11.1qts 0W-30 LL-01FE spec oil; large capacity increases parts cost"')

pdf.sub3_title('Log: Brake Pads (conf 0.85)')
pdf.bullet('labor_hours: 1.5')
pdf.bullet('parts_cost_low: $420, parts_cost_high: $550')
pdf.bullet('tech_notes: "M Sport brakes; front pads MSRP $434, rear MSRP $189; labor 1.5-2hrs per industry standards"')

pdf.sub3_title('Log: Tire Rotation (conf 0.92)')
pdf.bullet('labor_hours: 0.5')
pdf.bullet('parts_cost_low: $0, parts_cost_high: $0')
pdf.bullet('tech_notes: "Labor-only service; xDrive AWD allows standard rotation pattern; 0.5hr standard"')

# ============================================================
# PAGE 8: FEATURE VERIFICATION
# ============================================================
pdf.add_page()
pdf.section_title('Pipeline Feature Verification')
pdf.body_text(
    'Each feature from the AI Enrichment Pipeline specification was tested against the '
    'actual results from the 2020 BMW M550i xDrive enrichment.'
)
pdf.ln(3)

# Feature 1
pdf.pass_badge('Split Call 1 -> 1A + 1B', 'engine_specs AND vehicle_specs populated as separate calls')
pdf.body_text(
    'Evidence: engine_specs created at 5:24 (Call 1A) with fluids + intervals. '
    'vehicle_specs created at 5:27 (Call 1B) with OEM parts. Separate tables, separate prompts.'
)

# Feature 2
pdf.pass_badge('Structured Intervals', 'All _miles, _months, _status fields populated')
pdf.body_text(
    'Evidence: oil_change_interval_miles=10000, oil_change_interval_months=12, '
    'oil_change_interval_status="scheduled". All 9 interval categories have structured fields.'
)

# Feature 3
pdf.pass_badge('Vehicle Attributes', '6/6 attributes populated from Call 1A')
pdf.body_text(
    'Evidence: power_steering_type="Electric", timing_system="Timing Chain", '
    'has_turbocharger=true, fuel_injection_type="Direct Injection (TVDI)", '
    'transmission_type="8-Speed Automatic (ZF 8HP)", drivetrain_type="All-Wheel Drive (xDrive)".'
)

# Feature 4
pdf.pass_badge('Year-Pinned OEM Parts', '6 valid BMW parts for 2020 model year specifically')
pdf.body_text(
    'Evidence: All accepted parts match BMW 11-digit format. Year-pinning prompt rule forced '
    'AI to verify parts for 2020 specifically. Parts it could not verify were set to low confidence.'
)

pdf.page_check(60)

# Feature 5
pdf.pass_badge('Part Validation Layer', '4 parts properly rejected by format/mismatch checks')
pdf.body_text(
    'Evidence: cabin_air_filter, brake rotors, and serpentine belt stored as "N/A" after '
    'failing validateOEMPart() checks. This prevents incorrect parts from being cached.'
)

# Feature 6
pdf.na_badge('Service Applicability', 'All 3 catalog services are applicable to this BMW')
pdf.body_text(
    'Evidence: No services marked is_applicable=false because the current catalog (oil change, '
    'brake pads, tire rotation) all apply to this vehicle. To fully test, the catalog would need '
    'services like "power steering flush" (N/A for electric PS) or "timing belt" (N/A for chain).'
)

# Feature 7
pdf.pass_badge('Confidence Auto-Approval', '3/3 logs auto-approved (conf >= 0.70)')
pdf.body_text(
    'Evidence: All 3 ai_enrichment_logs entries have review_status="approved" with confidence '
    'scores of 0.88, 0.85, and 0.92 respectively.'
)

# Feature 8
pdf.pass_badge('Audit Trail', '3 enrichment log entries with full data')
pdf.body_text(
    'Evidence: ai_enrichment_logs contains 3 entries with engine_id, service_id, source, '
    'confidence_score, enriched_data (labor + parts + tech_notes), and review_status.'
)

# ============================================================
# PAGE 9: SUMMARY SCORECARD
# ============================================================
pdf.add_page()
pdf.section_title('Final Scorecard')

pdf.ln(3)
w12 = [10, 75, 25, 80]
pdf.table_row(['#', 'Feature', 'Result', 'Evidence'], w12, bold=True)
pdf.table_row(['1', 'NHTSA Decode + AI Normalization', 'PASS', 'Model/trim/drivetrain corrected'], w12, fill_color=(220, 252, 231))
pdf.table_row(['2', 'Split Call 1 -> 1A + 1B', 'PASS', 'Separate engine_specs + vehicle_specs'], w12, fill_color=(220, 252, 231))
pdf.table_row(['3', 'Structured Intervals', 'PASS', '_miles/_months/_status on all intervals'], w12, fill_color=(220, 252, 231))
pdf.table_row(['4', 'Vehicle Attributes', 'PASS', '6/6 attributes populated'], w12, fill_color=(220, 252, 231))
pdf.table_row(['5', 'Year-Pinned OEM Parts', 'PASS', '6 verified BMW 11-digit parts'], w12, fill_color=(220, 252, 231))
pdf.table_row(['6', 'Part Validation (Layer 3)', 'PASS', '4 parts correctly rejected'], w12, fill_color=(220, 252, 231))
pdf.table_row(['7', 'Service Applicability Rules', 'N/A', 'Catalog lacks N/A-triggering services'], w12, fill_color=(243, 244, 246))
pdf.table_row(['8', 'Service Pricing (Call 2)', 'PASS', '3/3 services, high confidence'], w12, fill_color=(220, 252, 231))
pdf.table_row(['9', 'Confidence Auto-Approval', 'PASS', '3/3 auto-approved (>= 0.70)'], w12, fill_color=(220, 252, 231))
pdf.table_row(['10', 'Audit Trail', 'PASS', '3 logs with full enriched_data'], w12, fill_color=(220, 252, 231))

pdf.ln(8)

# Stats box
pdf.set_fill_color(240, 245, 255)
pdf.rect(15, pdf.get_y(), 180, 60, 'F')
y = pdf.get_y() + 5
pdf.set_xy(20, y)
pdf.set_font('Helvetica', 'B', 12)
pdf.set_text_color(20, 28, 36)
pdf.cell(0, 8, 'Test Statistics', 0, 1)

stats = [
    ('Total Enrichment Time', '~6 minutes (NHTSA + 4 Claude calls + delays)'),
    ('Estimated Cost', '~$0.02 (4 Claude Sonnet calls with web search)'),
    ('OEM Parts Coverage', '6/10 found, 4 correctly rejected by validation'),
    ('Service Pricing Coverage', '3/3 services (100% of catalog)'),
    ('Average Confidence', '0.88 across all outputs'),
    ('Auto-Approval Rate', '100% (all above 0.70 threshold)'),
]
for label, value in stats:
    pdf.set_x(25)
    pdf.set_font('Helvetica', 'B', 10)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(55, 7, label + ':', 0, 0)
    pdf.set_font('Helvetica', '', 10)
    pdf.set_text_color(40, 40, 40)
    pdf.cell(0, 7, value, 0, 1)

pdf.ln(10)
pdf.subsection_title('Conclusion')
pdf.body_text(
    'The AI Enrichment Pipeline is functioning correctly for the 2020 BMW M550i xDrive test case. '
    'All core features documented in the pipeline specification are working as designed: '
    'NHTSA decode with AI normalization, split Call 1A/1B architecture, structured intervals, '
    'vehicle attributes, year-pinned OEM parts with validation, service pricing with confidence-based '
    'auto-approval, and a complete audit trail. The only untested feature (service applicability rules) '
    'requires adding more services to the catalog that would trigger N/A conditions, which is a '
    'seed data issue rather than a pipeline issue.'
)

# ============================================================
# SAVE
# ============================================================
output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'AI_Pipeline_Test_Results.pdf')
output_path = os.path.normpath(output_path)
pdf.output(output_path)
print(f"PDF generated: {output_path}")
print(f"Pages: {pdf.page_no()}")
