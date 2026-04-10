require('dotenv').config();
const { query } = require('./db');

async function addNightShiftAssignments() {
  try {
    console.log('Adding night shift to worker_site_assignments table...');

    // Drop the old constraint
    await query(`
      ALTER TABLE worker_site_assignments
      DROP CONSTRAINT "worker_site_assignments_shift_type_check"
    `);
    console.log('✓ Dropped old constraint');

    // Add new constraint with night shift
    await query(`
      ALTER TABLE worker_site_assignments
      ADD CONSTRAINT "worker_site_assignments_shift_type_check"
      CHECK (shift_type IN ('morning', 'evening', 'night'))
    `);
    console.log('✓ Added new constraint with night shift');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

addNightShiftAssignments();
