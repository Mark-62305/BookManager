# Book Collection Manager

A mobile-first CRUD application built with Ionic 9, Angular 21, TypeScript, and Firebase Realtime Database. Books are stored under `/books` and synchronized in realtime across connected clients.

## Firebase setup

Follow the complete [Firebase Realtime Database Setup Guide](FIREBASE_SETUP.md) to create the project, add the web configuration, publish development rules, verify CRUD operations, and troubleshoot connection errors.

For a short local-development exercise only, unauthenticated access can be enabled with:

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

These public rules are not suitable for production. Use Firebase Authentication and authenticated-user rules before publishing the app.

## Run in a browser

```bash
npm install
npm start
```

Open `http://localhost:4200`.

## Build and run on Android

```bash
npm run build
npx cap sync android
npx cap open android
```

The Android package ID is `com.example.bookmanager`, and the visible application name is Book Collection Manager.

## Data shape

Firebase generates each record ID via `push()`. Each `/books/{id}` node stores `title`, `author`, `category`, `publicationYear`, `availabilityStatus`, `createdAt`, and `updatedAt`. Optional PDF files are stored in Firebase Storage under `/books/{id}/`, with their file metadata and download URL saved in the database record.
