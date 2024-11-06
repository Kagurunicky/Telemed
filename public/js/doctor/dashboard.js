document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('doctorToken');
    const userType = localStorage.getItem('userType');

    if (!token || userType !== 'doctor') {
        window.location.href = '/doctor/login.html';
        return;
    }

    loadDashboardStats();
    loadTodayAppointments();

    document.getElementById('logout').addEventListener('click', function() {
        localStorage.removeItem('doctorToken');
        localStorage.removeItem('userType');
        window.location.href = '/doctor/login.html';
    });
});

async function loadDashboardStats() {
    try {
        const token = localStorage.getItem('doctorToken');
        const response = await fetch('/api/doctor/stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load stats');

        const stats = await response.json();
        
        document.getElementById('totalPatients').textContent = stats.totalPatients;
        document.getElementById('totalAppointments').textContent = stats.totalAppointments;
        document.getElementById('completedAppointments').textContent = stats.completedAppointments;
        document.getElementById('upcomingAppointments').textContent = stats.upcomingAppointments;
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

async function loadTodayAppointments() {
    try {
        const token = localStorage.getItem('doctorToken');
        const response = await fetch('/api/doctor/appointments/today', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load appointments');

        const appointments = await response.json();
        displayTodayAppointments(appointments);
    } catch (error) {
        console.error('Error loading today\'s appointments:', error);
    }
}

function displayTodayAppointments(appointments) {
    const container = document.getElementById('todayAppointmentsList');
    container.innerHTML = '';

    if (appointments.length === 0) {
        container.innerHTML = '<p class="no-appointments">No appointments scheduled for today</p>';
        return;
    }

    appointments.forEach(appointment => {
        const card = document.createElement('div');
        card.className = 'appointment-card';
        
        card.innerHTML = `
            <div class="appointment-time">
                <h4>${appointment.appointment_time}</h4>
            </div>
            <div class="appointment-info">
                <h4>${appointment.patient_name}</h4>
                <p>${appointment.reason || 'General Consultation'}</p>
            </div>
            <div class="appointment-actions">
                <button onclick="startConsultation(${appointment.id})" 
                    class="btn-primary">Start Consultation</button>
            </div>
        `;
        
        container.appendChild(card);
    });
}

function startConsultation(appointmentId) {
    window.location.href = `/doctor/consultation.html?id=${appointmentId}`;
} 