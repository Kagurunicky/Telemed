const bcrypt = require('bcrypt');
const { pool } = require('../config/database');

async function setupDoctors() {
    try {
        const defaultSchedule = {
            monday: { start: '09:00', end: '17:00' },
            tuesday: { start: '09:00', end: '17:00' },
            wednesday: { start: '09:00', end: '17:00' },
            thursday: { start: '09:00', end: '17:00' },
            friday: { start: '09:00', end: '17:00' }
        };

        const doctors = [
            {
                firstName: 'John',
                lastName: 'Smith',
                specialization: 'General Medicine',
                email: 'john.smith@example.com',
                password: 'password123',
                phone: '+254722000001',
                schedule: defaultSchedule
            },
            {
                firstName: 'Sarah',
                lastName: 'Johnson',
                specialization: 'Pediatrics',
                email: 'sarah.johnson@example.com',
                password: 'password123',
                phone: '+254722000002',
                schedule: defaultSchedule
            },
            {
                firstName: 'Michael',
                lastName: 'Chen',
                specialization: 'Cardiology',
                email: 'michael.chen@example.com',
                password: 'password123',
                phone: '+254722000003',
                schedule: defaultSchedule
            }
        ];

        for (const doctor of doctors) {
            const hashedPassword = await bcrypt.hash(doctor.password, 10);
            
            // Check if doctor already exists
            const [existing] = await pool.execute(
                'SELECT id FROM doctors WHERE email = ?',
                [doctor.email]
            );

            if (existing.length === 0) {
                await pool.execute(
                    `INSERT INTO doctors (
                        first_name, last_name, specialization, email, 
                        password_hash, phone, schedule
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        doctor.firstName,
                        doctor.lastName,
                        doctor.specialization,
                        doctor.email,
                        hashedPassword,
                        doctor.phone,
                        JSON.stringify(doctor.schedule)
                    ]
                );
                console.log(`Doctor ${doctor.firstName} ${doctor.lastName} inserted successfully`);
            } else {
                // Update existing doctor's schedule
                await pool.execute(
                    'UPDATE doctors SET schedule = ? WHERE email = ?',
                    [JSON.stringify(doctor.schedule), doctor.email]
                );
                console.log(`Updated schedule for ${doctor.firstName} ${doctor.lastName}`);
            }
        }

        console.log('Doctors setup completed successfully');
    } catch (error) {
        console.error('Error setting up doctors:', error);
    } finally {
        await pool.end();
    }
}

setupDoctors(); 