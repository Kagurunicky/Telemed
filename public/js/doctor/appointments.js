function checkToken() {
    const token = localStorage.getItem('doctorToken');
    if (!token) return false;

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (!payload.role || payload.role !== 'doctor') {
            console.log('Invalid role in token:', payload.role);
            return false;
        }
        if (payload.exp * 1000 < Date.now()) {
            console.log('Token expired');
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error checking token:', error);
        return false;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    if (!checkToken()) {
        localStorage.removeItem('doctorToken');
        window.location.href = '/doctor/login.html';
        return;
    }

    loadAppointments();

    // Add event listeners for filters
    const statusFilter = document.getElementById('statusFilter');
    const dateFilter = document.getElementById('dateFilter');
    if (statusFilter) statusFilter.addEventListener('change', loadAppointments);
    if (dateFilter) dateFilter.addEventListener('change', loadAppointments);
});

async function loadAppointments() {
    try {
        const token = localStorage.getItem('doctorToken');
        if (!token) {
            throw new Error('No authentication token found');
        }

        const status = document.getElementById('statusFilter')?.value || '';
        const date = document.getElementById('dateFilter')?.value || '';

        console.log('Loading appointments with filters:', { status, date }); // Debug log

        let url = '/api/doctor/appointments';
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (date) params.append('date', date);
        if (params.toString()) url += `?${params.toString()}`;

        console.log('Fetching from URL:', url); // Debug log
        console.log('Using token:', token); // Debug log

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to load appointments');
        }

        const appointments = await response.json();
        console.log('Received appointments:', appointments); // Debug log
        displayAppointments(appointments);
    } catch (error) {
        console.error('Error loading appointments:', error);
        const container = document.getElementById('appointmentsList');
        container.innerHTML = `
            <div class="error-message">
                Error loading appointments: ${error.message}
                ${error.message === 'No authentication token found' ? 
                    '<br><a href="/doctor/login.html">Please login again</a>' : ''}
            </div>
        `;

        if (error.message.includes('Not authorized') || error.message.includes('Invalid token')) {
            localStorage.removeItem('doctorToken');
            setTimeout(() => {
                window.location.href = '/doctor/login.html';
            }, 2000);
        }
    }
}

function displayAppointments(appointments) {
    const container = document.getElementById('appointmentsList');
    container.innerHTML = '';

    if (!Array.isArray(appointments) || appointments.length === 0) {
        container.innerHTML = '<p class="no-appointments">No appointments found</p>';
        return;
    }

    appointments.forEach(appointment => {
        try {
            const card = document.createElement('div');
            card.className = `appointment-card ${appointment.status || 'scheduled'}`;
            
            // Format date and time safely
            const formattedDate = formatDate(appointment.appointment_date);
            const formattedTime = formatTime(appointment.appointment_time);

            card.innerHTML = `
                <div class="appointment-time">
                    <h4>${formattedDate}</h4>
                    <p>${formattedTime}</p>
                </div>
                <div class="appointment-info">
                    <h4>${appointment.patient_first_name || ''} ${appointment.patient_last_name || ''}</h4>
                    ${appointment.patient_phone ? 
                        `<p><i class="fas fa-phone"></i> ${appointment.patient_phone}</p>` : ''}
                    ${appointment.patient_email ? 
                        `<p><i class="fas fa-envelope"></i> ${appointment.patient_email}</p>` : ''}
                </div>
                <div class="appointment-status">
                    <span class="status-badge ${appointment.status || 'scheduled'}">
                        ${appointment.status || 'scheduled'}
                    </span>
                </div>
                <div class="appointment-actions">
                    ${appointment.status === 'scheduled' ? `
                        <button onclick="completeAppointment(${appointment.id})" class="btn-success">
                            Complete
                        </button>
                        <button onclick="cancelAppointment(${appointment.id})" class="btn-danger">
                            Cancel
                        </button>
                    ` : ''}
                </div>
            `;
            container.appendChild(card);
        } catch (error) {
            console.error('Error displaying appointment:', error, appointment);
        }
    });
}

function formatDate(dateString) {
    try {
        return new Date(dateString).toLocaleDateString();
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Invalid Date';
    }
}

function formatTime(timeString) {
    try {
        return timeString ? timeString.slice(0, 5) : 'No time set';
    } catch (error) {
        console.error('Error formatting time:', error);
        return 'Invalid Time';
    }
}

async function completeAppointment(appointmentId) {
    if (!confirm('Mark this appointment as completed?')) return;

    try {
        const token = localStorage.getItem('doctorToken');
        const response = await fetch(`/api/doctor/appointments/${appointmentId}/complete`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to complete appointment');
        }

        loadAppointments(); // Reload the appointments list
    } catch (error) {
        console.error('Error completing appointment:', error);
        alert('Error completing appointment: ' + error.message);
    }
}

async function cancelAppointment(appointmentId) {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;

    try {
        const token = localStorage.getItem('doctorToken');
        const response = await fetch(`/api/doctor/appointments/${appointmentId}/cancel`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to cancel appointment');
        }

        loadAppointments(); // Reload the appointments list
    } catch (error) {
        console.error('Error canceling appointment:', error);
        alert('Error canceling appointment: ' + error.message);
    }
} 