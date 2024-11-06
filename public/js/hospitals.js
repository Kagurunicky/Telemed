
let map;
let markers = [];
let currentPosition;

document.addEventListener('DOMContentLoaded', function() {
    initMap();
    document.getElementById('searchRadius').addEventListener('change', searchHospitals);
});

function initMap() {
    // Initialize with Kenya's center coordinates
    const kenyaCenter = { lat: 0.0236, lng: 37.9062 };
    
    map = L.map('map').setView([kenyaCenter.lat, kenyaCenter.lng], 7);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Try to get user's location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                currentPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                // Add marker for user's location
                L.marker([currentPosition.lat, currentPosition.lng], {
                    icon: L.divIcon({
                        className: 'user-location-marker',
                        html: '<i class="fas fa-user-circle"></i>'
                    })
                }).addTo(map);

                map.setView([currentPosition.lat, currentPosition.lng], 12);
                searchHospitals();
            },
            error => {
                console.error('Error getting location:', error);
                searchHospitals(kenyaCenter);
            }
        );
    } else {
        searchHospitals(kenyaCenter);
    }
}

async function searchHospitals(center = currentPosition) {
    try {
        startSearch();
        clearMarkers();
        const radius = document.getElementById('searchRadius').value;
        
        const response = await fetch(`/api/hospitals/nearby?lat=${center.lat}&lng=${center.lng}&radius=${radius}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) throw new Error('Failed to fetch hospitals');

        const hospitals = await response.json();
        displayHospitals(hospitals);
    } catch (error) {
        console.error('Error searching hospitals:', error);
        showError('Error searching for hospitals. Please try again.');
    }
}

function displayHospitals(hospitals) {
    const list = document.getElementById('hospitalsList');
    const loadingIndicator = document.getElementById('loadingIndicator');
    loadingIndicator.style.display = 'none';
    list.innerHTML = '';

    const bounds = L.latLngBounds();

    hospitals.forEach(hospital => {
        const position = [parseFloat(hospital.latitude), parseFloat(hospital.longitude)];
        
        // Add marker
        const marker = L.marker(position).addTo(map);
        markers.push(marker);

        // Add popup
        marker.bindPopup(`
            <div class="info-window">
                <h3>${hospital.name}</h3>
                <p>${hospital.location}</p>
                <p><strong>Phone:</strong> ${hospital.phone}</p>
                <p><strong>Services:</strong> ${hospital.services}</p>
            </div>
        `);

        bounds.extend(position);

        // Add list item
        const listItem = document.createElement('div');
        listItem.className = 'hospital-item';
        listItem.innerHTML = `
            <h3>${hospital.name}</h3>
            <p><i class="fas fa-map-marker-alt"></i> ${hospital.location}, ${hospital.county}</p>
            <p><i class="fas fa-phone"></i> ${hospital.phone}</p>
            <p><i class="fas fa-clock"></i> ${hospital.operating_hours}</p>
            <div class="hospital-actions">
                <button onclick="getDirections(${hospital.latitude}, ${hospital.longitude})" class="btn-directions">
                    <i class="fas fa-directions"></i> Get Directions
                </button>
            </div>
        `;

        list.appendChild(listItem);
    });

    // Fit map to bounds
    if (bounds.isValid()) {
        map.fitBounds(bounds);
    }
}

function getDirections(lat, lng) {
    if (!currentPosition) {
        alert('Please enable location services to get directions');
        return;
    }

    // Open directions in OpenStreetMap
    const url = `https://www.openstreetmap.org/directions?from=${currentPosition.lat},${currentPosition.lng}&to=${lat},${lng}`;
    window.open(url, '_blank');
}

function clearMarkers() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
}

function useCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                currentPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                map.setView([currentPosition.lat, currentPosition.lng], 12);
                searchHospitals();
            },
            error => {
                console.error('Error getting location:', error);
                alert('Error getting your location. Please enable location services.');
            }
        );
    } else {
        alert('Geolocation is not supported by your browser');
    }
}

function startSearch() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    loadingIndicator.style.display = 'block';
    document.getElementById('errorMessage').style.display = 'none';
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}
