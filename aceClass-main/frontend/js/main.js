// Main JavaScript for AceClass (Login Bypassed)
class AceClass {
    constructor() {
        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupScrollEffects();
        this.setupButtons();
        this.setupAnimations();
        this.setupDashboardAccess(); // direct access setup
    }

    // Navigation functionality
    setupNavigation() {
        const navToggle = document.getElementById('nav-toggle');
        const navMenu = document.getElementById('nav-menu');

        if (navToggle && navMenu) {
            navToggle.addEventListener('click', () => {
                navMenu.classList.toggle('active');
                navToggle.classList.toggle('active');
            });

            // Close menu when clicking on links
            const navLinks = document.querySelectorAll('.nav-link');
            navLinks.forEach(link => {
                link.addEventListener('click', () => {
                    navMenu.classList.remove('active');
                    navToggle.classList.remove('active');
                });
            });

            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
                    navMenu.classList.remove('active');
                    navToggle.classList.remove('active');
                }
            });
        }

        // Smooth scrolling for anchor links
        const anchorLinks = document.querySelectorAll('a[href^="#"]');
        anchorLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    const offsetTop = targetElement.offsetTop - 80; // Account for fixed navbar
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    // Scroll effects
    setupScrollEffects() {
        const navbar = document.querySelector('.navbar');
        
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.style.background = 'rgba(255, 255, 255, 0.98)';
                navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
            } else {
                navbar.style.background = 'rgba(255, 255, 255, 0.95)';
                navbar.style.boxShadow = 'none';
            }
        });

        // Simple fade-in on scroll
        const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);

        const animateElements = document.querySelectorAll('.feature-card, .step');
        animateElements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(el);
        });
    }

    // Button setup
    setupButtons() {
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.innerHTML = `
                <i class="fas fa-tachometer-alt"></i>
                Dashboard
            `;
            loginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = '/pages/dashboard.html'; // Change path if needed
            });
        }
    }

    // Animations
    setupAnimations() {
        const worksheetStack = document.querySelector('.worksheet-stack');
        if (worksheetStack) {
            let currentSheet = 1;
            setInterval(() => {
                const worksheets = worksheetStack.querySelectorAll('.worksheet');
                worksheets.forEach((sheet, index) => {
                    sheet.style.zIndex = index === currentSheet ? 3 : (index === (currentSheet + 1) % 3 ? 2 : 1);
                    sheet.style.opacity = index === currentSheet ? 1 : (index === (currentSheet + 1) % 3 ? 0.8 : 0.6);
                });
                currentSheet = (currentSheet + 1) % 3;
            }, 3000);
        }
    }

    // Direct dashboard access (no auth)
    setupDashboardAccess() {
        console.log("Authentication skipped — direct dashboard access enabled.");
        // If you want to auto-redirect from the landing page:
        // window.location.href = '/pages/dashboard.html';
    }
}

// Initialize AceClass when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.gradeflow = new AceClass();
});
