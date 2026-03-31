const {Client} = require('pg');
const c = new Client({connectionString: 'postgresql://neondb_owner:npg_QadoWb5Xxf9c@ep-falling-breeze-anfiober-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require'});
c.connect()
  .then(() => c.query('SELECT id, status, user_id, s3_bucket FROM jobs WHERE id = $1', ['f4716b7a-7d9a-4992-95c6-15b5dc11615a']))
  .then(r => { console.log('Job:', JSON.stringify(r.rows[0])); return c.query('SELECT id, s3_bucket, s3_region FROM users WHERE id = $1', ['7626e4bc-fa5d-4a8f-b3a3-a53802631c5d']); })
  .then(r => { console.log('User:', JSON.stringify(r.rows[0])); c.end(); })
  .catch(e => { console.error(e.message); c.end(); });
