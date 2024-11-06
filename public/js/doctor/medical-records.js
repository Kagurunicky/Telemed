document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('doctorToken');
    if (!token) {
        window.location.href = '/doctor/login.html';
        return;
    }

    loadPatients();
    loadRecords();

    document.getElementById('uploadForm').addEventListener('submit', handleUpload);
    document.getElementById('patientFilter').addEventListener('change', loadRecords);
    document.getElementById('typeFilter').addEventListener('change', loadRecords);
});

async function loadPatients() {
    try {
        const token = localStorage.getItem('doctorToken');
        const response = await fetch('/api/doctor/patients', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load patients');

        const patients = await response.json();
        populatePatientSelects(patients);
    } catch (error) {
        console.error('Error loading patients:', error);
    }
}

function populatePatientSelects(patients) {
    const selects = ['patientSelect', 'patientFilter'];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        select.innerHTML = `<option value="">Select Patient</option>`;
        patients.forEach(patient => {
            const option = document.createElement('option');
            option.value = patient.id;
            option.textContent = `${patient.first_name} ${patient.last_name}`;
            select.appendChild(option);
        });
    });
}

async function handleUpload(e) {
    e.preventDefault();

    const formData = new FormData();
    formData.append('patientId', document.getElementById('patientSelect').value);
    formData.append('recordType', document.getElementById('recordType').value);
    formData.append('file', document.getElementById('recordFile').files[0]);
    formData.append('notes', document.getElementById('notes').value);

    try {
        const token = localStorage.getItem('doctorToken');
        const response = await fetch('/api/doctor/medical-records/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) throw new Error('Failed to upload record');

        alert('Record uploaded successfully');
        e.target.reset();
        loadRecords();
    } catch (error) {
        console.error('Error uploading record:', error);
        alert('Error uploading record');
    }
}

async function loadRecords() {
    try {
        const token = localStorage.getItem('doctorToken');
        const patientId = document.getElementById('patientFilter').value;
        const recordType = document.getElementById('typeFilter').value;

        const response = await fetch(
            `/api/doctor/medical-records?patientId=${patientId}&type=${recordType}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load records');

        const records = await response.json();
        displayRecords(records);
    } catch (error) {
        console.error('Error loading records:', error);
    }
}

function displayRecords(records) {
    const container = document.getElementById('recordsList');
    container.innerHTML = '';

    if (records.length === 0) {
        container.innerHTML = '<p class="no-records">No records found</p>';
        return;
    }

    records.forEach(record => {
        const card = document.createElement('div');
        card.className = 'record-card';
        card.innerHTML = `
            <div class="record-type">
                <i class="fas ${getRecordIcon(record.record_type)}"></i>
                <span>${record.record_type}</span>
            </div>
            <div class="record-info">
                <p><strong>Patient:</strong> ${record.patient_name}</p>
                <p><strong>Date:</strong> ${new Date(record.upload_date).toLocaleDateString()}</p>
                <p><strong>Notes:</strong> ${record.notes || 'N/A'}</p>
            </div>
            <div class="record-actions">
                <a href="/api/doctor/medical-records/download/${record.id}" 
                   class="btn-secondary" target="_blank">
                    <i class="fas fa-download"></i> Download
                </a>
            </div>
        `;
        container.appendChild(card);
    });
}

function getRecordIcon(type) {
    const icons = {
        'Lab Results': 'fa-flask',
        'X-Ray': 'fa-x-ray',
        'Prescription': 'fa-prescription',
        'Medical History': 'fa-file-medical',
        'Other': 'fa-file'
    };
    return icons[type] || 'fa-file';
} 