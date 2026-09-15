# Firebase Database and Storage Setup Guide

This guide connects the **Book Collection Manager** to Firebase Realtime Database and Firebase Storage. Book records are stored under `/books`, while optional PDF attachments are stored under `gs://ormecoapp.firebasestorage.app/books`.

## 1. Create a Firebase project

1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select **Add project**.
3. Enter a project name, such as `book-collection-manager`.
4. Google Analytics is optional for this application.
5. Select **Create project** and wait for setup to finish.

## 2. Register the web application

The Ionic Android application runs the Angular web application inside Capacitor, so register a **Web app** in Firebase.

1. Open **Project Overview** in the Firebase Console.
2. Select the Web icon (`</>`).
3. Enter an app nickname, such as `Book Collection Manager`.
4. Firebase Hosting is not required.
5. Select **Register app**.
6. Keep the displayed `firebaseConfig` values available for step 5.

You do not need `google-services.json` for the database implementation in this project. It uses the Firebase JavaScript SDK rather than the native Android Firebase SDK.

## 3. Create the Realtime Database

1. In the Firebase Console, open **Build → Realtime Database**.
2. Select **Create Database**.
3. Choose the database location closest to your users.
4. Choose **Locked mode** if you plan to configure the rules manually, or **Test mode** only for temporary development.
5. Select **Enable**.

Copy the database URL shown at the top of the Data page. Depending on the selected region, it usually resembles one of these:

```text
https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com
https://YOUR_PROJECT_ID.REGION.firebasedatabase.app
```

Use the exact URL displayed by Firebase.

## 4. Enable Firebase Storage

1. In the Firebase Console, open **Build → Storage**.
2. Select **Get started**.
3. Choose a location and finish creating the bucket.
4. Confirm that the bucket is `gs://ormecoapp.firebasestorage.app`.

Uploaded PDFs use this structure:

```text
books/{FirebaseBookId}/{safe-file-name}.pdf
```

## 5. Add the Firebase configuration

Open [`src/environments/environment.ts`](src/environments/environment.ts) and replace every placeholder with the values from **Project settings → General → Your apps → SDK setup and configuration**.

```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: 'YOUR_REAL_API_KEY',
    authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
    databaseURL: 'YOUR_REALTIME_DATABASE_URL',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_STORAGE_BUCKET',
    messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
    appId: 'YOUR_APP_ID'
  }
};
```

Important:

- Do not leave any `YOUR_...` placeholders in the file.
- `databaseURL` must point to Realtime Database, not Cloud Firestore.
- Keep the quotation marks around every value.
- Firebase web configuration is included in the client application. Database security must be enforced with Firebase rules, not by trying to hide the API key.

## 6. Configure Realtime Database development rules

Open **Realtime Database → Rules** and use the following rules for short-term local development:

```json
{
  "rules": {
    "books": {
      ".read": true,
      ".write": true
    }
  }
}
```

Select **Publish** after editing the rules.

> Warning: These rules allow anyone who knows the database URL to read and modify the collection. Do not use them in production.

For production, first add Firebase Authentication to the application and then require an authenticated user:

```json
{
  "rules": {
    "books": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

The current application does not include a sign-in screen, so authenticated rules will deny requests until authentication is implemented.

## 7. Configure Firebase Storage development rules

Open **Storage → Rules** and publish these rules for development. They allow PDF files up to 20 MB under `/books`:

```text
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /books/{bookId}/{fileName} {
      allow read: if true;
      allow create, update: if request.resource.size <= 20 * 1024 * 1024
                            && request.resource.contentType == 'application/pdf';
      allow delete: if true;
    }
  }
}
```

These rules allow unauthenticated uploads and downloads, so use them only during development. After adding Firebase Authentication, require `auth != null` while retaining the file-size and content-type checks.

## 8. Run the application

Install dependencies and start the Ionic development server:

```bash
npm install
ionic serve
```

Open `http://localhost:8100` if the browser does not open automatically.

You can also use Angular's development server:

```bash
npm start
```

That command serves the app at `http://localhost:4200`.

## 9. Verify the database and file upload

1. Open the Book Collection Manager.
2. Select **Add book**.
3. Complete all required fields and optionally choose a PDF of 20 MB or less.
4. Select **Save book** and wait for the confirmed success message.
5. Return to **Firebase Console → Realtime Database → Data**.
6. Confirm that Firebase created a child under `/books` with an ID beginning with `-`.
7. If a PDF was selected, open **Storage → Files** and confirm it exists under `/books/{FirebaseBookId}/`.
8. Select **Open attached PDF** from the book card and confirm the file opens.
9. Delete the book and confirm that both its database record and stored PDF are removed.

Firebase should produce data similar to:

```text
books
└── -FirebaseGeneratedId
    ├── title: "Clean Code"
    ├── author: "Robert C. Martin"
    ├── category: "Programming"
    ├── publicationYear: 2008
    ├── availabilityStatus: "Available"
    ├── fileName: "clean-code.pdf"
    ├── fileUrl: "https://firebasestorage.googleapis.com/..."
    ├── fileStoragePath: "books/-FirebaseGeneratedId/clean-code.pdf"
    ├── fileSize: 1234567
    ├── fileType: "application/pdf"
    ├── createdAt: "2026-09-15T..."
    └── updatedAt: "2026-09-15T..."
```

The books screen uses a realtime listener. Changes made from another connected client or directly in the Firebase Console should appear without restarting the application.

## 10. Build and synchronize Android

After changing the Firebase configuration, rebuild and copy the new web bundle into the Android project:

```bash
npm run build
npx cap sync android
npx cap open android
```

Run the application from Android Studio. The device or emulator must have internet access.

## Troubleshooting

### Invalid Firebase configuration

At least one placeholder remains in `src/environments/environment.ts`, or a required value is empty. Copy the complete Firebase web configuration again.

### Firebase Database rules denied access

The current rules do not allow the application to read or write. Publish the development rules above, or sign in before using authenticated rules.

### Firebase Storage rules denied access

Realtime Database rules do not apply to files. Enable Firebase Storage and publish the separate Storage rules from step 7.

### The PDF does not upload

Confirm that the file is a PDF no larger than 20 MB, the configured bucket is `ormecoapp.firebasestorage.app`, and the Storage rules have been published.

### Books do not appear in the Firebase Console

Confirm that you are viewing **Realtime Database**, not Firestore, and that the `databaseURL` belongs to the same Firebase project.

### Network or offline error

Confirm that the computer, emulator, or physical device has internet access. Also check whether a firewall, VPN, or restricted network is blocking Firebase.

### The Android app still uses an old configuration

Rebuild and synchronize again:

```bash
npm run build
npx cap sync android
```

### `ionic serve` reports an unknown project or unknown arguments

Pull the latest `angular.json`. The Angular project key must be `app` because that is the project name used by the Ionic CLI.
