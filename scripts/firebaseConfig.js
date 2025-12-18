// Placeholder Firebase integration file.
// To enable cloud sync replace the config below with your Firebase project's config
// and import Firebase libraries in index.html or here.

export function initFirebase(){
  // Example:
  // import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js'
  // const app = initializeApp(firebaseConfig)
  console.warn('Firebase not configured. Add your config in scripts/firebaseConfig.js')
}

export async function signInAndSync(){
  // Placeholder sign-in function. When implemented, should sign the user in and
  // return a user object to the main app which can call upload/download sync functions.
  alert('Cloud sync not configured. See scripts/firebaseConfig.js and README.md')
  return null
}
