const auth = {
  currentUser: null,
  selectedRole: null,

  selectRole(el) {
    document.querySelectorAll('.role-option').forEach(r => r.classList.remove('selected'));
    el.classList.add('selected');
    this.selectedRole = el.dataset.role;
  },

  async login(email, password) {
    const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
    await this.loadUser(cred.user);
    return cred.user;
  },

  async signup(name, email, phone, password, role) {
    const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });
    await db.collection('users').doc(cred.user.uid).set({
      name,
      email,
      phone,
      role,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await this.loadUser(cred.user);
    return cred.user;
  },

  async loadUser(firebaseUser) {
    if (!firebaseUser) {
      this.currentUser = null;
      return;
    }
    const doc = await db.collection('users').doc(firebaseUser.uid).get();
    const data = doc.data() || {};
    this.currentUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      name: data.name || firebaseUser.displayName || '',
      phone: data.phone || '',
      role: data.role || ''
    };
  },

  async logout() {
    await firebase.auth().signOut();
    this.currentUser = null;
    if (trader.locationWatcher) {
      navigator.geolocation.clearWatch(trader.locationWatcher);
      trader.locationWatcher = null;
    }
    router.navigate('login');
  },

  onAuthStateChanged(user) {
    const loading = document.getElementById('loadingScreen');
    const navbar = document.getElementById('navbar');

    if (user) {
      this.loadUser(user).then(() => {
        loading.classList.add('hidden');
        navbar.classList.remove('hidden');
        document.getElementById('displayName').textContent = this.currentUser.name || this.currentUser.email;
        const roleBadge = document.getElementById('displayRole');
        roleBadge.textContent = this.currentUser.role;
        roleBadge.className = 'status-badge status-' + this.currentUser.role;
        router.handleRoute();
      });
    } else {
      this.currentUser = null;
      loading.classList.add('hidden');
      navbar.classList.add('hidden');
      router.handleRoute();
    }
  }
};
