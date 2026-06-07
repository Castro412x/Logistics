const router = {
  currentPage: null,

  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();
  },

  navigate(page) {
    window.location.hash = page;
  },

  handleRoute() {
    const hash = window.location.hash.replace('#', '') || 'login';
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
