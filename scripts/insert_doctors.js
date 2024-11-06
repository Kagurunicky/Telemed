const doctors = [
    {
        firstName: 'John',
        lastName: 'Smith',
        specialization: 'General Medicine',
        email: 'john.smith@pendomedicare.com',
        password: 'Doctor@123',
        phone: '+254722000001',
        licenseNumber: 'MED001',
        schedule: {
            monday: ['09:00', '10:00', '11:00', '14:00', '15:00'],
            tuesday: ['09:00', '10:00', '11:00', '14:00', '15:00'],
            wednesday: ['09:00', '10:00', '11:00', '14:00', '15:00'],
            thursday: ['09:00', '10:00', '11:00', '14:00', '15:00'],
            friday: ['09:00', '10:00', '11:00', '14:00', '15:00']
        },
        slots: {
            monday: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30'],
            tuesday: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30'],
            wednesday: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30'],
            thursday: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30'],
            friday: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30']
        },
        workingHours: {
            monday: { start: '09:00', end: '17:00' },
            tuesday: { start: '09:00', end: '17:00' },
            wednesday: { start: '09:00', end: '17:00' },
            thursday: { start: '09:00', end: '17:00' },
            friday: { start: '09:00', end: '17:00' }
        }
    },
    // ... other doctors
];

async function insertDoctors() {
    try {
        for (const doctor of doctors) {
            const hashedPassword = await bcrypt.hash(doctor.password, 10);
            
            await pool.execute(
                `INSERT INTO doctors (
                    first_name, last_name, specialization, email, 
                    password_hash, phone, license_number, schedule,
                    slots, working_hours
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    doctor.firstName,
                    doctor.lastName,
                    doctor.specialization,
                    doctor.email,
                    hashedPassword,
                    doctor.phone,
                    doctor.licenseNumber,
                    JSON.stringify(doctor.schedule),
                    JSON.stringify(doctor.slots),
                    JSON.stringify(doctor.workingHours)
                ]
            );
            
            console.log(`Doctor ${doctor.firstName} ${doctor.lastName} inserted successfully`);
        }
        
        console.log('All doctors inserted successfully');
    } catch (error) {
        console.error('Error inserting doctors:', error);
    } finally {
        await pool.end();
    }
} 