// Real, shared review storage via Firebase Firestore — every visitor reads
// and writes the same collection, instead of each browser only seeing its
// own localStorage.
//
// This uses Firebase's "compat" SDK (classic global `firebase` namespace,
// loaded via plain <script> tags in index.html) rather than the modular
// ES-import SDK. That's deliberate: type="module" scripts are blocked by
// CORS when a page is opened via file:// (the module fetch is always
// CORS-mode, and the file:// origin is null), which would break every local
// double-click test of this site. Classic <script src="https://..."> tags
// have no such restriction.
//
// SETUP REQUIRED before this works:
// 1. Go to https://console.firebase.google.com, create a project (free).
// 2. In the project, click "Add app" -> Web app, register it, and copy the
//    firebaseConfig object it gives you into the placeholders below.
// 3. In the Firebase console, go to Firestore Database -> Create database
//    (start in production mode, pick any region).
// 4. In Firestore -> Rules, use this (public read, create-only write, no
//    edits/deletes from the browser, and basic shape/length validation):
//
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /reviews/{reviewId} {
//          allow read: if true;
//          allow create: if request.resource.data.keys().hasAll(['name','city','service','text','rating'])
//                        && request.resource.data.name is string && request.resource.data.name.size() <= 60
//                        && request.resource.data.city is string && request.resource.data.city.size() <= 60
//                        && request.resource.data.text is string && request.resource.data.text.size() <= 400
//                        && request.resource.data.rating is number
//                        && request.resource.data.rating >= 1 && request.resource.data.rating <= 5;
//          allow update, delete: if false;
//        }
//      }
//    }

(function () {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK did not load — reviews will not sync.');
    return;
  }

  const firebaseConfig = {
    apiKey: 'AIzaSyBT9ogyMK7jvQEojTWGY2-7G0-frnD52vo',
    authDomain: 'robyapp-5d333.firebaseapp.com',
    projectId: 'robyapp-5d333',
    storageBucket: 'robyapp-5d333.firebasestorage.app',
    messagingSenderId: '1013036607876',
    appId: '1:1013036607876:web:30d3cc3a800380187615d1',
  };

  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  const reviewsCol = db.collection('reviews');

  window.reviewsDB = {
    async addReview(review) {
      await reviewsCol.add({
        ...review,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    },
    // Live subscription — fires immediately with current data, then again
    // whenever any visitor (anywhere) adds a new review. Returns an
    // unsubscribe function.
    subscribe(callback) {
      return reviewsCol.orderBy('createdAt', 'desc').onSnapshot(
        (snapshot) => callback(snapshot.docs.map((d) => d.data())),
        (error) => console.error('Reviews live-sync error:', error)
      );
    },
  };

  window.dispatchEvent(new Event('reviewsdb-ready'));
})();
