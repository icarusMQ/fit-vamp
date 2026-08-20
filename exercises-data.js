// Seed exercise list used to pre-populate the local database on first launch.
// Names/categories/equipment are generic exercise facts; the curation approach
// (categorized by muscle group + equipment) is inspired by the wger project's
// open exercise database (github.com/wger-project/wger), CC BY-SA 3.0.
// You can add, edit, or remove exercises freely from the Exercises tab —
// this list only seeds the initial local database.

const SEED_EXERCISES = [
  // Chest
  { name: "Barbell Bench Press", category: "Chest", equipment: "Barbell" , modality: "strength" },
  { name: "Incline Barbell Bench Press", category: "Chest", equipment: "Barbell" , modality: "strength" },
  { name: "Decline Barbell Bench Press", category: "Chest", equipment: "Barbell" , modality: "strength" },
  { name: "Dumbbell Bench Press", category: "Chest", equipment: "Dumbbell" , modality: "strength" },
  { name: "Incline Dumbbell Press", category: "Chest", equipment: "Dumbbell" , modality: "strength" },
  { name: "Dumbbell Fly", category: "Chest", equipment: "Dumbbell" , modality: "strength" },
  { name: "Cable Crossover", category: "Chest", equipment: "Cable" , modality: "strength" },
  { name: "Chest Press Machine", category: "Chest", equipment: "Machine" , modality: "strength" },
  { name: "Pec Deck", category: "Chest", equipment: "Machine" , modality: "strength" },
  { name: "Push-Up", category: "Chest", equipment: "Bodyweight" , modality: "strength" },
  { name: "Dips (Chest Focus)", category: "Chest", equipment: "Bodyweight" , modality: "strength" },

  // Back
  { name: "Deadlift", category: "Back", equipment: "Barbell" , modality: "strength" },
  { name: "Barbell Row", category: "Back", equipment: "Barbell" , modality: "strength" },
  { name: "Pendlay Row", category: "Back", equipment: "Barbell" , modality: "strength" },
  { name: "T-Bar Row", category: "Back", equipment: "Barbell" , modality: "strength" },
  { name: "Dumbbell Row", category: "Back", equipment: "Dumbbell" , modality: "strength" },
  { name: "Lat Pulldown", category: "Back", equipment: "Cable" , modality: "strength" },
  { name: "Seated Cable Row", category: "Back", equipment: "Cable" , modality: "strength" },
  { name: "Straight-Arm Pulldown", category: "Back", equipment: "Cable" , modality: "strength" },
  { name: "Pull-Up", category: "Back", equipment: "Bodyweight" , modality: "strength" },
  { name: "Chin-Up", category: "Back", equipment: "Bodyweight" , modality: "strength" },
  { name: "Inverted Row", category: "Back", equipment: "Bodyweight" , modality: "strength" },
  { name: "Hyperextension", category: "Back", equipment: "Bodyweight" , modality: "strength" },

  // Legs
  { name: "Back Squat", category: "Legs", equipment: "Barbell" , modality: "strength" },
  { name: "Front Squat", category: "Legs", equipment: "Barbell" , modality: "strength" },
  { name: "Romanian Deadlift", category: "Legs", equipment: "Barbell" , modality: "strength" },
  { name: "Barbell Hip Thrust", category: "Legs", equipment: "Barbell" , modality: "strength" },
  { name: "Bulgarian Split Squat", category: "Legs", equipment: "Dumbbell" , modality: "strength" },
  { name: "Walking Lunge", category: "Legs", equipment: "Dumbbell" , modality: "strength" },
  { name: "Goblet Squat", category: "Legs", equipment: "Dumbbell" , modality: "strength" },
  { name: "Leg Press", category: "Legs", equipment: "Machine" , modality: "strength" },
  { name: "Leg Extension", category: "Legs", equipment: "Machine" , modality: "strength" },
  { name: "Leg Curl", category: "Legs", equipment: "Machine" , modality: "strength" },
  { name: "Hip Abductor Machine", category: "Legs", equipment: "Machine" , modality: "strength" },
  { name: "Standing Calf Raise", category: "Legs", equipment: "Machine" , modality: "strength" },
  { name: "Seated Calf Raise", category: "Legs", equipment: "Machine" , modality: "strength" },
  { name: "Bodyweight Squat", category: "Legs", equipment: "Bodyweight" , modality: "strength" },
  { name: "Glute Bridge", category: "Legs", equipment: "Bodyweight" , modality: "strength" },
  { name: "Kettlebell Swing", category: "Legs", equipment: "Kettlebell" , modality: "strength" },
  { name: "Kettlebell Goblet Squat", category: "Legs", equipment: "Kettlebell" , modality: "strength" },

  // Shoulders
  { name: "Overhead Press", category: "Shoulders", equipment: "Barbell" , modality: "strength" },
  { name: "Push Press", category: "Shoulders", equipment: "Barbell" , modality: "strength" },
  { name: "Dumbbell Shoulder Press", category: "Shoulders", equipment: "Dumbbell" , modality: "strength" },
  { name: "Arnold Press", category: "Shoulders", equipment: "Dumbbell" , modality: "strength" },
  { name: "Lateral Raise", category: "Shoulders", equipment: "Dumbbell" , modality: "strength" },
  { name: "Front Raise", category: "Shoulders", equipment: "Dumbbell" , modality: "strength" },
  { name: "Rear Delt Fly", category: "Shoulders", equipment: "Dumbbell" , modality: "strength" },
  { name: "Cable Lateral Raise", category: "Shoulders", equipment: "Cable" , modality: "strength" },
  { name: "Face Pull", category: "Shoulders", equipment: "Cable" , modality: "strength" },
  { name: "Shoulder Press Machine", category: "Shoulders", equipment: "Machine" , modality: "strength" },
  { name: "Pike Push-Up", category: "Shoulders", equipment: "Bodyweight" , modality: "strength" },

  // Arms - Biceps
  { name: "Barbell Curl", category: "Arms", equipment: "Barbell" , modality: "strength" },
  { name: "EZ-Bar Curl", category: "Arms", equipment: "Barbell" , modality: "strength" },
  { name: "Dumbbell Curl", category: "Arms", equipment: "Dumbbell" , modality: "strength" },
  { name: "Hammer Curl", category: "Arms", equipment: "Dumbbell" , modality: "strength" },
  { name: "Incline Dumbbell Curl", category: "Arms", equipment: "Dumbbell" , modality: "strength" },
  { name: "Concentration Curl", category: "Arms", equipment: "Dumbbell" , modality: "strength" },
  { name: "Cable Curl", category: "Arms", equipment: "Cable" , modality: "strength" },
  { name: "Preacher Curl", category: "Arms", equipment: "Machine" , modality: "strength" },

  // Arms - Triceps
  { name: "Close-Grip Bench Press", category: "Arms", equipment: "Barbell" , modality: "strength" },
  { name: "Skull Crusher", category: "Arms", equipment: "Barbell" , modality: "strength" },
  { name: "Overhead Triceps Extension", category: "Arms", equipment: "Dumbbell" , modality: "strength" },
  { name: "Triceps Kickback", category: "Arms", equipment: "Dumbbell" , modality: "strength" },
  { name: "Cable Triceps Pushdown", category: "Arms", equipment: "Cable" , modality: "strength" },
  { name: "Rope Pushdown", category: "Arms", equipment: "Cable" , modality: "strength" },
  { name: "Dips (Triceps Focus)", category: "Arms", equipment: "Bodyweight" , modality: "strength" },
  { name: "Diamond Push-Up", category: "Arms", equipment: "Bodyweight" , modality: "strength" },

  // Core
  { name: "Plank", category: "Core", equipment: "Bodyweight" , modality: "cardio" },
  { name: "Side Plank", category: "Core", equipment: "Bodyweight" , modality: "cardio" },
  { name: "Crunch", category: "Core", equipment: "Bodyweight" , modality: "strength" },
  { name: "Bicycle Crunch", category: "Core", equipment: "Bodyweight" , modality: "strength" },
  { name: "Sit-Up", category: "Core", equipment: "Bodyweight" , modality: "strength" },
  { name: "Hanging Leg Raise", category: "Core", equipment: "Bodyweight" , modality: "strength" },
  { name: "Mountain Climber", category: "Core", equipment: "Bodyweight" , modality: "strength" },
  { name: "Russian Twist", category: "Core", equipment: "Bodyweight" , modality: "strength" },
  { name: "Ab Wheel Rollout", category: "Core", equipment: "Bodyweight" , modality: "strength" },
  { name: "Cable Woodchopper", category: "Core", equipment: "Cable" , modality: "strength" },
  { name: "Weighted Sit-Up", category: "Core", equipment: "Dumbbell" , modality: "strength" },

  // Olympic / Full Body
  { name: "Clean and Jerk", category: "Full Body", equipment: "Barbell" , modality: "strength" },
  { name: "Power Clean", category: "Full Body", equipment: "Barbell" , modality: "strength" },
  { name: "Snatch", category: "Full Body", equipment: "Barbell" , modality: "strength" },
  { name: "Thruster", category: "Full Body", equipment: "Barbell" , modality: "strength" },
  { name: "Kettlebell Clean and Press", category: "Full Body", equipment: "Kettlebell" , modality: "strength" },
  { name: "Burpee", category: "Full Body", equipment: "Bodyweight" , modality: "strength" },
  { name: "Farmer's Carry", category: "Full Body", equipment: "Dumbbell" , modality: "cardio" },

  // Cardio
  { name: "Running", category: "Cardio", equipment: "None" , modality: "cardio" },
  { name: "Cycling", category: "Cardio", equipment: "None" , modality: "cardio" },
  { name: "Rowing Machine", category: "Cardio", equipment: "Machine" , modality: "cardio" },
  { name: "Stair Climber", category: "Cardio", equipment: "Machine" , modality: "cardio" },
  { name: "Jump Rope", category: "Cardio", equipment: "Bodyweight" , modality: "cardio" },
  { name: "Elliptical", category: "Cardio", equipment: "Machine" , modality: "cardio" },
  { name: "Swimming", category: "Cardio", equipment: "None" , modality: "cardio" },

  // Bands
  { name: "Band Pull-Apart", category: "Shoulders", equipment: "Bands" , modality: "strength" },
  { name: "Band Face Pull", category: "Shoulders", equipment: "Bands" , modality: "strength" },
  { name: "Band Squat", category: "Legs", equipment: "Bands" , modality: "strength" },
  { name: "Band Row", category: "Back", equipment: "Bands" }
];
