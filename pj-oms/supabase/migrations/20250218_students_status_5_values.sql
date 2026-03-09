-- Update students status to 5 values: active, enrolled, pending, claimed, cancelled
ALTER TABLE students
DROP CONSTRAINT IF EXISTS students_status_check;

ALTER TABLE students
ADD CONSTRAINT students_status_check
CHECK (status IN ('active', 'enrolled', 'pending', 'claimed', 'cancelled'));
