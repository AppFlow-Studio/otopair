import { mutation } from "./_generated/server";

interface QuestionDef {
  question_text: string;
  rank: number;
  step_name: string;
  question_type: string;
  display_order: number;
  answers?: { answer_text: string; answer_value: string; display_order: number; emoji?: string }[];
}

const QUESTIONS: QuestionDef[] = [
  {
    question_text: "What do you want to use Otopair for?",
    rank: 0,
    step_name: "userIntent",
    question_type: "multi_select",
    display_order: 0,
    answers: [
      { answer_text: "Education / Learn about my car", answer_value: "education", display_order: 1 },
      { answer_text: "Find a shop", answer_value: "find_shop", display_order: 2 },
      { answer_text: "Understand car maintenance", answer_value: "understand_maintenance", display_order: 3 },
      { answer_text: "Track vehicle health", answer_value: "track_vehicle_health", display_order: 4 },
      { answer_text: "Maintenance reminders", answer_value: "maintenance_reminders", display_order: 5 },
      { answer_text: "Diagnose car issues", answer_value: "diagnose_issues", display_order: 6 },
      { answer_text: "Save money on repairs", answer_value: "save_money", display_order: 7 },
      { answer_text: "Track service history", answer_value: "service_history", display_order: 8 },
      { answer_text: "Manage car settings", answer_value: "car_settings", display_order: 9 },
      { answer_text: "Improve car performance", answer_value: "improve_performance", display_order: 10 },
    ],
  },
  {
    question_text: "How would you explain your experience with cars in general?",
    rank: 0,
    step_name: "experience",
    question_type: "single_select",
    display_order: 1,
    answers: [
      { answer_text: "I prefer things explained to me", answer_value: "1", display_order: 1, emoji: "🚗" },
      { answer_text: "I know some stuff", answer_value: "2", display_order: 2, emoji: "🔧" },
      { answer_text: "I'm car-savvy", answer_value: "3", display_order: 3, emoji: "🏎️" },
    ],
  },
  {
    question_text: "How often do you drive?",
    rank: 1,
    step_name: "carUsage",
    question_type: "single_select",
    display_order: 2,
    answers: [
      { answer_text: "Rarely (special occasions)", answer_value: "rarely", display_order: 1, emoji: "🚗" },
      { answer_text: "A few times a month", answer_value: "few_times_month", display_order: 2, emoji: "🛒" },
      { answer_text: "A few times a week", answer_value: "few_times_week", display_order: 3, emoji: "🚙" },
      { answer_text: "Daily", answer_value: "daily", display_order: 4, emoji: "🏙️" },
      { answer_text: "For work (Uber/Lyft/deliver, etc.)", answer_value: "for_work", display_order: 5, emoji: "🛣️" },
    ],
  },
  {
    question_text: "Where do you typically take your car?",
    rank: 0,
    step_name: "shopType",
    question_type: "single_select",
    display_order: 3,
    answers: [
      { answer_text: "Dealership", answer_value: "dealership", display_order: 1, emoji: "🏢" },
      { answer_text: "Same independent shop", answer_value: "independent", display_order: 2, emoji: "🛠️" },
      { answer_text: "Different shops each time", answer_value: "different", display_order: 3, emoji: "🔄" },
      { answer_text: "I do it myself", answer_value: "diy", display_order: 4, emoji: "🧰" },
      { answer_text: "Haven't found a reliable place", answer_value: "no_reliable", display_order: 5, emoji: "🔍" },
    ],
  },
  {
    question_text: "What's your biggest frustration with car maintenance?",
    rank: 1,
    step_name: "maintenanceFrustration",
    question_type: "single_select",
    display_order: 4,
    answers: [
      { answer_text: "Finding someone I trust", answer_value: "trust", display_order: 1, emoji: "🤝" },
      { answer_text: "Understanding if prices are fair", answer_value: "pricing", display_order: 2, emoji: "💰" },
      { answer_text: "Fitting it into my schedule", answer_value: "schedule", display_order: 3, emoji: "📅" },
      { answer_text: "Not knowing what my car actually needs", answer_value: "knowledge", display_order: 4, emoji: "❓" },
    ],
  },
  {
    question_text: "How do you decide when it's time for maintenance?",
    rank: 1,
    step_name: "maintenanceApproachLevel1",
    question_type: "single_select",
    display_order: 5,
    answers: [
      { answer_text: "I try to stay ahead of schedule", answer_value: "ahead", display_order: 1, emoji: "🗓️" },
      { answer_text: "I go when something feels off", answer_value: "feels_off", display_order: 2, emoji: "⚠️" },
      { answer_text: "I wait until the dashboard tells me", answer_value: "dashboard", display_order: 3, emoji: "🖥️" },
      { answer_text: "I follow what the shop recommends", answer_value: "shop_recommends", display_order: 4, emoji: "🤝" },
    ],
  },
  {
    question_text: "What matters most to you when choosing a service?",
    rank: 0,
    step_name: "servicePriorities",
    question_type: "multi_select",
    display_order: 6,
    answers: [
      { answer_text: "Quick turnaround time", answer_value: "quick_turnaround_time", display_order: 1, emoji: "⏰" },
      { answer_text: "High-quality service", answer_value: "high_quality_service", display_order: 2, emoji: "🏆" },
      { answer_text: "Convenience/location", answer_value: "convenience_location", display_order: 3, emoji: "📍" },
      { answer_text: "Transparent pricing/no surprises", answer_value: "transparent_pricing", display_order: 4, emoji: "🧾" },
      { answer_text: "Trusted reviews/reputation", answer_value: "trusted_reviews_reputation", display_order: 5, emoji: "⭐" },
    ],
  },
  {
    question_text: "How do you currently track when maintenance is due?",
    rank: 2,
    step_name: "maintenanceTracking",
    question_type: "single_select",
    display_order: 7,
    answers: [
      { answer_text: "Based on my mileage", answer_value: "mileage", display_order: 1, emoji: "📘" },
      { answer_text: "I go when something feels wrong", answer_value: "feels_wrong", display_order: 2, emoji: "🛠️" },
      { answer_text: "I get reminders from my mechanic", answer_value: "mechanic_reminders", display_order: 3, emoji: "📩" },
      { answer_text: "My car reminds me", answer_value: "car_reminders", display_order: 4, emoji: "📅" },
      { answer_text: "I don't really track it", answer_value: "no_tracking", display_order: 5, emoji: "🤷" },
    ],
  },
  {
    question_text: "When you get a repair quote, what's most important to see?",
    rank: 2,
    step_name: "repairQuoteNeeds",
    question_type: "multi_select",
    display_order: 8,
    answers: [
      { answer_text: "Detailed breakdown of costs", answer_value: "cost_breakdown", display_order: 1, emoji: "🧾" },
      { answer_text: "Explanation of what's wrong", answer_value: "explanation", display_order: 2, emoji: "🔍" },
      { answer_text: "How urgent it really is", answer_value: "urgency", display_order: 3, emoji: "⏳" },
      { answer_text: "Alternative options/solutions", answer_value: "alternatives", display_order: 4, emoji: "🧠" },
      { answer_text: "Time it will take", answer_value: "time", display_order: 5, emoji: "🕐" },
    ],
  },
  {
    question_text: "What do you handle yourself?",
    rank: 3,
    step_name: "doItYourself",
    question_type: "multi_select",
    display_order: 9,
    answers: [
      { answer_text: "Oil changes", answer_value: "oil_changes", display_order: 1, emoji: "🛢️" },
      { answer_text: "Brake pad replacement", answer_value: "brakes", display_order: 2, emoji: "🛑" },
      { answer_text: "Air filter replacement", answer_value: "air_filter", display_order: 3, emoji: "💨" },
      { answer_text: "Basic diagnostics", answer_value: "basic_diag", display_order: 4, emoji: "🔍" },
      { answer_text: "Complex diagnostics", answer_value: "complex_diag", display_order: 5, emoji: "💻" },
      { answer_text: "Transmission/engine work", answer_value: "transmission_engine", display_order: 6, emoji: "⚙️" },
      { answer_text: "Electrical issues", answer_value: "electrical", display_order: 7, emoji: "⚡" },
      { answer_text: "Bodywork", answer_value: "bodywork", display_order: 8, emoji: "🛠️" },
      { answer_text: "Everything (I do it all myself)", answer_value: "everything", display_order: 9, emoji: "🔧" },
      { answer_text: "Nothing (I prefer professionals)", answer_value: "nothing", display_order: 10, emoji: "👨‍🔧" },
    ],
  },
  {
    question_text: "How would you describe your maintenance approach?",
    rank: 3,
    step_name: "maintenanceApproachLevel3",
    question_type: "single_select",
    display_order: 10,
    answers: [
      { answer_text: "Preventive: I follow the schedule strictly", answer_value: "preventive", display_order: 1, emoji: "🗓️" },
      { answer_text: "Data-driven: I track everything and service based on actual wear", answer_value: "data_driven", display_order: 2, emoji: "📊" },
      { answer_text: "Problem-solving: I address issues as they come up", answer_value: "problem_solving", display_order: 3, emoji: "🛠️" },
      { answer_text: "Performance-focused: I maintain for optimal performance", answer_value: "performance", display_order: 4, emoji: "🏎️" },
      { answer_text: "Budget-conscious: I do what's necessary when necessary", answer_value: "budget", display_order: 5, emoji: "💰" },
    ],
  },
  {
    question_text: "What's the primary reason you're using Otopair?",
    rank: 3,
    step_name: "primaryReason",
    question_type: "single_select",
    display_order: 11,
    answers: [
      { answer_text: "Scheduled maintenance coming up", answer_value: "scheduled", display_order: 1, emoji: "📅" },
      { answer_text: "Specific repair needed", answer_value: "repair", display_order: 2, emoji: "🔧" },
      { answer_text: "Comparing shops for quality/specialization", answer_value: "comparing", display_order: 3, emoji: "⚖️" },
      { answer_text: "Looking for a shop I can trust long-term", answer_value: "trust", display_order: 4, emoji: "🤝" },
      { answer_text: "Just exploring options", answer_value: "exploring", display_order: 5, emoji: "🔍" },
    ],
  },
  {
    question_text: "When evaluating a shop, which factors matter most?",
    rank: 3,
    step_name: "shopPriorities",
    question_type: "multi_select",
    display_order: 12,
    answers: [
      { answer_text: "Specialization in my make/model", answer_value: "make_specialization", display_order: 1, emoji: "🏎️" },
      { answer_text: "ASE certified technicians", answer_value: "ase_certified", display_order: 2, emoji: "📜" },
      { answer_text: "Quality of parts used (OEM vs aftermarket)", answer_value: "parts_quality", display_order: 3, emoji: "⚙️" },
      { answer_text: "Advanced diagnostic equipment", answer_value: "diagnostic_equip", display_order: 4, emoji: "💻" },
      { answer_text: "Track record with complex repairs", answer_value: "complex_repairs", display_order: 5, emoji: "🛠️" },
      { answer_text: "Transparent labor rates", answer_value: "labor_rates", display_order: 6, emoji: "🧾" },
      { answer_text: "Turnaround time", answer_value: "turnaround_time", display_order: 7, emoji: "⏰" },
    ],
  },
  {
    question_text: "When discussing repairs, you prefer:",
    rank: 3,
    step_name: "communicationPreference",
    question_type: "single_select",
    display_order: 13,
    answers: [
      { answer_text: "Technical details and root cause analysis", answer_value: "technical", display_order: 1, emoji: "🔬" },
      { answer_text: "Balanced explanation with options", answer_value: "balanced", display_order: 2, emoji: "⚖️" },
      { answer_text: "Bottom line: what needs to be done and cost", answer_value: "bottom_line", display_order: 3, emoji: "📉" },
      { answer_text: "Show me (photos, diagnostic reports)", answer_value: "show_me", display_order: 4, emoji: "📸" },
    ],
  },
  {
    question_text: "Anything else Oto should know about your preferences?",
    rank: 3,
    step_name: "additionalPreferences",
    question_type: "text_input",
    display_order: 14,
  },
];

export const seedOnboardingQuestions = mutation({
  args: {},
  handler: async (ctx) => {
    let questionCount = 0;
    let answerCount = 0;

    for (const q of QUESTIONS) {
      // Per-step_name idempotency: skip if this question already exists
      const existing = await ctx.db
        .query("onboarding_questions")
        .filter((qb) => qb.eq(qb.field("step_name"), q.step_name))
        .first();
      if (existing) {
        console.log(`Question for step "${q.step_name}" already exists, skipping`);
        continue;
      }

      const questionId = await ctx.db.insert("onboarding_questions", {
        question_text: q.question_text,
        rank: q.rank,
        step_name: q.step_name,
        question_type: q.question_type,
        display_order: q.display_order,
        is_active: true,
      });
      questionCount++;

      if (q.answers) {
        for (const a of q.answers) {
          await ctx.db.insert("onboarding_question_answers", {
            question_id: questionId,
            answer_text: a.answer_text,
            answer_value: a.answer_value,
            display_order: a.display_order,
            emoji: a.emoji,
          });
          answerCount++;
        }
      }
    }

    return {
      seeded: true,
      message: `Seeded ${questionCount} questions and ${answerCount} answers`,
    };
  },
});

/** Standalone seed for just the userIntent question + answers */
export const seedUserIntentQuestion = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("onboarding_questions")
      .filter((qb) => qb.eq(qb.field("step_name"), "userIntent"))
      .first();
    if (existing) {
      return { seeded: false, message: "userIntent question already exists" };
    }

    const q = QUESTIONS.find((q) => q.step_name === "userIntent")!;
    const questionId = await ctx.db.insert("onboarding_questions", {
      question_text: q.question_text,
      rank: q.rank,
      step_name: q.step_name,
      question_type: q.question_type,
      display_order: q.display_order,
      is_active: true,
    });

    let answerCount = 0;
    if (q.answers) {
      for (const a of q.answers) {
        await ctx.db.insert("onboarding_question_answers", {
          question_id: questionId,
          answer_text: a.answer_text,
          answer_value: a.answer_value,
          display_order: a.display_order,
          emoji: a.emoji,
        });
        answerCount++;
      }
    }

    return {
      seeded: true,
      message: `Seeded userIntent question with ${answerCount} answers`,
    };
  },
});
