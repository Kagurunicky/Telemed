document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        email: document.getElementById('email').value,
        password: document.getElementById('password').value
    };

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('userType', 'patient');
            window.location.href = '/dashboard.html';
        } else {
            const error = await response.json();
            alert(error.message || 'Invalid credentials');
        }
    } catch (error) {
        alert('Error during login');
    }
}); 