// Check if we're on a doctor page or patient page
const isDoctorPage = window.location.pathname.includes('/doctor/');

// Add event listener for logout
document.addEventListener('DOMContentLoaded', function() {
    const logoutButton = document.getElementById('logout');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
});

function handleLogout(e) {
    e.preventDefault();
    
    if (confirm('Are you sure you want to logout?')) {
        // Clear all stored data
        localStorage.removeItem('token');
        localStorage.removeItem('doctorToken');
        localStorage.removeItem('userType');
        localStorage.removeItem('userData');

        // Redirect based on user type
        if (isDoctorPage) {
            window.location.href = '/doctor/login.html';
        }
    }
}