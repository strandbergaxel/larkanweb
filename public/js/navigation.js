class Navigation {
    constructor() {
        this.mobileMenuButton = document.querySelector('.mobile-menu-button');
        this.mobileMenu = document.querySelector('.mobile-menu');
        this.mobileMenuClose = document.querySelector('.mobile-menu-close');
        this.init();
    }

    init() {
        // Mobile menu toggle
        this.mobileMenuButton?.addEventListener('click', () => this.openMenu());
        this.mobileMenuClose?.addEventListener('click', () => this.closeMenu());

        // Add active states
        this.setActiveLinks();

        // Add page transition listeners
        this.initPageTransitions();
    }

    openMenu() {
        this.mobileMenu.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeMenu() {
        this.mobileMenu.classList.remove('active');
        document.body.style.overflow = '';
    }

    setActiveLinks() {
        const currentPath = window.location.pathname;
        document.querySelectorAll('.nav-links a, .mobile-nav a').forEach(link => {
            if (link.getAttribute('href') === currentPath) {
                link.classList.add('active');
            }
        });
    }

    initPageTransitions() {
        document.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                if (link.origin === window.location.origin) {
                    e.preventDefault();
                    const target = link.href;
                    
                    document.body.classList.add('page-transition');
                    
                    setTimeout(() => {
                        window.location = target;
                    }, 300);
                }
            });
        });
    }
}

// Initialize navigation
new Navigation(); 