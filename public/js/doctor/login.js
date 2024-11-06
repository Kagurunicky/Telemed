document.getElementById('doctorLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        email: document.getElementById('email').value,
        password: document.getElementById('password').value
    };

    try {
        const response = await fetch('/api/doctor/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Invalid credentials');
        }

        const data = await response.json();
        localStorage.setItem('doctorToken', data.token);
        localStorage.setItem('userType', 'doctor');
        localStorage.setItem('doctorData', JSON.stringify(data.doctor));
        
        window.location.href = '/doctor/dashboard.html';
    } catch (error) {
        console.error('Login error:', error);
        alert(error.message || 'Error during login');
    }
}); 