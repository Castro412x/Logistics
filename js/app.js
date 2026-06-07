(function () {
  // Init router
  router.init();

  // Listen to auth state
  firebase.auth().onAuthStateChanged(user => auth.onAuthStateChanged(user));

  // Login form
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('loginError');
    errEl.textContent = '';
    try {
      await auth.login(email, password);
    } catch (err) {
      errEl.textContent = err.message;
    }
  });

  // Signup form
  document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const phone = document.getElementById('signupPhone').value.trim();
    const password = document.getElementById('signupPassword').value;
    const role = auth.selectedRole;
    const errEl = document.getElementById('signupError');
    errEl.textContent = '';

    if (!role) {
      errEl.textContent = 'Please select a role (Customer or Trader).';
      return;
    }

    try {
      await auth.signup(name, email, phone, password, role);
    } catch (err) {
      errEl.textContent = err.message;
    }
  });
})();
