"""
Generate AI Enrichment Pipeline PDF for OtoPair
This PDF serves as a reference for creating a PowerPoint presentation.
"""

from fpdf import FPDF
import os

class PipelinePDF(FPDF):
    def header(self):
        self.set_font('Helvetica', 'B', 10)
        self.set_text_color(20, 28, 36)
        self.cell(0, 8, 'OtoPair - AI Vehicle Enrichment Pipeline', 0, 0, 'L')
        self.set_font('Helvetica', '', 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, 'AppFlow Studios | Confidential', 0, 1, 'R')
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

    def subsubsection_title(self, title):
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

    def bold_bullet(self, bold_part, normal_part, indent=10):
        x = self.get_x()
        self.set_x(x + indent)
        self.set_font('Helvetica', '', 10)
        self.set_text_color(40, 40, 40)
        self.cell(4, 6, '-', 0, 0)
        self.set_font('Helvetica', 'B', 10)
        self.cell(self.get_string_width(f' {bold_part}') + 2, 6, f' {bold_part}', 0, 0)
        self.set_font('Helvetica', '', 10)
        self.multi_cell(0, 6, normal_part)
        self.ln(1)

    def code_block(self, text):
        self.set_fill_color(245, 245, 250)
        self.set_font('Courier', '', 8)
        self.set_text_color(30, 30, 30)
        x = self.get_x()
        w = self.w - self.l_margin - self.r_margin
        lines = text.split('\n')
        h = len(lines) * 4.5 + 4
        if self.get_y() + h > self.h - 25:
            self.add_page()
        self.rect(x, self.get_y(), w, h, 'F')
        self.ln(2)
        for line in lines:
            self.set_x(x + 3)
            self.cell(0, 4.5, line[:120], 0, 1)
        self.ln(3)

    def table_row(self, cols, widths, bold=False):
        style = 'B' if bold else ''
        self.set_font('Helvetica', style, 9)
        h = 7
        x_start = self.get_x()
        for i, (col, w) in enumerate(zip(cols, widths)):
            if bold:
                self.set_fill_color(82, 153, 254)
                self.set_text_color(255, 255, 255)
            else:
                self.set_fill_color(250, 250, 255) if self.get_y() % 2 == 0 else self.set_fill_color(255, 255, 255)
                self.set_text_color(40, 40, 40)
            self.cell(w, h, str(col)[:50], 1, 0, 'L', True)
        self.ln(h)

    def page_break_check(self, needed=40):
        if self.get_y() + needed > self.h - 25:
            self.add_page()


pdf = PipelinePDF()
pdf.alias_nb_pages()
pdf.set_auto_page_break(auto=True, margin=20)

# ============================================================
# TITLE PAGE
# ============================================================
pdf.add_page()
pdf.ln(40)
pdf.set_font('Helvetica', 'B', 32)
pdf.set_text_color(20, 28, 36)
pdf.cell(0, 15, 'AI Vehicle Enrichment Pipeline', 0, 1, 'C')
pdf.ln(5)
pdf.set_font('Helvetica', '', 16)
pdf.set_text_color(82, 153, 254)
pdf.cell(0, 10, 'Technical Architecture & Implementation Guide', 0, 1, 'C')
pdf.ln(10)
pdf.set_font('Helvetica', '', 12)
pdf.set_text_color(100, 100, 100)
pdf.cell(0, 8, 'OtoPair | AppFlow Studios', 0, 1, 'C')
pdf.cell(0, 8, 'March 2026', 0, 1, 'C')
pdf.ln(20)

# Summary box
pdf.set_fill_color(240, 245, 255)
pdf.rect(20, pdf.get_y(), 170, 50, 'F')
pdf.set_xy(25, pdf.get_y() + 5)
pdf.set_font('Helvetica', 'B', 11)
pdf.set_text_color(20, 28, 36)
pdf.cell(0, 7, 'Executive Summary', 0, 1)
pdf.set_x(25)
pdf.set_font('Helvetica', '', 10)
pdf.set_text_color(50, 50, 50)
pdf.multi_cell(160, 6, (
    'A multi-stage, AI-powered pipeline that transforms a 17-character VIN into a complete '
    'vehicle intelligence profile: fluid specs, OEM part numbers, maintenance intervals, '
    'service pricing, and mechanical attributes. Built on Convex + Claude Sonnet 4.5 with '
    'web search, costing ~$0.02 per vehicle enrichment.'
))

# ============================================================
# SLIDE 2: TABLE OF CONTENTS
# ============================================================
pdf.add_page()
pdf.section_title('Table of Contents')
pdf.ln(5)
toc = [
    ('1', 'Pipeline Overview & Architecture', '3'),
    ('2', 'Stage 1: VIN Input (User Entry Points)', '4'),
    ('3', 'Stage 2: NHTSA Decode + AI Normalization', '5'),
    ('4', 'Stage 3: AI Enrichment Overview', '6'),
    ('5', 'Call 1A: Fluids, Intervals & Vehicle Attributes', '7'),
    ('6', 'Call 1B: OEM Part Numbers (Year-Pinned)', '8'),
    ('7', 'Year-Pinning & Part Validation (Layer 3)', '9'),
    ('8', 'Gap Fill: Sibling Cross-Reference + AI Retry', '10'),
    ('9', 'Call 2: Service Pricing Intelligence', '11'),
    ('10', 'Data Schema & Storage Architecture', '12'),
    ('11', 'Confidence Scoring & Review System', '13'),
    ('12', 'Five Key Improvements Over Previous Code', '14'),
    ('13', 'Practical Flow Summary', '15'),
    ('14', 'Implementation Status & Next Steps', '16'),
]
for num, title, page in toc:
    pdf.set_font('Helvetica', '', 11)
    pdf.set_text_color(40, 40, 40)
    pdf.cell(10, 8, num, 0, 0)
    pdf.cell(140, 8, title, 0, 0)
    pdf.set_text_color(82, 153, 254)
    pdf.cell(0, 8, page, 0, 1, 'R')
    pdf.set_text_color(40, 40, 40)

# ============================================================
# SLIDE 3: PIPELINE OVERVIEW
# ============================================================
pdf.add_page()
pdf.section_title('1. Pipeline Overview & Architecture')

pdf.subsection_title('The Big Picture')
pdf.body_text(
    'The OtoPair AI Enrichment Pipeline converts a raw VIN into a full vehicle intelligence profile '
    'through 4 sequential stages. The pipeline is event-driven: adding a vehicle triggers background '
    'enrichment automatically via Convex scheduler.'
)

pdf.subsection_title('Architecture Flow')
pdf.code_block(
    'VIN Input (user) \n'
    '  |-> Stage 2: NHTSA Decode + AI Normalization\n'
    '  |     |-> makes -> models -> trims -> engines -> chassis_variants\n'
    '  |-> Stage 3: AI Enrichment (4 Claude Calls)\n'
    '        |-> Call 1A: Fluids, Intervals, Vehicle Attributes -> engine_specs\n'
    '        |-> Call 1B: OEM Part Numbers (year-pinned) -> vehicle_specs, trim_specs\n'
    '        |-> Gap Fill: Sibling cross-ref + targeted AI retry\n'
    '        |-> Call 2: Service Pricing -> service_vehicle_specs\n'
    '        |-> Audit Trail -> ai_enrichment_logs'
)

pdf.subsection_title('Tech Stack')
pdf.bold_bullet('AI Model:', ' Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)')
pdf.bold_bullet('Web Search:', ' Claude built-in web_search tool (5-10 searches per call)')
pdf.bold_bullet('Backend:', ' Convex (real-time DB, mutations, actions, scheduler)')
pdf.bold_bullet('Cost:', ' ~$0.02 per vehicle enrichment (all 4 calls combined)')
pdf.bold_bullet('Rate Limiting:', ' Built-in delays (5-15s between calls) + 429 retry (60s wait)')

pdf.subsection_title('The Structural Change')
pdf.body_text(
    'The previous single "Call 1" (base specs) has been split into Call 1A (fluids + intervals + '
    'vehicle attributes) and Call 1B (OEM part numbers). Same fetchAnthropicWithRetry, same '
    'extractJsonFromContentBlocks, same mutation patterns - but with focused prompts for each domain.'
)

# ============================================================
# SLIDE 4: ENTRY POINTS
# ============================================================
pdf.add_page()
pdf.section_title('2. Stage 1: VIN Input (User Entry Points)')

pdf.subsection_title('Two Input Paths')
pdf.body_text('Users can add vehicles through two distinct paths, both converging on the same enrichment pipeline:')

pdf.subsubsection_title('Path A: Manual VIN Entry')
pdf.bullet('User types 17-character VIN in app/add-vehicle.tsx')
pdf.bullet('Calls vehicle_pipeline.decodeVin (public action)')
pdf.bullet('User reviews decoded info, confirms via confirmVehicleForUser')
pdf.bullet('Background scheduler triggers enrichVehicleSpecs')

pdf.ln(3)
pdf.subsubsection_title('Path B: Smartcar OBD/Connected Car')
pdf.bullet('User authenticates with Smartcar OAuth in add-vehicle-review.tsx')
pdf.bullet('Calls convex/smartcar.ts:exchangeCodeAndConnect')
pdf.bullet('VIN extracted from Smartcar API automatically')
pdf.bullet('Same enrichVehicleSpecs scheduled in background')

pdf.ln(3)
pdf.subsection_title('Convergence Point')
pdf.code_block(
    '// Both paths end here:\n'
    'await ctx.scheduler.runAfter(0, internal.vehicle_pipeline.enrichVehicleSpecs, {\n'
    '  engineId, make, model, year, trim, engineCode, displacement, cylinders, fuelType\n'
    '});'
)

pdf.body_text(
    'The scheduler.runAfter(0, ...) call means enrichment begins immediately but runs '
    'asynchronously - the user does not wait for AI results. The re-enrichment guard prevents '
    'duplicate work if the pipeline has already run for this engine.'
)

# ============================================================
# SLIDE 5: NHTSA + AI NORMALIZATION
# ============================================================
pdf.add_page()
pdf.section_title('3. Stage 2: NHTSA Decode + AI Normalization')

pdf.subsection_title('NHTSA VIN Decode API')
pdf.body_text(
    'The pipeline calls the NHTSA DecodeVinValuesExtended endpoint to extract raw vehicle data. '
    'Accepts any ErrorCode that includes "0" (clean or partial decode).'
)
pdf.subsubsection_title('Fields Extracted from NHTSA:')
pdf.bullet('make, model, year, trim, trim2, series, series2')
pdf.bullet('engineCode, cylinders, displacement, fuelType, turbo')
pdf.bullet('bodyStyle, transmission, driveType')

pdf.ln(3)
pdf.subsection_title('AI Normalization (New)')
pdf.body_text(
    'NHTSA often mislabels model vs trim vs drivetrain. Example: BMW M550i xDrive - NHTSA returns '
    'Model="M550i", Trim="xdrive", but the correct mapping is Model="5 Series", Trim="M550i", '
    'Drivetrain="awd". The normalizeNhtsaWithClaude function corrects this.'
)

pdf.subsubsection_title('Normalization Logic:')
pdf.bullet('Uses Claude Sonnet 4.5, temperature 0.1, max 4096 tokens, NO web search')
pdf.bullet('Corrects: model line, trim/submodel name, drivetrain type, engine code')
pdf.bullet('Maps brand-specific drivetrain labels: xDrive->awd, sDrive->rwd, 4matic->awd, quattro->awd')

pdf.ln(3)
pdf.subsection_title('Database Upsert Chain')
pdf.code_block(
    'NHTSA raw -> AI Normalize -> upsertMake -> upsertModel -> upsertTrim \n'
    '                          -> upsertEngine -> upsertChassisVariant (if drivetrain known)'
)

# ============================================================
# SLIDE 6: AI ENRICHMENT OVERVIEW
# ============================================================
pdf.add_page()
pdf.section_title('4. Stage 3: AI Enrichment Overview')

pdf.subsection_title('Function: enrichVehicleSpecs (internalAction)')
pdf.body_text(
    'The main orchestrator that runs 4 sequential Claude calls with built-in guards, '
    'validation, and fallback mechanisms.'
)

pdf.subsection_title('Re-Enrichment Guard')
pdf.body_text(
    'Before running anything, the pipeline checks if data already exists:'
)
pdf.bullet('getEngineSpecs - if engine_specs exist, skip Call 1A + 1B')
pdf.bullet('getServiceVehicleSpecsCount - if service_vehicle_specs exist, skip Call 2')
pdf.bullet('If both exist, pipeline exits early (idempotent)')

pdf.ln(3)
pdf.subsection_title('Step 0: Engine Code Resolution')
pdf.body_text('If NHTSA did not provide an engine code, the pipeline resolves it:')
pdf.bullet('Option 1: Single-engine trim - if trim has only 1 engine, use its code')
pdf.bullet('Option 2: AI inference - Claude returns OEM code (e.g. N63B44O2, K20C1) or "unknown"')
pdf.bullet('5-second delay before proceeding to Call 1A')

pdf.ln(3)
pdf.subsection_title('Call Sequence & Timing')
widths = [30, 70, 30, 30, 30]
pdf.table_row(['Call', 'Purpose', 'Searches', 'Tokens', 'Delay'], widths, bold=True)
pdf.table_row(['1A', 'Fluids, Intervals, Attributes', '8', '8,000', '10s after'], widths)
pdf.table_row(['1B', 'OEM Part Numbers + Trim Specs', '10', '8,000', '10s after'], widths)
pdf.table_row(['Gap', 'Sibling X-ref + Targeted Retry', '5', '4,000', '10s after'], widths)
pdf.table_row(['2', 'Service Pricing (all services)', '5', '16,000', '15s before'], widths)

# ============================================================
# SLIDE 7: CALL 1A
# ============================================================
pdf.add_page()
pdf.section_title('5. Call 1A: Fluids, Intervals & Vehicle Attributes')

pdf.subsection_title('Purpose')
pdf.body_text(
    'Extract fluid specifications, structured maintenance intervals, and mechanical attributes '
    'for the vehicle. This data feeds the maintenance scheduling engine.'
)

pdf.subsection_title('Key Innovation: Structured Intervals')
pdf.body_text(
    'Previously, intervals were stored as freetext like "7,500 miles or 12 months". Now the pipeline '
    'outputs BOTH the display string AND structured fields:'
)
pdf.code_block(
    '"oil_change_interval": "7,500 miles or 12 months",\n'
    '"oil_change_interval_miles": 7500,\n'
    '"oil_change_interval_months": 12,\n'
    '"oil_change_interval_status": "scheduled"'
)
pdf.body_text(
    'Interval statuses: "scheduled" | "not_applicable" | "conditional_severe" | "lifetime" | '
    '"inspect_only" | "data_unavailable"'
)

pdf.subsection_title('Web Search Strategy (8 searches)')
pdf.bullet('"<year> <make> <model> owner\'s manual maintenance schedule"')
pdf.bullet('"<make> <engineCode> oil type capacity"')
pdf.bullet('"<year> <make> <model> <trim> service intervals"')
pdf.bullet('"<year> <make> <model> power steering type timing chain or belt"')
pdf.bullet('Searches 5-8: Fill remaining gaps dynamically')

pdf.ln(3)
pdf.subsection_title('Vehicle Attributes Extracted')
pdf.bullet('power_steering_type (electric/hydraulic) - determines service applicability')
pdf.bullet('timing_system (chain/belt) - determines timing belt service applicability')
pdf.bullet('has_turbocharger - affects service complexity')
pdf.bullet('fuel_injection_type, transmission_type, drivetrain_type')

pdf.ln(3)
pdf.subsection_title('Storage')
pdf.bullet('Writes to engine_specs table via storeEngineSpecs mutation')
pdf.bullet('Writes vehicle attributes to engine_specs via updateEngineAttributes')
pdf.bullet('Logs to ai_enrichment_logs via logEnrichment')

# ============================================================
# SLIDE 8: CALL 1B
# ============================================================
pdf.add_page()
pdf.section_title('6. Call 1B: OEM Part Numbers (Year-Pinned)')

pdf.subsection_title('Purpose')
pdf.body_text(
    'Find exact OEM manufacturer part numbers for 10+ components, with per-field confidence scoring '
    'and year-specific verification.'
)

pdf.subsection_title('Year-Pinning Rule (Critical Innovation)')
pdf.set_fill_color(255, 245, 245)
pdf.rect(10, pdf.get_y(), 190, 25, 'F')
pdf.set_xy(15, pdf.get_y() + 3)
pdf.set_font('Helvetica', 'B', 10)
pdf.set_text_color(180, 30, 30)
pdf.cell(0, 6, 'CRITICAL RULE IN PROMPT:', 0, 1)
pdf.set_x(15)
pdf.set_font('Helvetica', '', 9)
pdf.set_text_color(80, 30, 30)
pdf.multi_cell(175, 5, (
    '"Parts MUST be verified for model year {year} specifically. Many OEM parts change between '
    'generations. If you cannot confirm a part number is correct for {year}, set confidence to 0.5 '
    'or below and note year-specific fitment unverified."'
))
pdf.ln(5)

pdf.subsection_title('Per-Field Confidence Scoring')
pdf.body_text('Each field returns: { "value": "...", "confidence": 0.0-1.0, "source": "..." }')
pdf.bullet('0.9+ = Confirmed from OEM catalog for exact year')
pdf.bullet('0.7-0.89 = Cross-referenced from reliable aftermarket source')
pdf.bullet('0.5-0.69 = Same engine/platform, different year')
pdf.bullet('<=0.5 = Unverified for specific year (flagged)')

pdf.ln(3)
pdf.subsection_title('OEM Parts Tracked (10 fields)')
widths2 = [50, 50, 50, 40]
pdf.table_row(['Category', 'Field', 'Example', 'Notes'], widths2, bold=True)
pdf.table_row(['Filtration', 'oil_filter_oem', '15400-RTA-003', 'Honda format'], widths2)
pdf.table_row(['Filtration', 'engine_air_filter_oem', '17220-5AA-A00', 'Honda format'], widths2)
pdf.table_row(['Filtration', 'cabin_air_filter_oem', '80292-TBA-A11', 'Honda format'], widths2)
pdf.table_row(['Brakes', 'front/rear_brake_pad_oem', '45022-TBA-A01', 'Year-critical'], widths2)
pdf.table_row(['Brakes', 'front/rear_brake_rotor_oem', '45251-TBA-A02', 'Year-critical'], widths2)
pdf.table_row(['Engine', 'spark_plug_oem', '12290-R70-A01', 'With qty + gap'], widths2)
pdf.table_row(['Drive', 'serpentine_belt_oem', '31110-RBB-006', 'If applicable'], widths2)
pdf.table_row(['Gasket', 'oil_drain_plug_gasket', '94109-14000', 'Small but key'], widths2)

pdf.ln(3)
pdf.subsection_title('Trim Specs Also Extracted')
pdf.bullet('Tire sizes (front/rear), recommended pressure (PSI)')
pdf.bullet('Lug nut torque (ft-lbs), wiper blade sizes')

# ============================================================
# SLIDE 9: VALIDATION
# ============================================================
pdf.add_page()
pdf.section_title('7. Year-Pinning & Part Validation (Layer 3)')

pdf.subsection_title('The Problem This Solves')
pdf.body_text(
    'AI models can confidently return the WRONG year\'s part number. A 2016 CR-V and 2017 CR-V may '
    'share the same engine but use different brake rotors due to a mid-generation change. Without '
    'validation, wrong parts get cached and quoted to customers.'
)

pdf.subsection_title('validateOEMPart() - Two-Check System')
pdf.ln(2)

pdf.subsubsection_title('Check 1: Part Number Format Validation')
pdf.body_text('Per-make regex patterns catch obviously wrong part numbers:')
pdf.code_block(
    'Honda:      XX-XXXXXX-XX  or  XXXXXXXX-XXX\n'
    'Toyota:     XXXXX-XXXXX   or  XXXXXXXXXX\n'
    'BMW:        XX X X XXX XXX or XXXXXXXXXXX\n'
    'Mercedes:   XXXXXXXXXX (3 letters + 8 digits)\n'
    'Ford:       XXXX-XXXXXX   variants\n'
    'Hyundai/Kia: XXXXX-XXXXX\n'
    'VW/Audi:    XXX XXX XXXX\n'
    '+ 8 more OEM patterns | Length: 4-24 chars'
)

pdf.subsubsection_title('Check 2: Year-Mismatch Detection (The Core Innovation)')
pdf.body_text(
    'After format passes, the system checks if this exact part number is already in the database '
    'mapped to a DIFFERENT year of the SAME model:'
)
pdf.code_block(
    'getOtherEnginesWithPartNumber(partNumber, excludeEngineId)\n'
    '\n'
    'For each existing fitment:\n'
    '  if (fitment.model_name === currentModel \n'
    '      && fitment.year_start !== currentYear) {\n'
    '    return { valid: false, flag: "year_mismatch" }\n'
    '  }'
)

pdf.body_text(
    'When validation fails, the part number is stored as "N/A" instead. This prevents the exact bug '
    'where a 2017 part gets applied to a 2016 vehicle. Over time, as more vehicles flow through, '
    'the cross-reference database grows and catches more mismatches.'
)

pdf.subsection_title('Validation Flow')
pdf.code_block(
    'AI returns part -> validatePartNumberFormat(partNum, make)\n'
    '  |-> FAIL -> store as "N/A"\n'
    '  |-> PASS -> getOtherEnginesWithPartNumber(partNum)\n'
    '      |-> year_mismatch found -> store as "N/A"\n'
    '      |-> PASS -> save to vehicle_specs'
)

# ============================================================
# SLIDE 10: GAP FILL
# ============================================================
pdf.add_page()
pdf.section_title('8. Gap Fill: Sibling Cross-Reference + AI Retry')

pdf.subsection_title('When It Triggers')
pdf.body_text(
    'After Call 1B, the pipeline checks for fields with confidence < 0.70 or null values. '
    'These are the "gaps" that need filling.'
)

pdf.subsection_title('Step 1: Sibling Cross-Reference')
pdf.body_text(
    'For engine-shared parts (same engine code = same parts), the pipeline looks up other '
    'vehicles in the database with the same engine_code and copies verified values.'
)
pdf.subsubsection_title('Cross-Reference Safe Fields (7 fields):')
pdf.bullet('oil_filter_oem, oil_drain_plug_gasket_oem, engine_air_filter_oem')
pdf.bullet('spark_plug_oem, spark_plug_quantity, spark_plug_gap_mm')
pdf.bullet('serpentine_belt_oem')
pdf.body_text(
    'These fields are safe to cross-reference because they depend on the ENGINE, not the trim/year. '
    'Brake parts, cabin filters, etc. are NOT cross-referenced because they vary by body/trim.'
)
pdf.body_text('Cross-referenced values get confidence: 0.80, source: "cross_ref_engine_{id}"')

pdf.ln(3)
pdf.subsection_title('Step 2: Targeted AI Retry')
pdf.body_text(
    'For remaining gaps (max 8 fields), a focused Claude call with 5 web searches tries to fill '
    'specific missing data. Only accepts results with confidence >= 0.60.'
)
pdf.subsubsection_title('Generation-Aware Search:')
pdf.body_text('The gap fill prompt includes model generation ranges for smarter search context:')
pdf.code_block(
    'Honda CR-V:    [2012-2016], [2017-2022], [2023-2027]\n'
    'Honda Accord:  [2013-2017], [2018-2022], [2023-2027]\n'
    'Toyota Camry:  [2012-2017], [2018-2024], [2025-2027]\n'
    'BMW 3 Series:  [2012-2018], [2019-2027]\n'
    'BMW 5 Series:  [2011-2016], [2017-2023], [2024-2027]\n'
    'Other models:  year-2 to year+2 (default range)'
)

# ============================================================
# SLIDE 11: SERVICE PRICING
# ============================================================
pdf.add_page()
pdf.section_title('9. Call 2: Service Pricing Intelligence')

pdf.subsection_title('Purpose')
pdf.body_text(
    'Generate per-service pricing estimates for THIS specific vehicle, using known specs, '
    'OEM part numbers for MSRP lookups, and web research. This powers the booking price quotes.'
)

pdf.subsection_title('Context Fed to AI')
pdf.bullet('Vehicle description (year, make, model, trim, engine)')
pdf.bullet('Known oil viscosity + capacity from Call 1A')
pdf.bullet('Vehicle attributes (power steering type, timing system, turbo, drivetrain)')
pdf.bullet('All verified OEM part numbers from Call 1B (for MSRP web search)')
pdf.bullet('Full service catalog from listAllServices (slug, name, default_labor_hours)')

pdf.ln(3)
pdf.subsection_title('Service Applicability Rules')
pdf.body_text('The prompt automatically marks services as N/A based on vehicle attributes:')
pdf.bullet('Power steering flush -> electric PS -> is_applicable: false')
pdf.bullet('Differential service -> FWD vehicle -> is_applicable: false')
pdf.bullet('Timing belt replacement -> timing chain -> is_applicable: false')

pdf.ln(3)
pdf.subsection_title('Source Rules')
pdf.bold_bullet('ALLOWED:', ' Dealer parts sites, OEM catalogs, major retailers, reputable shop menus')
pdf.bold_bullet('BLOCKED:', ' RepairPal, forums as primary source')

pdf.ln(3)
pdf.subsection_title('Fallback Ladder')
pdf.body_text('When exact trim data is unavailable:')
pdf.bullet('Level 1: Exact vehicle/trim match')
pdf.bullet('Level 2: Same generation/platform')
pdf.bullet('Level 3: Same engine code in closest model')
pdf.bullet('Level 4: Generic luxury/performance estimate (widest ranges)')

pdf.ln(3)
pdf.subsection_title('Per-Service Output')
pdf.code_block(
    '{\n'
    '  "slug": "oil-change",\n'
    '  "is_applicable": true,\n'
    '  "labor_hours": 0.5,\n'
    '  "parts_cost_low": 35,\n'
    '  "parts_cost_high": 55,\n'
    '  "confidence_score": 0.85,\n'
    '  "parts_list": [{ "item": "oil filter", "qty": 1, "price_low": 8, "price_high": 12 }],\n'
    '  "tech_notes": "Uses 0W-20 full synthetic, 4.4 qts",\n'
    '  "sources": ["hondapartsnow.com", "autozone.com"]\n'
    '}'
)

# ============================================================
# SLIDE 12: DATA SCHEMA
# ============================================================
pdf.add_page()
pdf.section_title('10. Data Schema & Storage Architecture')

pdf.subsection_title('Vehicle Intelligence Tables')
widths3 = [45, 45, 55, 45]
pdf.table_row(['Table', 'Written By', 'Key Fields', 'Purpose'], widths3, bold=True)
pdf.table_row(['makes', 'NHTSA Stage', 'name', 'Brand catalog'], widths3)
pdf.table_row(['models', 'NHTSA Stage', 'make_id, name', 'Model catalog'], widths3)
pdf.table_row(['trims', 'NHTSA Stage', 'model_id, name, year', 'Trim catalog'], widths3)
pdf.table_row(['engines', 'NHTSA Stage', 'trim_id, engine_code', 'Engine catalog'], widths3)
pdf.table_row(['chassis_variants', 'AI Normal.', 'drivetrain, confidence', 'AWD/FWD/RWD'], widths3)
pdf.table_row(['engine_specs', 'Call 1A', 'fluids, intervals, attrs', 'Maintenance data'], widths3)
pdf.table_row(['vehicle_specs', 'Call 1B', '10 OEM part columns', 'Part numbers'], widths3)
pdf.table_row(['trim_specs', 'Call 1B', 'tires, wipers, lug torque', 'Trim-specific'], widths3)
pdf.table_row(['service_vehicle_specs', 'Call 2', 'labor, parts cost, conf.', 'Per-service pricing'], widths3)
pdf.table_row(['ai_enrichment_logs', 'All Calls', 'confidence, review_status', 'Audit trail'], widths3)
pdf.table_row(['manual_review_queue', 'Pipeline', 'low-confidence items', 'Human review'], widths3)
pdf.table_row(['oem_parts', 'Fitments', 'oem_part_number (unique)', 'Part catalog'], widths3)
pdf.table_row(['engine_part_fitments', 'Fitments', 'engine->part, confidence', 'Fitment map'], widths3)

pdf.ln(5)
pdf.subsection_title('Data Flow')
pdf.code_block(
    'VIN -> NHTSA -> makes/models/trims/engines/chassis_variants\n'
    '    -> Call 1A -> engine_specs (fluids + intervals + attributes)\n'
    '    -> Call 1B -> vehicle_specs (OEM parts) + trim_specs\n'
    '    -> Validate -> N/A for bad parts | save verified parts\n'
    '    -> Gap Fill -> update vehicle_specs with siblings/AI\n'
    '    -> Call 2  -> service_vehicle_specs (per-service pricing)\n'
    '    -> Log     -> ai_enrichment_logs (audit trail)'
)

# ============================================================
# SLIDE 13: CONFIDENCE & REVIEW
# ============================================================
pdf.add_page()
pdf.section_title('11. Confidence Scoring & Review System')

pdf.subsection_title('Multi-Level Confidence')
pdf.body_text(
    'Confidence scores exist at three levels: per-field (Call 1B), per-call (Call 1A), '
    'and per-service (Call 2). This enables granular trust decisions.'
)

pdf.subsubsection_title('Call 1B - Per-Field Confidence:')
pdf.bullet('0.90+ = OEM catalog confirmed for exact year')
pdf.bullet('0.70-0.89 = Cross-referenced from reliable source')
pdf.bullet('0.50-0.69 = Same engine/platform (year-specific unverified)')
pdf.bullet('<0.50 = Unverified - auto-flagged for review')

pdf.ln(3)
pdf.subsubsection_title('Call 2 - Service Pricing Confidence:')
pdf.bullet('0.90+ = Both labor AND parts supported by web sources')
pdf.bullet('0.70-0.89 = One of labor/parts inferred via fallback ladder')
pdf.bullet('<0.70 = Mostly estimated (must explain in tech_notes)')

pdf.ln(3)
pdf.subsection_title('Auto-Approval Routing')
pdf.body_text('The logServiceEnrichment mutation routes items automatically:')
pdf.code_block(
    'if (confidence >= 0.70) -> review_status: "approved"  (auto-approved)\n'
    'if (confidence <  0.70) -> review_status: "pending"   (needs human review)'
)

pdf.subsection_title('Self-Improving Cache')
pdf.body_text(
    'The system improves over time through three mechanisms:'
)
pdf.bullet('Sibling cross-reference: Parts verified for one engine benefit all vehicles with same engine')
pdf.bullet('Year-mismatch detection: Each new vehicle adds to the cross-reference database')
pdf.bullet('Shop confirmations: When a real job completes, the shop confirms the correct part, growing the verified cache')

# ============================================================
# SLIDE 14: FIVE IMPROVEMENTS
# ============================================================
pdf.add_page()
pdf.section_title('12. Five Key Improvements Over Previous Code')

pdf.subsection_title('1. Structured Intervals (Call 1A)')
pdf.body_text(
    'Before: "7,500 miles or 12 months" (string that needs runtime parsing). '
    'After: oil_change_interval_miles: 7500 + oil_change_interval_months: 12 + '
    'oil_change_interval_status: "scheduled". Eliminates all string parsing.'
)

pdf.subsection_title('2. Vehicle Attributes Drive Applicability (Call 1A -> Call 2)')
pdf.body_text(
    'Before: Every service shown to every vehicle. After: Vehicle attributes (power_steering_type, '
    'timing_system) automatically mark non-applicable services. Electric PS vehicles skip PS flush. '
    'Chain engines skip timing belt replacement.'
)

pdf.subsection_title('3. Year-Pinned Part Numbers (Call 1B)')
pdf.body_text(
    'Before: AI returned part numbers without year verification. After: Aggressive year-pinning in '
    'the prompt forces AI to self-flag uncertainty. Parts unverified for the specific year get '
    'confidence <= 0.5 instead of confident wrong answers.'
)

pdf.subsection_title('4. Part Validation Layer (Post-Call 1B)')
pdf.body_text(
    'Before: AI output was trusted directly. After: Two-check validation catches format errors '
    '(per-make regex) and year mismatches (cross-reference against existing database). Bad parts '
    'stored as "N/A" instead of wrong numbers.'
)

pdf.subsection_title('5. Sibling Cross-Reference (Gap Fill)')
pdf.body_text(
    'Before: Missing data stayed missing. After: Engine-shared parts (oil filter, spark plugs, etc.) '
    'are automatically inherited from sibling vehicles with the same engine code. 7 "safe" fields '
    'can be cross-referenced at 0.80 confidence.'
)

# ============================================================
# SLIDE 15: PRACTICAL FLOW
# ============================================================
pdf.add_page()
pdf.section_title('13. Practical Flow Summary')

pdf.subsection_title('Complete Flow: User Books Service for 2016 CR-V')
pdf.ln(3)

steps = [
    ('1. Cache Check', 'Check engine_part_fitments for verified parts. CACHE HIT = done, skip enrichment.'),
    ('2. Cache Miss', 'Trigger AI enrichment with year-pinned prompt for 2016 specifically.'),
    ('3. AI Returns Parts', 'Claude searches web, returns parts with per-field confidence scores.'),
    ('4. Format Validation', 'Check Honda part format (XX-XXXXXX-XX). Reject malformed numbers.'),
    ('5. Year-Mismatch Check', 'Cross-reference against database. If part already mapped to 2017 CR-V, reject.'),
    ('6. Pass Validation', 'Save to oem_parts + vehicle_specs as unverified with confidence score.'),
    ('7. Fail Validation', 'Flag for human review, use fallback pricing from vehicle class estimates.'),
    ('8. Human Reviews', 'Admin reviews flagged parts in manual_review_queue. Verified = trusted cache.'),
    ('9. Shop Completes Job', 'Mechanic confirms correct part was used. Confidence grows organically.'),
    ('10. Next 2016 CR-V', 'Cache hit! Verified parts served instantly, no AI call needed.'),
]

for step_title, step_desc in steps:
    pdf.page_break_check(15)
    pdf.set_font('Helvetica', 'B', 10)
    pdf.set_text_color(82, 153, 254)
    pdf.cell(50, 7, step_title, 0, 0)
    pdf.set_font('Helvetica', '', 10)
    pdf.set_text_color(40, 40, 40)
    pdf.multi_cell(0, 7, step_desc)
    pdf.ln(2)

pdf.ln(5)
pdf.subsection_title('The Flywheel Effect')
pdf.body_text(
    'Each vehicle that flows through the pipeline makes the system smarter. Verified parts become '
    'cache hits for identical vehicles. Sibling cross-references fill gaps for related vehicles. '
    'Year-mismatch detection catches more errors as the database grows. This means the AI enrichment '
    'cost per vehicle approaches $0 over time as the cache fills.'
)

# ============================================================
# SLIDE 16: STATUS & NEXT STEPS
# ============================================================
pdf.add_page()
pdf.section_title('14. Implementation Status & Next Steps')

pdf.subsection_title('What Is Done (Shipped)')
pdf.bullet('Full pipeline wired: VIN path + Smartcar path both trigger AI enrichment')
pdf.bullet('All 4 Claude calls implemented (1A fluids, 1B parts, gap fill, Call 2 pricing)')
pdf.bullet('Year-pinning rule in AI prompts')
pdf.bullet('validateOEMPart with format validation (13 OEM patterns) + year-mismatch detection')
pdf.bullet('Sibling cross-reference for 7 engine-shared fields')
pdf.bullet('Re-enrichment guard (idempotent, won\'t re-run)')
pdf.bullet('ai_enrichment_logs, manual_review_queue tables exist in schema')
pdf.bullet('Confidence-based auto-approval routing (>= 0.70 = approved)')
pdf.bullet('Structured intervals with status enums')
pdf.bullet('Vehicle attributes driving service applicability')
pdf.bullet('NHTSA AI normalization for model/trim/drivetrain correction')

pdf.ln(3)
pdf.subsection_title('What Is Half-Done')
pdf.bullet('Seed/demo data for vehicle intelligence tables (needed to unblock UI testing)')
pdf.bullet('Manual add-car-info path does not call Convex for specs yet')

pdf.ln(3)
pdf.subsection_title('Future Enhancements (Post-MVP)')
pdf.bullet('PartsTech / PartsLogic API integration for real-time dealer pricing')
pdf.bullet('Show getFullVehicleSpecPack(vin) and confidence scores in the app UI')
pdf.bullet('OEM supersession number tracking (part number evolution)')
pdf.bullet('Full analytics/funnel tracking for enrichment success rates')
pdf.bullet('Subscription tiers with different enrichment depths')

# ============================================================
# SLIDE 17: KEY FUNCTIONS REFERENCE
# ============================================================
pdf.add_page()
pdf.section_title('Appendix: Key Functions Reference')

pdf.ln(3)
funcs = [
    ('enrichVehicleSpecs', 'vehicle_pipeline.ts', 'Top-level AI enrichment orchestrator'),
    ('processVin', 'vehicle_pipeline.ts', 'NHTSA VIN decode + catalog upserts'),
    ('normalizeNhtsaWithClaude', 'vehicle_pipeline.ts', 'Claude normalization of model/trim/drivetrain'),
    ('inferEngineCodeFromVehicle', 'vehicle_pipeline.ts', 'Claude inference of OEM engine code'),
    ('buildFluidsPrompt', 'vehicle_pipeline.ts', 'Constructs Call 1A prompt'),
    ('buildPartsPrompt', 'vehicle_pipeline.ts', 'Constructs Call 1B prompt (year-pinned)'),
    ('buildGapFillPrompt', 'vehicle_pipeline.ts', 'Constructs gap fill prompt'),
    ('validateOEMPart', 'vehicle_pipeline.ts', 'Year-mismatch + format validation'),
    ('validatePartNumberFormat', 'vehicle_pipeline.ts', 'Per-make regex format check'),
    ('crossReferenceFromSiblings', 'vehicle_pipeline.ts', 'Sibling engine cross-reference'),
    ('flattenPerFieldSpecs', 'vehicle_pipeline.ts', 'Extract flat values + confidence scores'),
    ('extractJsonFromContentBlocks', 'vehicle_pipeline.ts', 'Parse JSON from Claude response'),
    ('fetchAnthropicWithRetry', 'vehicle_pipeline.ts', 'HTTP call with 429 retry (60s, 2x)'),
    ('getGenerationRange', 'vehicle_pipeline.ts', 'Model generation year ranges'),
    ('upsertServiceVehicleSpec', 'vehicle_mutations.ts', 'Idempotent service pricing upsert'),
    ('logServiceEnrichment', 'vehicle_mutations.ts', 'Audit log with auto-approve >= 0.7'),
    ('getOtherEnginesWithPartNumber', 'vehicle_mutations.ts', 'Year-mismatch detection query'),
]

widths4 = [55, 50, 85]
pdf.table_row(['Function', 'File', 'Purpose'], widths4, bold=True)
for fname, ffile, fpurp in funcs:
    pdf.table_row([fname, ffile, fpurp], widths4)

# ============================================================
# SAVE
# ============================================================
output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'AI_Enrichment_Pipeline.pdf')
output_path = os.path.normpath(output_path)
pdf.output(output_path)
print(f"PDF generated: {output_path}")
print(f"Pages: {pdf.page_no()}")
