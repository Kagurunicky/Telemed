document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        window.location.href = '/admin/login.html';
        return;
    }

    loadPatients();

    // Add event listeners
    document.getElementById('searchPatient').addEventListener('input', debounce(loadPatients, 300));
    document.getElementById('statusFilter').addEventListener('change', loadPatients);
});

async function loadPatients() {
    try {
        const token = localStorage.getItem('adminToken');
        const searchTerm = document.getElementById('searchPatient').value;
        const status = document.getElementById('statusFilter').value;

        const response = await fetch(
            `/api/admin/patients?search=${searchTerm}&status=${status}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        if (!response.ok) throw new Error('Failed to load patients');

        const patients = await response.json();
        displayPatients(patients);
    } catch (error) {
        console.error('Error loading patients:', error);
        showError('Failed to load patients');
    }
}

function displayPatients(patients) {
    const container = document.getElementById('patientsList');
    container.innerHTML = '';

    if (patients.length === 0) {
        container.innerHTML = '<p class="no-data">No patients found</p>';
        return;
    }

    patients.forEach(patient => {
        const card = document.createElement('div');
        card.className = 'patient-card';
        card.innerHTML = `
            <div class="patient-info">
                <h3>${patient.first_name} ${patient.last_name}</h3>
                <p><i class="fas fa-envelope"></i> ${patient.email}</p>
                <p><i class="fas fa-phone"></i> ${patient.phone}</p>
            </div>
            <div class="patient-stats">
                <p>Total Appointments: ${patient.appointment_count || 0}</p>
                <p>Last Visit: ${patient.last_visit || 'Never'}</p>
            </div>
            <div class="patient-actions">
                <button onclick="viewPatientDetails(${patient.id})" class="btn-primary">
                    View Details
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

async function viewPatientDetails(patientId) {
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(`/api/admin/patients/${patientId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load patient details');

        const patient = await response.json();
        displayPatientModal(patient);
    } catch (error) {
        console.error('Error loading patient details:', error);
        showError('Failed to load patient details');
    }
}

function displayPatientModal(patient) {
    const modal = document.getElementById('patientModal');
    const detailsContainer = document.getElementById('patientDetails');

    detailsContainer.innerHTML = `
        <div class="patient-profile">
            <h4>Personal Information</h4>
            <p><strong>Name:</strong> ${patient.first_name} ${patient.last_name}</p>
            <p><strong>Email:</strong> ${patient.email}</p>
            <p><strong>Phone:</strong> ${patient.phone}</p>
            <p><strong>Gender:</strong> ${patient.gender}</p>
            <p><strong>Date of Birth:</strong> ${new Date(patient.date_of_birth).toLocaleDateString()}</p>
            <p><strong>Address:</strong> ${patient.address}</p>
        </div>
        <div class="appointment-history">
            <h4>Appointment History</h4>
            ${generateAppointmentHistory(patient.appointments)}
        </div>
    `;

    modal.style.display = 'block';
}

function generateAppointmentHistory(appointments) {
    if (!appointments || appointments.length === 0) {
        return '<p>No appointment history</p>';
    }

    return appointments.map(apt => `
        <div class="appointment-item ${apt.status}">
            <p><strong>Date:</strong> ${new Date(apt.appointment_date).toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${apt.appointment_time}</p>
            <p><strong>Doctor:</strong> Dr. ${apt.doctor_name}</p>
            <p><strong>Status:</strong> ${apt.status}</p>
        </div>
    `).join('');
}

function closePatientModal() {
    document.getElementById('patientModal').style.display = 'none';
}

function showError(message) {
    alert(message);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
} 