-- Add member_number column
ALTER TABLE public.professionals ADD COLUMN member_number integer UNIQUE;

-- Populate existing records based on creation order
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM public.professionals
)
UPDATE public.professionals p
SET member_number = n.rn
FROM numbered n
WHERE p.id = n.id;

-- Create sequence starting after current max
CREATE SEQUENCE public.professionals_member_number_seq;
SELECT setval('public.professionals_member_number_seq', COALESCE((SELECT MAX(member_number) FROM public.professionals), 0));

-- Set default for new rows
ALTER TABLE public.professionals ALTER COLUMN member_number SET DEFAULT nextval('public.professionals_member_number_seq');