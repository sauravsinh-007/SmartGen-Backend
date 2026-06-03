const admin = require('firebase-admin');
const logger = require('../utils/logger');

let firebaseApp;

const initializeFirebase = () => {
  if (firebaseApp) return firebaseApp;

  try {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
    logger.info('Firebase Admin SDK initialized');
  } catch (error) {
    logger.error('Firebase initialization failed:', error.message);
  }

  return firebaseApp;
};

const getMessaging = () => {
  initializeFirebase();
  return admin.messaging();
};

module.exports = { initializeFirebase, getMessaging };
