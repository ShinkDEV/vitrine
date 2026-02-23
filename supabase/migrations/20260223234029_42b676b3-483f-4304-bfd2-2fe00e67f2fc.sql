CREATE POLICY "Owners can update photos"
ON public.portfolio_photos
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM professionals
  WHERE professionals.id = portfolio_photos.professional_id
  AND professionals.user_id = auth.uid()
));