
-- Add last_portfolio_update column to track when the professional last updated their portfolio
ALTER TABLE public.professionals 
ADD COLUMN last_portfolio_update timestamp with time zone DEFAULT now();

-- Set existing professionals' last_portfolio_update to their updated_at value
UPDATE public.professionals SET last_portfolio_update = updated_at;
