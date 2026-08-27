// Seed exercise list used to pre-populate the local database on first launch.
// Names/categories/equipment are generic exercise facts; the curation approach
// (categorized by muscle group + equipment) is inspired by the wger project's
// open exercise database (github.com/wger-project/wger), CC BY-SA 3.0.
// You can add, edit, or remove exercises freely from the Exercises tab —
// this list only seeds the initial local database.
//
// `romMeters` is an estimated range-of-motion in meters for strength/
// bodyweight moves — used to turn weight×reps into a physics-based point
// score. It's a rough approximation, not a biomechanical measurement.
// Cardio-modality exercises (time/distance based) leave it `null` since
// their score comes from a different formula.

const SEED_EXERCISES = [
  // Chest
  { name: "Barbell Bench Press", category: "Chest", equipment: "Barbell", modality: "strength", romMeters: 0.45 },
  { name: "Incline Barbell Bench Press", category: "Chest", equipment: "Barbell", modality: "strength", romMeters: 0.42 },
  { name: "Decline Barbell Bench Press", category: "Chest", equipment: "Barbell", modality: "strength", romMeters: 0.4 },
  { name: "Dumbbell Bench Press", category: "Chest", equipment: "Dumbbell", modality: "strength", romMeters: 0.5 },
  { name: "Incline Dumbbell Press", category: "Chest", equipment: "Dumbbell", modality: "strength", romMeters: 0.48 },
  { name: "Dumbbell Fly", category: "Chest", equipment: "Dumbbell", modality: "strength", romMeters: 0.5 },
  { name: "Cable Crossover", category: "Chest", equipment: "Cable", modality: "strength", romMeters: 0.5 },
  { name: "Chest Press Machine", category: "Chest", equipment: "Machine", modality: "strength", romMeters: 0.4 },
  { name: "Pec Deck", category: "Chest", equipment: "Machine", modality: "strength", romMeters: 0.35 },
  { name: "Push-Up", category: "Chest", equipment: "Bodyweight", modality: "strength", romMeters: 0.3 },
  { name: "Dips (Chest Focus)", category: "Chest", equipment: "Bodyweight", modality: "strength", romMeters: 0.4 },

  // Back
  { name: "Deadlift", category: "Back", equipment: "Barbell", modality: "strength", romMeters: 0.6 },
  { name: "Barbell Row", category: "Back", equipment: "Barbell", modality: "strength", romMeters: 0.4 },
  { name: "Pendlay Row", category: "Back", equipment: "Barbell", modality: "strength", romMeters: 0.35 },
  { name: "T-Bar Row", category: "Back", equipment: "Barbell", modality: "strength", romMeters: 0.4 },
  { name: "Dumbbell Row", category: "Back", equipment: "Dumbbell", modality: "strength", romMeters: 0.35 },
  { name: "Lat Pulldown", category: "Back", equipment: "Cable", modality: "strength", romMeters: 0.5 },
  { name: "Seated Cable Row", category: "Back", equipment: "Cable", modality: "strength", romMeters: 0.4 },
  { name: "Straight-Arm Pulldown", category: "Back", equipment: "Cable", modality: "strength", romMeters: 0.4 },
  { name: "Pull-Up", category: "Back", equipment: "Bodyweight", modality: "strength", romMeters: 0.5 },
  { name: "Chin-Up", category: "Back", equipment: "Bodyweight", modality: "strength", romMeters: 0.5 },
  { name: "Inverted Row", category: "Back", equipment: "Bodyweight", modality: "strength", romMeters: 0.35 },
  { name: "Hyperextension", category: "Back", equipment: "Bodyweight", modality: "strength", romMeters: 0.4 },

  // Legs
  { name: "Back Squat", category: "Legs", equipment: "Barbell", modality: "strength", romMeters: 0.55 },
  { name: "Front Squat", category: "Legs", equipment: "Barbell", modality: "strength", romMeters: 0.55 },
  { name: "Romanian Deadlift", category: "Legs", equipment: "Barbell", modality: "strength", romMeters: 0.4 },
  { name: "Barbell Hip Thrust", category: "Legs", equipment: "Barbell", modality: "strength", romMeters: 0.35 },
  { name: "Bulgarian Split Squat", category: "Legs", equipment: "Dumbbell", modality: "strength", romMeters: 0.45 },
  { name: "Walking Lunge", category: "Legs", equipment: "Dumbbell", modality: "strength", romMeters: 0.45 },
  { name: "Goblet Squat", category: "Legs", equipment: "Dumbbell", modality: "strength", romMeters: 0.45 },
  { name: "Leg Press", category: "Legs", equipment: "Machine", modality: "strength", romMeters: 0.4 },
  { name: "Leg Extension", category: "Legs", equipment: "Machine", modality: "strength", romMeters: 0.4 },
  { name: "Leg Curl", category: "Legs", equipment: "Machine", modality: "strength", romMeters: 0.4 },
  { name: "Hip Abductor Machine", category: "Legs", equipment: "Machine", modality: "strength", romMeters: 0.3 },
  { name: "Standing Calf Raise", category: "Legs", equipment: "Machine", modality: "strength", romMeters: 0.1 },
  { name: "Seated Calf Raise", category: "Legs", equipment: "Machine", modality: "strength", romMeters: 0.1 },
  { name: "Bodyweight Squat", category: "Legs", equipment: "Bodyweight", modality: "strength", romMeters: 0.45 },
  { name: "Glute Bridge", category: "Legs", equipment: "Bodyweight", modality: "strength", romMeters: 0.3 },
  { name: "Kettlebell Swing", category: "Legs", equipment: "Kettlebell", modality: "strength", romMeters: 0.5 },
  { name: "Kettlebell Goblet Squat", category: "Legs", equipment: "Kettlebell", modality: "strength", romMeters: 0.45 },

  // Shoulders
  { name: "Overhead Press", category: "Shoulders", equipment: "Barbell", modality: "strength", romMeters: 0.45 },
  { name: "Push Press", category: "Shoulders", equipment: "Barbell", modality: "strength", romMeters: 0.45 },
  { name: "Dumbbell Shoulder Press", category: "Shoulders", equipment: "Dumbbell", modality: "strength", romMeters: 0.4 },
  { name: "Arnold Press", category: "Shoulders", equipment: "Dumbbell", modality: "strength", romMeters: 0.4 },
  { name: "Lateral Raise", category: "Shoulders", equipment: "Dumbbell", modality: "strength", romMeters: 0.4 },
  { name: "Front Raise", category: "Shoulders", equipment: "Dumbbell", modality: "strength", romMeters: 0.4 },
  { name: "Rear Delt Fly", category: "Shoulders", equipment: "Dumbbell", modality: "strength", romMeters: 0.4 },
  { name: "Cable Lateral Raise", category: "Shoulders", equipment: "Cable", modality: "strength", romMeters: 0.4 },
  { name: "Face Pull", category: "Shoulders", equipment: "Cable", modality: "strength", romMeters: 0.3 },
  { name: "Shoulder Press Machine", category: "Shoulders", equipment: "Machine", modality: "strength", romMeters: 0.4 },
  { name: "Pike Push-Up", category: "Shoulders", equipment: "Bodyweight", modality: "strength", romMeters: 0.3 },

  // Arms - Biceps
  { name: "Barbell Curl", category: "Arms", equipment: "Barbell", modality: "strength", romMeters: 0.35 },
  { name: "EZ-Bar Curl", category: "Arms", equipment: "Barbell", modality: "strength", romMeters: 0.35 },
  { name: "Dumbbell Curl", category: "Arms", equipment: "Dumbbell", modality: "strength", romMeters: 0.35 },
  { name: "Hammer Curl", category: "Arms", equipment: "Dumbbell", modality: "strength", romMeters: 0.35 },
  { name: "Incline Dumbbell Curl", category: "Arms", equipment: "Dumbbell", modality: "strength", romMeters: 0.4 },
  { name: "Concentration Curl", category: "Arms", equipment: "Dumbbell", modality: "strength", romMeters: 0.35 },
  { name: "Cable Curl", category: "Arms", equipment: "Cable", modality: "strength", romMeters: 0.35 },
  { name: "Preacher Curl", category: "Arms", equipment: "Machine", modality: "strength", romMeters: 0.3 },

  // Arms - Triceps
  { name: "Close-Grip Bench Press", category: "Arms", equipment: "Barbell", modality: "strength", romMeters: 0.4 },
  { name: "Skull Crusher", category: "Arms", equipment: "Barbell", modality: "strength", romMeters: 0.3 },
  { name: "Overhead Triceps Extension", category: "Arms", equipment: "Dumbbell", modality: "strength", romMeters: 0.35 },
  { name: "Triceps Kickback", category: "Arms", equipment: "Dumbbell", modality: "strength", romMeters: 0.25 },
  { name: "Cable Triceps Pushdown", category: "Arms", equipment: "Cable", modality: "strength", romMeters: 0.3 },
  { name: "Rope Pushdown", category: "Arms", equipment: "Cable", modality: "strength", romMeters: 0.3 },
  { name: "Dips (Triceps Focus)", category: "Arms", equipment: "Bodyweight", modality: "strength", romMeters: 0.4 },
  { name: "Diamond Push-Up", category: "Arms", equipment: "Bodyweight", modality: "strength", romMeters: 0.3 },

  // Core
  { name: "Plank", category: "Core", equipment: "Bodyweight", modality: "cardio", romMeters: null },
  { name: "Side Plank", category: "Core", equipment: "Bodyweight", modality: "cardio", romMeters: null },
  { name: "Crunch", category: "Core", equipment: "Bodyweight", modality: "strength", romMeters: 0.25 },
  { name: "Bicycle Crunch", category: "Core", equipment: "Bodyweight", modality: "strength", romMeters: 0.3 },
  { name: "Sit-Up", category: "Core", equipment: "Bodyweight", modality: "strength", romMeters: 0.4 },
  { name: "Hanging Leg Raise", category: "Core", equipment: "Bodyweight", modality: "strength", romMeters: 0.5 },
  { name: "Mountain Climber", category: "Core", equipment: "Bodyweight", modality: "strength", romMeters: 0.3 },
  { name: "Russian Twist", category: "Core", equipment: "Bodyweight", modality: "strength", romMeters: 0.3 },
  { name: "Ab Wheel Rollout", category: "Core", equipment: "Bodyweight", modality: "strength", romMeters: 0.5 },
  { name: "Cable Woodchopper", category: "Core", equipment: "Cable", modality: "strength", romMeters: 0.5 },
  { name: "Weighted Sit-Up", category: "Core", equipment: "Dumbbell", modality: "strength", romMeters: 0.4 },

  // Olympic / Full Body
  { name: "Clean and Jerk", category: "Full Body", equipment: "Barbell", modality: "strength", romMeters: 0.7 },
  { name: "Power Clean", category: "Full Body", equipment: "Barbell", modality: "strength", romMeters: 0.65 },
  { name: "Snatch", category: "Full Body", equipment: "Barbell", modality: "strength", romMeters: 0.75 },
  { name: "Thruster", category: "Full Body", equipment: "Barbell", modality: "strength", romMeters: 0.6 },
  { name: "Kettlebell Clean and Press", category: "Full Body", equipment: "Kettlebell", modality: "strength", romMeters: 0.6 },
  { name: "Burpee", category: "Full Body", equipment: "Bodyweight", modality: "strength", romMeters: 0.6 },
  { name: "Farmer's Carry", category: "Full Body", equipment: "Dumbbell", modality: "cardio", romMeters: null },

  // Cardio
  { name: "Running", category: "Cardio", equipment: "None", modality: "cardio", romMeters: null },
  { name: "Cycling", category: "Cardio", equipment: "None", modality: "cardio", romMeters: null },
  { name: "Rowing Machine", category: "Cardio", equipment: "Machine", modality: "cardio", romMeters: null },
  { name: "Stair Climber", category: "Cardio", equipment: "Machine", modality: "cardio", romMeters: null },
  { name: "Jump Rope", category: "Cardio", equipment: "Bodyweight", modality: "cardio", romMeters: null },
  { name: "Elliptical", category: "Cardio", equipment: "Machine", modality: "cardio", romMeters: null },
  { name: "Swimming", category: "Cardio", equipment: "None", modality: "cardio", romMeters: null },

  // Bands
  { name: "Band Pull-Apart", category: "Shoulders", equipment: "Bands", modality: "strength", romMeters: 0.3 },
  { name: "Band Face Pull", category: "Shoulders", equipment: "Bands", modality: "strength", romMeters: 0.3 },
  { name: "Band Squat", category: "Legs", equipment: "Bands", modality: "strength", romMeters: 0.45 },
  { name: "Band Row", category: "Back", equipment: "Bands", modality: "strength", romMeters: 0.4 },
];
