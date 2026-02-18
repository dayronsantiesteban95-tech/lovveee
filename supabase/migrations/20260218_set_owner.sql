-- Set Dayron as owner
INSERT INTO profiles (user_id, full_name, role)
SELECT id, 'Dayron Santi', 'owner'
FROM auth.users 
WHERE email = 'dayron.santiesteban95@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'owner';
