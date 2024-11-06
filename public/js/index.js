document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('deleted') === 'true') {
        alert('Your account has been successfully deleted. We\'re sorry to see you go!');
        // Remove the query parameter
        window.history.replaceState({}, document.title, '/');
    }
}); 