document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        window.location.href = '/admin/login.html';
        return;
    }

    loadDoctors();
    loadSpecializations();

    // Add event listeners
    document.getElementById('searchDoctor').addEventListener('input', debounce(loadDoctors, 300));
    document.getElementById('specializationFilter').addEventListener('change', loadDoctors);
    document.getElementById('statusFilter').addEventListener('change', loadDoctors);
    document.getElementById('doctorForm').addEventListener('submit', handleDoctorSubmit);
});

async function loadDoctors() {
    try {
        const token = localStorage.getItem('adminToken');
        const searchTerm = document.getElementById('searchDoctor').value;
        const specialization = document.getElementById('specializationFilter').value;
        const status = document.getElementById('statusFilter').value;

        const response = await fetch(
            `/api/admin/doctors?search=${searchTerm}&specialization=${specialization}&status=${status}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        if (!response.ok) throw new Error('Failed to load doctors');

        const doctors = await response.json();
        displayDoctors(doctors);
    } catch (error) {
        console.error('Error loading doctors:', error);
        showError('Failed to load doctors');
    }
}

function displayDoctors(doctors) {
    const container = document.getElementById('doctorsList');
    container.innerHTML = '';

    if (doctors.length === 0) {
        container.innerHTML = '<p class="no-data">No doctors found</p>';
        return;
    }

    doctors.forEach(doctor => {
        const card = document.createElement('div');
        card.className = `doctor-card ${doctor.status}`;
        card.innerHTML = `
            <div class="doctor-info">
                <h3>Dr. ${doctor.first_name} ${doctor.last_name}</h3>
                <p><i class="fas fa-stethoscope"></i> ${doctor.specialization}</p>
                <p><i class="fas fa-envelope"></i> ${doctor.email}</p>
                <p><i class="fas fa-phone"></i> ${doctor.phone}</p>
                <p><i class="fas fa-circle ${doctor.status}"></i> ${doctor.status}</p>
            </div>
            <div class="doctor-stats">
                <p>Total Appointments: ${doctor.appointment_count || 0}</p>
                <p>Completed Appointments: ${doctor.completed_appointments || 0}</p>
            </div>
            <div class="doctor-actions">
                <button onclick="editDoctor(${doctor.id})" class="btn-secondary">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button onclick="toggleDoctorStatus(${doctor.id}, '${doctor.status}')" 
                    class="btn-${doctor.status === 'active' ? 'danger' : 'success'}">
                    <i class="fas fa-${doctor.status === 'active' ? 'ban' : 'check'}"></i>
                    ${doctor.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

async function toggleDoctorStatus(doctorId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const action = currentStatus === 'active' ? 'deactivate' : 'activate';
    
    if (!confirm(`Are you sure you want to ${action} this doctor?`)) {
        return;
    }

    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(`/api/admin/doctors/${doctorId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) throw new Error(`Failed to ${action} doctor`);

        loadDoctors(); // Reload the doctors list
    } catch (error) {
        console.error('Error updating doctor status:', error);
        showError(`Failed to ${action} doctor`);
    }
}

async function loadSpecializations() {
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch('/api/admin/specializations', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load specializations');

        const specializations = await response.json();
        const select = document.getElementById('specializationFilter');
        
        specializations.forEach(spec => {
            const option = document.createElement('option');
            option.value = spec;
            option.textContent = spec;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading specializations:', error);
    }
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