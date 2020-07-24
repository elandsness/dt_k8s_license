const collate_data = (dbHost, dbUser, dbPass, dbDb) => {
   return new Promise ((resolve) => {
      // Load required packages
      const mysql = require('mysql'); // for connecting to db

      // connect to the db
      let con;
      let con_opts = {
         host: dbHost,
         user: dbUser,
         password: dbPass,
         database: dbDb
      }
      if (process.env.LOG_LEVEL.toLowerCase() == 'debug'){
         con_opts.debug = true;
      }
      const connect_2_db = () => {
         con = mysql.createConnection(con_opts); 
         con.connect(function(err) {
         if (err) throw err;
               console.log(new Date(), "Connected!");
         });
      }
      connect_2_db();

      con.on('error', function(err) {
         console.log(new Date(),err.code);
         connect_2_db();
      });

      // fetch and collate host data
      let q = `SELECT host_id,
                  timestamp,
                  SUM(memory) as memory
               FROM tbl_pgi2host
               JOIN tbl_pgidata USING (pgi_id)
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
               let insert_q = `REPLACE INTO tbl_hostmemdata (host_id, timestamp, memory) VALUES ${tmp_v.join(', ')}`;
               con.query(insert_q, function (err, res) {
                  if (err) throw err;
                  console.log(new Date(), res);

                  // collate on namespace
                  let namespace_q = `SELECT namespaces,
                                          timestamp,
                                          SUM(memory) as memory
                                       FROM tbl_pgi2host
                                       JOIN tbl_pgidata USING (pgi_id)
                                       GROUP BY namespaces, timestamp
                                       ORDER BY timestamp`;
                  con.query(namespace_q, function (err, res) {
                     if (err) throw err;
                     let tmp_v = [], tmp_d = [];
                     for (let x of res){
                           tmp_v.push(`('${x.namespaces}', ${x.timestamp}, ${x.memory.toFixed(5)})`);
                           tmp_d.push(x.timestamp);
                     }
                     if (tmp_v.length > 0){
                           // insert collated host data into db
                           let insertns_q = `REPLACE INTO tbl_nsmemdata (namespaces, timestamp, memory) VALUES ${tmp_v.join(', ')}`;
                           con.query(insertns_q, function (err, res) {
                              if (err) throw err;
                              console.log(new Date(), res);

                              // remove the old detail data
                              let cleanup_q = `DELETE FROM tbl_pgidata WHERE timestamp IN (${tmp_d.join(', ')})`;
                              con.query(cleanup_q, function (err, res) {
                                 if (err) throw err;
                                 console.log(new Date(), res);

                                 resolve(`Data collated`);
                              });
                           });
                     } else {
                           resolve(`Nothing to collate`);
                     }
                  });
               });
         } else {
               resolve(`Nothing to collate`);
         }
      });
   });
}
module.exports = {
    collate_data: collate_data,
};