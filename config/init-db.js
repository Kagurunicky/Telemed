const { pool } = require('./database');

async function initializeDatabase() {
    try {
        // Read SQL file content
        const fs = require('fs');
        const path = require('path');
        const sqlScript = fs.readFileSync(
            path.join(__dirname, '../hospital_telemed.sql'),
            'utf8'
        );

        // Split the SQL script into individual statements
        const statements = sqlScript
            .split(';')
            .filter(statement => statement.trim());

        // Execute each statement
        for (const statement of statements) {
            if (statement.trim()) {
                await pool.execute(statement);
            }
        }

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1);
    }
}

// Run if this script is executed directly
if (require.main === module) {
    initializeDatabase()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = initializeDatabase; 