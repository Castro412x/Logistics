(function () {
  // Init router
  router.init();

  // Listen to auth state
  firebase.auth().onAuthStateChanged(user => auth.onAuthStateChanged(user));

  const setLoading = (formId, btnSelector, loading) => {
    const btn = document.querySelector(`#${formId} ${btnSelector}`);
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? 'Please wait...' : btn.dataset.originalText || btn.textContent;
    if (!btn.dataset) btn.dataset = {};
    if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent;
  };

  // Login form
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('loginError');
    errEl.textContent = '';
    if (!email || !password) { errEl.textContent = 'Please fill in all fields.'; return; }
    setLoading('loginForm', '.btn-primary', true);
    try {
      await auth.login(email, password);
    } catch (err) {
      errEl.textContent = auth.getFriendlyError(err);
      setLoading('loginForm', '.btn-primary', false);
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

    if (!role) { errEl.textContent = 'Please select a role (Customer or Trader).'; return; }
    if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; return; }

    setLoading('signupForm', '.btn-primary', true);
    try {
      await auth.signup(name, email, phone, password, role);
    } catch (err) {
      errEl.textContent = auth.getFriendlyError(err);
      setLoading('signupForm', '.btn-primary', false);
    }
  });
})();
