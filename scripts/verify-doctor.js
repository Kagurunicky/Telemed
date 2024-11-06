const bcrypt = require('bcrypt');
const { pool } = require('../config/database');

async function verifyDoctor(email, password) {
    try {
        const [rows] = await pool.execute(
            'SELECT id, first_name, last_name, password_hash FROM doctors WHERE email = ?',
            [email]
        );

        if (rows.length === 0) {
            console.log('Doctor not found');
            return false;
        }

        const valid = await bcrypt.compare(password, rows[0].password_hash);
        if (valid) {
            console.log(`Login successful for Dr. ${rows[0].first_name} ${rows[0].last_name}`);
            return true;
        } else {
            console.log('Invalid password');
            return false;
        }
    } catch (error) {
        console.error('Error verifying doctor:', error);
        return false;
    } finally {
        await pool.end();
    }
}

// Example usage:
// verifyDoctor('john.smith@pendomedicare.com', 'Doctor@123');