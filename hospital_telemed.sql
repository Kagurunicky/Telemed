-- Create the database
CREATE DATABASE IF NOT EXISTS hospital_telemed;
USE hospital_telemed;

-- Create Patients table
CREATE TABLE patients (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender ENUM('M', 'F', 'Other') NOT NULL,
    address TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create Doctors table
CREATE TABLE doctors (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    specialization VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    schedule JSON NOT NULL, -- Stores available days and times in JSON format
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status ENUM('active', 'inactive') DEFAULT 'active'
);

-- Create Appointments table
CREATE TABLE appointments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    patient_id BIGINT NOT NULL,
    doctor_id BIGINT NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    status ENUM('scheduled', 'completed', 'canceled') DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    reschedule_count INT DEFAULT 0,
    previous_date DATE,
    previous_time TIME,
    cancellation_reason TEXT
);

-- Add indexes for better query performance
CREATE INDEX idx_patient_email ON patients(email);
CREATE INDEX idx_doctor_email ON doctors(email);
CREATE INDEX idx_appointment_date ON appointments(appointment_date);
CREATE INDEX idx_appointment_status ON appointments(status);

-- Add Medical Records table
CREATE TABLE medical_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    patient_id BIGINT NOT NULL,
    doctor_id BIGINT NOT NULL,
    record_type VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

-- Add Hospitals table
CREATE TABLE hospitals (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(100) NOT NULL,
    county VARCHAR(50) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    services TEXT,
    operating_hours TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample Kenyan hospitals
INSERT INTO hospitals (name, location, county, latitude, longitude, phone, email, services, operating_hours) VALUES
('Kenyatta National Hospital', 'Hospital Road, Upper Hill', 'Nairobi', -1.2999, 36.8067, '+254 20 2726300', 'info@knh.or.ke', 'Emergency Care, Surgery, Pediatrics, Maternity', '24/7'),
('Aga Khan University Hospital', 'Third Parklands Avenue', 'Nairobi', -1.2631, 36.8176, '+254 20 366 2000', 'info@aku.edu', 'Emergency Care, Surgery, Cardiology, Oncology', '24/7'),
('Nairobi Hospital', 'Argwings Kodhek Road', 'Nairobi', -1.2929, 36.7989, '+254 20 284 5000', 'info@nairobihospital.org', 'Emergency Care, Surgery, Pediatrics', '24/7'),
('Moi Teaching and Referral Hospital', 'Nandi Road', 'Uasin Gishu', 0.5143, 35.2710, '+254 53 203 3471', 'info@mtrh.go.ke', 'Emergency Care, Teaching, Research', '24/7'),
('Coast General Hospital', 'Moi Avenue', 'Mombasa', -4.0435, 39.6682, '+254 41 231 4204', 'info@cpgh.go.ke', 'Emergency Care, Surgery, Maternity', '24/7');

-- Create Admin table
CREATE TABLE admin (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role ENUM('super_admin', 'admin', 'moderator') DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default admin with clear password indication
-- Username: admin
-- Password: Admin@123
-- Email: admin@pendomedicare.com
INSERT INTO admin (username, password_hash, email, role) VALUES
('admin', '$2b$10$5QFB6jR4K2rKxH3zgZzS8.ZB7HhvtX.t0AgLwqoUQ9KoYrGHuI.Vy', 'admin@pendomedicare.com', 'super_admin');