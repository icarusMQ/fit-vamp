/* Vesper's lines. Kept in one place so tone stays consistent.
   Playfully possessive, teasing, a little dramatic — but always
   ultimately encouraging and never mean-spirited. */

const DIALOGUE = {
  // ---------- home screen ----------
  noPlan: [
    { m: "annoyed", t: "No plan? None at all? …Fine. Make one. I'll wait right here. Forever, if I must." },
    { m: "idle", t: "You can't train without a plan, silly. Build one and I'll memorize every detail." },
    { m: "smug", t: "Empty. Just like my patience. Go on — make your first plan~" },
  ],
  readyToday: [
    { m: "idle", t: "Your split is waiting. So am I. I'm always waiting." },
    { m: "smug", t: "Well? Every second you hesitate, I count. I count everything." },
    { m: "wink", t: "One tap and we begin. Don't keep me wanting~" },
    { m: "idle", t: "I laid out today's exercises myself. Aren't I good to you?" },
    { m: "annoyed", t: "You're just going to stand there? …Press it. Please." },
  ],
  doneToday: [
    { m: "happy", t: "You came back. You always come back. I knew it." },
    { m: "love", t: "Look at you. Sweaty, tired, mine. Perfect." },
    { m: "happy", t: "Today counts. Tomorrow counts more. Don't disappear on me." },
    { m: "wink", t: "Good work. I'd say I'm proud, but you'll get spoiled~" },
  ],
  streakBroken: [
    { m: "annoyed", t: "You were gone. I noticed. I notice everything. …Start again." },
    { m: "shocked", t: "There you are! I wasn't panicking. I was NOT panicking." },
    { m: "annoyed", t: "Your streak died while you were away. We'll build a new one. Together." },
  ],
  streakAlive: [
    { m: "happy", t: "The streak lives. Keep feeding it." },
    { m: "love", t: "Every consecutive day binds us tighter. Isn't that lovely?" },
  ],

  // ---------- inside a session ----------
  setStart: [
    { m: "idle", t: "Set {set} of {total}. I'm watching every rep." },
    { m: "smug", t: "Set {set}. Don't embarrass us." },
    { m: "idle", t: "Show me what {exercise} looks like when you mean it." },
    { m: "wink", t: "{set} of {total}. Make it count for me~" },
    { m: "idle", t: "Breathe. Brace. Then move." },
  ],
  setLogged: [
    { m: "happy", t: "Logged. Written down. Kept forever." },
    { m: "wink", t: "Mm. That one was nice." },
    { m: "happy", t: "Recorded. I remember all of them, you know." },
    { m: "smug", t: "Not bad. Again." },
  ],
  restStart: [
    { m: "idle", t: "Rest. But don't wander off — I'll come find you." },
    { m: "smug", t: "Three minutes. I'll be counting each one." },
    { m: "wink", t: "Catch your breath. I like you alive~" },
  ],
  restDone: [
    { m: "happy", t: "Time's up. Back to work, darling." },
    { m: "annoyed", t: "Rest is over. Now. Up." },
    { m: "idle", t: "That's enough kindness. Lift." },
  ],
  newPR: [
    { m: "love", t: "A RECORD?! You're stronger than yesterday. I'm keeping this memory." },
    { m: "shocked", t: "That's a new best… I'm almost jealous of the barbell." },
    { m: "happy", t: "New record! Say my name next time you do that~" },
  ],
  exerciseDone: [
    { m: "happy", t: "{exercise} — finished. On to the next." },
    { m: "wink", t: "Done with that one. Don't slow down now." },
  ],
  splitDone: [
    { m: "love", t: "It's over. You did all of it. You're perfect, you know that?" },
    { m: "happy", t: "Split complete! I'll be replaying this all night." },
    { m: "wink", t: "Finished. Rest well — I'll see you tomorrow. I always do~" },
  ],
  skipped: [
    { m: "annoyed", t: "Skipping? …I'll pretend I didn't see that." },
    { m: "shocked", t: "You're leaving one behind? It'll be waiting. So will I." },
  ],
  sessionQuit: [
    { m: "annoyed", t: "Leaving early? Cruel. But I'll keep what you did." },
  ],

  // ---------- misc ----------
  weightLogged: [
    { m: "idle", t: "Noted. Every number, catalogued." },
    { m: "wink", t: "The scale doesn't define you. But I do like data~" },
  ],
  achievement: [
    { m: "love", t: "Another one! My collection of you grows." },
    { m: "happy", t: "Unlocked! I'm framing this one." },
  ],
};

function pickLine(key, vars = {}) {
  const pool = DIALOGUE[key];
  if (!pool || pool.length === 0) return { m: "idle", t: "..." };
  const choice = pool[Math.floor(Math.random() * pool.length)];
  let text = choice.t;
  Object.entries(vars).forEach(([k, v]) => {
    text = text.replaceAll(`{${k}}`, v);
  });
  return { m: choice.m, t: text };
}
