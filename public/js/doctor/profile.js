function isTokenExpired(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp * 1000 < Date.now();
    } catch (error) {
        return true;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('doctorToken');
    if (!token || isTokenExpired(token)) {
        localStorage.removeItem('doctorToken');
        localStorage.removeItem('userType');
        localStorage.removeItem('doctorData');
        window.location.href = '/doctor/login.html';
        return;
    }

    loadDoctorProfile();

    document.getElementById('doctorProfileForm').addEventListener('submit', updateProfile);
    document.getElementById('passwordForm').addEventListener('submit', updatePassword);
    document.getElementById('deleteAccountForm').addEventListener('submit', deleteAccount);
    document.getElementById('logout').addEventListener('click', () => {
        localStorage.removeItem('doctorToken');
        window.location.href = '/doctor/login.html';
    });
});

async function loadDoctorProfile() {
    try {
        const token = localStorage.getItem('doctorToken');
        if (!token) {
            throw new Error('No authentication token found');
        }

        console.log('Using token:', token); // Debug log

        const response = await fetch('/api/doctor/profile', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to load profile');
        }

        const profile = await response.json();
        console.log('Profile data:', profile); // Debug log
        
        // Populate form fields
        document.getElementById('firstName').value = profile.first_name || '';
        document.getElementById('lastName').value = profile.last_name || '';
        document.getElementById('email').value = profile.email || '';
        document.getElementById('phone').value = profile.phone || '';
        document.getElementById('specialization').value = profile.specialization || '';

        // Reset all checkboxes first
        document.querySelectorAll('input[name="workingDays"]').forEach(checkbox => {
            checkbox.checked = false;
        });

        // Set working days and hours
        if (profile.schedule && typeof profile.schedule === 'object') {
            Object.entries(profile.schedule).forEach(([day, times]) => {
                const checkbox = document.getElementById(day);
                if (checkbox) {
                    checkbox.checked = true;
                }
                if (times.start) {
                    document.getElementById('startTime').value = times.start;
                }
                if (times.end) {
                    document.getElementById('endTime').value = times.end;
                }
            });
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        if (error.message === 'No authentication token found') {
            window.location.href = '/doctor/login.html';
        } else {
            alert('Error loading profile data: ' + error.message);
        }
    }
}

async function updateProfile(e) {
    e.preventDefault();
    
    try {
        const token = localStorage.getItem('doctorToken');
        
        // Get selected working days and hours
        const workingDays = Array.from(document.getElementsByName('workingDays'))
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.value);

        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;

        if (!startTime || !endTime) {
            throw new Error('Please set working hours');
        }

        // Create schedule object
        const schedule = {};
        workingDays.forEach(day => {
            schedule[day.toLowerCase()] = {
                start: startTime,
                end: endTime
            };
        });

        const profileData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            phone: document.getElementById('phone').value,
            schedule: schedule
        };

        console.log('Updating profile with data:', profileData); // Debug log

        const response = await fetch('/api/doctor/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(profileData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to update profile');
        }

        alert('Profile updated successfully');
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Error updating profile: ' + error.message);
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
        const token = localStorage.getItem('doctorToken');
        const passwordData = {
            currentPassword: document.getElementById('currentPassword').value,
            newPassword: newPassword
        };

        const response = await fetch('/api/doctor/password', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(passwordData)
        });

        if (!response.ok) throw new Error('Failed to update password');

        alert('Password updated successfully');
        document.getElementById('passwordForm').reset();
    } catch (error) {
        alert('Error updating password');
    }
}

async function deleteAccount(e) {
    e.preventDefault();

    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
        return;
    }

    try {
        const token = localStorage.getItem('doctorToken');
        const password = document.getElementById('deletePassword').value;

        const response = await fetch('/api/doctor/profile', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ password })
        });

        if (!response.ok) throw new Error('Failed to delete account');

        localStorage.removeItem('doctorToken');
        window.location.href = '/index.html?doctorDeleted=true';
    } catch (error) {
        alert('Error deleting account');
    }
} 