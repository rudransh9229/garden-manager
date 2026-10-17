# Firebase setup (one time, about 15 minutes, free)

You do this once. It needs a Google account (use a family one, not a personal one you might lose). No card is asked for anywhere here. If any screen asks for a card or says "Upgrade", stop: you are on the wrong page, and the free "Spark" plan is all this app needs.

## 1. Create the project
1. Go to https://console.firebase.google.com and sign in.
2. Click **Create a project**. Name it `garden-manager` (or anything). Continue.
3. Turn **Google Analytics OFF** (not needed). Click **Create project**, then **Continue**.

## 2. Turn on sign-in
1. Left menu: **Build > Authentication**, click **Get started**.
2. Under "Sign-in method" pick **Email/Password**, switch on the first toggle only (not "Email link"), **Save**.
3. Open the **Users** tab, click **Add user**, type an email and a strong password for yourself. Repeat for each family member and for the manager.
4. Each user row shows a **User UID** (a long code). Keep this tab open: you need each UID in step 4.
5. Under **Settings > User actions** make sure "Enable create (sign-up)" is **off**, so strangers cannot make accounts. (If you do not see it, skip: the database rules below already stop strangers.)

## 3. Create the database
1. Left menu: **Build > Firestore Database**, click **Create database**.
2. Location: **asia-south1 (Mumbai)**. This cannot be changed later. Next.
3. Choose **Start in production mode**. Create.
4. Open the **Rules** tab, delete everything, and paste the whole content of the file `firestore.rules` from this project (it is short). Click **Publish**.

What these rules do: owners can read and change everything. The manager can read bookings, client names and staff, and can add staff names and mark attendance. The manager can never read prices, phone numbers, addresses, payments, expenses, invoices or wages. The database refuses, even if someone tampers with the app in their browser.

## 4. Give each person a role
1. In Firestore, **Data** tab, click **Start collection**. Collection ID: `users`.
2. Document ID: paste **your User UID** (from step 2.4). Add one field: name `role`, type string, value `owner`. Save.
3. Add one more document for each other person: their UID, field `role`, value `owner` (family) or `manager`.
4. Roles are exactly the words `owner` and `manager`, lowercase, no spaces.

## 5. Connect the app
1. Project settings (gear icon, top left) > **General** > scroll to **Your apps** > click the web icon `</>`. Nickname `garden-web`. Leave "Firebase Hosting" unticked. **Register app**.
2. You will see a block of code with `apiKey`, `authDomain`, `projectId`, `appId`. Copy those four values.
3. In the project folder copy `.env.example` to `.env.local` and paste the four values after the `=` signs. No quotes.
4. Run `npm install` then `npm run dev`. The app now shows a sign-in screen. Sign in with the account from step 2.3.
5. The database starts empty. Add real bookings, or use **Import old records**. The demo data is never sent to the online database.

## Invoice files
Invoice scans and photos are stored inside the same Firestore database, so nothing extra is needed and no card is involved. Photos are shrunk automatically (a 5 MB phone photo becomes roughly 300 KB). A PDF can be at most **3 MB**; if a scan is bigger, the app says so and you can rescan at lower quality or photograph the page. The free database holds 1 GB in total, which is room for roughly a thousand typical invoices. If you ever need bigger files, Firebase Storage is the alternative, but Google requires a card for it.

If you published rules earlier, open the **Rules** tab again and paste the latest `firestore.rules` from this project, because it now also covers the file collections.

## Things to know
- Test the manager yourself: make a manager account (step 4), sign in with it in a private window, and check you see no rupee amounts, phone numbers or Invoices page.
- The manager's attendance marks get their pay worked out the next time an owner has the app open. Until then the wage totals do not include them.
- To open the app on other phones and computers, put it online: see "Put it online (GitHub Pages)" in the README. After that, add your web address (`<your-username>.github.io`) under Authentication > Settings > Authorized domains.

## If something goes wrong
- "That email or password is not right": check the user exists in Authentication > Users.
- "You are signed in, but have no access yet": the `users` document is missing or its ID is not the UID, or `role` is spelled differently.
- "Your records could not be loaded": usually no internet, or the rules were not published.
