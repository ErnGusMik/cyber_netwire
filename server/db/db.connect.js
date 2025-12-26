import pg from 'pg';

export const pool = new pg.Pool({
    user: process.env.DBUSER,
    password: process.env.DBPASSW,
    host: process.env.DBHOST,
    port: process.env.DBPORT,
    database: process.env.DBNAME
})

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err)
    process.exit(-1)
  })



const query = async (text, params) => {
    // const client = await pool.connect()
    const res =  await pool.query(text, params)
    // client.release();
    return res;
}

export default query;