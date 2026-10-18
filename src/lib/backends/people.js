/**
 * Who can sign in, and as what. Owners use this from the People page so nobody has to open the Firebase console.
 * A person is two things: a sign-in account (email and password, kept by Firebase) and a small record at
 * /users/<uid> that says whether they are an owner or a manager. Without that record an account sees nothing.
 *
 * `createAccount(email, password) -> uid` and `sendReset(email)` are passed in (see firebase.js).
 */
export const ROLES = ['owner', 'manager'];

const fail = (code, message) => Object.assign(new Error(message), { code });

export function createPeopleApi({ db, fs, selfUid, createAccount, sendReset }) {
  const ref = (uid) => fs.doc(db, 'users', uid);
  const list = async () => {
    const snap = await fs.getDocs(fs.collection(db, 'users'));
    return snap.docs
      .map((d) => ({ uid: d.id, ...d.data() }))
      .sort((a, b) => (a.role === b.role ? String(a.email || a.uid).localeCompare(String(b.email || b.uid)) : a.role === 'owner' ? -1 : 1));
  };
  /** Never lock the family out: there must always be at least one owner, and you cannot change your own access. */
  const guard = async (uid) => {
    if (uid === selfUid) throw fail('people/self', 'You cannot change your own access. Ask another owner.');
    const people = await list();
    const target = people.find((p) => p.uid === uid);
    if (target && target.role === 'owner' && people.filter((p) => p.role === 'owner').length <= 1) {
      throw fail('people/last-owner', 'There must always be at least one owner.');
    }
  };

  return {
    list,

    async add({ email, password, role }) {
      const mail = String(email || '').trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(mail)) throw fail('people/bad-email', 'That does not look like an email address.');
      if (!ROLES.includes(role)) throw fail('people/bad-role', 'Choose owner or manager.');
      if (String(password || '').length < 6) throw fail('people/weak-password', 'The password needs at least 6 characters.');
      const uid = await createAccount(mail, password);
      await fs.setDoc(ref(uid), { role, email: mail });
      return { uid, email: mail, role };
    },

    async setRole(uid, role) {
      if (!ROLES.includes(role)) throw fail('people/bad-role', 'Choose owner or manager.');
      if (role !== 'owner') await guard(uid); else if (uid === selfUid) throw fail('people/self', 'You cannot change your own access. Ask another owner.');
      await fs.setDoc(ref(uid), { role }, { merge: true });
    },

    /** Takes away all access. The sign-in account stays in Firebase but can see nothing. */
    async removeAccess(uid) {
      await guard(uid);
      await fs.deleteDoc(ref(uid));
    },

    resetPassword: (email) => sendReset(String(email || '').trim()),
  };
}

/** A password a person can read out over the phone: no look-alike characters. */
export function makePassword(random = Math.random) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(random() * chars.length)]).join('');
}
