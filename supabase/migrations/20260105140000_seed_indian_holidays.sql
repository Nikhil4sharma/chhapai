-- Seed Indian Public Holidays for 2026
-- Includes major national and religious holidays
-- 'type' is set to 'mandatory' for Gazetted holidays and 'optional' for Restricted ones

INSERT INTO public.hr_holidays (name, date, day_of_week, type, year)
VALUES
    ('Republic Day', '2026-01-26', 'Monday', 'mandatory', 2026),
    ('Maha Shivaratri', '2026-02-15', 'Sunday', 'optional', 2026),
    ('Holi', '2026-03-04', 'Wednesday', 'mandatory', 2026),
    ('Good Friday', '2026-04-03', 'Friday', 'mandatory', 2026),
    ('Eid-ul-Fitr (Ramzan Id)', '2026-03-20', 'Friday', 'mandatory', 2026),
    ('Dr. Ambedkar Jayanti', '2026-04-14', 'Tuesday', 'mandatory', 2026),
    ('Mahavir Jayanti', '2026-03-31', 'Tuesday', 'mandatory', 2026),
    ('Budha Purnima', '2026-05-31', 'Sunday', 'mandatory', 2026),
    ('Bakrid / Eid al-Adha', '2026-05-27', 'Wednesday', 'mandatory', 2026),
    ('Muharram', '2026-06-25', 'Thursday', 'mandatory', 2026),
    ('Independence Day', '2026-08-15', 'Saturday', 'mandatory', 2026),
    ('Janmashtami', '2026-09-04', 'Friday', 'optional', 2026),
    ('Eid-e-Milad / Milad-un-Nabi', '2026-08-26', 'Wednesday', 'mandatory', 2026),
    ('Gandhi Jayanti', '2026-10-02', 'Friday', 'mandatory', 2026),
    ('Dussehra', '2026-10-20', 'Tuesday', 'mandatory', 2026),
    ('Diwali (Deepavali)', '2026-11-08', 'Sunday', 'mandatory', 2026),
    ('Guru Nanak Jayanti', '2026-11-24', 'Tuesday', 'mandatory', 2026),
    ('Christmas Day', '2026-12-25', 'Friday', 'mandatory', 2026)
ON CONFLICT DO NOTHING;
