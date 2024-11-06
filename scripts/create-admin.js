const bcrypt = require('bcrypt');
const { pool } = require('../config/database');

async function createAdmin() {
    try {
        // Clear password for demonstration
        const password = 'Admin@123';
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const adminData = {
            username: 'admin',
            email: 'admin@pendomedicare.com',
            role: 'super_admin'
        };

        await pool.execute(
            `INSERT INTO admin (username, password_hash, email, role) 
             VALUES (?, ?, ?, ?)`,
            [adminData.username, hashedPassword, adminData.email, adminData.role]
        );
        
        console.log('Admin created successfully with:');
        console.log('Username:', adminData.username);
        console.log('Password:', password);
        console.log('Email:', adminData.email);
    } catch (error) {
        console.error('Error creating admin:', error);
    } finally {
        await pool.end();
    }
}

createAdmin(); 