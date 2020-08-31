const collate_records = (con) => {
    return new Promise ((resolve) => {
        console.log(new Date(), "Collating historic data");
 
        // fetch and collate host data
        let q = `CALL CollateHistoric();`;
        con.query(q, function (err, res) {
            if (err) throw err;
            resolve("Collation initiated.");
        });
    });
 }
 module.exports = {
     collate_records: collate_records
 };