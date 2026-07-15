// Flappy Bird Backend - Score Handler
// Deployed auf Vercel als Serverless Function

const admin = require('firebase-admin');

// Firebase Admin SDK initialisieren
// WICHTIG: Die Service Account wird als Environment Variable gespeichert
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

if (Object.keys(serviceAccount).length > 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://flappybird-236b2-default-rtdb.europe-west1.firebasedatabase.app"
  });
}

const database = admin.database();

// ============================================
// CHEATING PREVENTION
// ============================================

// Speichere letzte Spiels um Duplicates zu verhindern
const recentScores = new Map();

function isValidScore(name, score, timestamp) {
  // Score muss zwischen 0 und 500 sein (realistic max)
  if (score < 0 || score > 500) {
    console.log('❌ Score unrealistic:', score);
    return false;
  }

  // Name muss 1-20 Zeichen lang sein
  if (!name || name.length < 1 || name.length > 20) {
    console.log('❌ Invalid name length');
    return false;
  }

  // Timestamp darf nicht in der Zukunft sein
  if (timestamp > Date.now() + 5000) {
    console.log('❌ Future timestamp');
    return false;
  }

  // Verhindere Duplicates (gleicher Name + Score innerhalb 5 Sek)
  const key = `${name}_${score}`;
  if (recentScores.has(key)) {
    const lastTime = recentScores.get(key);
    if (Date.now() - lastTime < 5000) {
      console.log('❌ Duplicate detected');
      return false;
    }
  }

  recentScores.set(key, Date.now());
  return true;
}

// ============================================
// HAUPTFUNKTION - SCORE SPEICHERN
// ============================================

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // OPTIONS Request handling
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Nur POST erlaubt
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, score, timestamp } = req.body;

    // Eingabe validieren
    if (!name || score === undefined) {
      return res.status(400).json({ error: 'Name and score required' });
    }

    // Score validieren (Cheating Prevention)
    if (!isValidScore(name, score, timestamp)) {
      return res.status(400).json({ error: 'Invalid score data' });
    }

    // Score zu Firebase speichern
    const scoreId = `${name}_${Date.now()}`;
    const scoreData = {
      name: name.trim(),
      score: Math.floor(score),
      date: new Date().toLocaleDateString('de-DE'),
      timestamp: Date.now()
    };

    await database.ref(`scores/${scoreId}`).set(scoreData);

    console.log('✅ Score gespeichert:', scoreData);
    return res.status(200).json({ 
      success: true, 
      message: 'Score saved',
      scoreId: scoreId 
    });

  } catch (error) {
    console.error('❌ Backend Error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};
