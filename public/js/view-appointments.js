document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    document.getElementById('logout').addEventListener('click', function() {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
    });

    loadAppointments();
    document.getElementById('statusFilter').addEventListener('change', loadAppointments);
});

async function loadAppointments() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No authentication token found');
        }

        const status = document.getElementById('statusFilter').value;
        console.log('Loading appointments with status:', status);
        
        const response = await fetch(`/api/patient/appointments?status=${status}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
            if (response.status === 403) {
                localStorage.removeItem('token');
                window.location.href = '/login.html';
                return;
            }
            const error = await response.json();
            throw new Error(error.message || 'Failed to load appointments');
        }

        const appointments = await response.json();
        console.log('Fetched appointments:', appointments);
        displayAppointments(appointments);
    } catch (error) {
        console.error('Error loading appointments:', error);
        document.getElementById('appointmentsList').innerHTML = `
            <div class="error-message">
                ${error.message || 'Error loading appointments'}
            </div>
        `;
    }
}

function displayAppointments(appointments) {
    const container = document.getElementById('appointmentsList');
    container.innerHTML = '';

    if (appointments.length === 0) {
        container.innerHTML = '<p class="no-appointments">No appointments found.</p>';
        return;
    }

    appointments.forEach(appointment => {
        const card = document.createElement('div');
        card.className = `appointment-card ${appointment.status}`;
        
        const date = new Date(appointment.appointment_date).toLocaleDateString();
        const canModify = appointment.status === 'scheduled';
        
        card.innerHTML = `
            <div class="appointment-header">
                <h3>Dr. ${appointment.doctor_first_name} ${appointment.doctor_last_name}</h3>
                <span class="status-badge ${appointment.status}">${appointment.status}</span>
            </div>
            <div class="appointment-details">
                <p><strong>Specialization:</strong> ${appointment.specialization}</p>
                <p><strong>Date:</strong> ${date}</p>
                <p><strong>Time:</strong> ${formatTime(appointment.appointment_time)}</p>
                ${appointment.previous_date ? `
                    <p class="reschedule-info">
                        <em>Rescheduled from: ${new Date(appointment.previous_date).toLocaleDateString()} 
                        ${formatTime(appointment.previous_time)}</em>
                    </p>
                ` : ''}
                ${appointment.cancellation_reason ? `
                    <p class="cancellation-reason">
                        <strong>Cancellation Reason:</strong> ${appointment.cancellation_reason}
                    </p>
                ` : ''}
            </div>
            ${canModify ? `
                <div class="appointment-actions">
                    <button onclick="rescheduleAppointment(${appointment.id})" class="btn-secondary">
                        <i class="fas fa-calendar-alt"></i> Reschedule
                    </button>
                    <button onclick="cancelAppointment(${appointment.id})" class="btn-danger">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            ` : ''}
        `;
        
        container.appendChild(card);
    });
}

async function rescheduleAppointment(appointmentId) {
    try {
        const response = await fetch(`/api/appointments/${appointmentId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) throw new Error('Failed to get appointment details');

        const appointment = await response.json();
        
        // Populate reschedule modal
        document.getElementById('appointmentId').value = appointmentId;
        document.getElementById('rescheduleModal').style.display = 'block';
        
        // Set minimum date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateInput = document.getElementById('newDate');
        dateInput.min = tomorrow.toISOString().split('T')[0];
        
        // Load available time slots when date is selected
        dateInput.addEventListener('change', async (e) => {
            await loadAvailableTimeSlots(appointment.doctor_id, e.target.value);
        });
    } catch (error) {
        console.error('Error getting appointment details:', error);
        alert('Error loading appointment details');
    }
}

async function loadAvailableTimeSlots(doctorId, date) {
    try {
        const response = await fetch(`/api/available-slots?doctorId=${doctorId}&date=${date}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) throw new Error('Failed to load time slots');

        const slots = await response.json();
        const timeSelect = document.getElementById('newTime');
        timeSelect.innerHTML = '<option value="">Select Time</option>';
        
        slots.forEach(slot => {
            const option = document.createElement('option');
            option.value = slot;
            option.textContent = formatTime(slot);
            timeSelect.appendChild(option);
        });
        
        timeSelect.disabled = false;
    } catch (error) {
        console.error('Error loading time slots:', error);
        alert('Error loading available time slots');
    }
}

function cancelAppointment(appointmentId) {
    document.getElementById('cancelAppointmentId').value = appointmentId;
    document.getElementById('cancelModal').style.display = 'block';
}

// Form submission handlers
document.getElementById('rescheduleForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const appointmentId = document.getElementById('appointmentId').value;
    const newDate = document.getElementById('newDate').value;
    const newTime = document.getElementById('newTime').value;

    try {
        const response = await fetch(`/api/appointments/${appointmentId}/reschedule`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ newDate, newTime })
        });

        if (!response.ok) throw new Error('Failed to reschedule appointment');

        document.getElementById('rescheduleModal').style.display = 'none';
        loadAppointments();
        alert('Appointment rescheduled successfully');
    } catch (error) {
        console.error('Error rescheduling appointment:', error);
        alert('Error rescheduling appointment');
    }
});

document.getElementById('cancelForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const appointmentId = document.getElementById('cancelAppointmentId').value;
    const reason = document.getElementById('cancellationReason').value;

    try {
        const response = await fetch(`/api/appointments/${appointmentId}/cancel`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ reason })
        });

        if (!response.ok) throw new Error('Failed to cancel appointment');

        document.getElementById('cancelModal').style.display = 'none';
        loadAppointments();
        alert('Appointment cancelled successfully');
    } catch (error) {
        console.error('Error cancelling appointment:', error);
        alert('Error cancelling appointment');
    }
});

// Utility functions
function formatTime(timeString) {
    try {
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    } catch (error) {
        return timeString;
    }
}

// Modal close functions
function closeRescheduleModal() {
    document.getElementById('rescheduleModal').style.display = 'none';
    document.getElementById('rescheduleForm').reset();
}

function closeCancelModal() {
    document.getElementById('cancelModal').style.display = 'none';
    document.getElementById('cancelForm').reset();
}

// Add event listeners for modal close buttons
document.querySelectorAll('.modal .btn-secondary').forEach(button => {
    button.addEventListener('click', () => {
        button.closest('.modal').style.display = 'none';
    });
});