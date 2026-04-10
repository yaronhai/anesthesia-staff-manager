require('dotenv').config();
const { query } = require('./db');

async function addNightShift() {
  try {
    console.log('Adding night shift to shift_requests table...');

    // Drop the old constraint
    await query(`
      ALTER TABLE shift_requests
      DROP CONSTRAINT "shift_requests_shift_type_check"
    `);
    console.log('✓ Dropped old constraint');

    // Add new constraint with night shift
    await query(`
      ALTER TABLE shift_requests
      ADD CONSTRAINT "shift_requests_shift_type_check"
      CHECK (shift_type IN ('morning', 'evening', 'night', 'oncall'))
    `);
    console.log('✓ Added new constraint with night shift');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

addNightShift();
