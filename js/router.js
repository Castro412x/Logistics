const router = {
  currentPage: null,
  params: {},

  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();
  },

  navigate(page, params) {
    if (params) {
      window.location.hash = page + '/' + encodeURIComponent(JSON.stringify(params));
    } else {
      window.location.hash = page;
    }
  },

  handleRoute() {
    let hash = window.location.hash.replace('#', '') || 'login';
    let params = {};

    // Check for params in hash
    const slashIdx = hash.indexOf('/');
    if (slashIdx !== -1) {
      try {
        params = JSON.parse(decodeURIComponent(hash.slice(slashIdx + 1)));
      } catch (e) { /* ignore */ }
      hash = hash.slice(0, slashIdx);
    }

    this.params = params;
    const user = auth.currentUser;

    if (!user && hash !== 'signup' && hash !== 'login') {
      this.showPage('login');
      return;
    }

    if (user) {
      const role = user.role;
      if (hash === 'login' || hash === 'signup') {
        this.showPage(role === 'trader' ? 'trader' : 'customer');
        return;
      }
    }

    this.showPage(hash);
  },

  showPage(page) {
    document.querySelectorAll('[id^="page-"]').forEach(el => el.classList.add('hidden'));
    const el = document.getElementById('page-' + page);
    if (el) el.classList.remove('hidden');

    if (page === 'customer' && auth.currentUser) customer.init();
    if (page === 'trader' && auth.currentUser) trader.init();

    this.currentPage = page;
  }
};
