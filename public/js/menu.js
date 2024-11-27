// Wait for the DOM to be fully loaded
ocument.addEventListener('DOMContentLoaded', function() {
    // Get menu elements
    const hamburger = document.querySelector('.hamburger-menu');
    const sideMenu = document.querySelector('.side-menu');
    const closeMenu = document.querySelector('.close-menu');
     // Create overlay
    const overlay = document.createElement('div');
    overlay.classList.add('menu-overlay');
    document.body.appendChild(overlay);
     // Toggle menu function
    function toggleMenu() {
        console.log('Toggle menu clicked'); // Debug log
        sideMenu.classList.toggle('active');
        document.body.classList.toggle('menu-open');
        overlay.classList.toggle('active');
    }
     // Add click listeners
    if (hamburger) {
        hamburger.addEventListener('click', function(e) {
            console.log('Hamburger clicked'); // Debug log
            e.preventDefault();
            toggleMenu();
        });
    }
     if (closeMenu) {
        closeMenu.addEventListener('click', function(e) {
            console.log('Close clicked'); // Debug log
            e.preventDefault();
            toggleMenu();
        });
    }
     overlay.addEventListener('click', toggleMenu);
     // Close menu when clicking links
    const menuLinks = document.querySelectorAll('.side-menu-links a');
    menuLinks.forEach(link => {
        link.addEventListener('click', toggleMenu);
    });
});