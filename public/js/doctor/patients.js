document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('doctorToken');
    if (!token) {
        window.location.href = '/doctor/login.html';
        return;
    }

    loadPatients();

    document.getElementById('searchPatient').addEventListener('input', debounce(loadPatients, 300));
    document.getElementById('filterVisits').addEventListener('change', loadPatients);
});

async function loadPatients() {
    try {
        const token = localStorage.getItem('doctorToken');
        const searchTerm = document.getElementById('searchPatient').value;
        const filter = document.getElementById('filterVisits').value;

        const response = await fetch(`/api/doctor/patients?search=${searchTerm}&filter=${filter}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load patients');

        const patients = await response.json();
        displayPatients(patients);
    } catch (error) {
        console.error('Error loading patients:', error);
    }
}

function displayPatients(patients) {
    const container = document.getElementById('patientsList');
    container.innerHTML = '';

    if (patients.length === 0) {
        container.innerHTML = '<p class="no-patients">No patients found</p>';
        return;
    }

    patients.forEach(patient => {
        const card = document.createElement('div');
        card.className = 'patient-card';
        card.innerHTML = `
            <div class="patient-info">
                <h3>${patient.first_name} ${patient.last_name}</h3>
                <p><i class="fas fa-phone"></i> ${patient.phone}</p>
                <p><i class="fas fa-calendar"></i> Last Visit: ${formatDate(patient.last_visit)}</p>
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
        const token = localStorage.getItem('doctorToken');
        const response = await fetch(`/api/doctor/patients/${patientId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load patient details');

        const patient = await response.json();
        displayPatientModal(patient);
    } catch (error) {
        console.error('Error loading patient details:', error);
    }
}

function displayPatientModal(patient) {
    document.getElementById('patientName').textContent = `${patient.first_name} ${patient.last_name}`;
    document.getElementById('patientAge').textContent = calculateAge(patient.date_of_birth);
    document.getElementById('patientGender').textContent = patient.gender;
    document.getElementById('patientPhone').textContent = patient.phone;

    // Display medical history
    const historyContainer = document.getElementById('medicalHistory');
    historyContainer.innerHTML = patient.appointments.map(apt => `
        <div class="history-item">
            <p><strong>Date:</strong> ${formatDate(apt.appointment_date)}</p>
            <p><strong>Diagnosis:</strong> ${apt.diagnosis || 'N/A'}</p>
            <p><strong>Prescription:</strong> ${apt.prescription || 'N/A'}</p>
        </div>
    `).join('');

    // Display appointment history
    const appointmentContainer = document.getElementById('appointmentHistory');
    appointmentContainer.innerHTML = patient.appointments.map(apt => `
        <div class="appointment-item ${apt.status}">
            <p><strong>Date:</strong> ${formatDate(apt.appointment_date)}</p>
            <p><strong>Time:</strong> ${apt.appointment_time}</p>
            <p><strong>Status:</strong> ${apt.status}</p>
        </div>
    `).join('');

    document.getElementById('patientModal').style.display = 'block';
}

function closePatientModal() {
    document.getElementById('patientModal').style.display = 'none';
}

// Utility functions
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
}

function calculateAge(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return `${age} years`;
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