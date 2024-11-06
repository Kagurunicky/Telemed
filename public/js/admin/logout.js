document.addEventListener('DOMContentLoaded', function() {
    const logoutLink = document.querySelector('a#logout');
    if (logoutLink) {
        logoutLink.addEventListener('click', function(e) {
            e.preventDefault();
            
            if (confirm('Are you sure you want to logout?')) {
                // Clear admin data
                localStorage.removeItem('adminToken');
                localStorage.removeItem('adminData');
                localStorage.removeItem('userType');

                // Redirect to admin login
                window.location.href = '/admin/login.html';
            }
        });
    }
}); 