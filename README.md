# Campus Check

An attendance dashboard for managing classes, students, teachers, and class sessions. The default campus is Vidya Pratishthan’s Kamalnayan Bajaj Institute of Engineering and Technology, Baramati (VPKBIET). Any college can change the full name and abbreviation in **Settings**.

## Use the app

1. Explore the fictional records in the demo workspace, or choose **Settings → Start a blank workspace** to set up your own.
2. Add a class and its subjects, then add students and teachers to the directory.
3. In **Attendance**, select a class, subject, and teacher and start a session. Mark students manually or enter the RFID assigned to a roster entry. A USB scanner in keyboard mode can type the RFID and submit it with Enter.
4. Close the session to save its attendance. Use **Reports** to review past sessions or download a CSV.

The browser profile stores the directory, settings, and attendance history for the current site. Each browser profile has its own workspace. Teacher entries identify session instructors. This edition has no staff login, shared database, or direct network connection to an RFID reader. Clearing the site’s browser data removes its records, so export reports before clearing data or moving to a different browser.

## Run locally

Serve the repository over HTTP with Python 3:

```sh
python3 -m http.server 3000
```

Open `http://localhost:3000`. The app uses standard HTML, CSS, and JavaScript modules and has no runtime package dependencies. To host it elsewhere, publish `index.html`, `styles.css`, `app.js`, and `store.js` together in the same directory.


