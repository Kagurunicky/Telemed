const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool, testConnection } = require('./config/database');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Test database connection on startup
testConnection();

// Authentication middleware
function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            console.log('No token provided');
            return res.status(401).json({ message: 'No token provided' });
        }

        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) {
                console.log('Token verification error:', err);
                return res.status(403).json({ message: 'Invalid token' });
            }

            req.user = user;
            console.log('Authenticated user:', user); // Debug log
            next();
        });
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({ message: 'Authentication error' });
    }
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Database connection state middleware
app.use(async (req, res, next) => {
    try {
        const connection = await pool.getConnection();
        connection.release();
        next();
    } catch (error) {
        res.status(500).json({ error: 'Database connection error' });
    }
});

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/medical-records')
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`)
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        if (!allowedTypes.includes(file.mimetype)) {
            cb(new Error('Invalid file type'));
            return;
        }
        cb(null, true);
    }
});

// Routes
app.post('/api/signup', async (req, res) => {
    try {
        const { firstName, lastName, email, password, phone, dateOfBirth, gender, address } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const [result] = await pool.execute(
            'INSERT INTO patients (first_name, last_name, email, password_hash, phone, date_of_birth, gender, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [firstName, lastName, email, hashedPassword, phone, dateOfBirth, gender, address]
        );
        
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const [rows] = await pool.execute(
            'SELECT * FROM patients WHERE email = ?',
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(password, rows[0].password_hash);
        if (!valid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Create token with all necessary user data
        const token = jwt.sign(
            {
                id: rows[0].id,
                email: rows[0].email,
                firstName: rows[0].first_name,
                lastName: rows[0].last_name,
                role: 'patient'
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ 
            token,
            user: {
                id: rows[0].id,
                firstName: rows[0].first_name,
                lastName: rows[0].last_name,
                email: rows[0].email
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Error during login' });
    }
});

app.post('/api/appointments', authenticateToken, async (req, res) => {
    try {
        const { doctorId, appointmentDate, appointmentTime } = req.body;
        const patientId = req.user.id;

        const [result] = await pool.execute(
            'INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time) VALUES (?, ?, ?, ?)',
            [patientId, doctorId, appointmentDate, appointmentTime]
        );

        res.status(201).json({ message: 'Appointment booked successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/appointments', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT a.*, d.first_name as doctor_first_name, d.last_name as doctor_last_name, d.specialization 
             FROM appointments a 
             JOIN doctors d ON a.doctor_id = d.id 
             WHERE a.patient_id = ?`,
            [req.user.id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get available time slots
app.get('/api/available-slots', authenticateToken, async (req, res) => {
    try {
        const { doctorId, date } = req.query;
        console.log('Fetching slots for:', { doctorId, date });

        // Get doctor's schedule
        const [doctorRows] = await pool.execute(
            'SELECT schedule FROM doctors WHERE id = ?',
            [doctorId]
        );

        if (doctorRows.length === 0) {
            return res.status(404).json({ error: 'Doctor not found' });
        }

        // Parse schedule
        let schedule;
        try {
            schedule = JSON.parse(doctorRows[0].schedule || '{}');
            console.log('Doctor schedule:', schedule);
        } catch (error) {
            console.error('Error parsing schedule:', error);
            return res.status(500).json({ error: 'Invalid schedule format' });
        }

        // Get day of week
        const dayOfWeek = new Date(date)
            .toLocaleDateString('en-US', { weekday: 'long' })
            .toLowerCase();
        console.log('Day of week:', dayOfWeek);

        // Get working hours for that day
        const daySchedule = schedule[dayOfWeek];
        if (!daySchedule || !daySchedule.start || !daySchedule.end) {
            console.log('No schedule found for this day');
            return res.json([]);
        }

        // Generate time slots
        const slots = [];
        let currentTime = new Date(`2000-01-01 ${daySchedule.start}`);
        const endTime = new Date(`2000-01-01 ${daySchedule.end}`);
        const interval = 30; // 30-minute slots

        while (currentTime < endTime) {
            slots.push(currentTime.toTimeString().slice(0, 5));
            currentTime.setMinutes(currentTime.getMinutes() + interval);
        }
        console.log('Generated slots:', slots);

        // Get booked appointments
        const [bookedSlots] = await pool.execute(
            `SELECT appointment_time 
             FROM appointments 
             WHERE doctor_id = ? 
             AND appointment_date = ? 
             AND status = 'scheduled'`,
            [doctorId, date]
        );
        console.log('Booked slots:', bookedSlots);

        // Filter out booked slots
        const availableSlots = slots.filter(slot => 
            !bookedSlots.some(booked => 
                booked.appointment_time.slice(0, 5) === slot
            )
        );

        console.log('Available slots:', availableSlots);
        res.json(availableSlots);
    } catch (error) {
        console.error('Error getting available slots:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/hospitals', async (req, res) => {
    // This would typically integrate with a maps API
    const mockHospitals = [
        { id: 1, name: "Central Hospital", distance: "2.5km", address: "123 Main St" },
        { id: 2, name: "City Medical Center", distance: "3.8km", address: "456 Oak Ave" }
    ];
    res.json(mockHospitals);
});

// Get specializations
app.get('/api/specializations', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT DISTINCT specialization as name FROM doctors');
        res.json(rows.map((row, index) => ({ id: index + 1, name: row.name })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get doctors by specialization with schedule
app.get('/api/doctors', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT id, first_name, last_name, schedule, specialization 
             FROM doctors 
             WHERE specialization = ?`,
            [req.query.specialization]
        );

        // Format the schedule for each doctor
        const doctors = rows.map(doctor => {
            let schedule = {};
            try {
                schedule = JSON.parse(doctor.schedule);
            } catch (error) {
                console.error('Error parsing schedule for doctor:', doctor.id);
                schedule = {};
            }

            return {
            id: doctor.id,
            name: `Dr. ${doctor.first_name} ${doctor.last_name}`,
            specialization: doctor.specialization,
                schedule: schedule
            };
        });

        res.json(doctors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get available time slots
app.get('/api/available-slots', authenticateToken, async (req, res) => {
    try {
        const { doctorId, date } = req.query;
        
        // Get doctor's schedule
        const [doctorRows] = await pool.execute(
            'SELECT schedule FROM doctors WHERE id = ?',
            [doctorId]
        );

        if (doctorRows.length === 0) {
            return res.status(404).json({ message: 'Doctor not found' });
        }

        // Parse schedule
        const schedule = JSON.parse(doctorRows[0].schedule);
        const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'lowercase' });
        
        // Get booked slots
        const [bookedSlots] = await pool.execute(
            `SELECT appointment_time 
             FROM appointments 
             WHERE doctor_id = ? 
             AND appointment_date = ? 
             AND status = 'scheduled'`,
            [doctorId, date]
        );

        // Generate available slots based on schedule
        const availableSlots = generateTimeSlots(schedule[dayOfWeek], bookedSlots);
        res.json(availableSlots);
    } catch (error) {
        console.error('Error getting available slots:', error);
        res.status(500).json({ message: 'Error getting available slots' });
    }
});

// Helper function to generate time slots
function generateTimeSlots(daySchedule, bookedSlots) {
    if (!daySchedule || !daySchedule.start || !daySchedule.end) {
        return [];
    }

    const slots = [];
    const start = new Date(`2000-01-01 ${daySchedule.start}`);
    const end = new Date(`2000-01-01 ${daySchedule.end}`);
    const interval = 30; // 30 minutes interval

    while (start < end) {
        const timeSlot = start.toTimeString().slice(0, 5);
        if (!bookedSlots.some(slot => slot.appointment_time === timeSlot)) {
            slots.push(timeSlot);
        }
        start.setMinutes(start.getMinutes() + interval);
    }

    return slots;
}

// Add these new routes to your existing server.js

// Reschedule appointment
app.put('/api/appointments/:id/reschedule', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        const { id } = req.params;
        const { newDate, newTime } = req.body;
        
        // Get current appointment details
        const [current] = await connection.execute(
            'SELECT appointment_date, appointment_time, reschedule_count FROM appointments WHERE id = ? AND patient_id = ?',
            [id, req.user.id]
        );
        
        if (current.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Appointment not found' });
        }
        
        // Update appointment with new details
        await connection.execute(
            `UPDATE appointments 
             SET appointment_date = ?, 
                 appointment_time = ?,
                 previous_date = ?,
                 previous_time = ?,
                 reschedule_count = reschedule_count + 1
             WHERE id = ? AND patient_id = ?`,
            [newDate, newTime, current[0].appointment_date, current[0].appointment_time, id, req.user.id]
        );
        
        await connection.commit();
        res.json({ message: 'Appointment rescheduled successfully' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// Cancel appointment with reason
app.put('/api/appointments/:id/cancel', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        const { id } = req.params;
        const { reason } = req.body;
        
        const [result] = await connection.execute(
            `UPDATE appointments 
             SET status = 'canceled',
                 cancellation_reason = ?
             WHERE id = ? AND patient_id = ? AND status = 'scheduled'`,
            [reason, id, req.user.id]
        );
        
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Appointment not found or already modified' });
        }
        
        await connection.commit();
        res.json({ message: 'Appointment canceled successfully' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// Get nearby hospitals
app.get('/api/hospitals/nearby', authenticateToken, async (req, res) => {
    try {
        const { lat, lng, radius } = req.query;
        
        // Convert radius from km to degrees (approximate)
        const radiusDegrees = radius / 111;
        
        const [rows] = await pool.execute(
            `SELECT *, 
                (6371 * acos(
                    cos(radians(?)) * cos(radians(latitude)) * 
                    cos(radians(longitude) - radians(?)) + 
                    sin(radians(?)) * sin(radians(latitude))
                )) AS distance 
             FROM hospitals 
             HAVING distance < ? 
             ORDER BY distance`,
            [lat, lng, lat, radius]
        );
        
        res.json(rows);
    } catch (error) {
        console.error('Error fetching hospitals:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get hospital details
app.get('/api/hospitals/:id', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM hospitals WHERE id = ?',
            [req.params.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Hospital not found' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching hospital details:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get profile
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT first_name, last_name, email, phone, date_of_birth, gender, address FROM patients WHERE id = ?',
            [req.user.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update profile
app.put('/api/profile', authenticateToken, async (req, res) => {
    try {
        const { firstName, lastName, phone, dateOfBirth, gender, address } = req.body;
        
        const [result] = await pool.execute(
            `UPDATE patients 
             SET first_name = ?, last_name = ?, phone = ?, 
                 date_of_birth = ?, gender = ?, address = ?
             WHERE id = ?`,
            [firstName, lastName, phone, dateOfBirth, gender, address, req.user.id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        
        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update password
app.put('/api/profile/password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        // Get current password hash
        const [rows] = await pool.execute(
            'SELECT password_hash FROM patients WHERE id = ?',
            [req.user.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, rows[0].password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update password
        await pool.execute(
            'UPDATE patients SET password_hash = ? WHERE id = ?',
            [hashedPassword, req.user.id]
        );
        
        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete account
app.delete('/api/profile', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { password } = req.body;
        
        // Verify password
        const [rows] = await connection.execute(
            'SELECT password_hash FROM patients WHERE id = ?',
            [req.user.id]
        );
        
        if (rows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'User not found' });
        }
        
        const validPassword = await bcrypt.compare(password, rows[0].password_hash);
        if (!validPassword) {
            await connection.rollback();
            return res.status(401).json({ error: 'Invalid password' });
        }

        // Delete related records first (appointments)
        await connection.execute(
            'DELETE FROM appointments WHERE patient_id = ?',
            [req.user.id]
        );

        // Delete user account
        const [result] = await connection.execute(
            'DELETE FROM patients WHERE id = ?',
            [req.user.id]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'User not found' });
        }

        await connection.commit();
        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// Reschedule appointment
app.put('/api/appointments/:id/reschedule', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { newDate, newTime } = req.body;
        const appointmentId = req.params.id;

        // Get current appointment details
        const [current] = await connection.execute(
            `SELECT * FROM appointments 
             WHERE id = ? AND patient_id = ? AND status = 'scheduled'`,
            [appointmentId, req.user.id]
        );

        if (current.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Appointment not found or cannot be rescheduled' });
        }

        // Check if new slot is available
        const [conflicts] = await connection.execute(
            `SELECT id FROM appointments 
             WHERE doctor_id = ? AND appointment_date = ? 
             AND appointment_time = ? AND status = 'scheduled'
             AND id != ?`,
            [current[0].doctor_id, newDate, newTime, appointmentId]
        );

        if (conflicts.length > 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Selected time slot is not available' });
        }

        // Update appointment
        await connection.execute(
            `UPDATE appointments 
             SET appointment_date = ?,
                 appointment_time = ?,
                 previous_date = ?,
                 previous_time = ?,
                 reschedule_count = reschedule_count + 1
             WHERE id = ? AND patient_id = ?`,
            [newDate, newTime, current[0].appointment_date, current[0].appointment_time, 
             appointmentId, req.user.id]
        );

        await connection.commit();
        res.json({ message: 'Appointment rescheduled successfully' });
    } catch (error) {
        await connection.rollback();
        console.error('Error rescheduling appointment:', error);
        res.status(500).json({ message: 'Error rescheduling appointment' });
    } finally {
        connection.release();
    }
});

// Cancel appointment
app.put('/api/appointments/:id/cancel', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { reason } = req.body;
        
        const [result] = await connection.execute(
            `UPDATE appointments 
             SET status = 'canceled',
                 cancellation_reason = ?
             WHERE id = ? AND patient_id = ? AND status = 'scheduled'`,
            [reason, req.params.id, req.user.id]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Appointment not found or cannot be canceled' });
        }

        await connection.commit();
        res.json({ message: 'Appointment canceled successfully' });
    } catch (error) {
        await connection.rollback();
        console.error('Error canceling appointment:', error);
        res.status(500).json({ message: 'Error canceling appointment' });
    } finally {
        connection.release();
    }
});

// Doctor login
app.post('/api/doctor/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const [rows] = await pool.execute('SELECT * FROM doctors WHERE email = ?', [email]);
        
        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(password, rows[0].password_hash);
        if (!valid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Create token with explicit role
        const token = jwt.sign(
            {
                id: rows[0].id,
                email: rows[0].email,
                role: 'doctor', // Explicitly set role
                firstName: rows[0].first_name,
                lastName: rows[0].last_name,
                specialization: rows[0].specialization
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ 
            token,
            userType: 'doctor',
            doctor: {
                id: rows[0].id,
                name: `${rows[0].first_name} ${rows[0].last_name}`,
                specialization: rows[0].specialization
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Error during login' });
    }
});

// Doctor authentication middleware
function authenticateDoctor(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            console.log('No token provided');
            return res.status(401).json({ message: 'No token provided' });
        }

        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                console.error('Token verification error:', err);
                return res.status(403).json({ message: 'Invalid token' });
            }

            // Add debug logging
            console.log('Decoded token:', decoded);
            console.log('User role:', decoded.role);

            // Check if the user is a doctor
            if (!decoded.role || decoded.role !== 'doctor') {
                console.log('User is not a doctor:', decoded.role);
                return res.status(403).json({ message: 'Not authorized as doctor' });
            }

            req.user = decoded;
            next();
        });
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({ message: 'Authentication error' });
    }
}

// Get doctor dashboard stats
app.get('/api/doctor/stats', authenticateDoctor, async (req, res) => {
    try {
        const doctorId = req.user.id;
        
        // Get total unique patients
        const [patientCount] = await pool.execute(
            `SELECT COUNT(DISTINCT patient_id) as count 
             FROM appointments 
             WHERE doctor_id = ?`,
            [doctorId]
        );

        // Get total appointments
        const [appointmentCount] = await pool.execute(
            'SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ?',
            [doctorId]
        );

        // Get completed appointments
        const [completedCount] = await pool.execute(
            `SELECT COUNT(*) as count 
             FROM appointments 
             WHERE doctor_id = ? AND status = 'completed'`,
            [doctorId]
        );

        // Get upcoming appointments
        const [upcomingCount] = await pool.execute(
            `SELECT COUNT(*) as count 
             FROM appointments 
             WHERE doctor_id = ? 
             AND appointment_date >= CURDATE() 
             AND status = 'scheduled'`,
            [doctorId]
        );

        res.json({
            totalPatients: patientCount[0].count,
            totalAppointments: appointmentCount[0].count,
            completedAppointments: completedCount[0].count,
            upcomingAppointments: upcomingCount[0].count
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get today's appointments
app.get('/api/doctor/appointments/today', authenticateDoctor, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT a.*, 
                    CONCAT(p.first_name, ' ', p.last_name) as patient_name
             FROM appointments a
             JOIN patients p ON a.patient_id = p.id
             WHERE a.doctor_id = ? 
             AND DATE(a.appointment_date) = CURDATE()
             AND a.status = 'scheduled'
             ORDER BY a.appointment_time`,
            [req.user.id]
        );

        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Doctor signup
app.post('/api/doctor/signup', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { firstName, lastName, email, password, phone, specialization, schedule } = req.body;
        
        // Check if email already exists
        const [existing] = await connection.execute(
            'SELECT id FROM doctors WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insert doctor
        const [result] = await connection.execute(
            `INSERT INTO doctors (
                first_name, last_name, email, password_hash, 
                phone, specialization, schedule
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                firstName, lastName, email, hashedPassword,
                phone, specialization, JSON.stringify(schedule)
            ]
        );

        await connection.commit();
        res.status(201).json({ message: 'Registration successful' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
});

// Get doctor profile
app.get('/api/doctor/profile', authenticateDoctor, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT first_name, last_name, email, phone, 
                    specialization, schedule 
             FROM doctors WHERE id = ?`,
            [req.user.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Profile not found' });
        }

        // Ensure schedule is properly parsed
        let schedule = {};
        try {
            schedule = rows[0].schedule ? JSON.parse(rows[0].schedule) : {};
        } catch (error) {
            console.error('Error parsing schedule:', error);
            schedule = {};
        }

        const profile = {
            ...rows[0],
            schedule: schedule
        };
        
        res.json(profile);
    } catch (error) {
        console.error('Server error loading profile:', error);
        res.status(500).json({ message: 'Error loading profile' });
    }
});

// Update doctor profile
app.put('/api/doctor/profile', authenticateDoctor, async (req, res) => {
    try {
        const { firstName, lastName, phone, schedule } = req.body;
        
        const [result] = await pool.execute(
            `UPDATE doctors 
             SET first_name = ?, 
                 last_name = ?, 
                 phone = ?, 
                 schedule = ?
             WHERE id = ?`,
            [
                firstName, 
                lastName, 
                phone, 
                JSON.stringify(schedule), 
                req.user.id
            ]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Profile not found' });
        }
        
        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Server error updating profile:', error);
        res.status(500).json({ message: 'Error updating profile' });
    }
});

// Update doctor password
app.put('/api/doctor/password', authenticateDoctor, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        const [rows] = await pool.execute(
            'SELECT password_hash FROM doctors WHERE id = ?',
            [req.user.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Doctor not found' });
        }
        
        const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
        if (!valid) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        await pool.execute(
            'UPDATE doctors SET password_hash = ? WHERE id = ?',
            [hashedPassword, req.user.id]
        );
        
        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete doctor account
app.delete('/api/doctor/profile', authenticateDoctor, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { password } = req.body;
        
        const [rows] = await connection.execute(
            'SELECT password_hash FROM doctors WHERE id = ?',
            [req.user.id]
        );
        
        if (rows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Doctor not found' });
        }
        
        const valid = await bcrypt.compare(password, rows[0].password_hash);
        if (!valid) {
            await connection.rollback();
            return res.status(401).json({ message: 'Invalid password' });
        }

        // Delete related appointments
        await connection.execute(
            'DELETE FROM appointments WHERE doctor_id = ?',
            [req.user.id]
        );

        // Delete doctor account
        await connection.execute(
            'DELETE FROM doctors WHERE id = ?',
            [req.user.id]
        );

        await connection.commit();
        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
});

// Get doctor's patients
app.get('/api/doctor/patients', authenticateDoctor, async (req, res) => {
    try {
        const { search, filter } = req.query;
        let query = `
            SELECT DISTINCT p.*, 
                   MAX(a.appointment_date) as last_visit
            FROM patients p
            JOIN appointments a ON p.id = a.patient_id
            WHERE a.doctor_id = ?
        `;

        const params = [req.user.id];

        if (search) {
            query += ` AND (p.first_name LIKE ? OR p.last_name LIKE ? OR p.phone LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (filter === 'recent') {
            query += ` AND a.appointment_date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)`;
        } else if (filter === 'pending') {
            query += ` AND a.status = 'scheduled'`;
        }

        query += ` GROUP BY p.id ORDER BY last_visit DESC`;

        const [rows] = await pool.execute(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get patient details with medical history
app.get('/api/doctor/patients/:id', authenticateDoctor, async (req, res) => {
    try {
        // Get patient details
        const [patientRows] = await pool.execute(
            `SELECT p.* 
             FROM patients p
             JOIN appointments a ON p.id = a.patient_id
             WHERE p.id = ? AND a.doctor_id = ?
             LIMIT 1`,
            [req.params.id, req.user.id]
        );

        if (patientRows.length === 0) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        // Get appointment history
        const [appointmentRows] = await pool.execute(
            `SELECT * FROM appointments 
             WHERE patient_id = ? AND doctor_id = ?
             ORDER BY appointment_date DESC`,
            [req.params.id, req.user.id]
        );

        const patient = {
            ...patientRows[0],
            appointments: appointmentRows
        };

        res.json(patient);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Upload medical record
app.post('/api/doctor/medical-records/upload', 
    authenticateDoctor, 
    upload.single('file'), 
    async (req, res) => {
        try {
            const { patientId, recordType, notes } = req.body;
            
            const [result] = await pool.execute(
                `INSERT INTO medical_records (
                    patient_id, doctor_id, record_type, 
                    file_name, file_path, notes
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    patientId,
                    req.user.id,
                    recordType,
                    req.file.originalname,
                    req.file.path,
                    notes
                ]
            );
            
            res.status(201).json({ message: 'Record uploaded successfully' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
);

// Get medical records
app.get('/api/doctor/medical-records', authenticateDoctor, async (req, res) => {
    try {
        const { patientId, type } = req.query;
        let query = `
            SELECT mr.*, 
                   CONCAT(p.first_name, ' ', p.last_name) as patient_name
            FROM medical_records mr
            JOIN patients p ON mr.patient_id = p.id
            WHERE mr.doctor_id = ?
        `;
        const params = [req.user.id];

        if (patientId) {
            query += ' AND mr.patient_id = ?';
            params.push(patientId);
        }

        if (type) {
            query += ' AND mr.record_type = ?';
            params.push(type);
        }

        query += ' ORDER BY mr.upload_date DESC';

        const [rows] = await pool.execute(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Download medical record
app.get('/api/doctor/medical-records/download/:id', authenticateDoctor, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT * FROM medical_records 
             WHERE id = ? AND doctor_id = ?`,
            [req.params.id, req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Record not found' });
        }

        res.download(rows[0].file_path);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get doctor's schedule
app.get('/api/doctor/schedule', authenticateDoctor, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT schedule FROM doctors WHERE id = ?',
            [req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Doctor not found' });
        }

        let schedule = {};
        try {
            schedule = JSON.parse(rows[0].schedule || '{}');
        } catch (error) {
            console.error('Error parsing schedule:', error);
        }

        res.json(schedule);
    } catch (error) {
        console.error('Error getting schedule:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update doctor's schedule
app.put('/api/doctor/schedule', authenticateDoctor, async (req, res) => {
    try {
        const { schedule } = req.body;
        
        // Validate schedule format
        if (!schedule || typeof schedule !== 'object') {
            return res.status(400).json({ error: 'Invalid schedule format' });
        }

        // Update schedule
        const [result] = await pool.execute(
            'UPDATE doctors SET schedule = ? WHERE id = ?',
            [JSON.stringify(schedule), req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Doctor not found' });
        }

        res.json({ message: 'Schedule updated successfully' });
    } catch (error) {
        console.error('Error updating schedule:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get doctor's appointments
app.get('/api/doctor/appointments', authenticateDoctor, async (req, res) => {
    try {
        const { status, date } = req.query;
        let query = `
            SELECT 
                a.*,
                p.first_name as patient_first_name,
                p.last_name as patient_last_name,
                p.phone as patient_phone,
                p.email as patient_email
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            WHERE a.doctor_id = ?
        `;
        const params = [req.user.id];

        if (status) {
            query += ' AND a.status = ?';
            params.push(status);
        }

        if (date) {
            query += ' AND a.appointment_date = ?';
            params.push(date);
        }

        query += ' ORDER BY a.appointment_date DESC, a.appointment_time ASC';

        const [appointments] = await pool.execute(query, params);
        res.json(appointments);
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get today's appointments for doctor
app.get('/api/doctor/appointments/today', authenticateDoctor, async (req, res) => {
    try {
        const [appointments] = await pool.execute(
            `SELECT 
                a.*,
                p.first_name as patient_first_name,
                p.last_name as patient_last_name,
                p.phone as patient_phone
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            WHERE a.doctor_id = ? 
            AND a.appointment_date = CURDATE()
            AND a.status = 'scheduled'
            ORDER BY a.appointment_time ASC`,
            [req.user.id]
        );
        res.json(appointments);
    } catch (error) {
        console.error('Error fetching today\'s appointments:', error);
        res.status(500).json({ error: error.message });
    }
});

// Check slot availability before booking
app.get('/api/check-slot-availability', authenticateToken, async (req, res) => {
    try {
        const { doctorId, date, time } = req.query;

        // Check if slot is already booked
        const [existingAppointments] = await pool.execute(
            `SELECT id FROM appointments 
             WHERE doctor_id = ? 
             AND appointment_date = ? 
             AND appointment_time = ?
             AND status = 'scheduled'`,
            [doctorId, date, time]
        );

        if (existingAppointments.length > 0) {
            return res.json({ available: false, message: 'This slot is already booked' });
        }

        // Check if slot is within doctor's schedule
        const [doctorSchedule] = await pool.execute(
            'SELECT schedule FROM doctors WHERE id = ?',
            [doctorId]
        );

        if (doctorSchedule.length === 0) {
            return res.json({ available: false, message: 'Doctor not found' });
        }

        const schedule = JSON.parse(doctorSchedule[0].schedule);
        const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'lowercase' });
        const daySchedule = schedule[dayOfWeek];

        if (!daySchedule || !daySchedule.start || !daySchedule.end) {
            return res.json({ available: false, message: 'Doctor is not available on this day' });
        }

        // Check if time is within working hours
        if (time < daySchedule.start || time > daySchedule.end) {
            return res.json({ available: false, message: 'Time is outside doctor\'s working hours' });
        }

        res.json({ available: true });
    } catch (error) {
        console.error('Error checking slot availability:', error);
        res.status(500).json({ error: error.message });
    }
});

// Book appointment with availability check
app.post('/api/appointments', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { doctorId, appointmentDate, appointmentTime } = req.body;

        // Verify doctor exists and is available
        const [doctorRows] = await connection.execute(
            'SELECT id, schedule FROM doctors WHERE id = ?',
            [doctorId]
        );

        if (doctorRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Doctor not found' });
        }

        // Check if slot is already booked
        const [existingAppointments] = await connection.execute(
            `SELECT id FROM appointments 
             WHERE doctor_id = ? 
             AND appointment_date = ? 
             AND appointment_time = ?
             AND status = 'scheduled'`,
            [doctorId, appointmentDate, appointmentTime]
        );

        if (existingAppointments.length > 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'This slot is already booked' });
        }

        // Create appointment
        const [result] = await connection.execute(
            `INSERT INTO appointments (
                patient_id, doctor_id, appointment_date, 
                appointment_time, status
            ) VALUES (?, ?, ?, ?, 'scheduled')`,
            [req.user.id, doctorId, appointmentDate, appointmentTime]
        );

        await connection.commit();
        res.status(201).json({ 
            message: 'Appointment booked successfully',
            appointmentId: result.insertId
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error booking appointment:', error);
        res.status(500).json({ error: 'Failed to book appointment' });
    } finally {
        connection.release();
    }
});

// Complete appointment
app.put('/api/doctor/appointments/:id/complete', authenticateDoctor, async (req, res) => {
    try {
        const [result] = await pool.execute(
            `UPDATE appointments 
             SET status = 'completed' 
             WHERE id = ? AND doctor_id = ? AND status = 'scheduled'`,
            [req.params.id, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Appointment not found or already modified' });
        }

        res.json({ message: 'Appointment marked as completed' });
    } catch (error) {
        console.error('Error completing appointment:', error);
        res.status(500).json({ message: error.message });
    }
});

// Cancel appointment
app.put('/api/doctor/appointments/:id/cancel', authenticateDoctor, async (req, res) => {
    try {
        const [result] = await pool.execute(
            `UPDATE appointments 
             SET status = 'canceled' 
             WHERE id = ? AND doctor_id = ? AND status = 'scheduled'`,
            [req.params.id, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Appointment not found or already modified' });
        }

        res.json({ message: 'Appointment canceled successfully' });
    } catch (error) {
        console.error('Error canceling appointment:', error);
        res.status(500).json({ message: error.message });
    }
});

// Add this route to serve the Google Maps API key
app.get('/api/maps-key', (req, res) => {
    res.json({ key: process.env.GOOGLE_MAPS_API_KEY });
});

// Get all hospitals
app.get('/api/hospitals', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM hospitals ORDER BY name');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching hospitals:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get patient profile
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT first_name, last_name, email, phone, date_of_birth, gender, address 
             FROM patients WHERE id = ?`,
            [req.user.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Profile not found' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Error fetching profile' });
    }
});

// Get patient appointments with doctor details
app.get('/api/appointments', authenticateToken, async (req, res) => {
    try {
        const { status } = req.query;
        let query = `
            SELECT 
                a.*,
                d.first_name as doctor_first_name,
                d.last_name as doctor_last_name,
                d.specialization
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            WHERE a.patient_id = ?
        `;
        const params = [req.user.id];

        if (status && status !== 'all') {
            query += ' AND a.status = ?';
            params.push(status);
        }

        query += ' ORDER BY a.appointment_date DESC, a.appointment_time ASC';

        const [rows] = await pool.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ message: 'Error fetching appointments' });
    }
});

// Get patient's appointments
app.get('/api/patient/appointments', authenticateToken, async (req, res) => {
    try {
        console.log('User from token:', req.user); // Debug log
        const { status } = req.query;
        let query = `
            SELECT 
                a.*,
                d.first_name as doctor_first_name,
                d.last_name as doctor_last_name,
                d.specialization
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            WHERE a.patient_id = ?
        `;
        const params = [req.user.id];

        if (status && status !== 'all') {
            query += ' AND a.status = ?';
            params.push(status);
        }

        query += ' ORDER BY a.appointment_date DESC, a.appointment_time ASC';

        console.log('Query:', query); // Debug log
        console.log('Params:', params); // Debug log

        const [rows] = await pool.execute(query, params);
        console.log('Fetched appointments:', rows); // Debug log
        res.json(rows);
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ message: 'Error fetching appointments' });
    }
});

// Get single appointment details
app.get('/api/appointments/:id', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT a.*, 
                    d.first_name as doctor_first_name,
                    d.last_name as doctor_last_name,
                    d.specialization
             FROM appointments a
             JOIN doctors d ON a.doctor_id = d.id
             WHERE a.id = ? AND a.patient_id = ?`,
            [req.params.id, req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching appointment:', error);
        res.status(500).json({ message: 'Error fetching appointment details' });
    }
});

// Reschedule appointment
app.put('/api/appointments/:id/reschedule', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { newDate, newTime } = req.body;
        const appointmentId = req.params.id;

        // Get current appointment details
        const [current] = await connection.execute(
            `SELECT * FROM appointments 
             WHERE id = ? AND patient_id = ? AND status = 'scheduled'`,
            [appointmentId, req.user.id]
        );

        if (current.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Appointment not found or cannot be rescheduled' });
        }

        // Check if new slot is available
        const [conflicts] = await connection.execute(
            `SELECT id FROM appointments 
             WHERE doctor_id = ? AND appointment_date = ? 
             AND appointment_time = ? AND status = 'scheduled'
             AND id != ?`,
            [current[0].doctor_id, newDate, newTime, appointmentId]
        );

        if (conflicts.length > 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Selected time slot is not available' });
        }

        // Update appointment
        await connection.execute(
            `UPDATE appointments 
             SET appointment_date = ?,
                 appointment_time = ?,
                 previous_date = ?,
                 previous_time = ?,
                 reschedule_count = reschedule_count + 1
             WHERE id = ? AND patient_id = ?`,
            [newDate, newTime, current[0].appointment_date, current[0].appointment_time, 
             appointmentId, req.user.id]
        );

        await connection.commit();
        res.json({ message: 'Appointment rescheduled successfully' });
    } catch (error) {
        await connection.rollback();
        console.error('Error rescheduling appointment:', error);
        res.status(500).json({ message: 'Error rescheduling appointment' });
    } finally {
        connection.release();
    }
});

// Cancel appointment
app.put('/api/appointments/:id/cancel', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { reason } = req.body;
        
        const [result] = await connection.execute(
            `UPDATE appointments 
             SET status = 'canceled',
                 cancellation_reason = ?
             WHERE id = ? AND patient_id = ? AND status = 'scheduled'`,
            [reason, req.params.id, req.user.id]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Appointment not found or cannot be canceled' });
        }

        await connection.commit();
        res.json({ message: 'Appointment canceled successfully' });
    } catch (error) {
        await connection.rollback();
        console.error('Error canceling appointment:', error);
        res.status(500).json({ message: 'Error canceling appointment' });
    } finally {
        connection.release();
    }
});

// Add this helper function at the top with other imports
function generateDefaultSchedule() {
    return {
        monday: { start: '09:00', end: '17:00' },
        tuesday: { start: '09:00', end: '17:00' },
        wednesday: { start: '09:00', end: '17:00' },
        thursday: { start: '09:00', end: '17:00' },
        friday: { start: '09:00', end: '17:00' }
    };
}

// Add this route to update doctor's schedule
app.put('/api/doctors/:id/schedule', authenticateToken, async (req, res) => {
    try {
        const schedule = req.body.schedule || generateDefaultSchedule();
        await pool.execute(
            'UPDATE doctors SET schedule = ? WHERE id = ?',
            [JSON.stringify(schedule), req.params.id]
        );
        res.json({ message: 'Schedule updated successfully' });
    } catch (error) {
        console.error('Error updating schedule:', error);
        res.status(500).json({ message: 'Error updating schedule' });
    }
});

// Logout route
app.post('/api/logout', authenticateToken, async (req, res) => {
    try {
        // You could implement token blacklisting here if needed
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Error during logout' });
    }
});

// Admin login route
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const [rows] = await pool.execute(
            'SELECT * FROM admin WHERE username = ?',
            [username]
        );

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(password, rows[0].password_hash);
        if (!valid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            {
                id: rows[0].id,
                username: rows[0].username,
                role: rows[0].role,
                type: 'admin'
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ 
            token,
            admin: {
                id: rows[0].id,
                username: rows[0].username,
                role: rows[0].role
            }
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ message: 'Error during login' });
    }
});

// Admin authentication middleware
function authenticateAdmin(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                return res.status(403).json({ message: 'Invalid token' });
            }

            if (decoded.type !== 'admin') {
                return res.status(403).json({ message: 'Not authorized as admin' });
            }

            req.user = decoded;
            next();
        });
    } catch (error) {
        console.error('Admin authentication error:', error);
        res.status(500).json({ message: 'Authentication error' });
    }
}

// Add these routes to your server.js

// Get admin dashboard statistics
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
    try {
        // Get total doctors
        const [doctorCount] = await pool.execute(
            'SELECT COUNT(*) as count FROM doctors'
        );

        // Get total patients
        const [patientCount] = await pool.execute(
            'SELECT COUNT(*) as count FROM patients'
        );

        // Get today's appointments
        const [todayAppointments] = await pool.execute(
            'SELECT COUNT(*) as count FROM appointments WHERE DATE(appointment_date) = CURDATE()'
        );

        // Get total appointments
        const [totalAppointments] = await pool.execute(
            'SELECT COUNT(*) as count FROM appointments'
        );

        // Get completed appointments
        const [completedAppointments] = await pool.execute(
            'SELECT COUNT(*) as count FROM appointments WHERE status = "completed"'
        );

        // Get canceled appointments
        const [canceledAppointments] = await pool.execute(
            'SELECT COUNT(*) as count FROM appointments WHERE status = "canceled"'
        );

        // Get active patients (patients with scheduled appointments)
        const [activePatients] = await pool.execute(
            'SELECT COUNT(DISTINCT patient_id) as count FROM appointments WHERE status = "scheduled"'
        );

        // Get new patients this month
        const [newPatients] = await pool.execute(
            'SELECT COUNT(*) as count FROM patients WHERE MONTH(created_at) = MONTH(CURRENT_DATE())'
        );

        res.json({
            totalDoctors: doctorCount[0].count,
            totalPatients: patientCount[0].count,
            todayAppointments: todayAppointments[0].count,
            totalAppointments: totalAppointments[0].count,
            completedAppointments: completedAppointments[0].count,
            canceledAppointments: canceledAppointments[0].count,
            activePatients: activePatients[0].count,
            newPatientsThisMonth: newPatients[0].count
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ message: 'Error fetching statistics' });
    }
});

// Get appointment statistics for chart
app.get('/api/admin/appointment-stats', authenticateAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT 
                DATE(appointment_date) as date,
                COUNT(*) as count
             FROM appointments
             WHERE appointment_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
             GROUP BY DATE(appointment_date)
             ORDER BY date`
        );

        const labels = rows.map(row => row.date);
        const data = rows.map(row => row.count);

        res.json({ labels, data });
    } catch (error) {
        console.error('Error fetching appointment stats:', error);
        res.status(500).json({ message: 'Error fetching appointment statistics' });
    }
});

// Get doctor specialization statistics
app.get('/api/admin/specialization-stats', authenticateAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT 
                specialization,
                COUNT(*) as count
             FROM doctors
             GROUP BY specialization
             ORDER BY count DESC`
        );

        const labels = rows.map(row => row.specialization);
        const data = rows.map(row => row.count);

        res.json({ labels, data });
    } catch (error) {
        console.error('Error fetching specialization stats:', error);
        res.status(500).json({ message: 'Error fetching specialization statistics' });
    }
});

// Get all patients (admin)
app.get('/api/admin/patients', authenticateAdmin, async (req, res) => {
    try {
        const { search, status } = req.query;
        let query = `
            SELECT p.*, 
                   COUNT(a.id) as appointment_count,
                   MAX(a.appointment_date) as last_visit
            FROM patients p
            LEFT JOIN appointments a ON p.id = a.patient_id
        `;

        const params = [];
        if (search) {
            query += ` WHERE (p.first_name LIKE ? OR p.last_name LIKE ? OR p.email LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ` GROUP BY p.id ORDER BY p.created_at DESC`;

        const [rows] = await pool.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching patients:', error);
        res.status(500).json({ message: 'Error fetching patients' });
    }
});

// Get patient details (admin)
app.get('/api/admin/patients/:id', authenticateAdmin, async (req, res) => {
    try {
        const [patient] = await pool.execute(
            'SELECT * FROM patients WHERE id = ?',
            [req.params.id]
        );

        if (patient.length === 0) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        // Get patient's appointments
        const [appointments] = await pool.execute(
            `SELECT a.*, 
                    CONCAT(d.first_name, ' ', d.last_name) as doctor_name
             FROM appointments a
             JOIN doctors d ON a.doctor_id = d.id
             WHERE a.patient_id = ?
             ORDER BY a.appointment_date DESC`,
            [req.params.id]
        );

        res.json({
            ...patient[0],
            appointments
        });
    } catch (error) {
        console.error('Error fetching patient details:', error);
        res.status(500).json({ message: 'Error fetching patient details' });
    }
});

// Get all appointments (admin)
app.get('/api/admin/appointments', authenticateAdmin, async (req, res) => {
    try {
        const { date, status } = req.query;
        let query = `
            SELECT a.*,
                   CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                   CONCAT(d.first_name, ' ', d.last_name) as doctor_name
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN doctors d ON a.doctor_id = d.id
            WHERE 1=1
        `;

        const params = [];
        if (date) {
            query += ` AND a.appointment_date = ?`;
            params.push(date);
        }
        if (status && status !== 'all') {
            query += ` AND a.status = ?`;
            params.push(status);
        }

        query += ` ORDER BY a.appointment_date DESC, a.appointment_time ASC`;

        const [rows] = await pool.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ message: 'Error fetching appointments' });
    }
});

// Update appointment status (admin)
app.put('/api/admin/appointments/:id/status', authenticateAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const [result] = await pool.execute(
            'UPDATE appointments SET status = ? WHERE id = ?',
            [status, req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        res.json({ message: 'Appointment status updated successfully' });
    } catch (error) {
        console.error('Error updating appointment:', error);
        res.status(500).json({ message: 'Error updating appointment' });
    }
});

// Get all doctors (admin)
app.get('/api/admin/doctors', authenticateAdmin, async (req, res) => {
    try {
        const { search, specialization, status } = req.query;
        let query = `
            SELECT d.*, 
                   COUNT(DISTINCT a.id) as appointment_count,
                   COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) as completed_appointments
            FROM doctors d
            LEFT JOIN appointments a ON d.id = a.doctor_id
            WHERE 1=1
        `;
        
        const params = [];
        if (search) {
            query += ` AND (d.first_name LIKE ? OR d.last_name LIKE ? OR d.email LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (specialization) {
            query += ` AND d.specialization = ?`;
            params.push(specialization);
        }
        if (status) {
            query += ` AND d.status = ?`;
            params.push(status);
        }

        query += ` GROUP BY d.id ORDER BY d.created_at DESC`;

        const [rows] = await pool.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching doctors:', error);
        res.status(500).json({ message: 'Error fetching doctors' });
    }
});

// Update doctor status
app.put('/api/admin/doctors/:id/status', authenticateAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        
        // Check for existing appointments if deactivating
        if (status === 'inactive') {
            const [appointments] = await pool.execute(
                'SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND status = "scheduled"',
                [req.params.id]
            );
            
            if (appointments[0].count > 0) {
                return res.status(400).json({ 
                    message: 'Cannot deactivate doctor with scheduled appointments' 
                });
            }
        }

        const [result] = await pool.execute(
            'UPDATE doctors SET status = ? WHERE id = ?',
            [status, req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Doctor not found' });
        }

        res.json({ message: 'Doctor status updated successfully' });
    } catch (error) {
        console.error('Error updating doctor status:', error);
        res.status(500).json({ message: 'Error updating doctor status' });
    }
});

// Get all specializations
app.get('/api/admin/specializations', authenticateAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT DISTINCT specialization FROM doctors ORDER BY specialization'
        );
        res.json(rows.map(row => row.specialization));
    } catch (error) {
        console.error('Error fetching specializations:', error);
        res.status(500).json({ message: 'Error fetching specializations' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    try {
        await pool.end();
        console.log('Pool connections closed.');
        process.exit(0);
    } catch (err) {
        console.error('Error closing pool connections:', err);
        process.exit(1);
    }
}); 