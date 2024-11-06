document.getElementById('doctorSignupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get selected working days
    const workingDays = Array.from(document.getElementsByName('workingDays'))
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.value);

    // Create schedule object
    const schedule = {};
    workingDays.forEach(day => {
        schedule[day] = {
            start: document.getElementById('startTime').value,
            end: document.getElementById('endTime').value
        };
    });

    const formData = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        phone: document.getElementById('phone').value,
        specialization: document.getElementById('specialization').value,
        schedule: schedule
    };

    try {
        const response = await fetch('/api/doctor/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            alert('Registration successful! Please login to continue.');
            window.location.href = '/doctor/login.html';
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Registration failed');
        }
    } catch (error) {
        alert(error.message || 'Error during registration');
    }
}); 