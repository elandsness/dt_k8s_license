const collate_data = (from, to, dbHost, dbUser, dbPass, dbDb) => {
    return new Promise ((resolve) => {
        // Load required packages
        const mysql = require('mysql'); // for connecting to db

        // connect to the db
        const con = mysql.createConnection({
                host: dbHost,
                user: dbUser,
                password: dbPass,
                database: dbDb
            }); 
            con.connect(function(err) {
            if (err) throw err;
            console.log("Connected!");
        });

        // fetch and collate host data
        let q = `SELECT host_id,
                    timestamp,
                    SUM(memory) as memory
                FROM tbl_pgi2host
                JOIN tbl_pgidata USING (pgi_id)
                WHERE timestamp >= ${from}
                AND timestamp <= ${to}
                GROUP BY host_id, timestamp
                ORDER BY timestamp`;
        con.query(q, function (err, res) {
            if (err) throw err;
                let tmp_v = [];
                for (let x of res){
                    tmp_v.push(`('${x.host_id}', ${x.timestamp}, ${x.memory.toFixed(5)})`);
                }
                if (tmp_v.length > 0){
                // insert collated host data into db
                let insert_q = `INSERT INTO tbl_hostmemdata (host_id, timestamp, memory) VALUES ${tmp_v.join(', ')}`;
                con.query(insert_q, function (err, res) {
                    if (err) throw err;
                    console.log(res);

                    // collate on namespace
                    let namespace_q = `SELECT namespaces,
                                            timestamp,
                                            SUM(memory) as memory
                                        FROM tbl_pgi2host
                                        JOIN tbl_pgidata USING (pgi_id)
                                        WHERE timestamp >= ${from}
                                        AND timestamp <= ${to}
                                        GROUP BY namespaces, timestamp
                                        ORDER BY timestamp`;
                    con.query(namespace_q, function (err, res) {
                        if (err) throw err;
                        let tmp_v = [];
                        for (let x of res){
                            tmp_v.push(`('${x.namespaces}', ${x.timestamp}, ${x.memory.toFixed(5)})`);
                        }
                        if (tmp_v.length > 0){
                            // insert collated host data into db
                            let insertns_q = `INSERT INTO tbl_nsmemdata (namespaces, timestamp, memory) VALUES ${tmp_v.join(', ')}`;
                            con.query(insertns_q, function (err, res) {
                                if (err) throw err;
                                console.log(res);

                                // remove the old detail data
                                let cleanup_q = `DELETE FROM tbl_pgidata WHERE timestamp >= ${from} AND timestamp <= ${to}`;
                                con.query(cleanup_q, function (err, res) {
                                    if (err) throw err;
                                    console.log(res);

                                    resolve(`Data collated for data between ${from} and ${to}`);
                                });
                            });
                        } else {
                            resolve(`Nothing to collate between ${from} and ${to}`);
                        }
                    });
                });
            } else {
                resolve(`Nothing to collate between ${from} and ${to}`);
            }
        });
    });
}
module.exports = {
    collate_data: collate_data,
};