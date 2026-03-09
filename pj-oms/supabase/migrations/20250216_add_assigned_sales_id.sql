-- Add assigned_sales_id for admin assignment (who the student is assigned to)
-- created_by = who created the student (set on insert)
-- assigned_sales_id = who it's assigned to (admin can update)
ALTER TABLE students
ADD COLUMN IF NOT EXISTS assigned_sales_id uuid REFERENCES profiles(id);
