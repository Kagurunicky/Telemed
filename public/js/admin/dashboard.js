document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        window.location.href = '/admin/login.html';
        return;
    }

    loadDashboardStats();
    loadAppointmentStats();
    loadDoctorSpecializationStats();

    document.getElementById('logout').addEventListener('click', function() {
        localStorage.removeItem('adminToken');
        window.location.href = '/admin/login.html';
    });

    document.getElementById('dateRange').addEventListener('change', loadDashboardStats);
});

async function loadDashboardStats() {
    try {
        const token = localStorage.getItem('adminToken');
        const dateRange = document.getElementById('dateRange').value;

        const response = await fetch(`/api/admin/stats?range=${dateRange}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to load statistics');
        }

        const stats = await response.json();
        console.log('Fetched stats:', stats); // Debug log
        
        // Update dashboard stats
        updateStatElement('totalDoctors', stats.totalDoctors);
        updateStatElement('totalPatients', stats.totalPatients);
        updateStatElement('todayAppointments', stats.todayAppointments);
        updateStatElement('totalAppointments', stats.totalAppointments);
        updateStatElement('completedAppointments', stats.completedAppointments);
        updateStatElement('canceledAppointments', stats.canceledAppointments);
        updateStatElement('activePatients', stats.activePatients);
        updateStatElement('newPatientsThisMonth', stats.newPatientsThisMonth);
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        showError('Failed to load dashboard statistics');
    }
}

// Helper function to safely update stat elements
function updateStatElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value || '0';
    }
}

// Helper function to show errors
function showError(message) {
    // You can implement this to show error messages to the admin
    console.error(message);
    alert(message);
}

async function loadAppointmentStats() {
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch('/api/admin/appointment-stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load appointment stats');

        const stats = await response.json();
        displayAppointmentChart(stats);
    } catch (error) {
        console.error('Error loading appointment stats:', error);
    }
}

function displayAppointmentChart(stats) {
    const ctx = document.getElementById('appointmentChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: stats.labels,
            datasets: [{
                label: 'Appointments',
                data: stats.data,
                borderColor: '#4CAF50',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Appointments Trend'
                }
            }
        }
    });
}

async function loadDoctorSpecializationStats() {
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch('/api/admin/specialization-stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load specialization stats');

        const stats = await response.json();
        displaySpecializationChart(stats);
    } catch (error) {
        console.error('Error loading specialization stats:', error);
    }
}

function displaySpecializationChart(stats) {
    const ctx = document.getElementById('specializationChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: stats.labels,
            datasets: [{
                data: stats.data,
                backgroundColor: [
                    '#4CAF50', '#2196F3', '#FFC107', '#F44336',
                    '#9C27B0', '#00BCD4', '#FF9800', '#795548'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Doctors by Specialization'
                }
            }
        }
    });
} 