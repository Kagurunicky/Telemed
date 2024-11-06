document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Load specializations on page load
    loadSpecializations();

    // Add event listeners
    document.getElementById('specialization').addEventListener('change', handleSpecializationChange);
    document.getElementById('doctor').addEventListener('change', handleDoctorChange);
    document.getElementById('appointmentDate').addEventListener('change', handleDateChange);
    document.getElementById('appointmentForm').addEventListener('submit', handleSubmit);

    // Set minimum date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('appointmentDate').min = tomorrow.toISOString().split('T')[0];
});

async function loadSpecializations() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/specializations', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load specializations');

        const specializations = await response.json();
        const select = document.getElementById('specialization');
        
        specializations.forEach(spec => {
            const option = document.createElement('option');
            option.value = spec.name;
            option.textContent = spec.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading specializations:', error);
        alert('Error loading specializations');
    }
}

async function handleSpecializationChange(e) {
    const specialization = e.target.value;
    if (!specialization) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/doctors?specialization=${encodeURIComponent(specialization)}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load doctors');

        const doctors = await response.json();
        console.log('Doctors data:', doctors);

        const select = document.getElementById('doctor');
        select.innerHTML = '<option value="">Select Doctor</option>';

        doctors.forEach(doctor => {
            const option = document.createElement('option');
            option.value = doctor.id;
            option.textContent = doctor.name;
            option.dataset.schedule = JSON.stringify(doctor.schedule);
            select.appendChild(option);
        });

        // Reset and disable time selection
        const timeSelect = document.getElementById('appointmentTime');
        timeSelect.innerHTML = '<option value="">Select Date First</option>';
        timeSelect.disabled = true;

        // Reset date selection
        document.getElementById('appointmentDate').value = '';
        document.getElementById('appointmentDate').disabled = false;
    } catch (error) {
        console.error('Error loading doctors:', error);
        alert('Error loading doctors');
    }
}

function handleDoctorChange() {
    const doctorSelect = document.getElementById('doctor');
    const selectedOption = doctorSelect.options[doctorSelect.selectedIndex];
    
    if (!selectedOption.value) {
        return;
    }

    // Enable date selection
    const dateInput = document.getElementById('appointmentDate');
    dateInput.disabled = false;
    
    // Set minimum date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateInput.min = tomorrow.toISOString().split('T')[0];
    
    // Reset time selection
    const timeSelect = document.getElementById('appointmentTime');
    timeSelect.innerHTML = '<option value="">Select Date First</option>';
    timeSelect.disabled = true;
}

async function handleDateChange(e) {
    const date = e.target.value;
    const doctorSelect = document.getElementById('doctor');
    const selectedOption = doctorSelect.options[doctorSelect.selectedIndex];
    
    console.log('Selected date:', date);
    console.log('Selected doctor:', selectedOption.value);
    
    if (!date || !selectedOption.value) {
        return;
    }

    const timeSelect = document.getElementById('appointmentTime');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const errorDiv = document.getElementById('timeSlotError');

    try {
        // Show loading state
        loadingIndicator.style.display = 'block';
        errorDiv.style.display = 'none';
        timeSelect.disabled = true;
        timeSelect.innerHTML = '<option value="">Loading slots...</option>';

        const token = localStorage.getItem('token');
        const response = await fetch(
            `/api/available-slots?doctorId=${selectedOption.value}&date=${date}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        const data = await response.json();
        console.log('Response:', data); // Debug log

        if (!response.ok) {
            throw new Error(data.error || 'Failed to load time slots');
        }

        timeSelect.innerHTML = '<option value="">Select Time</option>';

        if (!data || data.length === 0) {
            timeSelect.innerHTML = '<option value="">No available slots on this day</option>';
            return;
        }

        data.forEach(slot => {
            const option = document.createElement('option');
            option.value = slot;
            option.textContent = formatTime(slot);
            timeSelect.appendChild(option);
        });

        timeSelect.disabled = false;
    } catch (error) {
        console.error('Error loading time slots:', error);
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
        timeSelect.innerHTML = '<option value="">Error loading time slots</option>';
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

function formatTime(time) {
    try {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    } catch (error) {
        console.error('Error formatting time:', error);
        return time;
    }
}

function generateTimeSlots(start, end, duration, breakStart, breakEnd) {
    const slots = [];
    let currentTime = new Date(`2000-01-01 ${start}`);
    const endTime = new Date(`2000-01-01 ${end}`);
    const breakStartTime = breakStart ? new Date(`2000-01-01 ${breakStart}`) : null;
    const breakEndTime = breakEnd ? new Date(`2000-01-01 ${breakEnd}`) : null;

    while (currentTime < endTime) {
        // Skip break time
        if (breakStartTime && breakEndTime) {
            if (currentTime >= breakStartTime && currentTime < breakEndTime) {
                currentTime = new Date(breakEndTime);
                continue;
            }
        }

        slots.push(currentTime.toTimeString().slice(0, 5));
        currentTime.setMinutes(currentTime.getMinutes() + duration);
    }

    return slots;
}

async function handleSubmit(e) {
    e.preventDefault();
    
    const appointmentData = {
        doctorId: document.getElementById('doctor').value,
        appointmentDate: document.getElementById('appointmentDate').value,
        appointmentTime: document.getElementById('appointmentTime').value
    };

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/appointments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(appointmentData)
        });

        if (!response.ok) throw new Error('Failed to book appointment');

        alert('Appointment booked successfully!');
        window.location.href = '/view-appointments.html';
    } catch (error) {
        console.error('Error booking appointment:', error);
        alert('Error booking appointment');
    }
} 