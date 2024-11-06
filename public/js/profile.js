document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Load profile data
    loadProfile();

    // Handle profile form submission
    document.getElementById('profileForm').addEventListener('submit', updateProfile);
    
    // Handle password form submission
    document.getElementById('passwordForm').addEventListener('submit', updatePassword);

    // Add delete account form handler
    document.getElementById('deleteAccountForm').addEventListener('submit', handleDeleteAccount);
});

async function loadProfile() {
    try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No authentication token found');

        const response = await fetch('/api/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const profile = await handleApiResponse(response);
        
        // Populate form fields with null checks
        document.getElementById('firstName').value = profile.first_name || '';
        document.getElementById('lastName').value = profile.last_name || '';
        document.getElementById('email').value = profile.email || '';
        document.getElementById('phone').value = profile.phone || '';
        document.getElementById('dateOfBirth').value = profile.date_of_birth ? 
            profile.date_of_birth.split('T')[0] : '';
        document.getElementById('gender').value = profile.gender || '';
        document.getElementById('address').value = profile.address || '';
    } catch (error) {
        console.error('Error loading profile:', error);
        alert('Error loading profile data: ' + error.message);
        
        if (error.message.includes('authentication')) {
            window.location.href = '/login.html';
        }
    }
}

async function updateProfile(e) {
    e.preventDefault();
    
    try {
        const token = localStorage.getItem('token');
        const profileData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            phone: document.getElementById('phone').value,
            dateOfBirth: document.getElementById('dateOfBirth').value,
            gender: document.getElementById('gender').value,
            address: document.getElementById('address').value
        };

        const response = await fetch('/api/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(profileData)
        });

        if (!response.ok) throw new Error('Failed to update profile');

        alert('Profile updated successfully');
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Error updating profile');
    }
}

async function updatePassword(e) {
    e.preventDefault();

    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        alert('New passwords do not match');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const passwordData = {
            currentPassword: document.getElementById('currentPassword').value,
            newPassword: newPassword
        };

        const response = await fetch('/api/profile/password', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(passwordData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to update password');
        }

        alert('Password updated successfully');
        document.getElementById('passwordForm').reset();
    } catch (error) {
        console.error('Error updating password:', error);
        alert(error.message || 'Error updating password');
    }
}

async function handleDeleteAccount(e) {
    e.preventDefault();

    // Show confirmation dialog
    if (!confirm('Are you absolutely sure you want to delete your account? This action cannot be undone.')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const password = document.getElementById('deletePassword').value;

        const response = await fetch('/api/profile', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to delete account');
        }

        // Clear local storage and redirect to home page
        localStorage.removeItem('token');
        window.location.href = '/index.html?deleted=true';
    } catch (error) {
        console.error('Error deleting account:', error);
        alert(error.message || 'Error deleting account');
    }
}

// Add this function to handle API errors
async function handleApiResponse(response) {
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'API request failed');
    }
    return response.json();
} 