
ALTER TABLE email_templates DROP CONSTRAINT email_templates_step_type_check;
ALTER TABLE email_templates ADD CONSTRAINT email_templates_step_type_check CHECK (step_type = ANY (ARRAY['email_1', 'email_2', 'call', 'general']));
