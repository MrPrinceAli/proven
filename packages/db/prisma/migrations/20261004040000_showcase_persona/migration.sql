-- Data migration (D-034): the showcase becomes the fictional persona "Arya Pratama", and demo
-- sandboxes created before personas existed get a name and a matching illustrated avatar.
-- Off-chain profile fields only; issued credentials are untouched.
UPDATE "profiles"
SET "slug" = 'arya-pratama', "display_name" = 'Arya Pratama', "avatar_seed" = 'pv-0'
WHERE "slug" = 'rina-demo'
  AND NOT EXISTS (SELECT 1 FROM "profiles" WHERE "slug" = 'arya-pratama');

WITH personas(i, name, seed) AS (
  VALUES (0, 'Dimas Prasetyo', 'pv-32'), (1, 'Bagas Wicaksono', 'pv-13'), (2, 'Raka Aditya', 'pv-16'),
         (3, 'Fajar Nugroho', 'pv-66'), (4, 'Reza Firmansyah', 'pv-53'), (5, 'Nadia Putri', 'pv-3'),
         (6, 'Salsa Maharani', 'pv-44'), (7, 'Ayu Lestari', 'pv-78'), (8, 'Kirana Dewi', 'pv-61'),
         (9, 'Laras Anindya', 'pv-42'), (10, 'Intan Permata', 'pv-52'), (11, 'Tiara Kusuma', 'pv-11')
)
UPDATE "profiles" p
SET "display_name" = personas.name, "avatar_seed" = personas.seed
FROM "users" u, personas
WHERE u."id" = p."user_id"
  AND u."auth_provider" = 'demo'
  AND p."display_name" = ''
  AND personas.i = abs(hashtext(p."id"::text)) % 12;
