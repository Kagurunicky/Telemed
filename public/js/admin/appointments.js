document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        window.location.href = '/admin/login.html';
        return;
    }

    loadAppointments();

    // Add event listeners
    document.getElementById('dateFilter').addEventListener('change', loadAppointments);
    document.getElementById('statusFilter').addEventListener('change', loadAppointments);
});

async function loadAppointments() {
    try {
        const token = localStorage.getItem('adminToken');
        const date = document.getElementById('dateFilter').value;
        const status = document.getElementById('statusFilter').value;

        const response = await fetch(
            `/api/admin/appointments?date=${date}&status=${status}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        if (!response.ok) throw new Error('Failed to load appointments');

        const appointments = await response.json();
        displayAppointments(appointments);
    } catch (error) {
        console.error('Error loading appointments:', error);
        showError('Failed to load appointments');
    }
}

function displayAppointments(appointments) {
    const container = document.getElementById('appointmentsList');
    container.innerHTML = '';

    if (appointments.length === 0) {
        container.innerHTML = '<p class="no-data">No appointments found</p>';
        return;
    }

    appointments.forEach(appointment => {
        const card = document.createElement('div');
        card.className = `appointment-card ${appointment.status}`;
        card.innerHTML = `
            <div class="appointment-time">
                <h4>${new Date(appointment.appointment_date).toLocaleDateString()}</h4>
                <p>${appointment.appointment_time}</p>
            </div>
            <div class="appointment-info">
                <p><strong>Patient:</strong> ${appointment.patient_name}</p>
                <p><strong>Doctor:</strong> Dr. ${appointment.doctor_name}</p>
                <p><strong>Status:</strong> ${appointment.status}</p>
            </div>
            ${appointment.status === 'scheduled' ? `
                <div class="appointment-actions">
                    <button onclick="updateAppointmentStatus(${appointment.id}, 'completed')" class="btn-success">
                        Mark Complete
                    </button>
                    <button onclick="updateAppointmentStatus(${appointment.id}, 'canceled')" class="btn-danger">
                        Cancel
                    </button>
                </div>
            ` : ''}
        `;
        container.appendChild(card);
    });
}

async function updateAppointmentStatus(appointmentId, status) {
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(`/api/admin/appointments/${appointmentId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });

        if (!response.ok) throw new Error('Failed to update appointment status');

        loadAppointments(); // Reload appointments
    } catch (error) {
        console.error('Error updating appointment:', error);
        showError('Failed to update appointment status');
    }
}

function showError(message) {
    alert(message);
} 